import React, { useEffect, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Menu,
  GraduationCap,
  LogOut,
  PieChart,
  Users,
  ClipboardCheck,
  Coins,
  Megaphone,
  Calendar,
  Bell,
} from "lucide-react-native";
import ThemedView from "@/components/themed-view";
import ThemedText from "@/components/themed-text";
import StudentSidebar from "@/components/student-sidebar";

// ---------------------------------------------------------------------------
// SESSION / BACKEND STUBS
// The learner's identity comes from whatever auth/session your login screen
// already sets (e.g. AsyncStorage token, context, or a cookie the PHP
// session reads). Replace the body of these two functions with the real
// calls once that's wired up — the shapes below are what the UI expects.
// ---------------------------------------------------------------------------
type StudentProfile = {
  firstName: string;
  grade: string;
  admissionId: string;
  schoolName: string;
  avatarInitials: string;
};

type StudentStats = {
  averageScore: number | null;
  subjectsCount: number;
  currentTerm: string;
  attendanceRate: number | null;
  totalPaid: number;
  paymentRecords: number;
};

async function fetchLoggedInStudent(): Promise<StudentProfile> {
  // TODO: replace with the real session lookup, e.g.
  // const token = await AsyncStorage.getItem('authToken');
  // const res = await fetch(`${API_BASE_URL}/me.php`, { headers: { Authorization: `Bearer ${token}` } });
  // return await res.json();
  return {
    firstName: "",
    grade: "",
    admissionId: "",
    schoolName: "Stephen Kanja School",
    avatarInitials: "",
  };
}

async function fetchStudentStats(admissionId: string): Promise<StudentStats> {
  // TODO: replace with e.g.
  // const res = await fetch(`${API_BASE_URL}/student_dashboard_stats.php?id=${admissionId}`);
  // return await res.json();
  return {
    averageScore: null,
    subjectsCount: 0,
    currentTerm: "Term 1 2026",
    attendanceRate: null,
    totalPaid: 0,
    paymentRecords: 0,
  };
}

const QUICK_ACCESS = [
  {
    label: "My Results",
    subtitle: "View scores & grades by subject",
    icon: PieChart,
    color: "#2e7d32",
    route: "/my-results",
  },
  {
    label: "Grade Performance",
    subtitle: "See how your grade is doing",
    icon: Users,
    color: "#6d28d9",
    route: "/grade-performance",
  },
  {
    label: "Attendance",
    subtitle: "Monthly attendance record",
    icon: ClipboardCheck,
    color: "#0e7490",
    route: "/attendance",
  },
  {
    label: "Fees",
    subtitle: "Payment history & records",
    icon: Coins,
    color: "#b7860b",
    route: "/student-fees",
  },
  {
    label: "Notices",
    subtitle: "Latest school announcements",
    icon: Megaphone,
    color: "#c62828",
    route: "/notices",
  },
  {
    label: "Timetable",
    subtitle: "Weekly class schedule",
    icon: Calendar,
    color: "#1d4ed8",
    route: "/timetable",
  },
];

