import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/colors';
import { Contest } from '@/data/mockData';

interface ContestCardProps {
  contest: Contest;
  featured?: boolean;
  hasEntered?: boolean;
}

function getTimeRemaining(endDate: string): string {
  const now = new Date();
  const end = new Date(endDate);
  const diff = end.getTime() - now.getTime();
  
  if (diff <= 0) return 'Ended';
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

function formatShortDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function ContestCard({ contest, featured = false, hasEntered = false }: ContestCardProps) {
  const { colors, isDark } = useTheme();

  const handlePress = () => {
    router.push(`/contest/${contest.id}`);
  };

  const isConcluded = contest.status === 'concluded';
  const buttonColors = isConcluded
    ? ['#FFD700', '#F59E0B'] as const
    : hasEntered 
    ? ['#22C55E', '#16A34A'] as const
    : [Colors.primary, Colors.primaryDark] as const;
  const buttonText = isConcluded ? 'VIEW RESULTS' : hasEntered ? 'SEE PICKS' : 'ENTER FREE';

  if (featured) {
    return (
      <Pressable onPress={handlePress} style={({ pressed }) => [{ opacity: pressed ? 0.95 : 1 }]}>
        <View style={[styles.featuredCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <LinearGradient
            colors={['rgba(249, 115, 22, 0.15)', 'rgba(236, 72, 153, 0.15)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.featuredHeader}>
            <View style={styles.leagueBadge}>
              <Text style={styles.leagueText}>{contest.league}</Text>
            </View>
            <View style={styles.premierBadge}>
              <Ionicons name="diamond" size={12} color="#FFF" />
              <Text style={styles.premierText}>PREMIER</Text>
            </View>
          </View>
          <Text style={[styles.featuredTitle, { color: colors.text }]}>{contest.title}</Text>
          <Text style={[styles.sponsor, { color: colors.textSecondary }]}>Sponsored by {contest.sponsor}</Text>
          
          {(contest.startsAt || contest.endsAt) && (
            <View style={styles.dateRow}>
              <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
              <Text style={[styles.dateText, { color: colors.textMuted }]}>
                {formatShortDate(contest.startsAt)}{contest.startsAt && contest.endsAt ? ' – ' : ''}{formatShortDate(contest.endsAt)}
              </Text>
            </View>
          )}

          <View style={styles.featuredStats}>
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Prize Pool</Text>
              <Text style={[styles.statValue, { color: Colors.primary }]}>{contest.prizePool}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Entries</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>{(contest.entries ?? 0).toLocaleString()}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>{isConcluded ? 'Status' : 'Ends In'}</Text>
              <Text style={[styles.statValue, { color: isConcluded ? '#FFD700' : colors.text }]}>{isConcluded ? 'Concluded' : getTimeRemaining(contest.endsAt)}</Text>
            </View>
          </View>

          <View style={styles.featuredFooter}>
            <View style={styles.crowns}>
              <MaterialCommunityIcons name="crown" size={16} color={Colors.gradientEnd} />
              <Text style={[styles.crownsText, { color: colors.text }]}>+{contest.crowns} Crowns</Text>
            </View>
            <LinearGradient
              colors={buttonColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.enterButton}
            >
              <Text style={styles.enterButtonText}>{buttonText}</Text>
            </LinearGradient>
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={handlePress} style={({ pressed }) => [{ opacity: pressed ? 0.95 : 1 }]}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.cardHeader}>
          <View style={styles.leagueBadge}>
            <Text style={styles.leagueText}>{contest.league}</Text>
          </View>
          <View style={styles.cardCrowns}>
            <MaterialCommunityIcons name="crown" size={14} color={Colors.gradientEnd} />
            <Text style={[styles.cardCrownsText, { color: colors.text }]}>+{contest.crowns}</Text>
          </View>
        </View>
        <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>{contest.title}</Text>
        <Text style={[styles.cardSponsor, { color: colors.textMuted }]}>{contest.sponsor}</Text>

        {(contest.startsAt || contest.endsAt) && (
          <View style={[styles.dateRow, { marginBottom: 10 }]}>
            <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
            <Text style={[styles.dateText, { color: colors.textMuted, fontSize: 11 }]}>
              {formatShortDate(contest.startsAt)}{contest.startsAt && contest.endsAt ? ' – ' : ''}{formatShortDate(contest.endsAt)}
            </Text>
          </View>
        )}

        <View style={styles.cardStats}>
          <View style={styles.cardStatItem}>
            <Ionicons name="trophy-outline" size={14} color={Colors.primary} />
            <Text style={[styles.cardStatValue, { color: Colors.primary }]}>{contest.prizePool || 0} Crowns</Text>
          </View>
          <View style={styles.cardStatItem}>
            <Ionicons name="people-outline" size={14} color={colors.textMuted} />
            <Text style={[styles.cardStatText, { color: colors.textMuted }]}>{contest.entries?.toLocaleString() || 0}/{contest.maxEntries || '∞'}</Text>
          </View>
          <View style={styles.cardStatItem}>
            <Ionicons name={isConcluded ? 'trophy' : 'time-outline'} size={14} color={isConcluded ? '#FFD700' : colors.textMuted} />
            <Text style={[styles.cardStatText, { color: isConcluded ? '#FFD700' : colors.textMuted }]}>{isConcluded ? 'Concluded' : getTimeRemaining(contest.endsAt)}</Text>
          </View>
        </View>

        <LinearGradient
          colors={buttonColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.cardEnterButton}
        >
          <Text style={styles.cardEnterButtonText}>{buttonText}</Text>
        </LinearGradient>
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  leagueBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  leagueText: {
    color: '#000',
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },
  timeLeft: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 4,
  },
  cardSponsor: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginBottom: 8,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 12,
  },
  dateText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  cardStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardStatValue: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
  },
  cardStatText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  cardEnterButton: {
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  cardEnterButtonText: {
    color: '#000',
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },
  cardCrowns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardCrownsText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  featuredCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    overflow: 'hidden',
  },
  featuredHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  premierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(249, 115, 22, 0.8)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  premierText: {
    color: '#FFF',
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },
  featuredTitle: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    marginBottom: 4,
  },
  sponsor: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    marginBottom: 16,
  },
  featuredStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  featuredFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  crowns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  crownsText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  enterButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  enterButtonText: {
    color: '#000',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
});
