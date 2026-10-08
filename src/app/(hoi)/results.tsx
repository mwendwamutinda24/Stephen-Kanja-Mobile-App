// src/app/(hoi)/results.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Pressable,
  Dimensions,
  Alert,
  Platform,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { BarChart, PieChart, StackedBarChart, LineChart } from "react-native-chart-kit";
import ThemedView from "@/components/themed-view";
import { apiRequest } from "@/services/api/client";
// NOTE: resultsExport.ts is PDF-only now. There is no `exportMarklistExcel`
// export any more — importing it gave `undefined`, and calling it threw
// "exportMarklistExcel is not a function" (the red error in the overlay).
import { exportAnalysisPdf, exportReportCardsPdf } from "@/services/resultsExport";

const GOLD = "#D4A017";
const DARK = "#14151A";
const CARD_BG = "#FFFFFF";
const PAGE_BG = "#F2EFEA";
const LABEL_GRAY = "#8A8F98";
const BLUE = "#1A4A7A";

const TIER_COLOR: Record<string, string> = { ee: "#16A34A", me: BLUE, ae: "#D97706", be: "#991B1B" };
const TIER_LABEL: Record<string, string> = {
  ee: "Exceeding (E.E)",
  me: "Meeting (M.E)",
  ae: "Approaching (A.E)",
  be: "Below (B.E)",
};

const BAND_COLOR: Record<string, { fg: string; bg: string }> = {
  "E.E": { fg: "#16A34A", bg: "#DCFCE7" },
  "M.E": { fg: BLUE,      bg: "#DCE8F5" },
  "A.E": { fg: "#B45309", bg: "#FEF3C7" },
  "B.E": { fg: "#991B1B", bg: "#FEE2E2" },
  EE2: { fg: "#15803D", bg: "#BBF7D0" }, EE1: { fg: "#16A34A", bg: "#DCFCE7" },
  ME2: { fg: "#123657", bg: "#CFE0F3" }, ME1: { fg: BLUE,      bg: "#DCE8F5" },
  AE2: { fg: "#92400E", bg: "#FDE68A" }, AE1: { fg: "#B45309", bg: "#FEF3C7" },
  BE2: { fg: "#7F1D1D", bg: "#FECACA" }, BE1: { fg: "#991B1B", bg: "#FEE2E2" },
};
function bandColor(code: string) {
  return BAND_COLOR[code] ?? { fg: "#3D4F5C", bg: PAGE_BG };
}

const GRADES = Array.from({ length: 9 }, (_, i) => String(i + 1));
const TERMS = ["1", "2", "3"];
const EXAM_TYPES = [
  { value: "opener", label: "Opener" },
  { value: "midterm", label: "Mid Term" },
  { value: "endterm", label: "End Term" },
];
const YEARS = ["2026", "2027", "2028"];

/* ── Response types ── */
type Meta = {
  gradeInt: number; isLowerGrade: boolean; term: string; examType: string; examLabel: string; year: string;
  studentCount: number; subjectCount: number; totalOutOf: number; classMeanTotal: number; classMeanSubject: number; generatedAt: string;
};
type BandsOverall = { ee: number; eeP: number; me: number; meP: number; ae: number; aeP: number; be: number; beP: number };
type BreakdownRow = { code: string; label: string; count: number; pct: number };
type SplitBands = {
  EE1: number; EE2: number; ME1: number; ME2: number;
  AE1: number; AE2: number; BE1: number; BE2: number;
};
type SubjectSummary = {
  code: string; label: string; mean: number; tier: "ee" | "me" | "ae" | "be";
  bands: { ee: number; me: number; ae: number; be: number };
  // Populated by the updated my_results.php (used by the Analysis PDF):
  splitBands?: SplitBands;
  entry?: number;
  avgPoints?: number;
  prevPoints?: number | null;
  teacher?: string;
};
type ComparisonSubject = { code: string; label: string; current: number; previous: number; change: number };
type StudentSubject = { code: string; label: string; score: number; bandCode: string };
type StudentRow = {
  rank: number; assesment: string; firstName: string; lastName: string; subjects: StudentSubject[]; total: number; bandCode: string;
  // Populated by the updated my_results.php (used by the Analysis PDF):
  admNo?: string;
  stream?: string;
  streamPos?: number;
  totalPoints?: number;
  avgPoints?: number;
  prevOverallPos?: number | null;
  prevStreamPos?: number | null;
  prevPoints?: number | null;
};
type ClassMeanRow = { subjects: { code: string; label: string; score: number }[]; total: number; bandCode: string };

