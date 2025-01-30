FROM node:21-alpine AS build

ENV NODE_ENV production
ENV THELOUNGE_HOME "/srv/config"

WORKDIR /srv

COPY . /srv

RUN set -eux; \
    apk --update --no-cache --virtual build-deps add python3 build-base git; \
    ln -sf python3 /usr/bin/python; \
    yarn --non-interactive --production=false install; \
    yarn run build

FROM node:21-alpine AS app

ENV NODE_ENV production
ENV THELOUNGE_HOME "/srv/config"

CMD ["/srv/index.js", "start"]
ENTRYPOINT ["node"]
EXPOSE 9000
USER node
WORKDIR /srv

COPY --from=build --chown=node:node /srv /srv
