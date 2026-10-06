# 📺 NostalgiaTV

NostalgiaTV es una plataforma de televisión retro personal. Organiza series y
episodios en canales con programación compartida y sincronizada mediante SignalR,
y también permite ver series bajo demanda. La página pública recrea una sala con
un televisor CRT; el panel administra el catálogo, las eras y la emisión.

## Tecnologías

- **Backend:** ASP.NET Core 10, Entity Framework Core, SQL Server, SignalR,
  Serilog, Mapster y FluentValidation.
- **Autenticación:** JWT en cookies HttpOnly y contraseñas con Argon2.
- **Frontend:** Angular 21, componentes standalone, signals, Angular Material,
  Tailwind CSS 4 y SCSS compartido.
- **Herramientas:** pnpm 11.17.0, FFmpeg/FFprobe, Docker y GitHub Actions.
- **Producción:** imágenes GHCR; WebApp estática servida por nginx, sin servidor
  Node en la imagen final.

## Experiencia pública

- Canales identificados por su logo, separados de las acciones de navegación.
- Guía de programación de hoy y mañana, con estado del canal en tiempo real.
- Videoteca con búsqueda y filtros por categoría y canal; temporadas, especiales
  y películas, progreso guardado y continuación de episodios.
- Un único reproductor permanece montado al cambiar entre sala, modo TV y
  pantalla completa.
- **Modo TV:** overlay que se oculta por inactividad, navegación de canales y
  salida a la sala; sin controles de volumen ni fullscreen en el overlay.
- **Pantalla completa:** volumen y salida en la barra superior, con una sola
  acción de ajustes de imagen.
- Activación manual de modo TV y detección por navegador/dispositivo, no por
  resolución de pantalla.
- Filtros CRT configurables y diálogo para iniciar o reanudar la reproducción
  cuando el navegador bloquea el autoplay con sonido.
- Enlaces compartibles mediante `?channel=<slug>` y `?series=<slug>`.
- Login, cierre de sesión, 404 y error 500 con el mismo lenguaje visual retro,
  textos legibles y estados claros. No hay registro público ni recuperación de
  contraseña habilitados.

Los canales en vivo siguen su programación: no tienen controles de pausa ni
avance. Las series bajo demanda sí permiten controlar la reproducción. No hay
remapeo de controles en la interfaz.

## Panel de administración

- **Inicio:** estado del estudio, canales, catálogo y actividad reciente.
- **Canales:** estaciones visuales; cada canal reúne sus eras, series,
  temporadas seleccionadas, publicidad y programación. Permite regenerar la
  programación.
- **Videoteca:** ficha de cada serie con portada, categorías, temporadas,
  episodios, rutas y tamaño de archivos. Las categorías se pueden crear o editar
  desde la ficha.
- **Subidas:** selección de varios videos para una temporada, especiales o
  películas; cola con progreso por archivo, errores y reintento. La cola procesa
  los archivos de uno en uno.
- **Archivo publicitario:** anuncios y bumpers, aprobación para emisión,
  selección por era y reglas de pausas publicitarias.
- **Actividad:** registro de acciones administrativas.
- **Accesos:** usuarios, roles y permisos; las opciones visibles dependen del
  acceso autorizado.
- **Comentarios:** moderación administrativa de los comentarios registrados
  mediante la API.
- **Metadatos:** proveedores, identificadores externos de series e historial de
  importaciones. Esto no implica una búsqueda/importación automática desde una
  API pública en la interfaz.

El panel dispone de tema claro y oscuro. Logos, portadas, avatares y vistas
previas usan límites de tamaño y `object-fit: contain`. Los campos evitan
contornos duplicados, conservando una señal de foco para navegación con teclado.

## Programación y archivos de video

La programación usa ciclos aleatorios, historial reciente y preferencias de
separación para evitar repeticiones cuando hay más episodios disponibles. La
ventana preferida sin repetición es de 24 horas por defecto y se adapta a
catálogos pequeños. Los cupos diarios de especiales y películas se configuran
en `ChannelScheduling` o mediante variables `ChannelScheduling__*`; Compose
incluye sus equivalentes `SCHED_*`.

