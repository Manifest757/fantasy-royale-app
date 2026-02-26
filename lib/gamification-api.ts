import { fetch } from 'expo/fetch';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { getApiUrl } from '@/lib/query-client';

// Helper to get auth token
async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

// Helper for authenticated API calls
async function authFetch(path: string, options: RequestInit = {}): Promise<any> {
  const token = await getAuthToken();
  const apiUrl = getApiUrl();
  const url = new URL(path, apiUrl);
  
  const res = await fetch(url.toString(), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  
  if (res.status === 401) {
    await supabase.auth.signOut();
    throw new Error('Session expired. Please sign in again.');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  
  return res.json();
}

// Helper for public API calls (no auth required)
async function publicFetch(path: string, options: RequestInit = {}): Promise<any> {
  const apiUrl = getApiUrl();
  const url = new URL(path, apiUrl);
  
  const res = await fetch(url.toString(), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  
  return res.json();
}

// === Crown Hooks ===

export function useCrownBalance() {
  return useQuery({
    queryKey: ['crown-balance'],
    queryFn: () => authFetch('/api/gamification/crown-balance'),
    staleTime: 30_000,
    gcTime: 60_000,
    refetchOnMount: 'always',
  });
}

export function useCrownLedger(limit = 20) {
  return useQuery({
    queryKey: ['crown-ledger', limit],
    queryFn: () => authFetch(`/api/gamification/crown-ledger?limit=${limit}`),
    staleTime: 60_000,
  });
}

// === Streak Hooks ===

export function useStreak() {
  return useQuery({
    queryKey: ['streak'],
    queryFn: () => authFetch('/api/gamification/streak'),
    staleTime: 60_000,
    gcTime: 60_000,
    refetchOnMount: 'always',
  });
}

// === ELO Hooks ===

export function useElo(sportId: string, seasonId: string) {
  return useQuery({
    queryKey: ['elo', sportId, seasonId],
    queryFn: () => authFetch(`/api/gamification/elo/${sportId}/${seasonId}`),
    enabled: !!sportId && !!seasonId,
    staleTime: 60_000,
  });
}

export function useChampionLeaderboard(sportId: string, seasonId: string) {
  return useQuery({
    queryKey: ['champion-leaderboard', sportId, seasonId],
    queryFn: () => authFetch(`/api/gamification/leaderboard/champion/${sportId}/${seasonId}`),
    enabled: !!sportId && !!seasonId,
    staleTime: 120_000,
  });
}

// === Badge Hooks ===

export function useBadges() {
  return useQuery({
    queryKey: ['badges'],
    queryFn: () => authFetch('/api/gamification/badges'),
    staleTime: 60_000,
    gcTime: 60_000,
    refetchOnMount: 'always',
  });
}

// === Giveaway Hooks ===

export function useGiveaway(monthKey: string) {
  return useQuery({
    queryKey: ['giveaway', monthKey],
    queryFn: () => authFetch(`/api/gamification/giveaway/${monthKey}`),
    enabled: !!monthKey,
    staleTime: 120_000,
  });
}

// === Config Hook (public) ===

export function useGamificationConfig() {
  return useQuery({
    queryKey: ['gamification-config'],
    queryFn: () => authFetch('/api/gamification/config'),
    staleTime: 300_000,
  });
}

// === Catalog Hooks (Public) ===

export function useCatalogAvatarParts() {
  return useQuery({
    queryKey: ['catalog-avatar-parts'],
    queryFn: () => publicFetch('/api/catalog/avatar-parts'),
    staleTime: 5 * 60_000,
  });
}

export function useCatalogRoomItems() {
  return useQuery({
    queryKey: ['catalog-room-items'],
    queryFn: () => publicFetch('/api/catalog/room-items'),
    staleTime: 5 * 60_000,
  });
}

export function useCatalogRoomCategories() {
  return useQuery({
    queryKey: ['catalog-room-categories'],
    queryFn: () => publicFetch('/api/catalog/room-categories'),
    staleTime: 5 * 60_000,
  });
}

// === Unlock Status Hook ===

export function useUnlockStatus() {
  return useQuery({
    queryKey: ['unlock-status'],
    queryFn: () => authFetch('/api/me/unlock-status'),
    staleTime: 30_000,
  });
}

// === Purchase Mutation ===

export function usePurchaseItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemType, itemId, price }: { itemType: string; itemId: string; price: number }) =>
      authFetch('/api/gamification/purchase', { method: 'POST', body: JSON.stringify({ itemType, itemId, price }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crown-balance'] });
      queryClient.invalidateQueries({ queryKey: ['crown-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['avatar-config'] });
      queryClient.invalidateQueries({ queryKey: ['user-summary'] });
    },
  });
}

// === Contest Mutations ===

export function useEnterContest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ contestId, picks, tiebreaker }: { contestId: string; picks: Record<string, string>; tiebreaker?: number | null }) =>
      authFetch(`/api/contests/${contestId}/enter`, { method: 'POST', body: JSON.stringify({ picks, tiebreaker }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crown-balance'] });
      queryClient.invalidateQueries({ queryKey: ['crown-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['streak'] });
      queryClient.invalidateQueries({ queryKey: ['badges'] });
      queryClient.invalidateQueries({ queryKey: ['contests'] });
      queryClient.invalidateQueries({ queryKey: ['userContests'] });
      queryClient.invalidateQueries({ queryKey: ['my-picks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contests'] });
    },
  });
}

export function useSubmitPicks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ contestId, picks }: { contestId: string; picks: any }) =>
      authFetch(`/api/contests/${contestId}/picks`, { method: 'POST', body: JSON.stringify({ picks }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userContests'] });
      queryClient.invalidateQueries({ queryKey: ['my-picks'] });
    },
  });
}

