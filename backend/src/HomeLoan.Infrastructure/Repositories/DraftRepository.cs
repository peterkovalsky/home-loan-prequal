using Dapper;
using HomeLoan.Application.Drafts;
using HomeLoan.Infrastructure.Data;

namespace HomeLoan.Infrastructure.Repositories;

public sealed class DraftRepository(DbSession session) : IDraftRepository
{
    public async Task<IReadOnlyList<Draft>> GetAllAsync(int applicationId, CancellationToken cancellationToken)
    {
        var (connection, transaction) = await session.ForReadAsync(cancellationToken);
        var rows = await connection.QueryAsync<Draft>(new CommandDefinition(
            "SELECT Step, Data, UpdatedAt FROM app.ApplicationDraft WHERE ApplicationId = @applicationId",
            new { applicationId }, transaction, cancellationToken: cancellationToken));
        return rows.AsList();
    }

    public async Task SaveAsync(int applicationId, string journeyStep, string data, CancellationToken cancellationToken)
    {
        var (connection, transaction) = await session.ForWriteAsync(cancellationToken);
        // Update-then-insert under UPDLOCK + HOLDLOCK: two autosaves racing can't both insert.
        await connection.ExecuteAsync(new CommandDefinition(
            """
            UPDATE app.ApplicationDraft WITH (UPDLOCK, HOLDLOCK)
            SET Data = @data, UpdatedAt = SYSUTCDATETIME()
            WHERE ApplicationId = @applicationId AND Step = @step;

            IF @@ROWCOUNT = 0
                INSERT INTO app.ApplicationDraft (ApplicationId, Step, Data) VALUES (@applicationId, @step, @data);
            """,
            new { applicationId, step = journeyStep, data }, transaction, cancellationToken: cancellationToken));
    }

    public async Task DeleteAsync(int applicationId, string journeyStep, CancellationToken cancellationToken)
    {
        var (connection, transaction) = await session.ForWriteAsync(cancellationToken);
        await connection.ExecuteAsync(new CommandDefinition(
            "DELETE FROM app.ApplicationDraft WHERE ApplicationId = @applicationId AND Step = @step",
            new { applicationId, step = journeyStep }, transaction, cancellationToken: cancellationToken));
    }
}
