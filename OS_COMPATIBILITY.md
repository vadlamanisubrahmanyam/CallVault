# OS compatibility — Android 9 through Android 16

Target range: **minSdkVersion 28 (Android 9)** to whatever the newest
device is — currently verified conceptually up to **Android 16**, though
see the caveat at the bottom.

## Build settings (via expo-build-properties, in app.json)

| Setting | Value | Why |
|---|---|---|
| `minSdkVersion` | 28 (Android 9) | Matches the oldest target device (Nokia 8) exactly — no lower support needed or claimed |
| `targetSdkVersion` | 34 (Android 14) | Matches what Expo SDK 51 / React Native 0.74 was actually built and tested against. Android's compatibility model means an app targeting 34 runs fine on newer OS versions (15, 16, ...) under that target's behavior contract — it does **not** need to target the device's own OS version to run on it. Forcing target 35/36 would opt into newer, untested-by-Expo-51 behavior changes for no functional benefit here. |
| `compileSdkVersion` | 35 (Android 15) | Builds against a newer platform/toolchain than the runtime target, for forward compatibility, without changing the app's declared behavior contract |

CI explicitly installs `platforms;android-35` and matching build-tools
rather than relying on whatever happens to be preinstalled on the GitHub
Actions runner, so the build doesn't quietly start failing if the default
image changes.

## What's already handled at each OS version boundary

| Android version (API) | What changed | How this app handles it |
|---|---|---|
| 8.0 Oreo (26) | Background execution limits; notification channels required | `NotificationChannel` creation and `startForegroundService` are both guarded with `Build.VERSION.SDK_INT >= Build.VERSION_CODES.O` |
| 9 Pie (28) | `FOREGROUND_SERVICE` permission formalized | Declared in manifest; this is the app's floor version (Nokia 8) |
| 11 (30) | Package visibility restrictions | Not triggered — we don't query other apps' packages except by fixed, known package name (`com.whatsapp`), which doesn't require a `<queries>` declaration since we're not enumerating installed apps |
| 12 (31) | Every manifest component with an intent-filter must explicitly declare `android:exported` | Done for all three components (`CallStateReceiver`, `RecordingForegroundService`, `WhatsAppCallListenerService`) |
| 13 Tiramisu (33) | Runtime permission required to post any notification (`POST_NOTIFICATIONS`) | Requested at runtime alongside the other permissions, conditionally (`Platform.Version >= 33`) |
| 14 UpsideDownCake (34) | Foreground services with `foregroundServiceType="microphone"` require `RECORD_AUDIO` to already be granted *before* the service starts, or it throws | `RecordingForegroundService` checks this permission both before being started and again on `onStartCommand`, failing quietly (`stopSelf()`) instead of crashing if it's somehow missing |
| 15 (35) | Stricter background-start rules for foreground services in some contexts | Not an issue here — both our start triggers (a manifest-registered phone-state broadcast, and a bound `NotificationListenerService` callback) are among the contexts Android continues to allow to start a foreground service |
| 16 | Unconfirmed specifics | See caveat below |

## Known caveat

Android 16 is very recent relative to when this app's dependencies
(Expo SDK 51, React Native 0.74) were built, and its specific behavior
changes aren't something I can verify with confidence from here. The
version floor/ceiling choices above are deliberately conservative — built
against a newer SDK, but targeting a well-tested one — specifically to
minimize the chance of hitting an unverified edge case on the newest OS.

If something does behave oddly specifically on the Android 16 device (and
not on the Nokia 8), that's the first thing worth isolating — send a
logcat from that device and we'll chase it down same as any other bug.
