import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, FlatList,
  StyleSheet, ActivityIndicator, Alert, SafeAreaView, Modal
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Picker } from '@react-native-picker/picker';

const API_BASE = 'https://new-kanja-portal.onrender.com/api/send_results.php';

const GOLD = '#f0c040';
const GOLD_DIM = '#c9a030';
const BLACK = '#111111';
const DARK = '#1a1a1a';
const MID = '#2a2a2a';
const BG = '#f4f4f2';
const TEXT = '#1a1a18';
const SUBTEXT = '#5f5e5a';

export default function App() {
  const [screen, setScreen] = useState('form'); // form | preview | summary
  const [filters, setFilters] = useState({ grades: [], terms: [], years: [], examTypes: [] });
  const [grade, setGrade] = useState(0);
  const [term, setTerm] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [examType, setExamType] = useState('endterm');

  const [students, setStudents] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(false);

  const [template, setTemplate] = useState(
    "Dear Parent/Guardian, {student_name}'s {exam_type} results for {term} {year}, {grade_label}: {subjects}. Total: {total} Average: {average}. - Stephen Kanja School"
  );

  const [sendResult, setSendResult] = useState(null);

  // Load filter options on mount
  useEffect(() => {
    fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'filters' }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) setFilters(d);
      })
      .catch(e => console.log('filters err', e));
  }, []);

  const charLen = template.length;
  const segments = charLen <= 160 ? 1 : Math.ceil(charLen / 153);

  // ── Preview ──
  const preview = async () => {
    if (!grade || !term || !year || !examType) {
      Alert.alert('Missing filters', 'Please fill in grade, term, year and exam type.');
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preview', grade, term, year, examType }),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.error || 'Preview failed');
      setStudents(d.students);
      setSelectedIds(d.students.filter(s => s.hasPhone).map(s => s.student_id));
      setScreen('preview');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Send ──
  const send = async () => {
    if (selectedIds.length === 0) {
      Alert.alert('No recipients', 'Select at least one recipient.');
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          grade, term, year, examType,
          studentIds: selectedIds,
          messageTemplate: template,
        }),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.error || 'Send failed');
      setSendResult(d);
      setScreen('summary');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleStudent = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>STEPHEN KANJA</Text>
        <Text style={styles.headerSub}>Send Results via SMS</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {screen === 'form' && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>FILTER OPTIONS</Text>

              <Text style={styles.label}>Grade</Text>
              <View style={styles.pickerWrap}>
                <Picker selectedValue={grade} onValueChange={setGrade} style={styles.picker}>
                  <Picker.Item label="— Select —" value={0} />
                  {(filters.grades.length ? filters.grades : [1,2,3,4,5,6,7,8,9]).map(g => (
                    <Picker.Item key={g} label={`Grade ${g}`} value={g} />
                  ))}
                </Picker>
              </View>

              <Text style={styles.label}>Term</Text>
              <View style={styles.pickerWrap}>
                <Picker selectedValue={term} onValueChange={setTerm} style={styles.picker}>
                  <Picker.Item label="— Select —" value="" />
                  {(filters.terms.length ? filters.terms : ['1','2','3']).map(t => (
                    <Picker.Item key={t} label={`Term ${t}`} value={String(t)} />
                  ))}
                </Picker>
              </View>

              <Text style={styles.label}>Exam Type</Text>
              <View style={styles.pickerWrap}>
                <Picker selectedValue={examType} onValueChange={setExamType} style={styles.picker}>
                  {(filters.examTypes.length ? filters.examTypes : ['opener','midterm','endterm']).map(e => (
                    <Picker.Item key={e} label={e.charAt(0).toUpperCase() + e.slice(1)} value={e} />
                  ))}
                </Picker>
              </View>

              <Text style={styles.label}>Year</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={String(year)}
                onChangeText={t => setYear(parseInt(t) || 0)}
              />

              <TouchableOpacity style={styles.btnPrimary} onPress={preview} disabled={loading}>
                {loading ? <ActivityIndicator color={BLACK} /> : <Text style={styles.btnPrimaryText}>Preview Recipients</Text>}
              </TouchableOpacity>
            </View>
          </>
        )}

        {screen === 'preview' && (
          <>
            {/* Message Template */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>MESSAGE TEMPLATE</Text>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {['student_name','exam_type','term','year','grade_label','subjects','total','average'].map(tok => (
                    <TouchableOpacity
                      key={tok}
                      style={styles.tokenPill}
                      onPress={() => setTemplate(prev => prev + `{${tok}}`)}
                    >
                      <Text style={styles.tokenText}>{`{${tok}}`}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <TextInput
                style={styles.textarea}
                multiline
                value={template}
                onChangeText={setTemplate}
                textAlignVertical="top"
              />
              <Text style={[styles.charCount, segments > 1 && { color: '#dc2626' }]}>
                {charLen} characters · {segments} SMS segment{segments !== 1 ? 's' : ''}
              </Text>
            </View>

            {/* Recipients */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>RECIPIENTS</Text>
              <Text style={styles.subText}>
                {selectedIds.length} of {students.filter(s => s.hasPhone).length} eligible selected
              </Text>

              <FlatList
                data={students}
                keyExtractor={s => String(s.student_id)}
                scrollEnabled={false}
                renderItem={({ item }) => {
                  const disabled = !item.hasPhone;
                  const checked = selectedIds.includes(item.student_id);
                  return (
                    <TouchableOpacity
                      style={[styles.row, disabled && { opacity: 0.55 }]}
                      onPress={() => !disabled && toggleStudent(item.student_id)}
                      disabled={disabled}
                    >
                      <View style={[styles.checkbox, checked && styles.checkboxOn]}>
                        {checked && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowName}>{item.name}</Text>
                        <Text style={styles.rowPhone}>
                          {item.phone ? item.phone : 'No phone on file'}
                        </Text>
                        <Text style={styles.rowMarks} numberOfLines={2}>
                          {item.marks} · Total {item.total} · Avg {item.average}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />

              <TouchableOpacity style={styles.btnPrimary} onPress={send} disabled={loading}>
                {loading ? <ActivityIndicator color={BLACK} /> : <Text style={styles.btnPrimaryText}>Send SMS ({selectedIds.length})</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={styles.btnGhost} onPress={() => setScreen('form')}>
                <Text style={styles.btnGhostText}>← Back</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {screen === 'summary' && sendResult && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>SEND SUMMARY</Text>

            <View style={styles.statsRow}>
              <View style={[styles.statPill, { backgroundColor: 'rgba(22,163,74,0.1)' }]}>
                <Text style={[styles.statNum, { color: '#16a34a' }]}>{sendResult.sent}</Text>
                <Text style={styles.statLbl}>Sent</Text>
              </View>
              <View style={[styles.statPill, { backgroundColor: 'rgba(220,38,38,0.1)' }]}>
                <Text style={[styles.statNum, { color: '#dc2626' }]}>{sendResult.failed}</Text>
                <Text style={styles.statLbl}>Failed</Text>
              </View>
              <View style={[styles.statPill, { backgroundColor: 'rgba(0,0,0,0.05)' }]}>
                <Text style={[styles.statNum, { color: SUBTEXT }]}>{sendResult.skipped}</Text>
                <Text style={styles.statLbl}>Skipped</Text>
              </View>
            </View>

            {sendResult.details.map((d, i) => (
              <View key={i} style={styles.logRow}>
                <Text style={styles.logIcon}>
                  {d.status === 'sent' ? '✓' : d.status === 'failed' ? '✕' : '–'}
                </Text>
                <Text style={styles.logName}>{d.name}</Text>
                {d.phone ? <Text style={styles.logPhone}> ({d.phone})</Text> : null}
                {d.note ? <Text style={styles.logNote}> — {d.note}</Text> : null}
              </View>
            ))}

            <TouchableOpacity style={styles.btnPrimary} onPress={() => { setScreen('form'); setSendResult(null); setStudents([]); }}>
              <Text style={styles.btnPrimaryText}>New Send</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  header: { backgroundColor: BLACK, paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: 3, borderBottomColor: GOLD },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700', letterSpacing: 1.2 },
  headerSub: { color: GOLD, fontSize: 12, marginTop: 2, letterSpacing: 0.8 },

  body: { padding: 14, gap: 14 },

  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  cardTitle: { fontSize: 13, fontWeight: '700', letterSpacing: 1.2, color: TEXT, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: GOLD, paddingLeft: 8 },

  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, color: SUBTEXT, marginTop: 10, marginBottom: 4, textTransform: 'uppercase' },
  pickerWrap: { backgroundColor: '#f8f8f6', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)', overflow: 'hidden' },
  picker: { height: 48, color: TEXT },
  input: { backgroundColor: '#f8f8f6', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)', paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, color: TEXT },

  btnPrimary: { backgroundColor: GOLD, borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  btnPrimaryText: { color: BLACK, fontSize: 14, fontWeight: '700' },
  btnGhost: { paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  btnGhostText: { color: SUBTEXT, fontSize: 13, fontWeight: '600' },

  tokenPill: { backgroundColor: '#fffbea', borderWidth: 1, borderColor: GOLD, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  tokenText: { color: GOLD_DIM, fontSize: 11, fontWeight: '700' },

  textarea: { minHeight: 100, backgroundColor: '#f8f8f6', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)', padding: 12, fontSize: 13, color: TEXT, lineHeight: 19 },
  charCount: { fontSize: 11, color: SUBTEXT, marginTop: 6, textAlign: 'right' },

  subText: { fontSize: 12, color: SUBTEXT, marginBottom: 8 },

  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)', gap: 10 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: '#bbb', alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: GOLD, borderColor: GOLD_DIM },
  checkmark: { color: BLACK, fontWeight: '900', fontSize: 12 },
  rowName: { fontSize: 13, fontWeight: '700', color: TEXT },
  rowPhone: { fontSize: 11.5, color: SUBTEXT, marginTop: 1 },
  rowMarks: { fontSize: 11, color: SUBTEXT, marginTop: 2 },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  statPill: { flex: 1, borderRadius: 8, padding: 12, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '800' },
  statLbl: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: SUBTEXT, marginTop: 4, textTransform: 'uppercase' },

  logRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.04)', flexWrap: 'wrap' },
  logIcon: { fontSize: 14, marginRight: 8, fontWeight: '700' },
  logName: { fontSize: 12.5, fontWeight: '700', color: TEXT },
  logPhone: { fontSize: 11.5, color: SUBTEXT },
  logNote: { fontSize: 11, color: SUBTEXT, fontStyle: 'italic' },
});