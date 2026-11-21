#!/usr/bin/env bash
# Re-records the Lintelia demo stories (apps/e2e/tests/demo) and recomposes every video in demo/videos.
#   bun run stack --detach          # first (needs node on PATH for the Restate package; Restate 1.8.1, see demo/README.md)
#   source ~/code/or-ledger/env.sh  # spend ledger (narration needs OPENROUTER_API_KEY)
#   bash demo/record.sh [--compose-only]      DEMO_STORIES="d01 d03" bash demo/record.sh
set -euo pipefail
cd "$(dirname "$0")/.."
command -v node >/dev/null 2>&1 || export PATH="$(ls -d "$HOME"/.nvm/versions/node/v2*/bin 2>/dev/null | tail -1):$PATH"
export E2E_CHROMIUM_PATH="${E2E_CHROMIUM_PATH:-$(ls -d "$HOME"/Library/Caches/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-mac-x64/chrome-headless-shell 2>/dev/null | tail -1)}"
RESULTS="${DEMO_RESULTS:-demo/.work/results}"
STORIES="${DEMO_STORIES:-d01 d02 d03 d04}"
if [[ "${1:-}" != "--compose-only" ]]; then
  curl -sf http://localhost:8000/health >/dev/null || { echo "the stack is not running: bun run stack --detach"; exit 1; }
  mkdir -p "$RESULTS" demo/screens
  for t in $STORIES; do
    rm -rf apps/e2e/test-results
    (cd apps/e2e && DEMO_SCREENS_DIR="$PWD/../../demo/screens" E2E_DEMO=1 npx playwright test --project=demo "$t" --workers=1)
    for d in apps/e2e/test-results/demo-*; do rm -rf "${RESULTS:?}/$(basename "$d")"; cp -R "$d" "$RESULTS/$(basename "$d")"; done
  done
fi
python3 -I demo/compose.py "$RESULTS" demo/script.json demo "${@:2}"
