import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/colors';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import { AppHeader } from '@/components/AppHeader';
import { useUser, useLeaderboard } from '@/lib/supabase-data';
import { Image } from 'expo-image';

export default function StatsScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { data: user, refetch: refetchUser, isRefetching: isRefetchingUser } = useUser();
  const { data: leaderboard = [], refetch: refetchLeaderboard, isRefetching: isRefetchingLeaderboard } = useLeaderboard(25);

  const refreshing = isRefetchingUser || isRefetchingLeaderboard;
  const onRefresh = useCallback(() => { refetchUser(); refetchLeaderboard(); }, [refetchUser, refetchLeaderboard]);
  
  const webTopPadding = Platform.OS === 'web' ? 67 : 0;
  const headerHeight = (insets.top || webTopPadding) + 56;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AnimatedBackground />
      <AppHeader />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingTop: headerHeight + 16, paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />}
      >
        <Text style={[styles.title, { color: colors.text }]}>Stats</Text>

        <View style={[styles.crownsCard, { borderColor: colors.cardBorder }]}>
          <LinearGradient
            colors={['rgba(249, 115, 22, 0.15)', 'rgba(236, 72, 153, 0.15)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.crownsContent}>
            <MaterialCommunityIcons name="crown" size={32} color={Colors.gradientEnd} />
            <View style={styles.crownsText}>
              <Text style={[styles.crownsLabel, { color: colors.textSecondary }]}>Crown Balance</Text>
              <Text style={[styles.crownsValue, { color: colors.text }]}>{(user?.crowns ?? 0).toLocaleString()}</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Ionicons name="game-controller-outline" size={24} color={Colors.primary} />
            <Text style={[styles.statValue, { color: colors.text }]}>{user?.contestsEntered ?? 0}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Contests</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Ionicons name="trophy-outline" size={24} color={Colors.success} />
            <Text style={[styles.statValue, { color: colors.text }]}>{user?.wins ?? 0}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Wins</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Ionicons name="flame-outline" size={24} color={Colors.gradientStart} />
            <Text style={[styles.statValue, { color: colors.text }]}>{user?.currentStreak ?? 0}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Streak</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Win Rate</Text>
          <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.progressHeader}>
              <Text style={[styles.progressPercent, { color: Colors.primary }]}>
                {(user?.contestsEntered ? ((user.wins / user.contestsEntered) * 100).toFixed(1) : '0.0')}%
              </Text>
              <Text style={[styles.progressStat, { color: colors.textSecondary }]}>
                {user?.wins ?? 0} / {user?.contestsEntered ?? 0}
              </Text>
            </View>
            <View style={[styles.progressBar, { backgroundColor: colors.cardBorder }]}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${user?.contestsEntered ? (user.wins / user.contestsEntered) * 100 : 0}%` }
                ]}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Leaderboard</Text>
          {leaderboard.length === 0 ? (
            <View style={[styles.emptyLeaderboard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Ionicons name="people-outline" size={32} color={colors.textMuted} />
              <Text style={[styles.emptyLeaderboardText, { color: colors.textSecondary }]}>No players yet</Text>
            </View>
          ) : (
            <View style={[styles.leaderboardCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              {leaderboard.map((entry, index) => (
                <View
                  key={entry.userId}
                  style={[
                    styles.leaderboardRow,
                    index !== leaderboard.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.cardBorder }
                  ]}
                >
                  <View style={styles.leaderboardLeft}>
                    <View style={[
                      styles.rankBadge,
                      entry.rank === 1 && styles.rank1,
                      entry.rank === 2 && styles.rank2,
                      entry.rank === 3 && styles.rank3,
                    ]}>
                      <Text style={[styles.rankText, entry.rank <= 3 && { color: '#000' }]}>
                        {entry.rank}
                      </Text>
                    </View>
                    {entry.avatar ? (
                      <Image source={{ uri: entry.avatar }} style={styles.leaderAvatar} />
                    ) : (
                      <View style={[styles.leaderAvatarPlaceholder, { backgroundColor: Colors.primary + '30' }]}>
                        <Text style={[styles.leaderAvatarLetter, { color: Colors.primary }]}>
                          {entry.username.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={styles.leaderInfo}>
                      <Text style={[styles.leaderUsername, { color: colors.text }]}>{entry.username}</Text>
                      <Text style={[styles.leaderStats, { color: colors.textMuted }]}>
                        {entry.contestsEntered} contest{entry.contestsEntered !== 1 ? 's' : ''} · {entry.wins} win{entry.wins !== 1 ? 's' : ''}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.leaderboardRight}>
                    <MaterialCommunityIcons name="crown" size={14} color={Colors.gradientEnd} />
                    <Text style={[styles.leaderCrowns, { color: colors.textSecondary }]}>
                      {entry.crowns.toLocaleString()}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    flexGrow: 1,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    marginBottom: 24,
  },
  crownsCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 20,
  },
  crownsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  crownsText: {
    flex: 1,
  },
  crownsLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    marginBottom: 4,
  },
  crownsValue: {
    fontSize: 32,
    fontFamily: 'Inter_700Bold',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  statValue: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    textTransform: 'uppercase',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 12,
  },
  progressCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressPercent: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
  },
  progressStat: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  emptyLeaderboard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyLeaderboardText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  leaderboardCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  leaderboardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  leaderboardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#3F3F46',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rank1: {
    backgroundColor: '#FFD700',
  },
  rank2: {
    backgroundColor: '#C0C0C0',
  },
  rank3: {
    backgroundColor: '#CD7F32',
  },
  rankText: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: '#FFF',
  },
  leaderAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  leaderAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaderAvatarLetter: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  leaderInfo: {
    flex: 1,
  },
  leaderUsername: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  leaderStats: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    marginTop: 1,
  },
  leaderboardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  leaderCrowns: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
});
