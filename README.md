# CallVault v0.2

A single-screen Android app to record phone calls and WhatsApp calls, with
contact-based filenames, stored in local app storage.

## What works in v0.2

- Master on/off + per-channel (Phone / WhatsApp) toggles
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

On first launch, the app will need to request (Android will prompt at
runtime):

1. Microphone (`RECORD_AUDIO`)
2. Phone state (`READ_PHONE_STATE`)
3. Contacts (`READ_CONTACTS`) — for filename resolution
4. Notifications (`POST_NOTIFICATIONS`, Android 13+) — for the persistent
   "Recording…" foreground-service notification

The foreground-service notification while recording is required by
Android, not optional — it cannot be hidden, since Android requires the
user to always be able to see that a microphone-using service is active.

For WhatsApp recording, there's a fifth, manual step: turning the
WhatsApp toggle on in-app will prompt you to grant **Notification
Access** via a Settings deep-link, since Android has no runtime dialog
for this one (Settings → Apps → Special app access → Notification
access → CallVault → Allow).

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
