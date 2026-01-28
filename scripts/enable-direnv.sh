#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
SHELL_NAME=$(basename "${SHELL:-}")

if ! command -v direnv >/dev/null 2>&1; then
  echo "direnv not found. Install with: sudo apt install direnv" >&2
  exit 1
fi

case "$SHELL_NAME" in
  bash)
    RC="$HOME/.bashrc"
    HOOK='eval "$(direnv hook bash)"'
    ;;
  zsh)
    RC="$HOME/.zshrc"
    HOOK='eval "$(direnv hook zsh)"'
    ;;
  *)
    echo "unsupported shell: $SHELL_NAME" >&2
    exit 1
    ;;
 esac

if [ ! -f "$RC" ]; then
  touch "$RC"
fi

if ! grep -Fqx "$HOOK" "$RC"; then
  printf "\n%s\n" "$HOOK" >> "$RC"
fi

if [ ! -f "$ROOT/.envrc" ]; then
  cp "$ROOT/.envrc.example" "$ROOT/.envrc"
fi

direnv allow "$ROOT"

echo "direnv enabled for $ROOT"
