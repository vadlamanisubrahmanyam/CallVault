# WhatsApp call detection — implemented (v0.2)

WhatsApp calls are VoIP and never touch `TelephonyManager`, so there's no
broadcast equivalent to `ACTION_PHONE_STATE_CHANGED` for them, and no
public WhatsApp API for call events.

## Approach used: NotificationListenerService

`WhatsAppCallListenerService` watches notifications from `com.whatsapp`
and `com.whatsapp.w4b` (Business), and treats a notification tagged
`Notification.CATEGORY_CALL` as an active call. On post, it starts
`RecordingForegroundService` with the contact name pulled directly from
the notification title (WhatsApp shows the display name, not a phone
number, so there's nothing to resolve via contacts here). On removal, it
stops the recording.

## Setup required (one-time, manual)

Unlike the other permissions this app requests, Notification Access has
no runtime permission dialog — Android requires the user to grant it
manually via Settings → Apps → Special app access → Notification access.
The app surfaces this: turning the WhatsApp toggle on checks whether
access is already granted, and if not, offers a button that deep-links
straight to that settings screen (`Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS`).

## Known limitations (real, not hypothetical)

- **Category-tagging isn't a documented public contract.** Most current
  WhatsApp versions tag ongoing-call notifications with `CATEGORY_CALL`,
  but WhatsApp could change this in a future update without notice,
  silently breaking detection until this code is updated to match.
- **No voice/video distinction.** Both are recorded the same way.
- **Audio is still mic-based**, same as phone calls — this only solves
  *when* to start/stop recording, not *how* the audio is captured.
- **One call at a time.** The service tracks a single active notification
  key; it isn't designed to handle overlapping WhatsApp call notifications.

## Not planned

Root-only approaches (Magisk modules, Xposed hooks into WhatsApp's audio
pipeline) would give more reliable detection and audio, but are out of
scope — they'd tie the app to root access, which conflicts with the
sideloading-on-a-normal-phone approach used across this portfolio.
