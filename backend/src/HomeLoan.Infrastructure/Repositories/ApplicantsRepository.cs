using System.Data;
using System.Text.Json;
using Dapper;
using HomeLoan.Application.Applicants;
using HomeLoan.Application.Common;
using HomeLoan.Domain;
using HomeLoan.Infrastructure.Data;
using Microsoft.Data.SqlClient;

namespace HomeLoan.Infrastructure.Repositories;

public sealed class ApplicantsRepository(DbSession session) : IApplicantsRepository
{
    public async Task<Versioned<ApplicantSet>?> GetAsync(int applicationId, CancellationToken cancellationToken)
    {
        var (connection, transaction) = await session.ForReadAsync(cancellationToken);
        using var results = await connection.QueryMultipleAsync(new CommandDefinition(
            """
            SELECT RowVersion FROM app.ApplicantSet WHERE ApplicationId = @applicationId;

            SELECT Id, Ordinal, TitleCode, FirstName, LastName, Email, Mobile, DateOfBirth
            FROM app.Applicant WHERE ApplicationId = @applicationId ORDER BY Ordinal;

            SELECT TOP (1) TermsVersion, AcceptedAt
            FROM app.ConsentRecord WHERE ApplicationId = @applicationId ORDER BY AcceptedAt DESC, Id DESC;
            """,
            new { applicationId }, transaction, cancellationToken: cancellationToken));

        var version = await results.ReadSingleOrDefaultAsync<byte[]>();
        if (version is null)
        {
            return null;
        }
        var applicants = (await results.ReadAsync<ApplicantRow>()).Select(r => r.ToDomain()).ToList();
        var consent = await results.ReadSingleAsync<ConsentRow>();
        return new Versioned<ApplicantSet>(
            new ApplicantSet(applicants, new Consent(consent.TermsVersion, consent.AcceptedAt)),
            new ConcurrencyToken(version));
    }

    public async Task<ConcurrencyToken?> GetVersionAsync(int applicationId, CancellationToken cancellationToken)
    {
        var (connection, transaction) = await session.ForReadAsync(cancellationToken);
        var version = await connection.ExecuteScalarAsync<byte[]?>(new CommandDefinition(
            "SELECT RowVersion FROM app.ApplicantSet WHERE ApplicationId = @applicationId",
            new { applicationId }, transaction, cancellationToken: cancellationToken));
        return version is null ? null : new ConcurrencyToken(version);
    }

    public async Task<ConcurrencyToken?> InsertAsync(
        int applicationId, IReadOnlyList<Applicant> applicants, string termsVersion, DateTime acceptedAt,
        CancellationToken cancellationToken)
    {
        var (connection, transaction) = await session.ForWriteAsync(cancellationToken);
        byte[] version;
        try
        {
            version = (await connection.ExecuteScalarAsync<byte[]>(new CommandDefinition(
                "INSERT INTO app.ApplicantSet (ApplicationId) OUTPUT inserted.RowVersion VALUES (@applicationId);",
                new { applicationId }, transaction, cancellationToken: cancellationToken)))!;
        }
        catch (SqlException ex) when (SqlErrors.IsDuplicateKey(ex))
        {
            return null;
        }
        await WriteApplicantsAsync(connection, transaction, applicationId, applicants, termsVersion, acceptedAt, cancellationToken);
        return new ConcurrencyToken(version);
    }

    public async Task<ConcurrencyToken?> UpdateAsync(
        int applicationId, IReadOnlyList<Applicant> applicants, string termsVersion, DateTime acceptedAt,
        ConcurrencyToken expected, CancellationToken cancellationToken)
    {
        var (connection, transaction) = await session.ForWriteAsync(cancellationToken);
        // Compare-and-swap. The UPDATE also takes the set's row lock, so concurrent saves for one
        // application queue here until this transaction ends.
        var version = await connection.ExecuteScalarAsync<byte[]?>(new CommandDefinition(
            """
            UPDATE app.ApplicantSet SET UpdatedAt = SYSUTCDATETIME()
            OUTPUT inserted.RowVersion
            WHERE ApplicationId = @applicationId AND RowVersion = @expected;
            """,
            new { applicationId, expected = expected.ToRowVersion() }, transaction, cancellationToken: cancellationToken));
        if (version is null)
        {
            return null;
        }
        await WriteApplicantsAsync(connection, transaction, applicationId, applicants, termsVersion, acceptedAt, cancellationToken);
        return new ConcurrencyToken(version);
    }

