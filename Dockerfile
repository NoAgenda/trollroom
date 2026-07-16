FROM node:24-alpine AS build

ENV NODE_ENV=production
ENV THELOUNGE_HOME=/srv/config

WORKDIR /srv

COPY package.json yarn.lock ./
RUN set -eux; \
    apk add --no-cache --virtual .build-deps python3 py3-setuptools build-base git; \
    ln -sf python3 /usr/bin/python; \
    yarn --non-interactive --production=false --frozen-lockfile install

COPY . /srv
RUN yarn run build

FROM node:24-alpine AS production-dependencies

ENV NODE_ENV=production

WORKDIR /srv

COPY package.json yarn.lock ./
RUN set -eux; \
    apk add --no-cache --virtual .build-deps python3 py3-setuptools build-base git; \
    ln -sf python3 /usr/bin/python; \
    yarn --non-interactive --production=true --frozen-lockfile install; \
    yarn cache clean; \
    apk del .build-deps

FROM node:24-alpine AS app

ENV NODE_ENV=production
ENV THELOUNGE_HOME=/srv/config
ENV PORT=8082

WORKDIR /srv

COPY --from=production-dependencies --chown=node:node /srv/node_modules /srv/node_modules
COPY --from=build --chown=node:node /srv/index.js /srv/package.json /srv/yarn.lock ./
COPY --from=build --chown=node:node /srv/config ./config
COPY --from=build --chown=node:node /srv/dist ./dist
COPY --from=build --chown=node:node /srv/public ./public

ENTRYPOINT ["node"]
CMD ["/srv/index.js", "start"]
EXPOSE 8082
USER node
