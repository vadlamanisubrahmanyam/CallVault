# CallVault v0.4.1

A single-screen Android app to record phone calls and WhatsApp calls, with
contact-based filenames, stored in local app storage.

## What works in v0.3

- Single master on/off switch — no per-channel toggles; both call types
  record automatically whenever it's on and the relevant permission is granted
- Real native phone-call detection via `TelephonyManager` broadcasts
- Real WhatsApp call detection via a `NotificationListenerService`
  watching WhatsApp's ongoing-call notification (see `PHASE2_WHATSAPP.md`
  for how it works and its limitations — it's real, but heuristic-based)
- Mic-based recording for the duration of a call, saved as `.m4a`
- Contact name resolution: from the device's contact list for phone calls,
  directly from the notification title for WhatsApp calls
- Filename convention: `YYYY-MM-DD_HHMM_ContactName_Channel.m4a`
- Single-screen UI: controls + live-recording banner + searchable/filterable
  recordings list, with play / share / delete
- Signed release APK via GitHub Actions on every push to `main` — no EAS
  account, no Apple Developer account, no local Android Studio needed

## What's still a known gap

- **Outgoing call number capture** — the receiver currently reads the
  incoming-call number from the broadcast extra; outgoing native calls
  need the `NEW_OUTGOING_CALL` flow (deprecated on newer Android, so this
  needs a content-observer-on-call-log fallback) — not wired up yet.
- **No retention/auto-delete policy** — recordings accumulate until
  manually deleted.

## v0.4 → v0.4.1 changelog (build fix)

- **Fixed:** the v0.4 change to `compileSdkVersion: 35` broke the build.
  It's a real regression, not a device-specific issue — the compile
  error was inside Expo's own `expo-modules-core` (1.12.0) bundled
  source, which a newer Kotlin toolchain compiles more strictly than the
  version that library was actually written against. Reverted to
  `compileSdkVersion: 34` (matching `targetSdkVersion`), and pinned
  `kotlinVersion: "1.9.24"` explicitly so this can't silently regress
  again. This has no effect on whether the app runs on Android 15/16 —
  see OS_COMPATIBILITY.md for why.

## OS compatibility

Supports Android 9 (Nokia 8) through the newest devices, with
`minSdkVersion 28`, `targetSdkVersion 34`, `compileSdkVersion 35`. See
`OS_COMPATIBILITY.md` for exactly what's handled at each Android version
boundary and why those specific numbers were chosen.

## v0.3 → v0.4 changelog

- **Set explicit SDK version floor/ceiling** via `expo-build-properties`
  (`minSdkVersion 28`, `targetSdkVersion 34`, `compileSdkVersion 35`)
  instead of relying on Expo's defaults, to make the supported OS range
  an explicit decision rather than an accident of template defaults.
- **Hardened CI** to explicitly install the Android SDK platform and
  build tools it needs, rather than depending on whatever happens to be
  preinstalled on the GitHub Actions runner.
- **Audited every OS-version-gated code path** (foreground services,
  notification channels, exported components, runtime permissions) across
  Android 9–15 and documented it in `OS_COMPATIBILITY.md`. No behavior
  changes were needed — the guards added in v0.3 already covered this
  correctly; this pass was verification, not new fixes.

## v0.2 → v0.3 changelog

- **Removed:** all mock/dummy recordings and the "native module not
  linked" dev banner from the UI. If the native module genuinely isn't
  linked, the app now just shows an empty recordings list and non-working
  buttons rather than fake data — a real problem should look broken, not
  like a demo.
- **Simplified:** one master switch now controls both Phone and WhatsApp
  recording — no more separate per-channel toggles. WhatsApp detection
  still depends on Notification Access being granted, which is now
  surfaced as a permission-status row instead of a feature toggle.
- **Fixed:** the app never actually requested Android's runtime
  permissions (microphone, phone state, contacts) — they were declared in
  the manifest but never prompted for, meaning real devices had them
  denied by default. The app now requests them on launch and shows a
  "Setup needed" checklist for anything still missing.
