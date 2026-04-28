#!/usr/bin/env bash
#
# scripts/sim-smoke.sh
#
# iOS Simulator smoke driver for Pila Lang. Runs three scenarios that
# `flutter test integration_test/` can't reach (springboard cold launch,
# QR / URL handoff, push notification deep link). Each phase verifies via
# screenshot + os_log grep + (where applicable) HTTP probe.
#
# WHEN TO RUN
#   Local-only. cliclick needs Accessibility permission granted to the
#   running terminal — incompatible with headless CI.
#
# REQUIREMENTS
#   - macOS with Xcode + iOS Simulator
#   - cliclick on PATH:    brew install cliclick
#   - Accessibility:       System Settings > Privacy & Security > Accessibility
#                          add (and enable) the terminal app you run this from
#   - Web stack at $WEB_BASE with /api/test/* mounted:
#                          `just dev-test`  (sets ENABLE_TEST_ROUTES=1)
#   - Demo tenant seeded:  `just seed`      (the `just sim-smoke` recipe runs `up` + `seed` first)
#
# ENV OVERRIDES
#   SIM_DEVICE       default "iPhone 16 Pro"
#   SIM_RUNTIME      substring filter for runtime (default: any installed)
#   WEB_BASE         default "http://localhost:3000"
#   DEMO_SLUG        default "demo"
#
# OUTPUT
#   tmp/sim-smoke/<timestamp>/   screenshots, oslog dump, build log, payload
#
# KNOWN GAPS
#   - The system notification permission dialog is only triggered after a
#     successful join, which would require completing the join form via
#     cliclick text entry. Out of v1 scope; see plan file for details.

set -euo pipefail

# ---- Config ----
SIM_DEVICE="${SIM_DEVICE:-iPhone 16 Pro}"
SIM_RUNTIME_FILTER="${SIM_RUNTIME:-}"
WEB_BASE="${WEB_BASE:-http://localhost:3000}"
DEMO_SLUG="${DEMO_SLUG:-demo}"
BUNDLE_ID="com.pilalang.app"
PHASE="all"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_TS="$(date +%Y%m%dT%H%M%S)"
RUN_DIR="$ROOT_DIR/tmp/sim-smoke/$RUN_TS"
LOG_FILE="$RUN_DIR/oslog.txt"
mkdir -p "$RUN_DIR"

# ---- Args ----
for arg in "$@"; do
  case "$arg" in
    --phase=*) PHASE="${arg#--phase=}" ;;
    -h|--help)
      sed -n '2,40p' "$0"
      exit 0 ;;
    *) printf 'unknown arg: %s\n' "$arg" >&2; exit 64 ;;
  esac
done

# ---- Per-phase results ----
RES_COLD="skipped"
RES_QR="skipped"
RES_PUSH="skipped"

# ---- Helpers ----
log()  { printf '\n[smoke] %s\n' "$*"; }
fail() { printf '[smoke] FAIL: %s\n' "$*" >&2; }

screenshot() {
  local name="$1"
  if xcrun simctl io booted screenshot "$RUN_DIR/$name.png" >/dev/null 2>&1; then
    log "screenshot: $name.png"
  else
    fail "screenshot: $name"
  fi
}

# Wait up to N seconds for $1 to appear in $LOG_FILE.
assert_log() {
  local pattern="$1"
  local timeout="${2:-15}"
  local elapsed=0
  while [ "$elapsed" -lt "$timeout" ]; do
    if grep -qF -- "$pattern" "$LOG_FILE" 2>/dev/null; then
      return 0
    fi
    sleep 1
    elapsed=$((elapsed+1))
  done
  fail "log timeout (${timeout}s): $pattern"
  return 1
}

http_probe_party() {
  local pid="$1"
  local expected="$2"
  local body
  body="$(curl -fsSL "$WEB_BASE/api/test/party-state/$pid" || true)"
  local got
  got="$(printf '%s' "$body" | jq -r '.status // empty')"
  if [ "$got" = "$expected" ]; then return 0; fi
  fail "party-state probe: got=${got:-<empty>} expected=$expected"
  return 1
}