export function useMyContestPicks(contestId: string) {
  return useQuery({
    queryKey: ['my-picks', contestId],
    queryFn: () => authFetch(`/api/contests/${contestId}/my-picks`),
    enabled: !!contestId,
  });
}

// === Admin Mutations ===

export function useUpdateGamificationConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (config: Record<string, any>) =>
      authFetch('/api/admin/gamification/config', { method: 'PUT', body: JSON.stringify(config) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gamification-config'] });
    },
  });
}

export function useGradeContest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ contestId, results }: { contestId: string; results: any[] }) =>
      authFetch(`/api/admin/contests/${contestId}/grade`, { method: 'POST', body: JSON.stringify({ results }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contests'] });
    },
  });
}

export function useConcludeContest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (contestId: string) =>
      authFetch(`/api/admin/contests/${contestId}/conclude`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contests'] });
      queryClient.invalidateQueries({ queryKey: ['crown-balance'] });
    },
  });
}

export function useLockGiveaway() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (monthKey: string) =>
      authFetch(`/api/admin/giveaways/${monthKey}/lock`, { method: 'POST' }),
    onSuccess: (_, monthKey) => {
      queryClient.invalidateQueries({ queryKey: ['giveaway', monthKey] });
    },
  });
}

export function useDrawGiveaway() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ monthKey, numWinners }: { monthKey: string; numWinners: number }) =>
      authFetch(`/api/admin/giveaways/${monthKey}/draw`, { method: 'POST', body: JSON.stringify({ numWinners }) }),
    onSuccess: (_, { monthKey }) => {
      queryClient.invalidateQueries({ queryKey: ['giveaway', monthKey] });
    },
  });
}

export function useAdminEloConfigs() {
  return useQuery({
    queryKey: ['admin-elo-configs'],
    queryFn: () => authFetch('/api/admin/elo/configs'),
    staleTime: 30_000,
  });
}

export function useCreateEloConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (config: any) =>
      authFetch('/api/admin/elo/config', { method: 'POST', body: JSON.stringify(config) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-elo-configs'] });
    },
  });
}

export function useAdminBadges() {
  return useQuery({
    queryKey: ['admin-badges'],
    queryFn: () => authFetch('/api/admin/badges'),
    staleTime: 30_000,
  });
}

export function useCreateBadge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (badge: any) =>
      authFetch('/api/admin/badges', { method: 'POST', body: JSON.stringify(badge) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['badges'] });
      queryClient.invalidateQueries({ queryKey: ['admin-badges'] });
    },
  });
}

// === User Summary ===

export function useUserSummary() {
  return useQuery({
    queryKey: ['user-summary'],
    queryFn: () => authFetch('/api/me/summary'),
    staleTime: 30_000,
  });
}

// === Notification Hooks ===

