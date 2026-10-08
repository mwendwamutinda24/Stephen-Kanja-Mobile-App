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
  TextInput,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import ThemedView from "@/components/themed-view";

// TODO: point this at your InfinityFree PHP backend, e.g.
// "https://stephenkanjaportal.infinityfreeapp.com/api"
const API_BASE_URL = "https://stephenkanjaportal.infinityfreeapp.com/api";

const GOLD = "#D4A017";
const DARK = "#14151A";
const CARD_BG = "#FFFFFF";
const PAGE_BG = "#F2EFEA";
const LABEL_GRAY = "#8A8F98";

const GRADES = ["Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9"];
const TERMS = ["Term 1", "Term 2", "Term 3"];
const EXAM_TYPES = ["Opener", "Mid Term", "End Term"];
const YEARS = ["2024", "2025", "2026"];

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

type Tab = "individual" | "grade";

type LearnerResult = {
  assessmentNumber: string;
  name: string;
  grade: string;
  average: number;
  trend?: "up" | "down" | "flat";
};

type GradeResult = {
  subject: string;
  average: number;
  highest: number;
  lowest: number;
};

export default function TrackPerformance() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("individual");

  // Individual learner search state
  const [assessmentNumber, setAssessmentNumber] = useState("");
  const [learnerName, setLearnerName] = useState("");
  const [searchGrade, setSearchGrade] = useState("");
  const [learnerLoading, setLearnerLoading] = useState(false);
  const [learnerError, setLearnerError] = useState<string | null>(null);
  const [learnerResults, setLearnerResults] = useState<LearnerResult[] | null>(null);

  // Grade performance state
  const [grade, setGrade] = useState("Grade 1");
  const [term, setTerm] = useState("");
  const [examType, setExamType] = useState("");
  const [year, setYear] = useState("");
  const [gradeLoading, setGradeLoading] = useState(false);
  const [gradeError, setGradeError] = useState<string | null>(null);
  const [gradeResults, setGradeResults] = useState<GradeResult[] | null>(null);

  const searchLearner = async () => {
    if (!assessmentNumber && !learnerName) {
      setLearnerError("Enter an assessment number or a learner name.");
      return;
    }
    setLearnerLoading(true);
    setLearnerError(null);
    setLearnerResults(null);

    try {
      const params = new URLSearchParams();
      if (assessmentNumber) params.append("assessment_number", assessmentNumber);
      if (learnerName) params.append("name", learnerName);
      if (searchGrade) params.append("grade", searchGrade);

      // PHP endpoint example: search_learner.php?assessment_number=...&name=...&grade=...
      const res = await fetch(`${API_BASE_URL}/search_learner.php?${params.toString()}`);
      const text = await res.text();

      // InfinityFree free-tier PHP sometimes prepends warnings/HTML before JSON —
      // guard against that by trying to locate the JSON payload.
      const jsonStart = text.indexOf("{");
      const jsonArrayStart = text.indexOf("[");
      const start =
        jsonStart === -1 ? jsonArrayStart : jsonArrayStart === -1 ? jsonStart : Math.min(jsonStart, jsonArrayStart);
      const data = JSON.parse(start >= 0 ? text.slice(start) : text);

      if (data.error) throw new Error(data.error);
      setLearnerResults(data.results ?? data ?? []);
    } catch (err: any) {
      setLearnerError(err?.message ?? "Failed to fetch learner data.");
    } finally {
      setLearnerLoading(false);
    }
  };

  const loadGradePerformance = async () => {
    if (!grade || !term || !examType || !year) {
      setGradeError("Select grade, term, exam type and year.");
      return;
    }
    setGradeLoading(true);
    setGradeError(null);
    setGradeResults(null);

    try {
      const params = new URLSearchParams({ grade, term, exam_type: examType, year });

      // PHP endpoint example: grade_performance.php?grade=...&term=...&exam_type=...&year=...
      const res = await fetch(`${API_BASE_URL}/grade_performance.php?${params.toString()}`);
      const text = await res.text();

      const jsonStart = text.indexOf("{");
      const jsonArrayStart = text.indexOf("[");
      const start =
        jsonStart === -1 ? jsonArrayStart : jsonArrayStart === -1 ? jsonStart : Math.min(jsonStart, jsonArrayStart);
      const data = JSON.parse(start >= 0 ? text.slice(start) : text);

      if (data.error) throw new Error(data.error);
      setGradeResults(data.subjects ?? data ?? []);
    } catch (err: any) {
      setGradeError(err?.message ?? "Failed to fetch grade performance data.");
    } finally {
      setGradeLoading(false);
    }
  };

  const renderSidebarSection = (title: string, items: SidebarItem[]) => (
    <View style={styles.sidebarSection}>
      <Text style={styles.sidebarSectionTitle}>{title}</Text>
      {items.map((item) => {
        const isActive = item.label === "Track Performance";
        return (
          <TouchableOpacity
            key={item.label}
            style={[styles.sidebarItem, isActive && styles.sidebarItemActive]}
            onPress={() => setSidebarOpen(false)}
          >
            <Ionicons
              name={item.icon}
              size={18}
              color={isActive ? GOLD : "#C9CCD1"}
              style={{ marginRight: 12 }}
            />
            <Text style={[styles.sidebarItemText, isActive && styles.sidebarItemTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <ThemedView style={{ flex: 1, backgroundColor: PAGE_BG }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => setSidebarOpen(true)}>
          <Ionicons name="menu" size={20} color={DARK} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>
            STEPHEN KANJA <Text style={{ color: GOLD }}>SCHOOL</Text>
          </Text>
        </View>
      </View>

      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>ANALYTICS &amp; INTELLIGENCE</Text>
        <Text style={styles.heroTitle}>
          PERFORMANCE <Text style={{ color: GOLD }}>TRACKER</Text>
        </Text>
        <Text style={styles.heroSubtitle}>
          Drill into individual learners, grade cohorts and school-wide academic trends.
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "individual" && styles.tabActive]}
          onPress={() => setActiveTab("individual")}
        >
          <Ionicons
            name="person-outline"
            size={16}
            color={activeTab === "individual" ? GOLD : "#8A8F98"}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.tabText, activeTab === "individual" && styles.tabTextActive]}>
            Individual Learner
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === "grade" && styles.tabActive]}
          onPress={() => setActiveTab("grade")}
        >
          <Ionicons
            name="people-outline"
            size={16}
            color={activeTab === "grade" ? GOLD : "#8A8F98"}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.tabText, activeTab === "grade" && styles.tabTextActive]}>
            Grade Performance
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {activeTab === "individual" ? (
          <>
            {/* Search Learner Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardHeaderText}>◆ SEARCH LEARNER</Text>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.filterLabel}>ASSESSMENT NUMBER</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. SKS/2024/001"
                  placeholderTextColor="#A9ADB3"
                  value={assessmentNumber}
                  onChangeText={setAssessmentNumber}
                  autoCapitalize="characters"
                />

                <Text style={[styles.filterLabel, { marginTop: 14 }]}>LEARNER NAME</Text>
                <TextInput
                  style={styles.input}
                  placeholder="First or last name..."
                  placeholderTextColor="#A9ADB3"
                  value={learnerName}
                  onChangeText={setLearnerName}
                />

                <Text style={[styles.filterLabel, { marginTop: 14 }]}>GRADE (OPTIONAL)</Text>
                <View style={styles.selectBox}>
                  <Picker selectedValue={searchGrade} onValueChange={setSearchGrade} style={styles.picker}>
                    <Picker.Item label="— All Grades —" value="" />
                    {GRADES.map((g) => (
                      <Picker.Item key={g} label={g} value={g} />
                    ))}
                  </Picker>
                </View>

                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={searchLearner}
                  disabled={learnerLoading}
                >
                  {learnerLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="search" size={16} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.actionButtonText}>Search</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Results Card */}
            <View style={[styles.card, { alignItems: "center" }]}>
              {learnerError ? (
                <>
                  <Ionicons name="alert-circle-outline" size={36} color="#D9534F" />
                  <Text style={[styles.emptyStateText, { color: "#D9534F" }]}>{learnerError}</Text>
                </>
              ) : !learnerResults ? (
                <>
                  <View style={styles.emptyIconCircle}>
                    <Ionicons name="person" size={22} color={GOLD} />
                  </View>
                  <Text style={styles.emptyStateText}>
                    Search by assessment number or name{"\n"}to view a learner's performance trend.
                  </Text>
                </>
              ) : learnerResults.length === 0 ? (
                <>
                  <Ionicons name="search-outline" size={36} color={GOLD} />
                  <Text style={styles.emptyStateText}>No learner matched your search.</Text>
                </>
              ) : (
                <View style={{ width: "100%" }}>
                  {learnerResults.map((l, idx) => (
                    <View key={l.assessmentNumber ?? idx} style={styles.learnerRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.learnerName}>{l.name}</Text>
                        <Text style={styles.learnerMeta}>
                          {l.assessmentNumber} · {l.grade}
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={styles.learnerAverage}>{l.average}%</Text>
                        {l.trend && (
                          <Ionicons
                            name={
                              l.trend === "up"
                                ? "trending-up"
                                : l.trend === "down"
                                ? "trending-down"
                                : "remove"
                            }
                            size={16}
                            color={l.trend === "up" ? "#4CAF50" : l.trend === "down" ? "#D9534F" : "#8A8F98"}
                          />
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        ) : (
          <>
            {/* Select Grade & Exam Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardHeaderText}>◆ SELECT GRADE &amp; EXAM</Text>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.filterLabel}>GRADE</Text>
                <View style={styles.selectBox}>
                  <Picker selectedValue={grade} onValueChange={setGrade} style={styles.picker}>
                    {GRADES.map((g) => (
                      <Picker.Item key={g} label={g} value={g} />
                    ))}
                  </Picker>
                </View>

                <Text style={[styles.filterLabel, { marginTop: 14 }]}>TERM</Text>
                <View style={styles.selectBox}>
                  <Picker selectedValue={term} onValueChange={setTerm} style={styles.picker}>
                    <Picker.Item label="— Term —" value="" />
                    {TERMS.map((t) => (
                      <Picker.Item key={t} label={t} value={t} />
                    ))}
                  </Picker>
                </View>

                <Text style={[styles.filterLabel, { marginTop: 14 }]}>EXAM TYPE</Text>
                <View style={styles.selectBox}>
                  <Picker selectedValue={examType} onValueChange={setExamType} style={styles.picker}>
                    <Picker.Item label="— Exam —" value="" />
                    {EXAM_TYPES.map((e) => (
                      <Picker.Item key={e} label={e} value={e} />
                    ))}
                  </Picker>
                </View>

                <Text style={[styles.filterLabel, { marginTop: 14 }]}>YEAR</Text>
                <View style={styles.selectBox}>
                  <Picker selectedValue={year} onValueChange={setYear} style={styles.picker}>
                    <Picker.Item label="— Year —" value="" />
                    {YEARS.map((y) => (
                      <Picker.Item key={y} label={y} value={y} />
                    ))}
                  </Picker>
                </View>

                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={loadGradePerformance}
                  disabled={gradeLoading}
                >
                  {gradeLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="filter" size={16} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.actionButtonText}>Load</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Results Card */}
            <View style={[styles.card, { alignItems: "center" }]}>
              {gradeError ? (
                <>
                  <Ionicons name="alert-circle-outline" size={36} color="#D9534F" />
                  <Text style={[styles.emptyStateText, { color: "#D9534F" }]}>{gradeError}</Text>
                </>
              ) : !gradeResults ? (
                <>
                  <View style={[styles.emptyIconCircle, { backgroundColor: DARK }]}>
                    <Ionicons name="people" size={22} color={GOLD} />
                  </View>
                  <Text style={styles.emptyStateText}>
                    Select a grade, term, exam type and year{"\n"}to load cohort performance.
                  </Text>
                </>
              ) : gradeResults.length === 0 ? (
                <>
                  <Ionicons name="stats-chart-outline" size={36} color={GOLD} />
                  <Text style={styles.emptyStateText}>No data found for this selection.</Text>
                </>
              ) : (
                <View style={{ width: "100%" }}>
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Subject</Text>
                    <Text style={styles.tableHeaderCell}>Avg</Text>
                    <Text style={styles.tableHeaderCell}>High</Text>
                    <Text style={styles.tableHeaderCell}>Low</Text>
                  </View>
                  {gradeResults.map((r, idx) => (
                    <View
                      key={`${r.subject}-${idx}`}
                      style={[styles.tableRow, idx % 2 === 1 && { backgroundColor: "#FAFAFA" }]}
                    >
                      <Text style={[styles.tableCell, { flex: 2 }]}>{r.subject}</Text>
                      <Text style={styles.tableCell}>{r.average}</Text>
                      <Text style={styles.tableCell}>{r.highest}</Text>
                      <Text style={styles.tableCell}>{r.lowest}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
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

            <Text style={styles.sidebarFooter}>© 2026 Kelvin Mutinda{"\n"}infinityfreeapp.com</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: DARK,
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
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
  iconButtonGold: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  hero: {
    backgroundColor: DARK,
    paddingHorizontal: 16,
    paddingBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: GOLD,
  },
  heroEyebrow: {
    color: GOLD,
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: "700",
    marginBottom: 6,
  },
  heroTitle: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  heroSubtitle: {
    color: "#9AA0A8",
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 8,
    lineHeight: 18,
  },
  tabsRow: {
    flexDirection: "row",
    backgroundColor: DARK,
    paddingHorizontal: 16,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    marginRight: 24,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: GOLD,
  },
  tabText: {
    color: "#8A8F98",
    fontSize: 13,
    fontWeight: "600",
  },
  tabTextActive: {
    color: GOLD,
    fontWeight: "700",
  },
  content: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: {
    backgroundColor: DARK,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderBottomWidth: 2,
    borderBottomColor: GOLD,
  },
  cardHeaderText: {
    color: GOLD,
    fontWeight: "800",
    fontSize: 13,
    letterSpacing: 0.5,
  },
  cardBody: {
    padding: 18,
  },
  filterLabel: {
    fontSize: 11,
    letterSpacing: 1,
    color: LABEL_GRAY,
    marginBottom: 6,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E3DE",
    borderRadius: 10,
    backgroundColor: "#FBFAF8",
    paddingHorizontal: 14,
    height: 44,
    color: DARK,
    fontSize: 14,
  },
  selectBox: {
    borderWidth: 1,
    borderColor: "#E5E3DE",
    borderRadius: 10,
    backgroundColor: "#FBFAF8",
    overflow: "hidden",
  },
  picker: {
    height: 44,
    color: DARK,
  },
  actionButton: {
    backgroundColor: DARK,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  emptyIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: DARK,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  emptyStateText: {
    color: LABEL_GRAY,
    fontSize: 13,
    textAlign: "center",
    marginTop: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  learnerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0EEE9",
  },
  learnerName: {
    fontSize: 14,
    fontWeight: "700",
    color: DARK,
  },
  learnerMeta: {
    fontSize: 12,
    color: LABEL_GRAY,
    marginTop: 2,
  },
  learnerAverage: {
    fontSize: 15,
    fontWeight: "800",
    color: DARK,
  },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E3DE",
    paddingBottom: 8,
    marginBottom: 4,
  },
  tableHeaderCell: {
    flex: 1,
    fontSize: 11,
    letterSpacing: 0.5,
    color: LABEL_GRAY,
    fontWeight: "700",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 6,
  },
  tableCell: {
    flex: 1,
    fontSize: 13,
    color: DARK,
  },
  sidebarOverlay: {
    flex: 1,
    backgroundColor: "rgba(16, 16, 17, 0.4)",
    flexDirection: "row",
  },
  sidebar: {
    width: "78%",
    maxWidth: 320,
    height: "100%",
    backgroundColor: 'blue',
    paddingTop: 50,
    paddingHorizontal: 16,
    borderRightWidth: 2,
    borderRightColor: GOLD,
  },
  sidebarHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
    marginBottom: 8,
  },
  sidebarBrand: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 13,
    letterSpacing: 0.5,
  },
  sidebarTagline: {
    color: "#9AA0A8",
    fontSize: 9,
    letterSpacing: 1,
    marginTop: 2,
  },
  sidebarSection: { marginTop: 18 },
  sidebarSectionTitle: {
    color: "#6B6F76",
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: "700",
    marginBottom: 8,
  },
  sidebarItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  sidebarItemActive: {
    backgroundColor: "rgba(16, 47, 202, 0.12)",
    borderWidth: 1,
    borderColor: GOLD,
  },
  sidebarItemText: {
    color: "#C9CCD1",
    fontSize: 13,
    fontWeight: "500",
  },
  sidebarItemTextActive: {
    color: GOLD,
    fontWeight: "700",
  },
  sidebarFooter: {
    color: "#585C63",
    fontSize: 10,
    textAlign: "center",
    paddingVertical: 20,
  },
});