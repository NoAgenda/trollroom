#!/bin/sh

if [ "$1" = "thelounge" ] && [ "$(id -u)" = '0' ]; then
    find "/srv" \! -user node -exec chown node '{}' +
    exec su node -c "$*"
fi

exec "$@"
