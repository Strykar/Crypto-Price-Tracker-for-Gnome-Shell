#!/bin/bash
# Headless load test with its own XDG_DATA_HOME, so the real install is untouched.
set -uo pipefail
cd "$(dirname "$0")/.."
REPO=$PWD
UUID=crypto@alipirpiran.github

TMP=$(mktemp -d)
[ -n "${SHELLTEST_KEEP:-}" ] && echo "keeping $TMP" || trap 'rm -rf "$TMP"' EXIT
EXT="$TMP/data/gnome-shell/extensions/$UUID"
mkdir -p "$EXT"

for item in api lib models utils schemas assets extension.js settings.js stylesheet.css metadata.json; do
  [ -e "$REPO/$item" ] && cp -r "$REPO/$item" "$EXT/"
done

cat > "$TMP/probe.sh" <<'INNER'
#!/bin/bash
gnome-shell --headless --virtual-monitor 1280x720 --wayland-display=wayland-shelltest > "$TMP/shell.log" 2>&1 &
SHELL_PID=$!
for _ in $(seq 1 40); do
  gdbus call --session -d org.gnome.Shell -o /org/gnome/Shell \
    -m org.gnome.Shell.Extensions.GetExtensionInfo "$UUID" >/dev/null 2>&1 && break
  sleep 1
done
gdbus call --session -d org.gnome.Shell -o /org/gnome/Shell \
  -m org.gnome.Shell.Extensions.GetExtensionInfo "$UUID" > "$TMP/info.txt" 2>&1
sleep 20
kill $SHELL_PID 2>/dev/null; wait $SHELL_PID 2>/dev/null
INNER
chmod +x "$TMP/probe.sh"

XDG_DATA_HOME="$TMP/data" TMP="$TMP" UUID="$UUID" \
  timeout 120 dbus-run-session -- "$TMP/probe.sh" >/dev/null 2>&1

# GetExtensionInfo is unreliable headless, so check the shell log instead.
enabled=$(grep -o "'enabled': <[a-z]*>" "$TMP/info.txt" 2>/dev/null | grep -o 'true\|false' | head -1)

if [ -z "$enabled" ]; then
  echo "SHELL TESTS FAILED: the shell never reported the extension at all"
  grep -iE "Could not load extension|Missing metadata" "$TMP/shell.log" 2>/dev/null | head -5
  exit 1
fi

# grep -c prints 0 AND exits 1 on no match, so never append "|| echo 0" here.
fails=$(grep -cE "Extension ${UUID}:|Could not load extension|JS ERROR|already disposed|CLUTTER_IS_TEXT" \
        "$TMP/shell.log" 2>/dev/null | head -1)
fails=${fails:-0}

echo "enabled=$enabled  shell_log_failures=$fails"
if [ "$enabled" = "true" ] && [ "$fails" -eq 0 ]; then
  echo "SHELL TESTS OK"; exit 0
fi
echo "SHELL TESTS FAILED"
grep -E "Extension ${UUID}:|Could not load extension|JS ERROR|already disposed|CLUTTER_IS_TEXT" \
  "$TMP/shell.log" 2>/dev/null | head -10
exit 1
