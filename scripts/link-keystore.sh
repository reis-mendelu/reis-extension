#!/usr/bin/env bash
# Point the Android release build at an existing signing keystore.
#
#   bash scripts/link-keystore.sh
#
# Prompts for the keystore password, VERIFIES it actually opens the keystore,
# and only then writes android/keystore.properties. Writing the file first and
# discovering the password is wrong at :app:packageRelease — three minutes into
# a Gradle run — is the failure this exists to prevent.
#
# The password is read with `read -s`, so it is never echoed and never lands in
# shell history the way an inline `printf '...storePassword=hunter2...'` would.
set -euo pipefail

cd "$(dirname "$0")/.."

KEYSTORE="${1:-$HOME/reis-upload-key.jks}"
ALIAS="${2:-reis-upload}"
OUT="android/keystore.properties"

if [ ! -f "$KEYSTORE" ]; then
  echo "No keystore at $KEYSTORE" >&2
  echo "Create one first — see docs/android-beta-release.md" >&2
  exit 1
fi

# There is no `java` on PATH on this machine; find a JDK the same way
# scripts/android-release.mjs does.
KEYTOOL=""
for home in "${JAVA_HOME:-}" /opt/homebrew/opt/openjdk@21 /opt/homebrew/opt/openjdk@17 \
  "/Applications/Android Studio.app/Contents/jbr/Contents/Home"; do
  if [ -n "$home" ] && [ -x "$home/bin/keytool" ]; then KEYTOOL="$home/bin/keytool"; break; fi
done
if [ -z "$KEYTOOL" ]; then
  echo "No JDK found. Try: brew install openjdk@21" >&2
  exit 1
fi

printf 'Keystore: %s\nAlias:    %s\n\n' "$KEYSTORE" "$ALIAS"
printf 'Keystore password: '
read -rs PW
printf '\n'

if [ -z "$PW" ]; then
  echo "Empty password — nothing written." >&2
  exit 1
fi

if ! "$KEYTOOL" -list -keystore "$KEYSTORE" -storepass "$PW" -alias "$ALIAS" >/dev/null 2>&1; then
  echo >&2
  echo "That password does not open $KEYSTORE (or alias '$ALIAS' is not in it)." >&2
  echo "Nothing was written. Re-run and try again." >&2
  exit 1
fi

# Java's Properties format treats \ as an escape, so a password containing one
# would be silently mangled on read. Escape it on the way in.
ESCAPED=${PW//\\/\\\\}

umask 077
{
  printf 'storeFile=%s\n' "$KEYSTORE"
  printf 'storePassword=%s\n' "$ESCAPED"
  printf 'keyAlias=%s\n' "$ALIAS"
} >"$OUT"

echo "Password verified. Wrote $OUT (gitignored, mode 600)."
echo "Now run:  npm run android:aab"
