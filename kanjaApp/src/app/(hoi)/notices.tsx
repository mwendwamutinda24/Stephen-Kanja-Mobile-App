
// Notice.tsx
// ============================================================
// Notice Board Screen — React Native (TypeScript)
// Stephen Kanja School Management System
// ============================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import axios from 'axios';

// ────────────────────────────────────────────────────────────
// Config
// ────────────────────────────────────────────────────────────
const API_URL = 'https://new-kanja-portal.onrender.com/api/notices.php';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────
type NoticeType = 'info' | 'urgent' | 'event';

interface Notice {
  id: number;
  title: string;
  type: NoticeType;
  posted_by: string;
  created_at: string;
  time_ago?: string;
}

interface Counts {
  all: number;
  info: number;
  urgent: number;
  event: number;
}

interface ListResponse {
  success: boolean;
  count: number;
  counts: Counts;
  data: Notice[];
}

// ────────────────────────────────────────────────────────────
// Theme
// ────────────────────────────────────────────────────────────
const C = {
  gold: '#f0c040',
  goldDim: '#c9a030',
  black: '#111111',
  bg: '#f4f4f2',
  card: '#ffffff',
  input: '#f8f8f6',
  textPrimary: '#1a1a18',
  textSecondary: '#5f5e5a',
  textTertiary: '#888780',
  border: 'rgba(0,0,0,0.09)',
  urgent: '#dc2626',
  urgentBg: '#fff5f5',
  info: '#2563eb',
  infoBg: '#f0f4ff',
  event: '#16a34a',
  eventBg: '#f0fff4',
};

const TYPE_STYLE: Record<NoticeType, { color: string; bg: string; icon: string }> = {
  urgent: { color: C.urgent, bg: C.urgentBg, icon: '⚠' },
  info:   { color: C.info,   bg: C.infoBg,   icon: 'ℹ' },
  event:  { color: C.event,  bg: C.eventBg,  icon: '★' },
};

// ────────────────────────────────────────────────────────────
// API
// ────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

const NoticeAPI = {
  list: async (filter: NoticeType | null): Promise<ListResponse> => {
    const url = filter ? `?filter=${filter}` : '';
    const { data } = await api.get<ListResponse>(url);
    if (!data.success) throw new Error('Failed to load notices');
    return data;
  },
  create: async (payload: { title: string; type: NoticeType; posted_by: string }) => {
    const { data } = await api.post('', payload);
    if (!data.success) throw new Error(data.error || 'Failed to post');
    return data.data as Notice;
  },
  remove: async (id: number) => {
    const { data } = await api.delete(`?id=${id}`);
    if (!data.success) throw new Error(data.error || 'Failed to delete');
    return true;
  },
};

