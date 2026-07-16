FROM node:24-alpine AS build

ENV NODE_ENV production
ENV THELOUNGE_HOME "/srv/config"

WORKDIR /srv

COPY . /srv

RUN set -eux; \
    apk --update --no-cache --virtual build-deps add python3 py3-setuptools build-base git; \
    ln -sf python3 /usr/bin/python; \
    yarn --non-interactive --production=false --frozen-lockfile install; \
    yarn run build

FROM node:24-alpine AS app

ENV NODE_ENV production
ENV THELOUNGE_HOME "/srv/config"

CMD ["/srv/index.js", "start"]
ENTRYPOINT ["node"]
EXPOSE 8082
USER node
WORKDIR /srv

COPY --from=build --chown=node:node /srv /srv
