#!/bin/sh
set -eu

lock_hash=$(sha256sum package-lock.json | awk '{print $1}')
stamp="node_modules/.package-lock.sha256"

if [ ! -f "$stamp" ] || [ "$(cat "$stamp")" != "$lock_hash" ]; then
  npm ci
  echo "$lock_hash" > "$stamp"
fi

exec "$@"
