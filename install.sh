#!/usr/bin/env bash
# Install qcmp into ~/.local (code + binary symlink).
#
#   ./install.sh              # install (rsync this checkout → ~/.local/lib/qcmp)
#   ./install.sh --symlink    # dev install: symlink the lib dir to this checkout
#   ./install.sh --uninstall  # remove the symlink + lib dir
set -euo pipefail

PREFIX_LIB="$HOME/.local/lib/qcmp"
PREFIX_BIN="$HOME/.local/bin"
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"

UNINSTALL=false
SYMLINK=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --uninstall) UNINSTALL=true; shift ;;
        --symlink)   SYMLINK=true; shift ;;
        -h|--help)
            sed -n '1,/^set -e/p' "$0" | sed 's/^# \?//'
            exit 0 ;;
        *) echo "unknown flag: $1" >&2; exit 1 ;;
    esac
done

c_green='\033[0;32m'; c_yellow='\033[1;33m'; c_red='\033[0;31m'; c_off='\033[0m'
log()  { printf "${c_green}[+]${c_off} %s\n" "$*"; }
warn() { printf "${c_yellow}[!]${c_off} %s\n" "$*"; }
die()  { printf "${c_red}[x]${c_off} %s\n" "$*" >&2; exit 1; }

if $UNINSTALL; then
    log "Uninstalling qcmp..."
    rm -f "$PREFIX_BIN/qcmp"
    if [[ -L "$PREFIX_LIB" ]]; then
        rm -f "$PREFIX_LIB"
    else
        rm -rf "$PREFIX_LIB"
    fi
    log "Done."
    exit 0
fi

command -v node >/dev/null 2>&1 || die "node is required (>=20)"
command -v npm  >/dev/null 2>&1 || die "npm is required"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[[ "$NODE_MAJOR" -ge 20 ]] || die "node >=20 required, found $(node --version)"

if $SYMLINK; then
    log "Symlinking $PREFIX_LIB → $SRC_DIR (dev install)"
    if [[ -L "$PREFIX_LIB" ]]; then
        rm -f "$PREFIX_LIB"
    elif [[ -e "$PREFIX_LIB" ]]; then
        warn "$PREFIX_LIB exists as a real dir — replacing with a symlink"
        rm -rf "$PREFIX_LIB"
    fi
    mkdir -p "$(dirname "$PREFIX_LIB")"
    ln -sfn "$SRC_DIR" "$PREFIX_LIB"
else
    command -v rsync >/dev/null 2>&1 || die "rsync is required for non-symlink install"
    log "Installing code into $PREFIX_LIB"
    if [[ -L "$PREFIX_LIB" ]]; then
        warn "$PREFIX_LIB is currently a symlink — replacing with a real copy"
        rm -f "$PREFIX_LIB"
    fi
    mkdir -p "$PREFIX_LIB"
    rsync -a --delete \
        --exclude=node_modules --exclude=.git \
        --exclude='*.log' --exclude='.env' \
        "$SRC_DIR/" "$PREFIX_LIB/"
fi

log "Installing npm dependencies"
( cd "$PREFIX_LIB" && npm install --silent )

mkdir -p "$PREFIX_BIN"
ln -sf "$PREFIX_LIB/bin/qcmp" "$PREFIX_BIN/qcmp"
log "Symlinked $PREFIX_BIN/qcmp"

if ! command -v qcmp >/dev/null 2>&1; then
    warn "$PREFIX_BIN is not in PATH. Add to your shell rc:"
    warn '    export PATH="$HOME/.local/bin:$PATH"'
fi

printf '\n────────────────────────────────────────────────────────────────────\n'
printf "${c_green}qcmp installed.${c_off}\n"
if $SYMLINK; then
    printf "${c_yellow}(dev install — code dir is a symlink to %s)${c_off}\n" "$SRC_DIR"
fi
cat <<EOF

Quick start:
  cd <your project>
  cat > qcmp.yaml <<'YAML'
  project: my-project
  components:
    - key: project
      file: package.json
      path: version
      extractor: json
      main: true
  YAML
  qcmp list
  qcmp versions --pretty
  qcmp bump project patch

Code dir:  $PREFIX_LIB$($SYMLINK && printf "  (→ %s)" "$SRC_DIR")
Uninstall: $SRC_DIR/install.sh --uninstall
────────────────────────────────────────────────────────────────────
EOF
