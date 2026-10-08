import React, { useState } from "react";
import ThemedText from "@/components/themed-text";
import ThemedView from "@/components/themed-view";
import {
  LayoutDashboard,
  Users,
  FileUp,
  UserPlus,
  PieChart,
  GraduationCap,
  BookOpen,
  LineChart,
  Target,
  Menu,
  X,
  Home,
  TrendingUp,
  ClipboardCheck,
  Presentation,
  Bell,
  Grid3x3,
  Settings as SettingsIcon,
  Coins,
} from "lucide-react-native";
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  Dimensions,
  Modal,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";

const { width } = Dimensions.get("window");
const CARD_GAP = 12;
const CARD_WIDTH = (width - 20 * 2 - CARD_GAP) / 2; // 2-column grid with page padding

// ---------- Palette (main page) ----------
const GOLD = "#C9971E"; // slightly deepened for contrast on light surfaces
const CREAM_BG = "#F2EFEA";
const CARD_BG = "#FFFFFF";
const TEXT_DARK = "#14151A";
const TEXT_MUTED = "#6B6F76";
const BORDER = "#E5E3DE";
const GOLD_TINT = "#FBF2DC"; // soft gold wash for the highlighted card/badges

// ---------- Palette (sidebar — matches the HOI drawer) ----------
const SIDEBAR_BG = "#183766";       // deep navy
const SIDEBAR_BG_ALT = "#122744";   // slightly lighter navy for header/footer bands
const SIDEBAR_ACCENT = "#3B82F6";   // bluish accent (badges, active states, edge)
const SIDEBAR_ACCENT_TINT = "rgba(59, 130, 246, 0.14)";
const SIDEBAR_BORDER = "rgba(255,255,255,0.08)";
const SIDEBAR_TEXT = "#DCE4F0";
const SIDEBAR_TEXT_MUTED = "#7C8CA6";

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", subtitle: "Overview & statistics", icon: LayoutDashboard, route: "/dashboard" },
  { key: "students", label: "Students", subtitle: "Browse enrolled learners", icon: Users, route: "/students" },
  { key: "upload", label: "Upload Results", subtitle: "Submit exam scores", icon: FileUp, route: "/uploadResults", highlight: true },
   { key: "journey", label: "Academic Journey", subtitle: "Full academic history", icon: GraduationCap, route: "/results" },
  { key: "register", label: "Register Learner", subtitle: "Enroll a new student", icon: UserPlus, route: "/registerLearner" },
  { key: "results", label: "Results", subtitle: "View exam results", icon: PieChart, route: "/results" },
    { key: "Send-sms", label: "Send Reulsts sms", subtitle: "Send Results", icon: PieChart, route: "/sendResults" },
  { key: "materials", label: "Learning Materials", subtitle: "Resources & documents", icon: BookOpen, route: "/learningMaterials" },
  { key: "progress", label: "Progress Records", subtitle: "Track student progress", icon: LineChart, route: "/progress" },
  { key: "track", label: "Track Learners", subtitle: "Monitor performance", icon: Target, route: "/track" },
];

// Sidebar sections — mirrors the drawer used on the Learning Materials screen
type SidebarItem = { label: string; icon: React.ComponentType<any>; route?: string };

const MAIN_ITEMS: SidebarItem[] = [
  { label: "Home", icon: Home, route: "/teachers" },
  { label: "Students", icon: Users, route: "/students" },
  { label: "Progress Records", icon: TrendingUp, route: "/progress" },
];

const ACADEMIC_ITEMS: SidebarItem[] = [
  { label: "Results", icon: PieChart, route: "/results" },
  { label: "Upload Results", icon: FileUp, route: "/uploadResults" },
  { label: "Track Performance", icon: Target, route: "/track" },
  { label: "Learning Materials", icon: BookOpen, route: "/learningMaterials" },
];

const ADMIN_ITEMS: SidebarItem[] = [
  { label: "Register Learners", icon: UserPlus, route: "/registerLearner" },
  { label: "Attendance", icon: ClipboardCheck, route: "/attendance" },
  { label: "Notices", icon: Bell, route: "/notices" },
];

