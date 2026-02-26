import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, Alert, RefreshControl, ActivityIndicator, Modal } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/colors';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import { useBracketContest, useBracketTeams, useBracketStandings, useBracketMyPicks } from '@/lib/supabase-data';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { getApiUrl } from '@/lib/query-client';
import * as Haptics from 'expo-haptics';
import { fetch } from 'expo/fetch';

interface Team {
  id: string;
  team_name: string;
  seed: number;
  region: string;
}

const REGION_NAMES = ['East', 'West', 'South', 'Midwest'] as const;
const R64_SEED_MATCHUPS = [
  [1, 16], [8, 9], [5, 12], [4, 13], [6, 11], [3, 14], [7, 10], [2, 15],
];

const SCORING = [
  { round: 'Round of 64', points: 1, games: 32 },
  { round: 'Round of 32', points: 2, games: 16 },
  { round: 'Sweet 16', points: 4, games: 8 },
  { round: 'Elite 8', points: 8, games: 4 },
  { round: 'Final Four', points: 16, games: 2 },
  { round: 'Championship', points: 32, games: 1 },
];

const RULES = [
  'Fill out your bracket by picking winners for all 63 games',
  'Picks lock before the first game tips off',
  'Points increase each round - reward for picking deep upsets',
  'Your total score determines your ranking',
  'Top finishers earn crowns and bragging rights',
];

type ViewMode = 'rules' | 'pick' | 'bracket' | 'standings';
type RegionSection = 'East' | 'West' | 'South' | 'Midwest' | 'FinalFour';

function getTeamBySeed(teams: Team[], seed: number): Team | undefined {
  return teams.find(t => t.seed === seed);
}

function makeMatchupKey(region: string, round: number, gameIndex: number): string {
  return `${region}-R${round}-G${gameIndex}`;
}

