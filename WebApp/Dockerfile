FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.17.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm exec ng build --configuration production

FROM nginx:1.31-alpine@sha256:df221db836e1754089190208cee7eeda94f233197056426eda74a43ab1abeac2 AS final
# Patch runtime libraries without changing the pinned base or disabling image scans.
RUN apk upgrade --no-cache libexpat pcre2 tiff
COPY --from=build /app/dist/WebApp/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Non-root: el master de nginx corre como el usuario 'nginx' (no root) y escucha
# en 8080 (puerto no privilegiado). Se le da propiedad de los directorios que
# necesita escribir (cache, pid, html donde se monta env.js). Endurece el
# contenedor web sin depender de capabilities de red privilegiadas.
RUN chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /etc/nginx/conf.d \
    && touch /var/run/nginx.pid && chown nginx:nginx /var/run/nginx.pid

USER nginx
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/health || exit 1
