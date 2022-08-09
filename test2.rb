# typed: true
# frozen_string_literal: true

class CloudStorage::SyncAllStorageJob < ApplicationJob
  queue_as :default

  def perform
    Rails.logger.info "Resyncing all storage jobs..."

    RLS.run_per_tenant do
      StorageIntegration.find_each do |storage_integration|
        CloudStorage::SyncRecitalDataJob.perform_later(
          storage_integration:,
        )
      end
    end
  end
end