type StaffDashboard = {
  success: boolean; grade: string; studentCount: number; message?: string;
  meta?: Meta;
  kpis?: { totalStudents: number; exceedingCount: number; exceedingPct: number; belowCount: number; belowPct: number };
  bands?: { overall: BandsOverall; breakdown: BreakdownRow[] };
  subjects?: SubjectSummary[];
  comparison?: { hasPrevious: boolean; previousLabel: string; subjects: ComparisonSubject[]; classMeanCurrent: number; classMeanPrevious: number; studentCountPrevious: number };
  students?: StudentRow[];
  classMeanRow?: ClassMeanRow;
};

type StudentSelfResponse = {
  success: boolean;
  student: { id: string; name: string; average: number | null; hasResults: boolean } | null;
  subjects: { subject: string; score: number; grade: string; remarks?: string }[];
};

type ResultsResponse = StaffDashboard | StudentSelfResponse;

function isStaffResponse(data: ResultsResponse): data is StaffDashboard {
  return "grade" in data;
}

type SidebarItem = { label: string; icon: keyof typeof Ionicons.glyphMap };
const MAIN_ITEMS: SidebarItem[] = [
  { label: "Home", icon: "home-outline" },
  { label: "Students", icon: "school-outline" },
  { label: "Progress Records", icon: "trending-up-outline" },
];
const ACADEMIC_ITEMS: SidebarItem[] = [
  { label: "Results", icon: "pie-chart-outline" },
  { label: "Upload Results", icon: "cloud-upload-outline" },
  { label: "Track Performance", icon: "locate-outline" },
  { label: "Learning Materials", icon: "book-outline" },
];
const ADMIN_ITEMS: SidebarItem[] = [
  { label: "Register Learners", icon: "person-add-outline" },
  { label: "Register Teachers", icon: "person-add-outline" },
];
const FINANCE_ITEMS: SidebarItem[] = [{ label: "Finances", icon: "cash-outline" }];

const screenWidth = Dimensions.get("window").width;
const CHART_WIDTH = screenWidth - 64;

