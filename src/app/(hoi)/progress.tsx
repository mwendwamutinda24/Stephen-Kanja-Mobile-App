import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { Menu, GraduationCap, Search, FileText, X } from "lucide-react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import ThemedView from "@/components/themed-view";
import ThemedText from "@/components/themed-text";
import AppSidebar from "@/components/app-sidebar";
import SelectField from "@/components/select-field";
import { getItem } from "@/services/storage/secureStorage";

// ---------------------------------------------------------------------------
// BACKEND CONFIG
// ---------------------------------------------------------------------------
const API_BASE_URL = "https://new-kanja-portal.onrender.com/api";
const PROGRESS_RECORDS_ENDPOINT = `${API_BASE_URL}/progress_records.php`;
const AUTH_TOKEN_KEY = "kanja_auth_token";

const SCHOOL_NAME = "Stephen Kanja Primary & Junior School";
const PAGE_SIZE = 50;      // rows shown on screen per page
const EXPORT_CHUNK = 200;  // page size used only if the server can't do a one-shot export
const START_YEAR = 2026;   // Year filter starts here

// ---------------------------------------------------------------------------
// FILTER OPTIONS. value "" means "All".
// ---------------------------------------------------------------------------
type Opt = { label: string; value: string };

const GRADE_OPTS: Opt[] = [
  { label: "All Grades", value: "" },
  ...Array.from({ length: 9 }, (_, i) => ({ label: `Grade ${i + 1}`, value: String(i + 1) })),
];
const TERM_OPTS: Opt[] = [
  { label: "All Terms", value: "" },
  { label: "Term 1", value: "1" },
  { label: "Term 2", value: "2" },
  { label: "Term 3", value: "3" },
];
const SUBJECT_OPTS: Opt[] = [
  { label: "All Subjects", value: "" },
  { label: "Mathematics", value: "math" },
  { label: "English", value: "eng" },
  { label: "Kiswahili", value: "kisw" },
  { label: "S.S.T", value: "sst" },
  { label: "Science", value: "scie" },
  { label: "C.A", value: "ca" },
  { label: "Agriculture", value: "agri" },
  { label: "R.E", value: "re" },
  { label: "Pre-Technical", value: "pretec" },
];
const SUBJECT_LABELS: Record<string, string> = Object.fromEntries(
  SUBJECT_OPTS.filter((o) => o.value).map((o) => [o.value, o.label])
);

// Always-available exams (values match the server's normalised exam keys).
// Any extra exam types found in the database are added after these.
const DEFAULT_EXAMS: Opt[] = [
  { label: "Opener", value: "opener" },
  { label: "Mid-Term", value: "midterm" },
  { label: "End Term", value: "endterm" },
];

function buildExamOpts(fromServer: Opt[]): Opt[] {
  const seen = new Set(DEFAULT_EXAMS.map((e) => e.value));
  const extras = fromServer.filter((e) => e?.value && !seen.has(e.value));
  return [{ label: "All Exams", value: "" }, ...DEFAULT_EXAMS, ...extras];
}

// Years: START_YEAR up to (this year + 2), plus any older/other year that has data.
function buildYearOpts(dbYears: number[]): Opt[] {
  const thisYear = new Date().getFullYear();
  const maxYear = Math.max(thisYear + 2, START_YEAR, ...dbYears);
  const set = new Set<number>(dbYears.filter((y) => y > 0));
  for (let y = START_YEAR; y <= maxYear; y++) set.add(y);
  const sorted = Array.from(set).sort((a, b) => a - b);
  return [{ label: "All Years", value: "" }, ...sorted.map((y) => ({ label: String(y), value: String(y) }))];
}

const labelFor = (opts: Opt[], value: string) =>
  opts.find((o) => o.value === value)?.label ?? opts[0].label;
const valueFor = (opts: Opt[], label: string | null) =>
  opts.find((o) => o.label === label)?.value ?? "";
const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "");

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------
type Filters = {
  grade: string;
  term: string;
  examType: string;
  year: string;
  subject: string;
  studentId: string;
};
const EMPTY_FILTERS: Filters = { grade: "", term: "", examType: "", year: "", subject: "", studentId: "" };

type LearnerOption = { id: number | string; name: string; grade?: number | string | null };
type Meta = { learners: LearnerOption[]; years: number[]; examTypes: Opt[] };

type Stats = { totalLearners: number; recordsLogged: number; mean: number; passing: number; atRisk: number };
const EMPTY_STATS: Stats = { totalLearners: 0, recordsLogged: 0, mean: 0, passing: 0, atRisk: 0 };