export default function BracketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const contestId = id || '';
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { user: authUser } = useAuth();
  const queryClient = useQueryClient();

  const { data: contestData, isLoading: contestLoading, refetch: refetchContest } = useBracketContest(contestId);
  const { data: teamsData, isLoading: teamsLoading, refetch: refetchTeams } = useBracketTeams(contestId);
  const { data: standingsData, refetch: refetchStandings } = useBracketStandings(contestId);
  const { data: myPicksData, refetch: refetchMyPicks } = useBracketMyPicks(contestId);

  const [viewMode, setViewMode] = useState<ViewMode>('rules');
  const [activeRegion, setActiveRegion] = useState<RegionSection>('East');
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simResult, setSimResult] = useState<{ score: number; correct: number; total: number } | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const hasSubmitted = !!(myPicksData?.picks && myPicksData.picks.length > 0);

  useEffect(() => {
    if (hasSubmitted && viewMode === 'rules') {
      setViewMode('bracket');
    }
  }, [hasSubmitted]);

  useEffect(() => {
    if (myPicksData?.picks && Array.isArray(myPicksData.picks) && myPicksData.picks.length > 0 && teamsData?.regions) {
      const restoredPicks: Record<string, string> = {};
      myPicksData.picks.forEach((p: any) => {
        if (p.matchup_key && p.team_id) {
          restoredPicks[p.matchup_key] = String(p.team_id);
        }
      });
      if (Object.keys(restoredPicks).length > 0) {
        setPicks(restoredPicks);
      }
    }
  }, [myPicksData, teamsData]);

  const webTopPadding = Platform.OS === 'web' ? 67 : 0;
  const topPadding = insets.top || webTopPadding;

  const regions: Record<string, Team[]> = useMemo(() => {
    if (!teamsData?.regions) return {};
    return teamsData.regions;
  }, [teamsData]);

  const getPickedTeam = useCallback((key: string): Team | null => {
    const teamId = picks[key];
    if (!teamId) return null;
    for (const regionTeams of Object.values(regions)) {
      const found = (regionTeams as Team[]).find(t => String(t.id) === String(teamId));
      if (found) return found;
    }
    return null;
  }, [picks, regions]);

  const getRegionMatchups = useCallback((regionName: string, round: number, gameIndex?: number): { team1: Team | null; team2: Team | null; key: string }[] => {
    const regionTeams = regions[regionName] || [];
    if (round === 1) {
      return R64_SEED_MATCHUPS.map(([s1, s2], idx) => ({
        team1: getTeamBySeed(regionTeams, s1) || null,
        team2: getTeamBySeed(regionTeams, s2) || null,
        key: makeMatchupKey(regionName, 1, idx),
      }));
    }
    const prevMatchups = getRegionMatchups(regionName, round - 1);
    const result: { team1: Team | null; team2: Team | null; key: string }[] = [];
    for (let i = 0; i < prevMatchups.length; i += 2) {
      const winner1 = getPickedTeam(prevMatchups[i].key);
      const winner2 = prevMatchups[i + 1] ? getPickedTeam(prevMatchups[i + 1].key) : null;
      result.push({
        team1: winner1,
        team2: winner2,
        key: makeMatchupKey(regionName, round, Math.floor(i / 2)),
      });
    }
    return result;
  }, [regions, getPickedTeam]);

  const getRegionChampion = useCallback((regionName: string): Team | null => {
    const e8Key = makeMatchupKey(regionName, 4, 0);
    return getPickedTeam(e8Key);
  }, [getPickedTeam]);

  const totalPicks = useMemo(() => Object.keys(picks).length, [picks]);

  const allRegionsComplete = useMemo(() => {
    return REGION_NAMES.every(r => getRegionChampion(r) !== null);
  }, [getRegionChampion]);

  const getFinalFourMatchups = useCallback(() => {
    const eastChamp = getRegionChampion('East');
    const westChamp = getRegionChampion('West');
    const southChamp = getRegionChampion('South');
    const midwestChamp = getRegionChampion('Midwest');
    const sf1Key = makeMatchupKey('FF', 5, 0);
    const sf2Key = makeMatchupKey('FF', 5, 1);
    const champKey = makeMatchupKey('FF', 6, 0);
    const sf1Winner = getPickedTeam(sf1Key);
    const sf2Winner = getPickedTeam(sf2Key);
    return {
      semifinal1: { team1: eastChamp, team2: westChamp, key: sf1Key },
      semifinal2: { team1: southChamp, team2: midwestChamp, key: sf2Key },
      championship: { team1: sf1Winner, team2: sf2Winner, key: champKey },
    };
  }, [getRegionChampion, getPickedTeam]);

  const handlePick = useCallback((key: string, teamId: string) => {
    if (hasSubmitted) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setPicks(prev => {
      const newPicks = { ...prev };
      if (newPicks[key] === teamId) {
        delete newPicks[key];
        const parts = key.split('-');
        const region = parts[0];
        const round = parseInt(parts[1].replace('R', ''));
        const clearDownstream = (r: string, rd: number, gi: number) => {
          const k = makeMatchupKey(r, rd, gi);
          if (newPicks[k]) {
            delete newPicks[k];
          }
        };
        if (region !== 'FF') {
          for (let rd = round + 1; rd <= 4; rd++) {
            const gamesInRound = Math.pow(2, 4 - rd);
            for (let gi = 0; gi < gamesInRound; gi++) {
              clearDownstream(region, rd, gi);
            }
          }
          clearDownstream('FF', 5, 0);
          clearDownstream('FF', 5, 1);
          clearDownstream('FF', 6, 0);
        } else {
          if (round === 5) {
            clearDownstream('FF', 6, 0);
          }
        }
      } else {
        newPicks[key] = teamId;
      }
      return newPicks;
    });
  }, [hasSubmitted]);

  const derivedPicksList = useMemo(() => {
    const list: { team_id: string; round_number: number; matchup_key: string }[] = [];
    for (const [key, teamId] of Object.entries(picks)) {
      const parts = key.split('-');
      const roundStr = parts[1];
      const roundNum = parseInt(roundStr.replace('R', ''));
      list.push({ team_id: teamId, round_number: roundNum, matchup_key: key });
    }
    return list;
  }, [picks]);

  const handleSubmit = async () => {
    if (!authUser) {
      router.push('/profile');
      return;
    }
    if (totalPicks < 63) {
      Alert.alert('Incomplete Bracket', `You have ${totalPicks} of 63 picks. Please complete your bracket.`);
      return;
    }
    setIsSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const apiUrl = getApiUrl();
      const res = await fetch(new URL('/api/bracket-contests/' + contestId + '/submit', apiUrl).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ picks: derivedPicksList }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409) {
          queryClient.invalidateQueries({ queryKey: ['bracket-my-picks', contestId] });
          setShowSuccessModal(true);
          return;
        }
        throw new Error(body.error || 'Failed to submit bracket');
      }
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      queryClient.invalidateQueries({ queryKey: ['bracket-my-picks', contestId] });
      queryClient.invalidateQueries({ queryKey: ['bracket-standings', contestId] });
      setShowSuccessModal(true);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit bracket');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSimulate = async () => {
    if (!authUser) return;
    setIsSimulating(true);
    setSimResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const apiUrl = getApiUrl();
      const res = await fetch(new URL('/api/bracket-contests/' + contestId + '/simulate-all', apiUrl).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to simulate');
      }
      const result = await res.json();
      queryClient.invalidateQueries({ queryKey: ['bracket-my-picks', contestId] });
      queryClient.invalidateQueries({ queryKey: ['bracket-standings', contestId] });
      refetchMyPicks();
      refetchStandings();

      const { data: updatedPicks } = await supabase
        .from('bracket_picks')
        .select('is_correct, round_number')
        .eq('bracket_contest_id', contestId)
        .eq('user_id', authUser.id)
        .not('is_correct', 'is', null);

      const POINTS: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16, 6: 32 };
      const correct = (updatedPicks || []).filter((p: any) => p.is_correct).length;
      const total = (updatedPicks || []).length;
      const score = (updatedPicks || []).reduce((sum: number, p: any) => {
        if (p.is_correct) return sum + (POINTS[p.round_number] || 1);
        return sum;
      }, 0);

      setSimResult({ score, correct, total });
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to simulate games');
    } finally {
      setIsSimulating(false);
    }
  };

  const isRefreshing = contestLoading || teamsLoading;
  const onRefresh = useCallback(() => {
    refetchContest();
    refetchTeams();
    refetchStandings();
    refetchMyPicks();
  }, [refetchContest, refetchTeams, refetchStandings, refetchMyPicks]);

  const tabs = useMemo(() => {
    const t: { key: ViewMode; label: string; icon: string }[] = [
      { key: 'rules', label: 'Rules', icon: 'information-circle-outline' },
    ];
    if (!hasSubmitted) {
      t.push({ key: 'pick', label: 'Pick', icon: 'create-outline' });
    }
    if (hasSubmitted) {
      t.push({ key: 'bracket', label: 'My Bracket', icon: 'grid-outline' });
    }
    t.push({ key: 'standings', label: 'Standings', icon: 'trophy-outline' });
    return t;
  }, [hasSubmitted]);

  if (contestLoading || teamsLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AnimatedBackground />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </View>
    );
  }

  const renderMatchupCard = (matchup: { team1: Team | null; team2: Team | null; key: string }, readOnly: boolean) => {
    const { team1, team2, key } = matchup;
    if (!team1 && !team2) {
      return (
        <View key={key} style={[styles.matchupCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.matchupTeams}>
            <View style={[styles.teamSlot, { backgroundColor: colors.cardBorder }]}>
              <Text style={[styles.teamSlotText, { color: colors.textMuted }]}>TBD</Text>
            </View>
            <Text style={[styles.vsText, { color: colors.textMuted }]}>VS</Text>
            <View style={[styles.teamSlot, { backgroundColor: colors.cardBorder }]}>
              <Text style={[styles.teamSlotText, { color: colors.textMuted }]}>TBD</Text>
            </View>
          </View>
        </View>
      );
    }
    const selectedId = picks[key];
    const isTeam1Selected = team1 && String(team1.id) === selectedId;
    const isTeam2Selected = team2 && String(team2.id) === selectedId;

    return (
      <View key={key} style={[styles.matchupCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.matchupTeams}>
          <Pressable
            onPress={() => team1 && !readOnly && handlePick(key, String(team1.id))}
            disabled={!team1 || readOnly}
            style={[
              styles.teamSlot,
              {
                backgroundColor: isTeam1Selected ? 'rgba(34, 211, 238, 0.15)' : colors.cardBorder,
                borderColor: isTeam1Selected ? Colors.primary : 'transparent',
                borderWidth: isTeam1Selected ? 1.5 : 0,
              },
            ]}
          >
            {team1 ? (
              <View style={styles.teamContent}>
                <View style={[styles.seedBadge, { backgroundColor: isTeam1Selected ? Colors.primary : colors.textMuted }]}>
                  <Text style={styles.seedText}>{team1.seed}</Text>
                </View>
                <Text style={[styles.teamName, { color: isTeam1Selected ? Colors.primary : colors.text }]} numberOfLines={1}>
                  {team1.team_name}
                </Text>
                {isTeam1Selected && <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />}
              </View>
            ) : (
              <Text style={[styles.teamSlotText, { color: colors.textMuted }]}>TBD</Text>
            )}
          </Pressable>
          <Text style={[styles.vsText, { color: colors.textMuted }]}>VS</Text>
          <Pressable
            onPress={() => team2 && !readOnly && handlePick(key, String(team2.id))}
            disabled={!team2 || readOnly}
            style={[
              styles.teamSlot,
              {
                backgroundColor: isTeam2Selected ? 'rgba(34, 211, 238, 0.15)' : colors.cardBorder,
                borderColor: isTeam2Selected ? Colors.primary : 'transparent',
                borderWidth: isTeam2Selected ? 1.5 : 0,
              },
            ]}
          >
            {team2 ? (
              <View style={styles.teamContent}>
                <View style={[styles.seedBadge, { backgroundColor: isTeam2Selected ? Colors.primary : colors.textMuted }]}>
                  <Text style={styles.seedText}>{team2.seed}</Text>
                </View>
                <Text style={[styles.teamName, { color: isTeam2Selected ? Colors.primary : colors.text }]} numberOfLines={1}>
                  {team2.team_name}
                </Text>
                {isTeam2Selected && <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />}
              </View>
            ) : (
              <Text style={[styles.teamSlotText, { color: colors.textMuted }]}>TBD</Text>
            )}
          </Pressable>
        </View>
      </View>
    );
  };

  const renderRegionBracket = (regionName: string, readOnly: boolean) => {
    const roundNames = ['Round of 64', 'Round of 32', 'Sweet 16', 'Elite 8'];
    const rounds: JSX.Element[] = [];

    for (let round = 1; round <= 4; round++) {
      const matchups = getRegionMatchups(regionName, round);
      const hasAllPrevPicks = round === 1 || matchups.every(m => m.team1 !== null && m.team2 !== null);
      if (round > 1 && !hasAllPrevPicks && !readOnly) {
        const availableMatchups = matchups.filter(m => m.team1 !== null || m.team2 !== null);
        if (availableMatchups.length === 0) break;
      }

      rounds.push(
        <View key={`${regionName}-R${round}`} style={styles.roundSection}>
          <View style={styles.roundHeader}>
            <View style={[styles.roundBadge, { backgroundColor: 'rgba(34, 211, 238, 0.12)' }]}>
              <Text style={[styles.roundBadgeText, { color: Colors.primary }]}>{roundNames[round - 1]}</Text>
            </View>
            <Text style={[styles.roundPoints, { color: colors.textMuted }]}>
              {Math.pow(2, round - 1)} pts each
            </Text>
          </View>
          {matchups.map(m => renderMatchupCard(m, readOnly))}
        </View>
      );
    }

    return rounds;
  };

  const renderRulesView = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={!!isRefreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />}
    >
      <View style={{ alignItems: 'center', marginBottom: 24 }}>
        <MaterialCommunityIcons name="tournament" size={48} color={Colors.primary} />
        <Text style={[styles.rulesTitle, { color: colors.text }]}>NCAA March Madness Bracket Challenge</Text>
        <View style={[styles.freeBadge, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
          <Text style={[styles.freeBadgeText, { color: Colors.success }]}>Free to enter</Text>
        </View>
      </View>

      <View style={[styles.scoringCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Text style={[styles.scoringTitle, { color: colors.text }]}>Scoring Breakdown</Text>
        {SCORING.map((s, i) => (
          <View key={i} style={[styles.scoringRow, i < SCORING.length - 1 && { borderBottomColor: colors.cardBorder, borderBottomWidth: StyleSheet.hairlineWidth }]}>
            <Text style={[styles.scoringRound, { color: colors.textSecondary }]}>{s.round}</Text>
            <View style={styles.scoringRight}>
              <Text style={[styles.scoringPoints, { color: Colors.primary }]}>{s.points} pt{s.points > 1 ? 's' : ''}</Text>
              <Text style={[styles.scoringGames, { color: colors.textMuted }]}>per pick</Text>
            </View>
          </View>
        ))}
        <View style={[styles.maxScoreRow, { borderTopColor: Colors.primary, borderTopWidth: 1 }]}>
          <Text style={[styles.maxScoreLabel, { color: colors.text }]}>Maximum possible score</Text>
          <Text style={[styles.maxScoreValue, { color: Colors.primary }]}>192 points</Text>
        </View>
      </View>

      <View style={[styles.rulesCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Text style={[styles.rulesCardTitle, { color: colors.text }]}>Rules</Text>
        {RULES.map((rule, i) => (
          <View key={i} style={styles.ruleRow}>
            <View style={[styles.ruleNumber, { backgroundColor: 'rgba(34, 211, 238, 0.12)' }]}>
              <Text style={[styles.ruleNumberText, { color: Colors.primary }]}>{i + 1}</Text>
            </View>
            <Text style={[styles.ruleText, { color: colors.textSecondary }]}>{rule}</Text>
          </View>
        ))}
      </View>

      {!hasSubmitted && (
        <Pressable onPress={() => setViewMode('pick')} style={styles.ctaWrapper}>
          <LinearGradient
            colors={[Colors.gradientStart, Colors.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaButton}
          >
            <Ionicons name="create" size={22} color="#FFF" />
            <Text style={styles.ctaText}>Fill Out Bracket</Text>
          </LinearGradient>
        </Pressable>
      )}
    </ScrollView>
  );

  const regionSections: { key: RegionSection; label: string }[] = [
    { key: 'East', label: 'East' },
    { key: 'West', label: 'West' },
    { key: 'South', label: 'South' },
    { key: 'Midwest', label: 'Midwest' },
    { key: 'FinalFour', label: 'Final Four' },
  ];

  const renderPickView = () => {
    const ff = getFinalFourMatchups();
    return (
      <View style={{ flex: 1 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.regionTabs} contentContainerStyle={styles.regionTabsContent}>
          {regionSections.map(rs => (
            <Pressable
              key={rs.key}
              onPress={() => setActiveRegion(rs.key)}
              style={[
                styles.regionTab,
                {
                  backgroundColor: activeRegion === rs.key ? 'rgba(34, 211, 238, 0.15)' : colors.card,
                  borderColor: activeRegion === rs.key ? Colors.primary : colors.cardBorder,
                },
              ]}
            >
              <Text style={[styles.regionTabText, { color: activeRegion === rs.key ? Colors.primary : colors.textSecondary }]}>
                {rs.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={[styles.progressBar, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.progressInfo}>
            <Text style={[styles.progressText, { color: colors.text }]}>{totalPicks} of 63 picks made</Text>
            <Text style={[styles.progressPercent, { color: Colors.primary }]}>{Math.round((totalPicks / 63) * 100)}%</Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: colors.cardBorder }]}>
            <View style={[styles.progressFill, { width: `${Math.min((totalPicks / 63) * 100, 100)}%`, backgroundColor: Colors.primary }]} />
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
          showsVerticalScrollIndicator={false}
        >
          {activeRegion !== 'FinalFour' ? (
            renderRegionBracket(activeRegion, false)
          ) : (
            <View>
              {!allRegionsComplete ? (
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                  <Ionicons name="lock-closed" size={40} color={colors.textMuted} />
                  <Text style={[styles.lockedText, { color: colors.textMuted }]}>Complete all 4 regions to unlock Final Four</Text>
                </View>
              ) : (
                <>
                  <View style={styles.roundSection}>
                    <View style={styles.roundHeader}>
                      <View style={[styles.roundBadge, { backgroundColor: 'rgba(34, 211, 238, 0.12)' }]}>
                        <Text style={[styles.roundBadgeText, { color: Colors.primary }]}>Final Four</Text>
                      </View>
                      <Text style={[styles.roundPoints, { color: colors.textMuted }]}>16 pts each</Text>
                    </View>
                    {renderMatchupCard(ff.semifinal1, false)}
                    {renderMatchupCard(ff.semifinal2, false)}
                  </View>
                  <View style={styles.roundSection}>
                    <View style={styles.roundHeader}>
                      <View style={[styles.roundBadge, { backgroundColor: 'rgba(249, 115, 22, 0.12)' }]}>
                        <Text style={[styles.roundBadgeText, { color: Colors.gradientStart }]}>Championship</Text>
                      </View>
                      <Text style={[styles.roundPoints, { color: colors.textMuted }]}>32 pts</Text>
                    </View>
                    {renderMatchupCard(ff.championship, false)}
                  </View>
                </>
              )}
            </View>
          )}
        </ScrollView>

        {totalPicks >= 63 && !hasSubmitted && (
          <View style={[styles.submitWrapper, { paddingBottom: insets.bottom + 16 }]}>
            <Pressable onPress={handleSubmit} disabled={isSubmitting} style={styles.ctaWrapper}>
              <LinearGradient
                colors={[Colors.gradientStart, Colors.gradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.ctaButton, isSubmitting && { opacity: 0.6 }]}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="send" size={20} color="#FFF" />
                    <Text style={styles.ctaText}>Submit Bracket</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  const renderBracketView = () => {
    const ff = getFinalFourMatchups();
    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={!!isRefreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />}
      >
        <View style={{ alignItems: 'center', marginBottom: 20, gap: 12 }}>
          <View style={{ backgroundColor: 'rgba(34, 197, 94, 0.12)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
            <Text style={{ color: Colors.success, fontSize: 14, fontFamily: 'Inter_700Bold' }}>Bracket Submitted</Text>
          </View>

          <Pressable onPress={handleSimulate} disabled={isSimulating} style={{ opacity: isSimulating ? 0.6 : 1 }}>
            <LinearGradient
              colors={['#8B5CF6', '#6366F1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              {isSimulating ? (
                <>
                  <ActivityIndicator size="small" color="#FFF" />
                  <Text style={{ color: '#FFF', fontSize: 14, fontFamily: 'Inter_700Bold' }}>Simulating...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="play-circle" size={20} color="#FFF" />
                  <Text style={{ color: '#FFF', fontSize: 14, fontFamily: 'Inter_700Bold' }}>Simulate Games</Text>
                </>
              )}
            </LinearGradient>
          </Pressable>

          {simResult && (
            <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.cardBorder, width: '100%' }}>
              <Text style={{ color: colors.text, fontSize: 16, fontFamily: 'Inter_700Bold', textAlign: 'center', marginBottom: 12 }}>Simulation Results</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: Colors.primary, fontSize: 28, fontFamily: 'Inter_700Bold' }}>{simResult.score}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11, fontFamily: 'Inter_600SemiBold' }}>POINTS</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 10 }}>of 192 max</Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: Colors.success, fontSize: 28, fontFamily: 'Inter_700Bold' }}>{simResult.correct}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11, fontFamily: 'Inter_600SemiBold' }}>CORRECT</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 10 }}>of {simResult.total} picks</Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: Colors.gradientStart, fontSize: 28, fontFamily: 'Inter_700Bold' }}>{simResult.total > 0 ? Math.round((simResult.correct / simResult.total) * 100) : 0}%</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11, fontFamily: 'Inter_600SemiBold' }}>ACCURACY</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {REGION_NAMES.map(regionName => (
          <View key={regionName} style={{ marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, paddingHorizontal: 4 }}>
              <View style={{ width: 4, height: 20, backgroundColor: Colors.primary, borderRadius: 2 }} />
              <Text style={{ color: colors.text, fontSize: 18, fontFamily: 'Inter_700Bold' }}>{regionName} Region</Text>
            </View>
            {renderRegionBracket(regionName, true)}
          </View>
        ))}

        <View style={{ marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, paddingHorizontal: 4 }}>
            <View style={{ width: 4, height: 20, backgroundColor: Colors.gradientStart, borderRadius: 2 }} />
            <Text style={{ color: colors.text, fontSize: 18, fontFamily: 'Inter_700Bold' }}>Final Four</Text>
          </View>
          <View style={styles.roundSection}>
            {renderMatchupCard(ff.semifinal1, true)}
            {renderMatchupCard(ff.semifinal2, true)}
          </View>
        </View>

        <View style={{ marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, paddingHorizontal: 4 }}>
            <View style={{ width: 4, height: 20, backgroundColor: '#FFD700', borderRadius: 2 }} />
            <Text style={{ color: colors.text, fontSize: 18, fontFamily: 'Inter_700Bold' }}>Championship</Text>
          </View>
          <View style={styles.roundSection}>
            {renderMatchupCard(ff.championship, true)}
          </View>
        </View>
      </ScrollView>
    );
  };

  const renderStandingsView = () => {
    const standings = standingsData?.standings || standingsData || [];
    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={!!isRefreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />}
      >
        {!Array.isArray(standings) || standings.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <Ionicons name="trophy-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No standings yet</Text>
            <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>Check back after brackets are submitted</Text>
          </View>
        ) : (
          <View style={[styles.standingsCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.standingsHeader}>
              <Text style={[styles.standingsHeaderText, { color: colors.textMuted, flex: 0.5 }]}>#</Text>
              <Text style={[styles.standingsHeaderText, { color: colors.textMuted, flex: 2 }]}>Player</Text>
              <Text style={[styles.standingsHeaderText, { color: colors.textMuted, flex: 1, textAlign: 'right' }]}>Score</Text>
              <Text style={[styles.standingsHeaderText, { color: colors.textMuted, flex: 0.8, textAlign: 'right' }]}>Crowns</Text>
            </View>
            {(standings as any[]).map((entry: any, index: number) => {
              const isCurrentUser = authUser && entry.user_id === authUser.id;
              return (
                <View
                  key={entry.user_id || index}
                  style={[
                    styles.standingsRow,
                    isCurrentUser && { backgroundColor: 'rgba(34, 211, 238, 0.08)' },
                    index < standings.length - 1 && { borderBottomColor: colors.cardBorder, borderBottomWidth: StyleSheet.hairlineWidth },
                  ]}
                >
                  <View style={{ flex: 0.5 }}>
                    {index < 3 ? (
                      <MaterialCommunityIcons
                        name="crown"
                        size={18}
                        color={index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : '#CD7F32'}
                      />
                    ) : (
                      <Text style={[styles.rankText, { color: colors.textMuted }]}>{entry.rank || index + 1}</Text>
                    )}
                  </View>
                  <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[styles.avatarCircle, { backgroundColor: Colors.primary }]}>
                      <Text style={styles.avatarInitial}>
                        {(entry.username || 'U').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={[styles.standingsName, { color: isCurrentUser ? Colors.primary : colors.text }]} numberOfLines={1}>
                      {entry.username || 'Player'}
                      {isCurrentUser ? ' (You)' : ''}
                    </Text>
                  </View>
                  <Text style={[styles.standingsScore, { color: colors.text, flex: 1, textAlign: 'right' }]}>
                    {entry.score ?? 0}
                  </Text>
                  <View style={{ flex: 0.8, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                    <MaterialCommunityIcons name="crown" size={14} color={Colors.gradientEnd} />
                    <Text style={[styles.standingsCrowns, { color: colors.textSecondary }]}>
                      {entry.crowns ?? 0}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AnimatedBackground />

      <View style={[styles.header, { paddingTop: topPadding + 12 }]}>
        <Pressable onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace('/'); } }} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          Bracket Challenge
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={[styles.tabBar, { borderBottomColor: colors.cardBorder }]}>
        {tabs.map(tab => (
          <Pressable
            key={tab.key}
            onPress={() => setViewMode(tab.key)}
            style={[
              styles.tabItem,
              viewMode === tab.key && styles.tabItemActive,
              viewMode === tab.key && { borderBottomColor: Colors.primary },
            ]}
          >
            <Ionicons
              name={tab.icon as any}
              size={18}
              color={viewMode === tab.key ? Colors.primary : colors.textMuted}
            />
            <Text style={[styles.tabText, { color: viewMode === tab.key ? Colors.primary : colors.textMuted }]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {viewMode === 'rules' && renderRulesView()}
      {viewMode === 'pick' && renderPickView()}
      {viewMode === 'bracket' && renderBracketView()}
      {viewMode === 'standings' && renderStandingsView()}

      <Modal visible={showSuccessModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: colors.card, borderRadius: 20, padding: 32, alignItems: 'center', width: '100%', maxWidth: 340, borderWidth: 1, borderColor: Colors.gradientStart + '40' }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.success + '20', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
              <Ionicons name="checkmark-circle" size={48} color={Colors.success} />
            </View>
            <Text style={{ color: colors.text, fontSize: 22, fontFamily: 'Inter_700Bold', marginBottom: 8, textAlign: 'center' }}>
              Bracket Submitted!
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', marginBottom: 8 }}>
              Your 63 picks have been locked in.
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', marginBottom: 24 }}>
              Good luck in the tournament!
            </Text>
            <Pressable
              onPress={() => {
                setShowSuccessModal(false);
                router.replace('/');
              }}
              style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1, width: '100%' })}
            >
              <LinearGradient
                colors={[Colors.gradientStart, Colors.gradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ borderRadius: 12, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
              >
                <Ionicons name="home" size={18} color="#FFF" />
                <Text style={{ color: '#FFF', fontSize: 15, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 }}>GO TO HOME SCREEN</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  rulesTitle: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  freeBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  freeBadgeText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  scoringCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
  },
  scoringTitle: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    marginBottom: 16,
  },
  scoringRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  scoringRound: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  scoringRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoringPoints: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  scoringGames: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  maxScoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    marginTop: 4,
  },
  maxScoreLabel: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  maxScoreValue: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
  },
  rulesCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 24,
  },
  rulesCardTitle: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    marginBottom: 16,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  ruleNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ruleNumberText: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
  },
  ruleText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
    paddingTop: 4,
  },
  ctaWrapper: {
    marginTop: 8,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
  },
  ctaText: {
    color: '#FFF',
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
  },
  regionTabs: {
    maxHeight: 48,
  },
  regionTabsContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  regionTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  regionTabText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  progressBar: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  progressPercent: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  roundSection: {
    marginBottom: 20,
  },
  roundHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  roundBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  roundBadgeText: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
  },
  roundPoints: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  matchupCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  matchupTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teamSlot: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    minHeight: 48,
    justifyContent: 'center',
  },
  teamSlotText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
  teamContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  seedBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  seedText: {
    color: '#FFF',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
  },
  teamName: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  vsText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
  },
  lockedText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    marginTop: 12,
  },
  submitWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  standingsCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  standingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  standingsHeaderText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
  },
  standingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rankText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  standingsName: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    flex: 1,
  },
  standingsScore: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  standingsCrowns: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    marginTop: 4,
  },
});
