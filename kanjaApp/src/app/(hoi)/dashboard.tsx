import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, TouchableOpacity, Modal, Pressable, Dimensions } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import {
  GraduationCap, Users, BookOpen, Coins, Home, TrendingUp, UserPlus,
  ClipboardCheck, Presentation, Bell, PieChart as PieChartIcon, Grid3x3,
  Upload, Target, Settings as SettingsIcon, FileText, Menu, X,
} from 'lucide-react-native';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';

import ThemedText from '@/components/themed-text';
import ThemedView from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/services/api/client';

// ---------- Types ----------

type TermTotals = { schoolFee: number; assessment: number; activity: number; other: number };

type GradeFeeRow = {
  grade: string;
  enrolled: number;
  withRecords: number;
  schoolFee: number;
  assessment: number;
  activity: number;
  other: number;
  coveragePercent: number;
  withoutRecords: number;
};

type GradeExamMean = { grade: string; mean: number; band: 'E.E' | 'M.E' | 'A.E' | 'B.E' | null };

type AchievementBand = { band: 'Exceeding' | 'Meeting' | 'Approaching' | 'Below'; count: number };

type PerformanceSeries = { grade: string; color: string; data: number[] };

type PerformanceTimeline = { examLabels: string[]; series: PerformanceSeries[] };

type ExamResultRow = { grade: string; term: string; examType: string; year: number };

type TeacherRow = { name: string; email: string };

type DashboardData = {
  totalLearners: number;
  teachingStaff: number;
  classes: number;
  totalRevenue: number;
  terms: { term1: TermTotals; term2: TermTotals; term3: TermTotals };
  feeByGrade: GradeFeeRow[];
  academicByGrade: { grade: string; average: number }[];
  achievementBands: AchievementBand[];
  gradeExamMeans: GradeExamMean[];
  performanceTimeline: PerformanceTimeline;
  examResultsSummary: ExamResultRow[];
  teachingStaffList: TeacherRow[];
};

const EMPTY_TERM: TermTotals = { schoolFee: 0, assessment: 0, activity: 0, other: 0 };

const EMPTY_DATA: DashboardData = {
  totalLearners: 0,
  teachingStaff: 0,
  classes: 0,
  totalRevenue: 0,
  terms: { term1: EMPTY_TERM, term2: EMPTY_TERM, term3: EMPTY_TERM },
  feeByGrade: [],
  academicByGrade: [],
  achievementBands: [],
  gradeExamMeans: [],
  performanceTimeline: { examLabels: [], series: [] },
  examResultsSummary: [],
  teachingStaffList: [],
};

// ---------- Palette ----------
// Cream is the hero background now — everything else is tuned to sit calmly on top of it.

const CREAM_BG = '#F2EFEA';
const CREAM_BG_SOFT = '#EDE9E1'; // slightly deeper cream for the top bar so it reads as a distinct layer
const CARD_BG = '#FFFFFF';
const TEXT_DARK = '#14151A';
const TEXT_MUTED = '#6B6F76';
const BORDER = '#E7E3DA';

const PURPLE = '#6C5CE7';
const GREEN = '#26A65B';
const AMBER = '#E0A63C';
const CYAN = '#3AB0D8';
const SALMON = '#F0645F';

const NAVY = '#10132A';
const NAVY_ELEVATED = '#181C3A';

const screenWidth = Dimensions.get('window').width;
const chartWidth = Math.min(screenWidth, MaxContentWidth) - Spacing.three * 2 - Spacing.four * 2;

