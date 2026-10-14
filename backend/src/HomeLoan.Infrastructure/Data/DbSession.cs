using System.Data;
using HomeLoan.Application.Common;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Options;

namespace HomeLoan.Infrastructure.Data;

/// <summary>
/// The request's connection and, once something writes, its transaction (the unit of work).
/// Reads join the transaction if one is open, so a handler sees its own writes. Disposing without
/// <see cref="CommitAsync"/> rolls back.
/// </summary>
public sealed class DbSession(IOptions<DatabaseOptions> options) : IUnitOfWork, IAsyncDisposable
{
    private SqlConnection? connection;
    private SqlTransaction? transaction;

    public async Task<(SqlConnection Connection, SqlTransaction? Transaction)> ForReadAsync(CancellationToken cancellationToken) =>
        (await OpenAsync(cancellationToken), transaction);

    public async Task<(SqlConnection Connection, SqlTransaction Transaction)> ForWriteAsync(CancellationToken cancellationToken)
    {
        var open = await OpenAsync(cancellationToken);
        transaction ??= (SqlTransaction)await open.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken);
        return (open, transaction);
    }

    public async Task CommitAsync(CancellationToken cancellationToken)
    {
        if (transaction is null)
        {
            return;
        }
        await transaction.CommitAsync(cancellationToken);
        await transaction.DisposeAsync();
        transaction = null;
    }

    public async ValueTask DisposeAsync()
    {
        if (transaction is not null)
        {
            await transaction.RollbackAsync();
            await transaction.DisposeAsync();
        }
        if (connection is not null)
        {
            await connection.DisposeAsync();
        }
    }

    private async Task<SqlConnection> OpenAsync(CancellationToken cancellationToken)
    {
        if (connection is null)
        {
            connection = new SqlConnection(options.Value.HomeLoan);
            await connection.OpenAsync(cancellationToken);
        }
        return connection;
    }
}
