#!/usr/bin/env bash
# Usage: bash repro.sh <entry.ts>
# Starts the server, POSTs test.txt to /upload, prints the result, stops the server.
set -u

ENTRY="${1:-src/main.ts}"
URL="http://localhost:3000/upload"
LOG="$(mktemp)"
BODY="$(mktemp)"

rm -rf uploads

node --import tsx "$ENTRY" >"$LOG" 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null; wait "$SERVER_PID" 2>/dev/null; rm -f "$LOG" "$BODY"' EXIT

# Wait (up to ~30s) until the server answers HTTP.
for _ in $(seq 1 120); do
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "Server exited before it started listening:"
    cat "$LOG"
    exit 1
  fi
  if curl -s -o /dev/null "http://localhost:3000/"; then break; fi
  sleep 0.25
done

echo "entry: $ENTRY"
echo "request: curl -F file=@test.txt $URL"
STATUS="$(curl -s -o "$BODY" -w '%{http_code}' -F file=@test.txt "$URL")"
echo "status: $STATUS"
echo "body:   $(cat "$BODY")"

# The thrown error is only logged server-side (the response is a generic 500), so show it.
sleep 0.5
ERR="$(grep -m1 -E 'StorageError' "$LOG" | sed -E 's/^.*(StorageError)/\1/')"
if [ -n "$ERR" ]; then
  echo "server error: $ERR"
fi
