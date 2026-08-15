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
# It reaches keytool through `-storepass:file` rather than `-storepass`, because
# an argument is visible in `ps` to every other user on the machine for as long
# as the JVM runs.
set -euo pipefail

cd "$(dirname "$0")/.."

# Every password this script handles lives in this directory and nowhere else.
# mktemp -d gives 0700, so nothing readable is ever exposed even briefly, and
# the trap covers the error exits below as well as the successful one.
PWDIR="$(mktemp -d)"
trap 'rm -rf "$PWDIR"' EXIT

# Java's Properties format treats \ as an escape, so a password containing one
# would be silently mangled on read. Escape it on the way in.
escape_property() {
  local escaped="${1//\\/\\\\}"
  # Leading whitespace is stripped by Properties.load, so " hunter2" arrives as
  # "hunter2" and Gradle fails to open a keystore with a password the human is
  # certain is right. Escaping each leading space or tab preserves it — the same
  # thing java.util.Properties.store does on the way out. Only the LEADING run
  # is skipped, so trailing whitespace needs nothing.
  #
  # This half matters more now that the read is lossless: `IFS= read` keeps the
  # leading space that the old `read` silently trimmed, so without escaping here
  # the password reaches the file intact and is then mangled on load.
  local out=''
  while [ -n "$escaped" ]; do
    case $escaped in
      ' '*) out+='\ '; escaped=${escaped# } ;;
      "$(printf '\t')"*) out+='\\t'; escaped=${escaped#?} ;;
      *) break ;;
    esac
  done
  printf '%s%s' "$out" "$escaped"
}

KEYSTORE="${1:-$HOME/reis-upload-key.jks}"
ALIAS="${2:-reis-upload}"
OUT="android/keystore.properties"

if [ ! -f "$KEYSTORE" ]; then
  echo "No keystore at $KEYSTORE" >&2
  echo "Create one first — see docs/android-beta-release.md" >&2
  exit 1
fi

# storeFile MUST be absolute in the properties file. This script resolves a
# relative argument against the repo root (it cd'd there above), but
# android/app/build.gradle resolves `file(props['storeFile'])` against
# android/app — so `link-keystore.sh keys/upload.jks` would verify a keystore
# here and hand Gradle a path three directories away. It fails at
# :app:packageRelease, which is the failure this script exists to move earlier.
KEYSTORE="$(cd "$(dirname "$KEYSTORE")" && pwd)/$(basename "$KEYSTORE")"

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
# IFS= — the default strips leading and trailing whitespace, so a password that
# starts or ends with a space would be silently altered here and then fail
# verification below with no hint as to why.
IFS= read -rs PW
printf '\n'

if [ -z "$PW" ]; then
  echo "Empty password — nothing written." >&2
  exit 1
fi

STOREPASS_FILE="$PWDIR/store"
printf '%s' "$PW" >"$STOREPASS_FILE"

if ! "$KEYTOOL" -list -keystore "$KEYSTORE" -storepass:file "$STOREPASS_FILE" -alias "$ALIAS" \
  >/dev/null 2>&1; then
  echo >&2
  echo "That password does not open $KEYSTORE (or alias '$ALIAS' is not in it)." >&2
  echo "Nothing was written. Re-run and try again." >&2
  exit 1
fi

# `keytool -list` proves the STORE password and the alias. It says nothing about
# the private key's own password, and Gradle falls back to storePassword when
# keyPassword is absent — so a keystore with two different passwords would still
# fail, three minutes into :app:packageRelease, which is the exact failure this
# script exists to move forward. `-certreq` needs the private key, so it is the
# cheapest operation that actually exercises the key password.
#
# PKCS12 (what docs/android-beta-release.md tells you to create) cannot hold a
# separate key password at all — keytool warns and ignores -keypass — so this
# probe passes immediately there and nothing extra is asked. It matters for a
# JKS keystore created elsewhere.
key_opens_with() {
  "$KEYTOOL" -certreq -keystore "$KEYSTORE" -alias "$ALIAS" \
    -storepass:file "$STOREPASS_FILE" -keypass:file "$1" >/dev/null 2>&1
}

KEYPASS_ESCAPED=""
if ! key_opens_with "$STOREPASS_FILE"; then
  echo
  echo "The store password does not unlock the private key — this keystore uses a"
  echo "separate key password."
  printf 'Private key password for alias %s: ' "$ALIAS"
  IFS= read -rs KEYPW
  printf '\n'

  KEYPASS_FILE="$PWDIR/key"
  printf '%s' "$KEYPW" >"$KEYPASS_FILE"
  if ! key_opens_with "$KEYPASS_FILE"; then
    echo >&2
    echo "That key password does not unlock alias '$ALIAS'." >&2
    echo "Nothing was written. Re-run and try again." >&2
    exit 1
  fi
  KEYPASS_ESCAPED="$(escape_property "$KEYPW")"
fi

# Written to a fresh 0600 file and renamed into place, NOT redirected onto $OUT.
# `umask 077` governs the mode of a file it CREATES; redirecting into a
# keystore.properties that already exists truncates it and keeps whatever mode
# it had, so a previously world-readable file would quietly receive the signing
# password. The temp file is a sibling so the rename stays on one filesystem and
# is therefore atomic — no window where the file is half-written.
umask 077
TMP_OUT="$(mktemp "$(dirname "$OUT")/.keystore.properties.XXXXXX")"
trap 'rm -rf "$PWDIR"; rm -f "$TMP_OUT"' EXIT
chmod 600 "$TMP_OUT"
{
  printf 'storeFile=%s\n' "$KEYSTORE"
  printf 'storePassword=%s\n' "$(escape_property "$PW")"
  printf 'keyAlias=%s\n' "$ALIAS"
  # Omitted when it equals the store password: build.gradle already falls back,
  # and a second copy of the same secret on disk is a second thing to leak.
  # Written as an `if` rather than `[ … ] && printf`, whose false branch would
  # be the group's exit status and would trip `set -e`.
  if [ -n "$KEYPASS_ESCAPED" ]; then printf 'keyPassword=%s\n' "$KEYPASS_ESCAPED"; fi
} >"$TMP_OUT"
mv "$TMP_OUT" "$OUT"

echo "Password verified. Wrote $OUT (gitignored, mode 600)."
echo "Now run:  npm run android:aab"
