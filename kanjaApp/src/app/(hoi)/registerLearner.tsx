import React, { useState } from "react";
import ThemedText from "@/components/themed-text";
import ThemedView from "@/components/themed-view";
import {
  View,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import * as DocumentPicker from "expo-document-picker";
import {
  Menu,
  GraduationCap,
  UserPlus,
  FileSpreadsheet,
  Info,
  Download,
  UploadCloud,
  CheckCircle2,
  X,
} from "lucide-react-native";
import AppSidebar from "@/components/app-sidebar";
import { apiRequest, ApiError } from "@/services/api/client"; // <-- adjust if this lives elsewhere

export default function RegisterLearner() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pickedFile, setPickedFile] = useState<string | null>(null);

  // ---- Form state ----
  const [upi, setUpi] = useState("");
  const [assessment, setAssessment] = useState("");
  const [birthNo, setBirthNo] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [surname, setSurname] = useState("");
  const [dob, setDob] = useState("");
  const [grade, setGrade] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // On-screen confirmation shown after a successful registration, in
  // addition to the Alert dialog — so the confirmation is still visible
  // on screen even after the Alert is dismissed, and on platforms where
  // Alert.alert renders less prominently (e.g. web).
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const resetForm = () => {
    setUpi("");
    setAssessment("");
    setBirthNo("");
    setFirstName("");
    setMiddleName("");
    setSurname("");
    setDob("");
    setGrade("");
  };

  const handleRegister = async () => {
    if (firstName.trim() === "") {
      Alert.alert("First name required", "Please enter at least a first name.");
      return;
    }

    setSubmitting(true);
    setSuccessMessage(null);
    try {
      const data = await apiRequest<{ studentId: number; firstName: string }>(
        "/register_student.php",
        {
          method: "POST",
          body: {
            UPI: upi,
            Assesment: assessment,
            firstName,
            middleName,
            surname,
            DOB: dob,
            Grade: grade,
            birthNo,
          },
        }
      );

      const fullName = [data.firstName, middleName, surname]
        .map((s) => s.trim())
        .filter(Boolean)
        .join(" ");

      const confirmationText = `${fullName} has been added to the school roster${
        grade ? ` (Grade ${grade})` : ""
      }. Student ID: ${data.studentId}.`;

      setSuccessMessage(confirmationText);

      Alert.alert(
        "Learner Registered 🎓",
        `${confirmationText}\n\nYou can add any missing details anytime from the Students page.`,
        [{ text: "Register Another", onPress: resetForm }, { text: "Done" }]
      );
    } catch (err) {
      // The backend responds with { error: 'duplicate_learner', message: ... }
      // (409) when the UPI or Assessment number already belongs to an
      // existing Student row. Surface that distinctly from a generic
      // failure so the user understands *why* it was refused, rather than
      // assuming something's broken.
      const code = err instanceof ApiError ? (err as any).code : undefined;
      const message = err instanceof ApiError ? err.message : "Something went wrong.";

      if (code === "duplicate_learner") {
        Alert.alert("Learner Already Registered", message);
      } else {
        Alert.alert("Registration failed", message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleBrowseFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        "text/csv",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ],
      copyToCacheDirectory: true,
    });

    if (!result.canceled && result.assets?.length) {
      setPickedFile(result.assets[0].name);
    }
  };

  return (
    <ThemedView style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.menuButton} onPress={() => setSidebarOpen(true)}>
            <Menu size={20} color="#141414" />
          </TouchableOpacity>
          <View style={styles.logoBadge}>
            <GraduationCap size={20} color={COLORS.accent} />
          </View>
          <ThemedText style={styles.header1}>Stephen Kanja School</ThemedText>
        </View>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        <View style={styles.reg}>
          <ThemedText style={styles.new}>ADMIT NEW LEARNER</ThemedText>
          <ThemedText style={styles.new1}>Fill in the details below</ThemedText>
        </View>

        {/* On-screen success banner */}
        {successMessage ? (
          <View style={styles.successBanner}>
            <CheckCircle2 size={18} color="#2e7d32" />
            <ThemedText style={styles.successText}>{successMessage}</ThemedText>
            <TouchableOpacity onPress={() => setSuccessMessage(null)} hitSlop={8}>
              <X size={16} color="#2e7d32" />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Identification Section */}
        <View style={styles.formCard}>
          <ThemedText style={styles.sectionTitle}>Identification</ThemedText>

          <View style={styles.formGroup}>
            <ThemedText style={styles.label}>UPI Number (Optional)</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="e.g. 12345678"
              keyboardType="numeric"
              value={upi}
              onChangeText={setUpi}
            />
          </View>

          <View style={styles.formGroup}>
            <ThemedText style={styles.label}>Assessment Number (Optional)</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="e.g. A0000001"
              value={assessment}
              onChangeText={setAssessment}
            />
          </View>

          <View style={styles.formGroup}>
            <ThemedText style={styles.label}>Birth Certificate No (Optional)</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="Enter birth certificate number"
              value={birthNo}
              onChangeText={setBirthNo}
            />
          </View>
        </View>

        {/* Personal Details Section */}
        <View style={styles.formCard}>
          <ThemedText style={styles.sectionTitle}>Personal Details</ThemedText>

          <View style={styles.formGroup}>
            <ThemedText style={styles.label}>First Name ✦</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="Enter first name"
              value={firstName}
              onChangeText={setFirstName}
            />
          </View>

          <View style={styles.formGroup}>
            <ThemedText style={styles.label}>Middle Name (Optional)</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="Enter middle name"
              value={middleName}
              onChangeText={setMiddleName}
            />
          </View>

          <View style={styles.formGroup}>
            <ThemedText style={styles.label}>Surname (Optional)</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="Enter surname"
              value={surname}
              onChangeText={setSurname}
            />
          </View>

          <View style={styles.formGroup}>
            <ThemedText style={styles.label}>Date of Birth (Optional)</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="dd/mm/yyyy"
              value={dob}
              onChangeText={setDob}
            />
          </View>

          <View style={styles.formGroup}>
            <ThemedText style={styles.label}>Grade (Optional)</ThemedText>
            <View style={styles.pickerWrapper}>
              <Picker style={styles.picker} selectedValue={grade} onValueChange={setGrade}>
                <Picker.Item label="— Select grade —" value="" />
                <Picker.Item label="Grade 1" value="1" />
                <Picker.Item label="Grade 2" value="2" />
                <Picker.Item label="Grade 3" value="3" />
                <Picker.Item label="Grade 4" value="4" />
                <Picker.Item label="Grade 5" value="5" />
                <Picker.Item label="Grade 6" value="6" />
                <Picker.Item label="Grade 7" value="7" />
                <Picker.Item label="Grade 8" value="8" />
                <Picker.Item label="Grade 9" value="9" />
              </Picker>
            </View>
          </View>
        </View>

        {/* Note */}
        <ThemedText style={styles.note}>
          Only First Name is required — everything else can be added later.
        </ThemedText>

        {/* Register button */}
        <TouchableOpacity
          style={[styles.registerButton, submitting && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#111111" />
          ) : (
            <>
              <UserPlus size={16} color="#111111" />
              <ThemedText style={styles.buttonText}>Register Student</ThemedText>
            </>
          )}
        </TouchableOpacity>

        {/* ---- Bulk Import via Excel ---- */}
        <View style={styles.bulkHeaderBar}>
          <View style={styles.bulkIconBadge}>
            <FileSpreadsheet size={18} color="#FFFFFF" />
          </View>
          <View style={styles.bulkHeaderTextWrap}>
            <ThemedText style={styles.bulkHeaderTitle}>BULK IMPORT VIA EXCEL</ThemedText>
            <ThemedText style={styles.bulkHeaderSubtitle}>
              Upload an .xlsx or .csv file to register multiple students at once
            </ThemedText>
          </View>
        </View>

        <View style={[styles.card, styles.cardTopFlush]}>
          {/* Info callout */}
          <View style={styles.infoCallout}>
            <View style={styles.infoIconBadge}>
              <Info size={14} color="#111111" />
            </View>
            <View style={styles.infoTextWrap}>
              <ThemedText style={styles.infoTitle}>How bulk import works</ThemedText>
              <ThemedText style={styles.infoBody}>
                Download the template below, fill in the student details (one row per student),
                then upload it here. The system will preview your data before submitting. Only{" "}
                <ThemedText style={styles.infoBold}>FirstName</ThemedText> is required — a row
                with a first name and nothing else will still import. Everything else (
                <ThemedText style={styles.infoItalic}>
                  UPI, Assessment, MiddleName, Surname, DOB, Grade, BirthCertNo
                </ThemedText>
                ) is optional and can be filled in on the Students page later.
              </ThemedText>
            </View>
          </View>

          {/* Download template */}
          <TouchableOpacity style={styles.outlineButton} onPress={() => {}}>
            <Download size={16} color="#2e7d32" />
            <ThemedText style={styles.outlineButtonText}>Download Excel Template</ThemedText>
          </TouchableOpacity>

          {/* Drop zone */}
          <TouchableOpacity style={styles.dropZone} onPress={handleBrowseFile}>
            <View style={styles.dropZoneIcon}>
              <UploadCloud size={22} color="#FFFFFF" />
            </View>
            <ThemedText style={styles.dropZoneTitle}>
              {pickedFile ? pickedFile : "Drop your file here"}
            </ThemedText>
            <ThemedText style={styles.dropZoneSubtitle}>
              {pickedFile ? "Tap to choose a different file" : "or click to browse"}
            </ThemedText>

            <View style={styles.acceptedRow}>
              <ThemedText style={styles.acceptedLabel}>Accepted:</ThemedText>
              <View style={styles.acceptedPill}>
                <ThemedText style={styles.acceptedPillText}>.xlsx</ThemedText>
              </View>
              <View style={styles.acceptedPill}>
                <ThemedText style={styles.acceptedPillText}>.xls</ThemedText>
              </View>
              <View style={styles.acceptedPill}>
                <ThemedText style={styles.acceptedPillText}>.csv</ThemedText>
              </View>
            </View>
          </TouchableOpacity>
          {/* NOTE: bulk import still needs its own upload handler wired to a
              bulk_register.php endpoint — not built yet. This button currently
              only lets the user pick a file (pickedFile state) and does not
              submit it anywhere. */}
        </View>
      </ScrollView>

      <AppSidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeRoute="/register-learners"
      />
    </ThemedView>
  );
}

