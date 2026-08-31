# Guía de contribución — NostalgiaTV

Este documento define el flujo de trabajo con ramas, la convención de commits y
los pasos de despliegue de **NostalgiaTV** (backend ASP.NET Core + frontend
Angular + SQL Server).

## Ramas

| Rama | Rol |
|------|-----|
| **`main`** | Producción. Es lo que se despliega en la VPS. Historia limpia (sin secretos). |
| **`develop`** | Integración. Todo lo nuevo se junta acá antes de pasar a `main`. |
| **`feature/*`** | Trabajo puntual (una funcionalidad o fix). Sale de `develop`. |

> La rama de integración es **`develop`** (no `dev`).
>
> `main` y `develop` comparten la misma historia limpia. Nunca introducir secretos
> reales ni recuperar commits de la historia anterior que contenía claves JWT/DB.

## Flujo de trabajo

Todo cambio va **`feature/*` → `develop` → `main`**. Nunca commitear directo a
`main`.

```bash
# 1. Partir siempre de develop actualizada
git checkout develop
git pull --ff-only origin develop

# 2. Crear la rama de trabajo
git checkout -b feature/nombre-corto

# 3. Trabajar y commitear (ver convención abajo)
git add -A
git commit -m "feat: short description"

# 4. Subir y abrir PR hacia develop
git push -u origin feature/nombre-corto
#   → abrir Pull Request: feature/nombre-corto → develop

# 5. Cuando develop está probado, promover a main
git checkout main
git pull --ff-only origin main
git merge --ff-only develop
git push origin main
```

- Prefijos de rama sugeridos: `feature/`, `fix/`, `chore/`, `hardening/`, `ci/`.
- Borrar la rama de trabajo una vez fusionada.
- Mantener `develop` y `main` sincronizadas: después de promover a `main`, ambas
  deben quedar en el mismo commit.
- No agregar trailers `Co-authored-by` a los commits.

## Mantener las ramas locales actualizadas (obligatorio)

- Antes de crear una rama de trabajo, actualizar la rama base, normalmente
  `develop`. Nunca ramificar desde una rama local atrasada.
- Antes de empezar cualquier cambio o revisión, actualizar la rama sobre la que
  se trabajará.
- Al hacer `push` o `merge`, actualizar también las ramas locales relacionadas
  (`develop` y `main`).
- Si un cambio quedó pendiente durante bastante tiempo, reintegrar el estado más
  reciente de `develop` antes de continuar.
- Si una rama local tiene una historia antigua o divergente, no forzarla sobre el
  remoto: revisar la divergencia y recuperar la rama desde su equivalente remoto.

```bash
# Actualizar las ramas base
git fetch origin
git checkout develop && git pull --ff-only origin develop
git checkout main    && git pull --ff-only origin main

# Reincorporar la feature al último develop
git checkout feature/nombre-corto
git rebase develop      # o: git merge develop
```

## Convención de commits

- **Idioma: inglés.** Mensajes concisos y sin coautor.
- Formato:

  ```text
  <type>: <short description>

  - Component/file: change made
  - Component/file: change made
  ```

- Tipos: `feat`, `fix`, `refactor`, `style`, `chore`, `ci`, `hardening`, `docs`.
- Combinar cambios relacionados en una sola línea y omitir detalles obvios.

## Build y ejecución rápida

```bash
# Backend (.NET); aplica migraciones pendientes al arrancar
cd WebApi/WebApi
dotnet run                          # HTTPS: https://localhost:7221

# Frontend (Angular); usar pnpm, no npm
corepack enable
cd WebApp
pnpm install
pnpm start                          # http://localhost:4200
pnpm run build

# Stack local completo (SQL Server + API + WebApp)
cp .env.example .env
docker compose up --build -d        # WebApp: http://localhost:8082
```

## CI/CD y despliegue

Al integrar en `main`, `.github/workflows/deploy.yml`:

1. Escanea el repositorio con Trivy y bloquea vulnerabilidades HIGH/CRITICAL.
2. Construye y publica en GHCR las imágenes de API y WebApp con tags `:latest`
   y `:<sha>`:
   `ghcr.io/<owner>/nostalgia-api` y `ghcr.io/<owner>/nostalgia-web`.
3. Despliega automáticamente en la VPS por SSH mediante el dispatcher restringido,
   enviándole el proyecto `nostalgiatv` para ejecutar `docker compose pull` y
   `docker compose up -d` en `/opt/nostalgiatv`.

- Requiere en el entorno de GitHub **`production`** los secrets
  `VPS_SSH_PRIVATE_KEY`, `VPS_KNOWN_HOSTS`, `VPS_HOST`, `VPS_PORT` y `VPS_USER`.
- La clave de despliegue debe usar un comando forzado: sólo puede solicitar el
  despliegue de proyectos autorizados, sin shell ni acceso libre a Docker.
- Despliegue manual de respaldo:

  ```bash
  cd /opt/nostalgiatv
  sudo docker compose pull
  sudo docker compose up -d
  sudo docker compose ps
  ```

- Probar la clave restringida (el dispatcher ejecutará el despliegue autorizado):

  ```bash
  ssh -i deploy -p <PORT> -o IdentitiesOnly=yes deploy@<HOST> nostalgiatv
  ```

- En producción, sólo la WebApp se publica en localhost como
  `127.0.0.1:<host>:8080`; nginx del host termina TLS y enruta el dominio. La API
  y SQL Server permanecen sin puertos publicados.

## Secretos y configuración

- Nunca commitear `.env`, `appsettings.Local.json`, certificados/PFX ni secretos
  reales. Usar únicamente los archivos `*.example` versionados.
- En producción, la configuración llega mediante `.env` y variables de entorno,
  incluyendo `ConnectionStrings__DefaultConnection`, `Jwt__*`,
  `Cors__AllowedOrigins__0`, `MediaSettings__*`, `ChannelScheduling__*` y
  `ReverseProxy__TrustForwardedHeaders`.
- La API aplica automáticamente las migraciones EF pendientes al arrancar. Tras
  cambios del modelo, crear una migración nueva y verificar `dotnet build`; no
  eliminar migraciones ya aplicadas.

## Notas de datos (contenido de video)

- Los videos destinados al navegador deben ser **MP4/H.264**; archivos como FLV
  requieren transcodificación.
- El scanner ignora artefactos de transcodificación (`.transcoding.`,
  `.web-compatible`, `.part`, `.tmp`) y archivos que no son video.
- Tras cambiar archivos en disco, re-escanear la serie y regenerar la programación
  del canal.
