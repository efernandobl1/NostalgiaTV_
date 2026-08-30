# Guía de contribución — NostalgiaTV

Este documento define el flujo de trabajo con ramas, la convención de commits y
los pasos de despliegue del proyecto.

## Ramas

| Rama | Rol |
|------|-----|
| **`main`** | Producción. Es lo que se despliega en la VPS. Historia limpia (sin secretos). |
| **`develop`** | Integración. Todo lo nuevo se junta acá antes de pasar a `main`. |
| **`feature/*`** | Trabajo puntual (una funcionalidad o fix). Sale de `develop`. |

> La rama de integración es **`develop`** (no `dev`).
>
> `main` y `develop` comparten la misma historia limpia. La historia vieja de
> `develop` (que contenía claves JWT/DB filtradas) fue reemplazada; no volver a
> introducir esos commits.

## Flujo de trabajo

Todo cambio va **`feature/*` → `develop` → `main`**. Nunca commitear directo a
`main`.

```bash
# 1. Partir siempre de develop actualizada
git checkout develop
git pull origin develop

# 2. Crear la rama de trabajo
git checkout -b feature/nombre-corto

# 3. Trabajar y commitear (ver convención abajo)
git add -A
git commit -m "feat: descripción breve"

# 4. Subir y abrir PR hacia develop
git push -u origin feature/nombre-corto
#   → abrir Pull Request: feature/nombre-corto  →  develop

# 5. Cuando develop está probado, promover a main
git checkout main
git pull origin main
git merge --ff-only develop   # avanza main al estado de develop
git push origin main
```

- Prefijos de rama sugeridos: `feature/`, `fix/`, `chore/`, `hardening/`, `ci/`.
- Borrar la rama `feature/*` una vez fusionada.
- Mantener `develop` y `main` sincronizadas: después de promover a `main`, ambas
  quedan en el mismo commit.

## Mantener las ramas locales actualizadas (obligatorio)

Para evitar trabajar sobre una rama vieja y terminar con commits que hay que
rehacer, seguir estas reglas **siempre**:

- **Antes de crear una rama `feature/*`**: hacer `pull` de la rama de la que
  proviene (normalmente `develop`). Nunca ramificar de una rama local atrasada.
- **Antes de empezar cualquier cambio o revisión de código**: hacer `pull` de la
  rama en la que se va a trabajar, para asegurarse de partir del último estado.
- **Al hacer `push` o `merge`**: actualizar también las ramas locales relacionadas
  dentro de la carpeta del proyecto (`develop` y `main`), para no dejarlas atrás.
- **Si pasó bastante tiempo** desde que se dejó un cambio pendiente: hacer `pull`
  y reintegrar (`rebase`/`merge`) **antes** de seguir con ese trabajo.

```bash
# Actualizar las ramas base sin cambiar de rama de trabajo
git fetch origin
git checkout develop && git pull --ff-only origin develop
git checkout main    && git pull --ff-only origin main

# Reincorporar tu feature al último develop (antes de seguir o de abrir PR)
git checkout feature/nombre-corto
git rebase develop      # o: git merge develop
```

## Convención de commits

- **Idioma: inglés.** Mensajes concisos, mínimo de líneas.
- Formato:

  ```
  <tipo>: <descripción breve>

  - Componente/archivo: qué cambió (una línea)
  - Componente/archivo: qué cambió (una línea)
  ```

- Tipos: `feat`, `fix`, `refactor`, `style`, `chore`, `ci`, `hardening`, `docs`.
- Combinar cambios relacionados en una sola línea; omitir detalles obvios.

## CI/CD y despliegue

- Al integrar en `main`, el pipeline construye y publica las imágenes en GHCR
  (incluyendo el tag `:latest`) y **despliega automáticamente en la VPS** por SSH
  (job `deploy` de `.github/workflows/deploy.yml`): baja las imágenes y reinicia el
  stack (`docker compose pull` + `up -d`).
- Requiere en GitHub, entorno **`production`**: secrets `VPS_SSH_PRIVATE_KEY` y
  `VPS_KNOWN_HOSTS`, y variables `VPS_HOST`, `VPS_PORT`, `VPS_USER` (opcional
  `VPS_DEPLOY_DIR`, por defecto `/opt/nostalgiatv`).
- Despliegue **manual** en la VPS (fallback si hiciera falta):

  ```bash
  cd /opt/nostalgiatv
  sudo docker compose -f docker-compose.production.yml pull
  sudo docker compose -f docker-compose.production.yml up -d
  ```

- El contenedor web corre **nginx como usuario no-root en el puerto 8080**; el
  `docker-compose.yml` del VPS debe mapear `127.0.0.1:<host>:8080` (el nginx del
  host termina TLS y enruta el dominio hacia ese puerto).

## Notas de datos (contenido de video)

- Los videos deben ser **MP4/H.264** para reproducirse en el navegador (los
  `.flv` no son compatibles con `<video>`).
- El scanner de series ignora artefactos de transcodificación
  (`.transcoding.`, `.web-compatible`, `.part`, `.tmp`) y archivos que no son
  video. Tras cambiar archivos en disco: **re-escanear la serie** y luego
  **regenerar la programación** del canal.
