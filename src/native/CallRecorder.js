// Thin JS wrapper around the native "CallRecorder" Expo module (see /modules/call-recorder).
// This native module only exists after `expo prebuild` + a native build — it will NOT
// work inside Expo Go. The mock fallback below lets the UI be developed/previewed safely
// without a native build, and clearly logs when it's being used.

import { NativeModulesProxy, requireNativeModule } from 'expo-modules-core';

let CallRecorderNative = null;
try {
  CallRecorderNative = requireNativeModule('CallRecorder');
} catch (e) {
  console.warn(
    '[CallRecorder] Native module not available — using mock. ' +
    'Run `expo prebuild` and a native Android build to enable real recording.'
  );
}

const mockRecordings = [
  {
    id: '1',
    contactName: 'Amma',
    phoneNumber: '+919800000001',
    channel: 'phone',
    startedAt: new Date().toISOString(),
    durationSeconds: 252,
    filename: '2026-09-05_0938_Amma_Phone.m4a',
    filePath: null,
  },
  {
    id: '2',
    contactName: 'Ravi Kumar',
    phoneNumber: '+919800000002',
    channel: 'whatsapp',
    startedAt: new Date(Date.now() - 3600_000).toISOString(),
    durationSeconds: 767,
    filename: '2026-09-05_0815_RaviKumar_WhatsApp.m4a',
    filePath: null,
  },
];

const mock = {
  async setChannelEnabled(channel, enabled) {
    console.log(`[mock] setChannelEnabled(${channel}, ${enabled})`);
    return true;
  },
  async getChannelEnabled(channel) {
    return channel === 'phone';
  },
  async setMasterEnabled(enabled) {
    console.log(`[mock] setMasterEnabled(${enabled})`);
    return true;
  },
  async getMasterEnabled() {
    return true;
  },
  async listRecordings() {
    return mockRecordings;
  },
  async deleteRecording(id) {
    console.log(`[mock] deleteRecording(${id})`);
    return true;
  },
  async getStorageInfo() {
    return { usedBytes: 1_200_000_000, recordingCount: mockRecordings.length, dir: '/CallVault/Recordings' };
  },
  addListener() {
    return { remove() {} };
  },
};

export default CallRecorderNative || mock;
export const isNativeAvailable = !!CallRecorderNative;