# ---- Pre-flight ----
preflight() {
  log "pre-flight"
  command -v cliclick >/dev/null 2>&1 \
    || { fail "cliclick not on PATH (brew install cliclick)"; exit 1; }
  command -v xcrun >/dev/null 2>&1 \
    || { fail "xcrun not available — install Xcode command line tools"; exit 1; }
  command -v flutter >/dev/null 2>&1 \
    || { fail "flutter not on PATH"; exit 1; }
  command -v jq >/dev/null 2>&1 \
    || { fail "jq not on PATH (brew install jq)"; exit 1; }

  if ! curl -fsSL --head "$WEB_BASE/api/test/qr-token/$DEMO_SLUG" >/dev/null 2>&1; then
    fail "test routes not reachable at $WEB_BASE"
    fail "  - is the dev server running with ENABLE_TEST_ROUTES=1?"
    fail "  - try:  just dev-test  (in another terminal)"
    exit 1
  fi

  # Find UDID: first available device matching name (+ optional runtime filter).
  local list
  list="$(xcrun simctl list devices available "$SIM_DEVICE")"
  local udid
  if [ -n "$SIM_RUNTIME_FILTER" ]; then
    udid="$(printf '%s' "$list" | grep -A 200 -- "$SIM_RUNTIME_FILTER" | grep -oE '[A-F0-9-]{36}' | head -1)"
  else
    udid="$(printf '%s' "$list" | grep -oE '[A-F0-9-]{36}' | head -1)"
  fi
  if [ -z "$udid" ]; then
    fail "no available simulator matching '$SIM_DEVICE' (runtime: ${SIM_RUNTIME_FILTER:-any})"
    fail "  - run:  xcrun simctl list devices available"
    exit 1
  fi
  SIM_UDID="$udid"
  log "using simulator: $udid"

  xcrun simctl boot "$udid" 2>/dev/null || true
  open -a Simulator
  sleep 4

  # Kill any stray flutter run from a previous failed run, then start fresh.
  # iOS simulator debug builds REQUIRE flutter_tool attached to deliver the
  # Dart kernel — `simctl install + launch` alone leaves the app blank.
  pkill -f "flutter run.*$udid" 2>/dev/null || true
  xcrun simctl uninstall "$udid" "$BUNDLE_ID" 2>/dev/null || true
  sleep 1

  log "starting flutter run on $SIM_DEVICE (initial build can take ~1 min)"
  (cd "$ROOT_DIR/apps/mobile" && flutter run --no-hot -d "$udid") \
    > "$LOG_FILE" 2>&1 &
  LOG_PID=$!
  trap "kill -INT $LOG_PID 2>/dev/null; sleep 1; kill -TERM $LOG_PID 2>/dev/null; pkill -f 'flutter run.*$udid' 2>/dev/null || true" EXIT

  # Wait for the Dart VM to be alive (signals app boot is past kernel load).
  local elapsed=0
  while [ "$elapsed" -lt 90 ]; do
    if grep -qF "Dart VM Service" "$LOG_FILE" 2>/dev/null; then
      log "flutter run ready (${elapsed}s)"
      sleep 2
      return 0
    fi
    sleep 2
    elapsed=$((elapsed+2))
  done
  fail "flutter run never became ready in 90s; see $LOG_FILE"
  exit 1
}

# ---- Phase 1: cold launch ----
# Pre-flight already started flutter run, which builds + installs + launches.
# Just verify the landing screen rendered (boot log fired).
phase_cold() {
  log "==== Phase 1: cold launch ===="
  sleep 2
  screenshot "01-landing"
  local ok=true
  assert_log "[smoke] [boot] cold launch landing" 30 || ok=false

  if $ok; then
    RES_COLD="passed"; log "Phase 1 PASSED"
  else
    RES_COLD="failed"; log "Phase 1 FAILED"
  fi
}

