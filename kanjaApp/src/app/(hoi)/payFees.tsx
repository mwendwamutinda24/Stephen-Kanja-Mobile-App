import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
} from "react-native";
import {
  Menu,
  GraduationCap,
  Wallet,
  Coins,
  Save,
  Receipt,
  CheckCircle2,
} from "lucide-react-native";
import ThemedView from "@/components/themed-view";
import ThemedText from "@/components/themed-text";
import AppSidebar from "@/components/app-sidebar";
import SelectField from "@/components/select-field";
import { ENDPOINTS } from "@/api-config";

// ---------------------------------------------------------------------------
// Types matching the PHP API contract
// ---------------------------------------------------------------------------
type StudentFeeRow = {
  id: number;
  assessmentNo: string;
  firstName: string;
  lastName: string;
  expectedAmount: number;   // what the school billed for this term
  paidAmount: number;       // what's already been paid (before this entry)
  schoolFee: string;        // teacher's input — string for partial numeric typing
};

type ApiStudent = {
  id: number;
  assessmentNo: string;
  firstName: string;
  lastName: string;
  expected_amount: number;
  paid_amount: number;
};

type SaveReceipt = {
  student_id: number;
  receipt_no: string;
  total: number;
};

// ---------------------------------------------------------------------------
// Real API calls
// ---------------------------------------------------------------------------
async function fetchStudentsForGrade(
  grade: string,
  term: string,
  year: string
): Promise<StudentFeeRow[]> {
  const gradeNum = grade.replace(/\D/g, "");
  const termNum  = term.replace(/\D/g, "");

  const url = `${ENDPOINTS.fetchStudents}?grade=${gradeNum}&term=${termNum}&year=${year}&format=json`;

  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Server error (${res.status}). Please try again.`);
  }

  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || "Failed to load students.");
  }

  return (data.students as ApiStudent[]).map((s) => ({
    id: s.id,
    assessmentNo: s.assessmentNo,
    firstName: s.firstName,
    lastName: s.lastName,
    expectedAmount: Number(s.expected_amount) || 0,
    paidAmount: Number(s.paid_amount) || 0,
    schoolFee: "",
  }));
}

async function submitFeePayments(
  rows: StudentFeeRow[],
  grade: string,
  term: string,
  year: string
): Promise<{ success: boolean; saved?: number; receipts?: SaveReceipt[]; error?: string }> {
  // Build the nested payload: { school_fee: { [studentId]: amount } }
  const school_fee: Record<string, number> = {};
  rows.forEach((r) => {
    const v = parseFloat(r.schoolFee);
    if (!isNaN(v) && v > 0) school_fee[String(r.id)] = v;
  });

  if (Object.keys(school_fee).length === 0) {
    return { success: false, error: "Enter at least one fee amount before saving." };
  }

  const payload = {
    grade: grade.replace(/\D/g, ""),
    term: term.replace(/\D/g, ""),
    year,
    school_fee,
  };

  const res = await fetch(ENDPOINTS.savePayments, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  // Try to surface the server's own error message (the PHP returns JSON on errors too)
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON body */
  }

  if (!res.ok) {
    return {
      success: false,
      error: data?.error || `Server error (${res.status}).`,
    };
  }
  return data ?? { success: false, error: "Empty response from server." };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const GRADES = [
  "Grade 1","Grade 2","Grade 3","Grade 4","Grade 5",
  "Grade 6","Grade 7","Grade 8","Grade 9",
];
const TERMS  = ["Term 1", "Term 2", "Term 3"];
const YEARS  = ["2024", "2025", "2026", "2027"];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function FeePayment() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [grade, setGrade] = useState<string | null>(null);
  const [term, setTerm]   = useState<string | null>(null);
  const [year, setYear]   = useState<string | null>(null);

  const [rows, setRows]                       = useState<StudentFeeRow[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [submitting, setSubmitting]           = useState(false);
  const [refreshing, setRefreshing]           = useState(false);
  const [lastReceipt, setLastReceipt]         = useState<SaveReceipt | null>(null);

  // ── Success banner ─────────────────────────────────────────
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    if (successTimer.current) clearTimeout(successTimer.current);
    successTimer.current = setTimeout(() => setSuccessMsg(null), 6000);
  };

  useEffect(() => {
    return () => {
      if (successTimer.current) clearTimeout(successTimer.current);
    };
  }, []);

  // ── Derived totals ─────────────────────────────────────────
  const totalFeesEntered = rows.reduce(
    (sum, r) => sum + (parseFloat(r.schoolFee) || 0),
    0
  );
  const totalOutstanding = rows.reduce((sum, r) => {
    const entered = parseFloat(r.schoolFee) || 0;
    const balance = r.expectedAmount - (r.paidAmount + entered);
    return sum + (balance > 0 ? balance : 0);
  }, 0);
  const readyToLoad = !!grade && !!term && !!year;

  // ── Load students ──────────────────────────────────────────
  const loadStudents = useCallback(
    async (isRefresh = false) => {
      if (!grade || !term || !year) return;

      isRefresh ? setRefreshing(true) : setLoadingStudents(true);
      try {
        const data = await fetchStudentsForGrade(grade, term, year);
        setRows(data);
        if (data.length === 0) {
          Alert.alert("No students", `No students found for ${grade}, ${term} ${year}.`);
        }
      } catch (err: any) {
        Alert.alert("Load failed", err.message || "Could not fetch students.");
        setRows([]);
      } finally {
        isRefresh ? setRefreshing(false) : setLoadingStudents(false);
      }
    },
    [grade, term, year]
  );

  const handlePayFees = () => {
    if (!readyToLoad) {
      Alert.alert("Missing filters", "Please select grade, term and year.");
      return;
    }
    setSuccessMsg(null);
    loadStudents(false);
  };

  // ── Update one row's fee input ─────────────────────────────
  const updateFee = (id: number, value: string) => {
    // Allow only digits and a single decimal point
    const cleaned = value.replace(/[^0-9.]/g, "");
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, schoolFee: cleaned } : r))
    );
  };

  // ── Submit payments ────────────────────────────────────────
  const handleSubmitPayments = async () => {
    if (!grade || !term || !year) return;
    setSubmitting(true);
    setSuccessMsg(null);
    try {
      const result = await submitFeePayments(rows, grade, term, year);
      if (!result.success) {
        Alert.alert("Save failed", result.error || "Could not save payments.");
        return;
      }

      const saved = result.saved ?? 0;
      const receipts = result.receipts ?? [];
      const last = receipts[receipts.length - 1] || null;
      setLastReceipt(last);

      showSuccess(
        `${saved} payment${saved === 1 ? "" : "s"} recorded successfully.` +
          (last ? `\nReceipt: ${last.receipt_no}` : "")
      );

      // Reload so balances reflect what was just saved
      await loadStudents(false);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Unexpected error while saving.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Open receipt in browser (printable / PDF download) ─────
  const openLatestReceiptPdf = async () => {
    if (!lastReceipt) return;
    const url = `${ENDPOINTS.receipt}?receipt_no=${encodeURIComponent(lastReceipt.receipt_no)}&format=pdf`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Cannot open link", url);
    }
  };

  // ── Render ─────────────────────────────────────────────────
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
          <View>
            <ThemedText style={styles.header1}>
              Stephen Kanja <ThemedText style={styles.headerAccent}>School</ThemedText>
            </ThemedText>
            <ThemedText style={styles.header2}>AIM HIGHER</ThemedText>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadStudents(true)}
            enabled={readyToLoad}
            tintColor="#E8B923"
          />
        }
      >
        <ThemedText style={styles.eyebrow}>FINANCE MODULE</ThemedText>
        <ThemedText style={styles.pageTitle}>Fee Payment</ThemedText>
        <ThemedText style={styles.pageSubtitle}>
          Select a grade to load students, then enter fee amounts and save.
        </ThemedText>

        {/* Stat cards */}
        <View style={[styles.statCard, { borderTopColor: "#141414" }]}>
          <ThemedText style={styles.statLabel}>STUDENTS LOADED</ThemedText>
          <ThemedText style={styles.statValue}>{rows.length > 0 ? rows.length : "—"}</ThemedText>
          <ThemedText style={styles.statCaption}>in selected grade</ThemedText>
        </View>

        <View style={[styles.statCard, { borderTopColor: "#E8B923" }]}>
          <ThemedText style={styles.statLabel}>TOTAL FEES ENTERED</ThemedText>
          <ThemedText style={styles.statValue}>
            KES {totalFeesEntered.toLocaleString()}
          </ThemedText>
          <ThemedText style={styles.statCaption}>across all students</ThemedText>
        </View>

        <View style={[styles.statCard, { borderTopColor: "#2e7d32" }]}>
          <ThemedText style={styles.statLabel}>SELECTED TERM</ThemedText>
          <ThemedText style={styles.statValue}>{term ?? "—"}</ThemedText>
          <ThemedText style={styles.statCaption}>academic term</ThemedText>
        </View>

        <View style={[styles.statCard, { borderTopColor: "#dc2626" }]}>
          <ThemedText style={styles.statLabel}>OUTSTANDING BALANCE</ThemedText>
          <ThemedText style={[styles.statValue, { color: "#dc2626" }]}>
            KES {totalOutstanding.toLocaleString()}
          </ThemedText>
          <ThemedText style={styles.statCaption}>still owed by students shown</ThemedText>
        </View>

        {/* Filter Options */}
        <View style={styles.sectionBar}>
          <Coins size={16} color="#E8B923" />
          <ThemedText style={styles.sectionBarText}>FILTER OPTIONS</ThemedText>
        </View>
        <View style={[styles.card, styles.cardTopFlush]}>
          <SelectField label="GRADE" placeholder="— Select Grade —" value={grade} options={GRADES} onChange={setGrade} />
          <SelectField label="TERM"  placeholder="— Select Term —"  value={term}  options={TERMS}  onChange={setTerm} />
          <SelectField label="YEAR"  placeholder="— Select Year —"  value={year}  options={YEARS}  onChange={setYear} />

          <TouchableOpacity
            style={[styles.payButton, !readyToLoad && styles.payButtonDisabled]}
            onPress={handlePayFees}
            disabled={!readyToLoad || loadingStudents}
          >
            {loadingStudents ? (
              <ActivityIndicator size="small" color="#111111" />
            ) : (
              <>
                <Wallet size={16} color="#111111" />
                <ThemedText style={styles.payButtonText}>Load Learners</ThemedText>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Fee Entries */}
        <View style={styles.sectionBar}>
          <View style={styles.sectionBarLeft}>
            <Coins size={16} color="#E8B923" />
            <ThemedText style={styles.sectionBarText}>FEE ENTRIES</ThemedText>
          </View>
          <View style={styles.countPill}>
            <ThemedText style={styles.countPillText}>{rows.length} students</ThemedText>
          </View>
        </View>

        <View style={[styles.card, styles.cardTopFlush, styles.tableCard]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              <View style={styles.tableColumnRow}>
                <ThemedText style={[styles.colLabel, styles.colAssessment]}>ASSESSMENT NO</ThemedText>
                <ThemedText style={[styles.colLabel, styles.colName]}>FIRST NAME</ThemedText>
                <ThemedText style={[styles.colLabel, styles.colName]}>LAST NAME</ThemedText>
                <ThemedText style={[styles.colLabel, styles.colExpected]}>EXPECTED</ThemedText>
                <ThemedText style={[styles.colLabel, styles.colPaid]}>PAID</ThemedText>
                <ThemedText style={[styles.colLabel, styles.colFee]}>SCHOOL FEE (KES)</ThemedText>
                <ThemedText style={[styles.colLabel, styles.colBalance]}>BALANCE</ThemedText>
              </View>

              {rows.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <ThemedText style={styles.emptyText}>
                    {grade ? "No students found for this grade." : "Select a grade to load students."}
                  </ThemedText>
                </View>
              ) : (
                rows.map((row) => {
                  const entered = parseFloat(row.schoolFee) || 0;
                  const balance = row.expectedAmount - (row.paidAmount + entered);
                  const balanceColor =
                    balance > 0.004 ? "#dc2626" : "#2e7d32";
                  const balanceLabel =
                    balance > 0.004
                      ? `KES ${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                      : balance < -0.004
                      ? "Overpaid"
                      : "Cleared";

                  return (
                    <View key={row.id} style={styles.tableRow}>
                      <ThemedText style={[styles.cellText, styles.colAssessment]}>
                        {row.assessmentNo}
                      </ThemedText>
                      <ThemedText style={[styles.cellText, styles.colName]}>{row.firstName}</ThemedText>
                      <ThemedText style={[styles.cellText, styles.colName]}>{row.lastName}</ThemedText>
                      <ThemedText style={[styles.cellMuted, styles.colExpected]}>
                        {row.expectedAmount > 0 ? `KES ${row.expectedAmount.toLocaleString()}` : "—"}
                      </ThemedText>
                      <ThemedText style={[styles.cellMuted, styles.colPaid]}>
                        {row.paidAmount > 0 ? `KES ${row.paidAmount.toLocaleString()}` : "—"}
                      </ThemedText>
                      <TextInput
                        style={[styles.feeInput, styles.colFee]}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        placeholderTextColor="#9a9a9a"
                        value={row.schoolFee}
                        onChangeText={(v) => updateFee(row.id, v)}
                      />
                      <ThemedText style={[styles.cellBalance, styles.colBalance, { color: balanceColor }]}>
                        {row.expectedAmount > 0 ? balanceLabel : "Not set"}
                      </ThemedText>
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>

          {rows.length > 0 && (
            <>
              {/* Green success banner (tap to dismiss, auto-hides after 6s) */}
              {successMsg && (
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.successBanner}
                  onPress={() => setSuccessMsg(null)}
                >
                  <CheckCircle2 size={22} color="#166534" />
                  <ThemedText style={styles.successBannerText}>{successMsg}</ThemedText>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.payButtonDisabled]}
                onPress={handleSubmitPayments}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#111111" />
                ) : (
                  <>
                    <Save size={16} color="#111111" />
                    <ThemedText style={styles.submitButtonText}>
                      Submit Fee Entries
                    </ThemedText>
                  </>
                )}
              </TouchableOpacity>

              {lastReceipt && (
                <TouchableOpacity style={styles.receiptButton} onPress={openLatestReceiptPdf}>
                  <Receipt size={16} color="#141414" />
                  <ThemedText style={styles.receiptButtonText}>
                    Download Last Receipt ({lastReceipt.receipt_no})
                  </ThemedText>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </ScrollView>

      <AppSidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeRoute="/fee-payment"
      />
    </ThemedView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
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
    alignItems: "center", justifyContent: "center", marginRight: 4,
  },
  logoBadge: {
    width: 36, height: 36, borderRadius: 8, backgroundColor: COLORS.gold,
    alignItems: "center", justifyContent: "center", marginRight: 4,
  },
  header1: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  headerAccent: { color: COLORS.gold },
  header2: { color: "#8A8A8A", fontSize: 10, letterSpacing: 1, marginTop: 2 },
  body: { flex: 1 },
  bodyContent: { padding: 20, paddingBottom: 60 },
  eyebrow: { color: COLORS.gold, fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: 4 },
  pageTitle: { fontSize: 24, fontWeight: "800", color: "#141414", marginBottom: 6 },
  pageSubtitle: { fontSize: 13, color: "#666", marginBottom: 20 },
  statCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderTopWidth: 3,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  statLabel: { fontSize: 11, fontWeight: "700", color: "#8A8A8A", letterSpacing: 0.5, marginBottom: 8 },
  statValue: { fontSize: 24, fontWeight: "800", color: "#141414", marginBottom: 4 },
  statCaption: { fontSize: 12, color: "#9a9a9a" },
  sectionBar: {
    backgroundColor: COLORS.dark,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 2,
    borderBottomColor: COLORS.gold,
    marginTop: 8,
  },
  sectionBarLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionBarText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700", letterSpacing: 0.5, marginLeft: 10 },
  countPill: { backgroundColor: COLORS.gold, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  countPillText: { color: "#111111", fontSize: 12, fontWeight: "700" },
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    padding: 18,
    marginBottom: 22,
  },
  cardTopFlush: { borderTopWidth: 0 },
  payButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.gold,
    height: 48,
    borderRadius: 10,
    marginTop: 4,
  },
  payButtonDisabled: { opacity: 0.5 },
  payButtonText: { color: "#111111", fontWeight: "700", fontSize: 14 },
  tableCard: { padding: 0, paddingTop: 0 },
  tableColumnRow: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  colLabel: { fontSize: 10, fontWeight: "700", color: "#8A8A8A", letterSpacing: 0.5 },
  colAssessment: { width: 130 },
  colName:       { width: 110 },
  colExpected:   { width: 110 },
  colPaid:       { width: 100 },
  colFee:        { width: 130 },
  colBalance:    { width: 140 },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  cellText:  { fontSize: 12, color: "#333" },
  cellMuted: { fontSize: 12, color: "#666" },
  cellBalance: { fontSize: 12, fontWeight: "700" },
  feeInput: {
    backgroundColor: "#fafafa",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    height: 36,
    paddingHorizontal: 10,
    fontSize: 13,
    color: "#141414",
  },
  emptyWrap: { paddingVertical: 40, paddingHorizontal: 16, alignItems: "center" },
  emptyText: { fontSize: 13, color: "#8A8A8A" },

  // Green success banner
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#dcfce7",
    borderWidth: 1,
    borderColor: "#22c55e",
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 14,
  },
  successBannerText: { flex: 1, color: "#166534", fontWeight: "700", fontSize: 13 },

  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.gold,
    height: 48,
    margin: 16,
    borderRadius: 10,
  },
  submitButtonText: { color: "#111111", fontWeight: "700", fontSize: 14 },
  receiptButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: COLORS.gold,
    height: 44,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 10,
  },
  receiptButtonText: { color: "#141414", fontWeight: "700", fontSize: 13 },
});