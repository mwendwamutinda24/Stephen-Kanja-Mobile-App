import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Animated,
  ActivityIndicator,
  TextInput,
  Platform,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {
  Menu,
  X,
  GraduationCap,
  Home,
  Users,
  LineChart,
  UserPlus,
  PieChart,
  Upload,
  Target,
  Layers,
  Filter,
  Search,
  AlertCircle,
  Pencil,
  FileDown,
  CheckCircle2,
} from 'lucide-react-native';
import ThemedView from '@/components/themed-view';
import ThemedText from '@/components/themed-text';
import { apiRequest, ApiError } from '@/services/api/client';

/* ────────────────────────────────────────────────────────────
   Constants + types
   ──────────────────────────────────────────────────────────── */
const WIDE_BREAKPOINT = 1024; // >= this: permanent sidebar (like the web app)
const SIDEBAR_W = 250;
const DRAWER_W = 280;

const GRADES = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

type NavItem = {
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  route: string;
};
type NavSection = { title: string | null; items: NavItem[] };

const NAV_SECTIONS: NavSection[] = [
  {
    title: null,
    items: [
      { label: 'Home', icon: Home, route: '/' },
      { label: 'Students', icon: Users, route: '/students' },
      { label: 'Progress Records', icon: LineChart, route: '/progress' },
    ],
  },
  {
    title: 'ADMINISTRATION',
    items: [
      { label: 'Register Learners', icon: UserPlus, route: '/registerLearner' },
      { label: 'Register Teachers', icon: UserPlus, route: '/registerTeacher' },
    ],
  },
  {
    title: 'ACADEMICS',
    items: [
      { label: 'Results', icon: PieChart, route: '/results' },
      { label: 'Upload Results', icon: Upload, route: '/uploadResults' },
      { label: 'Track Performance', icon: Target, route: '/track' },
    ],
  },
  {
    title: 'FINANCE',
    items: [{ label: 'Finances', icon: Layers, route: '/trackFees' }],
  },
];

type Learner = {
  /** Needed to save edits — add `id` to the SELECT in students_by_grade.php */
  id?: string | number;
  assessmentNo: string;
  upi: string;
  fullName: string;
  dob: string;
  birthNo: string;
  grade?: string;
};

type StudentsByGradeResponse = {
  success: boolean;
  students: Learner[];
  message?: string;
};

type SaveResponse = { success: boolean; message?: string };

type EditForm = {
  fullName: string;
  assessmentNo: string;
  upi: string;
  dob: string;
  birthNo: string;
  grade: string;
};

/* ────────────────────────────────────────────────────────────
   Learners PDF (native: expo-print + share sheet, web: print dialog)
   ──────────────────────────────────────────────────────────── */