const FINANCE_ITEMS: SidebarItem[] = [
  { label: "Finances", icon: Coins, route: "/trackFees" },
];

export default function TeachersHome() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Replace with real data from your API/DB
  const stats = { learners: 302, teachers: 6, classes: 9 };

  const navigateTo = (route?: string) => {
    setSidebarOpen(false);
    if (route) router.push(route);
  };

  const renderSidebarSection = (title: string, items: SidebarItem[]) => (
    <View style={sidebarStyles.section}>
      <ThemedText style={sidebarStyles.sectionTitle}>{title}</ThemedText>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <TouchableOpacity
            key={item.label}
            style={sidebarStyles.item}
            onPress={() => navigateTo(item.route)}
          >
            <Icon size={18} color={SIDEBAR_TEXT_MUTED} style={{ marginRight: 12 }} />
            <ThemedText style={sidebarStyles.itemText}>{item.label}</ThemedText>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.page} showsVerticalScrollIndicator={false}>
        {/* Top Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.menuButton} onPress={() => setSidebarOpen(true)}>
              <Menu size={18} color={TEXT_DARK} />
            </TouchableOpacity>
            <View style={styles.logoBadge}>
              <GraduationCap size={20} color="#111111" />
            </View>
            <View>
              <ThemedText style={styles.header1}>
                Stephen Kanja <ThemedText style={styles.headerAccent}>School</ThemedText>
              </ThemedText>
              <ThemedText style={styles.header2}>Aim Higher</ThemedText>
            </View>
          </View>
        </View>

        {/* Welcome / Stats Card */}
        <View style={styles.welcomeCard}>
          <ThemedText style={styles.eyebrow}>TEACHER DASHBOARD</ThemedText>
          <ThemedText style={styles.welcome}>Welcome Back ✨</ThemedText>
          <ThemedText style={styles.school}>
            Stephen Kanja Primary & Junior School — Academic Portal
          </ThemedText>

          <View style={styles.statsRow}>
            <View style={styles.statBlock}>
              <ThemedText style={styles.statNumber}>{stats.learners}</ThemedText>
              <ThemedText style={styles.statLabel}>LEARNERS</ThemedText>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBlock}>
              <ThemedText style={styles.statNumber}>{stats.teachers}</ThemedText>
              <ThemedText style={styles.statLabel}>TEACHERS</ThemedText>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBlock}>
              <ThemedText style={styles.statNumber}>{stats.classes}</ThemedText>
              <ThemedText style={styles.statLabel}>CLASSES</ThemedText>
            </View>
          </View>
        </View>

        {/* Quick Navigation */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.bullet} />
          <ThemedText style={styles.sectionHeader}>QUICK NAVIGATION</ThemedText>
        </View>

        <View style={styles.grid}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.card, item.highlight && styles.cardHighlight]}
                activeOpacity={0.75}
                onPress={() => router.push(item.route)}
              >
                <View
                  style={[
                    styles.iconBadge,
                    item.highlight && styles.iconBadgeHighlight,
                  ]}
                >
                  <Icon
                    size={18}
                    color={item.highlight ? "#FFFFFF" : GOLD}
                  />
                </View>
                <ThemedText style={styles.cardLabel}>{item.label}</ThemedText>
                <ThemedText style={styles.cardSubtitle}>
                  {item.subtitle}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>

        <ThemedText style={styles.footer}>© 2026 Kelvin Mutinda</ThemedText>
      </ScrollView>

      {/* Sidebar Drawer — bluish HOI style */}
      <Modal
        visible={sidebarOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setSidebarOpen(false)}
      >
        <Pressable style={sidebarStyles.overlay} onPress={() => setSidebarOpen(false)}>
          <Pressable style={sidebarStyles.sidebar} onPress={(e) => e.stopPropagation()}>
            <View style={sidebarStyles.header}>
              <TouchableOpacity style={sidebarStyles.iconButton} onPress={() => setSidebarOpen(false)}>
                <X size={18} color={SIDEBAR_TEXT} />
              </TouchableOpacity>
              <View style={sidebarStyles.iconButtonAccent}>
                <GraduationCap size={16} color="#FFFFFF" />
              </View>
              <View style={{ marginLeft: 10 }}>
                <ThemedText style={sidebarStyles.brand}>
                  STEPHEN KANJA <ThemedText style={{ color: SIDEBAR_ACCENT }}>SCHOOL</ThemedText>
                </ThemedText>
                <ThemedText style={sidebarStyles.tagline}>AIM HIGHER</ThemedText>
              </View>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 12 }}
            >
              {renderSidebarSection("MAIN", MAIN_ITEMS)}
              {renderSidebarSection("ACADEMICS", ACADEMIC_ITEMS)}
              {renderSidebarSection("ADMINISTRATION", ADMIN_ITEMS)}
              {renderSidebarSection("FINANCE", FINANCE_ITEMS)}
            </ScrollView>

            <ThemedText style={sidebarStyles.footer}>© 2026 Kelvin Mutinda{"\n"}infinityfreeapp.com</ThemedText>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: CREAM_BG,
    paddingHorizontal: 20,
  },
  header: {
    backgroundColor: "transparent",
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  menuButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  header1: {
    color: TEXT_DARK,
    fontSize: 17,
    fontWeight: "700",
  },
  headerAccent: {
    color: GOLD,
  },
  header2: {
    color: TEXT_MUTED,
    fontSize: 11,
    letterSpacing: 1,
    marginTop: 2,
  },
  welcomeCard: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 18,
    marginTop: 12,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  eyebrow: {
    color: GOLD,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  welcome: {
    color: TEXT_DARK,
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 6,
  },
  school: {
    color: TEXT_MUTED,
    fontSize: 12,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 14,
  },
  statBlock: {
    alignItems: "center",
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: BORDER,
  },
  statNumber: {
    color: TEXT_DARK,
    fontSize: 22,
    fontWeight: "800",
  },
  statLabel: {
    color: TEXT_MUTED,
    fontSize: 9,
    letterSpacing: 1,
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 24,
    marginBottom: 12,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: GOLD,
  },
  sectionHeader: {
    color: TEXT_DARK,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: CARD_GAP,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 14,
    marginBottom: CARD_GAP,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardHighlight: {
    borderColor: GOLD,
    backgroundColor: GOLD_TINT,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "#F2EFEA",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  iconBadgeHighlight: {
    backgroundColor: GOLD,
  },
  cardLabel: {
    color: TEXT_DARK,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  cardSubtitle: {
    color: TEXT_MUTED,
    fontSize: 10.5,
  },
  footer: {
    color: "#A9ADB3",
    fontSize: 10,
    textAlign: "center",
    marginTop: 20,
    marginBottom: 30,
  },
});

const sidebarStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    flexDirection: "row",
  },
  sidebar: {
    width: "78%",
    maxWidth: 320,
    height: "100%",
    backgroundColor: SIDEBAR_BG,
    paddingTop: 50,
    paddingHorizontal: 16,
    borderRightWidth: 2,
    borderRightColor: SIDEBAR_ACCENT,
    // Web: hide the native scrollbar chrome on the drawer itself while
    // keeping it scrollable (belt-and-braces alongside the RN ScrollView
    // prop above, in case the outer Pressable ever needs to scroll too).
    // @ts-ignore - web-only style, ignored on native
    scrollbarWidth: "none",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: SIDEBAR_BORDER,
    marginBottom: 8,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  iconButtonAccent: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: SIDEBAR_ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 13,
    letterSpacing: 0.5,
  },
  tagline: {
    color: SIDEBAR_TEXT_MUTED,
    fontSize: 9,
    letterSpacing: 1,
    marginTop: 2,
  },
  section: { marginTop: 18 },
  sectionTitle: {
    color: SIDEBAR_TEXT_MUTED,
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: "700",
    marginBottom: 8,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  itemText: {
    color: SIDEBAR_TEXT,
    fontSize: 13,
    fontWeight: "500",
  },
  footer: {
    color: SIDEBAR_TEXT_MUTED,
    fontSize: 10,
    textAlign: "center",
    paddingVertical: 20,
  },
});