type ProgressRow = {
  key: string;
  studentId: string;
  admNo: string;
  learnerName: string;
  initials: string;
  grade: string;
  term: string;
  examLabel: string;
  year: string;
  subjectLabel: string;
  score: number;
};

// Dropdown data rarely changes, so it's cached for the life of the app session.
let META_CACHE: Meta | null = null;

// ---------------------------------------------------------------------------
// GRADING (same thresholds as the web page)
// ---------------------------------------------------------------------------
function bandFor(score: number): { code: string; color: string; bg: string } {
  if (score >= 75) return { code: "E.E", color: "#16a34a", bg: "#dcfce7" };
  if (score >= 50) return { code: "M.E", color: "#2563eb", bg: "#dbeafe" };
  if (score >= 25) return { code: "A.E", color: "#d97706", bg: "#fef3c7" };
  return { code: "B.E", color: "#dc2626", bg: "#fee2e2" };
}
function scoreColor(score: number): string {
  if (score >= 75) return "#16a34a";
  if (score >= 50) return "#2563eb";
  if (score >= 35) return "#d97706";
  return "#dc2626";
}

const escapeHtml = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function normalizeRecords(raw: any[]): ProgressRow[] {
  return raw.map((r) => {
    const first = String(r.firstName ?? "");
    const last = String(r.surname ?? r.lastName ?? "");
    const name = `${first} ${last}`.trim();
    const subjectCode = String(r.subject ?? "");
    return {
      key: `${r.studentId}-${r.grade}-${r.term}-${r.examType}-${r.year}-${subjectCode}`,
      studentId: String(r.studentId ?? ""),
      admNo: String(r.admNo ?? "—"),
      learnerName: name || "—",
      initials: ((first[0] ?? "?") + (last[0] ?? "?")).toUpperCase(),
      grade: String(r.grade ?? "—"),
      term: String(r.term ?? "—"),
      examLabel: String(r.examLabel ?? r.examType ?? "—"),
      year: String(r.year ?? "—"),
      subjectLabel: SUBJECT_LABELS[subjectCode] ?? subjectCode,
      score: Number(r.score) || 0,
    };
  });
}

function normalizeStats(s: any): Stats {
  return {
    totalLearners: Number(s?.totalLearners) || 0,
    recordsLogged: Number(s?.recordsLogged) || 0,
    mean: Number(s?.mean) || 0,
    passing: Number(s?.passing) || 0,
    atRisk: Number(s?.atRisk) || 0,
  };
}

// Stats + per-subject means from a set of rows (used for the PDF and as a
// fallback if the server doesn't send stats)
function computeFromRows(rows: ProgressRow[]) {
  const learnerIds = new Set<string>();
  let sum = 0;
  let passing = 0;
  const bySubject = new Map<string, { sum: number; count: number }>();
  rows.forEach((r) => {
    learnerIds.add(r.studentId);
    sum += r.score;
    if (r.score >= 50) passing++;
    const s = bySubject.get(r.subjectLabel) ?? { sum: 0, count: 0 };
    s.sum += r.score;
    s.count++;
    bySubject.set(r.subjectLabel, s);
  });
  const stats: Stats = {
    totalLearners: learnerIds.size,
    recordsLogged: rows.length,
    mean: rows.length ? sum / rows.length : 0,
    passing,
    atRisk: rows.length - passing,
  };
  const means = Array.from(bySubject.entries())
    .map(([subject, v]) => ({ subject, mean: v.sum / v.count, count: v.count }))
    .sort((a, b) => a.subject.localeCompare(b.subject));
  return { stats, means };
}

function buildQuery(f: Filters, extra: Record<string, string | number> = {}) {
  const params = new URLSearchParams();
  if (f.grade) params.append("grade", f.grade);
  if (f.term) params.append("term", f.term);
  if (f.examType) params.append("exam_type", f.examType);
  if (f.year) params.append("year", f.year);
  if (f.subject) params.append("subject", f.subject);
  if (f.studentId) params.append("student_id", f.studentId);
  Object.entries(extra).forEach(([k, v]) => params.append(k, String(v)));
  return params.toString();
}

