# Guía de contribución — NostalgiaTV

Este documento define el flujo de trabajo con ramas, la convención de commits y
los pasos de despliegue de **NostalgiaTV** (backend ASP.NET Core + frontend
Angular + SQL Server).

## Ramas

| Rama | Rol |
|------|-----|
| **`main`** | Producción. Es lo que se despliega en la VPS. Historia limpia (sin secretos). |
| **`develop`** | Base de trabajo. Se actualiza desde `main` antes de crear cada feature. |
| **`feature/*`** | Trabajo puntual (una funcionalidad o fix). Sale de `develop`. |

> La rama base de trabajo es **`develop`** (no `dev`). Los PR se abren hacia `main`.
>
> `main` y `develop` comparten la misma historia limpia. Nunca introducir secretos
> reales ni recuperar commits de la historia anterior que contenía claves JWT/DB.

## Flujo de trabajo

Todo cambio va **`feature/*` → PR a `main`**. Nunca commitear directo a `main`.
El despliegue se ejecuta desde `main`. Antes de crear cada feature, integrar
los últimos cambios de `main` en `develop` por fast-forward, sin otro PR y
sin forzar la historia. CI hace ese fast-forward solo tras cada pipeline exitoso
de `main`; los pasos manuales quedan como respaldo.

```bash
# 1. Partir siempre de develop actualizada
git fetch origin
git switch develop
git pull --ff-only origin develop
# Integrar los últimos cambios de main y actualizar develop remota
git merge --ff-only origin/main
git push origin develop

# 2. Crear la rama de trabajo
git checkout -b feature/nombre-corto

# 3. Trabajar y commitear (ver convención abajo)
git add -A
git commit -m "feat: short description"

# 4. Subir y abrir el único PR hacia main
git push -u origin feature/nombre-corto
#   → abrir Pull Request: feature/nombre-corto → main
# 5. Integrar el PR cuando sus comprobaciones estén aprobadas
# CI publica/despliega desde main; develop se actualizará antes de la próxima feature
```

- Prefijos de rama sugeridos: `feature/`, `fix/`, `chore/`, `hardening/`, `ci/`.
- Borrar la rama de trabajo una vez fusionada.
- No abrir PR de promoción ni de sincronización hacia `develop`. Si el
  fast-forward falla, detenerse y revisar la divergencia; no sobrescribir commits.
- No agregar trailers `Co-authored-by` a los commits.

## Mantener las ramas locales actualizadas (obligatorio)

- Antes de crear una rama de trabajo, actualizar `develop` desde el remoto y
  hacer fast-forward al último `origin/main`, luego subir `develop`.
  Esperar que las comprobaciones de `main` estén aprobadas. Nunca ramificar desde una base atrasada.
- Antes de empezar cualquier cambio o revisión, actualizar la rama sobre la que
  se trabajará.
- Actualizar las ramas locales relacionadas (`develop` y `main`) antes de
  crear una feature. `develop` se adelanta solo cuando termina el pipeline de `main`.
- Si un cambio quedó pendiente durante bastante tiempo, reintegrar el estado más
  reciente de `develop` antes de continuar.
- Si una rama local tiene una historia antigua o divergente, no forzarla sobre el
  remoto: revisar la divergencia y recuperar la rama desde su equivalente remoto.

```bash
# Actualizar las ramas base
git fetch origin
git checkout develop && git pull --ff-only origin develop
git merge --ff-only origin/main
git push origin develop
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

1. Escanea el repositorio con Trivy y bloquea vulnerabilidades HIGH/CRITICAL; en
   paralelo prueba WebApp, la API (con SQL Server) y los scripts de despliegue.
   El job `security-scan` agrupa esos resultados (es el check requerido).
2. Construye, escanea y publica en GHCR las imágenes de API y WebApp con `:<sha>`,
   firmadas y verificadas: `ghcr.io/<owner>/nostalgia-api` y
   `ghcr.io/<owner>/nostalgia-web`. `:latest` sólo se mueve cuando ambas pasaron.
3. Despliega automáticamente en la VPS por SSH mediante el dispatcher restringido,
   enviándole el proyecto `nostalgiatv` para ejecutar `docker compose pull` y
   `docker compose up -d` en `/opt/nostalgiatv`.

Los workflows sólo se activan con PR hacia `main` o al integrar en `main`.
Un PR que sólo cambia Android o documentación omite las pruebas pesadas, pero
reporta igualmente los checks requeridos.

Después de cada pipeline exitoso de `main`, `.github/workflows/after-ci.yml`
adelanta `develop` a ese commit por fast-forward (nunca fuerza). Si `develop`
divergió o GitHub rechaza el cambio, abre un issue para sincronizar a mano con el
fast-forward descrito arriba. `main` sigue requiriendo PR y sus comprobaciones;
`develop` conserva las comprobaciones y la prohibición de force-push.

Dependabot abre sus actualizaciones únicamente hacia `main` y conserva los plazos
de espera. `dependabot-auto-merge.yml` etiqueta `automerge` las minor/patch (y los
refrescos de digest de Docker); `after-ci.yml` las integra cuando todos sus checks
pasan, ejecuta el pipeline de `main` y luego `develop` recibe el cambio. Las major
quedan abiertas para revisión. Android se valida en PR a `main` y publica sus APK
al integrar allí.

- Secret opcional **`AUTOMATION_TOKEN`** (token fine-grained sólo para este repo con
  Contents, Pull requests, Workflows y Actions en lectura/escritura). Sin él se usa
  `GITHUB_TOKEN`, que no puede integrar actualizaciones de workflows ni adelantar
  `develop` sobre cambios en `.github/workflows`; en ese caso deja un aviso.

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
