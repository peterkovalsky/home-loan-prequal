using Dapper;
using HomeLoan.Application.Common;
using HomeLoan.Application.Loans;
using HomeLoan.Domain;
using HomeLoan.Infrastructure.Data;
using Microsoft.Data.SqlClient;

namespace HomeLoan.Infrastructure.Repositories;

public sealed class LoanDetailsRepository(DbSession session) : ILoanDetailsRepository
{
    private const string Columns = """
        PurposeCode, PropertyUsageCode, ApplicantCountCode, IsSameHousehold, NumberOfDependants,
        LoanAmount, Deposit, EstimatedPropertyValue, IsAddressKnown, Address, StateCode
        """;

    private const string Values = """
        @PurposeCode, @PropertyUsageCode, @ApplicantCountCode, @IsSameHousehold, @NumberOfDependants,
        @LoanAmount, @Deposit, @EstimatedPropertyValue, @IsAddressKnown, @Address, @StateCode
        """;

    public async Task<Versioned<LoanDetails>?> GetAsync(int applicationId, CancellationToken cancellationToken)
    {
        var (connection, transaction) = await session.ForReadAsync(cancellationToken);
        var row = await connection.QuerySingleOrDefaultAsync<Row>(new CommandDefinition(
            $"SELECT {Columns}, RowVersion FROM app.LoanDetails WHERE ApplicationId = @applicationId",
            new { applicationId }, transaction, cancellationToken: cancellationToken));
        return row is null ? null : new Versioned<LoanDetails>(row.ToDomain(), new ConcurrencyToken(row.RowVersion));
    }

    public async Task<ConcurrencyToken?> GetVersionAsync(int applicationId, CancellationToken cancellationToken)
    {
        var (connection, transaction) = await session.ForReadAsync(cancellationToken);
        var version = await connection.ExecuteScalarAsync<byte[]?>(new CommandDefinition(
            "SELECT RowVersion FROM app.LoanDetails WHERE ApplicationId = @applicationId",
            new { applicationId }, transaction, cancellationToken: cancellationToken));
        return version is null ? null : new ConcurrencyToken(version);
    }

    public async Task<ConcurrencyToken?> InsertAsync(int applicationId, LoanDetails details, CancellationToken cancellationToken)
    {
        var (connection, transaction) = await session.ForWriteAsync(cancellationToken);
        try
        {
            // The application already exists (only POST creates one). Two first saves racing: the
            // second hits the primary key and loses.
            var version = await connection.ExecuteScalarAsync<byte[]>(new CommandDefinition(
                $"""
                INSERT INTO app.LoanDetails (ApplicationId, {Columns})
                OUTPUT inserted.RowVersion
                VALUES (@ApplicationId, {Values});
                """,
                Parameters(applicationId, details), transaction, cancellationToken: cancellationToken));
            return new ConcurrencyToken(version!);
        }
        catch (SqlException ex) when (SqlErrors.IsDuplicateKey(ex))
        {
            return null;
        }
    }

    public async Task<ConcurrencyToken?> UpdateAsync(
        int applicationId, LoanDetails details, ConcurrencyToken expected, CancellationToken cancellationToken)
    {
        var (connection, transaction) = await session.ForWriteAsync(cancellationToken);
        var parameters = Parameters(applicationId, details);
        parameters.Add("Expected", expected.ToRowVersion());
        var version = await connection.ExecuteScalarAsync<byte[]?>(new CommandDefinition(
            """
            UPDATE app.LoanDetails
            SET PurposeCode = @PurposeCode,
                PropertyUsageCode = @PropertyUsageCode,
                ApplicantCountCode = @ApplicantCountCode,
                IsSameHousehold = @IsSameHousehold,
                NumberOfDependants = @NumberOfDependants,
                LoanAmount = @LoanAmount,
                Deposit = @Deposit,
                EstimatedPropertyValue = @EstimatedPropertyValue,
                IsAddressKnown = @IsAddressKnown,
                Address = @Address,
                StateCode = @StateCode,
                UpdatedAt = SYSUTCDATETIME()
            OUTPUT inserted.RowVersion
            WHERE ApplicationId = @ApplicationId AND RowVersion = @Expected;
            """,
            parameters, transaction, cancellationToken: cancellationToken));
        return version is null ? null : new ConcurrencyToken(version);
    }

    private static DynamicParameters Parameters(int applicationId, LoanDetails d) => new(new
    {
        ApplicationId = applicationId,
        PurposeCode = (short)d.Purpose,
        PropertyUsageCode = (short)d.PropertyUsage,
        ApplicantCountCode = (byte)d.NumberOfApplicants,
        d.IsSameHousehold,
        NumberOfDependants = (byte)d.NumberOfDependants,
        d.LoanAmount,
        d.Deposit,
        d.EstimatedPropertyValue,
        d.IsAddressKnown,
        d.Address,
        StateCode = (short?)d.State
    });

    private sealed class Row
    {
        public short PurposeCode { get; init; }
        public short PropertyUsageCode { get; init; }
        public byte ApplicantCountCode { get; init; }
        public bool? IsSameHousehold { get; init; }
        public byte NumberOfDependants { get; init; }
        public decimal LoanAmount { get; init; }
        public decimal? Deposit { get; init; }
        public decimal EstimatedPropertyValue { get; init; }
        public bool IsAddressKnown { get; init; }
        public string? Address { get; init; }
        public short? StateCode { get; init; }
        public byte[] RowVersion { get; init; } = [];

        public LoanDetails ToDomain() => new(
            (LendingPurpose)PurposeCode,
            (PropertyUsage)PropertyUsageCode,
            (NumberOfApplicants)ApplicantCountCode,
            IsSameHousehold,
            NumberOfDependants,
            LoanAmount,
            Deposit,
            EstimatedPropertyValue,
            IsAddressKnown,
            Address,
            (AuState?)StateCode);
    }
}
