using Dapper;
using HomeLoan.Application.Applications;
using HomeLoan.Infrastructure.Data;

namespace HomeLoan.Infrastructure.Repositories;

public sealed class ApplicationRepository(DbSession session) : IApplicationRepository
{
    public async Task DeleteAsync(int applicationId, CancellationToken cancellationToken)
    {
        var (connection, transaction) = await session.ForWriteAsync(cancellationToken);
        // ON DELETE CASCADE removes loan details, the applicant set, applicants and consent records.
        await connection.ExecuteAsync(new CommandDefinition(
            "DELETE FROM app.Application WHERE Id = @applicationId",
            new { applicationId }, transaction, cancellationToken: cancellationToken));
    }
}