const COLORS = {
  gold: "#E8B923",
  dark: "#141414",
  green: "#2e7d32",
  border: "#e5e5e5",
  bg: "#EFEDE7",
  accent: "#6C5CE7",
  accentSoft: "#E9E5FB",
};

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  // Header
  header: {
    backgroundColor: COLORS.bg,
    paddingTop: 50,
    paddingBottom: 18,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  header1: {
    color: "#141414",
    fontSize: 17,
    fontWeight: "700",
  },
  // Body
  body: { flex: 1 },
  bodyContent: {
    padding: 20,
    paddingBottom: 60,
  },
  reg: {
    backgroundColor: "#65572a",
    borderRadius: 10,
    marginBottom: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  new: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
    letterSpacing: 0.5,
  },
  new1: {
    color: "#e6dcb8",
    fontSize: 12,
    marginTop: 2,
  },
  // Success banner
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#eaf6ec",
    borderWidth: 1,
    borderColor: "#bfe3c4",
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  successText: {
    flex: 1,
    fontSize: 13,
    color: "#1e5f28",
    lineHeight: 18,
  },
  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
    color: "#111111",
  },
  formGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    color: "#333333",
  },
  input: {
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#DDD",
    color: "#111111",
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 8,
    backgroundColor: "#F5F5F5",
  },
  picker: {
    height: 44,
    width: "100%",
  },
  note: {
    fontSize: 13,
    color: "#555555",
    marginBottom: 16,
    textAlign: "center",
  },
  registerButton: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: COLORS.gold,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 34,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#111111",
    fontWeight: "700",
    fontSize: 15,
  },
  // Bulk import header bar
  bulkHeaderBar: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: COLORS.dark,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.gold,
  },
  bulkIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#1e7e46",
    alignItems: "center",
    justifyContent: "center",
  },
  bulkHeaderTextWrap: { flex: 1 },
  bulkHeaderTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  bulkHeaderSubtitle: {
    color: "#B3B3B3",
    fontSize: 12,
    lineHeight: 17,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    padding: 18,
    marginBottom: 30,
  },
  cardTopFlush: { borderTopWidth: 0 },
  // Info callout
  infoCallout: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#fafaf5",
    borderWidth: 1,
    borderColor: "#efeadb",
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  infoIconBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.gold,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  infoTextWrap: { flex: 1 },
  infoTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#141414",
    marginBottom: 6,
  },
  infoBody: {
    fontSize: 13,
    color: "#555",
    lineHeight: 19,
  },
  infoBold: {
    fontWeight: "700",
    color: "#141414",
  },
  infoItalic: {
    fontStyle: "italic",
    color: "#555",
  },
  outlineButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    height: 46,
    marginBottom: 20,
  },
  outlineButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#141414",
  },
  // Drop zone
  dropZone: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#d9d9d9",
    borderRadius: 12,
    paddingVertical: 34,
    alignItems: "center",
    backgroundColor: "#fcfcfc",
  },
  dropZoneIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.dark,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  dropZoneTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#141414",
    marginBottom: 4,
  },
  dropZoneSubtitle: {
    fontSize: 12,
    color: "#8A8A8A",
    marginBottom: 16,
  },
  acceptedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  acceptedLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8A8A8A",
  },
  acceptedPill: {
    backgroundColor: COLORS.dark,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  acceptedPillText: {
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: "700",
  },
});