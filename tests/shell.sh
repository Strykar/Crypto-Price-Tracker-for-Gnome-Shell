#!/bin/bash
# Runs tests/shell/cases.js in a headless gnome-shell with its own
# XDG_DATA_HOME, so the real install is never touched.
set -uo pipefail
cd "$(dirname "$0")/.."
REPO=$PWD
UUID=crypto@alipirpiran.github
PROBE=crypto-shelltest@local

TMP=$(mktemp -d)
[ -n "${SHELLTEST_KEEP:-}" ] && echo "keeping $TMP" || trap 'rm -rf "$TMP"' EXIT
EXT="$TMP/data/gnome-shell/extensions/$UUID"
P="$TMP/data/gnome-shell/extensions/$PROBE"
mkdir -p "$EXT" "$P"

for item in api lib models utils schemas assets extension.js settings.js stylesheet.css metadata.json; do
  [ -e "$REPO/$item" ] && cp -r "$REPO/$item" "$EXT/"
done
cp "$REPO/tests/shell/metadata.json" "$REPO/tests/shell/extension.js" "$REPO/tests/shell/cases.js" "$P/"

COINS='{"coins":[
 {"id":"1","symbol":"BTC/USD","exchange":"coingecko","title":"BTC","active":true,"amount":0.12,"coingecko_id":"bitcoin"},
 {"id":"2","symbol":"ETH/USD","exchange":"coingecko","title":"ETH","active":true,"amount":1.15,"coingecko_id":"ethereum"},
 {"id":"3","symbol":"SOL/USD","exchange":"coingecko","title":"SOL","active":true,"amount":4.75,"coingecko_id":"solana"},
 {"id":"4","symbol":"BTC/USDT","exchange":"binance","title":"BTCt","active":true,"amount":0},
 {"id":"5","symbol":"ETH/USDT","exchange":"binance","title":"ETHt","active":false,"amount":0}]}'

cat > "$TMP/probe.sh" <<'INNER'
#!/bin/bash
GSETTINGS_SCHEMA_DIR="$EXT/schemas" gsettings set org.gnome.shell.extensions.crypto-tracker coins "$COINS"
GSETTINGS_SCHEMA_DIR="$EXT/schemas" gsettings set org.gnome.shell.extensions.crypto-tracker base-currency 'USD'
GSETTINGS_SCHEMA_DIR="$EXT/schemas" gsettings set org.gnome.shell.extensions.crypto-tracker dropdown-view 'portfolio'
gsettings set org.gnome.shell disable-user-extensions false
gsettings set org.gnome.shell enabled-extensions "['$UUID', '$PROBE']"
gnome-shell --headless --virtual-monitor 1280x720 --wayland-display=wayland-shelltest > "$TMP/shell.log" 2>&1 &
SHELL_PID=$!
for _ in $(seq 1 45); do
  grep -q 'SHELLTEST DONE' "$TMP/shell.log" 2>/dev/null && break
  sleep 1
done
kill $SHELL_PID 2>/dev/null; wait $SHELL_PID 2>/dev/null
INNER
chmod +x "$TMP/probe.sh"

XDG_DATA_HOME="$TMP/data" TMP="$TMP" EXT="$EXT" UUID="$UUID" PROBE="$PROBE" COINS="$COINS" \
  timeout 180 dbus-run-session -- "$TMP/probe.sh" >/dev/null 2>&1

grep -o 'SHELLTEST.*' "$TMP/shell.log" | sed 's/^SHELLTEST //' | grep -v '^DONE'

done_line=$(grep -o 'SHELLTEST DONE .*' "$TMP/shell.log" | tail -1)
if [ -z "$done_line" ]; then
  echo
  echo "SHELL TESTS FAILED: the probe never reported. Shell log:"
  grep -iE "Extension|Could not load|JS ERROR" "$TMP/shell.log" | head -10
  exit 1
fi

read -r _ _ passed failed <<< "$done_line"

# GetExtensionInfo is unreliable headless, so check the shell log instead.
# grep -c prints 0 AND exits 1 on no match, so never append "|| echo 0".
disposed=$(grep -cE "already disposed|is disposed|CLUTTER_IS_TEXT|JS ERROR|Extension ${UUID}:|Could not load extension" "$TMP/shell.log" 2>/dev/null | head -1)
disposed=${disposed:-0}
if [ "$disposed" -gt 0 ]; then
  echo "FAIL | the shell logged $disposed extension errors during the run"
  grep -E "already disposed|is disposed|CLUTTER_IS_TEXT|JS ERROR|Extension ${UUID}:|Could not load extension" "$TMP/shell.log" | head -5 | sed 's/^/     |   /'
  failed=$((failed + 1))
fi

echo
echo "$passed passed, $failed failed"
[ "$failed" -eq 0 ] || exit 1
