import React, { useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
  Linking,
  Platform,
} from "react-native";
import {
  Menu,
  GraduationCap,
  Search,
  Coins,
  ChevronRight,
  X,
  Receipt,
  Download,
} from "lucide-react-native";
import ThemedView from "@/components/themed-view";
import ThemedText from "@/components/themed-text";
import AppSidebar from "@/components/app-sidebar";
import SelectField from "@/components/select-field";
import { ENDPOINTS } from "@/api-config";

// ---------------------------------------------------------------------------
// Types matching the PHP API contract
// ---------------------------------------------------------------------------
type FeeStatus = "Paid" | "Partial" | "Unpaid";

type LearnerFeeSummary = {
  id: string | number;
  initials: string;
  name: string;
  grade: string;
  schoolFee: number;
  paid: number;
  balance: number;
  status: FeeStatus;
};

type PaymentTransaction = {
  id: string | number;
  date: string;
  amount: number;
  term: string;
  receiptNo: string;
};

type TrackFeesStats = {
  totalCollected: number;
  totalOutstanding: number;
  learnersWithBalance: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Alert.alert does nothing on react-native-web, so use window.alert there.
// (console.warn, not console.error, so Expo doesn't show a red overlay.)
function notify(title: string, message: string) {
  if (Platform.OS === "web") {
    console.warn(`${title}: ${message}`);
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

// Put your app's auth header here (the same one your me.php call uses),
// e.g. { Authorization: `Bearer ${token}` }. Leave empty if not needed.
function authHeaders(): Record<string, string> {
  return {};
}

// Reads a JSON response and throws a readable error if it isn't JSON
async function readJson(res: Response): Promise<any> {
  const text = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Server returned non-JSON (${res.status}): ${text.slice(0, 120)}`);
  }
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || `Server error (${res.status}).`);
  }
  return data;
}

// ---------------------------------------------------------------------------
// Real API calls
// ---------------------------------------------------------------------------
async function fetchFeeTracking(
  grade: string | null,
  term: string | null,
  year: string | null,
  search: string
): Promise<{ stats: TrackFeesStats; learners: LearnerFeeSummary[] }> {
  const params = new URLSearchParams();
  if (grade && grade !== "All Grades") params.append("grade", grade.replace(/\D/g, ""));
  if (term && term !== "All Terms") params.append("term", term.replace(/\D/g, ""));
  if (year) params.append("year", year);
  if (search.trim()) params.append("search", search.trim());

  const res = await fetch(`${ENDPOINTS.trackFees}?${params.toString()}`, {
    headers: { Accept: "application/json", ...authHeaders() },
  });
  const data = await readJson(res);
  return { stats: data.stats, learners: data.learners };
}

async function fetchPaymentHistory(
  learnerId: string | number,
  term: string | null,
  year: string | null
): Promise<PaymentTransaction[]> {
  const params = new URLSearchParams({ id: String(learnerId) });
  if (year) params.append("year", year);
  if (term && term !== "All Terms") params.append("term", term.replace(/\D/g, ""));

  const res = await fetch(`${ENDPOINTS.paymentHistory}?${params.toString()}`, {
    headers: { Accept: "application/json", ...authHeaders() },
  });
  const data = await readJson(res);
  return data.transactions as PaymentTransaction[];
}

// Asks the server for a short-lived signed link to the receipt
async function fetchReceiptUrl(receiptNo: string): Promise<string> {
  const res = await fetch(
    `${ENDPOINTS.receiptLink}?receipt_no=${encodeURIComponent(receiptNo)}`,
    { headers: { Accept: "application/json", ...authHeaders() } }
  );
  const data = await readJson(res);
  return data.url as string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const GRADES = [
  "All Grades", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5",
  "Grade 6", "Grade 7", "Grade 8", "Grade 9",
];
const TERMS = ["All Terms", "Term 1", "Term 2", "Term 3"];
const YEARS = ["2024", "2025", "2026", "2027"];

function statusColor(status: FeeStatus) {
  if (status === "Paid") return { bg: "#e6f4ea", text: "#2e7d32" };
  if (status === "Partial") return { bg: "#fff6e0", text: "#9a7b12" };
  return { bg: "#fdecea", text: "#c62828" };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function TrackFees() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [grade, setGrade] = useState<string | null>("All Grades");
  const [term, setTerm] = useState<string | null>("All Terms");
  const [year, setYear] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [stats, setStats] = useState<TrackFeesStats>({
    totalCollected: 0,
    totalOutstanding: 0,
    learnersWithBalance: 0,
  });
  const [learners, setLearners] = useState<LearnerFeeSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const [historyVisible, setHistoryVisible] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [activeLearner, setActiveLearner] = useState<LearnerFeeSummary | null>(null);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [openingReceipt, setOpeningReceipt] = useState<string | null>(null);

  const handleFilter = async () => {
    if (!year) {
      notify("Missing year", "Please select a year.");
      return;
    }
    setLoading(true);
    try {
      const data = await fetchFeeTracking(grade, term, year, search);
      setStats(data.stats);
      setLearners(data.learners);
    } catch (err: any) {
      notify("Load failed", err.message || "Could not load fee records.");
      setLearners([]);
    } finally {
      setLoading(false);
    }
  };

  const openHistory = async (learner: LearnerFeeSummary) => {
    setActiveLearner(learner);
    setHistoryVisible(true);
    setHistoryLoading(true);
    setTransactions([]);
    try {
      setTransactions(await fetchPaymentHistory(learner.id, term, year));
    } catch (err: any) {
      notify("Load failed", err.message || "Could not load payment history.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const openReceipt = async (receiptNo: string) => {
    if (openingReceipt) return;
    setOpeningReceipt(receiptNo);

    // On web, open the tab synchronously (inside the tap) so the popup
    // blocker allows it, then point it at the receipt once we have the link.
    const win = Platform.OS === "web" ? window.open("", "_blank") : null;

    try {
      const url = await fetchReceiptUrl(receiptNo);
      const full = `${url}&format=pdf`;
      if (win) {
        win.location.href = full;
      } else {
        await Linking.openURL(full);
      }
    } catch (err: any) {
      win?.close();
      notify("Cannot open receipt", err.message || "Please try again.");
    } finally {
      setOpeningReceipt(null);
    }
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
          <View>
            <ThemedText style={styles.header1}>
              Stephen Kanja <ThemedText style={styles.headerAccent}>School</ThemedText>
            </ThemedText>
            <ThemedText style={styles.header2}>AIM HIGHER</ThemedText>
          </View>
        </View>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        <ThemedText style={styles.eyebrow}>FINANCE MODULE</ThemedText>
        <ThemedText style={styles.pageTitle}>Track Fees</ThemedText>
        <ThemedText style={styles.pageSubtitle}>
          Monitor learner fee balances and payment history.
        </ThemedText>

        {/* Stat cards */}
        <View style={[styles.statCard, { borderTopColor: "#2e7d32" }]}>
          <ThemedText style={styles.statLabel}>TOTAL COLLECTED</ThemedText>
          <ThemedText style={styles.statValue}>KES {stats.totalCollected.toLocaleString()}</ThemedText>
          <ThemedText style={styles.statCaption}>across all learners</ThemedText>
        </View>

        <View style={[styles.statCard, { borderTopColor: "#c62828" }]}>
          <ThemedText style={styles.statLabel}>OUTSTANDING BALANCE</ThemedText>
          <ThemedText style={styles.statValue}>KES {stats.totalOutstanding.toLocaleString()}</ThemedText>
          <ThemedText style={styles.statCaption}>yet to be collected</ThemedText>
        </View>

        <View style={[styles.statCard, { borderTopColor: "#E8B923" }]}>
          <ThemedText style={styles.statLabel}>LEARNERS WITH BALANCE</ThemedText>
          <ThemedText style={styles.statValue}>{stats.learnersWithBalance}</ThemedText>
          <ThemedText style={styles.statCaption}>need follow-up</ThemedText>
        </View>

        {/* Filter Options */}
        <View style={styles.sectionBar}>
          <Coins size={16} color="#E8B923" />
          <ThemedText style={styles.sectionBarText}>FILTER OPTIONS</ThemedText>
        </View>
        <View style={[styles.card, styles.cardTopFlush]}>
          <View style={styles.filterRow}>
            <View style={styles.filterHalf}>
              <SelectField label="GRADE" placeholder="All Grades" value={grade} options={GRADES} onChange={setGrade} />
            </View>
            <View style={styles.filterHalf}>
              <SelectField label="TERM" placeholder="All Terms" value={term} options={TERMS} onChange={setTerm} />
            </View>
          </View>
          <SelectField label="YEAR" placeholder="— Select Year —" value={year} options={YEARS} onChange={setYear} />

          <ThemedText style={styles.fieldLabel}>SEARCH</ThemedText>
          <View style={styles.searchBox}>
            <Search size={16} color="#9a9a9a" />
            <TextInput
              style={styles.searchInput}
              placeholder="Name or assessment no."
              placeholderTextColor="#9a9a9a"
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
              onSubmitEditing={handleFilter}
            />
          </View>

          <TouchableOpacity style={styles.filterButton} onPress={handleFilter} disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color="#111111" />
            ) : (
              <>
                <Search size={16} color="#111111" />
                <ThemedText style={styles.filterButtonText}>Filter</ThemedText>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Learner fee status table */}
        <View style={styles.sectionBar}>
          <View style={styles.sectionBarLeft}>
            <Coins size={16} color="#E8B923" />
            <ThemedText style={styles.sectionBarText}>LEARNER FEE STATUS</ThemedText>
          </View>
          <View style={styles.countPill}>
            <ThemedText style={styles.countPillText}>{learners.length} learners</ThemedText>
          </View>
        </View>

        <View style={[styles.card, styles.cardTopFlush, styles.tableCard]}>
          {learners.length === 0 ? (
            <View style={styles.emptyWrap}>
              <ThemedText style={styles.emptyText}>
                {loading ? "Loading…" : "No learners match this filter yet."}
              </ThemedText>
            </View>
          ) : (
            learners.map((row) => {
              const colors = statusColor(row.status);
              return (
                <TouchableOpacity key={row.id} style={styles.learnerRow} onPress={() => openHistory(row)}>
                  <View style={styles.avatar}>
                    <ThemedText style={styles.avatarText}>{row.initials}</ThemedText>
                  </View>
                  <View style={styles.learnerInfo}>
                    <ThemedText style={styles.learnerName} numberOfLines={1}>{row.name}</ThemedText>
                    <ThemedText style={styles.learnerGrade}>{row.grade}</ThemedText>
                  </View>
                  <View style={styles.learnerAmounts}>
                    <ThemedText style={styles.balanceText}>
                      Bal: KES {row.balance.toLocaleString()}
                    </ThemedText>
                    <View style={[styles.statusBadge, { backgroundColor: colors.bg }]}>
                      <ThemedText style={[styles.statusBadgeText, { color: colors.text }]}>
                        {row.status}
                      </ThemedText>
                    </View>
                  </View>
                  <ChevronRight size={18} color="#c9c9c9" />
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Payment history modal */}
      <Modal visible={historyVisible} transparent animationType="slide" onRequestClose={() => setHistoryVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <ThemedText style={styles.modalTitle}>{activeLearner?.name}</ThemedText>
                <ThemedText style={styles.modalSubtitle}>{activeLearner?.grade} · Payment history</ThemedText>
              </View>
              <TouchableOpacity onPress={() => setHistoryVisible(false)}>
                <X size={20} color="#141414" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalSummaryRow}>
              <View style={styles.modalSummaryItem}>
                <ThemedText style={styles.modalSummaryLabel}>EXPECTED</ThemedText>
                <ThemedText style={styles.modalSummaryValue}>
                  KES {activeLearner?.schoolFee.toLocaleString() ?? 0}
                </ThemedText>
              </View>
              <View style={styles.modalSummaryItem}>
                <ThemedText style={styles.modalSummaryLabel}>PAID</ThemedText>
                <ThemedText style={[styles.modalSummaryValue, { color: "#2e7d32" }]}>
                  KES {activeLearner?.paid.toLocaleString() ?? 0}
                </ThemedText>
              </View>
              <View style={styles.modalSummaryItem}>
                <ThemedText style={styles.modalSummaryLabel}>BALANCE</ThemedText>
                <ThemedText style={[styles.modalSummaryValue, { color: "#c62828" }]}>
                  KES {activeLearner?.balance.toLocaleString() ?? 0}
                </ThemedText>
              </View>
            </View>

            <ScrollView style={styles.modalList}>
              {historyLoading ? (
                <View style={styles.modalLoadingWrap}>
                  <ActivityIndicator size="small" color="#E8B923" />
                </View>
              ) : transactions.length === 0 ? (
                <View style={styles.modalLoadingWrap}>
                  <Receipt size={28} color="#d0d0d0" />
                  <ThemedText style={styles.modalEmptyText}>No payments recorded yet.</ThemedText>
                </View>
              ) : (
                transactions.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={styles.txnRow}
                    disabled={!t.receiptNo || openingReceipt !== null}
                    onPress={() => openReceipt(t.receiptNo)}
                  >
                    <View style={styles.txnIcon}>
                      <Receipt size={14} color="#E8B923" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={styles.txnAmount}>KES {t.amount.toLocaleString()}</ThemedText>
                      <ThemedText style={styles.txnMeta}>
                        {[t.date, t.term, t.receiptNo ? `Rcpt #${t.receiptNo}` : "No receipt"]
                          .filter(Boolean)
                          .join(" · ")}
                      </ThemedText>
                    </View>
                    {t.receiptNo ? (
                      openingReceipt === t.receiptNo ? (
                        <ActivityIndicator size="small" color="#E8B923" />
                      ) : (
                        <Download size={18} color="#E8B923" />
                      )
                    ) : null}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <AppSidebar visible={sidebarOpen} onClose={() => setSidebarOpen(false)} activeRoute="/trackFees" />
    </ThemedView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const COLORS = { gold: "#E8B923", dark: "#141414", bg: "#efeff4", border: "#e5e5e5" };

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
  statValue: { fontSize: 22, fontWeight: "800", color: "#141414", marginBottom: 4 },
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
  filterRow: { flexDirection: "row", gap: 12 },
  filterHalf: { flex: 1 },
  fieldLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1, color: "#6f6f6f", marginBottom: 8 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    backgroundColor: "#fafafa",
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 46,
    marginBottom: 16,
  },
  searchInput: { flex: 1, color: "#141414", fontSize: 14 },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.gold,
    height: 48,
    borderRadius: 10,
  },
  filterButtonText: { color: "#111111", fontWeight: "700", fontSize: 14 },
  tableCard: { padding: 0 },
  emptyWrap: { paddingVertical: 40, paddingHorizontal: 16, alignItems: "center" },
  emptyText: { fontSize: 13, color: "#8A8A8A" },
  learnerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  avatar: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.dark,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: COLORS.gold, fontSize: 11, fontWeight: "700" },
  learnerInfo: { flex: 1 },
  learnerName: { fontSize: 13, fontWeight: "700", color: "#141414" },
  learnerGrade: { fontSize: 11, color: "#8A8A8A", marginTop: 2 },
  learnerAmounts: { alignItems: "flex-end", marginRight: 4 },
  balanceText: { fontSize: 11, color: "#555", marginBottom: 4 },
  statusBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  statusBadgeText: { fontSize: 10, fontWeight: "700" },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "75%",
    padding: 20,
  },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: "800", color: "#141414" },
  modalSubtitle: { fontSize: 12, color: "#8A8A8A", marginTop: 2 },
  modalSummaryRow: {
    flexDirection: "row",
    backgroundColor: "#fafafa",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  modalSummaryItem: { flex: 1, alignItems: "center" },
  modalSummaryLabel: { fontSize: 9, fontWeight: "700", color: "#8A8A8A", letterSpacing: 0.5, marginBottom: 4 },
  modalSummaryValue: { fontSize: 13, fontWeight: "800", color: "#141414" },
  modalList: { maxHeight: 320 },
  modalLoadingWrap: { alignItems: "center", paddingVertical: 40, gap: 8 },
  modalEmptyText: { fontSize: 13, color: "#8A8A8A" },
  txnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  txnIcon: {
    width: 30, height: 30, borderRadius: 8, backgroundColor: "#fdf6e3",
    alignItems: "center", justifyContent: "center",
  },
  txnAmount: { fontSize: 14, fontWeight: "700", color: "#141414" },
  txnMeta: { fontSize: 11, color: "#8A8A8A", marginTop: 2 },
});