using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Runtime.Serialization;
using CronExpressionDescriptor;
using Hydrogen.DataCatalog.Domain.Security.Datasets;
using RedLine.Domain.Exceptions;

namespace Hydrogen.DataCatalog.Domain.Model.Datasets
{
    /// <summary>
    /// Represents metadata about a dataset in the data catalog.
    /// </summary>
    [System.Diagnostics.CodeAnalysis.SuppressMessage("Design", "RCS1170:Use read-only auto-implemented property.", Justification = "Required for deserialization.")]
    public sealed class Dataset : IAggregateRoot<Key>, IEquatable<Dataset>, ISearchable, IHaveParents
    {
        [IgnoreDataMember]
        private Dictionary<string, Column> columnsDictionary = new Dictionary<string, Column>();

        /// <summary>Initializes a new instance of the <see cref="T:Hydrogen.DataCatalog.Domain.Model.Datasets.Dataset"/> class.</summary>
        /// <param name="tenantId">The tenant identifier.</param>
        /// <param name="datasetId">The dataset identifier for the given tenant.</param>
        /// <param name="datasetType">The type of the dataset.</param>
        /// <param name="name">The name of the dataset.</param>
        /// <param name="description">The description of the dataset.</param>
        /// <param name="owner">The owner of the dataset.</param>
        /// <param name="department">The department that maintains the dataset.</param>
        /// <param name="category">The category of the dataset.</param>
        /// <param name="tags">The collection of tags for the dataset.</param>
        /// <param name="updateFrequency">The<see cref="P:Hydrogen.DataCatalog.Domain.Model.Datasets.Dataset.UpdateFrequency"/> of the dataset.</param>
        /// <param name="dataSource">The <see cref="P:Hydrogen.DataCatalog.Domain.Model.Datasets.Dataset.DataSource"/> of the dataset.</param>
        /// <param name="columns">The collection of <see cref="Column"/>s of the dataset.</param>
        /// <param name="security">The security settings for the dataset.</param>
        /// <param name="documentationUrl">The documentation URL for the dataset.</param>
        /// <param name="notes">The collection of notes of the dataset.</param>
        /// <param name="parents">The parents of the dataset.</param>
        /// <param name="updateSchedule">The optional schedule expression used to update this dataset.</param>
        public Dataset(
            string tenantId,
            string datasetId,
            DatasetType datasetType,
            string name,
            string description,
            string owner,
            string department,
            string category,
            IEnumerable<string> tags,
            Frequency updateFrequency,
            DataSource dataSource,
            IEnumerable<Column> columns,
            DatasetSecurity security,
            string documentationUrl,
            IEnumerable<string> notes,
            IEnumerable<Parent> parents,
            string updateSchedule)
        {
            Key = new Key(KeyType.Dataset, tenantId, datasetId);
            DatasetType = datasetType;
            Name = name;
            Description = description;
            Owner = owner;
            Department = department;
            Category = category;
            Tags = tags ?? Enumerable.Empty<string>();
            UpdateFrequency = updateFrequency;
            UpdateSchedule = updateSchedule;
            DataSource = dataSource;
            Columns = columns ?? Enumerable.Empty<Column>();
            Security = security;
            DocumentationUrl = documentationUrl;
            Notes = notes ?? Enumerable.Empty<string>();
            Parents = parents ?? Enumerable.Empty<Parent>();
        }

        // ReSharper disable once UnusedMember.Local // serialization

        /// <summary>
        /// Initializes a new instance of the <see cref="Dataset"/> class.
        /// </summary>
        private Dataset()
        {
        }

        // ReSharper disable once AutoPropertyCanBeMadeGetOnly.Local // serialization

        /// <summary>
        /// Gets the <see cref="DatasetType"/>.
        /// </summary>
        public DatasetType DatasetType { get; private set; }

        // ReSharper disable once AutoPropertyCanBeMadeGetOnly.Local // serialization

