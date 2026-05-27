#!/usr/bin/env bash
# api-discover installer (POSIX).
# Idempotent. Re-run after `git pull` to refresh symlinks.

set -euo pipefail

say() { printf "\033[34m[install]\033[0m %s\n" "$*"; }
err() { printf "\033[31m[error]\033[0m %s\n" "$*" >&2; }
ok()  { printf "\033[32m[ok]\033[0m %s\n" "$*"; }

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DIR="${HOME}/.local/bin"
mkdir -p "$BIN_DIR"

# --- Prereqs ---

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    err "$1 not found. $2"
    exit 1
  fi
}

say "Checking prerequisites..."
require_cmd node "Install Node 18+ from https://nodejs.org/"
NODE_MAJOR="$(node -e 'console.log(process.versions.node.split(".")[0])')"
if [ "$NODE_MAJOR" -lt 18 ]; then
  err "Node 18+ required, found $(node --version)"
  exit 1
fi
ok "Node $(node --version)"

require_cmd python3 "Install Python 3.10+ from https://www.python.org/"
ok "Python $(python3 --version)"

if ! command -v uv >/dev/null 2>&1; then
  say "uv not found, installing via the official installer..."
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$PATH"
fi
ok "uv $(uv --version 2>/dev/null || echo present)"

# --- browser-harness ---

if ! command -v browser-harness >/dev/null 2>&1; then
  say "Installing browser-harness via uv..."
  uv tool install browser-harness
else
  ok "browser-harness already on PATH at $(command -v browser-harness)"
fi

# --- api-discover binary symlink ---

TARGET_LINK="$BIN_DIR/api-discover"
SOURCE_BIN="$REPO_ROOT/bin/api-discover.mjs"

chmod +x "$SOURCE_BIN"
ln -sf "$SOURCE_BIN" "$TARGET_LINK"
ok "Linked api-discover -> $TARGET_LINK"

# --- PATH check ---

case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *)
    say "Note: $BIN_DIR is not on PATH. Add to your shell rc:"
    echo "    export PATH=\"\$HOME/.local/bin:\$PATH\""
    ;;
esac

echo ""
ok "Installed. Run 'api-discover doctor' to verify."
