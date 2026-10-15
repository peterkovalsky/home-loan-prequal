# Multi-stage build with two runnable targets:
#   docker build --target migrator .   one-off schema migration
#   docker build --target api .        the HTTP API (Kestrel; the same build also runs on Lambda)
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY global.json Directory.Build.props Directory.Packages.props .editorconfig ./
COPY src/HomeLoan.Domain/HomeLoan.Domain.csproj src/HomeLoan.Domain/
COPY src/HomeLoan.Application/HomeLoan.Application.csproj src/HomeLoan.Application/
COPY src/HomeLoan.Infrastructure/HomeLoan.Infrastructure.csproj src/HomeLoan.Infrastructure/
COPY src/HomeLoan.Secrets/HomeLoan.Secrets.csproj src/HomeLoan.Secrets/
COPY src/HomeLoan.Migrations/HomeLoan.Migrations.csproj src/HomeLoan.Migrations/
COPY src/HomeLoan.Api/HomeLoan.Api.csproj src/HomeLoan.Api/
RUN dotnet restore src/HomeLoan.Migrations && dotnet restore src/HomeLoan.Api
COPY src/ src/
RUN dotnet publish src/HomeLoan.Migrations -c Release -o /out/migrator --no-restore \
 && dotnet publish src/HomeLoan.Api -c Release -o /out/api --no-restore

FROM mcr.microsoft.com/dotnet/runtime:8.0 AS migrator
WORKDIR /app
COPY --from=build /out/migrator .
USER $APP_UID
ENTRYPOINT ["dotnet", "HomeLoan.Migrations.dll"]

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS api
WORKDIR /app
COPY --from=build /out/api .
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "HomeLoan.Api.dll"]
