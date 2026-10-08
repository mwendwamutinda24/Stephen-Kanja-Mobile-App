import { useState, useRef } from "react";
import ThemedText from "@/components/themed-text";
import ThemedView from "@/components/themed-view";
import { Picker } from "@react-native-picker/picker";
import { GraduationCap } from "lucide-react-native";
import {
  View,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { apiRequest, ApiError } from "@/services/api/client"; // <-- adjust if this lives elsewhere

type Status = { type: "success" | "error"; text: string } | null;

export default function RegisterTeacher() {
  // ---- Form state ----
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [tsc, setTsc] = useState("");
  const [role, setRole] = useState("");
  const [subject, setSubject] = useState("");
  const [classTeacherFor, setClassTeacherFor] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const scrollRef = useRef<ScrollView>(null);

  const showStatus = (type: "success" | "error", text: string) => {
    setStatus({ type, text });
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const clearForm = () => {
    setName("");
    setEmail("");
    setPhone("");
    setTsc("");
    setRole("");
    setSubject("");
    setClassTeacherFor("");
  };

  const handleClear = () => {
    clearForm();
    setStatus(null);
  };

  const handleRegister = async () => {
    setStatus(null);

    if (name.trim() === "" || email.trim() === "" || phone.trim() === "" || role.trim() === "") {
      showStatus("error", "Full name, email, phone and role are required.");
      return;
    }

    setSubmitting(true);
    try {
      const data = await apiRequest<{ teacherId: number; name: string }>(
        "/register_teacher.php",
        {
          method: "POST",
          body: {
            name,
            email,
            phone,
            tsc,
            role,
            grade: classTeacherFor,
            subject,
          },
        }
      );
      showStatus("success", `${data.name} was registered successfully.`);
      clearForm();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Something went wrong. Please try again.";
      showStatus("error", `Registration failed: ${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView ref={scrollRef} style={styles.page} showsVerticalScrollIndicator={false}>
      {/* Top Header */}
      <ThemedView style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.logoBadge}>
            <GraduationCap size={20} color="#111111" />
          </View>
          <View>
            <ThemedText style={styles.header1}>
              Stephen Kanja{" "}
              <ThemedText style={styles.headerAccent}>School</ThemedText>
            </ThemedText>
            <ThemedText style={styles.header2}>Aim Higher</ThemedText>
          </View>
        </View>
      </ThemedView>

      {/* Form Section */}
      <ThemedView style={styles.formCard}>
        <ThemedText style={styles.formTitle}>Teacher Details</ThemedText>

        {/* Success / Error banner */}
        {status && (
          <View
            style={[
              styles.statusBox,
              status.type === "success" ? styles.statusSuccess : styles.statusError,
            ]}
          >
            <ThemedText
              style={[
                styles.statusText,
                status.type === "success" ? styles.statusTextSuccess : styles.statusTextError,
              ]}
            >
              {status.type === "success" ? "✓ " : "✕ "}
              {status.text}
            </ThemedText>
            <TouchableOpacity onPress={() => setStatus(null)}>
              <ThemedText style={styles.statusClose}>✕</ThemedText>
            </TouchableOpacity>
          </View>
        )}

        {/* Personal Information */}
        <View style={styles.formGroup}>
          <ThemedText style={styles.label}>Full Name ✦</ThemedText>
          <TextInput
            style={styles.input}
            placeholder="e.g. Jane Wanjiku Mwangi"
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={styles.formGroup}>
          <ThemedText style={styles.label}>Email Address ✦</ThemedText>
          <TextInput
            style={styles.input}
            placeholder="e.g. jane@school.ac.ke"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <View style={styles.formGroup}>
          <ThemedText style={styles.label}>Phone Number ✦</ThemedText>
          <TextInput
            style={styles.input}
            placeholder="e.g. 07XX XXX XXX"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
        </View>

        {/* Professional Details */}
        <View style={styles.formGroup}>
          <ThemedText style={styles.label}>TSC Number (Optional)</ThemedText>
          <TextInput
            style={styles.input}
            placeholder="e.g. 0123456"
            keyboardType="numeric"
            value={tsc}
            onChangeText={setTsc}
          />
        </View>

        <View style={styles.formGroup}>
          <ThemedText style={styles.label}>Role / Designation ✦</ThemedText>
          <View style={styles.pickerWrapper}>
            <Picker style={styles.picker} selectedValue={role} onValueChange={setRole}>
              <Picker.Item label="— Select Role —" value="" />
              <Picker.Item label="Head of instituion" value="hoi" />
              <Picker.Item label="Deputy head of instituion" value="Dhoi" />
              <Picker.Item label="Senior Teacher" value="Senior" />
              <Picker.Item label="Teacher" value="teacher" />
            </Picker>
          </View>
        </View>

        <View style={styles.formGroup}>
          <ThemedText style={styles.label}>Subject of Profession (Optional)</ThemedText>
          <TextInput
            style={styles.input}
            placeholder="e.g. Mathematics"
            value={subject}
            onChangeText={setSubject}
          />
        </View>

        <View style={styles.formGroup}>
          <ThemedText style={styles.label}>Class Teacher For (Optional)</ThemedText>
          <View style={styles.pickerWrapper}>
            <Picker
              style={styles.picker}
              selectedValue={classTeacherFor}
              onValueChange={setClassTeacherFor}
            >
              <Picker.Item label="— Select Grade  —" value="" />
              <Picker.Item label="Grade 1" value="grade1" />
              <Picker.Item label="Grade 2" value="grade2" />
              <Picker.Item label="Grade 3" value="grade3" />
              <Picker.Item label="Grade 4" value="grade4" />
              <Picker.Item label="Grade 5" value="grade5" />
              <Picker.Item label="Grade 6" value="grade6" />
              <Picker.Item label="Grade 7" value="grade7" />
              <Picker.Item label="Grade 8" value="grade8" />
              <Picker.Item label="Grade 9" value="grade9" />
            </Picker>
          </View>
        </View>

        {/* Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.clearButton} onPress={handleClear} disabled={submitting}>
            <ThemedText style={styles.buttonText}>Clear Form</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.registerButton, submitting && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <ThemedText style={styles.buttonText}>Register Teacher</ThemedText>
            )}
          </TouchableOpacity>
        </View>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#FFFDD0", // cream background
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  header: {
    backgroundColor: "transparent",
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#E8B923",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 6,
    backgroundColor: "#F5F5F5",
  },
  picker: {
    height: 44,
    width: "100%",
  },
  header1: {
    color: "#111111",
    fontSize: 17,
    fontWeight: "700",
  },
  headerAccent: {
    color: "#E8B923",
  },
  header2: {
    color: "#555555",
    fontSize: 11,
    letterSpacing: 1,
    marginTop: 2,
  },
  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 16,
    marginTop: 20,
    marginBottom: 30,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
    color: "#111111",
  },
  statusBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 16,
  },
  statusSuccess: {
    backgroundColor: "#E6F4EA",
    borderColor: "#34A853",
  },
  statusError: {
    backgroundColor: "#FDECEA",
    borderColor: "#D93025",
  },
  statusText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },
  statusTextSuccess: {
    color: "#1E7B34",
  },
  statusTextError: {
    color: "#B3261E",
  },
  statusClose: {
    marginLeft: 10,
    fontSize: 16,
    color: "#555555",
  },
  formGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
    color: "#333333",
  },
  input: {
    backgroundColor: "#F5F5F5",
    borderRadius: 6,
    padding: 12,
    borderWidth: 1,
    borderColor: "#DDD",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  clearButton: {
    backgroundColor: "#8A8A8A",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 6,
  },
  registerButton: {
    backgroundColor: "#E8B923",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 6,
    minWidth: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});