# 📺 NostalgiaTV

NostalgiaTV es una plataforma de streaming retro personal. Organiza series y
episodios en **canales** que se transmiten como TV en vivo (programación
generada y sincronizada en tiempo real con SignalR) y permite además ver
**series on-demand**. Incluye una experiencia pública tipo televisor retro (modo
TV / control remoto / guía de programación) y un panel de administración.

---

## 🚀 Tecnologías

### Backend (`WebApi/`)
- **ASP.NET Core 10** — Web API REST (versionada `api/v1`)
- **Entity Framework Core** — ORM con migraciones (se aplican solas al arrancar)
- **SQL Server** — base de datos
- **SignalR** — estado de canal en vivo en tiempo real
- **Serilog** — logging estructurado + middleware de request/response y auditoría
  (`ActivityLog`)
- **Mapster** — mapeo de DTOs · **FluentValidation** — validación
- **JWT + cookies HttpOnly** y **Argon2id** para contraseñas
- **Health checks** (`/health`, `/health/ready` con verificación real a SQL Server)
- **Scalar** — documentación de API · **FFmpeg** (FFMpegCore) — duración de videos

### Frontend (`WebApp/`)
- **Angular 21** (standalone components + signals)
- **Angular Material** — UI del dashboard
- **Tailwind CSS v4** — experiencia pública retro
- **SignalR Client** — sincronización en vivo
- **pnpm** como gestor de paquetes (vía corepack), **no npm**

---

## ✨ Funcionalidades

### Experiencia pública (TV retro)
- **Canales en vivo**: la programación se genera automáticamente y se sincroniza
  con SignalR (todos ven lo mismo, al mismo tiempo). No se puede pausar/adelantar.
- **Series on-demand**: catálogo con búsqueda, filtro por género y por canal,
  "Continuar viendo", y pantalla de detalle (temporadas, especiales, episodios).
- **Modo TV / cine**: video full-bleed con overlay auto-ocultable; detección de
  dispositivo (TV/desktop/móvil) para sugerir el modo TV.
- **Control remoto remapeable** (tipo emulador): teclas configurables guardadas en
  el navegador.
- **Guía de programación** (Hoy/Mañana) centrada en el programa actual.
- **Filtros CRT** (scanlines, viñeta, curvatura) configurables.
- **Reanudar reproducción** y marcado de vistos por episodio (persistente y estable
  entre re-escaneos).
- **Deep-links** para compartir: `?channel=<slug>` y `?series=<slug>`.

### Programación de canales (aleatoria y configurable)
- Selección **aleatoria** de episodios, **sin repetir** un episodio dentro de una
  ventana (por defecto 24 h) salvo que no alcancen los capítulos.
- Cupos diarios de **especiales** (máx. 2 por serie / 5 en total) y **películas**
  (máx. 2 por serie / 2 en total).
- Todo configurable por `appsettings` (`ChannelScheduling`) o variables de entorno
  (`ChannelScheduling__*` / `SCHED_*` en Docker).

### Panel de administración
- Gestión de **series, episodios, canales, eras y bumpers, categorías, usuarios y
  roles**; **resumen** y **registro de actividad** (auditoría).
- Escaneo de episodios desde disco (normaliza acentos, ignora artefactos de
  transcodificación y sólo indexa formatos reproducibles en web).

---