        /// <inheritdoc />
        public string Category { get; private set; }

        // ReSharper disable once AutoPropertyCanBeMadeGetOnly.Local // serialization

        /// <summary>
        /// Gets the collection of <see cref="Column"/>s in the dataset.
        /// </summary>
        public IEnumerable<Column> Columns
        {
            get => columnsDictionary.Select(kvp => kvp.Value);
            private set => columnsDictionary = value.ToDictionary(col => col.Name.ToUpperInvariant());
        }

        /// <summary>
        /// Gets the <see cref="DataSource"/> of the dataset.
        /// </summary>
        public DataSource DataSource { get; private set; }

        /// <summary>
        /// Gets the department that maintains the dataset.
        /// </summary>
        public string Department { get; private set; }

        /// <summary>
        /// Gets the user friendly description of the dataset.
        /// </summary>
        public string Description { get; private set; }

        /// <summary>
        /// Gets the <see cref="DateTimeOffset"/> when the dataset was last updated.
        /// </summary>
        public DateTimeOffset? LastUpdated { get; private set; }

        /// <inheritdoc cref="IEntity{TKey}.Key" />
        public Key Key { get; private set; }

        /// <summary>
        /// Gets the name of the dataset.
        /// </summary>
        public string Name { get; private set; }

        /// <summary>
        /// Gets the collection of notes related to the dataset.
        /// </summary>
        public IEnumerable<string> Notes { get; private set; }

        /// <summary>
        /// Gets the primary owner of the dataset.
        /// </summary>
        public string Owner { get; private set; }

        /// <summary>
        /// Gets the table name.
        /// </summary>
        [IgnoreDataMember]
        public string TableName => DataSource.TableName;

        /// <inheritdoc />
        public IEnumerable<string> Tags { get; private set; }

        /// <summary>
        /// Gets the <see cref="Frequency"/> that the dataset is updated.
        /// </summary>
        public Frequency UpdateFrequency { get; private set; }

        /// <summary>
        /// Gets the update schedule as a cron expression.
        /// </summary>
        public string UpdateSchedule { get; private set; }

        /// <summary>
        /// Gets the strategy by which the dataset is secured.
        /// </summary>
        public DatasetSecurity Security { get; private set; }

        /// <summary>
        /// Gets the documentation URL which is used to create HTML for client-side rendering.
        /// </summary>
        public string DocumentationUrl { get; private set; }

        /// <summary>
        /// Gets the <see cref="Parent"/>s.
        /// </summary>
        public IEnumerable<Parent> Parents { get; private set; }

        /// <summary>
        /// Gets whether the dataset has a column.
        /// </summary>
        /// <param name="columnName">Column name to test.</param>
        /// <returns>True if the column exists within the dataset, false otherwise.</returns>
        public bool HasColumn(string columnName) => columnsDictionary.ContainsKey(columnName.ToUpperInvariant());

        /// <summary>
        /// Get the column by name.
        /// </summary>
        /// <param name="columnName">Column name to retrieve.</param>
        /// <returns>The requested Column.</returns>
        public Column GetColumn(string columnName) => columnsDictionary[columnName.ToUpperInvariant()];

        /// <summary>
        /// Gets a user friendly representation of the update frequency using a schedule if necessary.
        /// </summary>
        /// <returns>The user friendly update frequency.</returns>
        public string GetFriendlyUpdateFrequency()
        {
            DescriptionTypeEnum descriptorType;

            switch (UpdateFrequency)
            {
                case Frequency.Hourly:
                    descriptorType = DescriptionTypeEnum.HOURS;
                    break;
                case Frequency.Daily:
                    descriptorType = DescriptionTypeEnum.DAYOFMONTH;
                    break;
                default:
                    /* NOTE!
                        Being able to say "every 2 months", or "every quarter", etc. is much more difficult.
                        This descriptor library is the most flexible I could find for different cron formats, and it's still limited.
                        Maybe a better solution will present itself in the future.
                        For now, we don't use anything bigger than daily anyways.
                     */
                    return UpdateFrequency.ToString();
            }

            if (string.IsNullOrWhiteSpace(UpdateSchedule))
            {
                return UpdateFrequency.ToString();
            }

            var descriptor = new ExpressionDescriptor(UpdateSchedule);

            // the library sometimes leaves ", " at the beginning of its parts, depending on what else is in the description
            return descriptor.GetDescription(descriptorType).Replace(", ", string.Empty).ToLower(CultureInfo.InvariantCulture);
        }

