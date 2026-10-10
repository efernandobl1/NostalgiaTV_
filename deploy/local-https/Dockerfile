FROM caddy:2.11.7-alpine

# Listen on 8443 without executable file capabilities or privileged containers.
RUN setcap -r /usr/bin/caddy
USER 1654:1654