- **Fixed:** the WhatsApp "Open Settings" button silently doing nothing —
  the underlying call is now a plain synchronous function with explicit
  success/failure feedback (an alert with manual instructions if the
  Settings screen can't be opened) instead of a fire-and-forget async call.
- **Hardened:** the recording service now checks for the microphone
  permission itself before starting a microphone-type foreground service —
  on Android 14+, doing this without the permission already granted
  throws immediately and would have crashed the app during a real call.
- **Added:** "Display over other apps" permission request, with a
  Settings deep-link in the permissions checklist (reserved for a future
  in-call overlay; not yet used elsewhere).

## v0.1 → v0.2 changelog

- **Fixed:** `call-recorder` native module was never actually linked into
  the build (missing `file:./modules/call-recorder` dependency in
  `package.json`) — this is why the installed app was silently running in
  mock/"demo mode" instead of really recording anything.
- **Fixed:** module's `android/build.gradle` referenced a placeholder
  Gradle plugin that doesn't exist; replaced with the real Expo local-module
  template.
- **Added:** real WhatsApp call detection (previously a UI stub).
- **Added:** release-mode build + self-signed keystore, since debug APKs
  crash on launch without a live Metro server.
- **Added:** app icon (shield + handset mark).

## Read this before you rely on it

- **Android blocks direct call-audio capture.** This app records via the
  device microphone while a call is active, not by tapping the actual
  call audio stream (that path is blocked by SELinux policy on modern
  Android for non-system apps). Audio quality depends heavily on whether
  the call is on speakerphone — the app should nudge for this at call
  start (UI banner in place; an actual in-call overlay reminder is a
  reasonable v0.2 addition).
- **`PHONE_STATE` manifest-registered broadcast reliability varies by
  Android version and OEM.** Test on your actual device (Nokia 8) early —
  some manufacturers apply additional battery-optimization restrictions
  that can kill the receiver or the foreground service. If recordings
  silently stop starting, check the OEM's battery/auto-start settings
  first.
- **Legal**: call-recording consent laws vary by state/country. Check
  local law before recording calls with others, especially anyone outside
  the household.

## Local development

This project requires a native build — it will **not** work inside Expo
Go, because of the custom `call-recorder` native module. Use one of:

```bash
npm install
npx expo prebuild --platform android
npx expo run:android      # needs Android SDK + a connected device/emulator
```

Or skip local native tooling entirely and let GitHub Actions build it:

```bash
git add .
git commit -m "CallVault v0.1"
git push origin main
```

Then download the `CallVault-release-apk` artifact from the Actions run and
install via:

```bash
adb install -r app-release.apk
```

## First-run permissions checklist

On first launch, the app now actively requests (not just declares) the
standard runtime permissions:

1. Microphone (`RECORD_AUDIO`)
2. Phone state (`READ_PHONE_STATE`)
3. Contacts (`READ_CONTACTS`) — for filename resolution
4. Call log (`READ_CALL_LOG`)
5. Notifications (`POST_NOTIFICATIONS`, Android 13+) — for the persistent
   "Recording…" foreground-service notification

The foreground-service notification while recording is required by
Android, not optional — it cannot be hidden, since Android requires the
user to always be able to see that a microphone-using service is active.

Two more permissions have no runtime dialog and must be granted manually
via Settings — the app's "Setup needed" checklist deep-links to both:

- **Notification Access** — required for WhatsApp call detection.
- **Display over other apps** — requested per the app's design; not yet
  used by any feature, reserved for a possible future in-call overlay.

Anything still missing shows up as a "Setup needed" card on the main
screen with a Grant button per item, rather than failing silently.

## App icon

`assets/icon.png`, `assets/adaptive-icon.png`, and `assets/splash-icon.png`
are the app icon (a shield + phone-handset mark, with a small red dot for
"recording"). They're already wired into `app.json` (`icon`,
`android.adaptiveIcon`, `splash.image`) — `expo prebuild` picks them up
automatically, no extra Actions step needed. `assets/generate_icon.py`
regenerates them from scratch (via `cairosvg`) if you ever want to tweak
the colors or shape.

## Signing (release builds)

CI builds a **release** APK, not debug — a debug APK expects a live Metro
server for its JavaScript bundle and crashes immediately on launch when
installed standalone on a device. Release bundles the JS into the APK.

Release builds must be signed, so this project ships with a self-signed
keystore at `android-signing/release.keystore` (password `callvault123`,
alias `callvault`) and a config plugin (`plugins/withReleaseSigning.js`)
that wires it into `android/app/build.gradle` automatically on every
`expo prebuild`. This keystore is for personal sideloading only — never
use a keystore like this for a Play Store submission.

Because the signing key stays the same across builds, updating the app on
your phone (`adb install -r app-release.apk`) works without needing to
uninstall the previous version first.

## Storage location

Recordings are saved to app-specific external storage:
`Android/data/com.subrahmanyam.callvault/files/CallVault/Recordings/`

This is visible via any file manager without extra permissions on
Android 10+ (scoped storage), and is retained across app updates but
removed on uninstall.
