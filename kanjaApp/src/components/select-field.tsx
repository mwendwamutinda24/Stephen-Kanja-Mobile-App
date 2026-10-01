import React, { useState } from 'react';
import { View, TouchableOpacity, Modal, StyleSheet, FlatList } from 'react-native';
import { ChevronDown, Check } from 'lucide-react-native';
import ThemedText from '@/components/themed-text';

export default function SelectField({
  label,
  placeholder,
  value,
  options,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string | null;
  options: string[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.wrapper}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <TouchableOpacity style={styles.select} onPress={() => setOpen(true)}>
        <ThemedText style={[styles.selectText, !value && styles.placeholder]}>
          {value ?? placeholder}
        </ThemedText>
        <ChevronDown size={18} color="#8A8A8A" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.dropdownCard}>
            <ThemedText style={styles.dropdownTitle}>{label}</ThemedText>
            <FlatList
              data={options}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.optionRow}
                  onPress={() => {
                    onChange(item);
                    setOpen(false);
                  }}
                >
                  <ThemedText style={styles.optionText}>{item}</ThemedText>
                  {value === item && <Check size={16} color="#E8B923" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#6f6f6f',
    marginBottom: 8,
  },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fafafa',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 46,
  },
  selectText: { color: '#141414', fontSize: 14 },
  placeholder: { color: '#9a9a9a' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  dropdownCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 8,
    maxHeight: 320,
  },
  dropdownTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8A8A8A',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  optionText: { fontSize: 14, color: '#141414' },
});