using System.Data;
using System.Diagnostics;
using HomeLoan.Application.Common;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HomeLoan.Infrastructure.Data;

/// <summary>
/// The request's connection and, once something writes, its transaction (the unit of work).
/// Reads join the transaction if one is open, so a handler sees its own writes. Disposing without
/// <see cref="CommitAsync"/> rolls back.
///
/// Implements both IDisposable and IAsyncDisposable: Kestrel disposes request scopes
/// asynchronously, but the AWS Lambda ASP.NET Core adapter disposes them synchronously, and a
/// scoped service that is only IAsyncDisposable makes that throw on every request.
/// </summary>
public sealed partial class DbSession(IOptions<DatabaseOptions> options, ILogger<DbSession> logger) : IUnitOfWork, IDisposable, IAsyncDisposable
{
    private static int firstConnectionLogged;
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

    public async Task RollbackAsync(CancellationToken cancellationToken)
    {
        if (transaction is null)
        {
            return;
        }
        await EndAsync(transaction, cancellationToken);
        transaction = null;
    }

    public async ValueTask DisposeAsync()
    {
        if (transaction is not null)
        {
            await EndAsync(transaction, CancellationToken.None);
            transaction = null;
        }
        if (connection is not null)
        {
            await connection.DisposeAsync();
            connection = null;
        }
    }

    public void Dispose()
    {
        if (transaction is not null)
        {
            if (transaction.Connection is null)
            {
                LogAlreadyEnded(logger);
            }
            else
            {
                transaction.Rollback();
            }
            transaction.Dispose();
            transaction = null;
        }
        connection?.Dispose();
        connection = null;
    }

    private async Task<SqlConnection> OpenAsync(CancellationToken cancellationToken)
    {
        if (connection is null)
        {
            var started = Stopwatch.GetTimestamp();
            connection = new SqlConnection(options.Value.HomeLoan);
            await connection.OpenAsync(cancellationToken);
            // The first connection per process pays for TLS and login; later ones come from the pool.
            if (Interlocked.Exchange(ref firstConnectionLogged, 1) == 0)
            {
                LogFirstConnection(logger, (long)Stopwatch.GetElapsedTime(started).TotalMilliseconds);
            }
        }
        return connection;
    }

    private async Task EndAsync(SqlTransaction current, CancellationToken cancellationToken)
    {
        // A transaction SQL Server has already ended (deadlock victim, severe error) has no connection,
        // and rolling it back again would throw. Log it: it means something went wrong earlier.
        if (current.Connection is null)
        {
            LogAlreadyEnded(logger);
        }
        else
        {
            await current.RollbackAsync(cancellationToken);
        }
        await current.DisposeAsync();
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "First SQL connection opened in {ElapsedMs} ms")]
    private static partial void LogFirstConnection(ILogger logger, long elapsedMs);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Transaction was already ended by the server before rollback.")]
    private static partial void LogAlreadyEnded(ILogger logger);
}
