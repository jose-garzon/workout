#!/usr/bin/env bash
#
# Executable proof of the architecture firewall (design.md §3 / §6).
#
# For each fixture in test/firewall-fixtures/, materialize it into the REAL path
# its firewall rule targets, run the tool, and assert the expected outcome
# (violation blocked, or the allowed case passing). Fixtures are removed after
# each check — the repo is never left red.
#
# Run: `bun run firewall:proof`. Exits 0 only if every proof behaves as expected.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

FIX="test/firewall-fixtures"
ROUTE_DIR="src/app/api/__firewall_proof__"
ROUTE="$ROUTE_DIR/route.ts"
MOD_ALPHA="src/modules/__fixture_alpha__"
MOD_BETA="src/modules/__fixture_beta__"

FAILURES=0

cleanup() {
  rm -rf "$ROUTE_DIR" "$MOD_ALPHA" "$MOD_BETA"
}
trap cleanup EXIT
cleanup

pass() { printf '  \033[32mPASS\033[0m  %s\n' "$1"; }
fail() { printf '  \033[31mFAIL\033[0m  %s\n' "$1"; FAILURES=$((FAILURES + 1)); }

# biome_expect_fail <fixture> <grep> <label>
# Normalize formatting first (biome check --write) so the only remaining error asserted
# is the firewall rule, then assert plain `biome check` exits non-zero + matches.
biome_expect_fail() {
  local fixture="$1" pattern="$2" label="$3"
  mkdir -p "$ROUTE_DIR"
  cp "$FIX/$fixture" "$ROUTE"
  bunx biome check --write "$ROUTE" >/dev/null 2>&1
  local out ec
  out="$(bunx biome check "$ROUTE" 2>&1)"
  ec=$?
  if [ "$ec" -ne 0 ] && grep -q "$pattern" <<<"$out"; then
    pass "$label (biome exit=$ec, matched /$pattern/)"
  else
    fail "$label (biome exit=$ec, expected non-zero + /$pattern/)"
    printf '%s\n' "$out" | sed 's/^/      | /'
  fi
  cleanup
}

# biome_expect_pass <fixture> <label>
biome_expect_pass() {
  local fixture="$1" label="$2"
  mkdir -p "$ROUTE_DIR"
  cp "$FIX/$fixture" "$ROUTE"
  bunx biome check --write "$ROUTE" >/dev/null 2>&1
  local out ec
  out="$(bunx biome check "$ROUTE" 2>&1)"
  ec=$?
  if [ "$ec" -eq 0 ]; then
    pass "$label (biome exit=0)"
  else
    fail "$label (biome exit=$ec, expected 0)"
    printf '%s\n' "$out" | sed 's/^/      | /'
  fi
  cleanup
}

# depcruise_expect_fail <grep> <label>  (fixtures already materialized by caller)
depcruise_expect_fail() {
  local pattern="$1" label="$2"
  local out ec
  out="$(bunx depcruise src 2>&1)"
  ec=$?
  if [ "$ec" -ne 0 ] && grep -q "$pattern" <<<"$out"; then
    pass "$label (depcruise exit=$ec, matched /$pattern/)"
  else
    fail "$label (depcruise exit=$ec, expected non-zero + /$pattern/)"
    printf '%s\n' "$out" | sed 's/^/      | /'
  fi
  cleanup
}

echo "== Rule 4 — server firewall (Biome, security-load-bearing) =="
biome_expect_fail "biome/route-shared-db.ts" "noRestrictedImports" \
  "route importing @/shared/db is blocked"
biome_expect_fail "biome/route-repo.ts" "noRestrictedImports" \
  "route importing a *Repo is blocked"
biome_expect_fail "biome/route-ai-client.ts" "noRestrictedImports" \
  "route importing api/ai/client is blocked"
biome_expect_pass "biome/route-allowed.ts" \
  "route importing only ai/{prompt,schema,errors} passes"

echo "== Rule 3 — cross-feature barrel-only + no cycles (dependency-cruiser) =="
mkdir -p "$MOD_ALPHA/logic" "$MOD_BETA/logic"
cp "$FIX/depcruise/deep/alpha-deep-importer.ts" "$MOD_ALPHA/logic/deep-importer.ts"
cp "$FIX/depcruise/deep/beta-internal.ts" "$MOD_BETA/logic/internal.ts"
depcruise_expect_fail "cross-feature-barrel-only" \
  "deep cross-feature import is blocked"

mkdir -p "$MOD_ALPHA/logic"
cp "$FIX/depcruise/cycle/cycle-a.ts" "$MOD_ALPHA/logic/cycle-a.ts"
cp "$FIX/depcruise/cycle/cycle-b.ts" "$MOD_ALPHA/logic/cycle-b.ts"
depcruise_expect_fail "no-circular" \
  "import cycle is blocked"

echo
if [ "$FAILURES" -eq 0 ]; then
  printf '\033[32mAll firewall proofs behaved as expected.\033[0m\n'
  exit 0
else
  printf '\033[31m%d firewall proof(s) did not behave as expected.\033[0m\n' "$FAILURES"
  exit 1
fi