async function apiGet(query: string, signal?: AbortSignal) {
  const token = await getItem(AUTH_TOKEN_KEY);
  const res = await fetch(`${PROGRESS_RECORDS_ENDPOINT}${query ? `?${query}` : ""}`, {
    signal,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error(`Server responded ${res.status}`);
  return res.json();
}

// Column widths for the horizontally-scrolling table (mirrors the web table)
const COL = { n: 40, learner: 200, cls: 84, term: 72, exam: 96, year: 60, subject: 124, score: 170, grade: 80 };
const TABLE_W = Object.values(COL).reduce((a, b) => a + b, 0);

const MONO = Platform.select({ ios: "Courier", android: "monospace", default: "Courier New" });

// ---------------------------------------------------------------------------
// SCREEN
// ---------------------------------------------------------------------------
export default function ProgressRecord() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);

  const [records, setRecords] = useState<ProgressRow[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);

  const [meta, setMeta] = useState<Meta>(META_CACHE ?? { learners: [], years: [], examTypes: [] });

  const [loading, setLoading] = useState(true);        // first load only
  const [filtering, setFiltering] = useState(false);    // re-filtering (table stays visible)
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const examOpts: Opt[] = useMemo(() => buildExamOpts(meta.examTypes), [meta.examTypes]);
  const yearOpts: Opt[] = useMemo(() => buildYearOpts(meta.years), [meta.years]);

  // Learner list narrows to the chosen grade
  const learnerOpts: Opt[] = useMemo(() => {
    const seen = new Set<string>();
    const opts: Opt[] = [{ label: "All Learners", value: "" }];
    meta.learners.forEach((l) => {
      if (draft.grade && digits(l.grade) !== draft.grade) return;
      let label = `${l.name}${l.grade ? ` (Grade ${digits(l.grade) || l.grade})` : ""}`;
      if (seen.has(label)) label = `${label} #${l.id}`;
      seen.add(label);
      opts.push({ label, value: String(l.id) });
    });
    return opts;
  }, [meta.learners, draft.grade]);

  // ── Dropdown data: fetched once, cached ──
  const loadMeta = useCallback(async () => {
    if (META_CACHE) return;
    try {
      const data = await apiGet("meta=1");
      const m: Meta = {
        learners: Array.isArray(data.learners) ? data.learners : [],
        years: Array.isArray(data.years) ? data.years.map(Number) : [],
        examTypes: Array.isArray(data.examTypes) ? data.examTypes : [],
      };
      META_CACHE = m;
      setMeta(m);
    } catch {
      /* dropdowns still show the built-in exam and year options */
    }
  }, []);

  // ── Records: first page, or append the next page ──
  const load = useCallback(async (f: Filters, append = false, offset = 0) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setError(null);
    try {
      const data = await apiGet(
        buildQuery(f, { limit: PAGE_SIZE, offset: append ? offset : 0 }),
        controller.signal
      );
      const page = normalizeRecords(data.records ?? []);
      const hasServerTotals = typeof data.total === "number" && data.stats;

      setRecords((prev) => (append ? [...prev, ...page] : page));
      setTotal(hasServerTotals ? Number(data.total) : page.length);
      setStats(hasServerTotals ? normalizeStats(data.stats) : computeFromRows(page).stats);
      setApplied(f);
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      setError(err?.message ?? "Failed to load progress records");
    }
    if (abortRef.current === controller) {
      setLoading(false);
      setFiltering(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadMeta();
    load(EMPTY_FILTERS);
    return () => abortRef.current?.abort();
  }, [load, loadMeta]);

  const handleFilterPress = () => {
    setFiltering(true);
    load(draft);
  };
  const handleClear = () => {
    setDraft(EMPTY_FILTERS);
    setFiltering(true);
    load(EMPTY_FILTERS);
  };
  const handleRefresh = () => {
    setRefreshing(true);
    META_CACHE = null;
    loadMeta();
    load(applied);
  };
  const handleLoadMore = () => {
    if (loadingMore || records.length >= total) return;
    setLoadingMore(true);
    load(applied, true, records.length);
  };

  const setField = (key: keyof Filters, opts: Opt[]) => (label: string | null) =>
    setDraft((d) => {
      const next = { ...d, [key]: valueFor(opts, label) };
      if (key === "grade") next.studentId = "";
      return next;
    });

  // ── Filter summary (banner + PDF) ──
  const filterParts = useMemo(
    () => [
      labelFor(GRADE_OPTS, applied.grade),
      labelFor(TERM_OPTS, applied.term),
      labelFor(examOpts, applied.examType),
      applied.year || "All Years",
      labelFor(SUBJECT_OPTS, applied.subject),
      ...(applied.studentId
        ? [meta.learners.find((l) => String(l.id) === applied.studentId)?.name ?? "Selected learner"]
        : []),
    ],
    [applied, examOpts, meta.learners]
  );

  const hasActiveFilters = Object.values(draft).some(Boolean) || Object.values(applied).some(Boolean);

  // ── PDF: covers the WHOLE filtered list, not just the rows on screen ──
  const fetchAllRecords = async (): Promise<ProgressRow[]> => {
    // One-shot export
    const data = await apiGet(buildQuery(applied, { export: 1 }));
    let rows = normalizeRecords(data.records ?? []);
    const expected = typeof data.total === "number" ? Number(data.total) : rows.length;

    // Safety net: if the server ignored export=1, page through everything
    if (rows.length < expected) {
      rows = [];
      let offset = 0;
      while (offset < expected) {
        const chunk = await apiGet(buildQuery(applied, { limit: EXPORT_CHUNK, offset }));
        const part = normalizeRecords(chunk.records ?? []);
        if (part.length === 0) break;
        rows = rows.concat(part);
        offset += EXPORT_CHUNK;
      }
    }
    return rows;
  };

  const buildPdfHtml = (rows: ProgressRow[]) => {
    const { stats: s, means } = computeFromRows(rows);

    const rowsHtml = rows
      .map((r, i) => {
        const band = bandFor(r.score);
        return `<tr>
          <td class="c">${i + 1}</td>
          <td>${escapeHtml(r.admNo)}</td>
          <td><b>${escapeHtml(r.learnerName)}</b></td>
          <td>Grade ${escapeHtml(r.grade)}</td>
          <td>Term ${escapeHtml(r.term)}</td>
          <td>${escapeHtml(r.examLabel)}</td>
          <td>${escapeHtml(r.year)}</td>
          <td>${escapeHtml(r.subjectLabel)}</td>
          <td class="c" style="color:${scoreColor(r.score)};font-weight:700">${r.score}</td>
          <td class="c" style="color:${band.color};font-weight:700">${band.code}</td>
        </tr>`;
      })
      .join("");

    const meansHtml = means
      .map(
        (m) =>
          `<tr><td>${escapeHtml(m.subject)}</td><td class="c">${m.mean.toFixed(2)}</td><td class="c">${m.count}</td></tr>`
      )
      .join("");

    return `<!DOCTYPE html><html><head><meta charset="utf-8" />
<style>
  @page { margin: 18mm 12mm; }
  body { font-family: Helvetica, Arial, sans-serif; color: #1a1a18; font-size: 10px; }
  .band { background: #111; border-bottom: 3px solid #f0c040; padding: 14px; text-align: center; }
  .band h1 { color: #f0c040; font-size: 17px; margin: 0 0 4px; letter-spacing: 1px; }
  .band p { color: #fff; margin: 0; font-size: 11px; }
  .band small { color: #ccc; font-size: 8px; letter-spacing: 1px; }
  .meta { margin: 12px 0; font-size: 10px; color: #444; line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  th { background: #111; color: #f0c040; padding: 6px 5px; text-align: left; font-size: 9px; }
  td { padding: 5px; border-bottom: 1px solid #e5e5e5; }
  tbody tr:nth-child(even) { background: #f8f8f6; }
  .c { text-align: center; }
  h2 { font-size: 12px; margin: 18px 0 6px; }
  .summary { width: 60%; }
  .summary tfoot td { background: #fdf6e3; font-weight: 700; border-top: 2px solid #f0c040; }
</style></head><body>
  <div class="band">
    <h1>${escapeHtml(SCHOOL_NAME)}</h1>
    <p>Student Progress Records</p>
    <small>AIM HIGHER</small>
  </div>
  <div class="meta">
    <div><b>Filters:</b> ${filterParts.map(escapeHtml).join(" &nbsp;|&nbsp; ")}</div>
    <div><b>Generated:</b> ${escapeHtml(new Date().toLocaleString())} &nbsp;&nbsp; <b>Records:</b> ${rows.length} &nbsp;&nbsp; <b>Learners:</b> ${s.totalLearners}</div>
  </div>
  <table>
    <thead><tr>
      <th class="c">#</th><th>Adm No.</th><th>Learner</th><th>Class</th><th>Term</th>
      <th>Exam</th><th>Year</th><th>Subject</th><th class="c">Score</th><th class="c">Grade</th>
    </tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <h2>Summary</h2>
  <table class="summary">
    <thead><tr><th>Subject</th><th class="c">Mean Mark</th><th class="c">Entries</th></tr></thead>
    <tbody>${meansHtml}</tbody>
    <tfoot><tr><td>OVERALL MEAN MARK</td><td class="c">${s.mean.toFixed(2)}</td><td class="c">${rows.length}</td></tr></tfoot>
  </table>
</body></html>`;
  };

  const handleDownloadPdf = async () => {
    if (total === 0) return;
    setDownloading(true);
    setError(null);
    try {
      const rows = await fetchAllRecords();
      if (rows.length === 0) {
        setError("Nothing to export for these filters.");
        return;
      }
      const html = buildPdfHtml(rows);

      if (Platform.OS === "web") {
        await Print.printAsync({ html }); // choose "Save as PDF" in the print dialog
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: "application/pdf",
            UTI: "com.adobe.pdf",
            dialogTitle: "Progress Records",
          });
        } else {
          setError("Sharing isn't available on this device.");
        }
      }
    } catch {
      setError("Couldn't create the PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const busy = loading || filtering;

  return (
    <ThemedView style={styles.page}>
      {/* Header — black bar with gold rule, like the web */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.menuButton} onPress={() => setSidebarOpen(true)}>
          <Menu size={18} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.logoBadge}>
          <GraduationCap size={18} color={COLORS.black} />
        </View>
        <View style={styles.headerTextWrap}>
          <ThemedText style={styles.schoolName} numberOfLines={1}>
            STEPHEN KANJA <ThemedText style={styles.schoolNameGold}>SCHOOL</ThemedText>
          </ThemedText>
          <ThemedText style={styles.schoolMotto}>AIM HIGHER</ThemedText>
        </View>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <ThemedText style={styles.eyebrow}>ACADEMIC TRACKING</ThemedText>
        <ThemedText style={styles.pageTitle}>Progress Records</ThemedText>

        {error ? (
          <View style={styles.errorBanner}>
            <ThemedText style={styles.errorText}>{error}</ThemedText>
            <TouchableOpacity onPress={() => load(applied)}>
              <ThemedText style={styles.errorRetry}>Retry</ThemedText>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* School + active-filter banner */}
        <View style={styles.banner}>
          <View style={styles.bannerTitleRow}>
            <GraduationCap size={15} color={COLORS.gold} />
            <ThemedText style={styles.bannerSchool}>{SCHOOL_NAME.toUpperCase()}</ThemedText>
          </View>
          <View style={styles.bannerChips}>
            {filterParts.map((p, i) => (
              <View key={`${p}-${i}`} style={styles.bannerChip}>
                <ThemedText style={styles.bannerChipText}>{p}</ThemedText>
              </View>
            ))}
          </View>
        </View>

        {/* Stat cards */}
        <View style={[styles.statsGrid, filtering && styles.dimmed]}>
          <StatCard value={String(stats.totalLearners)} label="DISTINCT LEARNERS" accent="#f0c040" loading={loading} />
          <StatCard value={String(stats.recordsLogged)} label="RECORDS LOGGED" accent="#2563eb" loading={loading} />
          <StatCard value={stats.mean.toFixed(1)} label="MEAN MARK" accent="#7c3aed" loading={loading} />
          <StatCard value={String(stats.passing)} label="PASSING (≥50)" accent="#16a34a" loading={loading} />
          <StatCard value={String(stats.atRisk)} label="AT RISK (<50)" accent="#dc2626" loading={loading} wide />
        </View>

        {/* Filters */}
        <View style={styles.card}>
          <View style={styles.filterRow}>
            <View style={styles.filterHalf}>
              <SelectField
                label="Class / Grade"
                placeholder="All Grades"
                value={labelFor(GRADE_OPTS, draft.grade)}
                options={GRADE_OPTS.map((o) => o.label)}
                onChange={setField("grade", GRADE_OPTS)}
              />
            </View>
            <View style={styles.filterHalf}>
              <SelectField
                label="Term"
                placeholder="All Terms"
                value={labelFor(TERM_OPTS, draft.term)}
                options={TERM_OPTS.map((o) => o.label)}
                onChange={setField("term", TERM_OPTS)}
              />
            </View>
            <View style={styles.filterHalf}>
              <SelectField
                label="Exam"
                placeholder="All Exams"
                value={labelFor(examOpts, draft.examType)}
                options={examOpts.map((o) => o.label)}
                onChange={setField("examType", examOpts)}
              />
            </View>
            <View style={styles.filterHalf}>
              <SelectField
                label="Year"
                placeholder="All Years"
                value={labelFor(yearOpts, draft.year)}
                options={yearOpts.map((o) => o.label)}
                onChange={setField("year", yearOpts)}
              />
            </View>
            <View style={styles.filterHalf}>
              <SelectField
                label="Subject"
                placeholder="All Subjects"
                value={labelFor(SUBJECT_OPTS, draft.subject)}
                options={SUBJECT_OPTS.map((o) => o.label)}
                onChange={setField("subject", SUBJECT_OPTS)}
              />
            </View>
            <View style={styles.filterHalf}>
              <SelectField
                label="Learner"
                placeholder="All Learners"
                value={labelFor(learnerOpts, draft.studentId)}
                options={learnerOpts.map((o) => o.label)}
                onChange={setField("studentId", learnerOpts)}
              />
            </View>
          </View>

          <View style={styles.filterActions}>
            <TouchableOpacity
              style={[styles.filterButton, { flex: 1 }, busy && styles.buttonBusy]}
              onPress={handleFilterPress}
              disabled={busy}
            >
              {busy ? <ActivityIndicator size="small" color={COLORS.black} /> : <Search size={16} color="#111111" />}
              <ThemedText style={styles.filterButtonText}>{busy ? "Loading…" : "Filter"}</ThemedText>
            </TouchableOpacity>
            {hasActiveFilters ? (
              <TouchableOpacity style={styles.clearButton} onPress={handleClear} disabled={busy}>
                <X size={14} color="#888780" />
                <ThemedText style={styles.clearButtonText}>Clear</ThemedText>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Entries header + PDF button */}
        <View style={styles.entriesRow}>
          <View style={styles.entriesLeft}>
            <ThemedText style={styles.entriesLabel}>Progress Entries</ThemedText>
            <View style={styles.countPill}>
              <ThemedText style={styles.countPillText}>{total} records</ThemedText>
            </View>
          </View>
          {total > 0 ? (
            <TouchableOpacity
              style={[styles.downloadButton, downloading && styles.downloadButtonDisabled]}
              onPress={handleDownloadPdf}
              disabled={downloading}
            >
              {downloading ? (
                <ActivityIndicator size="small" color={COLORS.gold} />
              ) : (
                <FileText size={15} color={COLORS.gold} />
              )}
              <ThemedText style={styles.downloadButtonText}>
                {downloading ? "Preparing…" : "Download PDF"}
              </ThemedText>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Table */}
        <View style={[styles.tableWrap, filtering && styles.dimmed]}>
          <View style={styles.tableBanner}>
            <ThemedText style={styles.tableBannerText}>STUDENT PROGRESS RECORDS</ThemedText>
          </View>

          {loading ? (
            <View style={styles.stateWrap}>
              <ActivityIndicator size="small" color={COLORS.gold} />
              <ThemedText style={styles.stateText}>Loading progress records…</ThemedText>
            </View>
          ) : records.length === 0 ? (
            <View style={styles.stateWrap}>
              <View style={styles.emptyIcon}>
                <GraduationCap size={26} color={COLORS.gold} />
              </View>
              <ThemedText style={styles.emptyTitle}>No records found</ThemedText>
              <ThemedText style={styles.stateText}>Try adjusting your filters, or upload results first.</ThemedText>
            </View>
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled>
                <View style={{ width: TABLE_W }}>
                  {/* Column headings */}
                  <View style={styles.colRow}>
                    <ThemedText style={[styles.colLabel, { width: COL.n, textAlign: "center" }]}>#</ThemedText>
                    <ThemedText style={[styles.colLabel, { width: COL.learner }]}>LEARNER</ThemedText>
                    <ThemedText style={[styles.colLabel, { width: COL.cls }]}>CLASS</ThemedText>
                    <ThemedText style={[styles.colLabel, { width: COL.term }]}>TERM</ThemedText>
                    <ThemedText style={[styles.colLabel, { width: COL.exam }]}>EXAM</ThemedText>
                    <ThemedText style={[styles.colLabel, { width: COL.year }]}>YEAR</ThemedText>
                    <ThemedText style={[styles.colLabel, { width: COL.subject }]}>SUBJECT</ThemedText>
                    <ThemedText style={[styles.colLabel, { width: COL.score }]}>SCORE</ThemedText>
                    <ThemedText style={[styles.colLabel, { width: COL.grade }]}>GRADE</ThemedText>
                  </View>

                  {records.map((row, index) => {
                    const band = bandFor(row.score);
                    const pct = Math.min(100, Math.max(0, row.score));
                    return (
                      <View key={`${row.key}-${index}`} style={styles.dataRow}>
                        <ThemedText style={[styles.cellIndex, { width: COL.n }]}>{index + 1}</ThemedText>
                        <View style={[styles.learnerCell, { width: COL.learner }]}>
                          <View style={styles.avatar}>
                            <ThemedText style={styles.avatarText}>{row.initials}</ThemedText>
                          </View>
                          <ThemedText style={styles.learnerName} numberOfLines={1}>
                            {row.learnerName}
                          </ThemedText>
                        </View>
                        <ThemedText style={[styles.cellMono, { width: COL.cls }]}>Grade {row.grade}</ThemedText>
                        <ThemedText style={[styles.cellText, { width: COL.term }]}>Term {row.term}</ThemedText>
                        <ThemedText style={[styles.cellText, { width: COL.exam }]} numberOfLines={1}>
                          {row.examLabel}
                        </ThemedText>
                        <ThemedText style={[styles.cellText, { width: COL.year }]}>{row.year}</ThemedText>
                        <ThemedText style={[styles.cellText, { width: COL.subject }]} numberOfLines={1}>
                          {row.subjectLabel}
                        </ThemedText>
                        <View style={[styles.scoreCell, { width: COL.score }]}>
                          <View style={styles.scoreBar}>
                            <View
                              style={[
                                styles.scoreBarFill,
                                { width: `${pct}%` as `${number}%`, backgroundColor: scoreColor(row.score) },
                              ]}
                            />
                          </View>
                          <ThemedText style={styles.scoreNum}>{row.score}</ThemedText>
                        </View>
                        <View style={{ width: COL.grade }}>
                          <View style={[styles.gradePill, { backgroundColor: band.bg }]}>
                            <ThemedText style={[styles.gradePillText, { color: band.color }]}>{band.code}</ThemedText>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>

              {/* Load more */}
              {records.length < total ? (
                <TouchableOpacity style={styles.loadMore} onPress={handleLoadMore} disabled={loadingMore}>
                  {loadingMore ? <ActivityIndicator size="small" color={COLORS.black} /> : null}
                  <ThemedText style={styles.loadMoreText}>
                    {loadingMore ? "Loading…" : `Load more (${records.length} of ${total})`}
                  </ThemedText>
                </TouchableOpacity>
              ) : null}

              <View style={styles.footerRow}>
                <ThemedText style={styles.footerLabel}>Mean Mark</ThemedText>
                <ThemedText style={styles.footerValue}>{stats.mean.toFixed(2)}</ThemedText>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      <AppSidebar visible={sidebarOpen} onClose={() => setSidebarOpen(false)} activeRoute="/progress-records" />
    </ThemedView>
  );
}

function StatCard({
  value,
  label,
  accent,
  loading,
  wide,
}: {
  value: string;
  label: string;
  accent: string;
  loading: boolean;
  wide?: boolean;
}) {
  return (
    <View style={[styles.statCard, { borderTopColor: accent }, wide && styles.statCardWide]}>
      {loading ? (
        <ActivityIndicator size="small" color={accent} style={{ alignSelf: "flex-start" }} />
      ) : (
        <ThemedText style={styles.statValue}>{value}</ThemedText>
      )}
      <ThemedText style={styles.statLabel}>{label}</ThemedText>
    </View>
  );
}

const COLORS = {
  gold: "#f0c040",
  goldDim: "#c9a030",
  black: "#111111",
  mid: "#2a2a2a",
  bg: "#f4f4f2",
  border: "rgba(0,0,0,0.08)",
};

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.bg },
  dimmed: { opacity: 0.55 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.black,
    borderBottomWidth: 3,
    borderBottomColor: COLORS.gold,
    paddingTop: 48,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  menuButton: {
    width: 34, height: 34, borderRadius: 7, backgroundColor: COLORS.mid,
    alignItems: "center", justifyContent: "center",
  },
  logoBadge: {
    width: 36, height: 36, borderRadius: 8, backgroundColor: COLORS.gold,
    alignItems: "center", justifyContent: "center",
  },
  headerTextWrap: { flex: 1, minWidth: 0 },
  schoolName: { color: "#FFFFFF", fontSize: 17, fontWeight: "800", letterSpacing: 2 },
  schoolNameGold: { color: COLORS.gold, fontSize: 17, fontWeight: "800", letterSpacing: 2 },
  schoolMotto: { color: "#888", fontSize: 9, fontWeight: "600", letterSpacing: 1.5, marginTop: 2 },

  // Body
  body: { flex: 1 },
  bodyContent: { padding: 16, paddingBottom: 60, gap: 16 },
  eyebrow: { color: COLORS.goldDim, fontSize: 11, fontWeight: "700", letterSpacing: 1.2 },
  pageTitle: {
    fontSize: 26, color: "#1a1a18", marginTop: -10,
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "Georgia, serif" }),
  },
  errorBanner: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#fdecea", borderWidth: 1, borderColor: "#f5c6cb", borderRadius: 10, padding: 12,
  },
  errorText: { color: "#b71c1c", fontSize: 12, flex: 1, marginRight: 8 },
  errorRetry: { color: "#b71c1c", fontSize: 12, fontWeight: "700" },

  // Banner
  banner: { backgroundColor: COLORS.black, borderRadius: 12, padding: 14, gap: 10 },
  bannerTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  bannerSchool: { color: COLORS.gold, fontSize: 12, fontWeight: "800", letterSpacing: 1, flexShrink: 1 },
  bannerChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  bannerChip: { backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3 },
  bannerChipText: { color: "#eee", fontSize: 11, fontWeight: "700" },

  // Stat cards
  statsGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 12 },
  statCard: {
    width: "48%", backgroundColor: "#FFFFFF", borderRadius: 12, borderTopWidth: 3,
    borderWidth: 1, borderColor: COLORS.border, paddingVertical: 16, paddingHorizontal: 16, gap: 4,
  },
  statCardWide: { width: "100%" },
  statValue: { fontSize: 30, fontWeight: "800", color: COLORS.black, lineHeight: 34 },
  statLabel: { fontSize: 11, fontWeight: "700", color: "#888780", letterSpacing: 0.8 },

  // Filters
  card: { backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: 16 },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  filterHalf: { flexBasis: "47%", flexGrow: 1 },
  filterActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  filterButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: COLORS.gold, height: 46, borderRadius: 8,
  },
  buttonBusy: { opacity: 0.75 },
  filterButtonText: { color: COLORS.black, fontWeight: "700", fontSize: 14 },
  clearButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    height: 46, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border,
  },
  clearButtonText: { color: "#888780", fontWeight: "600", fontSize: 13 },

  // Entries row
  entriesRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 },
  entriesLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  entriesLabel: { fontSize: 14, fontWeight: "600", color: "#1a1a18" },
  countPill: { backgroundColor: COLORS.black, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3 },
  countPillText: { color: COLORS.gold, fontSize: 11, fontWeight: "700" },
  downloadButton: {
    flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: COLORS.black,
    borderWidth: 1, borderColor: COLORS.gold, borderRadius: 8, paddingHorizontal: 14, height: 40,
  },
  downloadButtonDisabled: { opacity: 0.6 },
  downloadButtonText: { color: COLORS.gold, fontSize: 13, fontWeight: "600" },

  // Table
  tableWrap: { backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" },
  tableBanner: {
    backgroundColor: COLORS.black, borderBottomWidth: 2, borderBottomColor: COLORS.gold,
    paddingVertical: 14, alignItems: "center",
  },
  tableBannerText: { color: COLORS.gold, fontSize: 14, fontWeight: "800", letterSpacing: 2 },
  colRow: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fafafa",
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  colLabel: { fontSize: 11, fontWeight: "700", color: "#888780", letterSpacing: 0.8, paddingHorizontal: 8 },
  dataRow: {
    flexDirection: "row", alignItems: "center", paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.05)",
  },
  cellIndex: { fontSize: 12, fontWeight: "500", color: "#888780", textAlign: "center" },
  cellText: { fontSize: 13.5, color: "#1a1a18", paddingHorizontal: 8 },
  cellMono: { fontSize: 12.5, color: "#5f5e5a", paddingHorizontal: 8, fontFamily: MONO },
  learnerCell: { flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 8 },
  avatar: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.black,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: COLORS.gold, fontSize: 11, fontWeight: "700" },
  learnerName: { fontSize: 13.5, fontWeight: "700", color: "#1a1a18", flexShrink: 1 },
  scoreCell: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8 },
  scoreBar: { flex: 1, height: 5, backgroundColor: "#eee", borderRadius: 99, overflow: "hidden" },
  scoreBarFill: { height: "100%", borderRadius: 99 },
  scoreNum: { width: 30, textAlign: "right", fontSize: 13, fontWeight: "700", color: "#1a1a18" },
  gradePill: { alignSelf: "flex-start", marginHorizontal: 8, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3 },
  gradePillText: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  loadMore: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 14, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: "#fafafa",
  },
  loadMoreText: { color: COLORS.black, fontSize: 13, fontWeight: "700" },
  footerRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: "#fdf6e3", borderTopWidth: 2, borderTopColor: COLORS.gold,
    paddingVertical: 12, paddingHorizontal: 16,
  },
  footerLabel: { fontSize: 13, fontWeight: "700", color: COLORS.black },
  footerValue: { fontSize: 14, fontWeight: "800", color: COLORS.black },

  // States
  stateWrap: { paddingVertical: 40, paddingHorizontal: 20, alignItems: "center", gap: 8 },
  emptyIcon: {
    width: 60, height: 60, borderRadius: 16, backgroundColor: COLORS.black,
    alignItems: "center", justifyContent: "center", marginBottom: 6,
  },
  emptyTitle: { fontSize: 15, fontWeight: "600", color: "#1a1a18" },
  stateText: { fontSize: 12, color: "#888780", textAlign: "center" },
});