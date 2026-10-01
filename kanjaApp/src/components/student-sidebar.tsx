import React from 'react';
import {
  View,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Animated,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  X,
  GraduationCap,
  Home,
  PieChart,
  Users,
  ClipboardCheck,
  Coins,
  Megaphone,
  Calendar,
} from 'lucide-react-native';
import ThemedText from '@/components/themed-text';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
export const SIDEBAR_WIDTH = Math.min(300, SCREEN_WIDTH * 0.82);

export type StudentNavItem = {
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  route: string;
};

export const STUDENT_NAV_ITEMS: StudentNavItem[] = [
  { label: 'Home', icon: Home, route: '/student-dashboard' },
  { label: 'My Results', icon: PieChart, route: '/my-results' },
  { label: 'Grade Performance', icon: Users, route: '/grade-performance' },
  { label: 'Attendance', icon: ClipboardCheck, route: '/attendance' },
  { label: 'Fees', icon: Coins, route: '/student-fees' },
  { label: 'Notices', icon: Megaphone, route: '/notices' },
  { label: 'Timetable', icon: Calendar, route: '/timetable' },
];

export type StudentSidebarProfile = {
  grade: string;
  admissionId: string;
};

export default function StudentSidebar({
  visible,
  onClose,
  activeRoute,
  profile,
}: {
  visible: boolean;
  onClose: () => void;
  activeRoute: string;
  profile?: StudentSidebarProfile | null;
}) {
  const router = useRouter();
  const translateX = React.useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;

  React.useEffect(() => {
    Animated.timing(translateX, {
      toValue: visible ? 0 : -SIDEBAR_WIDTH,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  const handleNavigate = (route: string) => {
    onClose();
    router.push(route as any);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />

        <Animated.View
          style={[styles.sidebar, { width: SIDEBAR_WIDTH, transform: [{ translateX }] }]}
        >
          <View style={styles.sidebarHeader}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X size={18} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.logoBadge}>
              <GraduationCap size={18} color="#111111" />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.sidebarTitle} numberOfLines={1}>
                Stephen Kanja <ThemedText style={styles.sidebarAccent}>School</ThemedText>
              </ThemedText>
              <ThemedText style={styles.sidebarSubtitle}>Aim Higher</ThemedText>
            </View>
          </View>

          <View style={styles.sidebarDivider} />

          <ScrollView contentContainerStyle={styles.sidebarScroll}>
            <ThemedText style={styles.sectionLabel}>MY PORTAL</ThemedText>
            {STUDENT_NAV_ITEMS.map((item) => {
              const isActive = item.route === activeRoute;
              const Icon = item.icon;
              return (
                <TouchableOpacity
                  key={item.route}
                  style={[styles.navItem, isActive && styles.navItemActive]}
                  onPress={() => handleNavigate(item.route)}
                >
                  <Icon size={18} color={isActive ? '#FFFFFF' : '#B3B3B3'} />
                  <ThemedText
                    style={[styles.navItemText, isActive && styles.navItemTextActive]}
                  >
                    {item.label}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.sidebarFooter}>
            <View style={styles.footerDivider} />
            <ThemedText style={styles.footerGrade}>{profile?.grade ?? 'Grade —'}</ThemedText>
            <ThemedText style={styles.footerId}>
              ID: <ThemedText style={styles.footerIdValue}>{profile?.admissionId ?? '—'}</ThemedText>
            </ThemedText>
            <ThemedText style={styles.footerCopyright}>© 2026 Kelvin Mutinda</ThemedText>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const COLORS = { gold: '#E8B923', darkPanel: '#1c1c1c' };

const styles = StyleSheet.create({
  modalRoot: { flex: 1, flexDirection: 'row' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: COLORS.darkPanel,
    paddingTop: 50,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  sidebarAccent: { color: COLORS.gold },
  sidebarSubtitle: { color: '#8A8A8A', fontSize: 9, letterSpacing: 1, marginTop: 2 },
  sidebarDivider: { height: 2, backgroundColor: COLORS.gold, marginBottom: 8 },
  sidebarScroll: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 20 },
  sectionLabel: {
    color: '#6f6f6f',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 8,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 2,
  },
  navItemActive: { backgroundColor: '#3a2f10', borderWidth: 1, borderColor: COLORS.gold },
  navItemText: { color: '#B3B3B3', fontSize: 14 },
  navItemTextActive: { color: '#FFFFFF', fontWeight: '600' },
  sidebarFooter: { paddingHorizontal: 20, paddingBottom: 24 },
  footerDivider: { height: 1, backgroundColor: '#2a2a2a', marginBottom: 14 },
  footerGrade: { color: '#8A8A8A', fontSize: 11, fontWeight: '700', marginBottom: 4 },
  footerId: { color: '#8A8A8A', fontSize: 11, marginBottom: 10 },
  footerIdValue: { color: '#e0e0e0', fontWeight: '700' },
  footerCopyright: { color: '#5a5a5a', fontSize: 10 },
});