const chartConfig = {
  backgroundGradientFrom: CARD_BG,
  backgroundGradientTo: CARD_BG,
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(20, 21, 26, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(107, 111, 118, ${opacity})`,
  propsForBackgroundLines: { stroke: BORDER },
  propsForDots: { r: '3' },
};

// ---------- Helpers ----------

function currency(n: number) {
  return `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function termTotal(t: TermTotals) {
  return t.schoolFee + t.assessment + t.activity + t.other;
}

function bandColor(band: string | null) {
  switch (band) {
    case 'E.E':
      return GREEN;
    case 'M.E':
      return PURPLE;
    case 'A.E':
      return AMBER;
    case 'B.E':
      return SALMON;
    default:
      return TEXT_MUTED;
  }
}

function bandLabel(band: string | null) {
  switch (band) {
    case 'E.E':
      return 'E.E — Exceeding';
    case 'M.E':
      return 'M.E — Meeting';
    case 'A.E':
      return 'A.E — Approaching';
    case 'B.E':
      return 'B.E — Below';
    default:
      return '—';
  }
}

// ---------- Sidebar ----------
// Every item now carries a `route`. Update these path strings to match your actual
// expo-router file names if any of my guesses don't line up with your folder structure.

type NavItem = { label: string; icon: React.ComponentType<any>; route: string };

const MAIN_NAV: NavItem[] = [
  { label: 'Dashboard', icon: Home, route: '/dashboard' },
  { label: 'Students', icon: Users, route: '/students' },
  { label: 'Progress Records', icon: TrendingUp, route: '/progress' },
];

const ADMIN_NAV: NavItem[] = [
  { label: 'Register Learners', icon: UserPlus, route: '/registerLearner' },
  { label: 'Attendance', icon: ClipboardCheck, route: '/attendance' },
  { label: 'Register Teachers', icon: Presentation, route: '/registerTeacher' },
  { label: 'Notices', icon: Bell, route: '/notices' },
];

const ACADEMICS_NAV: NavItem[] = [
  { label: 'Results', icon: PieChartIcon, route: '/results' },
  { label: 'Timetable', icon: Grid3x3, route: '/timetable' },
  { label: 'Upload Results', icon: Upload, route: '/uploadResults' },
  { label: 'Learning Materials', icon: BookOpen, route: '/learningMaterials' },
  { label: 'Track Performance', icon: Target, route: '/track' },
  { label: 'Settings', icon: SettingsIcon, route: '/settings' },
];

const FINANCE_NAV: NavItem[] = [
  { label: 'Finances (Pay)', icon: Coins, route: '/payFees' },
  { label: 'Track Fees', icon: FileText, route: '/trackFees' },
];

const ALL_NAV = [...MAIN_NAV, ...ADMIN_NAV, ...ACADEMICS_NAV, ...FINANCE_NAV];

function Sidebar({
  visible,
  onClose,
  activeLabel,
  schoolName,
  onNavigate,
}: {
  visible: boolean;
  onClose: () => void;
  activeLabel: string;
  schoolName: string;
  onNavigate: (route: string) => void;
}) {
  const renderGroup = (title: string | null, items: NavItem[]) => (
    <View style={{ marginTop: title ? 18 : 4 }}>
      {title && <ThemedText style={sidebarStyles.groupTitle}>{title}</ThemedText>}
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = item.label === activeLabel;
        return (
          <TouchableOpacity
            key={item.label}
            style={[sidebarStyles.item, isActive && sidebarStyles.itemActive]}
            onPress={() => onNavigate(item.route)}
            activeOpacity={0.75}
          >
            <Icon size={17} color={isActive ? '#FFFFFF' : '#9AA0C3'} style={{ marginRight: 12 }} />
            <ThemedText style={[sidebarStyles.itemText, isActive && sidebarStyles.itemTextActive]}>
              {item.label}
            </ThemedText>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={sidebarStyles.overlay} onPress={onClose}>
        <Pressable style={sidebarStyles.drawer} onPress={(e) => e.stopPropagation()}>
          <View style={sidebarStyles.header}>
            <View style={sidebarStyles.brandBadge}>
              <GraduationCap size={20} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <ThemedText style={sidebarStyles.brandTitle}>{schoolName}</ThemedText>
              <ThemedText style={sidebarStyles.brandSubtitle}>MANAGEMENT SYSTEM</ThemedText>
            </View>
            <TouchableOpacity style={sidebarStyles.closeButton} onPress={onClose}>
              <X size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {renderGroup(null, MAIN_NAV)}
            {renderGroup('ADMINISTRATION', ADMIN_NAV)}
            {renderGroup('ACADEMICS', ACADEMICS_NAV)}
            {renderGroup('FINANCE', FINANCE_NAV)}
          </ScrollView>

          <ThemedText style={sidebarStyles.footer}>© 2026 Kelvin Mutinda</ThemedText>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ---------- Main Screen ----------

export default function HoiDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [data, setData] = useState<DashboardData>(EMPTY_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      // Backend should return ALL sections below in one payload (see DashboardData type)
      const res = await apiRequest<DashboardData>('/hoi/dashboard.php');
      setData({ ...EMPTY_DATA, ...res });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load dashboard.');
    }
  }, []);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await load();
      setIsLoading(false);
    })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }, [load]);

  const handleNavigate = useCallback(
    (route: string) => {
      setSidebarOpen(false);
      // Dashboard is already this screen — no need to push a duplicate route.
      if (route === '/dashboard' && (pathname === '/dashboard' || pathname === '/')) return;
      router.push(route as any);
    },
    [router, pathname]
  );

  // Figures out which nav label is "active" from the current route, falling back to Dashboard.
  const activeLabel =
    ALL_NAV.find((item) => item.route === pathname)?.label ?? 'Dashboard';

  const schoolName = (user?.school_name as string) ?? 'Kanja School';

  const feeByGradeLabels = data.feeByGrade.map((g) => g.grade.replace('Grade ', 'G'));
  const feeCoverageData = data.feeByGrade.map((g) => g.coveragePercent);
  const withoutRecordsData = data.feeByGrade.map((g) => g.withoutRecords);
  const academicLabels = data.academicByGrade.map((g) => g.grade.replace('Grade ', 'G'));
  const academicData = data.academicByGrade.map((g) => g.average);

  const pieData = data.achievementBands.map((b) => ({
    name: b.band,
    population: b.count,
    color:
      b.band === 'Exceeding' ? GREEN : b.band === 'Meeting' ? PURPLE : b.band === 'Approaching' ? AMBER : SALMON,
    legendFontColor: TEXT_MUTED,
    legendFontSize: 12,
  }));

  return (
    <ThemedView style={styles.screen}>
      {/* Top bar with menu trigger */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.menuButton} onPress={() => setSidebarOpen(true)} activeOpacity={0.75}>
          <Menu size={18} color={TEXT_DARK} />
        </TouchableOpacity>
        <ThemedText style={styles.topBarTitle}>{schoolName}</ThemedText>
        <View style={styles.topBarBrandDot} />
      </View>

      <Sidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeLabel={activeLabel}
        schoolName={schoolName}
        onNavigate={handleNavigate}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={PURPLE} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerIconBadge}>
            <GraduationCap size={22} color={PURPLE} />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText type="title" style={styles.title}>
              {schoolName}
            </ThemedText>
            <ThemedText type="small" style={styles.headerSubtitle}>
              School Overview
            </ThemedText>
          </View>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <ThemedText type="small" style={styles.errorText}>
              {error}
            </ThemedText>
          </View>
        )}

        {/* ---- Top stat cards ---- */}
        <View style={styles.statGrid}>
          <StatCard
            label="TOTAL LEARNERS"
            value={isLoading ? '—' : String(data.totalLearners)}
            caption="Active enrolled learners"
            icon={<GraduationCap color={PURPLE} size={20} />}
            accent={PURPLE}
          />
          <StatCard
            label="TEACHING STAFF"
            value={isLoading ? '—' : String(data.teachingStaff)}
            caption="Available teachers"
            icon={<Users color="#2E74B5" size={20} />}
            accent="#2E74B5"
          />
          <StatCard
            label="CLASSES"
            value={isLoading ? '—' : String(data.classes)}
            caption="Grades 1 through 9"
            icon={<BookOpen color={AMBER} size={20} />}
            accent={AMBER}
          />
          <StatCard
            label="TOTAL REVENUE"
            value={isLoading ? '—' : currency(data.totalRevenue)}
            caption="All terms combined"
            icon={<Coins color={GREEN} size={20} />}
            accent={GREEN}
          />
        </View>

        {/* ---- Term summaries ---- */}
        <SectionHeading text="Finances — Term Summaries" accent={PURPLE} />
        <View style={styles.termGrid}>
          <TermCard label="Term 1" totals={data.terms.term1} isLoading={isLoading} />
          <TermCard label="Term 2" totals={data.terms.term2} isLoading={isLoading} />
          <TermCard label="Term 3" totals={data.terms.term3} isLoading={isLoading} />
        </View>

        {/* ---- Fee Collection by Grade — All Categories ---- */}
        <ChartCard dotColor={PURPLE} title="Fee Collection by Grade — All Categories" badge="Live Data">
          {data.feeByGrade.length === 0 ? (
            <EmptyChartNote isLoading={isLoading} />
          ) : (
            <LineChart
              data={{
                labels: feeByGradeLabels,
                datasets: [
                  { data: data.feeByGrade.map((g) => g.schoolFee), color: () => PURPLE },
                  { data: data.feeByGrade.map((g) => g.assessment), color: () => GREEN },
                  { data: data.feeByGrade.map((g) => g.activity), color: () => AMBER },
                  { data: data.feeByGrade.map((g) => g.other), color: () => CYAN },
                ],
                legend: ['School Fee', 'Assessment', 'Activity', 'Other'],
              }}
              width={chartWidth}
              height={220}
              chartConfig={chartConfig}
              bezier
              style={styles.chart}
            />
          )}
        </ChartCard>

        {/* ---- Grade-by-Grade Fee Breakdown & Debt Analysis ---- */}
        <SectionHeading text="Grade-by-Grade Fee Breakdown & Debt Analysis" icon={<Grid3x3 size={16} color={AMBER} />} accent={AMBER} />

        <TableCard title="Fee Collection Per Grade" icon={<Grid3x3 size={14} color={PURPLE} />}>
          <TableHeaderRow columns={['GRADE', 'ENROLLED', 'WITH RECORDS', 'SCHOOL FEE (KES)']} />
          {data.feeByGrade.length === 0 ? (
            <EmptyTableNote isLoading={isLoading} />
          ) : (
            data.feeByGrade.map((row) => (
              <TableRow
                key={row.grade}
                columns={[row.grade, String(row.enrolled), String(row.withRecords), row.schoolFee.toFixed(0)]}
              />
            ))
          )}
        </TableCard>

        <ChartCard dotColor={GREEN} title="Fee Coverage % by Grade">
          {data.feeByGrade.length === 0 ? (
            <EmptyChartNote isLoading={isLoading} />
          ) : (
            <BarChart
              data={{ labels: feeByGradeLabels, datasets: [{ data: feeCoverageData }] }}
              width={chartWidth}
              height={220}
              yAxisLabel=""
              yAxisSuffix="%"
              chartConfig={{ ...chartConfig, color: () => GREEN }}
              style={styles.chart}
              fromZero
            />
          )}
        </ChartCard>

        <ChartCard dotColor={SALMON} title="Students Without Fee Records">
          {data.feeByGrade.length === 0 ? (
            <EmptyChartNote isLoading={isLoading} />
          ) : (
            <BarChart
              data={{ labels: feeByGradeLabels, datasets: [{ data: withoutRecordsData }] }}
              width={chartWidth}
              height={220}
              yAxisLabel=""
              yAxisSuffix=""
              chartConfig={{ ...chartConfig, color: () => SALMON }}
              style={styles.chart}
              fromZero
            />
          )}
        </ChartCard>

        {/* ---- Academic Performance Analysis ---- */}
        <SectionHeading text="Academic Performance Analysis" icon={<TrendingUp size={16} color={PURPLE} />} accent={PURPLE} />

        <ChartCard dotColor={PURPLE} title="Latest Exam — Average Subject Score by Grade" badge="Live">
          {data.academicByGrade.length === 0 ? (
            <EmptyChartNote isLoading={isLoading} />
          ) : (
            <LineChart
              data={{ labels: academicLabels, datasets: [{ data: academicData, color: () => PURPLE }] }}
              width={chartWidth}
              height={220}
              yAxisSuffix="/100"
              chartConfig={chartConfig}
              bezier
              style={styles.chart}
            />
          )}
        </ChartCard>

        <ChartCard dotColor={SALMON} title="Student Achievement Bands (All Exams)">
          {data.achievementBands.length === 0 ? (
            <EmptyChartNote isLoading={isLoading} />
          ) : (
            <PieChart
              data={pieData}
              width={chartWidth}
              height={200}
              chartConfig={chartConfig}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="8"
              style={styles.chart}
            />
          )}
        </ChartCard>

        <TableCard title="Latest Exam Performance per Grade" icon={<GraduationCap size={14} color={GREEN} />}>
          <TableHeaderRow columns={['GRADE', 'MEAN /100', 'BAND']} />
          {data.gradeExamMeans.length === 0 ? (
            <EmptyTableNote isLoading={isLoading} />
          ) : (
            data.gradeExamMeans.map((row) => (
              <View key={row.grade} style={tableStyles.row}>
                <ThemedText style={[tableStyles.cell, { flex: 1.2, fontWeight: '700' }]}>{row.grade}</ThemedText>
                <ThemedText style={[tableStyles.cell, { flex: 1 }]}>{row.band ? row.mean : '—'}</ThemedText>
                <View style={{ flex: 1.4 }}>
                  {row.band ? (
                    <View style={[tableStyles.bandChip, { backgroundColor: `${bandColor(row.band)}1A` }]}>
                      <ThemedText style={[tableStyles.bandChipText, { color: bandColor(row.band) }]}>
                        {bandLabel(row.band)}
                      </ThemedText>
                    </View>
                  ) : (
                    <ThemedText style={{ color: TEXT_MUTED }}>—</ThemedText>
                  )}
                </View>
              </View>
            ))
          )}
        </TableCard>

        {/* ---- Grade Performance Timeline ---- */}
        <ChartCard dotColor={PURPLE} title="Grade Performance Timeline — All Exams">
          {data.performanceTimeline.series.length === 0 ? (
            <EmptyChartNote isLoading={isLoading} />
          ) : (
            <LineChart
              data={{
                labels: data.performanceTimeline.examLabels,
                datasets: data.performanceTimeline.series.map((s) => ({
                  data: s.data,
                  color: () => s.color,
                })),
                legend: data.performanceTimeline.series.map((s) => s.grade),
              }}
              width={chartWidth}
              height={240}
              yAxisSuffix="/100"
              chartConfig={chartConfig}
              bezier
              style={styles.chart}
            />
          )}
        </ChartCard>

        <TableCard title="All Exam Results Summary" icon={<FileText size={14} color={PURPLE} />}>
          <TableHeaderRow columns={['GRADE', 'TERM', 'EXAM TYPE', 'YEAR']} />
          {data.examResultsSummary.length === 0 ? (
            <EmptyTableNote isLoading={isLoading} />
          ) : (
            data.examResultsSummary.map((row, idx) => (
              <TableRow
                key={`${row.grade}-${row.term}-${row.examType}-${idx}`}
                columns={[row.grade, row.term, row.examType, String(row.year)]}
              />
            ))
          )}
        </TableCard>

        {/* ---- Teaching Staff ---- */}
        <SectionHeading text="Teaching Staff" icon={<Presentation size={16} color={GREEN} />} accent={GREEN} />
        <TableCard darkHeader>
          <TableHeaderRow columns={['NAME', 'EMAIL']} dark />
          {data.teachingStaffList.length === 0 ? (
            <EmptyTableNote isLoading={isLoading} />
          ) : (
            data.teachingStaffList.map((t) => <TableRow key={t.email} columns={[t.name, t.email]} />)
          )}
        </TableCard>
      </ScrollView>
    </ThemedView>
  );
}

