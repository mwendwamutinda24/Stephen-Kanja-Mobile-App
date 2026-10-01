import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
  Linking,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import ThemedView from "@/components/themed-view";

// TODO: point this at your InfinityFree PHP backend
const API_BASE_URL = "https://stephenkanjaportal.infinityfreeapp.com/api";

const GOLD = "#D4A017";
const DARK = "#14151A";
const CARD_BG = "#FFFFFF";
const PAGE_BG = "#F2EFEA";
const LABEL_GRAY = "#8A8F98";
const BORDER = "#E5E3DE";

const GRADES = ["Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9"];
const TERMS = ["Term 1", "Term 2", "Term 3"];
const SUBJECTS = ["Mathematics", "English", "Kiswahili", "Science & Technology", "Social Studies", "CRE", "Agriculture", "Creative Arts"];
const MATERIAL_TYPES = ["Notes", "Past Paper", "Assignment", "Scheme of Work", "Lesson Plan", "Video", "Other"];

type PickedFile = {
  name: string;
  uri: string;
  size?: number;
  mimeType?: string;
};

type MaterialItem = {
  id: number;
  title: string;
  uploadedBy: string;
  subject: string;
  grade: string;
  term: string;
  type: string;
  tags?: string;
  description?: string;
  fileName: string;
  fileSizeLabel: string;
  fileExt: string;
  downloads: number;
  createdAt: string;
  fileUrl: string;
};

type SubjectCount = { subject: string; count: number };

function extIcon(ext: string) {
  const e = ext.toLowerCase();
  if (e === "pdf") return { icon: "file-pdf-box" as const, color: "#E5484D" };
  if (["doc", "docx"].includes(e)) return { icon: "file-word-box" as const, color: "#2B579A" };
  if (["ppt", "pptx"].includes(e)) return { icon: "file-powerpoint-box" as const, color: "#D24726" };
  if (["png", "jpg", "jpeg"].includes(e)) return { icon: "file-image" as const, color: "#E5484D" };
  if (e === "zip") return { icon: "folder-zip" as const, color: "#8A8F98" };
  if (["mp4", "mov"].includes(e)) return { icon: "file-video" as const, color: "#7C3AED" };
  return { icon: "file-outline" as const, color: LABEL_GRAY };
}