Las eras representan etapas del canal y definen su selección de series y
temporadas. El modelo de emisión contempla segmentos de episodios, bumpers de
entrada/salida y anuncios, con puntos de corte y reglas por era.

El scanner y las subidas admiten `.mp4`, `.m4v`, `.webm`, `.ogg`, `.ogv`
y `.mov`. El contenedor del archivo no garantiza que sus códecs sean compatibles
con todos los navegadores: para PC, Android e iOS, preparar preferentemente
**MP4 con H.264 y audio AAC**. La API calcula duración con FFprobe, pero no
transcodifica automáticamente cada video al subirlo.

El scanner ignora archivos temporales y marcadores de transcodificación. Tras
reemplazar videos en disco, reescanear la serie y regenerar la programación
afectada. Mantener copias de los originales antes de convertirlos.

## Requisitos y ejecución local

- .NET 10 SDK.
- Node.js 24, como en el Dockerfile de la WebApp, y pnpm 11.17.0.
- SQL Server con una base accesible desde la API.
- FFmpeg y FFprobe disponibles para la API.
- Docker y Docker Compose, si se utiliza el stack de contenedores.

### Backend

Copiar el archivo de ejemplo y completar conexión, JWT y demás configuración.
En PowerShell, usar `Copy-Item` como equivalente de `cp`.

```bash
cd WebApi/WebApi
cp appsettings.Local.example.json appsettings.Local.json
dotnet run
```

La API local escucha en `https://localhost:7221`; Scalar está disponible en
`/scalar/v1` solamente en desarrollo. Las migraciones EF pendientes se aplican
al iniciar: antes de actualizar producción, respaldar y validar una copia de
la base de datos.

### Frontend

```bash
corepack enable
cd WebApp
pnpm install --frozen-lockfile
pnpm start
```

La WebApp local abre en `http://localhost:4200` y utiliza la API configurada en
`WebApp/src/environments/`. El build desplegado usa `assets/env.js`; un
`apiUrl` vacío mantiene `/api`, `/uploads` y `/hubs` en el mismo origen.

### Stack local con Docker

```bash
cp .env.example .env
docker compose up --build -d
docker compose ps
```

Puertos locales predeterminados: WebApp `127.0.0.1:8082`, API
`127.0.0.1:8080` y SQL Server `127.0.0.1:1433`.

## Validación

Desde la raíz del repositorio:

```bash
dotnet build WebApi/WebApi/WebApi.csproj -c Release
dotnet test WebApi/Infrastructure.Tests/Infrastructure.Tests.csproj -c Release
```

Desde `WebApp/`:

```bash
pnpm exec node node_modules/@angular/cli/bin/ng.js build
pnpm exec node node_modules/@angular/cli/bin/ng.js test --watch=false
```

Además de compilar, comprobar visualmente los flujos modificados en móvil,
tablet, escritorio y modo TV, incluyendo móvil horizontal, foco de teclado,
contraste, estados de carga/error y ausencia de desbordamientos. Las pruebas
con datos simulados no sustituyen la validación del backend ni de producción.

## Estructura

```text
NostalgiaTV/
├── WebApi/
│   ├── ApplicationCore/          # Entities, DTOs, contracts and settings
│   ├── Infrastructure/           # EF context, migrations and services
│   ├── Infrastructure.Tests/     # Backend regression tests
│   └── WebApi/                   # Controllers, middleware and health checks
├── WebApp/
│   └── src/
│       ├── app/core/             # Authentication, TV settings and playback state
│       ├── app/features/dashboard/
│       ├── app/shared/components/retro-tv/
│       └── styles/               # Shared dashboard and message-page styles
├── database-target.dbml          # Target relational schema
├── docker-compose.yml            # Local development stack
├── docker-compose.production.yml # GHCR production stack
├── .github/workflows/deploy.yml  # PR validation and production deployment
└── CONTRIBUTING.md               # Branch, commit and deployment conventions
```

