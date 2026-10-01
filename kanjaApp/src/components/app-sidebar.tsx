import React from 'react';
import { View, TouchableOpacity, ScrollView, StyleSheet, Modal } from 'react-native';
import ThemedText from '@/components/themed-text';
import {
  Home, Users, TrendingUp, UserPlus, ClipboardCheck,
  Presentation, Bell, PieChart, Grid3x3, GraduationCap, X,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';

const SIDEBAR_COLORS = {
  bg: '#183766',        // dark navy
  active: '#6C5CE7',    // purple
  textMuted: '#8888A0',
  textActive: '#FFFFFF',
  sectionLabel: '#6B6B85',
};

const NAV_ITEMS = [
  { icon: Home, label: 'Dashboard', route: '/dashboard' },
  { icon: Users, label: 'Students', route: '/students' },
  { icon: TrendingUp, label: 'Progress Records', route: '/progress' },
];

const ADMIN_ITEMS = [
  { icon: UserPlus, label: 'Register Learners', route: '/registerLearner' },
  { icon: ClipboardCheck, label: 'Attendance', route: '/attendance' },
  { icon: Presentation, label: 'Register Teachers', route: '/registerTeacher' },
  { icon: Bell, label: 'Notices', route: '/notices' },

];

const ACADEMIC_ITEMS = [
  { icon: PieChart, label: 'Upload Results', route: '/uploadResults' },
   { icon: PieChart, label: 'ViewResults', route: '/results' },
  { icon: Grid3x3, label: 'Timetable', route: '/timetable' },
];

export default function AppSidebar({ visible, onClose, activeRoute }) {
  const router = useRouter();

  function go(route) {
    onClose();
    router.push(route);
  }

  function renderItem({ icon: Icon, label, route }) {
    const active = activeRoute === route;
    return (
      <TouchableOpacity
        key={route}
        style={[styles.item, active && styles.itemActive]}
        onPress={() => go(route)}
      >
        <Icon size={18} color={active ? SIDEBAR_COLORS.textActive : SIDEBAR_COLORS.textMuted} />
        <ThemedText style={[styles.itemText, active && styles.itemTextActive]}>{label}</ThemedText>
      </TouchableOpacity>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sidebar}>
          <View style={styles.brandRow}>
            <View style={styles.brandBadge}>
              <GraduationCap size={20} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.brandName}>Kanja School</ThemedText>
              <ThemedText style={styles.brandSub}>MANAGEMENT SYSTEM</ThemedText>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.navScroll}
            showsVerticalScrollIndicator={false}
            bounces={true}
          >
            {NAV_ITEMS.map(renderItem)}

            <ThemedText style={styles.sectionLabel}>ADMINISTRATION</ThemedText>
            {ADMIN_ITEMS.map(renderItem)}

            <ThemedText style={styles.sectionLabel}>ACADEMICS</ThemedText>
            {ACADEMIC_ITEMS.map(renderItem)}
          </ScrollView>
        </View>

        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, flexDirection: 'row' },
  sidebar: { width: 280, backgroundColor: SIDEBAR_COLORS.bg, paddingTop: 50, paddingHorizontal: 14 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28, paddingHorizontal: 4 },
  brandBadge: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: SIDEBAR_COLORS.active,
    alignItems: 'center', justifyContent: 'center',
  },
  brandName: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  brandSub: { color: SIDEBAR_COLORS.textMuted, fontSize: 9, letterSpacing: 1, marginTop: 2 },
  closeBtn: {
    width: 28, height: 28, borderRadius: 6,
    backgroundColor: '#232342', alignItems: 'center', justifyContent: 'center',
  },
  navScroll: { paddingBottom: 40 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, marginBottom: 4,
  },
  itemActive: { backgroundColor: SIDEBAR_COLORS.active },
  itemText: { color: SIDEBAR_COLORS.textMuted, fontSize: 14, fontWeight: '600' },
  itemTextActive: { color: '#FFFFFF' },
  sectionLabel: {
    color: SIDEBAR_COLORS.sectionLabel, fontSize: 10, fontWeight: '700',
    letterSpacing: 1, marginTop: 20, marginBottom: 8, paddingHorizontal: 14,
  },
});