export function useNotifications(limit = 20, unreadOnly = false) {
  return useQuery({
    queryKey: ['notifications', limit, unreadOnly],
    queryFn: () => authFetch(`/api/notifications?limit=${limit}&unreadOnly=${unreadOnly}`),
    staleTime: 30_000,
  });
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ['notifications-count'],
    queryFn: () => authFetch('/api/notifications/count'),
    staleTime: 15_000,
  });
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => authFetch('/api/notifications/read', { method: 'POST', body: JSON.stringify({ ids }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
    },
  });
}

export function useDeleteNotifications() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => authFetch('/api/notifications', { method: 'DELETE', body: JSON.stringify({ ids }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
    },
  });
}

// === Activity Feed ===

export function useActivityFeed(limit = 50) {
  return useQuery({
    queryKey: ['activity-feed', limit],
    queryFn: () => authFetch(`/api/activity-feed?limit=${limit}`),
    staleTime: 60_000,
  });
}

// === Contest Leaderboard ===

export function useContestLeaderboard(contestId: string) {
  return useQuery({
    queryKey: ['contest-leaderboard', contestId],
    queryFn: () => authFetch(`/api/leaderboards/contest/${contestId}`),
    enabled: !!contestId,
    staleTime: 60_000,
  });
}

export function useContestGames(contestId: string) {
  return useQuery({
    queryKey: ['contest-games', contestId],
    queryFn: () => authFetch(`/api/contests/${contestId}/games`),
    enabled: !!contestId,
    staleTime: 5 * 60_000,
  });
}

export function useContestResults(contestId: string) {
  return useQuery({
    queryKey: ['contest-results', contestId],
    queryFn: () => publicFetch(`/api/contests/${contestId}/results`),
    enabled: !!contestId,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

// === Referral Hooks ===

export function useGenerateReferralCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authFetch('/api/referral/generate', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-summary'] });
    },
  });
}

export function useApplyReferral() {
  return useMutation({
    mutationFn: (code: string) => authFetch('/api/referral/apply', { method: 'POST', body: JSON.stringify({ code }) }),
  });
}

// === Admin Hooks ===

export function useAuditLog(limit = 100) {
  return useQuery({
    queryKey: ['audit-log', limit],
    queryFn: () => authFetch(`/api/admin/audit-log?limit=${limit}`),
    staleTime: 30_000,
  });
}

export function useFraudFlags(unresolvedOnly = true) {
  return useQuery({
    queryKey: ['fraud-flags', unresolvedOnly],
    queryFn: () => authFetch(`/api/admin/fraud-flags?unresolvedOnly=${unresolvedOnly}`),
    staleTime: 30_000,
  });
}

export function useResolveFraudFlag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ flagId, note }: { flagId: string; note: string }) =>
      authFetch(`/api/admin/fraud-flags/${flagId}/resolve`, { method: 'POST', body: JSON.stringify({ note }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fraud-flags'] });
    },
  });
}

export function useRuleSets() {
  return useQuery({
    queryKey: ['rule-sets'],
    queryFn: () => authFetch('/api/admin/rule-sets'),
    staleTime: 60_000,
  });
}

export function useCreateRuleSet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ruleSet: any) =>
      authFetch('/api/admin/rule-sets', { method: 'POST', body: JSON.stringify(ruleSet) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rule-sets'] });
    },
  });
}

export function useActivateRuleSet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      authFetch(`/api/admin/rule-sets/${id}/activate`, { method: 'PUT' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rule-sets'] });
      queryClient.invalidateQueries({ queryKey: ['gamification-config'] });
    },
  });
}

// === Admin Avatar Parts CRUD ===

export function useAdminAvatarParts() {
  return useQuery({
    queryKey: ['admin-avatar-parts'],
    queryFn: () => authFetch('/api/admin/avatar-parts'),
    staleTime: 30_000,
  });
}

export function useCreateAvatarPart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (part: any) =>
      authFetch('/api/admin/avatar-parts', { method: 'POST', body: JSON.stringify(part) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-avatar-parts'] });
      queryClient.invalidateQueries({ queryKey: ['audit-log'] });
    },
  });
}

export function useUpdateAvatarPart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) =>
      authFetch(`/api/admin/avatar-parts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-avatar-parts'] });
      queryClient.invalidateQueries({ queryKey: ['audit-log'] });
    },
  });
}

export function useDeleteAvatarPart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      authFetch(`/api/admin/avatar-parts/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-avatar-parts'] });
      queryClient.invalidateQueries({ queryKey: ['audit-log'] });
    },
  });
}