// ---------- Small building blocks ----------

function StatCard({
  label,
  value,
  caption,
  icon,
  accent,
}: {
  label: string;
  value: string;
  caption: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statCardHeader}>
        <View style={[styles.iconBadge, { backgroundColor: `${accent}1F` }]}>{icon}</View>
        <ThemedText type="small" style={styles.statLabel}>
          {label}
        </ThemedText>
      </View>
      <ThemedText style={styles.statValue}>{value}</ThemedText>
      <ThemedText type="small" style={styles.statCaption}>
        {caption}
      </ThemedText>
      <View style={[styles.statAccentBar, { backgroundColor: accent }]} />
    </View>
  );
}

function TermCard({ label, totals, isLoading }: { label: string; totals: TermTotals; isLoading: boolean }) {
  const rows: [string, number][] = [
    ['School Fee', totals.schoolFee],
    ['Assessment', totals.assessment],
    ['Activity', totals.activity],
    ['Other', totals.other],
  ];

  return (
    <View style={styles.termCard}>
      <View style={styles.termCardHeader}>
        <ThemedText style={styles.termCardTitle}>{label} Totals</ThemedText>
        <View style={styles.termPill}>
          <ThemedText type="small" style={styles.termPillText}>
            {label}
          </ThemedText>
        </View>
      </View>

      {rows.map(([rowLabel, rowValue]) => (
        <View key={rowLabel} style={styles.termRow}>
          <ThemedText type="small" style={styles.termRowLabel}>
            {rowLabel}
          </ThemedText>
          <ThemedText style={styles.termRowValue}>{isLoading ? '—' : rowValue.toFixed(2)}</ThemedText>
        </View>
      ))}

      <View style={styles.termDivider} />

      <View style={styles.termRow}>
        <ThemedText style={styles.termTotalLabel}>TOTAL</ThemedText>
        <ThemedText style={styles.termTotalValue}>{isLoading ? '—' : termTotal(totals).toFixed(2)}</ThemedText>
      </View>
    </View>
  );
}

