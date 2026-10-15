# syntax=docker/dockerfile:1.7
# One build, four runnable targets:
#   migrator         one-off schema migration (docker compose)
#   api              the HTTP API on Kestrel (docker compose)
#   lambda           the same API on AWS Lambda (container image; AddAWSLambdaHosting takes over)
#   migrator-lambda  the same migrator on AWS Lambda (invoked by the CDK deploy trigger)
#
# The SDK stages run on the build machine's platform ($BUILDPLATFORM) and cross-publish for the
# target, so arm64 Lambda images build on x64 CI runners without emulation. The Lambda stages only
# COPY (no RUN), which is what keeps that true.

FROM --platform=$BUILDPLATFORM mcr.microsoft.com/dotnet/sdk:8.0 AS source
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

# Portable (framework-dependent, any CPU) output for the compose images.
FROM source AS publish
RUN dotnet publish src/HomeLoan.Migrations -c Release -o /out/migrator --no-restore \
 && dotnet publish src/HomeLoan.Api -c Release -o /out/api --no-restore

# Lambda output for the target CPU. The API is ReadyToRun-compiled to shorten cold starts.
FROM source AS publish-lambda
ARG TARGETARCH
RUN case "$TARGETARCH" in arm64) rid=linux-arm64 ;; *) rid=linux-x64 ;; esac \
 && dotnet publish src/HomeLoan.Api -c Release -r "$rid" --self-contained false -p:PublishReadyToRun=true -o /out/api \
 && dotnet publish src/HomeLoan.Migrations -c Release -r "$rid" --self-contained false -o /out/migrator

# Trust store for Lambda: the system CAs (Secrets Manager, AWS APIs) plus the Amazon RDS CAs, so
# SQL connections are encrypted *and* the server certificate is validated. Pinned by checksum.
FROM source AS certs
ADD --checksum=sha256:90a6f1a7978a1b1b096dca6c57511ca48d3b8cf052f8e704baf358f34ea2f21b \
    https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /tmp/rds-global-bundle.pem
RUN mkdir -p /out && cat /etc/ssl/certs/ca-certificates.crt /tmp/rds-global-bundle.pem > /out/ca-bundle.pem

# ---------------------------------------------------------------- docker compose
FROM mcr.microsoft.com/dotnet/runtime:8.0 AS migrator
WORKDIR /app
COPY --from=publish /out/migrator .
USER $APP_UID
ENTRYPOINT ["dotnet", "HomeLoan.Migrations.dll"]

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS api
WORKDIR /app
COPY --from=publish /out/api .
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "HomeLoan.Api.dll"]

# ---------------------------------------------------------------- AWS Lambda
FROM public.ecr.aws/lambda/dotnet:8 AS lambda-base
COPY --from=certs /out/ca-bundle.pem /opt/certs/ca-bundle.pem
# The base image already ships tzdata, so Clock:TimeZone=Australia/Sydney resolves (checked at start-up).
ENV SSL_CERT_FILE=/opt/certs/ca-bundle.pem

FROM lambda-base AS lambda
COPY --from=publish-lambda /out/api ${LAMBDA_TASK_ROOT}
# Executable-assembly handler: the app's own Main runs and AddAWSLambdaHosting serves the events.
CMD ["HomeLoan.Api"]

FROM lambda-base AS migrator-lambda
COPY --from=publish-lambda /out/migrator ${LAMBDA_TASK_ROOT}
CMD ["HomeLoan.Migrations"]