function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildLearnersHtml(grade: string, list: Learner[]): string {
  const rows = list
    .map(
      (l, i) => `
      <tr>
        <td class="c">${i + 1}</td>
        <td>${esc(l.assessmentNo) || '—'}</td>
        <td>${esc(l.upi) || '—'}</td>
        <td class="name">${esc(l.fullName)}</td>
        <td class="c">Grade ${esc(l.grade || grade)}</td>
        <td class="c">${esc(l.dob) || '—'}</td>
        <td class="c">${esc(l.birthNo) || '—'}</td>
      </tr>`
    )
    .join('');

  const generated = new Date().toLocaleString();

  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        @page { size: A4 landscape; margin: 12mm; }
        * { box-sizing: border-box; }
        body { font-family: Helvetica, Arial, sans-serif; color: #0f1923; margin: 0; }
        .head { background: #000; color: #fff; padding: 14px 18px; border-bottom: 4px solid #f0c040; border-radius: 6px 6px 0 0; }
        .school { font-size: 18px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; }
        .school span { color: #f0c040; }
        .sub { font-size: 11px; color: #f0c040; letter-spacing: 1.5px; margin-top: 4px; }
        .meta { display: flex; justify-content: space-between; margin: 12px 2px 10px; font-size: 12px; color: #3d4f5c; }
        .meta strong { color: #0f1923; }
        table { width: 100%; border-collapse: collapse; }
        thead { display: table-header-group; }
        tr { page-break-inside: avoid; }
        th { background: #0f1923; color: #fff; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; padding: 9px 8px; text-align: left; }
        td { border-bottom: 1px solid #e5e3de; padding: 8px; font-size: 12px; }
        tr:nth-child(even) td { background: #faf9f5; }
        .c { text-align: center; }
        th.c { text-align: center; }
        .name { font-weight: 700; }
        .foot { margin-top: 12px; font-size: 10px; color: #7a909e; text-align: right; }
      </style>
    </head>
    <body>
      <div class="head">
        <div class="school">Stephen Kanja <span>School</span></div>
        <div class="sub">GRADE ${esc(grade)} — ENROLLED LEARNERS</div>
      </div>
      <div class="meta">
        <div><strong>Grade ${esc(grade)}</strong> &nbsp;|&nbsp; ${list.length} learner${list.length === 1 ? '' : 's'}</div>
        <div>Generated ${esc(generated)}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th class="c">#</th><th>Assessment No</th><th>UPI No</th><th>Full Name</th>
            <th class="c">Grade</th><th class="c">Date of Birth</th><th class="c">Birth Cert No</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="foot">Stephen Kanja Primary &amp; Junior School</div>
    </body>
  </html>`;
}

/* expo-print's printAsync on web prints the live page, so load the report
   into its own hidden iframe and print that instead. The browser's print
   dialog offers "Save as PDF". */
function printHtmlInIsolatedFrame(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.srcdoc = html;
    document.body.appendChild(iframe);

    const cleanup = () =>
      setTimeout(() => {
        if (iframe.parentNode) document.body.removeChild(iframe);
      }, 1000);

    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        resolve();
      } catch (err) {
        reject(err);
      } finally {
        cleanup();
      }
    };
  });
}

async function exportLearnersPdf(grade: string, list: Learner[]): Promise<void> {
  const html = buildLearnersHtml(grade, list);

  if (Platform.OS === 'web') {
    await printHtmlInIsolatedFrame(html);
    return;
  }

  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Grade ${grade} Learners`,
      UTI: 'com.adobe.pdf',
    });
  } else {
    Alert.alert('PDF ready', 'Sharing is not available on this device.');
  }
}

/* ────────────────────────────────────────────────────────────
   Sidebar (permanent on wide screens, slide-in drawer otherwise)
   ──────────────────────────────────────────────────────────── */
function SidebarNav({
  activeRoute,
  onNavigate,
}: {
  activeRoute: string;
  onNavigate: (route: string) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.navScroll} showsVerticalScrollIndicator={false}>
      {NAV_SECTIONS.map((section, si) => (
        <View key={section.title ?? `s${si}`} style={styles.navSection}>
          {section.title && <ThemedText style={styles.sectionLabel}>{section.title}</ThemedText>}
          {section.items.map((item) => {
            const active = item.route === activeRoute;
            const Icon = item.icon;
            return (
              <TouchableOpacity
                key={item.route}
                style={[styles.navItem, active && styles.navItemActive]}
                onPress={() => onNavigate(item.route)}
              >
                <Icon size={18} color={active ? COLORS.gold : '#E5E5E5'} />
                <ThemedText style={[styles.navItemText, active && styles.navItemTextActive]}>
                  {item.label}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

function Drawer({
  visible,
  onClose,
  activeRoute,
}: {
  visible: boolean;
  onClose: () => void;
  activeRoute: string;
}) {
  const router = useRouter();
  const translateX = React.useRef(new Animated.Value(-DRAWER_W)).current;

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: visible ? 0 : -DRAWER_W,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
        <Animated.View style={[styles.drawer, { width: DRAWER_W, transform: [{ translateX }] }]}>
          <View style={styles.drawerHeader}>
            <ThemedText style={styles.drawerTitle}>Menu</ThemedText>
            <TouchableOpacity style={styles.drawerClose} onPress={onClose}>
              <X size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <SidebarNav
            activeRoute={activeRoute}
            onNavigate={(route) => {
              onClose();
              router.push(route as any);
            }}
          />
        </Animated.View>
      </View>
    </Modal>
  );
}

/* ────────────────────────────────────────────────────────────
   Table layout
   ──────────────────────────────────────────────────────────── */
const COL = { num: 48, assess: 150, upi: 140, grade: 100, dob: 130, birth: 140, action: 110 };
const FIXED_COLS_W = COL.num + COL.assess + COL.upi + COL.grade + COL.dob + COL.birth + COL.action;
const MIN_NAME_W = 240;

const initialsOf = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

/* ────────────────────────────────────────────────────────────
   Page
   ──────────────────────────────────────────────────────────── */
export default function StudentsPage() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [grade, setGrade] = useState('');
  const [viewedGrade, setViewedGrade] = useState<string | null>(null);
  const [learners, setLearners] = useState<Learner[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [tableW, setTableW] = useState(0);

  const [downloading, setDownloading] = useState(false);

  // edit modal
  const [editing, setEditing] = useState<Learner | null>(null);
  const [form, setForm] = useState<EditForm>({
    fullName: '',
    assessmentNo: '',
    upi: '',
    dob: '',
    birthNo: '',
    grade: '',
  });
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // success toast
  const [toast, setToast] = useState<{ title: string; message: string } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = learners.filter((l) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      l.fullName?.toLowerCase().includes(q) ||
      l.assessmentNo?.toLowerCase().includes(q) ||
      l.upi?.toLowerCase().includes(q)
    );
  });

  const handleViewLearners = async () => {
    if (!grade) return;
    setLoading(true);
    setError(null);
    setViewedGrade(grade);
    setSearch('');

    try {
      const data = await apiRequest<StudentsByGradeResponse>(`/students_by_grade.php?grade=${grade}`);
      setLearners(data.students);
    } catch (err) {
      console.error('Error fetching learners:', err);
      setError(err instanceof ApiError ? err.message : 'Could not load learners. Please try again.');
      setLearners([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!viewedGrade || filtered.length === 0) return;
    setDownloading(true);
    try {
      await exportLearnersPdf(viewedGrade, filtered);
    } catch (err: any) {
      Alert.alert('Download failed', err?.message ?? 'Could not create the PDF.');
    } finally {
      setDownloading(false);
    }
  };

  const openEdit = (l: Learner) => {
    setEditing(l);
    setEditError(null);
    setForm({
      fullName: l.fullName ?? '',
      assessmentNo: l.assessmentNo ?? '',
      upi: l.upi ?? '',
      dob: l.dob ?? '',
      birthNo: l.birthNo ?? '',
      grade: String(l.grade ?? viewedGrade ?? ''),
    });
  };

  const closeEdit = () => {
    if (saving) return;
    setEditing(null);
  };

  const saveEdit = async () => {
    if (!editing) return;

    const fullName = form.fullName.trim();
    const dob = form.dob.trim();

    if (!fullName) {
      setEditError('Full name is required.');
      return;
    }
    if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      setEditError('Date of birth must look like 2016-07-30 (YYYY-MM-DD).');
      return;
    }
    if (editing.id === undefined || editing.id === null || editing.id === '') {
      setEditError(
        'This learner has no id from the server. Add "id" to the students_by_grade.php response.'
      );
      return;
    }

    setSaving(true);
    setEditError(null);
    try {
      await apiRequest<SaveResponse>('/update_student.php', {
        method: 'POST',
        body: {
          id: editing.id,
          fullName,
          assessmentNo: form.assessmentNo.trim(),
          upi: form.upi.trim(),
          dob,
          birthNo: form.birthNo.trim(),
          grade: form.grade,
        },
      });

      const updated: Learner = {
        ...editing,
        fullName,
        assessmentNo: form.assessmentNo.trim(),
        upi: form.upi.trim(),
        dob,
        birthNo: form.birthNo.trim(),
        grade: form.grade,
      };

      const movedGrade = viewedGrade !== null && form.grade !== viewedGrade;
      setLearners((prev) =>
        movedGrade
          ? prev.filter((l) => l.id !== editing.id)
          : prev.map((l) => (l.id === editing.id ? updated : l))
      );

      setEditing(null);
      setToast({
        title: 'Learner updated successfully',
        message: movedGrade
          ? `${fullName} was saved and moved to Grade ${form.grade}.`
          : `${fullName}'s details were saved.`,
      });
    } catch (err) {
      setEditError(
        err instanceof ApiError ? err.message : 'Could not save changes. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  /* ── table sizing ── */
  const nameW = Math.max(MIN_NAME_W, tableW - FIXED_COLS_W);
  const tableInnerW = FIXED_COLS_W + nameW;

  return (
    <ThemedView style={styles.page}>
      {/* Top brand bar */}
      <View style={styles.topBar}>
        <View style={styles.topLeft}>
          {!isWide && (
            <TouchableOpacity style={styles.menuButton} onPress={() => setDrawerOpen(true)}>
              <Menu size={20} color="#141414" />
            </TouchableOpacity>
          )}
          <View style={styles.logoBadge}>
            <GraduationCap size={20} color="#111111" />
          </View>
          <View>
            <ThemedText style={styles.brandTitle}>
              STEPHEN KANJA <ThemedText style={styles.brandAccent}>SCHOOL</ThemedText>
            </ThemedText>
            <ThemedText style={styles.brandTag}>AIM HIGHER</ThemedText>
          </View>
        </View>
        <View style={styles.topRight}>
          <View style={styles.portalDot} />
          <ThemedText style={styles.portalText}>Student Portal</ThemedText>
        </View>
      </View>

      {/* Success toast */}
      {toast && (
        <View style={styles.toast}>
          <CheckCircle2 size={22} color="#FFFFFF" />
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.toastTitle}>{toast.title}</ThemedText>
            <ThemedText style={styles.toastMessage}>{toast.message}</ThemedText>
          </View>
          <TouchableOpacity onPress={() => setToast(null)} hitSlop={10}>
            <X size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.shell}>
        {isWide && (
          <View style={styles.sideFixed}>
            <SidebarNav activeRoute="/students" onNavigate={(r) => router.push(r as any)} />
          </View>
        )}

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {/* Title row */}
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.eyebrow}>ENROLLMENT PORTAL</ThemedText>
              <ThemedText style={styles.pageTitle}>Student Learners</ThemedText>
            </View>
            <TouchableOpacity
              style={styles.registerButton}
              onPress={() => router.push('/registerLearner' as any)}
            >
              <UserPlus size={16} color="#8A6A00" />
              <ThemedText style={styles.registerButtonText}>Register New Learner</ThemedText>
            </TouchableOpacity>
          </View>

          {/* Filter card */}
          <View style={styles.card}>
            <ThemedText style={styles.fieldLabel}>Filter by Grade</ThemedText>
            <View style={[styles.filterRow, !isWide && styles.filterRowStack]}>
              <View style={styles.pickerWrapper}>
                <Picker style={styles.picker} selectedValue={grade} onValueChange={setGrade}>
                  <Picker.Item label="— Select a grade —" value="" />
                  {GRADES.map((g) => (
                    <Picker.Item key={g} label={`Grade ${g}`} value={g} />
                  ))}
                </Picker>
              </View>
              <TouchableOpacity
                style={[styles.viewButton, !grade && styles.buttonDisabled]}
                onPress={handleViewLearners}
                disabled={!grade || loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#111111" />
                ) : (
                  <Search size={16} color="#111111" />
                )}
                <ThemedText style={styles.viewButtonText}>
                  {loading ? 'Loading…' : 'View Learners'}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>

          {/* Results */}
          {loading ? (
            <View style={[styles.card, styles.emptyCard]}>
              <ActivityIndicator size="large" color={COLORS.goldDark} />
              <ThemedText style={styles.emptySubtitle}>Loading learners…</ThemedText>
            </View>
          ) : error ? (
            <View style={[styles.card, styles.emptyCard]}>
              <AlertCircle size={40} color="#E2645A" />
              <ThemedText style={styles.emptyTitle}>Couldn't load learners</ThemedText>
              <ThemedText style={styles.emptySubtitle}>{error}</ThemedText>
            </View>
          ) : viewedGrade && learners.length === 0 ? (
            <View style={[styles.card, styles.emptyCard]}>
              <Filter size={40} color="#C9C9C9" />
              <ThemedText style={styles.emptyTitle}>No learners in Grade {viewedGrade}</ThemedText>
              <ThemedText style={styles.emptySubtitle}>
                Try a different grade or register a new learner.
              </ThemedText>
            </View>
          ) : viewedGrade ? (
            <>
              {/* Heading + download */}
              <View style={styles.resultsHeadRow}>
                <View style={styles.resultsHeadLeft}>
                  <ThemedText style={styles.resultsTitle}>Grade {viewedGrade} Learners</ThemedText>
                  <View style={styles.countPill}>
                    <ThemedText style={styles.countPillText}>{learners.length} students</ThemedText>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.downloadButton, (downloading || filtered.length === 0) && styles.buttonDisabled]}
                  onPress={handleDownload}
                  disabled={downloading || filtered.length === 0}
                >
                  {downloading ? (
                    <ActivityIndicator size="small" color="#111111" />
                  ) : (
                    <FileDown size={16} color="#111111" />
                  )}
                  <ThemedText style={styles.downloadButtonText}>Download Learners List</ThemedText>
                </TouchableOpacity>
              </View>

              {/* Table card */}
              <View
                style={[styles.card, styles.tableCard]}
                onLayout={(e) => setTableW(e.nativeEvent.layout.width)}
              >
                <View style={styles.searchBox}>
                  <Search size={16} color="#8A8A8A" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search by name, assessment no, or UPI…"
                    placeholderTextColor="#8A8A8A"
                    value={search}
                    onChangeText={setSearch}
                  />
                </View>

                <View style={styles.banner}>
                  <ThemedText style={styles.bannerText}>
                    GRADE {viewedGrade} — ENROLLED LEARNERS
                  </ThemedText>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator>
                  <View style={{ width: tableInnerW }}>
                    {/* Column headers */}
                    <View style={styles.tHead}>
                      <ThemedText style={[styles.th, { width: COL.num, textAlign: 'center' }]}>#</ThemedText>
                      <ThemedText style={[styles.th, { width: COL.assess }]}>ASSESSMENT NO</ThemedText>
                      <ThemedText style={[styles.th, { width: COL.upi }]}>UPI NO</ThemedText>
                      <ThemedText style={[styles.th, { width: nameW }]}>FULL NAME</ThemedText>
                      <ThemedText style={[styles.th, { width: COL.grade }]}>GRADE</ThemedText>
                      <ThemedText style={[styles.th, { width: COL.dob }]}>DATE OF BIRTH</ThemedText>
                      <ThemedText style={[styles.th, { width: COL.birth }]}>BIRTH CERT NO</ThemedText>
                      <ThemedText style={[styles.th, { width: COL.action, textAlign: 'right' }]}>ACTION</ThemedText>
                    </View>

                    {filtered.length === 0 ? (
                      <View style={styles.noMatch}>
                        <ThemedText style={styles.emptySubtitle}>No learners match your search.</ThemedText>
                      </View>
                    ) : (
                      filtered.map((l, i) => (
                        <View key={String(l.id ?? l.upi ?? l.assessmentNo ?? i)} style={styles.tRow}>
                          <ThemedText style={[styles.td, styles.tdMuted, { width: COL.num, textAlign: 'center' }]}>
                            {i + 1}
                          </ThemedText>
                          <ThemedText style={[styles.td, { width: COL.assess }]} numberOfLines={1}>
                            {l.assessmentNo || ''}
                          </ThemedText>
                          <ThemedText style={[styles.td, { width: COL.upi }]} numberOfLines={1}>
                            {l.upi || ''}
                          </ThemedText>
                          <View style={[styles.nameCell, { width: nameW }]}>
                            <View style={styles.avatar}>
                              <ThemedText style={styles.avatarText}>{initialsOf(l.fullName)}</ThemedText>
                            </View>
                            <ThemedText style={styles.nameText} numberOfLines={1}>
                              {l.fullName}
                            </ThemedText>
                          </View>
                          <View style={{ width: COL.grade }}>
                            <View style={styles.gradePill}>
                              <ThemedText style={styles.gradePillText}>Grade {l.grade || viewedGrade}</ThemedText>
                            </View>
                          </View>
                          <ThemedText style={[styles.td, { width: COL.dob }]}>{l.dob || '—'}</ThemedText>
                          <ThemedText style={[styles.td, styles.tdMuted, { width: COL.birth }]}>
                            {l.birthNo || '—'}
                          </ThemedText>
                          <View style={[styles.actionCell, { width: COL.action }]}>
                            <TouchableOpacity style={styles.editButton} onPress={() => openEdit(l)}>
                              <Pencil size={13} color="#141414" />
                              <ThemedText style={styles.editButtonText}>Edit</ThemedText>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                </ScrollView>
              </View>
            </>
          ) : (
            <View style={[styles.card, styles.emptyCard]}>
              <Filter size={40} color="#C9C9C9" />
              <ThemedText style={styles.emptyTitle}>Select a grade above to view learners</ThemedText>
              <ThemedText style={styles.emptySubtitle}>
                Choose a grade from the dropdown and tap "View Learners".
              </ThemedText>
            </View>
          )}
        </ScrollView>
      </View>

      {!isWide && (
        <Drawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} activeRoute="/students" />
      )}

      {/* Edit learner modal */}
      <Modal visible={!!editing} transparent animationType="fade" onRequestClose={closeEdit}>
        <View style={styles.editOverlay}>
          <View style={styles.editCard}>
            <View style={styles.editHeader}>
              <ThemedText style={styles.editTitle}>Edit Learner</ThemedText>
              <TouchableOpacity onPress={closeEdit} hitSlop={10}>
                <X size={20} color="#141414" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 480 }} keyboardShouldPersistTaps="handled">
              <ThemedText style={styles.inputLabel}>Full name</ThemedText>
              <TextInput
                style={styles.input}
                value={form.fullName}
                onChangeText={(v) => setForm((f) => ({ ...f, fullName: v }))}
                placeholder="e.g. Abdul Charo"
                placeholderTextColor="#B0B0B0"
              />

              <ThemedText style={styles.inputLabel}>Assessment No</ThemedText>
              <TextInput
                style={styles.input}
                value={form.assessmentNo}
                onChangeText={(v) => setForm((f) => ({ ...f, assessmentNo: v }))}
                placeholderTextColor="#B0B0B0"
              />

              <ThemedText style={styles.inputLabel}>UPI No</ThemedText>
              <TextInput
                style={styles.input}
                value={form.upi}
                onChangeText={(v) => setForm((f) => ({ ...f, upi: v }))}
                placeholderTextColor="#B0B0B0"
              />

              <ThemedText style={styles.inputLabel}>Grade</ThemedText>
              <View style={styles.editPickerWrap}>
                <Picker
                  style={styles.picker}
                  selectedValue={form.grade}
                  onValueChange={(v) => setForm((f) => ({ ...f, grade: String(v) }))}
                >
                  {GRADES.map((g) => (
                    <Picker.Item key={g} label={`Grade ${g}`} value={g} />
                  ))}
                </Picker>
              </View>

              <ThemedText style={styles.inputLabel}>Date of birth (YYYY-MM-DD)</ThemedText>
              <TextInput
                style={styles.input}
                value={form.dob}
                onChangeText={(v) => setForm((f) => ({ ...f, dob: v }))}
                placeholder="2016-07-30"
                placeholderTextColor="#B0B0B0"
                autoCapitalize="none"
              />

              <ThemedText style={styles.inputLabel}>Birth certificate No</ThemedText>
              <TextInput
                style={styles.input}
                value={form.birthNo}
                onChangeText={(v) => setForm((f) => ({ ...f, birthNo: v }))}
                placeholderTextColor="#B0B0B0"
              />

              {editError && (
                <View style={styles.editErrorBox}>
                  <AlertCircle size={16} color="#B42318" />
                  <ThemedText style={styles.editErrorText}>{editError}</ThemedText>
                </View>
              )}
            </ScrollView>

            <View style={styles.editActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={closeEdit} disabled={saving}>
                <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, saving && styles.buttonDisabled]}
                onPress={saveEdit}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#111111" />
                ) : (
                  <ThemedText style={styles.saveButtonText}>Save Changes</ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

/* ────────────────────────────────────────────────────────────
   Styles
   ──────────────────────────────────────────────────────────── */
const COLORS = {
  gold: '#F0C040',
  goldDark: '#C8992A',
  goldText: '#8A6A00',
  cream: '#FBF1CC',
  pageBg: '#FAF9F5',
  ink: '#141414',
  border: '#E8E6DF',
  muted: '#8A8A8A',
  green: '#1FB584',
};

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.pageBg },

  // Top brand bar
  topBar: {
    backgroundColor: '#FFFFFF',
    paddingTop: 44,
    paddingBottom: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 3,
    borderBottomColor: COLORS.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F3F1EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: { color: COLORS.ink, fontSize: 17, fontWeight: '800', letterSpacing: 2 },
  brandAccent: { color: COLORS.goldDark },
  brandTag: { color: COLORS.muted, fontSize: 10, letterSpacing: 1.5, marginTop: 2 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  portalDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.goldDark,
    borderWidth: 2,
    borderColor: '#F3E3A6',
  },
  portalText: { color: COLORS.muted, fontSize: 12, letterSpacing: 0.5 },

  // Toast
  toast: {
    position: 'absolute',
    top: 100,
    left: 16,
    right: 16,
    zIndex: 50,
    elevation: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: COLORS.green,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  toastTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  toastMessage: { color: '#FFFFFF', fontSize: 12.5, marginTop: 2, opacity: 0.95 },

  // Shell
  shell: { flex: 1, flexDirection: 'row' },
  sideFixed: { width: SIDEBAR_W, backgroundColor: '#000000', paddingTop: 8 },
  body: { flex: 1 },
  bodyContent: { padding: 24, paddingBottom: 60 },

  // Sidebar nav
  navScroll: { paddingHorizontal: 12, paddingBottom: 30 },
  navSection: { marginTop: 4 },
  sectionLabel: {
    color: '#8B8B8B',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: 18,
    marginBottom: 8,
    marginLeft: 12,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 2,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  navItemActive: { backgroundColor: '#1A1A1A', borderLeftColor: COLORS.gold },
  navItemText: { color: '#E5E5E5', fontSize: 14.5 },
  navItemTextActive: { color: COLORS.gold, fontWeight: '700' },

  // Drawer
  modalRoot: { flex: 1, flexDirection: 'row' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  drawer: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#000000', paddingTop: 50 },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  drawerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  drawerClose: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Title row
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginBottom: 18, flexWrap: 'wrap' },
  eyebrow: { color: COLORS.goldDark, fontSize: 12, fontWeight: '700', letterSpacing: 1.2, marginBottom: 4 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: COLORS.ink },
  registerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: COLORS.gold,
  },
  registerButtonText: { color: COLORS.goldText, fontWeight: '700', fontSize: 14 },

  // Cards
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    marginBottom: 18,
  },
  fieldLabel: { fontSize: 13, color: '#5A5A5A', marginBottom: 8 },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  filterRowStack: { flexDirection: 'column', alignItems: 'stretch' },
  pickerWrapper: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: '#F7F6F2',
    overflow: 'hidden',
  },
  picker: { height: 46, width: '100%', color: COLORS.ink, backgroundColor: 'transparent' },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.gold,
    height: 46,
    paddingHorizontal: 22,
    borderRadius: 10,
  },
  viewButtonText: { color: '#111111', fontWeight: '700', fontSize: 14.5 },
  buttonDisabled: { opacity: 0.5 },

  // Empty
  emptyCard: { alignItems: 'center', paddingVertical: 50 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: '#333', marginTop: 14, textAlign: 'center' },
  emptySubtitle: { fontSize: 13, color: COLORS.muted, marginTop: 6, textAlign: 'center' },

  // Results heading
  resultsHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 14,
  },
  resultsHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  resultsTitle: { fontSize: 17, fontWeight: '700', color: COLORS.ink },
  countPill: {
    backgroundColor: COLORS.cream,
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  countPillText: { color: COLORS.goldText, fontSize: 12, fontWeight: '700' },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.gold,
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 10,
    shadowColor: COLORS.gold,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  downloadButtonText: { color: '#111111', fontWeight: '700', fontSize: 14 },

  // Table
  tableCard: { padding: 0, overflow: 'hidden' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 44,
    margin: 16,
    backgroundColor: '#FFFFFF',
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.ink },
  banner: {
    backgroundColor: COLORS.cream,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.gold,
    paddingVertical: 18,
    alignItems: 'center',
  },
  bannerText: { color: '#5A4500', fontSize: 15, fontWeight: '800', letterSpacing: 1.5 },
  tHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: '#FFFFFF',
  },
  th: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, color: '#7A7A7A', paddingHorizontal: 8 },
  tRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1EFE9',
  },
  td: { fontSize: 14, color: COLORS.ink, paddingHorizontal: 8 },
  tdMuted: { color: COLORS.muted },
  nameCell: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.cream,
    borderWidth: 1,
    borderColor: '#EAD98C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: COLORS.goldText, fontSize: 11.5, fontWeight: '800' },
  nameText: { fontSize: 14.5, color: COLORS.ink, flexShrink: 1 },
  gradePill: {
    alignSelf: 'flex-start',
    marginLeft: 8,
    backgroundColor: '#F1F0EC',
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  gradePillText: { fontSize: 11.5, color: '#666', fontWeight: '600' },
  actionCell: { alignItems: 'flex-end', paddingRight: 8 },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
  },
  editButtonText: { fontSize: 13, fontWeight: '700', color: COLORS.ink },
  noMatch: { paddingVertical: 36, alignItems: 'center' },

  // Edit modal
  editOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  editCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    borderTopWidth: 4,
    borderTopColor: COLORS.gold,
  },
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  editTitle: { fontSize: 19, fontWeight: '800', color: COLORS.ink },
  inputLabel: { fontSize: 12.5, fontWeight: '700', color: '#5A5A5A', marginTop: 14, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    height: 46,
    paddingHorizontal: 14,
    fontSize: 15,
    color: COLORS.ink,
    backgroundColor: '#FCFBF8',
  },
  editPickerWrap: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: '#FCFBF8',
    overflow: 'hidden',
  },
  editErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#FEF3F2',
    borderWidth: 1,
    borderColor: '#FECDCA',
  },
  editErrorText: { flex: 1, color: '#B42318', fontSize: 13 },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelButton: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: { fontSize: 14.5, fontWeight: '700', color: COLORS.ink },
  saveButton: {
    flex: 2,
    height: 48,
    borderRadius: 10,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: { fontSize: 14.5, fontWeight: '800', color: '#111111' },
});