function SectionHeading({ text, icon, accent }: { text: string; icon?: React.ReactNode; accent?: string }) {
  return (
    <View style={styles.sectionHeadingRow}>
      <View style={[styles.sectionHeadingBar, { backgroundColor: accent ?? PURPLE }]} />
      {icon}
      <ThemedText style={[styles.sectionHeadingText, icon ? { marginLeft: 8 } : { marginLeft: 10 }]}>
        {text}
      </ThemedText>
    </View>
  );
}

function ChartCard({
  title,
  children,
  dotColor,
  badge,
}: {
  title: string;
  children: React.ReactNode;
  dotColor: string;
  badge?: string;
}) {
  return (
    <View style={styles.chartCard}>
      <View style={styles.chartCardHeader}>
        <View style={styles.chartCardTitleRow}>
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
          <ThemedText style={styles.chartCardTitle}>{title}</ThemedText>
        </View>
        {badge && (
          <View style={styles.liveBadge}>
            <ThemedText style={styles.liveBadgeText}>{badge}</ThemedText>
          </View>
        )}
      </View>
      <View style={styles.chartCardDivider} />
      {children}
    </View>
  );
}

function EmptyChartNote({ isLoading }: { isLoading: boolean }) {
  return (
    <View style={{ paddingVertical: 28, alignItems: 'center' }}>
      <ThemedText type="small" style={{ color: TEXT_MUTED }}>
        {isLoading ? 'Loading data…' : 'No data available yet.'}
      </ThemedText>
    </View>
  );
}