## 📋 Requisitos

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js 20+](https://nodejs.org/) con **pnpm** (`corepack enable`)
- [SQL Server](https://www.microsoft.com/sql-server) (o SQL Server Express)
- **FFmpeg** (para calcular la duración de los videos)
- [Docker](https://www.docker.com/) — opcional, para levantar el stack completo

---

## ⚙️ Puesta en marcha

### Opción A — Local (backend + frontend por separado)

**Backend** (aplica las migraciones EF pendientes al arrancar):
```bash
cd WebApi/WebApi
cp appsettings.Local.example.json appsettings.Local.json   # y completá tus valores
dotnet run                                                 # https://localhost:7221  (docs: /scalar/v1)
```

**Frontend** (usar **pnpm**, no npm):
```bash
corepack enable
cd WebApp
pnpm install
pnpm start                                                 # http://localhost:4200
pnpm run build                                             # build de producción
```

### Opción B — Stack completo con Docker (SQL Server + API + WebApp)
```bash
cp .env.example .env        # completá DB_PASSWORD, JWT_SECRET_KEY, etc.
docker compose up --build -d
# WebApp: http://localhost:8082   ·   API (dev): http://localhost:8080
```

> Configuración sensible por sección de `appsettings` o variables de entorno:
> `ConnectionStrings__DefaultConnection`, `Jwt__*`, `Cors__AllowedOrigins__0`,
> `MediaSettings__*`, `ChannelScheduling__*`, `ReverseProxy__TrustForwardedHeaders`.
> Nunca commitear `.env` ni `appsettings.Local.json`; usar los `*.example`.

---

## 🏗️ Estructura del proyecto

```
NostalgiaTV/
├── WebApi/                          # Backend ASP.NET Core
│   ├── ApplicationCore/             # Entidades, DTOs, Interfaces, Settings, Excepciones
│   ├── Infrastructure/              # Servicios, Contexto EF, Migraciones, BackgroundServices, Mappings
│   └── WebApi/                      # Controllers, Middleware, Logging, HealthChecks, Extensions, Program.cs
│
├── WebApp/                          # Frontend Angular (Tailwind + Material)
│   └── src/app/
│       ├── core/                    # Servicios globales (tv-mode, tv-settings, watched, control-bindings…)
│       ├── features/dashboard/      # Administración (series, episodes, channels, eras, bumpers, users, roles, activity, summary)
│       ├── shared/components/retro-tv/   # Experiencia pública retro TV
│       ├── layouts/ · common/ · shared/
│       └── styles/                  # Estilos compartidos (Tailwind + SCSS)
│
├── docker-compose.yml               # Stack de desarrollo
├── docker-compose.production.yml    # Stack de producción (sin publicar API/DB)
├── .github/workflows/deploy.yml     # CI/CD (scan → build/push GHCR → deploy VPS)
└── CONTRIBUTING.md                  # Flujo de ramas, commits y despliegue
```

---

## 📡 API

Rutas administrativas bajo `api/v1/*` (requieren auth) y rutas públicas bajo
`api/v1/public/*` (sin auth). Documentación interactiva en `/scalar/v1`.

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/v1/auth/token` · `/refresh` · `/revoke` | Login / refresh / logout |
| GET/POST/PUT/DELETE | `/api/v1/series`, `/episodes`, `/channels`, `/categories`, `/channel-eras`, `/channel-bumpers`, `/users`, `/roles` | ABM del panel |
| GET | `/api/v1/public/channels` · `/channels/{id}/state` · `/channels/{id}/schedule` | Canales, estado en vivo y guía |
| GET | `/api/v1/public/series` · `/series/{id}/episodes` · `/categories` | Catálogo público |
| GET | `/api/v1/public/channels/{id}/eras` · `/eras/{id}/bumpers` | Eras y bumpers |

---

## 🚢 CI/CD y despliegue

Al integrar en `main`, `.github/workflows/deploy.yml`:

1. **Escanea** el repo con Trivy (bloquea CVEs HIGH/CRITICAL).
2. **Construye y publica** en GHCR las imágenes de API y WebApp (`:latest` y `:<sha>`).
3. **Despliega automáticamente en la VPS** por SSH: se conecta con una clave de
   despliegue restringida (comando forzado) que ejecuta `docker compose pull` +
   `up -d` en el servidor.

El detalle del flujo de ramas (`feature/* → develop → main`), la convención de
commits y la configuración del despliegue (usuario `deploy`, dispatcher, secrets
del entorno `production`) está en **[CONTRIBUTING.md](CONTRIBUTING.md)**.

---

## 🔐 Credenciales por defecto

Las migraciones crean un usuario administrador inicial (`admin`).

> ⚠️ **Cambiá la contraseña del admin inmediatamente después del primer inicio de
> sesión.** No uses las credenciales por defecto en producción.

---

## 📄 Licencia

Copyright (c) 2026 Fernando. Todos los derechos reservados.

Código propietario y confidencial. No se permite su uso, copia, modificación o
distribución sin autorización expresa del autor.