// === Admin Room Items CRUD ===

export function useAdminRoomItems() {
  return useQuery({
    queryKey: ['admin-room-items'],
    queryFn: () => authFetch('/api/admin/room-items'),
    staleTime: 30_000,
  });
}

export function useCreateRoomItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (item: any) =>
      authFetch('/api/admin/room-items', { method: 'POST', body: JSON.stringify(item) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-room-items'] });
      queryClient.invalidateQueries({ queryKey: ['audit-log'] });
    },
  });
}

export function useUpdateRoomItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) =>
      authFetch(`/api/admin/room-items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-room-items'] });
      queryClient.invalidateQueries({ queryKey: ['audit-log'] });
    },
  });
}

export function useDeleteRoomItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      authFetch(`/api/admin/room-items/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-room-items'] });
      queryClient.invalidateQueries({ queryKey: ['audit-log'] });
    },
  });
}

// === Admin Room Categories CRUD ===

export function useAdminRoomCategories() {
  return useQuery({
    queryKey: ['admin-room-categories'],
    queryFn: () => authFetch('/api/admin/room-categories'),
    staleTime: 30_000,
  });
}

export function useCreateRoomCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      authFetch('/api/admin/room-categories', { method: 'POST', body: JSON.stringify({ name }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-room-categories'] });
    },
  });
}

export function useUpdateRoomCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      authFetch(`/api/admin/room-categories/${id}`, { method: 'PUT', body: JSON.stringify({ name }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-room-categories'] });
    },
  });
}

export function useDeleteRoomCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      authFetch(`/api/admin/room-categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-room-categories'] });
    },
  });
}

// === Admin Badges Edit/Delete ===

export function useUpdateBadge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) =>
      authFetch(`/api/admin/badges/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['badges'] });
      queryClient.invalidateQueries({ queryKey: ['admin-badges'] });
      queryClient.invalidateQueries({ queryKey: ['audit-log'] });
    },
  });
}

export function useDeleteBadge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      authFetch(`/api/admin/badges/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['badges'] });
      queryClient.invalidateQueries({ queryKey: ['admin-badges'] });
      queryClient.invalidateQueries({ queryKey: ['audit-log'] });
    },
  });
}

// === Admin Contests CRUD ===

export function useCreateContest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (contest: any) =>
      authFetch('/api/admin/contests', { method: 'POST', body: JSON.stringify(contest) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contests'] });
      queryClient.invalidateQueries({ queryKey: ['audit-log'] });
    },
  });
}

export function useUpdateContest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) =>
      authFetch(`/api/admin/contests/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contests'] });
      queryClient.invalidateQueries({ queryKey: ['audit-log'] });
    },
  });
}

export function useDeleteContest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      authFetch(`/api/admin/contests/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contests'] });
      queryClient.invalidateQueries({ queryKey: ['audit-log'] });
    },
  });
}

// === Admin Rule Sets Edit/Delete ===

export function useUpdateRuleSet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) =>
      authFetch(`/api/admin/rule-sets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rule-sets'] });
      queryClient.invalidateQueries({ queryKey: ['audit-log'] });
    },
  });
}

export function useDeleteRuleSet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      authFetch(`/api/admin/rule-sets/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rule-sets'] });
      queryClient.invalidateQueries({ queryKey: ['audit-log'] });
    },
  });
}

// === Admin Giveaway Listing ===

export function useAdminGiveaways() {
  return useQuery({
    queryKey: ['admin-giveaways'],
    queryFn: () => authFetch('/api/admin/giveaways'),
    staleTime: 60_000,
  });
}

// === Giveaway V2 System ===

export function useGiveawaysV2() {
  return useQuery({
    queryKey: ['admin-giveaways-v2'],
    queryFn: () => authFetch('/api/admin/giveaways-v2'),
    staleTime: 30_000,
  });
}

export function useGiveawayV2Detail(id: string | null) {
  return useQuery({
    queryKey: ['admin-giveaway-v2', id],
    queryFn: () => authFetch(`/api/admin/giveaways-v2/${id}`),
    enabled: !!id,
    staleTime: 15_000,
  });
}

export function useCreateGiveawayV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) =>
      authFetch('/api/admin/giveaways-v2', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-giveaways-v2'] });
    },
  });
}

export function useUpdateGiveawayV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) =>
      authFetch(`/api/admin/giveaways-v2/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-giveaways-v2'] });
    },
  });
}