function EmptyTableNote({ isLoading }: { isLoading: boolean }) {
  return (
    <View style={{ paddingVertical: 18, alignItems: 'center' }}>
      <ThemedText type="small" style={{ color: TEXT_MUTED }}>
        {isLoading ? 'Loading…' : 'No records found.'}
      </ThemedText>
    </View>
  );
}

function TableCard({
  title,
  icon,
  children,
  darkHeader,
}: {
  title?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  darkHeader?: boolean;
}) {
  return (
    <View style={styles.tableCard}>
      {title && (
        <View style={[styles.tableCardTitleRow, darkHeader && { backgroundColor: NAVY }]}>
          {icon}
          <ThemedText style={[styles.tableCardTitleText, icon ? { marginLeft: 8 } : null, darkHeader && { color: '#fff' }]}>
            {title}
          </ThemedText>
        </View>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ minWidth: chartWidth }}>{children}</View>
      </ScrollView>
    </View>
  );
}

function TableHeaderRow({ columns, dark }: { columns: string[]; dark?: boolean }) {
  return (
    <View style={[tableStyles.headerRow, dark && { backgroundColor: NAVY_ELEVATED, borderBottomColor: '#2A2E52' }]}>
      {columns.map((c) => (
        <ThemedText key={c} style={[tableStyles.headerCell, dark && { color: '#9AA0C3' }]}>
          {c}
        </ThemedText>
      ))}
    </View>
  );
}

