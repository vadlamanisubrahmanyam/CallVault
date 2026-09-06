import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, Switch, FlatList, TextInput, TouchableOpacity,
  StyleSheet, Alert, Platform,
} from 'react-native';
import { Audio } from 'expo-av';
import * as Sharing from 'expo-sharing';
import CallRecorder, { isNativeAvailable } from '../native/CallRecorder';

const CHIPS = ['All', 'Phone', 'WhatsApp', 'Today'];

export default function HomeScreen() {
  const [masterEnabled, setMasterEnabled] = useState(true);
  const [phoneEnabled, setPhoneEnabled] = useState(true);
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [liveCall, setLiveCall] = useState(null); // { contactName, channel } | null
  const [recordings, setRecordings] = useState([]);
  const [search, setSearch] = useState('');
  const [activeChip, setActiveChip] = useState('All');
  const [storageInfo, setStorageInfo] = useState({ usedBytes: 0, recordingCount: 0, dir: '' });

  const refresh = useCallback(async () => {
    const [list, storage, master, phone, whatsapp] = await Promise.all([
      CallRecorder.listRecordings(),
      CallRecorder.getStorageInfo(),
      CallRecorder.getMasterEnabled(),
      CallRecorder.getChannelEnabled('phone'),
      CallRecorder.getChannelEnabled('whatsapp'),
    ]);
    setRecordings(list);
    setStorageInfo(storage);
    setMasterEnabled(master);
    setPhoneEnabled(phone);
    setWhatsappEnabled(whatsapp);
  }, []);

  useEffect(() => {
    refresh();
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
  }, [refresh]);

  const toggleMaster = async (value) => {
    setMasterEnabled(value);
    await CallRecorder.setMasterEnabled(value);
  };

  const toggleChannel = async (channel, value) => {
    if (channel === 'whatsapp' && value) {
      const granted = await CallRecorder.isWhatsAppListenerEnabled();
      if (!granted) {
        Alert.alert(
          'Notification access needed',
          'WhatsApp call detection watches WhatsApp\'s own call notification, which requires Notification Access — a special permission Android makes you grant manually in Settings (there\'s no in-app prompt for this one).',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => CallRecorder.openNotificationAccessSettings() },
          ]
        );
      }
    }
    if (channel === 'phone') setPhoneEnabled(value);
    if (channel === 'whatsapp') setWhatsappEnabled(value);
    await CallRecorder.setChannelEnabled(channel, value);
  };

  const stopLiveRecording = async () => {
    await CallRecorder.setMasterEnabled(false);
    await CallRecorder.setMasterEnabled(masterEnabled); // restore toggle state; native side handles actual stop
    setLiveCall(null);
  };

  const playRecording = async (item) => {
    if (!item.filePath) {
      Alert.alert('Preview only', 'This is mock data — no real audio file exists yet.');
      return;
    }
    try {
      const { sound } = await Audio.Sound.createAsync({ uri: item.filePath });
      await sound.playAsync();
    } catch (e) {
      Alert.alert('Playback failed', String(e?.message || e));
    }
  };

  const shareRecording = async (item) => {
    if (!item.filePath || !(await Sharing.isAvailableAsync())) {
      Alert.alert('Preview only', 'This is mock data — nothing to share yet.');
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>CallVault</Text>
      {!isNativeAvailable && (
        <Text style={styles.devWarning}>
          Dev mode: native module not linked — showing mock data. Build via GitHub Actions or `expo run:android` to test real recording.
        </Text>
      )}

      <View style={styles.masterCard}>
        <Text style={styles.label}>MASTER RECORDING</Text>
        <Switch value={masterEnabled} onValueChange={toggleMaster} />
        <Text style={styles.statusPill}>{masterEnabled ? '● ACTIVE — listening for calls' : '○ OFF'}</Text>
      </View>

      <Row
        title="Phone calls"
        subtitle="Mic-based capture"
        value={phoneEnabled}
        onValueChange={(v) => toggleChannel('phone', v)}
      />
      <Row
        title="WhatsApp calls"
        subtitle="Notification-based detection — needs Notification Access"
        value={whatsappEnabled}
        onValueChange={(v) => toggleChannel('whatsapp', v)}
      />

      <View style={styles.warnBanner}>
        <Text style={styles.warnText}>
          ⚠ Switch to Speakerphone during calls for usable audio — Android does not allow apps to tap call audio directly.
        </Text>
      </View>

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
        ListEmptyComponent={<Text style={styles.empty}>No recordings match your filters.</Text>}
      />

      <Text style={styles.storageInfo}>
        Storage: {usedMB} MB used · {storageInfo.recordingCount} recordings · {storageInfo.dir || '/CallVault/Recordings'}
      </Text>
    </View>
  );
}

function Row({ title, subtitle, value, onValueChange }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      <Switch value={value} onValueChange={onValueChange} />
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
  devWarning: { fontSize: 11, color: '#a15c00', backgroundColor: '#fff3e0', padding: 6, marginBottom: 8 },
  masterCard: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, alignItems: 'center', marginBottom: 10 },
  label: { fontSize: 11, color: '#888', marginBottom: 6, letterSpacing: 0.5 },
  statusPill: { fontSize: 11, marginTop: 6, color: '#333' },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 10, marginBottom: 8 },
  rowTitle: { fontSize: 14, fontWeight: '600' },
  rowSubtitle: { fontSize: 11, color: '#888', marginTop: 2 },
  warnBanner: { backgroundColor: '#f5f5f5', borderRadius: 6, padding: 8, marginBottom: 8 },
  warnText: { fontSize: 11, color: '#555' },
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
  empty: { textAlign: 'center', color: '#999', marginTop: 20, fontSize: 12 },
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
