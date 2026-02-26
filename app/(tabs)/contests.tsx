import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, Pressable, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/colors';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import { AppHeader } from '@/components/AppHeader';
import { UserContestCard } from '@/components/UserContestCard';
import { ContestCard } from '@/components/ContestCard';
import { useContests, useUserContests, useBracketContests } from '@/lib/supabase-data';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function ContestsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { data: userContests = [], refetch: refetchUserContests, isRefetching: isRefetchingUserContests } = useUserContests();
  const { data: allContests = [], refetch: refetchContests, isRefetching: isRefetchingContests } = useContests();
  const { data: bracketContests = [], refetch: refetchBracket, isRefetching: isRefetchingBracket } = useBracketContests();
  const refreshing = isRefetchingUserContests || isRefetchingContests || isRefetchingBracket;
  const onRefresh = useCallback(() => { refetchUserContests(); refetchContests(); refetchBracket(); }, [refetchUserContests, refetchContests, refetchBracket]);
  const activeBrackets = (bracketContests as any[]).filter((b: any) => b.status === 'open' || b.status === 'active');

  const webTopPadding = Platform.OS === 'web' ? 67 : 0;
  const headerHeight = (insets.top || webTopPadding) + 56;

  const enteredIds = new Set(userContests.map((uc: any) => uc.contest_id || uc.contestId));

  const liveContests = userContests.filter(c => c.status === 'live');
  const pendingContests = userContests.filter(c => c.status === 'pending');
  const completedContests = userContests.filter(c => c.status === 'completed');

  const availableContests = allContests.filter(
    c => (c.status === 'open' || c.status === 'active') && !enteredIds.has(c.id)
  );

  const hasEnteredContests = userContests.length > 0;

  if (!user) {
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
          <Text style={[styles.title, { color: colors.text }]}>Contests</Text>

          <Pressable onPress={() => router.push('/profile')} style={[styles.signInBanner, { backgroundColor: Colors.primary + '15', borderColor: Colors.primary + '40' }]}>
            <Ionicons name="log-in-outline" size={20} color={Colors.primary} />
            <Text style={[styles.signInText, { color: Colors.primary }]}>Sign in to enter contests and track your picks</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
          </Pressable>

          {activeBrackets.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>FEATURED PREMIUM ROYALE</Text>
              {activeBrackets.map((b: any) => (
                <BracketContestCard key={b.id} bracket={b} colors={colors} />
              ))}
            </View>
          )}

          {allContests.filter(c => c.status === 'open' || c.status === 'active').length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>AVAILABLE CONTESTS</Text>
              {allContests.filter(c => c.status === 'open' || c.status === 'active').map(contest => (
                <ContestCard key={contest.id} contest={contest} hasEntered={false} />
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

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
        <Text style={[styles.title, { color: colors.text }]}>My Contests</Text>

        {!hasEnteredContests && (
          <View style={styles.emptyBanner}>
            <Ionicons name="trophy-outline" size={40} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No contests entered yet</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Browse available contests below to get started
            </Text>
          </View>
        )}

        {liveContests.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>LIVE</Text>
            {liveContests.map(contest => (
              <UserContestCard key={contest.id} contest={contest} />
            ))}
          </View>
        )}

        {pendingContests.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>ENTERED</Text>
            {pendingContests.map(contest => (
              <UserContestCard key={contest.id} contest={contest} />
            ))}
          </View>
        )}

        {completedContests.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>COMPLETED</Text>
            {completedContests.map(contest => (
              <UserContestCard key={contest.id} contest={contest} />
            ))}
          </View>
        )}

        {activeBrackets.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>FEATURED PREMIUM ROYALE</Text>
            {activeBrackets.map((b: any) => (
              <BracketContestCard key={b.id} bracket={b} colors={colors} />
            ))}
          </View>
        )}

        {availableContests.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>AVAILABLE CONTESTS</Text>
            {availableContests.map(contest => (
              <ContestCard key={contest.id} contest={contest} hasEntered={false} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function BracketContestCard({ bracket, colors }: { bracket: any; colors: any }) {
  return (
    <Pressable onPress={() => router.push(`/bracket/${bracket.id}`)} style={({ pressed }) => [{ opacity: pressed ? 0.95 : 1 }]}>
      <View style={{ borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: Colors.gradientStart + '60', marginBottom: 12 }}>
        <LinearGradient
          colors={['rgba(249, 115, 22, 0.15)', 'rgba(236, 72, 153, 0.15)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: 16 }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ backgroundColor: Colors.gradientStart, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                <Text style={{ color: '#FFF', fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1 }}>NCAAB</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(236, 72, 153, 0.3)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, gap: 4 }}>
                <Ionicons name="diamond" size={10} color="#EC4899" />
                <Text style={{ color: '#EC4899', fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1 }}>PREMIUM ROYALE</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <MaterialCommunityIcons name="crown" size={14} color={Colors.gradientEnd} />
              <Text style={{ color: colors.text, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>+{bracket.prize_pool_crowns || 0}</Text>
            </View>
          </View>

          <Text style={{ color: colors.text, fontSize: 20, fontFamily: 'Inter_700Bold', marginBottom: 4 }}>NCAA Bracket Challenge</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 12 }}>
            {bracket.season} {bracket.year} | Max Score: 192 pts
          </Text>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <View>
              <Text style={{ color: colors.textMuted, fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5 }}>ENTRIES</Text>
              <Text style={{ color: colors.text, fontSize: 16, fontFamily: 'Inter_700Bold' }}>{bracket.entry_count || 0}</Text>
            </View>
            <View>
              <Text style={{ color: colors.textMuted, fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5 }}>STATUS</Text>
              <Text style={{ color: bracket.status === 'open' ? Colors.success : bracket.status === 'concluded' ? Colors.error : Colors.primary, fontSize: 16, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' }}>{bracket.status}</Text>
            </View>
            <View>
              <Text style={{ color: colors.textMuted, fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5 }}>PRIZE</Text>
              <Text style={{ color: Colors.gradientStart, fontSize: 16, fontFamily: 'Inter_700Bold' }}>{bracket.prize_pool_crowns || 0} Crowns</Text>
            </View>
          </View>

          <LinearGradient
            colors={[Colors.gradientStart, Colors.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ borderRadius: 10, paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
          >
            <MaterialCommunityIcons name="tournament" size={18} color="#FFF" />
            <Text style={{ color: '#FFF', fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 1 }}>FILL OUT BRACKET</Text>
          </LinearGradient>
        </LinearGradient>
      </View>
    </Pressable>
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
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
    marginBottom: 12,
  },
  signInBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  signInText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  emptyBanner: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 12,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 18,
  },
});