export default function LearningMaterials() {
  // Upload form state
  const [file, setFile] = useState<PickedFile | null>(null);
  const [title, setTitle] = useState("");
  const [uploadedBy, setUploadedBy] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [term, setTerm] = useState("");
  const [materialType, setMaterialType] = useState("");
  const [tags, setTags] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Library state
  const [recent, setRecent] = useState<MaterialItem[]>([]);
  const [subjectCounts, setSubjectCounts] = useState<SubjectCount[]>([]);
  const [libraryItems, setLibraryItems] = useState<MaterialItem[]>([]);
  const [totalFound, setTotalFound] = useState(0);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [filterGrade, setFilterGrade] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterTerm, setFilterTerm] = useState("");
  const [filterType, setFilterType] = useState("");

  const parseJsonSafely = async (res: Response) => {
    const text = await res.text();
    const objStart = text.indexOf("{");
    const arrStart = text.indexOf("[");
    const start = objStart === -1 ? arrStart : arrStart === -1 ? objStart : Math.min(objStart, arrStart);
    return JSON.parse(start >= 0 ? text.slice(start) : text);
  };

  const fetchOverview = useCallback(async () => {
    try {
      // PHP endpoint: materials_overview.php -> { recent: [...], subjectCounts: [...] }
      const res = await fetch(`${API_BASE_URL}/materials_overview.php`);
      const data = await parseJsonSafely(res);
      setRecent(data.recent ?? []);
      setSubjectCounts(data.subjectCounts ?? []);
    } catch (err) {
      // Non-fatal — overview sections just stay empty
      console.warn("Failed to load overview:", err);
    }
  }, []);

  const fetchLibrary = useCallback(async () => {
    setLibraryLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (filterGrade) params.append("grade", filterGrade);
      if (filterSubject) params.append("subject", filterSubject);
      if (filterTerm) params.append("term", filterTerm);
      if (filterType) params.append("type", filterType);

      // PHP endpoint: list_materials.php?search=&grade=&subject=&term=&type=
      const res = await fetch(`${API_BASE_URL}/list_materials.php?${params.toString()}`);
      const data = await parseJsonSafely(res);
      setLibraryItems(data.items ?? []);
      setTotalFound(data.total ?? (data.items ?? []).length);
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to load materials library.");
    } finally {
      setLibraryLoading(false);
      setInitialLoading(false);
    }
  }, [search, filterGrade, filterSubject, filterTerm, filterType]);

  useEffect(() => {
    fetchOverview();
    fetchLibrary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.ms-powerpoint",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          "image/*",
          "video/*",
          "application/zip",
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];

      if (asset.size && asset.size > 50 * 1024 * 1024) {
        Alert.alert("File too large", "Max file size is 50 MB.");
        return;
      }

      setFile({
        name: asset.name,
        uri: asset.uri,
        size: asset.size,
        mimeType: asset.mimeType,
      });
      setUploadError(null);
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to pick file.");
    }
  };

  const resetForm = () => {
    setFile(null);
    setTitle("");
    setUploadedBy("");
    setSubject("");
    setGrade("");
    setTerm("");
    setMaterialType("");
    setTags("");
    setDescription("");
  };

  const submitUpload = async () => {
    if (!file) {
      setUploadError("Please attach a file first.");
      return;
    }
    if (!title || !uploadedBy || !subject || !grade || !term) {
      setUploadError("Please fill in all required (*) fields.");
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", {
        uri: file.uri,
        name: file.name,
        type: file.mimeType ?? "application/octet-stream",
      } as any);
      formData.append("title", title);
      formData.append("uploaded_by", uploadedBy);
      formData.append("subject", subject);
      formData.append("grade", grade);
      formData.append("term", term);
      formData.append("type", materialType);
      formData.append("tags", tags);
      formData.append("description", description);

      // PHP endpoint: upload_material.php — expects multipart/form-data
      const res = await fetch(`${API_BASE_URL}/upload_material.php`, {
        method: "POST",
        headers: { "Content-Type": "multipart/form-data" },
        body: formData,
      });

      const data = await parseJsonSafely(res);
      if (data.error) throw new Error(data.error);

      Alert.alert("Success", "Material uploaded successfully.");
      resetForm();
      fetchOverview();
      fetchLibrary();
    } catch (err: any) {
      setUploadError(err?.message ?? "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = (item: MaterialItem) => {
    Linking.openURL(item.fileUrl).catch(() =>
      Alert.alert("Error", "Could not open the file link.")
    );
  };

  const handlePreview = (item: MaterialItem) => {
    Linking.openURL(item.fileUrl).catch(() =>
      Alert.alert("Error", "Could not open preview.")
    );
  };

  const handleDelete = (item: MaterialItem) => {
    Alert.alert("Delete material", `Delete "${item.title}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            // PHP endpoint: delete_material.php?id=
            const res = await fetch(`${API_BASE_URL}/delete_material.php?id=${item.id}`, {
              method: "POST",
            });
            const data = await parseJsonSafely(res);
            if (data.error) throw new Error(data.error);
            fetchOverview();
            fetchLibrary();
          } catch (err: any) {
            Alert.alert("Error", err?.message ?? "Failed to delete material.");
          }
        },
      },
    ]);
  };

  return (
    <ThemedView style={{ flex: 1, backgroundColor: PAGE_BG }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton}>
          <Ionicons name="menu" size={20} color={DARK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          STEPHEN KANJA <Text style={{ color: GOLD }}>SCHOOL</Text>
        </Text>
      </View>

      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>ACADEMIC RESOURCES</Text>
        <Text style={styles.heroTitle}>
          LEARNING <Text style={{ color: GOLD }}>MATERIALS</Text>
        </Text>
        <Text style={styles.heroTitle}>LIBRARY</Text>
        <Text style={styles.heroSubtitle}>
          Upload, organise and access teaching &amp; learning resources across all grades and subjects.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Section: Upload New Material */}
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="cloud-upload-outline" size={16} color={GOLD} />
          <Text style={styles.sectionHeaderText}>UPLOAD NEW MATERIAL</Text>
          <View style={styles.sectionHeaderLine} />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderText}>◆ ADD A LEARNING RESOURCE</Text>
          </View>
          <View style={styles.cardBody}>
            <TouchableOpacity style={styles.dropZone} onPress={pickFile}>
              <View style={styles.dropZoneIcon}>
                <Ionicons name="cloud-upload" size={22} color="#fff" />
              </View>
              {file ? (
                <>
                  <Text style={styles.dropZoneTitle}>{file.name}</Text>
                  <Text style={styles.dropZoneSubtitle}>
                    {file.size ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : ""} · tap to change file
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.dropZoneTitle}>Drag &amp; Drop your file here</Text>
                  <Text style={styles.dropZoneSubtitle}>
                    or <Text style={{ color: GOLD, fontWeight: "700" }}>click to browse</Text> · PDF, DOC, PPT, Images,
                    Video, ZIP supported · Max 50 MB
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.filterLabel}>
              TITLE <Text style={{ color: "#D9534F" }}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Grade 5 Mathematics — Fractions Notes"
              placeholderTextColor="#A9ADB3"
              value={title}
              onChangeText={setTitle}
            />

            <Text style={[styles.filterLabel, { marginTop: 14 }]}>
              UPLOADED BY <Text style={{ color: "#D9534F" }}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Teacher / Staff name"
              placeholderTextColor="#A9ADB3"
              value={uploadedBy}
              onChangeText={setUploadedBy}
            />

            <Text style={[styles.filterLabel, { marginTop: 14 }]}>
              SUBJECT <Text style={{ color: "#D9534F" }}>*</Text>
            </Text>
            <View style={styles.selectBox}>
              <Picker selectedValue={subject} onValueChange={setSubject} style={styles.picker}>
                <Picker.Item label="— Select Subject —" value="" />
                {SUBJECTS.map((s) => (
                  <Picker.Item key={s} label={s} value={s} />
                ))}
              </Picker>
            </View>

            <Text style={[styles.filterLabel, { marginTop: 14 }]}>
              GRADE <Text style={{ color: "#D9534F" }}>*</Text>
            </Text>
            <View style={styles.selectBox}>
              <Picker selectedValue={grade} onValueChange={setGrade} style={styles.picker}>
                <Picker.Item label="— Select Grade —" value="" />
                {GRADES.map((g) => (
                  <Picker.Item key={g} label={g} value={g} />
                ))}
              </Picker>
            </View>

            <Text style={[styles.filterLabel, { marginTop: 14 }]}>
              TERM <Text style={{ color: "#D9534F" }}>*</Text>
            </Text>
            <View style={styles.selectBox}>
              <Picker selectedValue={term} onValueChange={setTerm} style={styles.picker}>
                <Picker.Item label="— Select Term —" value="" />
                {TERMS.map((t) => (
                  <Picker.Item key={t} label={t} value={t} />
                ))}
              </Picker>
            </View>

            <Text style={[styles.filterLabel, { marginTop: 14 }]}>MATERIAL TYPE</Text>
            <View style={styles.selectBox}>
              <Picker selectedValue={materialType} onValueChange={setMaterialType} style={styles.picker}>
                <Picker.Item label="— Select Type —" value="" />
                {MATERIAL_TYPES.map((t) => (
                  <Picker.Item key={t} label={t} value={t} />
                ))}
              </Picker>
            </View>

            <Text style={[styles.filterLabel, { marginTop: 14 }]}>TAGS (comma-separated, optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. fractions, multiplication, term1, revision"
              placeholderTextColor="#A9ADB3"
              value={tags}
              onChangeText={setTags}
            />

            <Text style={[styles.filterLabel, { marginTop: 14 }]}>DESCRIPTION</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Brief description of what this material covers..."
              placeholderTextColor="#A9ADB3"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            {uploadError && (
              <Text style={{ color: "#D9534F", fontSize: 12, marginTop: 12 }}>{uploadError}</Text>
            )}

            <TouchableOpacity style={styles.actionButton} onPress={submitUpload} disabled={uploading}>
              {uploading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={16} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.actionButtonText}>Upload Material</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.secureNote}>
              <Ionicons name="shield-checkmark-outline" size={14} color={GOLD} />
              <Text style={styles.secureNoteText}>Files are stored securely on the school server.</Text>
            </View>
          </View>
        </View>

        {/* Recently Added */}
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="time-outline" size={16} color={GOLD} />
          <Text style={styles.sectionHeaderText}>RECENTLY ADDED</Text>
          <View style={styles.sectionHeaderLine} />
        </View>

        {recent.length === 0 ? (
          <Text style={styles.mutedText}>No materials uploaded yet.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
            {recent.map((item) => {
              const { icon, color } = extIcon(item.fileExt);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.recentCard}
                  onPress={() => handlePreview(item)}
                >
                  <View style={[styles.recentIconWrap, { backgroundColor: `${color}1A` }]}>
                    <MaterialCommunityIcons name={icon} size={26} color={color} />
                  </View>
                  <Text style={styles.recentTitle} numberOfLines={1}>
                    {item.grade}
                  </Text>
                  <Text style={styles.recentMeta} numberOfLines={1}>
                    {item.subject} · {item.grade} · {item.createdAt}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Materials by Subject */}
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="layers-outline" size={16} color={GOLD} />
          <Text style={styles.sectionHeaderText}>MATERIALS BY SUBJECT</Text>
          <View style={styles.sectionHeaderLine} />
        </View>

        <View style={styles.statsRow}>
          {subjectCounts.length === 0 ? (
            <Text style={styles.mutedText}>No subject data yet.</Text>
          ) : (
            subjectCounts.map((s) => (
              <TouchableOpacity
                key={s.subject}
                style={styles.statCard}
                onPress={() => setFilterSubject(s.subject)}
              >
                <Text style={styles.statNumber}>{s.count}</Text>
                <Text style={styles.statLabel}>{s.subject.toUpperCase()}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Materials Library */}
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="library-outline" size={16} color={GOLD} />
          <Text style={styles.sectionHeaderText}>MATERIALS LIBRARY</Text>
          <View style={styles.foundBadge}>
            <Text style={styles.foundBadgeText}>{totalFound} FOUND</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardBody}>
            <Text style={styles.filterLabel}>SEARCH</Text>
            <TextInput
              style={styles.input}
              placeholder="Title, tag, uploader..."
              placeholderTextColor="#A9ADB3"
              value={search}
              onChangeText={setSearch}
            />

            <Text style={[styles.filterLabel, { marginTop: 14 }]}>GRADE</Text>
            <View style={styles.selectBox}>
              <Picker selectedValue={filterGrade} onValueChange={setFilterGrade} style={styles.picker}>
                <Picker.Item label="All Grades" value="" />
                {GRADES.map((g) => (
                  <Picker.Item key={g} label={g} value={g} />
                ))}
              </Picker>
            </View>

            <Text style={[styles.filterLabel, { marginTop: 14 }]}>SUBJECT</Text>
            <View style={styles.selectBox}>
              <Picker selectedValue={filterSubject} onValueChange={setFilterSubject} style={styles.picker}>
                <Picker.Item label="All Subjects" value="" />
                {SUBJECTS.map((s) => (
                  <Picker.Item key={s} label={s} value={s} />
                ))}
              </Picker>
            </View>

            <Text style={[styles.filterLabel, { marginTop: 14 }]}>TERM</Text>
            <View style={styles.selectBox}>
              <Picker selectedValue={filterTerm} onValueChange={setFilterTerm} style={styles.picker}>
                <Picker.Item label="All Terms" value="" />
                {TERMS.map((t) => (
                  <Picker.Item key={t} label={t} value={t} />
                ))}
              </Picker>
            </View>

            <Text style={[styles.filterLabel, { marginTop: 14 }]}>TYPE</Text>
            <View style={styles.selectBox}>
              <Picker selectedValue={filterType} onValueChange={setFilterType} style={styles.picker}>
                <Picker.Item label="All Types" value="" />
                {MATERIAL_TYPES.map((t) => (
                  <Picker.Item key={t} label={t} value={t} />
                ))}
              </Picker>
            </View>

            <TouchableOpacity style={styles.actionButton} onPress={fetchLibrary} disabled={libraryLoading}>
              {libraryLoading ? (
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

        {/* Library results */}
        {initialLoading ? (
          <ActivityIndicator color={GOLD} style={{ marginTop: 20 }} />
        ) : libraryItems.length === 0 ? (
          <View style={[styles.card, { alignItems: "center", padding: 24 }]}>
            <Ionicons name="folder-open-outline" size={36} color={GOLD} />
            <Text style={styles.mutedText}>No materials found for these filters.</Text>
          </View>
        ) : (
          libraryItems.map((item) => {
            const { icon, color } = extIcon(item.fileExt);
            return (
              <View key={item.id} style={[styles.materialCard, { borderTopColor: color }]}>
                <View style={styles.materialTopRow}>
                  <View style={[styles.materialIconWrap, { backgroundColor: `${color}1A` }]}>
                    <MaterialCommunityIcons name={icon} size={24} color={color} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.materialTitle}>{item.title}</Text>
                    <View style={styles.tagRow}>
                      <View style={styles.tagChip}>
                        <Text style={styles.tagChipText}>{item.grade}</Text>
                      </View>
                      <View style={[styles.tagChip, { backgroundColor: "#FDF3D9" }]}>
                        <Text style={[styles.tagChipText, { color: "#8A6D00" }]}>{item.subject}</Text>
                      </View>
                      <View style={[styles.tagChip, { backgroundColor: "#E3EEFD" }]}>
                        <Text style={[styles.tagChipText, { color: "#1D4E89" }]}>{item.term}</Text>
                      </View>
                      {item.type ? (
                        <View style={[styles.tagChip, { backgroundColor: "#FBE3EA" }]}>
                          <Text style={[styles.tagChipText, { color: "#A32656" }]}>{item.type}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>

                <View style={styles.materialMetaRow}>
                  <View style={styles.uploaderAvatar}>
                    <Ionicons name="person" size={12} color="#fff" />
                  </View>
                  <Text style={styles.materialUploader}>{item.uploadedBy}</Text>
                  <View style={{ flex: 1 }} />
                  <Text style={styles.materialMetaText}>{item.fileSizeLabel}</Text>
                  <Ionicons name="download-outline" size={14} color={LABEL_GRAY} style={{ marginLeft: 10 }} />
                  <Text style={styles.materialMetaText}>{item.downloads}</Text>
                </View>

                <Text style={styles.materialDate}>{item.createdAt}</Text>

                <View style={styles.materialActionsRow}>
                  <TouchableOpacity style={styles.downloadButton} onPress={() => handleDownload(item)}>
                    <Ionicons name="download-outline" size={15} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.downloadButtonText}>Download</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.previewButton} onPress={() => handlePreview(item)}>
                    <Ionicons name="eye-outline" size={15} color={DARK} style={{ marginRight: 6 }} />
                    <Text style={styles.previewButtonText}>Preview</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item)}>
                    <Ionicons name="trash-outline" size={15} color="#D9534F" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
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
  headerTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  hero: {
    backgroundColor: DARK,
    paddingHorizontal: 16,
    paddingBottom: 22,
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
    lineHeight: 30,
  },
  heroSubtitle: {
    color: "#9AA0A8",
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 10,
    lineHeight: 18,
  },
  content: {
    padding: 16,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 14,
  },
  sectionHeaderText: {
    fontSize: 15,
    fontWeight: "900",
    color: DARK,
    marginLeft: 8,
    letterSpacing: 0.3,
  },
  sectionHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: BORDER,
    marginLeft: 12,
  },
  foundBadge: {
    backgroundColor: DARK,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 10,
  },
  foundBadgeText: {
    color: GOLD,
    fontSize: 10,
    fontWeight: "800",
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    marginBottom: 24,
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
  dropZone: {
    borderWidth: 1.5,
    borderColor: BORDER,
    borderStyle: "dashed",
    borderRadius: 14,
    backgroundColor: "#FBFAF8",
    paddingVertical: 32,
    alignItems: "center",
    marginBottom: 20,
  },
  dropZoneIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: DARK,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  dropZoneTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: DARK,
  },
  dropZoneSubtitle: {
    fontSize: 12,
    color: LABEL_GRAY,
    textAlign: "center",
    marginTop: 6,
    paddingHorizontal: 20,
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
    borderColor: BORDER,
    borderRadius: 10,
    backgroundColor: "#FBFAF8",
    paddingHorizontal: 14,
    height: 44,
    color: DARK,
    fontSize: 14,
  },
  textArea: {
    height: 90,
    paddingTop: 12,
  },
  selectBox: {
    borderWidth: 1,
    borderColor: BORDER,
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
  secureNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  secureNoteText: {
    fontSize: 11,
    color: LABEL_GRAY,
    marginLeft: 6,
  },
  mutedText: {
    color: LABEL_GRAY,
    fontSize: 13,
    marginBottom: 20,
  },
  recentCard: {
    width: 150,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 14,
    marginRight: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  recentIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  recentTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: DARK,
  },
  recentMeta: {
    fontSize: 10,
    color: LABEL_GRAY,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flexGrow: 1,
    minWidth: "45%",
    backgroundColor: CARD_BG,
    borderRadius: 14,
    paddingVertical: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  statNumber: {
    fontSize: 26,
    fontWeight: "900",
    color: DARK,
  },
  statLabel: {
    fontSize: 10,
    letterSpacing: 0.5,
    color: LABEL_GRAY,
    fontWeight: "700",
    marginTop: 4,
    textAlign: "center",
  },
  materialCard: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderTopWidth: 3,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  materialTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  materialIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  materialTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: DARK,
    marginBottom: 6,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tagChip: {
    backgroundColor: "#EDECE8",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagChipText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#555",
  },
  materialMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
  },
  uploaderAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: DARK,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  materialUploader: {
    fontSize: 12,
    color: LABEL_GRAY,
    fontWeight: "600",
  },
  materialMetaText: {
    fontSize: 11,
    color: LABEL_GRAY,
    marginLeft: 4,
  },
  materialDate: {
    fontSize: 10,
    color: "#B5B9C0",
    marginTop: 4,
  },
  materialActionsRow: {
    flexDirection: "row",
    marginTop: 14,
    gap: 8,
  },
  downloadButton: {
    flex: 1,
    backgroundColor: DARK,
    borderRadius: 10,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  downloadButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  previewButton: {
    flex: 1,
    backgroundColor: "#F2EFEA",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  previewButtonText: {
    color: DARK,
    fontWeight: "700",
    fontSize: 12,
  },
  deleteButton: {
    width: 42,
    borderWidth: 1,
    borderColor: "#F3D5D5",
    backgroundColor: "#FDF2F2",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});