function TableRow({ columns }: { columns: string[] }) {
  return (
    <View style={tableStyles.row}>
      {columns.map((c, idx) => (
        <ThemedText key={idx} style={[tableStyles.cell, idx === 0 && { fontWeight: '700' }]}>
          {c}
        </ThemedText>
      ))}
    </View>
  );
}

// ---------- Styles ----------

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: CREAM_BG },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 14,
    paddingHorizontal: Spacing.four,
    backgroundColor: CREAM_BG_SOFT,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  topBarTitle: { fontWeight: '700', fontSize: 14, color: TEXT_DARK, flex: 1 },
  topBarBrandDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: PURPLE },
  content: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.four * 2,
    gap: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: CARD_BG,
    borderRadius: Spacing.four,
    borderWidth: 1,
    borderColor: BORDER,
    padding: Spacing.four,
  },
  headerIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#6C5CE71A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 20, color: TEXT_DARK },
  headerSubtitle: { color: TEXT_MUTED, marginTop: 2 },
  errorBox: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: '#E0524D',
    backgroundColor: '#FDECEB',
  },
  errorText: { color: '#B3261E' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  statCard: {
    flexGrow: 1,
    flexBasis: '45%',
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: 6,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  statCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statLabel: { letterSpacing: 0.5, color: TEXT_MUTED, flexShrink: 1, fontSize: 10.5, fontWeight: '700' },
  iconBadge: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 26, fontWeight: '800', color: TEXT_DARK, marginTop: 2 },
  statCaption: { color: TEXT_MUTED },
  statAccentBar: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3 },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.two },
  sectionHeadingBar: { width: 4, height: 18, borderRadius: 2 },
  sectionHeadingText: { fontSize: 17, fontWeight: '800', color: TEXT_DARK },
  termGrid: { gap: Spacing.three },
  termCard: {
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.two,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  termCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.two },
  termCardTitle: { fontWeight: '700', fontSize: 16, color: TEXT_DARK },
  termPill: { backgroundColor: '#6C5CE722', borderRadius: 999, paddingHorizontal: Spacing.two, paddingVertical: 2 },
  termPillText: { color: PURPLE },
  termRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.one ?? 4 },
  termRowLabel: { color: TEXT_MUTED },
  termRowValue: { fontWeight: '600', color: TEXT_DARK },
  termDivider: { height: StyleSheet.hairlineWidth, backgroundColor: BORDER, marginVertical: Spacing.two },
  termTotalLabel: { fontWeight: '700', color: TEXT_DARK },
  termTotalValue: { fontWeight: '700', color: GREEN },

  chartCard: {
    backgroundColor: CARD_BG,
    borderRadius: Spacing.four,
    borderWidth: 1,
    borderColor: BORDER,
    padding: Spacing.three,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  chartCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chartCardTitleRow: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  chartCardTitle: { fontWeight: '700', fontSize: 14, color: TEXT_DARK, flexShrink: 1 },
  liveBadge: { backgroundColor: '#DDF5E4', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  liveBadgeText: { color: GREEN, fontSize: 11, fontWeight: '700' },
  chartCardDivider: { height: StyleSheet.hairlineWidth, backgroundColor: BORDER, marginVertical: Spacing.three },
  chart: { borderRadius: 12 },

  tableCard: {
    backgroundColor: CARD_BG,
    borderRadius: Spacing.four,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  tableCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    backgroundColor: '#FBFAF8',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tableCardTitleText: { fontWeight: '700', fontSize: 14, color: TEXT_DARK },
});

const tableStyles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: '#FBFAF8',
  },
  headerCell: { flex: 1, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, color: TEXT_MUTED },
  row: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F0EC',
  },
  cell: { flex: 1, fontSize: 13, color: TEXT_DARK },
  bandChip: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  bandChipText: { fontSize: 11, fontWeight: '700' },
});

const sidebarStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', flexDirection: 'row' },
  drawer: {
    width: '78%',
    maxWidth: 300,
    height: '100%',
    backgroundColor: NAVY,
    paddingTop: 50,
    paddingHorizontal: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    marginBottom: 6,
  },
  brandBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: { color: '#fff', fontWeight: '800', fontSize: 14 },
  brandSubtitle: { color: '#8890B8', fontSize: 9, letterSpacing: 1, marginTop: 2 },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupTitle: { color: '#5B6089', fontSize: 10, letterSpacing: 1.2, fontWeight: '700', marginBottom: 8, marginLeft: 10 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 10, borderRadius: 10, marginBottom: 2 },
  itemActive: { backgroundColor: PURPLE },
  itemText: { color: '#C4C8E4', fontSize: 13.5, fontWeight: '500' },
  itemTextActive: { color: '#fff', fontWeight: '700' },
  footer: { color: '#4A4F79', fontSize: 10, textAlign: 'center', paddingVertical: 18 },
});