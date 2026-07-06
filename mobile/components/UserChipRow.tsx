import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { User } from '../lib/types';
import { Colors } from '../lib/theme';

interface UserChipRowProps {
  users: User[];
  selectedIds: number[];
  onToggle: (userId: number) => void;
}

/** Row of per-user selection chips (avatar color when selected, short_name label). */
export function UserChipRow({ users, selectedIds, onToggle }: UserChipRowProps) {
  return (
    <View style={styles.row}>
      {users.map(user => {
        const selected = selectedIds.includes(user.id);
        return (
          <TouchableOpacity
            key={user.id}
            style={[styles.chip, selected && { backgroundColor: user.avatar_color, borderColor: user.avatar_color }]}
            onPress={() => onToggle(user.id)}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{user.short_name}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  chipText: { fontSize: 14, color: '#555', fontWeight: '600' },
  chipTextSelected: { color: '#fff' },
});