## API

La API está versionada bajo `/api/v1`. Las rutas administrativas requieren
autenticación y permisos; las rutas `/public` permiten consultar la programación
y el catálogo sin iniciar sesión.

| Área | Rutas principales |
|------|-------------------|
| Autenticación | `POST /api/v1/auth/token`, `/api/v1/auth/refresh`, `/api/v1/auth/revoke` |
| Catálogo | `/api/v1/series`, `/api/v1/episodes`, `/api/v1/category` |
| Archivos | `POST /api/v1/series/{id}/upload`, `POST /api/v1/series/{id}/scan` |
| Canales y eras | `/api/v1/channels`, `/api/v1/channels/{channelId}/eras` |
| Programación | `POST /api/v1/channels/{id}/schedule/refresh` |
| Publicidad y cortes | `/api/v1/retro/interludes`, `/api/v1/retro/eras/{eraId}/*`, `/api/v1/retro/episodes/{episodeId}/break-points` |
| Metadatos y comentarios | `/api/v1/metadata/*`, `/api/v1/series/{seriesId}/comments`, `/api/v1/moderation/comments` |
| Administración | `/api/v1/dashboard/summary`, `/api/v1/dashboard/activity`, `/api/v1/users`, `/api/v1/roles`, `/api/v1/menus` |
| Público | `/api/v1/public/channels`, `/api/v1/public/channels/{channelId}/state`, `/api/v1/public/channels/{channelId}/schedule`, `/api/v1/public/series`, `/api/v1/public/series/{seriesId}/episodes` |
| Salud | `/health` (proceso HTTP), `/health/ready` (conexión con SQL Server) |

Los métodos y contratos completos se consultan en Scalar durante el desarrollo.
La salud de la WebApp no sustituye la comprobación de readiness de la API.

## CI/CD y producción

Flujo de contribución: **`feature/* → develop → main`**, con commits
Conventional Commits en inglés y sin coautor. Ver [CONTRIBUTING.md](CONTRIBUTING.md).

- **PR hacia develop o main:** activa revisión de dependencias, escaneo de
  seguridad y construcción de API/WebApp. El build de la API ejecuta sus
  pruebas. No publica imágenes ni despliega.
- **Push a main:** tras aprobar los gates, publica en GHCR las imágenes
  `nostalgia-api` y `nostalgia-web` con `:latest` y `:<sha>`, y despliega
  mediante SSH con una clave restringida y el dispatcher autorizado.
- Trivy en este workflow excluye `WebApp/`; la revisión de dependencias del PR
  comprueba vulnerabilidades nuevas. Esto no equivale a una auditoría completa
  de todas las dependencias existentes del frontend ni a revisión visual.

En producción se utiliza `docker-compose.production.yml` como
`/opt/nostalgiatv/docker-compose.yml`. Solo la WebApp publica un puerto en
loopback, normalmente `127.0.0.1:8090`; nginx del host termina TLS. API y base
de datos no publican puertos al host. Los stacks de observabilidad son
independientes; revisar aliases y redes de monitoreo para no mezclar proyectos.

Despliegue manual de respaldo, desde la VPS:

```bash
cd /opt/nostalgiatv
sudo docker compose pull
sudo docker compose up -d
sudo docker compose ps
```

No agregar usuarios al grupo Docker ni usar Watchtower como alternativa al
despliegue autorizado. No versionar `.env`, `appsettings.Local.json`,
certificados, JWT, contraseñas, archivos de medios ni backups reales.

Las migraciones iniciales incluyen una cuenta `admin`: cambiar su contraseña
antes de utilizarla en producción. El README no publica credenciales.

## Licencia

Copyright (c) 2026 Fernando. Todos los derechos reservados.

Código propietario y confidencial. No se permite su uso, copia, modificación o
distribución sin autorización expresa del autor.
