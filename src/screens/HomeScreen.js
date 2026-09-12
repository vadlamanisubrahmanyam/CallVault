import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, Switch, FlatList, TextInput, TouchableOpacity,
  StyleSheet, Alert, Platform, PermissionsAndroid,
} from 'react-native';
import { Audio } from 'expo-av';
import * as Sharing from 'expo-sharing';
import CallRecorder from '../native/CallRecorder';

const CHIPS = ['All', 'Phone', 'WhatsApp', 'Today'];

export default function HomeScreen() {
  const [masterEnabled, setMasterEnabled] = useState(true);
  const [liveCall, setLiveCall] = useState(null); // { contactName, channel } | null
  const [recordings, setRecordings] = useState([]);
  const [search, setSearch] = useState('');
  const [activeChip, setActiveChip] = useState('All');
  const [storageInfo, setStorageInfo] = useState({ usedBytes: 0, recordingCount: 0, dir: '' });

  const [permStatus, setPermStatus] = useState({
    mic: false,
    phoneState: false,
    contacts: false,
    notificationAccess: false,
    overlay: false,
  });

  const refreshPermissionStatus = useCallback(async () => {
    const mic = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    const phoneState = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE);
    const contacts = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_CONTACTS);
    const notificationAccess = CallRecorder.isWhatsAppListenerEnabled();
    const overlay = CallRecorder.isOverlayPermissionGranted();
    setPermStatus({ mic, phoneState, contacts, notificationAccess, overlay });
  }, []);

  const requestCorePermissions = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    const toRequest = [
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
      PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
      PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
    ];
    if (Platform.Version >= 33) {
      toRequest.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    }
    try {
      await PermissionsAndroid.requestMultiple(toRequest);
    } catch (e) {
      // User denied one or more — reflected in the permissions checklist below,
      // not treated as a fatal error.
    }
    refreshPermissionStatus();
  }, [refreshPermissionStatus]);

  const refresh = useCallback(async () => {
    const [list, storage, master] = await Promise.all([
      CallRecorder.listRecordings(),
      CallRecorder.getStorageInfo(),
      CallRecorder.getMasterEnabled(),
    ]);
    setRecordings(list);
    setStorageInfo(storage);
    setMasterEnabled(master);
    refreshPermissionStatus();
  }, [refreshPermissionStatus]);

  useEffect(() => {
    // The master switch defaults to on every time the app is opened,
    // regardless of what was left over from a previous session — this is a
    // deliberate simplification so recording is never accidentally left off
    // without the user noticing. Turning it off during a session is still
    // respected until the app is next launched.
    CallRecorder.setMasterEnabled(true).then(() => {
      requestCorePermissions();
      refresh();
    });
    // The native module emits this event when a call recording starts/stops,
    // so the "Recording…" banner and the list update live without polling.
    const sub = CallRecorder.addListener?.('onRecordingStateChanged', (evt) => {
      if (evt?.active) {
        setLiveCall({ contactName: evt.contactName || evt.phoneNumber || 'Unknown', channel: evt.channel });
      } else {
        setLiveCall(null);
        refresh();
      }
    });
    return () => sub?.remove?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMaster = async (value) => {
    setMasterEnabled(value);
    await CallRecorder.setMasterEnabled(value);
  };

  const stopLiveRecording = async () => {
    await CallRecorder.setMasterEnabled(false);
    await CallRecorder.setMasterEnabled(masterEnabled); // restore toggle state; native side handles actual stop
    setLiveCall(null);
  };

  const playRecording = async (item) => {
    try {
      const { sound } = await Audio.Sound.createAsync({ uri: item.filePath });
      await sound.playAsync();
    } catch (e) {
      Alert.alert('Playback failed', String(e?.message || e));
    }
  };

  const shareRecording = async (item) => {
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('Sharing unavailable', 'This device has no share target available.');
      return;
    }
    await Sharing.shareAsync(item.filePath);
  };

  const deleteRecording = (item) => {
    Alert.alert('Delete recording?', item.filename, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await CallRecorder.deleteRecording(item.id);
          refresh();
        },
      },
    ]);
  };

  const grantNotificationAccess = () => {
    const opened = CallRecorder.openNotificationAccessSettings();
    if (!opened) {
      Alert.alert(
        'Could not open Settings',
        'Open it manually: Settings -> Apps -> Special app access -> Notification access -> CallVault -> Allow.'
      );
    }
  };

  const grantOverlayAccess = () => {
    const opened = CallRecorder.openOverlayPermissionSettings();
    if (!opened) {
      Alert.alert(
        'Could not open Settings',
        'Open it manually: Settings -> Apps -> Special app access -> Display over other apps -> CallVault -> Allow.'
      );
    }
  };

  const filtered = useMemo(() => {
    let list = recordings;
    if (activeChip === 'Phone') list = list.filter(r => r.channel === 'phone');
    if (activeChip === 'WhatsApp') list = list.filter(r => r.channel === 'whatsapp');
    if (activeChip === 'Today') {
      const today = new Date().toDateString();
      list = list.filter(r => new Date(r.startedAt).toDateString() === today);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(r => r.contactName.toLowerCase().includes(q) || r.phoneNumber.includes(q));
    }
    return [...list].sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  }, [recordings, activeChip, search]);

  const usedMB = (storageInfo.usedBytes / (1024 * 1024)).toFixed(0);
  const missingPerms = !permStatus.mic || !permStatus.phoneState || !permStatus.contacts
    || !permStatus.notificationAccess || !permStatus.overlay;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>CallVault</Text>

      <View style={styles.masterCard}>
        <Text style={styles.label}>MASTER RECORDING</Text>
        <Switch value={masterEnabled} onValueChange={toggleMaster} />
        <Text style={styles.statusPill}>
          {masterEnabled ? '● ACTIVE — records phone + WhatsApp calls' : '○ OFF'}
        </Text>
      </View>

      <View style={styles.warnBanner}>
        <Text style={styles.warnText}>
          ⚠ Switch to Speakerphone during calls for usable audio — Android does not allow apps to tap call audio directly.
        </Text>
      </View>

      {missingPerms && (
        <View style={styles.permCard}>
          <Text style={styles.permHeader}>SETUP NEEDED</Text>
          <PermRow label="Microphone" granted={permStatus.mic} onGrant={requestCorePermissions} />
          <PermRow label="Phone state" granted={permStatus.phoneState} onGrant={requestCorePermissions} />
          <PermRow label="Contacts" granted={permStatus.contacts} onGrant={requestCorePermissions} />
          <PermRow
            label="Notification access (for WhatsApp calls)"
            granted={permStatus.notificationAccess}
            onGrant={grantNotificationAccess}
          />
          <PermRow
            label="Display over other apps"
            granted={permStatus.overlay}
            onGrant={grantOverlayAccess}
          />
        </View>
      )}

      {liveCall && (
        <View style={styles.liveCard}>
          <Text style={styles.liveText}>● Recording… {liveCall.contactName}</Text>
          <TouchableOpacity style={styles.btn} onPress={stopLiveRecording}>
            <Text style={styles.btnText}>Stop</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.sectionHeader}>RECORDINGS</Text>
      <TextInput
        style={styles.search}
        placeholder="Search by contact name…"
        value={search}
        onChangeText={setSearch}
      />
      <View style={styles.chipsRow}>
        {CHIPS.map((chip) => (
          <TouchableOpacity
            key={chip}
            style={[styles.chip, activeChip === chip && styles.chipActive]}
            onPress={() => setActiveChip(chip)}
          >
            <Text style={[styles.chipText, activeChip === chip && styles.chipTextActive]}>{chip}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        style={styles.list}
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <RecordingItem
            item={item}
            onPlay={() => playRecording(item)}
            onShare={() => shareRecording(item)}
            onDelete={() => deleteRecording(item)}
          />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {recordings.length === 0
              ? 'No recordings yet — they will show up here after your first call.'
              : 'No recordings match your filters.'}
          </Text>
        }
      />

      <Text style={styles.storageInfo}>
        Storage: {usedMB} MB used · {storageInfo.recordingCount} recordings · {storageInfo.dir || '/CallVault/Recordings'}
      </Text>
    </View>
  );
}

function PermRow({ label, granted, onGrant }) {
  return (
    <View style={styles.permRow}>
      <Text style={styles.permLabel}>{granted ? '✅' : '⚠️'} {label}</Text>
      {!granted && (
        <TouchableOpacity style={styles.btnSmall} onPress={onGrant}>
          <Text style={styles.btnText}>Grant</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function RecordingItem({ item, onPlay, onShare, onDelete }) {
  const dt = new Date(item.startedAt);
  const mins = Math.floor(item.durationSeconds / 60);
  const secs = String(item.durationSeconds % 60).padStart(2, '0');
  return (
    <View style={styles.recItem}>
      <View style={styles.avatar}>
        <Text>{item.contactName?.[0]?.toUpperCase() || '?'}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.recName}>
          {item.contactName} {item.channel === 'phone' ? '📞' : '💬'}
        </Text>
        <Text style={styles.recMeta}>
          {dt.toLocaleDateString()}, {dt.toLocaleTimeString()} · {mins}:{secs}
        </Text>
        <Text style={styles.fname}>{item.filename}</Text>
        <View style={styles.recActions}>
          <TouchableOpacity style={styles.btnSmall} onPress={onPlay}><Text style={styles.btnText}>Play</Text></TouchableOpacity>
          <TouchableOpacity style={styles.btnSmall} onPress={onShare}><Text style={styles.btnText}>Share</Text></TouchableOpacity>
          <TouchableOpacity style={styles.btnSmall} onPress={onDelete}><Text style={styles.btnText}>Delete</Text></TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 4 },
  masterCard: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, alignItems: 'center', marginBottom: 10 },
  label: { fontSize: 11, color: '#888', marginBottom: 6, letterSpacing: 0.5 },
  statusPill: { fontSize: 11, marginTop: 6, color: '#333' },
  warnBanner: { backgroundColor: '#f5f5f5', borderRadius: 6, padding: 8, marginBottom: 8 },
  warnText: { fontSize: 11, color: '#555' },
  permCard: { borderWidth: 1, borderColor: '#e0c060', backgroundColor: '#fffbea', borderRadius: 8, padding: 10, marginBottom: 8 },
  permHeader: { fontSize: 10, fontWeight: 'bold', color: '#8a6d00', marginBottom: 6, letterSpacing: 0.5 },
  permRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  permLabel: { fontSize: 12, color: '#333', flex: 1, paddingRight: 8 },
  liveCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fdecea', borderRadius: 8, padding: 10, marginBottom: 8 },
  liveText: { fontSize: 13, fontWeight: '600', color: '#c0392b' },
  sectionHeader: { fontSize: 12, fontWeight: 'bold', color: '#333', marginTop: 6, marginBottom: 6, letterSpacing: 0.5 },
  search: { borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 8, fontSize: 13, marginBottom: 8 },
  chipsRow: { flexDirection: 'row', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
  chip: { borderWidth: 1, borderColor: '#ccc', borderRadius: 12, paddingVertical: 3, paddingHorizontal: 10 },
  chipActive: { backgroundColor: '#333', borderColor: '#333' },
  chipText: { fontSize: 11, color: '#333' },
  chipTextActive: { color: '#fff' },
  list: { flex: 1 },
  empty: { textAlign: 'center', color: '#999', marginTop: 20, fontSize: 12, paddingHorizontal: 20 },
  recItem: { flexDirection: 'row', gap: 10, borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 8, marginBottom: 6 },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },
  recName: { fontWeight: '600', fontSize: 13 },
  recMeta: { fontSize: 10, color: '#888', marginTop: 1 },
  fname: { fontSize: 9, color: '#aaa', marginTop: 2 },
  recActions: { flexDirection: 'row', gap: 6, marginTop: 6 },
  btn: { borderWidth: 1, borderColor: '#333', borderRadius: 6, paddingVertical: 4, paddingHorizontal: 10 },
  btnSmall: { borderWidth: 1, borderColor: '#333', borderRadius: 6, paddingVertical: 2, paddingHorizontal: 8 },
  btnText: { fontSize: 10, color: '#333' },
  storageInfo: { fontSize: 10, color: '#999', marginTop: 8, textAlign: 'center' },
});
