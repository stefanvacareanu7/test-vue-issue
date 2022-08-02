package com.payzilch.acquirer.refund.service;

import com.payzilch.acquirer.acquirer.repository.AcquirerLoader;
import com.payzilch.acquirer.infrastructure.exception.AcquirerApiConstraintViolationException;
import com.payzilch.acquirer.infrastructure.sqs.SqsMessageProducer;
import com.payzilch.acquirer.refund.controller.dto.*;
import com.payzilch.acquirer.refund.domain.CreateRefund;
import com.payzilch.acquirer.refund.exceptions.RefundNotFoundException;
import com.payzilch.acquirer.refund.mapper.*;
import com.payzilch.acquirer.refund.repository.RefundLoader;
import com.payzilch.acquirer.refund.sqs.message.RefundMessage;
import com.payzilch.acquirer.sale.exceptions.SaleNotFoundException;
import com.payzilch.acquirer.sale.repository.SaleLoader;
import com.payzilch.acquirer.shared.acquirer.domain.AcquirerCode;
import com.payzilch.acquirer.shared.acquirer.webhook.events.AcquirerRefundEvent;
import com.payzilch.acquirer.shared.card.domain.Card;
import com.payzilch.acquirer.shared.infrastructure.exceptions.AcquirerApiException;
import com.payzilch.acquirer.shared.infrastructure.helper.ZilchEntityReferenceGenerator;
import com.payzilch.acquirer.shared.infrastructure.service.AcquirerApiService;
import com.payzilch.acquirer.shared.refund.domain.*;
import com.payzilch.acquirer.shared.refund.enums.RefundStatus;
import com.payzilch.acquirer.shared.sale.domain.Sale;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationContext;
import org.springframework.data.domain.*;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import javax.transaction.Transactional;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import java.util.stream.Collectors;

