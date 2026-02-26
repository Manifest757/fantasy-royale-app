import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, RefreshControl, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/colors';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import { AppHeader } from '@/components/AppHeader';
import { LiveTicker } from '@/components/LiveTicker';
import { PromoCarousel } from '@/components/PromoCarousel';
import { ContestCard } from '@/components/ContestCard';
import { useContests, useUserContests, useBracketContests } from '@/lib/supabase-data';

export default function HomeScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { data: contests = [], refetch: refetchContests, isRefetching: isRefetchingContests } = useContests();
  const { data: userContests = [], refetch: refetchUserContests, isRefetching: isRefetchingUserContests } = useUserContests();
  const { data: bracketContests = [], refetch: refetchBracket, isRefetching: isRefetchingBracket } = useBracketContests();
  const refreshing = isRefetchingContests || isRefetchingUserContests || isRefetchingBracket;
  const onRefresh = useCallback(() => { refetchContests(); refetchUserContests(); refetchBracket(); }, [refetchContests, refetchUserContests, refetchBracket]);
  const activeBrackets = (Array.isArray(bracketContests) ? bracketContests : []).filter((b: any) => b.status === 'open' || b.status === 'active');
  
  const enteredIds = new Set(userContests.map((uc: any) => uc.contest_id || uc.contestId));
  const webTopPadding = Platform.OS === 'web' ? 67 : 0;
  const headerHeight = (insets.top || webTopPadding) + 56;

  const visibleContests = contests.filter(c => c.status === 'open' || c.status === 'active');
  const featuredContest = visibleContests.find(c => c.isPremier);
  const discoverContests = visibleContests.filter(c => !c.isPremier);

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
        <LiveTicker />
        <PromoCarousel />

        {featuredContest && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>FEATURED PREMIER ROYALE</Text>
            <View style={styles.sectionContent}>
              <ContestCard contest={featuredContest} featured hasEntered={enteredIds.has(featuredContest.id)} />
            </View>
          </View>
        )}

        {activeBrackets.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>FEATURED PREMIUM ROYALE</Text>
            <View style={styles.sectionContent}>
              {activeBrackets.map((b: any) => (
                <Pressable key={b.id} onPress={() => router.push(`/bracket/${b.id}`)} style={({ pressed }) => [{ opacity: pressed ? 0.95 : 1 }]}>
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
                          <Text style={{ color: colors.text, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>+{b.prize_pool_crowns || 0}</Text>
                        </View>
                      </View>

                      <Text style={{ color: colors.text, fontSize: 20, fontFamily: 'Inter_700Bold', marginBottom: 4 }}>NCAA Bracket Challenge</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 12 }}>
                        {b.season} {b.year} | Max Score: 192 pts
                      </Text>

                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <View>
                          <Text style={{ color: colors.textMuted, fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5 }}>ENTRIES</Text>
                          <Text style={{ color: colors.text, fontSize: 16, fontFamily: 'Inter_700Bold' }}>{b.entry_count || 0}</Text>
                        </View>
                        <View>
                          <Text style={{ color: colors.textMuted, fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5 }}>STATUS</Text>
                          <Text style={{ color: b.status === 'open' ? Colors.success : b.status === 'concluded' ? Colors.error : Colors.primary, fontSize: 16, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' }}>{b.status}</Text>
                        </View>
                        <View>
                          <Text style={{ color: colors.textMuted, fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5 }}>PRIZE</Text>
                          <Text style={{ color: Colors.gradientStart, fontSize: 16, fontFamily: 'Inter_700Bold' }}>{b.prize_pool_crowns || 0} Crowns</Text>
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
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>DISCOVER CONTESTS</Text>
            <Text style={[styles.seeAll, { color: Colors.primary }]}>SEE ALL</Text>
          </View>
          <View style={styles.sectionContent}>
            {discoverContests.map(contest => (
              <ContestCard key={contest.id} contest={contest} hasEntered={enteredIds.has(contest.id)} />
            ))}
          </View>
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
    flexGrow: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionContent: {
    paddingHorizontal: 16,
  },
  seeAll: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
});