export function useDeleteGiveawayV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      authFetch(`/api/admin/giveaways-v2/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-giveaways-v2'] });
    },
  });
}

export function useOpenGiveawayV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      authFetch(`/api/admin/giveaways-v2/${id}/open`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-giveaways-v2'] });
    },
  });
}

export function useEvaluateGiveawayV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      authFetch(`/api/admin/giveaways-v2/${id}/evaluate`, { method: 'POST' }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['admin-giveaways-v2'] });
      queryClient.invalidateQueries({ queryKey: ['admin-giveaway-v2', id] });
    },
  });
}

export function useLockGiveawayV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      authFetch(`/api/admin/giveaways-v2/${id}/lock`, { method: 'POST' }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['admin-giveaways-v2'] });
      queryClient.invalidateQueries({ queryKey: ['admin-giveaway-v2', id] });
    },
  });
}

export function useDrawGiveawayV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, num_winners }: { id: string; num_winners: number }) =>
      authFetch(`/api/admin/giveaways-v2/${id}/draw`, { method: 'POST', body: JSON.stringify({ num_winners }) }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-giveaways-v2'] });
      queryClient.invalidateQueries({ queryKey: ['admin-giveaway-v2', id] });
    },
  });
}

export function useAwardGiveawayWinner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ giveaway_id, winner_id, prize_details }: { giveaway_id: string; winner_id: string; prize_details?: any }) =>
      authFetch(`/api/admin/giveaways-v2/${giveaway_id}/award`, { method: 'POST', body: JSON.stringify({ winner_id, prize_details }) }),
    onSuccess: (_, { giveaway_id }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-giveaways-v2'] });
      queryClient.invalidateQueries({ queryKey: ['admin-giveaway-v2', giveaway_id] });
    },
  });
}

export function useCancelGiveawayV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      authFetch(`/api/admin/giveaways-v2/${id}/cancel`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-giveaways-v2'] });
    },
  });
}

// === Admin Referrals Listing ===

export function useAdminReferrals() {
  return useQuery({
    queryKey: ['admin-referrals'],
    queryFn: () => authFetch('/api/admin/referrals'),
    staleTime: 60_000,
  });
}

// === Admin User Management ===

export function useAdminUsers(search = '') {
  return useQuery({
    queryKey: ['admin-users', search],
    queryFn: () => authFetch(`/api/admin/users${search ? `?search=${encodeURIComponent(search)}` : ''}`),
    staleTime: 30_000,
  });
}

export function useAdjustUserCrowns() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, amount, reason }: { userId: string; amount: number; reason: string }) =>
      authFetch(`/api/admin/users/${userId}/adjust-crowns`, { method: 'POST', body: JSON.stringify({ amount, reason }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['audit-log'] });
    },
  });
}

export function useAwardContestCrowns() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ contestId, user_ids, amount, reason }: { contestId: string; user_ids: string[]; amount: number; reason: string }) =>
      authFetch(`/api/admin/contests/${contestId}/award-crowns`, { method: 'POST', body: JSON.stringify({ user_ids, amount, reason }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['audit-log'] });
    },
  });
}

export function useTodayGames() {
  return useQuery({
    queryKey: ['today-games'],
    queryFn: () => authFetch('/api/games/today'),
    staleTime: 60_000,
  });
}

export function useGamesRange(startDate: string, endDate: string, league: string, enabled: boolean) {
  return useQuery({
    queryKey: ['games-range', startDate, endDate, league],
    queryFn: () => authFetch(`/api/games/range?start_date=${startDate}&end_date=${endDate}&league=${league}`),
    enabled: enabled && !!startDate && !!endDate && !!league,
    staleTime: 5 * 60_000,
  });
}

export function useSportsSeasons() {
  return useQuery({
    queryKey: ['sports-seasons'],
    queryFn: () => authFetch('/api/sports/seasons'),
    staleTime: 60 * 60_000,
  });
}

export function useSportsTeams(league: string, enabled: boolean) {
  return useQuery({
    queryKey: ['sports-teams', league],
    queryFn: () => authFetch(`/api/sports/teams?league=${league}`),
    enabled: enabled && !!league,
    staleTime: 10 * 60_000,
  });
}

export function useSportsPlayers(league: string, search: string, enabled: boolean) {
  return useQuery({
    queryKey: ['sports-players', league, search],
    queryFn: () => authFetch(`/api/sports/players?league=${league}&search=${encodeURIComponent(search)}`),
    enabled: enabled && !!league && search.length >= 2,
    staleTime: 5 * 60_000,
  });
}

export function useBanUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      authFetch(`/api/admin/users/${userId}/ban`, { method: 'PUT' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['audit-log'] });
    },
  });
}

export function useUnbanUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      authFetch(`/api/admin/users/${userId}/unban`, { method: 'PUT' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['audit-log'] });
    },
  });
}

export function useToggleUserAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      authFetch(`/api/admin/users/${userId}/toggle-admin`, { method: 'PUT' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['audit-log'] });
    },
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; password: string; username: string; is_admin?: boolean; role?: string }) =>
      authFetch('/api/admin/users', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['audit-log'] });
    },
  });
}

export function useEditUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, ...data }: { userId: string; username?: string; email?: string; password?: string; role?: string; is_admin?: boolean }) =>
      authFetch(`/api/admin/users/${userId}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['audit-log'] });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      authFetch(`/api/admin/users/${userId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['audit-log'] });
    },
  });
}

// === Player Data Sync Hooks ===

export function useAvatarConfig() {
  return useQuery({
    queryKey: ['avatar-config'],
    queryFn: () => authFetch('/api/me/avatar-config'),
    staleTime: 30_000,
  });
}

export function useSaveAvatarConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (config: { avatar?: any; owned_avatar_parts?: string[]; owned_room_items?: string[]; contests_entered?: string[] }) =>
      authFetch('/api/me/avatar-config', { method: 'PUT', body: JSON.stringify(config) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['avatar-config'] });
    },
  });
}

export function useRoomLayout() {
  return useQuery({
    queryKey: ['room-layout'],
    queryFn: () => authFetch('/api/me/room-layout'),
    staleTime: 30_000,
  });
}

export function useSaveRoomLayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (layout: { placed_items: any[] }) =>
      authFetch('/api/me/room-layout', { method: 'PUT', body: JSON.stringify(layout) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['room-layout'] });
    },
  });
}

// === Image Upload ===

export async function uploadAssetImage(file: { uri: string; name: string; type: string }, folder: string = 'general'): Promise<{ url: string; path: string }> {
  const token = await getAuthToken();
  const apiUrl = getApiUrl();
  const url = new URL('/api/admin/upload-image', apiUrl);

  const response = await fetch(file.uri);
  const blob = await response.blob();

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'image/webp',
      'X-Filename': file.name,
      'X-Folder': folder,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: blob,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(err.error || 'Upload failed');
  }

  return res.json();
}

// Helper to get current month key
export function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// === Sponsor Hooks ===

export function useSponsorProfile() {
  return useQuery({
    queryKey: ['sponsor-profile'],
    queryFn: () => authFetch('/api/sponsor/profile'),
    staleTime: 60_000,
    retry: false,
  });
}

export function useApplyAsSponsor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { company_name: string; website?: string; description?: string; contact_email: string }) =>
      authFetch('/api/sponsor/apply', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sponsor-profile'] });
    },
  });
}

export function useUpdateSponsorProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<{ company_name: string; brand_logo: string; brand_color: string; website: string; description: string; contact_email: string }>) =>
      authFetch('/api/sponsor/profile', { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sponsor-profile'] });
    },
  });
}

export function useSponsorCampaigns(enabled = true) {
  return useQuery({
    queryKey: ['sponsor-campaigns'],
    queryFn: () => authFetch('/api/sponsor/campaigns'),
    staleTime: 30_000,
    retry: false,
    enabled,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; description?: string; sport?: string; budget_crowns?: number; prize_description?: string; banner_image?: string; brand_color?: string; target_entries?: number; starts_at?: string; ends_at?: string }) =>
      authFetch('/api/sponsor/campaigns', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sponsor-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['sponsor-analytics'] });
    },
  });
}

export function useSponsorCampaign(id: string) {
  return useQuery({
    queryKey: ['sponsor-campaign', id],
    queryFn: () => authFetch(`/api/sponsor/campaigns/${id}`),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; [key: string]: any }) =>
      authFetch(`/api/sponsor/campaigns/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sponsor-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['sponsor-campaign'] });
    },
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      authFetch(`/api/sponsor/campaigns/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sponsor-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['sponsor-analytics'] });
    },
  });
}

export function useSubmitCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      authFetch(`/api/sponsor/campaigns/${id}/submit`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sponsor-campaigns'] });
    },
  });
}

export function useSponsorAnalytics(enabled = true) {
  return useQuery({
    queryKey: ['sponsor-analytics'],
    queryFn: () => authFetch('/api/sponsor/analytics'),
    staleTime: 60_000,
    retry: false,
    enabled,
  });
}

export function useCampaignAnalytics(id: string) {
  return useQuery({
    queryKey: ['campaign-analytics', id],
    queryFn: () => authFetch(`/api/sponsor/campaigns/${id}/analytics`),
    enabled: !!id,
    staleTime: 60_000,
  });
}

// === Admin Sponsor Hooks ===

export function useAdminSponsors(enabled = true, status?: string) {
  return useQuery({
    queryKey: ['admin-sponsors', status],
    queryFn: () => authFetch(`/api/admin/sponsors${status ? `?status=${status}` : ''}`),
    staleTime: 30_000,
    retry: false,
    enabled,
  });
}

export function useAdminSponsorPortal(sponsorId: string | null) {
  return useQuery({
    queryKey: ['admin-sponsor-portal', sponsorId],
    queryFn: () => authFetch(`/api/admin/sponsors/${sponsorId}/portal`),
    enabled: !!sponsorId,
    staleTime: 30_000,
  });
}

export function useApproveSponsor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      authFetch(`/api/admin/sponsors/${id}/approve`, { method: 'PUT' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sponsors'] });
    },
  });
}

export function useSuspendSponsor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      authFetch(`/api/admin/sponsors/${id}/suspend`, { method: 'PUT' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sponsors'] });
    },
  });
}

export function useRejectSponsor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      authFetch(`/api/admin/sponsors/${id}/reject`, { method: 'PUT', body: JSON.stringify({ reason }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sponsors'] });
    },
  });
}

export function useAdminSponsorCampaigns(status?: string) {
  return useQuery({
    queryKey: ['admin-sponsor-campaigns', status],
    queryFn: () => authFetch(`/api/admin/sponsor-campaigns${status ? `?status=${status}` : ''}`),
    staleTime: 30_000,
  });
}

export function useApproveCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      authFetch(`/api/admin/sponsor-campaigns/${id}/approve`, { method: 'PUT' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sponsor-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['sponsor-campaigns'] });
    },
  });
}

export function useContestStandings(contestId: string) {
  return useQuery({
    queryKey: ['contest-standings', contestId],
    queryFn: () => publicFetch(`/api/contests/${contestId}/standings`),
    enabled: !!contestId,
    staleTime: 30_000,
  });
}

// === Admin Brand Sponsors ===

export function useCreateSponsor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) =>
      authFetch('/api/admin/sponsors', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sponsors'] });
    },
  });
}

export function useUpdateSponsor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) =>
      authFetch(`/api/admin/sponsors/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sponsors'] });
    },
  });
}

