FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build -- --configuration production

FROM nginx:1.27-alpine AS final
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
