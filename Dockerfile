FROM node:21-alpine

ARG THELOUNGE_VERSION=4.4.3

ENV NODE_ENV production

ENV THELOUNGE_HOME "/srv/config"
COPY config/ /srv/config

# Expose HTTP.
ENV PORT 9000
EXPOSE ${PORT}

ENTRYPOINT ["/srv/docker-entrypoint.sh"]
CMD ["index.js", "start"]

WORKDIR /srv
COPY . /srv

# Install thelounge.
RUN apk --update --no-cache --virtual build-deps add python3 build-base git && \
    ln -sf python3 /usr/bin/python && \
    yarn --non-interactive install && \
    yarn --non-interactive cache clean && \
    yarn build && \
    apk del --purge build-deps && \
    rm -rf /root/.cache /tmp /usr/bin/python \
