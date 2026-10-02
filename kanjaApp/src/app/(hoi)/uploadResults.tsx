import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
} from 'react-native';
import {
  Menu,
  GraduationCap,
  FileSpreadsheet,
  Pencil,
  Table2,
  Search,
  ListChecks,
  CheckSquare,
  Square,
  CheckCheck,
  X as ClearIcon,
  Download,
  UploadCloud,
  FileUp,
  Home,
  Users,
  TrendingUp,
  UserPlus,
  ClipboardCheck,
  Presentation,
  Bell,
  PieChart,
  Grid3x3,
  BookOpen,
  Layers,
  UserX,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import ThemedView from '@/components/themed-view';
import ThemedText from '@/components/themed-text';
import SelectField from '@/components/select-field';
import { useAuth } from '@/context/AuthContext';
import { API_BASE, apiRequest, getStoredToken } from '@/services/api/client';

const GRADES = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
const TERMS = ['1', '2', '3'];
const EXAM_TYPES = [
  { value: 'opener', label: 'Opener' },
  { value: 'midterm', label: 'Midterm' },
  { value: 'endterm', label: 'End Term' },
];
const YEARS = ['2026', '2027', '2028'];

type Subject = { code: string; label: string };
type StudentRow = {
  id: string;
  assesment: string;
  firstName: string;
  surname: string;
  marks: Record<string, string | null>;
  selected: boolean;
};

type Tab = 'manual' | 'bulk';
type ViewMode = 'one' | 'multi';

type Notice = {
  kind: 'success' | 'warning';
  title: string;
  message: string;
  details?: string[];
} | null;

type SubjectsResponse = { grade: string; maxTotal: number; subjects: Subject[] };
type StudentsResponse = { grade: string; subjects: Subject[]; students: any[]; warning?: string };
type UploadResponse = { saved: number; skipped: number; errors: string[] };

// ─────────────────────────────────────────────────────────────
// Sidebar
// ─────────────────────────────────────────────────────────────

type SidebarItem = {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  route: string;
};

const NAV_ITEMS: SidebarItem[] = [
  { icon: Home, label: 'Dashboard', route: '/dashboard' },
  { icon: Users, label: 'Students', route: '/students' },
  { icon: TrendingUp, label: 'Progress Records', route: '/progress' },
];

const ADMIN_ITEMS: SidebarItem[] = [
  { icon: UserPlus, label: 'Register Learners', route: '/registerLearner' },
  { icon: ClipboardCheck, label: 'Attendance', route: '/attendance' },
  { icon: Presentation, label: 'Register Teachers', route: '/registerTeacher' },
  { icon: Bell, label: 'Notices', route: '/notices' },
];

const ACADEMIC_ITEMS: SidebarItem[] = [
  { icon: PieChart, label: 'Results', route: '/uploadResults' },
  { icon: Grid3x3, label: 'Timetable', route: '/timetable' },
];

function AppSidebar({
  visible,
  onClose,
  activeRoute,
}: {
  visible: boolean;
  onClose: () => void;
  activeRoute: string;
}) {
  const router = useRouter();

  function go(route: string) {
    onClose();
    router.push(route as any);
  }

  function renderItem({ icon: Icon, label, route }: SidebarItem) {
    const active = activeRoute === route;
    return (
      <TouchableOpacity
        key={route}
        style={[sidebarStyles.item, active && sidebarStyles.itemActive]}
        onPress={() => go(route)}
      >
        <Icon size={18} color={active ? '#FFFFFF' : '#8888A0'} />
        <ThemedText style={[sidebarStyles.itemText, active && sidebarStyles.itemTextActive]}>
          {label}
        </ThemedText>
      </TouchableOpacity>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={sidebarStyles.overlay}>
        <View style={sidebarStyles.sidebar}>
          <View style={sidebarStyles.brandRow}>
            <View style={sidebarStyles.brandBadge}>
              <GraduationCap size={20} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={sidebarStyles.brandName}>Kanja School</ThemedText>
              <ThemedText style={sidebarStyles.brandSub}>MANAGEMENT SYSTEM</ThemedText>
            </View>
            <TouchableOpacity style={sidebarStyles.closeBtn} onPress={onClose}>
              <ClearIcon size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={sidebarStyles.navScroll}>
            {NAV_ITEMS.map(renderItem)}

            <ThemedText style={sidebarStyles.sectionLabel}>ADMINISTRATION</ThemedText>
            {ADMIN_ITEMS.map(renderItem)}

            <ThemedText style={sidebarStyles.sectionLabel}>ACADEMICS</ThemedText>
            {ACADEMIC_ITEMS.map(renderItem)}
          </ScrollView>
        </View>

        <TouchableOpacity style={sidebarStyles.backdrop} onPress={onClose} activeOpacity={1} />
      </View>
    </Modal>
  );
}

const sidebarStyles = StyleSheet.create({
  overlay: { flex: 1, flexDirection: 'row' },
  sidebar: { width: 280, backgroundColor: '#183766', paddingTop: 50, paddingHorizontal: 14 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28, paddingHorizontal: 4 },
  brandBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#6C5CE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  brandSub: { color: '#8888A0', fontSize: 9, letterSpacing: 1, marginTop: 2 },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#232342',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navScroll: { paddingBottom: 40 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  itemActive: { backgroundColor: '#6C5CE7' },
  itemText: { color: '#8888A0', fontSize: 14, fontWeight: '600' },
  itemTextActive: { color: '#FFFFFF' },
  sectionLabel: {
    color: '#6B6B85',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 20,
    marginBottom: 8,
    paddingHorizontal: 14,
  },
});

// ─────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────

export default function UploadResults() {
  const { token } = useAuth();
  const scrollRef = useRef<ScrollView>(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('manual');
  const [viewMode, setViewMode] = useState<ViewMode>('one');
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [multiSubjects, setMultiSubjects] = useState<string[]>([]);

  const [grade, setGrade] = useState<string | null>(null);
  const [term, setTerm] = useState<string | null>(null);
  const [examType, setExamType] = useState<string | null>(null);
  const [year, setYear] = useState<string | null>(null);
  const [examOutOf, setExamOutOf] = useState('100');

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchText, setSearchText] = useState('');

  const [bulkSelectedSubjects, setBulkSelectedSubjects] = useState<string[]>([]);
  const [bulkFile, setBulkFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);

  const [notice, setNotice] = useState<Notice>(null);

  // Success notices fade away on their own; warnings stay until dismissed.
  useEffect(() => {
    if (!notice || notice.kind !== 'success') return;
    const t = setTimeout(() => setNotice(null), 7000);
    return () => clearTimeout(t);
  }, [notice]);

  const examLabel = EXAM_TYPES.find((e) => e.value === examType)?.label ?? '';
  const contextLine = `Grade ${grade}, ${examLabel}, Term ${term} ${year}`;

  // ── Load subjects + roster whenever grade changes ──
  const loadGrade = useCallback(async () => {
    if (!grade) {
      setSubjects([]);
      setStudents([]);
      return;
    }
    if (!token) return;

    setLoadingRoster(true);
    try {
      const subjRes = await apiRequest<SubjectsResponse>('/results/subjects.php', {
        method: 'POST',
        body: { grade },
      });
      setSubjects(subjRes.subjects);
      setActiveSubject((prev) =>
        prev && subjRes.subjects.some((s) => s.code === prev) ? prev : subjRes.subjects[0]?.code ?? null
      );
      setMultiSubjects(subjRes.subjects.map((s: Subject) => s.code));
      setBulkSelectedSubjects(subjRes.subjects.map((s: Subject) => s.code));

      const rosterRes = await apiRequest<StudentsResponse>('/results/students.php', {
        method: 'POST',
        body: { grade, term: term ?? '', examType: examType ?? '', year: year ?? '' },
      });

      setStudents(
        rosterRes.students.map((s: any) => ({
          id: s.id,
          assesment: s.assesment,
          firstName: s.firstName,
          surname: s.surname,
          marks: Object.fromEntries(
            Object.entries(s.marks).map(([k, v]) => [k, v === null ? '' : String(v)])
          ),
          selected: true,
        }))
      );
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not load grade data');
    } finally {
      setLoadingRoster(false);
    }
  }, [grade, term, examType, year, token]);

  useEffect(() => {
    loadGrade();
  }, [loadGrade]);

  function updateMark(studentId: string, code: string, value: string) {
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, marks: { ...s.marks, [code]: value } } : s))
    );
  }

  function toggleSelected(studentId: string) {
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, selected: !s.selected } : s))
    );
  }

  function toggleSelectAll() {
    const allSelected = students.every((s) => s.selected);
    setStudents((prev) => prev.map((s) => ({ ...s, selected: !allSelected })));
  }

  function clearMarks() {
    setStudents((prev) =>
      prev.map((s) => ({ ...s, marks: Object.fromEntries(subjects.map((sub) => [sub.code, ''])) }))
    );
  }

  function toggleMultiSubject(code: string) {
    setMultiSubjects((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  const visibleCodes =
    viewMode === 'multi'
      ? subjects.filter((s) => multiSubjects.includes(s.code)).map((s) => s.code)
      : activeSubject
      ? [activeSubject]
      : [];

  const labelFor = (code: string) => subjects.find((s) => s.code === code)?.label ?? code;

  const filteredStudents = students.filter((s) => {
    if (!searchText.trim()) return true;
    const q = searchText.trim().toLowerCase();
    return (
      s.assesment?.toLowerCase().includes(q) ||
      s.firstName?.toLowerCase().includes(q) ||
      s.surname?.toLowerCase().includes(q)
    );
  });

  async function submitManual() {
    if (!grade || !term || !examType || !year) {
      Alert.alert('Missing info', 'Please select Grade, Term, Exam name and Year first.');
      return;
    }

    const outOf = Number(examOutOf);
    if (!outOf || outOf <= 0) {
      Alert.alert('Invalid "Exam out of"', 'Enter the maximum mark for this exam, e.g. 100.');
      return;
    }

    // Build payload; convert to /100 when the exam was marked out of something else.
    const overMax: string[] = [];
    const payloadStudents = students
      .filter((s) => s.selected)
      .map((s) => {
        const marks: Record<string, string> = {};
        visibleCodes.forEach((code) => {
          const raw = String(s.marks[code] ?? '').trim();
          if (raw === '') return;
          const n = Number(raw);
          if (n > outOf) {
            overMax.push(`${s.firstName} ${s.surname} – ${labelFor(code)}: ${n} is above ${outOf}`);
            return;
          }
          marks[code] = outOf === 100 ? raw : String(Math.round((n / outOf) * 100));
        });
        return { id: s.id, marks };
      })
      .filter((s) => Object.keys(s.marks).length > 0);

    if (overMax.length > 0) {
      Alert.alert(
        'Marks above the maximum',
        `${overMax.slice(0, 6).join('\n')}${overMax.length > 6 ? `\n…and ${overMax.length - 6} more` : ''}`
      );
      return;
    }

    if (payloadStudents.length === 0) {
      Alert.alert('Nothing to submit', 'Enter at least one mark before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest<UploadResponse>('/results/upload.php', {
        method: 'POST',
        body: { grade, term, examType, year, students: payloadStudents },
      });
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      if (res.errors?.length) {
        setNotice({
          kind: 'warning',
          title: 'Marks saved with some issues',
          message: `Saved ${res.saved}, skipped ${res.skipped} — ${contextLine}.`,
          details: res.errors,
        });
      } else {
        setNotice({
          kind: 'success',
          title: 'Marks uploaded successfully',
          message: `Saved marks for ${res.saved} student${res.saved === 1 ? '' : 's'} — ${contextLine}.`,
        });
      }
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Upload failed');
    } finally {
      setSubmitting(false);
    }
  }

  function toggleBulkSubject(code: string) {
    setBulkSelectedSubjects((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  async function pickBulkFile() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/comma-separated-values', '*/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    setBulkFile(result.assets[0]);
  }

  function openTemplateDownload() {
    if (!grade) {
      Alert.alert('Select a grade', 'Please select a grade first.');
      return;
    }
    if (bulkSelectedSubjects.length === 0) {
      Alert.alert('Select subjects', 'Please select at least one subject.');
      return;
    }
    const params = new URLSearchParams({ grade });
    bulkSelectedSubjects.forEach((s) => params.append('subjects[]', s));
    Linking.openURL(
      `https://stephenkanjaportal.infinityfreeapp.com/generate_template.php?${params.toString()}`
    );
  }

  async function submitBulk() {
    if (!grade || !term || !examType || !year) {
      Alert.alert('Missing info', 'Please select Grade, Term, Exam name and Year first.');
      return;
    }
    if (!bulkFile) {
      Alert.alert('No file selected', 'Please choose a completed CSV file.');
      return;
    }

    setBulkUploading(true);
    try {
      const authToken = await getStoredToken();
      const formData = new FormData();
      formData.append('grade', grade);
      formData.append('term', term);
      formData.append('examType', examType);
      formData.append('year', year);
      // @ts-expect-error - React Native's FormData file shape
      formData.append('marksFile', {
        uri: bulkFile.uri,
        name: bulkFile.name ?? 'marks.csv',
        type: 'text/csv',
      });

      const res = await fetch(`${API_BASE}/results/upload_bulk.php`, {
        method: 'POST',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
        body: formData,
      });
      const json = await res.json();

      if (!res.ok || json.success === false) {
        throw new Error(json.message ?? 'Bulk upload failed');
      }

      scrollRef.current?.scrollTo({ y: 0, animated: true });
      if (json.errors?.length) {
        setNotice({
          kind: 'warning',
          title: 'File uploaded with some issues',
          message: `Saved ${json.saved}, skipped ${json.skipped} — ${contextLine}.`,
          details: json.errors,
        });
      } else {
        setNotice({
          kind: 'success',
          title: 'Marks uploaded successfully',
          message: `Saved marks for ${json.saved} student${json.saved === 1 ? '' : 's'} from ${
            bulkFile.name ?? 'your file'
          } — ${contextLine}.`,
        });
        setBulkFile(null);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Bulk upload failed');
    } finally {
      setBulkUploading(false);
    }
  }

  return (
    <ThemedView style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.menuButton} onPress={() => setSidebarOpen(true)}>
            <Menu size={20} color="#2B3645" />
          </TouchableOpacity>
          <View style={styles.logoBadge}>
            <GraduationCap size={20} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.header1}>
              Stephen Kanja <ThemedText style={styles.headerAccent}>School</ThemedText>
            </ThemedText>
            <ThemedText style={styles.header2}>Aim Higher</ThemedText>
          </View>
          <View style={styles.headerDot} />
        </View>
      </View>

      {/* Success / warning toast */}
      {notice && (
        <View
          style={[
            styles.toast,
            notice.kind === 'success' ? styles.toastSuccess : styles.toastWarning,
          ]}
        >
          <View style={styles.toastIcon}>
            {notice.kind === 'success' ? (
              <CheckCircle2 size={22} color="#FFFFFF" />
            ) : (
              <AlertTriangle size={22} color="#FFFFFF" />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.toastTitle}>{notice.title}</ThemedText>
            <ThemedText style={styles.toastMessage}>{notice.message}</ThemedText>
            {notice.details?.slice(0, 5).map((d, i) => (
              <ThemedText key={i} style={styles.toastDetail}>
                • {d}
              </ThemedText>
            ))}
            {notice.details && notice.details.length > 5 && (
              <ThemedText style={styles.toastDetail}>…and {notice.details.length - 5} more</ThemedText>
            )}
          </View>
          <TouchableOpacity onPress={() => setNotice(null)} hitSlop={10}>
            <ClearIcon size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView ref={scrollRef} style={styles.body} contentContainerStyle={styles.bodyContent}>
        {/* Main card */}
        <View style={styles.card}>
          {/* Tabs */}
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tabButton, tab === 'manual' && styles.tabButtonActive]}
              onPress={() => setTab('manual')}
            >
              <Pencil size={16} color={tab === 'manual' ? COLORS.green : COLORS.textDark} />
              <ThemedText style={[styles.tabText, tab === 'manual' && styles.tabTextActive]}>
                Enter Marks
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, tab === 'bulk' && styles.tabButtonActive]}
              onPress={() => setTab('bulk')}
            >
              <FileSpreadsheet size={16} color={tab === 'bulk' ? COLORS.green : COLORS.textDark} />
              <ThemedText style={[styles.tabText, tab === 'bulk' && styles.tabTextActive]}>
                Bulk Excel Upload
              </ThemedText>
            </TouchableOpacity>
          </View>

          {/* Filters */}
          <SelectField
            label="Grade"
            placeholder="Select grade"
            value={grade}
            options={GRADES.map((g) => `Grade ${g}`)}
            onChange={(v) => setGrade(v ? v.replace('Grade ', '') : null)}
          />

          {tab === 'manual' && viewMode === 'one' && subjects.length > 0 && (
            <SelectField
              label="Subject"
              placeholder="Select subject"
              value={subjects.find((s) => s.code === activeSubject)?.label ?? null}
              options={subjects.map((s) => s.label)}
              onChange={(v) => {
                const found = subjects.find((s) => s.label === v);
                if (found) setActiveSubject(found.code);
              }}
            />
          )}

          <SelectField
            label="Term"
            placeholder="Select term"
            value={term}
            options={TERMS.map((t) => `Term ${t}`)}
            onChange={(v) => setTerm(v ? v.replace('Term ', '') : null)}
          />
          <SelectField label="Year" placeholder="Select year" value={year} options={YEARS} onChange={setYear} />
          <SelectField
            label="Exam name"
            placeholder="Select exam"
            value={examLabel || null}
            options={EXAM_TYPES.map((e) => e.label)}
            onChange={(v) => setExamType(EXAM_TYPES.find((e) => e.label === v)?.value ?? null)}
          />

          {tab === 'manual' && (
            <>
              <ThemedText style={styles.fieldLabel}>Exam out of</ThemedText>
              <TextInput
                style={styles.textField}
                keyboardType="number-pad"
                value={examOutOf}
                onChangeText={(v) => setExamOutOf(v.replace(/[^0-9]/g, ''))}
                placeholder="100"
                placeholderTextColor="#9AA4B2"
              />
              <ThemedText style={styles.fieldHint}>
                Marks are saved out of 100 — other values are converted.
              </ThemedText>

              {/* One subject / Multiple subjects */}
              <View style={styles.segment}>
                <TouchableOpacity
                  style={[styles.segmentBtn, viewMode === 'one' && styles.segmentBtnActive]}
                  onPress={() => setViewMode('one')}
                >
                  <BookOpen size={15} color={viewMode === 'one' ? COLORS.green : COLORS.textDark} />
                  <ThemedText style={[styles.segmentText, viewMode === 'one' && styles.segmentTextActive]}>
                    One subject
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segmentBtn, viewMode === 'multi' && styles.segmentBtnActive]}
                  onPress={() => setViewMode('multi')}
                >
                  <Layers size={15} color={viewMode === 'multi' ? COLORS.green : COLORS.textDark} />
                  <ThemedText style={[styles.segmentText, viewMode === 'multi' && styles.segmentTextActive]}>
                    Multiple subjects
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {tab === 'manual' ? (
          /* ── Marks card ── */
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <View style={styles.cardTitleLeft}>
                <Table2 size={17} color={COLORS.green} />
                <ThemedText style={styles.cardTitle} numberOfLines={1}>
                  {viewMode === 'one'
                    ? `${activeSubject ? labelFor(activeSubject) : 'Subject'} marks`
                    : 'Multi-subject marks'}
                </ThemedText>
              </View>
              <View style={styles.countPill}>
                <ThemedText style={styles.countPillText}>{filteredStudents.length} students</ThemedText>
              </View>
            </View>

            <View style={styles.searchBox}>
              <Search size={16} color="#9AA4B2" />
              <TextInput
                style={styles.searchInput}
                placeholder={grade ? 'Search learner by name or assessment no...' : 'Select a grade first...'}
                placeholderTextColor="#9AA4B2"
                value={searchText}
                onChangeText={setSearchText}
                editable={!!grade}
              />
            </View>

            {viewMode === 'multi' && subjects.length > 0 && (
              <View style={styles.multiBox}>
                <ThemedText style={styles.multiTitle}>Subjects to enter together</ThemedText>
                <View style={styles.subjectsGrid}>
                  {subjects.map((subject) => {
                    const checked = multiSubjects.includes(subject.code);
                    return (
                      <TouchableOpacity
                        key={subject.code}
                        style={styles.subjectCheck}
                        onPress={() => toggleMultiSubject(subject.code)}
                      >
                        {checked ? (
                          <CheckSquare size={18} color={COLORS.green} />
                        ) : (
                          <Square size={18} color="#B8C0CC" />
                        )}
                        <ThemedText style={styles.subjectCheckText}>{subject.label}</ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={styles.smallBtnRow}>
                  <TouchableOpacity
                    style={styles.smallBtn}
                    onPress={() => setMultiSubjects(subjects.map((s) => s.code))}
                  >
                    <CheckCheck size={14} color={COLORS.textDark} />
                    <ThemedText style={styles.smallBtnText}>Select all</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.smallBtn} onPress={() => setMultiSubjects([])}>
                    <ClearIcon size={14} color={COLORS.textDark} />
                    <ThemedText style={styles.smallBtnText}>Clear all</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {loadingRoster ? (
              <View style={styles.stateBox}>
                <ActivityIndicator color={COLORS.green} />
                <ThemedText style={styles.emptyText}>Loading students...</ThemedText>
              </View>
            ) : !grade ? (
              <View style={styles.stateBox}>
                <View style={styles.emptyIcon}>
                  <UserX size={26} color={COLORS.green} />
                </View>
                <ThemedText style={styles.emptyText}>Select a grade above to load students</ThemedText>
              </View>
            ) : filteredStudents.length === 0 ? (
              <View style={styles.stateBox}>
                <View style={styles.emptyIcon}>
                  <UserX size={26} color={COLORS.green} />
                </View>
                <ThemedText style={styles.emptyText}>No students found</ThemedText>
              </View>
            ) : visibleCodes.length === 0 ? (
              <View style={styles.stateBox}>
                <ThemedText style={styles.emptyText}>Select at least one subject to enter marks</ThemedText>
              </View>
            ) : (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator style={styles.tableScroll}>
                  <View>
                    {/* Table header */}
                    <View style={styles.tHeadRow}>
                      <TouchableOpacity style={styles.colCheck} onPress={toggleSelectAll}>
                        {students.every((s) => s.selected) ? (
                          <CheckSquare size={16} color={COLORS.green} />
                        ) : (
                          <Square size={16} color="#B8C0CC" />
                        )}
                      </TouchableOpacity>
                      <ThemedText style={[styles.tHeadText, styles.colAdm]}>ADM.</ThemedText>
                      <ThemedText style={[styles.tHeadText, styles.colName]}>STUDENT</ThemedText>
                      {visibleCodes.map((code) => (
                        <ThemedText key={code} style={[styles.tHeadText, styles.colMark]} numberOfLines={1}>
                          {labelFor(code).toUpperCase()}
                        </ThemedText>
                      ))}
                    </View>

                    {/* Rows */}
                    {filteredStudents.map((s) => (
                      <View key={s.id} style={[styles.tRow, !s.selected && styles.tRowDeselected]}>
                        <TouchableOpacity style={styles.colCheck} onPress={() => toggleSelected(s.id)}>
                          {s.selected ? (
                            <CheckSquare size={16} color={COLORS.green} />
                          ) : (
                            <Square size={16} color="#B8C0CC" />
                          )}
                        </TouchableOpacity>
                        <ThemedText style={[styles.tCell, styles.colAdm]} numberOfLines={1}>
                          {s.assesment}
                        </ThemedText>
                        <ThemedText style={[styles.tCell, styles.colName, styles.tCellName]} numberOfLines={1}>
                          {s.firstName} {s.surname}
                        </ThemedText>
                        {visibleCodes.map((code) => (
                          <View key={code} style={styles.colMark}>
                            <TextInput
                              style={styles.markInput}
                              keyboardType="number-pad"
                              maxLength={3}
                              placeholder="—"
                              placeholderTextColor="#B8C0CC"
                              value={s.marks[code] ?? ''}
                              onChangeText={(v) => updateMark(s.id, code, v.replace(/[^0-9]/g, ''))}
                              editable={s.selected}
                            />
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                </ScrollView>

                <View style={styles.submitRow}>
                  <TouchableOpacity style={styles.clearButton} onPress={clearMarks}>
                    <ThemedText style={styles.clearButtonText}>Clear Marks</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.primaryButton, styles.primaryFlex, submitting && styles.buttonDisabled]}
                    onPress={submitManual}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <>
                        <UploadCloud size={16} color="#FFFFFF" />
                        <ThemedText style={styles.primaryButtonText}>Submit Results</ThemedText>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        ) : (
          /* ── Bulk card ── */
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <View style={styles.cardTitleLeft}>
                <ListChecks size={17} color={COLORS.green} />
                <ThemedText style={styles.cardTitle}>Subjects to upload</ThemedText>
              </View>
            </View>

            <ThemedText style={styles.helperText}>
              Choose one subject to grade a single paper, or several to grade multiple subjects from
              the same spreadsheet in one pass. The template downloads as a .csv file — it opens
              perfectly in Excel, Google Sheets, or Numbers, just keep it saved as CSV (not .xlsx)
              when you upload it back.
            </ThemedText>

            {!grade ? (
              <View style={styles.stateBox}>
                <View style={styles.emptyIcon}>
                  <UserX size={26} color={COLORS.green} />
                </View>
                <ThemedText style={styles.emptyText}>Select a grade above to see its subjects</ThemedText>
              </View>
            ) : (
              <>
                <View style={styles.subjectsGrid}>
                  {subjects.map((subject) => {
                    const checked = bulkSelectedSubjects.includes(subject.code);
                    return (
                      <TouchableOpacity
                        key={subject.code}
                        style={styles.subjectCheck}
                        onPress={() => toggleBulkSubject(subject.code)}
                      >
                        {checked ? (
                          <CheckSquare size={18} color={COLORS.green} />
                        ) : (
                          <Square size={18} color="#B8C0CC" />
                        )}
                        <ThemedText style={styles.subjectCheckText}>{subject.label}</ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.smallBtnRow}>
                  <TouchableOpacity
                    style={styles.smallBtn}
                    onPress={() => setBulkSelectedSubjects(subjects.map((s) => s.code))}
                  >
                    <CheckCheck size={14} color={COLORS.textDark} />
                    <ThemedText style={styles.smallBtnText}>Select all</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.smallBtn} onPress={() => setBulkSelectedSubjects([])}>
                    <ClearIcon size={14} color={COLORS.textDark} />
                    <ThemedText style={styles.smallBtnText}>Clear all</ThemedText>
                  </TouchableOpacity>
                </View>

                <View style={styles.divider} />

                <ThemedText style={styles.stepLabel}>STEP 1 — GET THE TEMPLATE</ThemedText>
                <TouchableOpacity style={styles.outlineButton} onPress={openTemplateDownload}>
                  <Download size={16} color={COLORS.textDark} />
                  <ThemedText style={styles.outlineButtonText}>Download Template (CSV)</ThemedText>
                </TouchableOpacity>

                <ThemedText style={[styles.stepLabel, { marginTop: 18 }]}>
                  STEP 2 — UPLOAD THE COMPLETED FILE
                </ThemedText>
                <TouchableOpacity style={styles.dashedUpload} onPress={pickBulkFile}>
                  <FileUp size={16} color={COLORS.green} />
                  <ThemedText style={styles.dashedUploadText} numberOfLines={1}>
                    {bulkFile ? bulkFile.name : 'Choose completed .csv file...'}
                  </ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.primaryButton, { marginTop: 16 }, bulkUploading && styles.buttonDisabled]}
                  onPress={submitBulk}
                  disabled={bulkUploading}
                >
                  {bulkUploading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <UploadCloud size={16} color="#FFFFFF" />
                      <ThemedText style={styles.primaryButtonText}>Upload Marks</ThemedText>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </ScrollView>

      <AppSidebar visible={sidebarOpen} onClose={() => setSidebarOpen(false)} activeRoute="/uploadResults" />
    </ThemedView>
  );
}

const COLORS = {
  gold: '#E8B923',
  green: '#1FB584',
  greenDark: '#17966D',
  greenSoft: '#E3F6EE',
  warning: '#D97706',
  textDark: '#2B3645',
  textMuted: '#6B7686',
  border: '#DDE3EA',
  pageBg: '#F1F4F8',
  fieldBg: '#F3F5F8',
};

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.pageBg },

  // Header (light card style, matching the dashboard header)
  header: {
    backgroundColor: COLORS.pageBg,
    paddingTop: 50,
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  header1: { color: '#1B2431', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  headerAccent: { color: COLORS.green },
  header2: { color: COLORS.textMuted, fontSize: 11, fontStyle: 'italic', marginTop: 2 },
  headerDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#6C5CE7',
  },

  // Toast
  toast: {
    position: 'absolute',
    top: 108,
    left: 14,
    right: 14,
    zIndex: 50,
    elevation: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  toastSuccess: { backgroundColor: COLORS.green },
  toastWarning: { backgroundColor: COLORS.warning },
  toastIcon: { marginTop: 1 },
  toastTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  toastMessage: { color: '#FFFFFF', fontSize: 12.5, marginTop: 3, lineHeight: 18, opacity: 0.95 },
  toastDetail: { color: '#FFFFFF', fontSize: 11.5, marginTop: 3, lineHeight: 16, opacity: 0.9 },

  body: { flex: 1 },
  bodyContent: { padding: 14, paddingBottom: 60 },

  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
  },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    gap: 22,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 18,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 12,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  tabButtonActive: { borderBottomColor: COLORS.green },
  tabText: { fontSize: 14.5, color: COLORS.textDark, fontWeight: '700' },
  tabTextActive: { color: COLORS.green },

  // Plain fields
  fieldLabel: { fontSize: 13.5, fontWeight: '700', color: COLORS.textDark, marginTop: 12, marginBottom: 8 },
  textField: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    height: 48,
    paddingHorizontal: 14,
    fontSize: 15,
    color: COLORS.textDark,
    backgroundColor: '#FFFFFF',
  },
  fieldHint: { fontSize: 12, color: COLORS.textMuted, marginTop: 8 },

  // One / Multiple subjects
  segment: {
    flexDirection: 'row',
    backgroundColor: '#E9EDF2',
    borderRadius: 12,
    padding: 4,
    marginTop: 18,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 11,
    borderRadius: 9,
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  segmentText: { fontSize: 13.5, fontWeight: '700', color: COLORS.textDark },
  segmentTextActive: { color: COLORS.green },

  // Card title row
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 8,
  },
  cardTitleLeft: { flexDirection: 'row', alignItems: 'center', gap: 9, flexShrink: 1 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#1B2431', flexShrink: 1 },
  countPill: { backgroundColor: COLORS.greenSoft, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  countPillText: { color: COLORS.greenDark, fontSize: 12, fontWeight: '700' },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.fieldBg,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 46,
    marginBottom: 14,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.textDark },

  // Multi-subject selector
  multiBox: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 14,
    marginBottom: 14,
  },
  multiTitle: { fontSize: 13.5, fontWeight: '800', color: '#1B2431', marginBottom: 10 },
  subjectsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  subjectCheck: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '50%', paddingVertical: 7 },
  subjectCheckText: { fontSize: 14, color: COLORS.textDark },
  smallBtnRow: { flexDirection: 'row', gap: 10 },
  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  smallBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.textDark },

  // Empty / loading
  stateBox: { paddingVertical: 36, alignItems: 'center', gap: 12 },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { fontSize: 13.5, color: COLORS.textMuted, textAlign: 'center' },

  // Marks table
  tableScroll: { borderTopWidth: 1, borderTopColor: COLORS.border },
  tHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.fieldBg,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.border,
    paddingVertical: 12,
  },
  tHeadText: { fontSize: 11.5, fontWeight: '800', color: '#1B2431', letterSpacing: 0.3 },
  tRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1F5',
  },
  tRowDeselected: { opacity: 0.4 },
  tCell: { fontSize: 12.5, color: COLORS.textMuted },
  tCellName: { color: '#1B2431', fontWeight: '600' },
  colCheck: { width: 38, alignItems: 'center', justifyContent: 'center' },
  colAdm: { width: 64, paddingHorizontal: 4 },
  colName: { width: 140, paddingHorizontal: 4 },
  colMark: { width: 92, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  markInput: {
    width: 62,
    height: 38,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 14,
    color: COLORS.textDark,
    backgroundColor: '#FFFFFF',
  },

  // Buttons
  submitRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  clearButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 18,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButtonText: { fontSize: 14, fontWeight: '700', color: COLORS.textDark },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.green,
    borderRadius: 12,
    height: 48,
  },
  primaryFlex: { flex: 1 },
  primaryButtonText: { fontSize: 14.5, fontWeight: '800', color: '#FFFFFF' },
  buttonDisabled: { opacity: 0.6 },

  // Bulk
  helperText: { fontSize: 13, color: COLORS.textMuted, lineHeight: 19, marginBottom: 14 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 16 },
  stepLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: COLORS.textMuted, marginBottom: 8 },
  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    height: 48,
  },
  outlineButtonText: { fontSize: 14, fontWeight: '700', color: COLORS.textDark },
  dashedUpload: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.green,
    borderRadius: 12,
    height: 52,
    backgroundColor: COLORS.greenSoft,
    paddingHorizontal: 12,
  },
  dashedUploadText: { fontSize: 13, color: COLORS.greenDark, fontWeight: '700', flexShrink: 1 },
});
