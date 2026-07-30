#!/usr/bin/env bash
# Refuse CloudBase operations while the CLI session is on the rui-ledger env.
set -euo pipefail
TARGET_ENV="${1:-our-little-planet-d1dcw25f2b06ae}"
LIST="$(tcb env list 2>/dev/null || true)"
if echo "$LIST" | grep -q 'rui-ledger'; then
  if ! echo "$LIST" | grep -q "$TARGET_ENV"; then
    echo "REFUSED: tcb session looks like rui-ledger and cannot see $TARGET_ENV." >&2
    echo "Run: tcb logout && tcb login  (second Tencent account for little-planet)" >&2
    exit 2
  fi
fi
if ! echo "$LIST" | grep -q "$TARGET_ENV"; then
  echo "REFUSED: $TARGET_ENV not in tcb env list. Login to the correct account." >&2
  exit 2
fi
echo "OK: CLI can see $TARGET_ENV"