import static com.payzilch.acquirer.shared.event.domain.EventType.REFUND_PROCESSING;
import static com.payzilch.acquirer.shared.refund.entity.RefundEntity.REFERENCE_TYPE_REFUND;
import static com.payzilch.acquirer.shared.refund.enums.RefundStatus.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class RefundService {

    public static final int DEFAULT_SEARCH_PERIOD_IN_DAYS = 30;

    private final AcquirerLoader acquirerLoader;
    private final SaleLoader saleLoader;
    private final RefundLoader refundLoader;
    private final RefundMapper refundMapper;
    private final ZilchEntityReferenceGenerator referenceGenerator;
    private final ApplicationContext applicationContext;
    private final ExecuteRefundResponseMapper executeRefundResponseMapper;
    private final SqsMessageProducer sqsMessageProducer;

    private AcquirerApiService getAcquirerApiService(AcquirerCode acquirerCode) {
        return applicationContext.getBean(acquirerCode.name().toLowerCase(), AcquirerApiService.class);
    }

    @Transactional(dontRollbackOn = AcquirerApiException.class)
    public ExecuteRefundResponse executeRefund(CreateRefund createRefund) throws AcquirerApiException {
        log.trace("executeRefund:+ CreateRefund request received on sale reference {} for amount {} for currency code {} for idempotency key {}",
                createRefund.getSaleReference(), createRefund.getAmount(), createRefund.getCurrencyCode(), createRefund.getIdempotencyKey());
        final ExecuteRefundResponse executeRefundResponse;
        Refund refund = null;
        try {
            final Optional<ExecuteRefundResponse> executeRefundResponseOpt = Optional.ofNullable(createRefund.getIdempotencyKey())
                    .flatMap(key -> getExecuteRefundResponseForAlreadyExistingRefund(createRefund));
            if (executeRefundResponseOpt.isPresent()) {
                return executeRefundResponseOpt.get();
            }
            Sale sale = saleLoader.findByReference(createRefund.getSaleReference())
                    .orElseThrow(() -> new SaleNotFoundException(createRefund.getSaleReference()));
            validateRefundsTotalWithSaleAmount(sale, createRefund);
            refund = refundLoader.persistRefund(createRefund, sale);
            if (PENDING.equals(refund.getStatus())) {
                log.trace("executeRefund:- The refund with reference {} is currently pending.", refund.getReference());
                return ExecuteRefundResponse.builder()
                        .reference(refund.getReference())
                        .status(PENDING)
                        .build();
            }
            executeRefundResponse = executeRefundWithExternalAcquirer(refund, sale.getCard().getAcquirerCode());
            executeRefundResponse.setReference(refund.getReference());
            log.trace("executeRefund:- Refund {} executed successfully for sale {}  ", refund.getReference(), createRefund.getSaleReference());
        } catch (AcquirerApiException e) {
            refundLoader.declineRefund(refund.getId(), e.getDescription());
            log.error("Acquirer API Exception occurred while executing refund on the card.", e);
            throw e;
        }
        return executeRefundResponse;
    }

    @Transactional(dontRollbackOn = AcquirerApiException.class)
    public ExecuteRefundResponse acceptRefund(CreateRefund createRefund) {
        log.info("acceptRefund:+ Async create refund request received for sale reference {} for amount {} for idempotency key {}", createRefund.getSaleReference(),
                createRefund.getAmount(),
                createRefund.getIdempotencyKey());
        final Optional<ExecuteRefundResponse> executeRefundResponseOpt = Optional.ofNullable(createRefund.getIdempotencyKey())
                .flatMap(key -> getExecuteRefundResponseForAlreadyExistingRefund(createRefund));
        if (executeRefundResponseOpt.isPresent()) {
            log.debug("executeRefund:- The refund with reference={} is present", executeRefundResponseOpt.get().getReference());
            return executeRefundResponseOpt.get();
        }
        Sale sale = saleLoader.findByReference(createRefund.getSaleReference())
                .orElseThrow(() -> new SaleNotFoundException(createRefund.getSaleReference()));
        validateRefundsTotalWithSaleAmount(sale, createRefund);
        Refund refund = refundLoader.persistRefund(createRefund, sale);

        if (PENDING.equals(refund.getStatus())) {
            log.info("executeRefund:- The refund with reference {} is currently pending.", refund.getReference());
            return ExecuteRefundResponse.builder()
                    .reference(refund.getReference())
                    .status(PENDING)
                    .build();
        }

        sqsMessageProducer.sendRefundMessage(RefundMessage.builder()
                .refundId(refund.getId())
                .build());
        log.info("acceptRefund:- Sent refund event with refund reference {} with sale reference {} ",
                refund.getReference(),
                createRefund.getSaleReference());

        return ExecuteRefundResponse.builder()
                .reference(refund.getReference())
                .status(RefundStatus.CREATING)
                .build();
    }

    @Transactional(dontRollbackOn = AcquirerApiException.class)
    public void submitRefund(RefundMessage refundMessage) throws AcquirerApiException {
        log.trace("Received refund event with refund id {}", refundMessage.getRefundId());
        Refund refund = null;
        try {
            refund = refundLoader.findById(refundMessage.getRefundId()).orElseThrow(() -> new RefundNotFoundException(refundMessage.getRefundId()));
            refundLoader.addEvent(refund.getId(), REFUND_PROCESSING);
            executeRefundWithExternalAcquirer(refund, refund.getSale().getCard().getAcquirerCode());
        } catch (AcquirerApiException e) {
            refundLoader.declineRefund(refund.getId(), e.getDescription());
            log.error("Acquirer API Exception occurred while executing refund.", e);
            throw e;
        }
    }

    @Transactional
    public Refund getRefundDetails(String refundReference) {
        return refundLoader.findById(referenceGenerator.decode(REFERENCE_TYPE_REFUND, refundReference))
                .orElseThrow(() -> new RefundNotFoundException(refundReference));
    }

    private ExecuteRefundResponse executeRefundWithExternalAcquirer(Refund refund, AcquirerCode acquirerCode) throws AcquirerApiException {
        final ExecuteRefundResponse executeRefundResponse = getAcquirerApiService(acquirerCode).executeRefund(refund);
        refundLoader.updateRefundWithAcquirerResponse(refund.getId(), executeRefundResponse);
        return executeRefundResponse;
    }

    private Optional<ExecuteRefundResponse> getExecuteRefundResponseForAlreadyExistingRefund(CreateRefund createRefund) {
        return refundLoader.findBySaleIdAmountAndIdempotencyKey(
                        referenceGenerator.decode(Sale.REFERENCE_TYPE_SALE, createRefund.getSaleReference()),
                        createRefund.getAmount(),
                        createRefund.getIdempotencyKey())
                .map(refund -> {
                    if (RefundStatus.CREATING.equals(refund.getStatus())) {
                        return ExecuteRefundResponse.builder()
                                .reference(refund.getReference())
                                .status(RefundStatus.CREATING)
                                .build();
                    }
                    return executeRefundResponseMapper.mapToDuplicateExecuteRefundResponse(refund);
                });
    }

    private void validateRefundsTotalWithSaleAmount(Sale sale, CreateRefund createRefund) {
        BigDecimal totalRefundsValueOnSale = createRefund.getAmount();
        List<Refund> existingRefundsOnSale = refundLoader.getRefundsOnSale(sale.getId());
        if (!existingRefundsOnSale.isEmpty()) {
            totalRefundsValueOnSale = totalRefundsValueOnSale.add(existingRefundsOnSale.stream()
                    .filter(refund -> CREATED.equals(refund.getStatus()))
                    .map(Refund::getAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add));
        }
        if (totalRefundsValueOnSale.compareTo(sale.getAmount()) > 0) {
            throw new AcquirerApiConstraintViolationException("Total refund amount exceeds sale amount");
        }
    }

    @Transactional
    public RefundSearchResponseDto search(RefundSearchRequestDto searchRequest) {
        log.trace("Get Refunds request received with parameters: customer reference {}, card reference {}, start date {}, end date {} , refund status {}, order by {} , order direction {} ",
                searchRequest.getCustomerReference(), searchRequest.getCardReference(), searchRequest.getStartDate(), searchRequest.getEndDate(), searchRequest.getStatus(), searchRequest.getSortBy(), searchRequest.getDirection());

        LocalDateTime endDate = searchRequest.getEndDate() != null
                ? searchRequest.getEndDate().atTime(LocalTime.MAX)
                : LocalDateTime.now();
        LocalDateTime startDate = searchRequest.getStartDate() != null
                ? searchRequest.getStartDate().atStartOfDay()
                : endDate.minusDays(DEFAULT_SEARCH_PERIOD_IN_DAYS);

        LocalDateTime lastModifiedDate = refundLoader.getLastModifiedDateForSearchCriteria(
                        searchRequest.getCustomerReference(),
                        searchRequest.getCardReference() != null ? referenceGenerator.decode(Card.REFERENCE_TYPE_CARD, searchRequest.getCardReference()) : null,
                        startDate,
                        endDate,
                        searchRequest.getStatus())
                .orElse(LocalDateTime.now());


        ZonedDateTime saleModifiedDate = ZonedDateTime.of(lastModifiedDate.withNano(0), ZoneId.systemDefault());
        if (searchRequest.getIfModifiedSince() == null
                || searchRequest.getIfModifiedSince().isBefore(saleModifiedDate)) {
            log.trace("Modifications found on refunds for the given criteria after the cached time {}", searchRequest.getIfModifiedSince());
            Pageable pageable = PageRequest.of(searchRequest.getPage() - 1, searchRequest.getLimit(), Sort.by(searchRequest.getDirection(), searchRequest.getSortBy().getParameterName()));

            Page<Refund> page = refundLoader.search(searchRequest.getCustomerReference(),
                    searchRequest.getCardReference() != null ? referenceGenerator.decode(Card.REFERENCE_TYPE_CARD, searchRequest.getCardReference()) : null,
                    startDate,
                    endDate,
                    searchRequest.getStatus(),
                    pageable);
            return RefundSearchResponseDto.builder()
                    .page(page.getNumber() + 1)
                    .totalPages(page.getTotalPages())
                    .limit(page.getSize())
                    .totalCount(page.getTotalPages())
                    .count(!page.isEmpty() ? page.getContent().size() : 0)
                    .pageModified(true)
                    .pageDate(lastModifiedDate)
                    .data(!page.isEmpty() ? page.getContent().stream().map(refundMapper::mapToRefundSearchRecordInfoDto).collect(Collectors.toList()) : null)
                    .build();

        } else {
            log.trace("No modifications on refunds for the given criteria after the cached time {}", searchRequest.getIfModifiedSince());
            return RefundSearchResponseDto.builder()
                    .pageModified(false)
                    .pageDate(searchRequest.getIfModifiedSince().toLocalDateTime())
                    .build();
        }
    }

    @Async
    @Transactional
    public void submitPendingRefunds() {
        log.info("submitPendingRefunds:+ submitting pending refunds");
        acquirerLoader.getAllAcquirers().forEach(acquirer -> {
            LocalDateTime dateTime = LocalDateTime.now();
            long refundPendingDuration = acquirer.getRefundPendingDuration();
            dateTime.minusSeconds(refundPendingDuration);
            List<Refund> refundEntities = refundLoader.getRefunds(acquirer.getAcquirerCode(), PENDING, dateTime);
            refundEntities.forEach(refund -> sqsMessageProducer.sendRefundMessage(RefundMessage.builder()
                    .refundId(refund.getId())
                    .build()));
        });
        log.info("submitPendingRefunds:- submitted pending refunds");
    }

    @Transactional
    public void handleRefundEvent(AcquirerRefundEvent refundEvent) {
        log.trace("Refund event with token {} received from acquirer {} for sale token {} ", refundEvent.getRefundToken(), refundEvent.getAcquirerCode(), refundEvent.getSaleToken());
        Sale sale = saleLoader.findBySaleToken(refundEvent.getSaleToken());
        Refund refund = refundLoader.createRefundForEvent(refundEvent, sale);
        log.trace("Refund is crated with reference {} received from acquirer {} for sale token {} ", refund.getReference(), refundEvent.getAcquirerCode(), refundEvent.getSaleToken());
    }

}