export default function StudentDashboard() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const p = await fetchLoggedInStudent();
      setProfile(p);
      const s = await fetchStudentStats(p.admissionId);
      setStats(s);
      setLoading(false);
    })();
  }, []);

  const handleLogout = () => {
    // TODO: clear session/token here, then redirect to login
    router.replace("/login" as any);
  };

  return (
    <ThemedView style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.menuButton} onPress={() => setSidebarOpen(true)}>
            <Menu size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.logoBadge}>
            <GraduationCap size={20} color="#111111" />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.header1} numberOfLines={1}>
              Stephen Kanja <ThemedText style={styles.headerAccent}>School</ThemedText>
            </ThemedText>
            <ThemedText style={styles.header2}>AIM HIGHER</ThemedText>
          </View>
          <View style={styles.avatarBadge}>
            <ThemedText style={styles.avatarBadgeText}>{profile?.avatarInitials || "—"}</ThemedText>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <LogOut size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        {/* Welcome hero */}
        <View style={styles.heroCard}>
          <ThemedText style={styles.heroEyebrow}>STUDENT DASHBOARD</ThemedText>
          <ThemedText style={styles.heroTitle}>
            WELCOME, <ThemedText style={styles.heroTitleAccent}>{(profile?.firstName || "—").toUpperCase()}</ThemedText>
          </ThemedText>
          <ThemedText style={styles.heroMeta}>
            {profile?.grade || "Grade —"} · ID: {profile?.admissionId || "—"} · {profile?.schoolName}
          </ThemedText>

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatPill}>
              <ThemedText style={styles.heroStatValue}>
                {stats?.averageScore != null ? `${stats.averageScore}%` : "0%"}
              </ThemedText>
              <ThemedText style={styles.heroStatLabel}>MY AVG</ThemedText>
            </View>
            <View style={styles.heroStatPill}>
              <ThemedText style={styles.heroStatValue}>
                {stats?.attendanceRate != null ? `${stats.attendanceRate}%` : "—"}
              </ThemedText>
              <ThemedText style={styles.heroStatLabel}>ATTENDANCE</ThemedText>
            </View>
            <View style={styles.heroStatPill}>
              <ThemedText style={styles.heroStatValue}>
                KES {(stats?.totalPaid ?? 0).toLocaleString()}
              </ThemedText>
              <ThemedText style={styles.heroStatLabel}>TOTAL PAID</ThemedText>
            </View>
          </View>
        </View>

        {/* Summary cards */}
        <View style={styles.summaryGrid}>
          <View style={[styles.summaryCard, { borderTopColor: "#2e7d32" }]}>
            <ThemedText style={[styles.summaryValue, { color: "#2e7d32" }]}>
              {stats?.averageScore != null ? `${stats.averageScore}%` : "0%"}
            </ThemedText>
            <ThemedText style={styles.summaryLabel}>AVERAGE SCORE</ThemedText>
            <ThemedText style={styles.summaryCaption}>
              {stats?.subjectsCount ?? 0} subjects · {stats?.currentTerm ?? "—"}
            </ThemedText>
          </View>

          <View style={[styles.summaryCard, { borderTopColor: "#1d4ed8" }]}>
            <ThemedText style={[styles.summaryValue, { color: "#1d4ed8" }]}>
              {stats?.attendanceRate != null ? `${stats.attendanceRate}%` : "—"}
            </ThemedText>
            <ThemedText style={styles.summaryLabel}>ATTENDANCE</ThemedText>
            <ThemedText style={styles.summaryCaption}>
              {stats?.attendanceRate != null ? "Updated this term" : "No records yet"}
            </ThemedText>
          </View>
        </View>

        <View style={[styles.summaryCard, styles.summaryCardWide, { borderTopColor: "#E8B923" }]}>
          <ThemedText style={[styles.summaryValue, { color: "#b7860b" }]}>
            KES {(stats?.totalPaid ?? 0).toLocaleString()}
          </ThemedText>
          <ThemedText style={styles.summaryLabel}>TOTAL PAID</ThemedText>
          <ThemedText style={styles.summaryCaption}>
            {stats?.paymentRecords ?? 0} payment records
          </ThemedText>
        </View>

        {/* Quick access */}
        <View style={styles.quickAccessHeader}>
          <View style={styles.quickAccessDot} />
          <ThemedText style={styles.quickAccessTitle}>QUICK ACCESS</ThemedText>
        </View>

        <View style={styles.quickAccessGrid}>
          {QUICK_ACCESS.map((item) => {
            const Icon = item.icon;
            return (
              <TouchableOpacity
                key={item.route}
                style={[styles.qaCard, { borderTopColor: item.color }]}
                onPress={() => router.push(item.route as any)}
              >
                <View style={[styles.qaIconBadge, { backgroundColor: item.color }]}>
                  <Icon size={20} color="#FFFFFF" />
                </View>
                <ThemedText style={styles.qaTitle}>{item.label}</ThemedText>
                <ThemedText style={styles.qaSubtitle}>{item.subtitle}</ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Latest notices */}
        <View style={styles.sectionBar}>
          <Bell size={16} color="#E8B923" />
          <ThemedText style={styles.sectionBarText}>LATEST NOTICES</ThemedText>
        </View>
        <View style={[styles.card, styles.cardTopFlush]}>
          {loading ? (
            <View style={styles.noticesEmpty}>
              <ActivityIndicator size="small" color="#E8B923" />
            </View>
          ) : (
            <View style={styles.noticesEmpty}>
              <ThemedText style={styles.noticesEmptyText}>No notices posted yet.</ThemedText>
            </View>
          )}
        </View>
      </ScrollView>

      <StudentSidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeRoute="/student-dashboard"
        profile={profile ? { grade: profile.grade || "Grade —", admissionId: profile.admissionId || "—" } : null}
      />
    </ThemedView>
  );
}

const COLORS = { gold: "#E8B923", dark: "#141414", bg: "#f4f4f5", border: "#e5e5e5" };

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    backgroundColor: COLORS.dark,
    paddingTop: 50,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.gold,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  menuButton: {
    width: 36, height: 36, borderRadius: 8, backgroundColor: "#2a2a2a",
    alignItems: "center", justifyContent: "center",
  },
  logoBadge: {
    width: 36, height: 36, borderRadius: 8, backgroundColor: COLORS.gold,
    alignItems: "center", justifyContent: "center",
  },
  header1: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  headerAccent: { color: COLORS.gold },
  header2: { color: "#8A8A8A", fontSize: 10, letterSpacing: 1, marginTop: 2 },
  avatarBadge: {
    width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: COLORS.gold,
    alignItems: "center", justifyContent: "center", backgroundColor: "#2a2a2a",
  },
  avatarBadgeText: { color: COLORS.gold, fontSize: 11, fontWeight: "700" },
  logoutButton: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: "#2a2a2a",
    alignItems: "center", justifyContent: "center",
  },
  body: { flex: 1 },
  bodyContent: { padding: 20, paddingBottom: 60 },
  // Hero
  heroCard: {
    backgroundColor: COLORS.dark,
    borderRadius: 16,
    borderTopWidth: 3,
    borderTopColor: COLORS.gold,
    padding: 20,
    marginBottom: 20,
  },
  heroEyebrow: { color: COLORS.gold, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 6 },
  heroTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: "900", marginBottom: 8 },
  heroTitleAccent: { color: COLORS.gold },
  heroMeta: { color: "#9a9a9a", fontSize: 12, marginBottom: 18 },
  heroStatsRow: { flexDirection: "row", gap: 10 },
  heroStatPill: {
    flex: 1,
    backgroundColor: "#000000",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  heroStatValue: { color: COLORS.gold, fontSize: 15, fontWeight: "800", marginBottom: 2 },
  heroStatLabel: { color: "#7a7a7a", fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },
  // Summary cards
  summaryGrid: { flexDirection: "row", gap: 12, marginBottom: 12 },
  summaryCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderTopWidth: 3,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  summaryCardWide: { marginBottom: 20 },
  summaryValue: { fontSize: 26, fontWeight: "800", marginBottom: 6 },
  summaryLabel: { fontSize: 11, fontWeight: "700", color: "#8A8A8A", letterSpacing: 0.5, marginBottom: 4 },
  summaryCaption: { fontSize: 11, color: "#9a9a9a" },
  // Quick access
  quickAccessHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  quickAccessDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.gold },
  quickAccessTitle: { fontSize: 13, fontWeight: "800", color: "#141414", letterSpacing: 1 },
  quickAccessGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  qaCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderTopWidth: 3,
    padding: 16,
    marginBottom: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  qaIconBadge: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  qaTitle: { fontSize: 14, fontWeight: "700", color: "#141414", marginBottom: 4 },
  qaSubtitle: { fontSize: 11, color: "#8A8A8A", lineHeight: 15 },
  // Notices
  sectionBar: {
    backgroundColor: COLORS.dark,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.gold,
  },
  sectionBarText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700", letterSpacing: 0.5 },
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    padding: 18,
  },
  cardTopFlush: { borderTopWidth: 0 },
  noticesEmpty: { paddingVertical: 24, alignItems: "center" },
  noticesEmptyText: { fontSize: 13, color: "#8A8A8A" },
});