const chartConfig = {
  backgroundGradientFrom: "#FFFFFF",
  backgroundGradientTo: "#FFFFFF",
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(26, 74, 122, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(122, 144, 158, ${opacity})`,
  barPercentage: 0.6,
  propsForBackgroundLines: { stroke: "#E5E3DE" },
};

function shortLabel(l: string) {
  return l.length > 8 ? l.slice(0, 4) + "." : l;
}

/* react-native-web's Alert.alert is a no-op, so on web errors would fail
   silently. Use window.alert there and the native Alert everywhere else. */
function showMessage(title: string, message: string) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message, [{ text: "OK" }]);
}

function savedHint() {
  return Platform.OS === "android"
    ? "Find it in your chosen folder (Downloads by default)."
    : "Choose “Save to Files” from the share sheet.";
}

export default function Results() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [grade, setGrade] = useState("");
  const [term, setTerm] = useState("");
  const [examType, setExamType] = useState("");
  const [year, setYear] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"analysis" | "cards" | null>(null);
  const [dashboard, setDashboard] = useState<StaffDashboard | null>(null);
  const [selfResult, setSelfResult] = useState<StudentSelfResponse | null>(null);

  const allSelected = grade && term && examType && year;

  const fetchResults = async () => {
    if (!allSelected) return;
    setLoading(true);
    setError(null);
    setDashboard(null);
    setSelfResult(null);

    try {
      const data = await apiRequest<ResultsResponse>("/results/my_results.php", {
        method: "POST",
        body: { grade, term, examType, year },
      });

      if (isStaffResponse(data)) {
        setDashboard(data);
      } else {
        setSelfResult(data);
      }
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong while fetching results.");
    } finally {
      setLoading(false);
    }
  };

  /* ── EXPORT HANDLERS (PDF only) ─────────────────────────── */
  const handleExportAnalysis = async () => {
    if (!dashboard) return;
    setExporting("analysis");
    try {
      const { filename } = await exportAnalysisPdf(dashboard);
      // On web the browser print dialog opens ("Save as PDF"), so no
      // success popup is needed there.
      if (Platform.OS !== "web") {
        showMessage("Analysis saved", `${filename}\n\n${savedHint()}`);
      }
    } catch (e: any) {
      console.error("[export] analysis failed", e);
      showMessage("Export failed", e?.message ?? "Could not generate the analysis PDF.");
    } finally {
      setExporting(null);
    }
  };

  const handleExportReportCards = async () => {
    if (!dashboard) return;
    setExporting("cards");
    try {
      const { filename } = await exportReportCardsPdf(dashboard);
      if (Platform.OS !== "web") {
        showMessage("Report cards saved", `${filename}\n\n${savedHint()}`);
      }
    } catch (e: any) {
      console.error("[export] report cards failed", e);
      showMessage("Export failed", e?.message ?? "Could not generate the report cards.");
    } finally {
      setExporting(null);
    }
  };

  /* ── Sidebar section renderer ──────────────────────────── */
  const renderSidebarSection = (title: string, items: SidebarItem[]) => (
    <View style={styles.sidebarSection}>
      <Text style={styles.sidebarSectionTitle}>{title}</Text>
      {items.map((item) => {
        const isActive = item.label === "Results";
        return (
          <TouchableOpacity
            key={item.label}
            style={[styles.sidebarItem, isActive && styles.sidebarItemActive]}
            onPress={() => setSidebarOpen(false)}
          >
            <Ionicons name={item.icon} size={18} color={isActive ? GOLD : "#C9CCD1"} style={{ marginRight: 12 }} />
            <Text style={[styles.sidebarItemText, isActive && styles.sidebarItemTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  /* ── Dashboard sub-sections ── */
  const renderKpis = (d: StaffDashboard) => {
    if (!d.kpis || !d.meta) return null;
    const items = [
      { label: "TOTAL STUDENTS", val: d.kpis.totalStudents, sub: "in this grade & exam", accent: DARK },
      { label: "EXCEEDING EXPECTATIONS", val: d.kpis.exceedingCount, sub: `${d.kpis.exceedingPct}% of class — Avg ≥75/subject`, accent: "#16A34A" },
      { label: "CLASS MEAN SCORE", val: d.meta.classMeanTotal, sub: `out of ${d.meta.totalOutOf} — ${d.meta.classMeanSubject} avg/subject`, accent: BLUE },
      { label: "BELOW EXPECTATIONS", val: d.kpis.belowCount, sub: `${d.kpis.belowPct}% of class — Avg <26/subject`, accent: "#991B1B" },
    ];
    return (
      <View style={styles.kpiGrid}>
        {items.map((it) => (
          <View key={it.label} style={[styles.kpiCard, { borderTopColor: it.accent }]}>
            <Text style={styles.kpiLabel}>{it.label}</Text>
            <Text style={styles.kpiVal}>{it.val}</Text>
            <Text style={styles.kpiSub}>{it.sub}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderBands = (d: StaffDashboard) => {
    if (!d.bands || !d.subjects) return null;
    const o = d.bands.overall;
    const rows: { key: keyof typeof TIER_LABEL; count: number; pct: number }[] = [
      { key: "ee", count: o.ee, pct: o.eeP },
      { key: "me", count: o.me, pct: o.meP },
      { key: "ae", count: o.ae, pct: o.aeP },
      { key: "be", count: o.be, pct: o.beP },
    ];
    return (
      <View style={styles.twoColRow}>
        <View style={styles.card}>
          <Text style={styles.cardHeading}>Student Achievement Bands (Overall)</Text>
          {rows.map((r) => (
            <View key={r.key} style={styles.bandRow}>
              <Text style={[styles.bandLabel, { color: TIER_COLOR[r.key] }]}>{TIER_LABEL[r.key]}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${r.pct}%`, backgroundColor: TIER_COLOR[r.key] }]} />
              </View>
              <Text style={styles.bandCount}>{r.count} ({r.pct}%)</Text>
            </View>
          ))}
        </View>
        <View style={styles.card}>
          <Text style={styles.cardHeading}>Subject Means vs Benchmark (out of 100)</Text>
          {d.subjects.map((s) => (
            <View key={s.code} style={styles.bandRow}>
              <Text style={styles.bandLabelSubject}>{s.label}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${Math.min(100, s.mean)}%`, backgroundColor: TIER_COLOR[s.tier] }]} />
              </View>
              <Text style={styles.bandCount}>{s.mean}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderBreakdownTable = (d: StaffDashboard) => {
    if (!d.bands) return null;
    return (
      <View style={styles.card}>
        <Text style={styles.cardHeading}>Performance Breakdown</Text>
        <View style={styles.tableHeaderRow}>
          <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Level</Text>
          <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Meaning</Text>
          <Text style={styles.tableHeaderCell}>Students</Text>
          <Text style={styles.tableHeaderCell}>%</Text>
        </View>
        {d.bands.breakdown.map((row, i) => (
          <View key={row.code} style={[styles.tableRow, i % 2 === 1 && { backgroundColor: "#FAFAFA" }]}>
            <Text style={[styles.tableCell, { flex: 1, fontWeight: "700" }]}>{row.code}</Text>
            <Text style={[styles.tableCell, { flex: 2 }]}>{row.label}</Text>
            <Text style={styles.tableCell}>{row.count}</Text>
            <Text style={styles.tableCell}>{row.pct}%</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderCharts = (d: StaffDashboard) => {
    if (!d.subjects || !d.bands) return null;
    const labels = d.subjects.map((s) => shortLabel(s.label));
    const means = d.subjects.map((s) => s.mean);

    const pieData = [
      { name: "Exceeding",   population: d.bands.overall.ee, color: "#16A34A", legendFontColor: LABEL_GRAY, legendFontSize: 11 },
      { name: "Meeting",     population: d.bands.overall.me, color: BLUE,      legendFontColor: LABEL_GRAY, legendFontSize: 11 },
      { name: "Approaching", population: d.bands.overall.ae, color: "#D97706", legendFontColor: LABEL_GRAY, legendFontSize: 11 },
      { name: "Below",       population: d.bands.overall.be, color: "#991B1B", legendFontColor: LABEL_GRAY, legendFontSize: 11 },
    ];

    const stackedData = {
      labels,
      legend: ["E.E", "M.E", "A.E", "B.E"],
      data: d.subjects.map((s) => [s.bands.ee, s.bands.me, s.bands.ae, s.bands.be]),
      barColors: ["#16A34A", BLUE, "#D97706", "#991B1B"],
    };

    return (
      <>
        <View style={styles.card}>
          <Text style={styles.cardHeading}>Subject Mean Scores (out of 100)</Text>
          <BarChart
            data={{ labels, datasets: [{ data: means }] }}
            width={CHART_WIDTH}
            height={220}
            fromZero
            yAxisLabel=""
            yAxisSuffix=""
            chartConfig={chartConfig}
            style={styles.chart}
          />
        </View>
        <View style={styles.card}>
          <Text style={styles.cardHeading}>Class Achievement Distribution</Text>
          <PieChart
            data={pieData}
            width={CHART_WIDTH}
            height={200}
            chartConfig={chartConfig}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="8"
          />
        </View>
        <View style={styles.card}>
          <Text style={styles.cardHeading}>Per-Subject Band Breakdown</Text>
          <StackedBarChart
            data={stackedData}
            width={CHART_WIDTH}
            height={260}
            chartConfig={chartConfig}
            style={styles.chart}
            hideLegend={false}
          />
        </View>
      </>
    );
  };

  const renderComparison = (d: StaffDashboard) => {
    if (!d.comparison) return null;
    const c = d.comparison;
    return (
      <View style={styles.card}>
        <Text style={styles.cardHeading}>Comparison with Previous Exam</Text>
        {!c.hasPrevious ? (
          <View style={styles.noPrev}>
            <MaterialCommunityIcons name="chart-line" size={28} color={GOLD} />
            <Text style={styles.emptyStateText}>No previous exam data found to compare against.</Text>
          </View>
        ) : (
          <>
            <LineChart
              data={{
                labels: c.subjects.map((s) => shortLabel(s.label)),
                datasets: [
                  { data: c.subjects.map((s) => s.current),  color: () => BLUE,                  strokeWidth: 3 },
                  { data: c.subjects.map((s) => s.previous), color: () => "rgba(15,25,35,0.4)",  strokeWidth: 2 },
                ],
                legend: [`Current: ${d.meta?.examLabel}`, `Previous: ${c.previousLabel}`],
              }}
              width={CHART_WIDTH}
              height={240}
              fromZero
              chartConfig={chartConfig}
              bezier
              style={styles.chart}
            />
            <View style={{ marginTop: 12 }}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Subject</Text>
                <Text style={styles.tableHeaderCell}>Current</Text>
                <Text style={styles.tableHeaderCell}>Previous</Text>
                <Text style={styles.tableHeaderCell}>Change</Text>
              </View>
              {c.subjects.map((s, i) => (
                <View key={s.code} style={[styles.tableRow, i % 2 === 1 && { backgroundColor: "#FAFAFA" }]}>
                  <Text style={[styles.tableCell, { flex: 2, fontWeight: "700" }]}>{s.label}</Text>
                  <Text style={styles.tableCell}>{s.current}</Text>
                  <Text style={styles.tableCell}>{s.previous}</Text>
                  <Text
                    style={[
                      styles.tableCell,
                      {
                        color: s.change > 0 ? "#16A34A" : s.change < 0 ? "#991B1B" : LABEL_GRAY,
                        fontWeight: "700",
                      },
                    ]}
                  >
                    {s.change > 0 ? `▲ +${s.change}` : s.change < 0 ? `▼ ${s.change}` : "→ 0"}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </View>
    );
  };

  const renderFullTable = (d: StaffDashboard) => {
    if (!d.students || !d.subjects || !d.classMeanRow || !d.meta) return null;
    const colWidth = 90;
    return (
      <View style={styles.card}>
        <View style={styles.tableSectionHeader}>
          <Text style={styles.cardHeading}>Full Results Table</Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <TouchableOpacity style={styles.exportBtn} onPress={handleExportAnalysis} disabled={exporting !== null}>
              {exporting === "analysis" ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="bar-chart-outline" size={14} color="#fff" />
                  <Text style={styles.exportBtnText}>Download Analysis (PDF)</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.exportBtn, styles.exportBtnGold]}
              onPress={handleExportReportCards}
              disabled={exporting !== null}
            >
              {exporting === "cards" ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="document-text-outline" size={14} color="#fff" />
                  <Text style={styles.exportBtnText}>Download Report Cards</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View>
            <View style={styles.fullTableHeaderRow}>
              <Text style={[styles.fullTableHeaderCell, { width: 44 }]}>Rank</Text>
              <Text style={[styles.fullTableHeaderCell, { width: colWidth }]}>Assess No</Text>
              <Text style={[styles.fullTableHeaderCell, { width: colWidth }]}>First Name</Text>
              <Text style={[styles.fullTableHeaderCell, { width: colWidth }]}>Surname</Text>
              {d.subjects.map((s) => (
                <Text key={s.code} style={[styles.fullTableHeaderCell, { width: colWidth }]}>{s.label}</Text>
              ))}
              <Text style={[styles.fullTableHeaderCell, { width: colWidth }]}>Total (/{d.meta!.totalOutOf})</Text>
            </View>

            {d.students.map((s, i) => {
              const rankStyle = s.rank === 1 ? styles.rankGold : s.rank === 2 ? styles.rankSilver : s.rank === 3 ? styles.rankBronze : null;
              const totalBand = bandColor(s.bandCode);
              return (
                <View key={`${s.assesment}-${i}`} style={[styles.fullTableRow, i % 2 === 1 && { backgroundColor: "#FAFAFA" }]}>
                  <View style={{ width: 44, alignItems: "center" }}>
                    <View style={[styles.rankBadge, rankStyle]}>
                      <Text style={styles.rankBadgeText}>{s.rank}</Text>
                    </View>
                  </View>
                  <Text style={[styles.fullTableCell, { width: colWidth }]}>{s.assesment}</Text>
                  <Text style={[styles.fullTableCell, { width: colWidth, fontWeight: "700" }]}>{s.firstName}</Text>
                  <Text style={[styles.fullTableCell, { width: colWidth }]}>{s.lastName}</Text>
                  {s.subjects.map((sub) => {
                    const c = bandColor(sub.bandCode);
                    return (
                      <View key={sub.code} style={{ width: colWidth, paddingVertical: 4 }}>
                        <View style={[styles.scorePill, { backgroundColor: c.bg }]}>
                          <Text style={[styles.scorePillText, { color: c.fg }]}>
                            {sub.score} ({sub.bandCode})
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                  <View style={{ width: colWidth, paddingVertical: 4 }}>
                    <View style={[styles.scorePill, { backgroundColor: totalBand.bg }]}>
                      <Text style={[styles.scorePillText, { color: totalBand.fg, fontWeight: "700" }]}>
                        {s.total} ({s.bandCode})
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}

            {/* Class mean row */}
            <View style={styles.meanRow}>
              <Text style={[styles.meanCell, { width: 44 + colWidth * 2 }]}>Class Mean</Text>
              <Text style={[styles.meanCell, { width: colWidth }]} />
              {d.classMeanRow.subjects.map((s) => (
                <Text key={s.code} style={[styles.meanCell, { width: colWidth }]}>{s.score}</Text>
              ))}
              <Text style={[styles.meanCell, { width: colWidth }]}>{d.classMeanRow.total}</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  };

  const renderStudentSelf = (r: StudentSelfResponse) => (
    <View style={styles.card}>
      {r.student?.name ? (
        <View style={{ marginBottom: 16 }}>
          <Text style={styles.resultsHeaderName}>{r.student.name}</Text>
          {typeof r.student.average === "number" && (
            <Text style={styles.resultsHeaderAverage}>Average: {r.student.average.toFixed(1)}%</Text>
          )}
        </View>
      ) : null}
      <View style={styles.tableHeaderRow}>
        <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Subject</Text>
        <Text style={styles.tableHeaderCell}>Score</Text>
        <Text style={styles.tableHeaderCell}>Grade</Text>
      </View>
      {r.subjects.map((s, i) => (
        <View key={`${s.subject}-${i}`} style={[styles.tableRow, i % 2 === 1 && { backgroundColor: "#FAFAFA" }]}>
          <Text style={[styles.tableCell, { flex: 2 }]}>{s.subject}</Text>
          <Text style={styles.tableCell}>{s.score}</Text>
          <Text style={styles.tableCell}>{s.grade}</Text>
        </View>
      ))}
    </View>
  );

  const showEmpty =
    !allSelected ||
    (dashboard === null && selfResult === null) ||
    (dashboard !== null && (dashboard.studentCount === 0 || (dashboard.students?.length ?? 0) === 0));

  return (
    <ThemedView style={{ flex: 1, backgroundColor: PAGE_BG }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => setSidebarOpen(true)}>
          <Ionicons name="menu" size={20} color={DARK} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Stephen Kanja Primary &amp; Junior School</Text>
          <Text style={styles.headerSubtitle}>ACADEMIC PERFORMANCE TRANSCRIPT</Text>
        </View>
        <View style={styles.iconButtonGold}>
          <Ionicons name="school" size={18} color={DARK} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Filter Card */}
        <View style={styles.card}>
          <View style={styles.filterRow}>
            <View style={styles.filterField}>
              <Text style={styles.filterLabel}>GRADE</Text>
              <View style={styles.selectBox}>
                <Picker selectedValue={grade} onValueChange={setGrade} style={styles.picker}>
                  <Picker.Item label="— Select —" value="" />
                  {GRADES.map((g) => (
                    <Picker.Item key={g} label={`Grade ${g}`} value={g} />
                  ))}
                </Picker>
              </View>
            </View>
            <View style={styles.filterField}>
              <Text style={styles.filterLabel}>TERM</Text>
              <View style={styles.selectBox}>
                <Picker selectedValue={term} onValueChange={setTerm} style={styles.picker}>
                  <Picker.Item label="— Select —" value="" />
                  {TERMS.map((t) => (
                    <Picker.Item key={t} label={`Term ${t}`} value={t} />
                  ))}
                </Picker>
              </View>
            </View>
          </View>
          <View style={styles.filterRow}>
            <View style={styles.filterField}>
              <Text style={styles.filterLabel}>EXAM TYPE</Text>
              <View style={styles.selectBox}>
                <Picker selectedValue={examType} onValueChange={setExamType} style={styles.picker}>
                  <Picker.Item label="— Select —" value="" />
                  {EXAM_TYPES.map((e) => (
                    <Picker.Item key={e.value} label={e.label} value={e.value} />
                  ))}
                </Picker>
              </View>
            </View>
            <View style={styles.filterField}>
              <Text style={styles.filterLabel}>YEAR</Text>
              <View style={styles.selectBox}>
                <Picker selectedValue={year} onValueChange={setYear} style={styles.picker}>
                  <Picker.Item label="— Select —" value="" />
                  {YEARS.map((y) => (
                    <Picker.Item key={y} label={y} value={y} />
                  ))}
                </Picker>
              </View>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.viewResultsButton, !allSelected && { opacity: 0.5 }]}
            disabled={!allSelected || loading}
            onPress={fetchResults}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.viewResultsButtonText}>View Results</Text>}
          </TouchableOpacity>
        </View>

        {/* Results */}
        {showEmpty ? (
          <View style={[styles.card, { alignItems: "center" }]}>
            {error ? (
              <>
                <Ionicons name="alert-circle-outline" size={40} color="#D9534F" />
                <Text style={[styles.emptyStateText, { color: "#D9534F", marginTop: 12 }]}>{error}</Text>
              </>
            ) : !allSelected ? (
              <>
                <MaterialCommunityIcons name="clipboard-text-outline" size={40} color={GOLD} />
                <Text style={styles.emptyStateText}>
                  Select a grade, term, exam type, and year above{"\n"}to view results.
                </Text>
              </>
            ) : (
              <>
                <MaterialCommunityIcons name="file-search-outline" size={40} color={GOLD} />
                <Text style={styles.emptyStateText}>No results found for the selected filters.</Text>
              </>
            )}
          </View>
        ) : selfResult ? (
          renderStudentSelf(selfResult)
        ) : dashboard ? (
          <>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>
                Grade {dashboard.grade} — {dashboard.meta?.examLabel} (Term {dashboard.meta?.term}, {dashboard.meta?.year})
              </Text>
              <View style={styles.sectionBadge}>
                <Text style={styles.sectionBadgeText}>{dashboard.meta?.studentCount} Students</Text>
              </View>
            </View>
            {renderKpis(dashboard)}
            <Text style={styles.sectionTitle}>Performance Analysis</Text>
            {renderBands(dashboard)}
            {renderBreakdownTable(dashboard)}
            {renderCharts(dashboard)}
            {renderComparison(dashboard)}
            {renderFullTable(dashboard)}
          </>
        ) : null}
      </ScrollView>

      {/* Sidebar Drawer */}
      <Modal visible={sidebarOpen} animationType="fade" transparent onRequestClose={() => setSidebarOpen(false)}>
        <Pressable style={styles.sidebarOverlay} onPress={() => setSidebarOpen(false)}>
          <Pressable style={styles.sidebar} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sidebarHeader}>
              <TouchableOpacity style={styles.iconButton} onPress={() => setSidebarOpen(false)}>
                <Ionicons name="close" size={18} color={DARK} />
              </TouchableOpacity>
              <View style={styles.iconButtonGold}>
                <Ionicons name="school" size={16} color={DARK} />
              </View>
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.sidebarBrand}>
                  STEPHEN KANJA <Text style={{ color: GOLD }}>SCHOOL</Text>
                </Text>
                <Text style={styles.sidebarTagline}>AIM HIGHER</Text>
              </View>
            </View>
            <ScrollView style={{ flex: 1 }}>
              {renderSidebarSection("MAIN", MAIN_ITEMS)}
              {renderSidebarSection("ACADEMICS", ACADEMIC_ITEMS)}
              {renderSidebarSection("ADMINISTRATION", ADMIN_ITEMS)}
              {renderSidebarSection("FINANCE", FINANCE_ITEMS)}
            </ScrollView>
            <Text style={styles.sidebarFooter}>
              © 2026 Kelvin Mutinda{"\n"}infinityfreeapp.com
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: DARK, paddingTop: 50, paddingBottom: 20, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", borderBottomWidth: 2, borderBottomColor: GOLD },
  iconButton: { width: 34, height: 34, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center", marginRight: 12 },
  iconButtonGold: { width: 34, height: 34, borderRadius: 8, backgroundColor: GOLD, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  headerSubtitle: { color: "#9AA0A8", fontSize: 10, letterSpacing: 1.5, marginTop: 2 },
  content: { padding: 16, gap: 16 },
  card: { backgroundColor: CARD_BG, borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardHeading: { fontSize: 12, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", color: LABEL_GRAY, marginBottom: 16 },
  filterRow: { flexDirection: "row", gap: 12, marginBottom: 14 },
  filterField: { flex: 1 },
  filterLabel: { fontSize: 11, letterSpacing: 1, color: LABEL_GRAY, marginBottom: 6, fontWeight: "600" },
  selectBox: { borderWidth: 1, borderColor: "#E5E3DE", borderRadius: 10, backgroundColor: "#FBFAF8", overflow: "hidden" },
  picker: { height: 44, color: DARK },
  viewResultsButton: { backgroundColor: DARK, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  viewResultsButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  emptyStateText: { color: LABEL_GRAY, fontSize: 13, textAlign: "center", marginTop: 14, lineHeight: 20 },
  resultsHeaderName: { fontSize: 16, fontWeight: "700", color: DARK },
  resultsHeaderAverage: { fontSize: 13, color: LABEL_GRAY, marginTop: 2 },
  tableHeaderRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#E5E3DE", paddingBottom: 8, marginBottom: 4 },
  tableHeaderCell: { flex: 1, fontSize: 11, letterSpacing: 0.5, color: LABEL_GRAY, fontWeight: "700" },
  tableRow: { flexDirection: "row", paddingVertical: 10, paddingHorizontal: 4, borderRadius: 6 },
  tableCell: { flex: 1, fontSize: 13, color: DARK },

  sectionTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: DARK, marginBottom: 12 },
  sectionBadge: { backgroundColor: DARK, borderRadius: 20, paddingVertical: 4, paddingHorizontal: 12 },
  sectionBadgeText: { color: GOLD, fontSize: 11, fontWeight: "700" },

  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 4 },
  kpiCard: { width: "47%", backgroundColor: CARD_BG, borderRadius: 14, padding: 16, borderTopWidth: 3, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  kpiLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 1, color: LABEL_GRAY, marginBottom: 8 },
  kpiVal: { fontSize: 28, fontWeight: "900", color: DARK },
  kpiSub: { fontSize: 11, color: LABEL_GRAY, marginTop: 4 },

  twoColRow: { gap: 16 },
  bandRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  bandLabel: { fontSize: 12, fontWeight: "600", width: 110 },
  bandLabelSubject: { fontSize: 12, fontWeight: "600", color: DARK, width: 90 },
  barTrack: { flex: 1, height: 8, borderRadius: 99, backgroundColor: PAGE_BG, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 99 },
  bandCount: { fontSize: 12, fontWeight: "700", color: "#3D4F5C", width: 60, textAlign: "right" },

  chart: { borderRadius: 8, marginTop: 4 },
  noPrev: { alignItems: "center", padding: 24 },

  tableSectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4, flexWrap: "wrap", gap: 10 },
  exportBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: BLUE, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  exportBtnGold: { backgroundColor: GOLD },
  exportBtnText: { color: "#fff", fontSize: 11, fontWeight: "700" },

  fullTableHeaderRow: { flexDirection: "row", backgroundColor: DARK, borderRadius: 8, paddingVertical: 10 },
  fullTableHeaderCell: { color: "#fff", fontSize: 10, fontWeight: "700", paddingHorizontal: 8, textTransform: "uppercase" },
  fullTableRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#F0EEEA" },
  fullTableCell: { fontSize: 12, color: "#3D4F5C", paddingHorizontal: 8 },
  rankBadge: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#DCE8F5", alignItems: "center", justifyContent: "center" },
  rankBadgeText: { fontSize: 11, fontWeight: "700", color: BLUE },
  rankGold: { backgroundColor: "#F5E9C8" },
  rankSilver: { backgroundColor: "#E8E8F0" },
  rankBronze: { backgroundColor: "#F0E6D8" },
  scorePill: { borderRadius: 6, paddingVertical: 4, paddingHorizontal: 6, alignItems: "center" },
  scorePillText: { fontSize: 11, fontWeight: "600" },
  meanRow: { flexDirection: "row", backgroundColor: DARK, paddingVertical: 10, borderRadius: 8, marginTop: 4 },
  meanCell: { color: "#fff", fontSize: 12, fontWeight: "700", paddingHorizontal: 8 },

  sidebarOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", flexDirection: "row" },
  sidebar: { width: "78%", maxWidth: 320, height: "100%", backgroundColor: DARK, paddingTop: 50, paddingHorizontal: 16, borderRightWidth: 2, borderRightColor: GOLD },
  sidebarHeader: { flexDirection: "row", alignItems: "center", paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)", marginBottom: 8 },
  sidebarBrand: { color: "#fff", fontWeight: "800", fontSize: 13, letterSpacing: 0.5 },
  sidebarTagline: { color: "#9AA0A8", fontSize: 9, letterSpacing: 1, marginTop: 2 },
  sidebarSection: { marginTop: 18 },
  sidebarSectionTitle: { color: "#6B6F76", fontSize: 10, letterSpacing: 1.2, fontWeight: "700", marginBottom: 8 },
  sidebarItem: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 10, borderRadius: 8 },
  sidebarItemActive: { backgroundColor: "rgba(212,160,23,0.12)", borderWidth: 1, borderColor: GOLD },
  sidebarItemText: { color: "#C9CCD1", fontSize: 13, fontWeight: "500" },
  sidebarItemTextActive: { color: GOLD, fontWeight: "700" },
  sidebarFooter: { color: "#585C63", fontSize: 10, textAlign: "center", paddingVertical: 20 },
});