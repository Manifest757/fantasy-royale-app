import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/colors';
import { UserContest } from '@/data/mockData';

interface UserContestCardProps {
  contest: UserContest;
}

export function UserContestCard({ contest }: UserContestCardProps) {
  const { colors } = useTheme();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live': return Colors.success;
      case 'pending':
      case 'entered': return Colors.warning;
      case 'completed': return colors.textMuted;
      default: return colors.textMuted;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'live': return 'radio-button-on';
      case 'pending': return 'time-outline';
      case 'completed': return 'checkmark-circle';
      default: return 'help-circle';
    }
  };

  return (
    <Pressable onPress={() => router.push(`/contest/${contest.contestId}`)} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.header}>
          <View style={styles.statusBadge}>
            <Ionicons
              name={getStatusIcon(contest.status) as any}
              size={12}
              color={getStatusColor(contest.status)}
            />
            <Text style={[styles.statusText, { color: getStatusColor(contest.status) }]}>
              {contest.status === 'pending' ? 'ENTERED' : contest.status.toUpperCase()}
            </Text>
          </View>
          {contest.position && (
            <View style={styles.position}>
              <Text style={[styles.positionText, { color: colors.textSecondary }]}>#{contest.position}</Text>
            </View>
          )}
        </View>

        <Text style={[styles.title, { color: colors.text }]}>{contest.contestTitle}</Text>
        <Text style={[styles.sponsor, { color: colors.textMuted }]}>{contest.sponsor}</Text>

        <View style={styles.picks}>
          {Object.values(contest.picks || {}).filter(v => v !== null && String(v) !== '' && String(v) !== '_tiebreaker').slice(0, 3).map((pick, index) => (
            <View key={index} style={[styles.pickBadge, { backgroundColor: colors.cardBorder }]}>
              <Text style={[styles.pickText, { color: colors.text }]}>{String(pick)}</Text>
            </View>
          ))}
          {Object.keys(contest.picks || {}).filter(k => k !== '_tiebreaker').length > 3 && (
            <Text style={[styles.moreText, { color: colors.textMuted }]}>+{Object.keys(contest.picks || {}).filter(k => k !== '_tiebreaker').length - 3}</Text>
          )}
        </View>

        {contest.position && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' }}>
            <Ionicons name="podium" size={16} color={Colors.primary} />
            <Text style={{ color: Colors.primary, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>Rank #{contest.position}</Text>
          </View>
        )}

        {contest.crownsEarned > 0 && (
          <View style={styles.crownsRow}>
            <MaterialCommunityIcons name="crown" size={16} color={Colors.gradientEnd} />
            <Text style={[styles.crownsText, { color: Colors.primary }]}>+{contest.crownsEarned} Crowns</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },
  position: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  positionText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  title: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 4,
  },
  sponsor: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginBottom: 12,
  },
  picks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  pickText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  moreText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    alignSelf: 'center',
    marginLeft: 4,
  },
  crownsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  crownsText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
});