        /// <summary>
        /// Sets when the dataset was last updated.
        /// </summary>
        /// <param name="updatedAt">When the dataset was last updated.</param>
        /// <returns>True if LastUpdated was updated; otherwise, false.</returns>
        public bool SetLastUpdated(DateTimeOffset updatedAt)
        {
            if (updatedAt > LastUpdated.GetValueOrDefault())
            {
                LastUpdated = updatedAt;
                return true;
            }

            return false;
        }

        /// <inheritdoc />
        public bool SetParentLastUpdated(Key parentKey, DateTimeOffset updatedAt)
        {
            var parent = Parents.SingleOrDefault(p => p.Key == parentKey);
            if (parent == null)
            {
                throw new DomainException(400, $"{parentKey} is not a parent of {Key}");
            }

            // do not want to shortcut this OR operator, i.e. do not use ||
#pragma warning disable S2178 // Short-circuit logic should be used in boolean contexts
            return parent.SetLastUpdated(updatedAt) | SetLastUpdated(updatedAt);
#pragma warning restore S2178 // Short-circuit logic should be used in boolean contexts
        }

        /// <summary>
        /// Validates a list of columns to sort.
        /// </summary>
        /// <param name="columnNamesToSort">Column names to validate for sorting.</param>
        /// <returns>A tuple containing validation success as bool and the validation message if failed.</returns>
        public (bool Sucess, string Message) ValidateColumnSorts(IReadOnlyCollection<string> columnNamesToSort)
        {
            var colNamesToSort = columnNamesToSort;
            var nonExistentColsToSort = colNamesToSort
                .Where(colName => !HasColumn(colName))
                .ToList();
            if (nonExistentColsToSort.Count > 0)
            {
                string colNames = string.Join(",", nonExistentColsToSort);
                string msg = nonExistentColsToSort.Count == 1
                    ? $"The following column does not exist in the dataset: {colNames}"
                    : $"The following columns do not exist in the dataset: {colNames}";
                return (false, msg);
            }

            var colsCantSort = colNamesToSort
                .Where(colName => !GetColumn(colName).IsSortable)
                .ToList();
            if (colsCantSort.Count > 0)
            {
                string colNames = string.Join(",", colsCantSort);
                string msg = colsCantSort.Count == 1
                    ? $"The following column is not sortable: {colNames}"
                    : $"The following columns are not sortable: {colNames}";
                return (false, msg);
            }

            return (true, string.Empty);
        }

        /// <summary>
        /// Gets a value indicating whether this object is equivalent to another.
        /// </summary>
        /// <param name="other">The object to compare with this object.</param>
        /// <returns>True if the two objects are equivalent; otherwise, false.</returns>
        public bool Equals(Dataset other)
        {
            if (other == null)
            {
                return false;
            }

            // DatasetKey overrides the == operator
            return Key == other.Key;
        }

        /// <summary>
        /// Gets a value indicating whether this object is equivalent to another.
        /// </summary>
        /// <param name="obj">The object to compare with this object.</param>
        /// <returns>True if the two objects are equivalent; otherwise, false.</returns>
        public override bool Equals(object obj)
        {
            return Equals(obj as Dataset);
        }

        /// <summary>
        /// Gets a quasi-unique hash code for the object.
        /// </summary>
        /// <returns>A quasi-unique hash code.</returns>
        public override int GetHashCode() => Key.GetHashCode();
    }
}
