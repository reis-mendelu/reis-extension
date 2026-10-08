---
name: push-to-phone
description: Use when Dominik wants reIS on his Android phone — "put it on my phone", "load the test build on the Pixel", "install over wifi", "push this change to the connected android" — or when android:push reports "No phone reachable", INSTALL_FAILED_UPDATE_INCOMPATIBLE, or an unsigned APK.
---

# Push reIS to the phone

The phone always gets the **signed release APK**: the exact artifact testers
install. Never a debug build, live reload or a renamed dev package.
`npm run android:push` builds, installs over the existing reIS (keeping the
login) and launches it. With nothing on USB, it finds the phone over Wi-Fi by
itself.

## 1. Which code goes on the phone

| Dominik says | Build from |
|---|---|
| "this", "my change", a feature he's reviewing | the current worktree, as it is |
| "test", "the test build", "latest" | `origin/test`, in the reusable worktree below |

You can't just check out `test` in the current worktree, because that pulls
someone's branch out from under them. Use a dedicated worktree and reuse it:

```bash
W="$(git rev-parse --path-format=absolute --git-common-dir)/../.claude/worktrees/phone-test"
git fetch origin test
[ -d "$W" ] || git worktree add --detach "$W" origin/test
OLD=$(git -C "$W" rev-parse HEAD)
# The worktree is a build box and holds no one's work, so a hard reset is safe.
git -C "$W" reset -q --hard origin/test && git -C "$W" rev-parse --short HEAD
```

`git worktree add` skips the bootstrap hook, so the first run needs
`npm ci` in `$W`. After that, run it again only when the lockfile moved:
`git -C "$W" diff --quiet "$OLD" HEAD -- package-lock.json || (cd "$W" && npm ci)`.

"Test build" means `origin/test` HEAD, not the Play closed-testing build.

## 2. Before building, in the worktree you build from

`adb` isn't on PATH: `ADB=~/Library/Android/sdk/platform-tools/adb`.

- **Signing:** `android/keystore.properties` is gitignored, so each worktree
  needs its own copy. Copy one from a sibling worktree. Never print it.
  Without it the APK comes out unsigned.
  `find "$(git rev-parse --path-format=absolute --git-common-dir)/../.claude/worktrees" -maxdepth 3 -name keystore.properties`
- **Phone on the network:** first check which network the Mac is on, with
  `route -n get default | grep gateway`. The answer decides the route:

  | Mac's gateway | Network | Route |
  |---|---|---|
  | `10.99.x.x` | the Pixel's own hotspot (the gateway is the phone) | Plain `npm run android:push` if tcpip is still up since the last reboot. Otherwise: cable once, `npm run android:push -- --wifi`, unplug. |
  | `10.65.x.x` | eduroam | Cable only. |
  | anything else | home or other Wi-Fi | Wireless debugging; the script finds it via mDNS. |

  - **The hotspot never works with Wireless debugging.** Android opens the
    debugging port only on Wi-Fi the phone has *joined*. Even with the toggle
    on, nothing listens on the hotspot side. What works there is
    `adb tcpip 5555`, which listens on every interface but can only be
    switched on over USB, and it resets when the phone reboots. After that,
    plain `android:push` finds the phone at `<gateway>:5555` on its own.
    Verified on 2026-10-08.
  - **eduroam isolates clients.** Even with the phone's IPv4 and port from
    the Wireless debugging screen, the Mac gets no answer, not even a ping.
    Don't ask for the address, and never scan the subnet (that probes
    strangers' devices). Ask for the cable.
  - With a cable coming, run a background loop that waits for
    `$ADB devices | grep -cE '\tdevice$'` and then runs `android:push`. Then
    `$ADB -s <usb serial> tcpip 5555` on a hotspot, so he can unplug.
- **First time with a phone:** have him tap "Pair device with pairing code",
  then run `npm run android:push -- --pair <ip:port> <code>`. A phone already
  authorised over USB needs no pairing.

Never hardcode `ip:port`. The port changes every time Wireless debugging is
toggled, and the script discovers it. Run `$ADB devices -l` first: when
something other than his phone is listed, like an emulator or a second phone,
set `ANDROID_SERIAL` to the phone for that run. If discovery fails but `$ADB
mdns services` lists the phone, `$ADB connect <ip:port>` it by hand and rerun.

## 3. Push

```bash
npm run android:push
```

The script's last line names the serial it installed on; use it below.

| Failure | Meaning and what to do |
|---|---|
| `No phone reachable` | Check the gateway table in step 2 first. On the hotspot or eduroam, toggling Wireless debugging won't help: ask for the cable. Elsewhere, Wireless debugging is off or the phone is on a different network, so ask him to toggle it. |
| `device offline` / `not found` at install | adb lost the phone during a long cold build. Rerun; the warm build takes seconds. |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | A Play install is on the phone. Replacing it means uninstalling: he gets signed out and the phone stops getting Play updates. **Ask first, every time.** |
| `Command failed: ./gradlew …` with null output | The script hides Gradle's output. Rerun from `android/` with `ANDROID_HOME=~/Library/Android/sdk JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home ./gradlew assembleRelease`. |

## 4. Prove it

"Installed and launched" isn't proof. Check all four:
- `lastUpdateTime` is now: `$ADB -s <serial> shell dumpsys package cz.reis.app | grep lastUpdateTime`
- `$ADB -s <serial> shell pidof cz.reis.app` returns a pid
- `$ADB -s <serial> logcat -d -b crash` shows nothing for `cz.reis.app` since the install
- a screenshot (`$ADB -s <serial> exec-out screencap -p > <scratchpad>/phone.png`).
  Read it: it shows whether he's still signed in, or on the IS login. Send it
  with SendUserFile.

Report one line: which commit (the hash from step 1, or the branch head, with
`+dirty` if uncommitted work went in), which phone, and whether he's still
signed in.
