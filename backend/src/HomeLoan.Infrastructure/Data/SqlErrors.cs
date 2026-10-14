using Microsoft.Data.SqlClient;

namespace HomeLoan.Infrastructure.Data;

internal static class SqlErrors
{
    /// <summary>2627: PRIMARY KEY / UNIQUE constraint; 2601: unique index. Another request created the row first.</summary>
    public static bool IsDuplicateKey(SqlException exception) => exception.Number is 2627 or 2601;
}
