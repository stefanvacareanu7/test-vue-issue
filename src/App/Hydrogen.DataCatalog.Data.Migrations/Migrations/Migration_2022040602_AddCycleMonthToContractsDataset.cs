using FluentMigrator;

namespace Hydrogen.DataCatalog.Data.Migrations.Migrations
{
    /// <summary>
    /// Updates schema for contracts.
    /// </summary>
    [Migration(2022040602)]
    [System.Diagnostics.CodeAnalysis.SuppressMessage("Minor Code Smell", "S101:Types should be named in PascalCase", Justification = "Migrations are named according to our standards.")]
    public class Migration_2022040602_AddCycleMonthToContractsDataset : ForwardOnlyMigration
    {
        private const string TableName = "contracts";

        private const string SchemaName = "contracts";

        /// <inheritdoc/>
        public override void Up()
        {
            Alter
                .Table(TableName)
                .InSchema(SchemaName)
                .AddColumn("cycle_month")
                .AsDateTime()
                .Nullable();

            Create.Index("IX_contracts_cycle_month")
                .OnTable(TableName)
                .InSchema(SchemaName)
                .OnColumn("cycle_month");
        }
    }
}
