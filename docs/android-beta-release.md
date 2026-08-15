# Releasing the reIS Android beta

The Capacitor app ships from the same repo and the same React tree as the
extension. Its version is **not** a second number to maintain: `android/app/build.gradle`
reads `package.json`, so `versionName` is the npm version and `versionCode` is
derived from it (`major*10000 + minor*100 + patch`, so `5.0.5` → `50005`).
Bumping `package.json` — which `/release` already does — bumps the app.

## One-time: create the signing key

**You have to run this yourself.** The password is a durable secret.

```bash
keytool -genkeypair -v -keystore ~/reis-upload-key.jks -alias reis-upload -keyalg RSA -keysize 4096 -validity 10000 -storetype PKCS12
```

### Which key is this, and what happens if it is lost

The name is not decoration: this is intended as the **Play upload key**, not as
the app-signing key. Uploading an AAB to a new app enrols it in **Play App
Signing**, where Google generates and holds the key that actually signs what
users install, and this `.jks` only proves to Play that an upload is from you.
Which of the two you are holding decides the recovery path, and they are not
close:

- **Play App Signing (what an AAB upload gives you).** A lost or compromised
  upload key is **recoverable**. Generate a new keystore, export its certificate
  with `keytool -export -rfc -keystore <new>.jks -alias reis-upload -file
  upload_certificate.pem`, and in the Play Console under *Play Store protection
  → Manage Play app signing* request an upload key reset with that PEM. Users
  are unaffected — the app-signing key never changed.
- **Sideloaded APKs** (`npm run android:apk`, what beta testers install
  directly) are signed by **this** key and nothing else, so for those installs
  it *is* the app-signing key. Sign a later APK with a different key and Android
  refuses it as an update (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`); every tester
  has to uninstall and log in to IS again.
- **Self-managed app signing** (opting out of Play App Signing, or a legacy
  APK-only listing) has **no recovery at all**. Lose the key and that listing can
  never be updated again.

So: back the `.jks` and its password up as if the third case were true, because
until the first AAB is uploaded and Play App Signing is confirmed in the Console,
you do not yet know that it isn't.

Then point the build at it. `android/keystore.properties` is gitignored:

```bash
cat > android/keystore.properties <<EOF
storeFile=$HOME/reis-upload-key.jks
storePassword=<the password you just chose>
keyAlias=reis-upload
EOF
```

`keyPassword` is optional — omit it and the store password is used, which is
what `-genkeypair` gives you unless you deliberately set a separate one.

After that:

1. Back the `.jks` up somewhere that is not this machine.
2. Put the password in Infisical alongside the other reIS secrets.

Or run `bash scripts/link-keystore.sh` instead of writing the file by hand: it
checks the password actually opens the keystore before writing anything, asks
for a separate key password only if the keystore turns out to need one, and
passes both to `keytool` through a file rather than a command-line argument
(where `ps` would show them to everyone on the machine).

CI can supply the same four values as `REIS_KEYSTORE_FILE`,
`REIS_KEYSTORE_PASSWORD`, `REIS_KEYSTORE_ALIAS`, `REIS_KEYSTORE_KEY_PASSWORD`
instead of the properties file. The last is optional — with a PKCS12 keystore,
which is what the `keytool` line above creates, the store password *is* the key
password. All four are the upload key's secrets, not Google's app-signing key,
which never leaves Play; a leak is repaired with the upload key reset described
above.

### With no key configured

`npm run android:apk` / `:aab` **refuse to run**: `scripts/android-release.mjs`
checks for `android/keystore.properties` or `REIS_KEYSTORE_FILE` first and exits
1 with a pointer back here, rather than spending three minutes in Gradle to
produce something nobody can install.

Reaching for Gradle directly (`cd android && ./gradlew assembleRelease`) skips
that check. The build then succeeds, unsigned, and Gradle names the output
`app-release-unsigned.apk` — the missing key shows up in the filename rather
than as a mysterious install failure on a tester's phone.

## Building

```bash
npm run android:apk
```

for a sideloadable APK, or

```bash
npm run android:aab
```

for a Play Console upload. Both run the web build, `cap sync`, and Gradle, then
verify the artifact; the APK path additionally prints the signing certificate.

The script resolves a JDK itself (there is no `java` on PATH on this machine —
it looks for `JAVA_HOME`, then `/opt/homebrew/opt/openjdk@21`, then Android
Studio's bundled JBR) and repairs the `capacitor.settings.gradle` rewrite that
`cap sync` performs inside a git worktree.

## Installing on a tester's phone

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

A tester without adb installs the APK file directly and has to allow "install
unknown apps" for whichever app delivered it.

**A debug build already on the phone must be uninstalled first.** It is signed
with the debug key, so Android refuses the release APK as an update
(`INSTALL_FAILED_UPDATE_INCOMPATIBLE`). Uninstalling clears the Keystore-backed
session token, so the tester logs in to IS once more. That is expected and only
happens on this one changeover.

## What a release build changes

- **No WebView remote debugging.** Capacitor enables it only for debuggable
  builds, so the Chrome DevTools Protocol technique used to verify this app on
  device does not work against a release APK. Verify behaviour on a debug build,
  then smoke-test the release one by hand.
- **`minifyEnabled` stays off.** Capacitor resolves native plugins by class name
  through reflection, so R8 strips `SecureStore`, `Downloads` and `Eduroam` — and
  the failure appears only in the release build, as "plugin is not implemented on
  android". Turning minification on needs keep-rules plus a device pass.

## Known gaps a beta tester will meet

- Campus events on the map come from the societies' own Supabase feed. If a
  society has published nothing, the Akce tab is genuinely empty — that is
  correct, not the old bug.
- Google Drive backup is not offered on mobile at all (it does not work there).
- eduroam setup is Android-only; the iOS half is not built.
- ISKAM opens in the browser rather than in-app: it is a separate Shibboleth
  login and is out of scope for this release.
