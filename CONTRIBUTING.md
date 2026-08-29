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
  (incluyendo el tag `:latest`).
- Despliegue **manual** en la VPS (sin Watchtower):

  ```bash
  cd /opt/nostalgiatv
  sudo docker compose pull
  sudo docker compose up -d
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