export function useDeleteSponsor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      authFetch(`/api/admin/sponsors/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sponsors'] });
    },
  });
}

export function useSponsorResources(sponsorId: string) {
  return useQuery({
    queryKey: ['sponsor-resources', sponsorId],
    queryFn: () => authFetch(`/api/admin/sponsors/${sponsorId}/resources`),
    enabled: !!sponsorId,
    staleTime: 30_000,
  });
}

export function useUploadSponsorResource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sponsorId, ...data }: { sponsorId: string; file_data: string; file_name: string; file_type: string; mime_type: string }) =>
      authFetch(`/api/admin/sponsors/${sponsorId}/resources`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sponsor-resources', variables.sponsorId] });
      queryClient.invalidateQueries({ queryKey: ['admin-sponsors'] });
    },
  });
}

export function useDeleteSponsorResource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sponsorId, fileName }: { sponsorId: string; fileName: string }) =>
      authFetch(`/api/admin/sponsors/${sponsorId}/resources/${encodeURIComponent(fileName)}`, { method: 'DELETE' }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sponsor-resources', variables.sponsorId] });
    },
  });
}

export function useRejectCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, admin_notes }: { id: string; admin_notes: string }) =>
      authFetch(`/api/admin/sponsor-campaigns/${id}/reject`, { method: 'PUT', body: JSON.stringify({ admin_notes }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sponsor-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['sponsor-campaigns'] });
    },
  });
}