# ---- Phase 2: QR handoff (URL scheme) ----
phase_qr() {
  log "==== Phase 2: QR handoff ===="
  local body token
  body="$(curl -fsSL "$WEB_BASE/api/test/qr-token/$DEMO_SLUG" || true)"
  token="$(printf '%s' "$body" | jq -r '.token // empty')"
  if [ -z "$token" ]; then
    fail "QR token mint failed (body=$body)"
    RES_QR="failed"
    return 0
  fi
  log "minted QR token"

  xcrun simctl openurl booted "pilalang://r/$DEMO_SLUG?t=$token"
  sleep 3
  screenshot "02-qr-join"

  local ok=true
  assert_log "[smoke] [deeplink] received" 15 || ok=false
  assert_log "[smoke] [deeplink] navigated to /r/$DEMO_SLUG" 15 || ok=false

  if $ok; then
    RES_QR="passed"; log "Phase 2 PASSED"
  else
    RES_QR="failed"; log "Phase 2 FAILED"
  fi
}

# ---- Phase 3: push -> deep link ----
phase_push() {
  log "==== Phase 3: push -> deep link ===="
  local body pid
  body="$(curl -fsSL -X POST -H 'Content-Type: application/json' \
    -d "{\"slug\":\"$DEMO_SLUG\",\"isDemo\":true,\"waitingParties\":[{\"name\":\"Smoke\",\"partySize\":2,\"phone\":\"+911000000001\",\"minutesAgo\":1}]}" \
    "$WEB_BASE/api/test/setup-tenant" || true)"
  pid="$(printf '%s' "$body" | jq -r '.partyIds[0] // empty')"
  if [ -z "$pid" ]; then
    fail "setup-tenant did not return a partyId (body=$body)"
    RES_PUSH="failed"
    return 0
  fi
  log "seeded waiting party: $pid"

  local payload="$RUN_DIR/payload.apns"
  cat > "$payload" <<EOF
{
  "Simulator Target Bundle": "$BUNDLE_ID",
  "aps": {
    "alert": { "title": "Your table is ready", "body": "Tap to see your spot." },
    "sound": "default"
  },
  "deeplink": "pilalang://r/$DEMO_SLUG/wait/$pid"
}
EOF

  # Verify delivery: simctl push hands the payload off to APNs Sim.
  if ! xcrun simctl push booted "$BUNDLE_ID" "$payload"; then
    fail "simctl push failed"
    RES_PUSH="failed"
    return 0
  fi
  sleep 1
  screenshot "03-push-delivered"

  # Stand-in for "user tapped banner": invoke the payload's deeplink directly.
  # The real onMessageOpenedApp path (FCM tap dispatch) requires notification
  # permission to be granted, which on simulator only happens after the user
  # completes the join flow (PushCoordinator.maybeRegister). Driving that
  # would require cliclick text entry into the join form — out of v1 scope.
  # Verifying the deeplink in the payload routes correctly is the honest
  # check we can make end-to-end here.
  log "simulating banner tap via openurl (FCM path requires granted perms)"
  xcrun simctl openurl booted "pilalang://r/$DEMO_SLUG/wait/$pid"
  sleep 3
  screenshot "04-wait-screen"

  local ok=true
  assert_log "[smoke] [deeplink] navigated to /r/$DEMO_SLUG/wait/$pid" 15 || ok=false
  http_probe_party "$pid" "waiting" || ok=false

  if $ok; then
    RES_PUSH="passed"; log "Phase 3 PASSED"
  else
    RES_PUSH="failed"; log "Phase 3 FAILED"
  fi
}

# ---- Main ----
preflight

case "$PHASE" in
  cold) phase_cold ;;
  qr)   phase_qr ;;
  push) phase_push ;;
  all)
    phase_cold || true
    phase_qr   || true
    phase_push || true
    ;;
  *) fail "unknown phase: $PHASE (cold|qr|push|all)"; exit 64 ;;
esac

# ---- Summary ----
echo
log "==== Summary ===="
printf '  cold:  %s\n' "$RES_COLD"
printf '  qr:    %s\n' "$RES_QR"
printf '  push:  %s\n' "$RES_PUSH"
log "screenshots + logs: $RUN_DIR"

if [ "$RES_COLD" = "failed" ] || [ "$RES_QR" = "failed" ] || [ "$RES_PUSH" = "failed" ]; then
  exit 1
fi
exit 0
