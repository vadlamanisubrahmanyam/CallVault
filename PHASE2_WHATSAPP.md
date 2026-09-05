# Phase 2 — WhatsApp call detection

Not implemented in v0.1. The toggle exists in the UI and shows a warning
when enabled, but has no effect yet. This file scopes the approach for
when we pick it up.

## Why it's harder than native calls

WhatsApp calls are VoIP and never touch `TelephonyManager`, so there is no
broadcast equivalent to `ACTION_PHONE_STATE_CHANGED` for them. There is
also no public WhatsApp API for call events.

## The only realistic approach: NotificationListenerService

WhatsApp posts an ongoing, non-dismissible notification while a call is
active ("Ongoing call" / "WhatsApp Voice Call"). A `NotificationListenerService`
can observe notifications from `com.whatsapp` (or `com.whatsapp.w4b` for
Business) appearing and disappearing, and use that as a proxy for
call start/end.

Trade-offs to accept going in:
- Requires the user to grant **Notification Access** in system settings —
  a separate, more sensitive permission than the ones this build already
  asks for, and one Android surfaces with its own warning dialog.
- Detection is via notification *text/package matching*, which is brittle
  — WhatsApp can change notification wording or channel IDs between app
  versions without warning, silently breaking detection until this code
  is updated.
- It cannot distinguish a voice call from a video call without deeper
  notification inspection, which may not always be reliable either.
- Audio capture is still mic-based (see main README) — this only solves
  *when* to start/stop recording, not *how* the audio is captured.

## Suggested implementation sketch

1. Add a `WhatsAppCallListenerService : NotificationListenerService`.
2. In `onNotificationPosted`, check `sbn.packageName == "com.whatsapp"` and
   match against known ongoing-call notification categories/flags.
3. On detected call start, call the same `RecordingForegroundService.start()`
   used for native calls, passing `channel = "whatsapp"` and the contact
   name parsed from the notification's title (WhatsApp puts the contact
   name there, not a phone number, so `ContactResolver` won't apply the
   same way — store it directly).
4. In `onNotificationRemoved`, call `RecordingForegroundService.stop()`.
5. Add a settings deep-link so the app can send the user directly to
   Settings → Notification Access when the WhatsApp toggle is turned on
   without that permission granted yet.

## Not planned

Root-only approaches (Magisk modules, Xposed hooks into WhatsApp's audio
pipeline) would give more reliable audio but are out of scope — they'd tie
the app to root access, which conflicts with the sideloading-on-a-normal-
phone approach used across this portfolio.
