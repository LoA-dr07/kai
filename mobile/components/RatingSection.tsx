import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Tooltip } from './Tooltip';
import type { User } from '../lib/types';

export const RATING_LABELS: Record<number, string> = {
  0: 'Nie',
  1: 'Selten',
  2: 'Gelegentlich',
  3: 'Gerne',
  4: 'Häufig',
  5: 'Sehr häufig',
};

interface RatingSectionProps {
  users: User[];
  /** userId → stars. Key absent = Keine Bewertung; value 0 = Nie; value 1–5 = Sterne */
  ratings: Record<number, number>;
  /** stars === undefined → Bewertung entfernen (Keine Bewertung) */
  onRate: (userId: number, stars: number | undefined) => void;
}

export function RatingSection({ users, ratings, onRate }: RatingSectionProps) {
  return (
    <View>
      {users.map(user => {
        const stars = ratings[user.id];        // undefined wenn nicht gesetzt
        const hasRating = user.id in ratings;  // explizit gesetzt (inkl. 0 = Nie)
        const label = hasRating ? RATING_LABELS[stars!] : null;

        return (
          <View key={user.id} style={styles.starRow}>
            <View style={[styles.avatarBadge, { backgroundColor: user.avatar_color }]}>
              <Text style={styles.avatarText}>{user.short_name}</Text>
            </View>
            <Text style={styles.userName}>{user.name}</Text>
            <View style={styles.starsWrapper}>
              <View style={styles.starsContainer}>
                <Tooltip label="Nie – dieses Rezept koche ich nie">
                  <TouchableOpacity
                    onPress={() => onRate(user.id, 0)}
                    hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                  >
                    <Text style={[styles.nieBtn, hasRating && stars === 0 && styles.nieBtnActive]}>Nie</Text>
                  </TouchableOpacity>
                </Tooltip>
                {[1, 2, 3, 4, 5].map(n => (
                  <Tooltip key={n} label={`${n} ${n === 1 ? 'Stern' : 'Sterne'}`}>
                    <TouchableOpacity
                      onPress={() => onRate(user.id, n)}
                      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                    >
                      <Text style={[styles.star, hasRating && n <= (stars ?? 0) && (stars ?? 0) > 0 && styles.starFilled]}>
                        {hasRating && n <= (stars ?? 0) && (stars ?? 0) > 0 ? '★' : '☆'}
                      </Text>
                    </TouchableOpacity>
                  </Tooltip>
                ))}
                {hasRating && (
                  <Tooltip label="Bewertung entfernen (Keine Bewertung)">
                    <TouchableOpacity
                      onPress={() => onRate(user.id, undefined)}
                      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                    >
                      <Text style={styles.resetBtn}>✕</Text>
                    </TouchableOpacity>
                  </Tooltip>
                )}
              </View>
              {label !== null && (
                <Text style={[styles.ratingLabel, stars === 0 && styles.ratingLabelNever]}>
                  {label}
                </Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  avatarText: { fontSize: 11, color: '#fff', fontWeight: '700' },
  userName: { fontSize: 14, color: '#1A1A1A', flex: 1 },
  starsWrapper: { flexDirection: 'column', alignItems: 'flex-end' },
  starsContainer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  star: { fontSize: 22, color: '#DDD' },
  starFilled: { color: '#FFC107' },
  nieBtn: { fontSize: 12, color: '#CCC', fontWeight: '700', marginRight: 2 },
  nieBtnActive: { color: '#C62828' },
  resetBtn: { fontSize: 13, color: '#C62828', fontWeight: '700', marginLeft: 4 },
  ratingLabel: { fontSize: 10, color: '#888', marginTop: 2 },
  ratingLabelNever: { color: '#C62828', fontWeight: '600' },
});
