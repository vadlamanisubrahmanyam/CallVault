# CallVault v0.1

A single-screen Android app to record phone calls (and, in Phase 2,
WhatsApp calls) with contact-based filenames, stored in local app storage.

## What works in v0.1

- Master on/off + per-channel (Phone / WhatsApp) toggles
- Real native phone-call detection via `TelephonyManager` broadcasts
- Mic-based recording for the duration of a call, saved as `.m4a`
- Contact name resolution via the device's contact list (falls back to
  the raw number if not found)
- Filename convention: `YYYY-MM-DD_HHMM_ContactName_Channel.m4a`
- Single-screen UI: controls + live-recording banner + searchable/filterable
  recordings list, with play / share / delete
- GitHub Actions workflow that produces a downloadable debug APK on every
  push to `main` — no EAS account, no Apple Developer account, no local
  Android Studio needed

## What's stubbed / not real yet

- **WhatsApp call recording** — toggle exists, does nothing yet. See
  `PHASE2_WHATSAPP.md` for the planned approach (NotificationListenerService).
- **Outgoing call number capture** — the receiver currently reads the
  incoming-call number from the broadcast extra; outgoing calls need the
  `NEW_OUTGOING_CALL` flow (deprecated on newer Android, so this needs a
  content-observer-on-call-log fallback) — flagged as a known gap, not
  wired up in this build.

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
