import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, TextInput, Alert, RefreshControl, Keyboard } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/colors';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import { useContests } from '@/lib/supabase-data';
import * as Haptics from 'expo-haptics';
import { useEnterContest, useSubmitPicks, useContestLeaderboard, useContestGames, useContestStandings, useContestResults, useMyContestPicks } from '@/lib/gamification-api';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

export default function ContestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  
  const { user: authUser } = useAuth();
  const queryClient = useQueryClient();
  const enterContest = useEnterContest();
  const submitPicks = useSubmitPicks();
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [tiebreaker, setTiebreaker] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const { data: myPicksData, refetch: refetchMyPicks, isRefetching: isRefetchingMyPicks } = useMyContestPicks(id!);
  const hasEntered = myPicksData?.entered || false;
  const { data: leaderboardData } = useContestLeaderboard(id!);
  const { data: contestGamesData, refetch: refetchGames, isRefetching: isRefetchingGames } = useContestGames(id!);
  const { data: standingsData } = useContestStandings(id!);
  const { data: resultsData } = useContestResults(id!);

  useEffect(() => {
    if (myPicksData?.picks && Object.keys(myPicksData.picks).length > 0) {
      setPicks(myPicksData.picks);
    }
    if (myPicksData?.tiebreaker != null) {
      setTiebreaker(String(myPicksData.tiebreaker));
    }
  }, [myPicksData]);
  
  const { data: contests = [], refetch: refetchContests, isRefetching: isRefetchingContests } = useContests();
  const contestRefreshing = isRefetchingContests || isRefetchingMyPicks || isRefetchingGames;
  const onRefresh = useCallback(() => { refetchContests(); refetchMyPicks(); refetchGames(); }, [refetchContests, refetchMyPicks, refetchGames]);
  
  const webTopPadding = Platform.OS === 'web' ? 67 : 0;
  const topPadding = insets.top || webTopPadding;

  const contest = contests.find(c => c.id === id);

  const resultGames = resultsData?.games || [];
  const resultMap = new Map<string, any>();
  resultGames.forEach((g: any) => resultMap.set(String(g.id), g));

  const matchups = (contestGamesData?.games || (contest?.scoring_json?.games) || []).map((g: any) => {
    const result = resultMap.get(String(g.id));
    return {
      id: String(g.id),
      team1: g.away_team || 'Away',
      team1Full: g.away_team_full || g.away_team || 'Away',
      team2: g.home_team || 'Home',
      team2Full: g.home_team_full || g.home_team || 'Home',
      date: g.date || '',
      league: g.league || '',
      time: result?.time ?? g.time ?? '',
      team1Score: result?.away_team_score ?? g.away_team_score,
      team2Score: result?.home_team_score ?? g.home_team_score,
      gameStatus: result?.status ?? g.status ?? '',
      winner: result?.winner ?? g.winner ?? '',
      overUnder: g.over_under ?? null,
      overPrice: g.over_price ?? null,
      underPrice: g.under_price ?? null,
      homeMoneyline: g.home_moneyline ?? null,
      awayMoneyline: g.away_moneyline ?? null,
    };
  });

  const allGamesFinal = matchups.length > 0 && matchups.every((m: any) => m.gameStatus === 'Final' || m.gameStatus === 'post');
  const anyGameLive = matchups.some((m: any) => {
    const s = m.gameStatus || '';
    return s.includes('Q') || s.includes('Half') || s.includes('OT') || s === 'in' || s === 'halftime';
  });
  const isConcluded = contest?.status === 'concluded' || allGamesFinal;

  if (!contest) return null;

  const handlePick = (matchupId: string, team: string) => {
    if (hasEntered) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPicks(prev => ({ ...prev, [matchupId]: team }));
  };

  const allPicked = matchups.length > 0 && Object.keys(picks).length === matchups.length;

  const handleSubmit = async () => {
    if (hasEntered) return;
    if (!authUser) {
      router.push('/profile');
      return;
    }
    setIsSubmitting(true);
    try {
      await enterContest.mutateAsync({ contestId: id!, picks, tiebreaker: tiebreaker ? parseInt(tiebreaker) : null });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ['my-picks', id] });
      queryClient.invalidateQueries({ queryKey: ['contests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contests'] });
      queryClient.invalidateQueries({ queryKey: ['userContests'] });
      setShowSuccess(true);
      setTimeout(() => router.back(), 1500);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit picks');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AnimatedBackground />
      
      <View style={[styles.header, { paddingTop: topPadding + 12 }]}>
        <Pressable onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace('/'); } }} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {contest.title}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {(showSuccess || hasEntered) && (
        <View style={styles.successBanner}>
          <Ionicons name={showSuccess ? "checkmark-circle" : "lock-closed"} size={18} color="#FFF" />
          <Text style={styles.successText}>
            {showSuccess ? 'Picks Submitted! Good luck!' : 'ENTERED — Picks Locked'}
          </Text>
        </View>
      )}

      {anyGameLive && hasEntered && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(239, 68, 68, 0.12)', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, marginHorizontal: 16, marginBottom: 4, gap: 8 }}>
          <Ionicons name="radio-button-on" size={14} color="#ef4444" />
          <Text style={{ color: '#ef4444', fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>Games In Progress</Text>
        </View>
      )}

      {contest.status === 'concluded' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 215, 0, 0.12)', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, marginHorizontal: 16, marginBottom: 4, gap: 8 }}>
          <MaterialCommunityIcons name="trophy" size={18} color="#FFD700" />
          <Text style={{ color: '#FFD700', fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>Contest Concluded</Text>
        </View>
      ) : allGamesFinal && hasEntered ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(34, 211, 238, 0.12)', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, marginHorizontal: 16, marginBottom: 4, gap: 8 }}>
          <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
          <Text style={{ color: Colors.primary, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>All Games Final</Text>
        </View>
      ) : null}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={contestRefreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />}
      >
        <View style={[styles.contestInfo, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.infoRow}>
            <View style={styles.leagueBadge}>
              <Text style={styles.leagueText}>{contest.league}</Text>
            </View>
            <Text style={[styles.sponsor, { color: colors.textSecondary }]}>
              Sponsored by {contest.sponsor}
            </Text>
          </View>
          <View style={styles.prizeRow}>
            <View style={styles.prizeItem}>
              <Text style={[styles.prizeLabel, { color: colors.textMuted }]}>Prize Pool</Text>
              <Text style={[styles.prizeValue, { color: Colors.primary }]}>{contest.prizePool}</Text>
            </View>
            <View style={styles.prizeItem}>
              <Text style={[styles.prizeLabel, { color: colors.textMuted }]}>Crowns</Text>
              <View style={styles.crownsRow}>
                <MaterialCommunityIcons name="crown" size={16} color={Colors.gradientEnd} />
                <Text style={[styles.prizeValue, { color: colors.text }]}>+{contest.crowns}</Text>
              </View>
            </View>
          </View>
        </View>

        {hasEntered && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(34, 197, 94, 0.12)', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, marginBottom: 16, gap: 8 }}>
            <Ionicons name="checkmark-circle" size={22} color="#22c55e" />
            <Text style={{ color: '#22c55e', fontSize: 15, fontFamily: 'Inter_600SemiBold' }}>Picks Submitted</Text>
          </View>
        )}

        <View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{hasEntered ? 'Your Picks' : 'Make Your Picks'}</Text>
          {!hasEntered && (
            <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 12, marginTop: -8 }}>
              {Object.keys(picks).length} of {matchups.length} picks made
            </Text>
          )}
            
            {matchups.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                <Ionicons name="basketball-outline" size={32} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 8 }}>No games assigned to this contest yet</Text>
              </View>
            ) : (
              matchups.map((matchup: any) => {
                const isFinal = matchup.gameStatus === 'Final' || matchup.gameStatus === 'post';
                const hasScores = matchup.team1Score !== undefined && matchup.team1Score !== null;
                const team1Won = matchup.winner === matchup.team1;
                const team2Won = matchup.winner === matchup.team2;
                return (
                <View key={matchup.id} style={[styles.matchupCard, { backgroundColor: colors.card, borderColor: isFinal ? 'rgba(34, 211, 238, 0.3)' : colors.cardBorder }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    {(matchup.date || matchup.time || matchup.gameStatus) ? (
                      <Text style={{ color: colors.textMuted, fontSize: 10, flex: 1 }}>
                        {matchup.date}{(() => { const t = matchup.time || matchup.gameStatus || ''; try { const d = new Date(t); if (!isNaN(d.getTime()) && /^\d{4}-\d{2}-\d{2}T/.test(t)) return ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET'; } catch {} return matchup.time ? ` · ${matchup.time}` : ''; })()}{matchup.league ? ` · ${matchup.league}` : ''}
                      </Text>
                    ) : <View style={{ flex: 1 }} />}
                    {isFinal && (
                      <View style={{ backgroundColor: 'rgba(34, 211, 238, 0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ color: Colors.primary, fontSize: 10, fontFamily: 'Inter_700Bold' }}>FINAL</Text>
                      </View>
                    )}
                    {!isFinal && (matchup.gameStatus?.includes?.('Q') || matchup.gameStatus?.includes?.('Half') || matchup.gameStatus?.includes?.('OT') || matchup.gameStatus === 'in' || matchup.gameStatus === 'halftime') && (
                      <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ color: '#ef4444', fontSize: 10, fontFamily: 'Inter_700Bold' }}>LIVE · {matchup.gameStatus}</Text>
                      </View>
                    )}
                  </View>
                  {contest.contest_type === 'over_under' ? (
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <View style={{ flex: 1, alignItems: 'center' }}>
                          <Text numberOfLines={2} style={[styles.teamName, { color: colors.text }]}>{matchup.team1Full}</Text>
                          {matchup.awayMoneyline != null && <Text style={{ color: colors.textMuted, fontSize: 10 }}>{matchup.awayMoneyline > 0 ? '+' : ''}{matchup.awayMoneyline}</Text>}
                          {hasScores && (
                            <Text style={{ fontSize: 18, fontFamily: 'Inter_700Bold', color: colors.text }}>{matchup.team1Score}</Text>
                          )}
                        </View>
                        <Text style={[styles.vs, { color: colors.textMuted }]}>{hasScores ? '' : 'VS'}</Text>
                        <View style={{ flex: 1, alignItems: 'center' }}>
                          <Text numberOfLines={2} style={[styles.teamName, { color: colors.text }]}>{matchup.team2Full}</Text>
                          {matchup.homeMoneyline != null && <Text style={{ color: colors.textMuted, fontSize: 10 }}>{matchup.homeMoneyline > 0 ? '+' : ''}{matchup.homeMoneyline}</Text>}
                          {hasScores && (
                            <Text style={{ fontSize: 18, fontFamily: 'Inter_700Bold', color: colors.text }}>{matchup.team2Score}</Text>
                          )}
                        </View>
                      </View>
                      {matchup.overUnder && (
                        <View style={{ alignItems: 'center', marginBottom: 10 }}>
                          <Text style={{ color: colors.textMuted, fontSize: 11, fontFamily: 'Inter_600SemiBold', marginBottom: 4 }}>TOTAL LINE</Text>
                          <View style={{ backgroundColor: 'rgba(34, 211, 238, 0.12)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 }}>
                            <Text style={{ color: Colors.primary, fontSize: 20, fontFamily: 'Inter_700Bold' }}>{matchup.overUnder}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                            {matchup.overPrice && (
                              <Text style={{ color: colors.textMuted, fontSize: 10 }}>
                                O {matchup.overPrice > 0 ? '+' : ''}{matchup.overPrice}
                              </Text>
                            )}
                            {matchup.underPrice && (
                              <Text style={{ color: colors.textMuted, fontSize: 10 }}>
                                U {matchup.underPrice > 0 ? '+' : ''}{matchup.underPrice}
                              </Text>
                            )}
                          </View>
                        </View>
                      )}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, opacity: hasEntered ? 0.7 : 1 }}>
                        <Pressable
                          onPress={() => handlePick(matchup.id, 'over')}
                          disabled={hasEntered}
                          style={[
                            styles.teamButton,
                            {
                              backgroundColor: picks[matchup.id] === 'over' ? 'rgba(34, 197, 94, 0.15)' : colors.cardBorder,
                              borderColor: picks[matchup.id] === 'over' ? '#22c55e' : 'transparent',
                            }
                          ]}
                        >
                          <Ionicons name="arrow-up" size={18} color={picks[matchup.id] === 'over' ? '#22c55e' : colors.textMuted} />
                          <Text style={[styles.teamName, { color: picks[matchup.id] === 'over' ? '#22c55e' : colors.text }]}>OVER</Text>
                          {picks[matchup.id] === 'over' && (
                            <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                          )}
                        </Pressable>
                        <Pressable
                          onPress={() => handlePick(matchup.id, 'under')}
                          disabled={hasEntered}
                          style={[
                            styles.teamButton,
                            {
                              backgroundColor: picks[matchup.id] === 'under' ? 'rgba(239, 68, 68, 0.15)' : colors.cardBorder,
                              borderColor: picks[matchup.id] === 'under' ? '#ef4444' : 'transparent',
                            }
                          ]}
                        >
                          <Ionicons name="arrow-down" size={18} color={picks[matchup.id] === 'under' ? '#ef4444' : colors.textMuted} />
                          <Text style={[styles.teamName, { color: picks[matchup.id] === 'under' ? '#ef4444' : colors.text }]}>UNDER</Text>
                          {picks[matchup.id] === 'under' && (
                            <Ionicons name="checkmark-circle" size={20} color="#ef4444" />
                          )}
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <>
                      {isConcluded && hasEntered && matchup.winner && picks[matchup.id] && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 8, gap: 6 }}>
                          {picks[matchup.id] === matchup.winner ? (
                            <>
                              <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
                              <Text style={{ color: '#22c55e', fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>Correct Pick</Text>
                            </>
                          ) : (
                            <>
                              <Ionicons name="close-circle" size={16} color="#ef4444" />
                              <Text style={{ color: '#ef4444', fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>Incorrect Pick</Text>
                            </>
                          )}
                        </View>
                      )}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, opacity: hasEntered ? 0.7 : 1 }}>
                        <Pressable
                          onPress={() => handlePick(matchup.id, matchup.team1)}
                          disabled={hasEntered}
                          style={[
                            styles.teamButton,
                            {
                              backgroundColor: picks[matchup.id] === matchup.team1
                                ? (isConcluded && matchup.winner
                                  ? (picks[matchup.id] === matchup.winner ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)')
                                  : 'rgba(34, 211, 238, 0.15)')
                                : colors.cardBorder,
                              borderColor: picks[matchup.id] === matchup.team1
                                ? (isConcluded && matchup.winner
                                  ? (picks[matchup.id] === matchup.winner ? '#22c55e' : '#ef4444')
                                  : Colors.primary)
                                : isFinal && team1Won ? 'rgba(34, 211, 238, 0.4)' : 'transparent',
                            }
                          ]}
                        >
                          <View style={{ alignItems: 'center', gap: 2, flex: 1 }}>
                            <Text numberOfLines={2} style={[styles.teamName, { color: isFinal && team1Won ? Colors.primary : colors.text }]}>{matchup.team1Full}</Text>
                            {matchup.awayMoneyline != null && <Text style={{ color: colors.textMuted, fontSize: 10 }}>{matchup.awayMoneyline > 0 ? '+' : ''}{matchup.awayMoneyline}</Text>}
                            {hasScores && (
                              <Text style={{ fontSize: 18, fontFamily: 'Inter_700Bold', color: isFinal && team1Won ? Colors.primary : colors.text }}>{matchup.team1Score}</Text>
                            )}
                          </View>
                          {picks[matchup.id] === matchup.team1 && isConcluded && matchup.winner && (
                            <Ionicons name={picks[matchup.id] === matchup.winner ? "checkmark-circle" : "close-circle"} size={20} color={picks[matchup.id] === matchup.winner ? '#22c55e' : '#ef4444'} />
                          )}
                          {picks[matchup.id] === matchup.team1 && !isConcluded && (
                            <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                          )}
                          {isFinal && team1Won && !picks[matchup.id] && (
                            <Ionicons name="trophy" size={16} color={Colors.primary} />
                          )}
                        </Pressable>
                        <Text style={[styles.vs, { color: colors.textMuted }]}>{hasScores ? '' : 'VS'}</Text>
                        <Pressable
                          onPress={() => handlePick(matchup.id, matchup.team2)}
                          disabled={hasEntered}
                          style={[
                            styles.teamButton,
                            {
                              backgroundColor: picks[matchup.id] === matchup.team2
                                ? (isConcluded && matchup.winner
                                  ? (picks[matchup.id] === matchup.winner ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)')
                                  : 'rgba(34, 211, 238, 0.15)')
                                : colors.cardBorder,
                              borderColor: picks[matchup.id] === matchup.team2
                                ? (isConcluded && matchup.winner
                                  ? (picks[matchup.id] === matchup.winner ? '#22c55e' : '#ef4444')
                                  : Colors.primary)
                                : isFinal && team2Won ? 'rgba(34, 211, 238, 0.4)' : 'transparent',
                            }
                          ]}
                        >
                          <View style={{ alignItems: 'center', gap: 2, flex: 1 }}>
                            <Text numberOfLines={2} style={[styles.teamName, { color: isFinal && team2Won ? Colors.primary : colors.text }]}>{matchup.team2Full}</Text>
                            {matchup.homeMoneyline != null && <Text style={{ color: colors.textMuted, fontSize: 10 }}>{matchup.homeMoneyline > 0 ? '+' : ''}{matchup.homeMoneyline}</Text>}
                            {hasScores && (
                              <Text style={{ fontSize: 18, fontFamily: 'Inter_700Bold', color: isFinal && team2Won ? Colors.primary : colors.text }}>{matchup.team2Score}</Text>
                            )}
                          </View>
                          {picks[matchup.id] === matchup.team2 && isConcluded && matchup.winner && (
                            <Ionicons name={picks[matchup.id] === matchup.winner ? "checkmark-circle" : "close-circle"} size={20} color={picks[matchup.id] === matchup.winner ? '#22c55e' : '#ef4444'} />
                          )}
                          {picks[matchup.id] === matchup.team2 && !isConcluded && (
                            <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                          )}
                          {isFinal && team2Won && !picks[matchup.id] && (
                            <Ionicons name="trophy" size={16} color={Colors.primary} />
                          )}
                        </Pressable>
                      </View>
                    </>
                  )}
                </View>
                );
              })
            )}

            <View style={styles.tiebreakerSection}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Tiebreaker</Text>
              <Text style={[styles.tiebreakerLabel, { color: colors.textSecondary }]}>
                Predict the combined score of the last game on the slate. If players are tied, the closest prediction wins the tiebreaker.
              </Text>
              {hasEntered ? (
                <View style={[styles.tiebreakerInput, { backgroundColor: colors.card, borderColor: colors.cardBorder, flexDirection: 'row', alignItems: 'center' }]}>
                  <Text style={{ color: colors.text, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>
                    {tiebreaker ? `${tiebreaker} points` : 'No prediction'}
                  </Text>
                </View>
              ) : (
                <TextInput
                  style={[styles.tiebreakerInput, { backgroundColor: colors.card, borderColor: colors.cardBorder, color: colors.text }]}
                  placeholder="Enter your prediction"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  returnKeyType="done"
                  value={tiebreaker}
                  onChangeText={setTiebreaker}
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                />
              )}
            </View>
          </View>

        {isConcluded && Array.isArray(standingsData) && standingsData.length > 0 && (
          <View style={{ backgroundColor: 'rgba(255, 215, 0, 0.12)', borderRadius: 16, padding: 20, marginBottom: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255, 215, 0, 0.3)' }}>
            <MaterialCommunityIcons name="trophy" size={44} color="#FFD700" />
            <Text style={{ color: colors.textMuted, fontSize: 11, fontFamily: 'Inter_600SemiBold', marginTop: 10, letterSpacing: 1.5, textTransform: 'uppercase' }}>Contest Winner</Text>
            <Text style={{ color: '#FFD700', fontSize: 24, fontFamily: 'Inter_700Bold', marginTop: 4 }}>
              {standingsData[0]?.username || 'Winner'}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 15, fontFamily: 'Inter_600SemiBold', marginTop: 4 }}>
              {standingsData[0]?.score ?? 0}/{standingsData[0]?.totalGames ?? matchups.length} correct
            </Text>
            {standingsData[0]?.tiebreaker != null && (
              <Text style={{ color: colors.textMuted, fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 }}>
                Tiebreaker: {standingsData[0].tiebreaker} pts
              </Text>
            )}
            {standingsData.length > 1 && (
              <View style={{ flexDirection: 'row', gap: 24, marginTop: 14 }}>
                {standingsData[1] && (
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ color: '#C0C0C0', fontSize: 12, fontFamily: 'Inter_700Bold' }}>2nd</Text>
                    <Text style={{ color: colors.text, fontSize: 14, fontFamily: 'Inter_600SemiBold', marginTop: 2 }}>{standingsData[1].username}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12, fontFamily: 'Inter_400Regular' }}>{standingsData[1].score ?? 0}/{standingsData[1]?.totalGames ?? matchups.length} correct</Text>
                  </View>
                )}
                {standingsData[2] && (
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ color: '#CD7F32', fontSize: 12, fontFamily: 'Inter_700Bold' }}>3rd</Text>
                    <Text style={{ color: colors.text, fontSize: 14, fontFamily: 'Inter_600SemiBold', marginTop: 2 }}>{standingsData[2].username}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12, fontFamily: 'Inter_400Regular' }}>{standingsData[2].score ?? 0}/{standingsData[2]?.totalGames ?? matchups.length} correct</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {Array.isArray(standingsData) && standingsData.length > 0 && (
          <View style={[styles.contestInfo, { backgroundColor: colors.card, borderColor: colors.cardBorder, marginTop: 16 }]}>
            <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.text, marginBottom: 12 }}>Standings</Text>
            {standingsData.map((entry: any, idx: number) => {
              const isCurrentUser = entry.user_id === authUser?.id;
              const rankColors: Record<number, string> = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32' };
              const rankColor = rankColors[entry.rank] || colors.textMuted;
              return (
                <View key={entry.user_id || idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: isCurrentUser ? 10 : 4, borderBottomWidth: idx < standingsData.length - 1 ? 1 : 0, borderBottomColor: colors.cardBorder, backgroundColor: isCurrentUser ? 'rgba(34, 211, 238, 0.1)' : 'transparent', borderRadius: isCurrentUser ? 8 : 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <View style={{ width: 28, alignItems: 'center' }}>
                      {entry.rank <= 3 ? (
                        <MaterialCommunityIcons name={entry.rank === 1 ? "trophy" : "medal"} size={18} color={rankColor} />
                      ) : (
                        <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.textMuted }}>#{entry.rank}</Text>
                      )}
                    </View>
                    <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.primary + '33', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 13, color: Colors.primary, fontFamily: 'Inter_600SemiBold' }}>{(entry.username || 'P').charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontFamily: isCurrentUser ? 'Inter_700Bold' : 'Inter_500Medium', color: isCurrentUser ? Colors.primary : colors.text }}>{entry.username || 'Player'}{isCurrentUser ? ' (You)' : ''}</Text>
                      {entry.tiebreaker != null && (
                        <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.textMuted }}>TB: {entry.tiebreaker}</Text>
                      )}
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.primary }}>{entry.score ?? 0}/{entry.totalGames ?? matchups.length}</Text>
                    <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.textMuted }}>correct</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {Array.isArray(leaderboardData) && leaderboardData.length > 0 && (!Array.isArray(standingsData) || standingsData.length === 0) && (
          <View style={[styles.contestInfo, { backgroundColor: colors.card, borderColor: colors.cardBorder, marginTop: 16 }]}>
            <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.text, marginBottom: 12 }}>Leaderboard</Text>
            {leaderboardData.slice(0, 10).map((entry: any, idx: number) => (
              <View key={entry.user_id || idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: idx < 9 ? 1 : 0, borderBottomColor: colors.cardBorder }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: idx < 3 ? '#FFD700' : colors.textMuted, width: 24 }}>#{idx + 1}</Text>
                  <Text style={{ fontSize: 14, fontFamily: 'Inter_500Medium', color: colors.text }}>{entry.username || 'Player'}</Text>
                </View>
                <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.primary }}>{entry.total_score ?? entry.score ?? 0} pts</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {hasEntered ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16, backgroundColor: isDark ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.95)', justifyContent: 'center' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Ionicons name="checkmark-circle" size={22} color="#22c55e" />
            <Text style={{ color: '#22c55e', fontSize: 15, fontFamily: 'Inter_600SemiBold' }}>Picks Submitted</Text>
          </View>
        </View>
      ) : (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16, backgroundColor: isDark ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.95)' }]}>
          <View style={styles.footerCrowns}>
            <MaterialCommunityIcons name="crown" size={20} color={Colors.gradientEnd} />
            <Text style={[styles.footerCrownsText, { color: colors.text }]}>+{contest.crowns} Crowns</Text>
          </View>
          <Pressable
            onPress={handleSubmit}
            disabled={!allPicked || isSubmitting}
            style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1, flex: 1 }]}
          >
            <LinearGradient
              colors={allPicked && !isSubmitting ? [Colors.primary, Colors.primaryDark] : [colors.cardBorder, colors.cardBorder]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.submitButton}
            >
              <Text style={[styles.submitText, { color: allPicked && !isSubmitting ? '#000' : colors.textMuted }]}>
                {isSubmitting ? 'SUBMITTING...' : `SUBMIT PICKS (+${contest.crowns} Crowns)`}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#22C55E',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    borderRadius: 10,
    marginBottom: 4,
  },
  successText: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  contestInfo: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  leagueBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  leagueText: {
    color: '#000',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
  },
  sponsor: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  prizeRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  prizeItem: {
    alignItems: 'center',
  },
  prizeLabel: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  prizeValue: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
  },
  crownsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 16,
  },
  matchupCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  teamButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 2,
    overflow: 'hidden',
  },
  teamName: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
    flexShrink: 1,
  },
  vs: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  tiebreakerSection: {
    marginBottom: 24,
  },
  tiebreakerLabel: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    marginBottom: 12,
  },
  tiebreakerInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  footerCrowns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerCrownsText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  submitButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
  },
  submitText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
  enterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 14,
    marginBottom: 24,
  },
  enterText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#000',
  },
});
