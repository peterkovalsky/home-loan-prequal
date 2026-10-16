using Dapper;
using HomeLoan.Application.Applications;
using HomeLoan.Infrastructure.Data;

namespace HomeLoan.Infrastructure.Repositories;

public sealed class ApplicationRepository(DbSession session) : IApplicationRepository
{
    public async Task<int> CreateAsync(byte[] resumeTokenHash, CancellationToken cancellationToken)
    {
        var (connection, transaction) = await session.ForWriteAsync(cancellationToken);
        // The id comes from the app.ApplicationId sequence (the column default).
        return await connection.ExecuteScalarAsync<int>(new CommandDefinition(
            "INSERT INTO app.Application (ResumeTokenHash) OUTPUT inserted.Id VALUES (@resumeTokenHash)",
            new { resumeTokenHash }, transaction, cancellationToken: cancellationToken));
    }

    public async Task<bool> TouchAsync(int applicationId, byte[] resumeTokenHash, int expiryDays, CancellationToken cancellationToken)
    {
        // Runs before the handler, so no transaction is open yet: this commits on its own and takes
        // no lock that outlives the statement. Check and touch are one statement, so there's no
        // window between "allowed" and "recorded".
        var (connection, transaction) = await session.ForReadAsync(cancellationToken);
        var touched = await connection.ExecuteAsync(new CommandDefinition(
            """
            UPDATE app.Application
            SET LastActivityAt = SYSUTCDATETIME()
            WHERE Id = @applicationId
              AND ResumeTokenHash = @resumeTokenHash
              AND LastActivityAt >= DATEADD(day, -@expiryDays, SYSUTCDATETIME());
            """,
            new { applicationId, resumeTokenHash, expiryDays }, transaction, cancellationToken: cancellationToken));
        return touched == 1;
    }

    public async Task DeleteAsync(int applicationId, CancellationToken cancellationToken)
    {
        var (connection, transaction) = await session.ForWriteAsync(cancellationToken);
        // ON DELETE CASCADE removes loan details, the applicant set, applicants, consent records and drafts.
        await connection.ExecuteAsync(new CommandDefinition(
            "DELETE FROM app.Application WHERE Id = @applicationId",
            new { applicationId }, transaction, cancellationToken: cancellationToken));
    }
}