// ────────────────────────────────────────────────────────────
// Screen
// ────────────────────────────────────────────────────────────
export default function Notice(): React.ReactElement {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [counts, setCounts] = useState<Counts>({ all: 0, info: 0, urgent: 0, event: 0 });
  const [filter, setFilter] = useState<NoticeType | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Post form
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<NoticeType>('info');
  const [postedBy, setPostedBy] = useState('Admin');
  const [submitting, setSubmitting] = useState(false);

  // ── Load ──────────────────────────────────────────────────
  const load = useCallback(
    async (f: NoticeType | null, isRefresh = false) => {
      try {
        if (!isRefresh) setLoading(true);
        const res = await NoticeAPI.list(f);
        setNotices(res.data);
        setCounts(res.counts);
      } catch (e: any) {
        Alert.alert('Error', e?.message ?? 'Something went wrong');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    load(filter);
  }, [filter, load]);

  const onRefresh = () => {
    setRefreshing(true);
    load(filter, true);
  };

  // ── Create ────────────────────────────────────────────────
  const submit = async () => {
    if (!title.trim()) {
      Alert.alert('Validation', 'Notice title cannot be empty.');
      return;
    }
    setSubmitting(true);
    try {
      await NoticeAPI.create({
        title: title.trim(),
        type,
        posted_by: postedBy.trim() || 'Admin',
      });
      setTitle('');
      setType('info');
      setPostedBy('Admin');
      setFormOpen(false);
      load(filter);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to post');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────
  const confirmDelete = (notice: Notice) => {
    Alert.alert('Delete notice?', notice.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await NoticeAPI.remove(notice.id);
            setNotices((prev) => prev.filter((n) => n.id !== notice.id));
          } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Failed to delete');
          }
        },
      },
    ]);
  };

  // ── Derived ───────────────────────────────────────────────
  const filterChips = useMemo(
    () => [
      { key: null as NoticeType | null, label: 'All',    count: counts.all },
      { key: 'urgent' as NoticeType,    label: 'Urgent', count: counts.urgent },
      { key: 'info' as NoticeType,      label: 'Info',   count: counts.info },
      { key: 'event' as NoticeType,     label: 'Events', count: counts.event },
    ],
    [counts],
  );

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  // ──────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.black} />

      {/* ── Header ─────────────────────────────────────────── */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Text style={s.headerIcon}>📢</Text>
          <Text style={s.headerTitle}>NOTICE BOARD</Text>
        </View>
        <Text style={s.headerDate}>{today}</Text>
      </View>

      {/* ── Filter chips ───────────────────────────────────── */}
      <View style={s.chipsWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chipsContent}
        >
          {filterChips.map((chip) => {
            const active = filter === chip.key;
            return (
              <TouchableOpacity
                key={chip.label}
                style={[s.chip, active && s.chipActive]}
                onPress={() => setFilter(chip.key)}
                activeOpacity={0.8}
              >
                <Text style={[s.chipText, active && s.chipTextActive]}>
                  {chip.label}
                  {chip.count > 0 ? ` · ${chip.count}` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Notice list ────────────────────────────────────── */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={C.gold} />
          <Text style={s.loadingText}>Loading notices…</Text>
        </View>
      ) : (
        <FlatList
          data={notices}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={s.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={C.gold}
              colors={[C.gold]}
            />
          }
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Text style={s.emptyIcon}>📭</Text>
              <Text style={s.emptyText}>No notices yet.</Text>
              <Text style={s.emptySub}>Tap the + button to post one.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const theme = TYPE_STYLE[item.type];
            return (
              <View
                style={[
                  s.card,
                  { borderLeftColor: theme.color, backgroundColor: theme.bg },
                ]}
              >
                <View style={s.cardTopRow}>
                  <View style={[s.badge, { backgroundColor: theme.color + '22' }]}>
                    <Text style={[s.badgeText, { color: theme.color }]}>
                      {theme.icon} {item.type.toUpperCase()}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => confirmDelete(item)}
                    hitSlop={10}
                    style={s.deleteBtn}
                  >
                    <Text style={s.deleteIcon}>✕</Text>
                  </TouchableOpacity>
                </View>

                <Text style={s.cardTitle}>{item.title}</Text>

                <View style={s.metaRow}>
                  <Text style={s.meta}>👤 {item.posted_by}</Text>
                  <Text style={s.metaDot}>·</Text>
                  <Text style={s.meta}>🕐 {item.time_ago ?? item.created_at}</Text>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* ── FAB ────────────────────────────────────────────── */}
      <TouchableOpacity
        style={s.fab}
        onPress={() => setFormOpen(true)}
        activeOpacity={0.85}
      >
        <Text style={s.fabIcon}>+</Text>
      </TouchableOpacity>

      {/* ── Post form (bottom sheet) ───────────────────────── */}
      <Modal
        visible={formOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setFormOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={s.modalOverlay}
        >
          <View style={s.sheet}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>📢  POST A NOTICE</Text>
              <TouchableOpacity onPress={() => setFormOpen(false)} hitSlop={10}>
                <Text style={s.sheetClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={s.sheetBody}>
              <Text style={s.label}>TITLE</Text>
              <TextInput
                style={s.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Notice title…"
                placeholderTextColor={C.textTertiary}
                returnKeyType="done"
              />

              <Text style={s.label}>TYPE</Text>
              <View style={s.typeRow}>
                {(['info', 'urgent', 'event'] as NoticeType[]).map((t) => {
                  const active = type === t;
                  return (
                    <TouchableOpacity
                      key={t}
                      style={[s.typeBtn, active && s.typeBtnActive]}
                      onPress={() => setType(t)}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.typeText, active && s.typeTextActive]}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={s.label}>POSTED BY</Text>
              <TextInput
                style={s.input}
                value={postedBy}
                onChangeText={setPostedBy}
                placeholder="Admin"
                placeholderTextColor={C.textTertiary}
              />

              <TouchableOpacity
                style={[s.postBtn, submitting && { opacity: 0.6 }]}
                onPress={submit}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator color={C.black} />
                ) : (
                  <Text style={s.postBtnText}>🚀  POST NOTICE</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  // Header
  header: {
    backgroundColor: C.black,
    borderBottomWidth: 3,
    borderBottomColor: C.gold,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIcon: { fontSize: 18 },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  headerDate: { color: '#888', fontSize: 11 },

  // Chips
  chipsWrap: { paddingVertical: 10 },
  chipsContent: { paddingHorizontal: 16, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.input,
  },
  chipActive: { backgroundColor: C.black, borderColor: C.black },
  chipText: { fontSize: 12, fontWeight: '500', color: C.textSecondary },
  chipTextActive: { color: C.gold, fontWeight: '700' },

  // List
  listContent: { paddingVertical: 8, paddingBottom: 100 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  loadingText: { color: C.textTertiary, fontSize: 13 },

  // Card
  card: {
    borderLeftWidth: 4,
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  deleteBtn: { padding: 4 },
  deleteIcon: { fontSize: 14, color: C.textTertiary, fontWeight: '600' },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: C.textPrimary,
    marginBottom: 6,
    lineHeight: 20,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { fontSize: 11, color: C.textTertiary },
  metaDot: { fontSize: 11, color: C.textTertiary, marginHorizontal: 2 },

  // Empty
  emptyWrap: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyText: { color: C.textSecondary, fontSize: 14, fontWeight: '600' },
  emptySub: { color: C.textTertiary, fontSize: 12, marginTop: 4 },

  // FAB
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.gold,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  fabIcon: { fontSize: 30, color: C.black, fontWeight: '300', lineHeight: 32 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  sheetHeader: {
    backgroundColor: C.black,
    borderBottomWidth: 3,
    borderBottomColor: C.gold,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetTitle: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 1.2 },
  sheetClose: { color: '#fff', fontSize: 18, fontWeight: '600' },
  sheetBody: { padding: 18, gap: 4 },
  label: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: C.textTertiary,
    letterSpacing: 0.8,
    marginTop: 10,
    marginBottom: 4,
  },
  input: {
    backgroundColor: C.input,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: C.textPrimary,
  },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.input,
    alignItems: 'center',
  },
  typeBtnActive: { backgroundColor: C.gold, borderColor: C.gold },
  typeText: { fontSize: 13, fontWeight: '600', color: C.textSecondary },
  typeTextActive: { color: C.black, fontWeight: '800' },
  postBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.gold,
    borderRadius: 8,
    paddingVertical: 13,
    marginTop: 18,
  },
  postBtnText: {
    color: C.black,
    fontWeight: '800',
    letterSpacing: 1,
    fontSize: 13,
  },
});