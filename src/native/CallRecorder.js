// Thin JS wrapper around the native "CallRecorder" Expo module (see
// /modules/call-recorder). This native module only exists after
// `expo prebuild` + a native build — it will NOT work inside Expo Go.
//
// There is intentionally no mock/demo data here. If the native module
// isn't linked for some reason, functions fail loudly (console.warn) and
// return empty/false rather than showing fake recordings — a real bug
// should be visible as "nothing works", not disguised as working software.

import { requireNativeModule } from 'expo-modules-core';

let CallRecorderNative = null;
try {
  CallRecorderNative = requireNativeModule('CallRecorder');
} catch (e) {
  console.warn(
    '[CallRecorder] Native module not available. ' +
    'Run `expo prebuild` and a native Android build — this will not work in Expo Go.'
  );
}

const unavailable = {
  async setMasterEnabled() { return false; },
  async getMasterEnabled() { return false; },
  async listRecordings() { return []; },
  async deleteRecording() { return false; },
  async getStorageInfo() { return { usedBytes: 0, recordingCount: 0, dir: '' }; },
  isWhatsAppListenerEnabled() { return false; },
  openNotificationAccessSettings() { return false; },
  isOverlayPermissionGranted() { return false; },
  openOverlayPermissionSettings() { return false; },
  addListener() { return { remove() {} }; },
};

export default CallRecorderNative || unavailable;
export const isNativeAvailable = !!CallRecorderNative;
