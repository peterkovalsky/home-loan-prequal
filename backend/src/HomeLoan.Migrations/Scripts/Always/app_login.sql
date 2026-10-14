-- Runs on every deploy (idempotent). The API connects as this login: data access only, no DDL.
-- $AppLoginPassword$ is supplied by the migrator from configuration, never stored in source.
IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'homeloan_app')
    CREATE LOGIN homeloan_app WITH PASSWORD = N'$AppLoginPassword$', CHECK_POLICY = ON;
ELSE
    ALTER LOGIN homeloan_app WITH PASSWORD = N'$AppLoginPassword$';

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'homeloan_app')
    CREATE USER homeloan_app FOR LOGIN homeloan_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::app TO homeloan_app;
GRANT SELECT ON SCHEMA::ref TO homeloan_app;
