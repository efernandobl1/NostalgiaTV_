FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
USER root
# curl -> healthcheck interno de Docker Compose. ffmpeg -> requerido por FFMpegCore.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ffmpeg \
    && rm -rf /var/lib/apt/lists/*
USER $APP_UID
WORKDIR /app
EXPOSE 8080
# Locale UTF-8: sin esto .NET decodifica los nombres de archivo con acentos como
# Latin-1 al escanear ("correría" -> "correrÃ­a"). Fuerza UTF-8 en todo el runtime.
ENV LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
# Copiar sólo los .csproj primero maximiza el uso de la caché de capas en 'restore'.
COPY ["WebApi/WebApi.csproj", "WebApi/"]
COPY ["ApplicationCore/ApplicationCore.csproj", "ApplicationCore/"]
COPY ["Infrastructure/Infrastructure.csproj", "Infrastructure/"]
RUN dotnet restore "WebApi/WebApi.csproj"
COPY . .
WORKDIR "/src/WebApi"
# 'publish' ya compila; se elimina el paso 'build' redundante para acelerar la imagen.
RUN dotnet publish "WebApi.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .
# El usuario no-root necesita poder escribir los logs (request/response) y los uploads.
USER root
RUN mkdir -p /app/Logs /app/wwwroot/uploads \
    && chown -R "$APP_UID":"$APP_UID" /app
USER $APP_UID

ENTRYPOINT ["dotnet", "WebApi.dll"]
