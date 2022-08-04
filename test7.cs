using FluentMigrator;

using Hydrogen.DataCatalog.Domain.Model.Datasets;

using Nest;

namespace Hydrogen.DataCatalog.Data.Migrations.Migrations
{
    /// <summary>
    /// Alter db schema for captured claims to add dealer group data.
    /// </summary>
    [Migration(2022041202)]
    [System.Diagnostics.CodeAnalysis.SuppressMessage(
        "Minor Code Smell",
        "S101:Types should be named in PascalCase",
        Justification = "Migrations are named according to our standards.")]
    public class Migration_2022041202_Captured_Claims_Dataset_Dealer_Group : ElasticMigrationBase
    {
        private static readonly string ClaimsId = "claims";
        private static readonly string CapturedClaimsId = "captured-claims";

        /// <summary>
        /// Initializes a new instance of the <see cref="Migration_2022041202_Captured_Claims_Dataset_Dealer_Group"/> class.
        /// </summary>
        /// <param name="elasticClient">A configured <see cref="IElasticClient"/> instance.</param>
        public Migration_2022041202_Captured_Claims_Dataset_Dealer_Group(IElasticClient elasticClient)
            : base(elasticClient)
        {
        }

        /// <inheritdoc/>
        public override void Up()
        {
            UpdateDocument<Dataset>(Key(ClaimsId), this.UpdateClaimsDataset());
            UpdateDocument<Dataset>(Key(CapturedClaimsId), this.UpdateCapturedClaimsDataset());
        }

        private object UpdateClaimsDataset() =>
            new
            {
                Columns = new[]
                    {
                        DatasetColumn(DataType.Text, "claim_number", "Claim #"),
                        DatasetColumn(DataType.Text, "contract_number", "Contract #"),
                        DatasetColumn(DataType.Date, "date_loss_occurred", "Date loss occurred", "M/D/YYYY"),
                        DatasetColumn(DataType.Number, "odometer_at_time_of_loss", "Odometer at time of loss"),
                        DatasetColumn(DataType.Date, "incurred_date", "Incurred date", "M/D/YYYY"),
                        DatasetColumn(DataType.Date, "cycle_month", "Cycle month", "M/D/YYYY"),
                        DatasetColumn(DataType.Number, "incurred_mileage", "Incurred mileage"),
                        DatasetColumn(DataType.Text, "retention_type", "Retention type"),
                        DatasetColumn(DataType.Number, "elapsed_days", "Elapsed days"),
                        DatasetColumn(DataType.Number, "elapsed_mileage", "Elapsed mileage"),
                        DatasetColumn(DataType.Text, "product_code", "Product"),
                        DatasetColumn(DataType.Number, "amount_paid", "Amount paid ($)", "$"),
                        DatasetColumn(DataType.Text, "claim_component", "Claim component"),
                        DatasetColumn(DataType.Text, "carrier", "Carrier", isSecured: true),
                        DatasetColumn(DataType.Text, "customer_first_name", "Customer first name"),
                        DatasetColumn(DataType.Text, "customer_middle_name", "Customer middle name"),
                        DatasetColumn(DataType.Text, "customer_last_name", "Customer last name"),
                        DatasetColumn(DataType.Text, "repair_order_number", "Repair order #"),
                        DatasetColumn(DataType.Text, "vin", "VIN"),
                        DatasetColumn(DataType.Number, "vehicle_year", "Year"),
                        DatasetColumn(DataType.Text, "vehicle_make", "Make"),
                        DatasetColumn(DataType.Text, "vehicle_model", "Model"),
                        DatasetColumn(DataType.Text, "vehicle_trim", "Trim"),
                        DatasetColumn(DataType.Text, "selling_dealer_number", "Selling dealer #"),
                        DatasetColumn(DataType.Text, "selling_dealer_name", "Selling dealer"),
                        DatasetColumn(DataType.Text, "dealer_group_number", "Selling dealer group #"),
                        DatasetColumn(DataType.Text, "dealer_group_name", "Selling dealer group"),
                        DatasetColumn(DataType.Text, "repair_facility", "Repair facility", isSecured: true),
                        DatasetColumn(DataType.Text, "captured_by", "Captured by", isSecured: true),
                        DatasetColumn(DataType.Text, "captured_dealer_group_number", "Captured dealer group #", isSecured: true),
                        DatasetColumn(DataType.Text, "captured_dealer_group_name", "Captured dealer group", isSecured: true),
                        DatasetColumn(DataType.Date, "sale_date", "Sale date", "M/D/YYYY"),
                        DatasetColumn(DataType.Number, "sale_mileage", "Sale mileage"),
                    },
            };

        private object UpdateCapturedClaimsDataset() =>
            new
            {
                Columns = new[]
                    {
                        DatasetColumn(DataType.Date, "incurred_date", "Incurred date", "M/D/YYYY"),
                        DatasetColumn(DataType.Text, "contract_number", "Contract number"),
                        DatasetColumn(DataType.Text, "product_code", "Product code"),
                        DatasetColumn(DataType.Text, "claim_number", "Claim #"),
                        DatasetColumn(DataType.Text, "claim_component", "Claim component"),
                        DatasetColumn(DataType.Text, "vin", "VIN"),
                        DatasetColumn(DataType.Text, "customer_first_name", "Customer first name"),
                        DatasetColumn(DataType.Text, "customer_middle_name", "Customer middle name"),
                        DatasetColumn(DataType.Text, "customer_last_name", "Customer last name"),
                        DatasetColumn(DataType.Date, "date_loss_occurred", "Date loss occurred", "M/D/YYYY"),
                        DatasetColumn(DataType.Number, "odometer_at_time_of_loss", "Odometer at time of loss"),
                        DatasetColumn(DataType.Number, "amount_paid", "Amount paid ($)", "$"),
                        DatasetColumn(DataType.Text, "captured_dealer_name", "Captured dealer"),
                        DatasetColumn(DataType.Text, "captured_dealer_number", "Captured dealer #"),
                        DatasetColumn(DataType.Text, "captured_dealer_group_name", "Captured dealer group"),
                        DatasetColumn(DataType.Text, "captured_dealer_group_number", "Captured dealer group #"),
                        DatasetColumn(DataType.Text, "repair_order_number", "Repair order #"),
                        DatasetColumn(DataType.Number, "vehicle_year", "Year"),
                        DatasetColumn(DataType.Text, "vehicle_make", "Make"),
                        DatasetColumn(DataType.Text, "vehicle_model", "Model"),
                        DatasetColumn(DataType.Text, "vehicle_trim", "Trim"),
                        DatasetColumn(DataType.Date, "sale_date", "Sale date", "M/D/YYYY"),
                        DatasetColumn(DataType.Number, "sale_mileage", "Sale mileage"),
                    },
            };

        private object DatasetColumn(
            DataType dataType,
            string name,
            string displayName = null,
            string displayFormat = null,
            string description = null,
            bool isFilterable = true,
            bool isSortable = true,
            bool isSecured = false) =>
            new
            {
                DataType = dataType,
                Description = description,
                DisplayName = displayName ?? name,
                IsFilterable = isFilterable,
                IsSortable = isSortable,
                Name = name,
                DisplayFormat = displayFormat,
                IsSecured = isSecured,
            };

        private string Key(string id) => $"dataset/GSFSGroup/{id}";
    }
}
