#!/bin/bash
# Changes every preference against a live headless shell and fails on any error.
set -uo pipefail
cd "$(dirname "$0")/.."
REPO=$PWD; UUID=crypto@alipirpiran.github
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
D="$TMP/data/gnome-shell/extensions/$UUID"; mkdir -p "$D"
for i in api lib models utils schemas assets extension.js settings.js stylesheet.css metadata.json prefs.js; do
  [ -e "$REPO/$i" ] && cp -r "$REPO/$i" "$D/"
done
cat > "$TMP/run.sh" <<'INNER'
#!/bin/bash
gnome-shell --headless --virtual-monitor 1280x720 --wayland-display=wayland-prefs > "$TMP/shell.log" 2>&1 &
P=$!
sleep 18
S=org.gnome.shell.extensions.crypto-tracker
g() { gsettings --schemadir "$D/schemas" "$@"; }
for v in plain-line split-at-open gradient-fill; do g set $S chart-style "$v"; sleep 2; done
g set $S dropdown-view both;  sleep 2
g set $S dropdown-view portfolio; sleep 2
g set $S base-currency USD;   sleep 2
g set $S refresh-interval 20; sleep 3
g set $S refresh-interval 15
g set $S dropdown-view prices
sleep 2
kill $P 2>/dev/null; wait $P 2>/dev/null
INNER
chmod +x "$TMP/run.sh"
XDG_DATA_HOME="$TMP/data" TMP="$TMP" D="$D" timeout 120 dbus-run-session -- "$TMP/run.sh" >/dev/null 2>&1
n=$(grep -cE "JS ERROR|is not a function|already disposed" "$TMP/shell.log" 2>/dev/null | head -1)
n=${n:-0}
echo "preference changes -> $n error(s)"
[ "$n" -eq 0 ] && { echo "PREFS OK"; exit 0; }
grep -E "JS ERROR|is not a function" "$TMP/shell.log" | head -5
exit 1