    /// <summary>
    /// Replaces the set by position: update matching ordinals (ids stay stable), insert new ones,
    /// delete the rest. The target is a CTE filtered to this application, so the DELETE branch can
    /// never touch another application's rows. Then records consent if this terms version is new.
    /// </summary>
    private static async Task WriteApplicantsAsync(
        SqlConnection connection, SqlTransaction transaction, int applicationId, IReadOnlyList<Applicant> applicants,
        string termsVersion, DateTime acceptedAt, CancellationToken cancellationToken)
    {
        var json = JsonSerializer.Serialize(applicants.Select((a, index) => new
        {
            Ordinal = index + 1,
            TitleCode = (int)a.Title,
            a.FirstName,
            a.LastName,
            a.Email,
            a.Mobile,
            DateOfBirth = a.DateOfBirth.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture)
        }));

        var parameters = new DynamicParameters(new { applicationId, termsVersion });
        parameters.Add("applicants", json, DbType.String);
        parameters.Add("acceptedAt", acceptedAt, DbType.DateTime2);

        await connection.ExecuteAsync(new CommandDefinition(
            """
            WITH target AS (SELECT * FROM app.Applicant WHERE ApplicationId = @applicationId)
            MERGE target
            USING (
                SELECT Ordinal, TitleCode, FirstName, LastName, Email, Mobile, DateOfBirth
                FROM OPENJSON(@applicants) WITH (
                    Ordinal tinyint, TitleCode tinyint, FirstName nvarchar(50), LastName nvarchar(50),
                    Email nvarchar(254), Mobile char(10), DateOfBirth date)
            ) AS source
            ON target.Ordinal = source.Ordinal
            WHEN MATCHED THEN UPDATE SET
                TitleCode = source.TitleCode,
                FirstName = source.FirstName,
                LastName = source.LastName,
                Email = source.Email,
                Mobile = source.Mobile,
                DateOfBirth = source.DateOfBirth,
                UpdatedAt = SYSUTCDATETIME()
            WHEN NOT MATCHED BY TARGET THEN
                INSERT (ApplicationId, Ordinal, TitleCode, FirstName, LastName, Email, Mobile, DateOfBirth)
                VALUES (@applicationId, source.Ordinal, source.TitleCode, source.FirstName, source.LastName,
                        source.Email, source.Mobile, source.DateOfBirth)
            WHEN NOT MATCHED BY SOURCE THEN DELETE;

            IF NOT EXISTS (SELECT 1 FROM app.ConsentRecord WHERE ApplicationId = @applicationId AND TermsVersion = @termsVersion)
                INSERT INTO app.ConsentRecord (ApplicationId, TermsVersion, AcceptedAt)
                VALUES (@applicationId, @termsVersion, @acceptedAt);
            """,
            parameters, transaction, cancellationToken: cancellationToken));
    }

    private sealed class ApplicantRow
    {
        public int Id { get; init; }
        public byte Ordinal { get; init; }
        public byte TitleCode { get; init; }
        public string FirstName { get; init; } = string.Empty;
        public string LastName { get; init; } = string.Empty;
        public string? Email { get; init; }
        public string Mobile { get; init; } = string.Empty;
        public DateTime DateOfBirth { get; init; }

        public SavedApplicant ToDomain() => new(
            Id,
            Ordinal,
            new Applicant((Title)TitleCode, FirstName, LastName, Email, Mobile, DateOnly.FromDateTime(DateOfBirth)));
    }

    private sealed class ConsentRow
    {
        public string TermsVersion { get; init; } = string.Empty;
        public DateTime AcceptedAt { get; init; }
    }
}
