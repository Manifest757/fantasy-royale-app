import { fetch } from 'expo/fetch';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { getApiUrl } from '@/lib/query-client';
import {
  Contest,
  UserContest,
  Product,
  NewsItem,
  VideoItem,
  User,
  mockContests,
  mockUserContests,
  mockProducts,
  mockNews,
  mockVideos,
  promoSlides,
  tickerItems,
} from '@/data/mockData';

async function publicFetch(path: string) {
  const apiUrl = getApiUrl();
  const res = await fetch(new URL(path, apiUrl).toString(), {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

async function authFetch(path: string) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Not authenticated');
  const apiUrl = getApiUrl();
  const res = await fetch(new URL(path, apiUrl).toString(), {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  if (res.status === 401) {
    await supabase.auth.signOut();
    throw new Error('Session expired. Please sign in again.');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export function useContests() {
  return useQuery<Contest[]>({
    queryKey: ['contests'],
    queryFn: async () => {
      try {
        const data = await publicFetch('/api/contests');
        if (Array.isArray(data) && data.length > 0) return data;
        return mockContests;
      } catch {
        return mockContests;
      }
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useUserContests() {
  return useQuery<UserContest[]>({
    queryKey: ['userContests'],
    queryFn: async () => {
      try {
        const data = await authFetch('/api/me/contests');
        return Array.isArray(data) ? data : [];
      } catch {
        return [];
      }
    },
    staleTime: 30_000,
  });
}

export function useProducts() {
  return useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: async () => {
      try {
        const data = await publicFetch('/api/products');
        if (Array.isArray(data) && data.length > 0) return data;
        return mockProducts;
      } catch {
        return mockProducts;
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatar: string | null;
  crowns: number;
  contestsEntered: number;
  wins: number;
}

export function useLeaderboard(limit = 25) {
  return useQuery<LeaderboardEntry[]>({
    queryKey: ['leaderboard', limit],
    queryFn: async () => {
      try {
        const data = await publicFetch(`/api/leaderboard?limit=${limit}`);
        return Array.isArray(data) ? data : [];
      } catch {
        return [];
      }
    },
    staleTime: 60_000,
  });
}

export function useNews() {
  return useQuery<NewsItem[]>({
    queryKey: ['news'],
    queryFn: async () => {
      try {
        const data = await publicFetch('/api/news');
        if (Array.isArray(data) && data.length > 0) {
          return data.map((row: any) => ({
            id: row.id,
            source: row.source,
            headline: row.headline,
            timestamp: formatTimestamp(row.created_at),
            thumbnail: row.thumbnail,
          }));
        }
        return mockNews;
      } catch {
        return mockNews;
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useVideos() {
  return useQuery<VideoItem[]>({
    queryKey: ['videos'],
    queryFn: async () => {
      try {
        const data = await publicFetch('/api/videos');
        if (Array.isArray(data) && data.length > 0) {
          return data.map((row: any) => ({
            id: row.id,
            username: row.username,
            caption: row.caption,
            timestamp: row.is_live ? 'LIVE' : formatTimestamp(row.created_at),
            likes: row.likes,
            comments: row.comments,
            shares: row.shares,
            category: row.category,
            thumbnail: row.thumbnail,
          }));
        }
        return mockVideos;
      } catch {
        return mockVideos;
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function usePromoSlides() {
  return useQuery<typeof promoSlides>({
    queryKey: ['promoSlides'],
    queryFn: async () => {
      try {
        const data = await publicFetch('/api/promo-slides');
        if (Array.isArray(data) && data.length > 0) {
          return data.map((row: any) => ({
            id: row.id,
            type: row.type as 'gradient',
            title: row.title,
            subtitle: row.subtitle,
            sponsor: row.sponsor,
          }));
        }
        return promoSlides;
      } catch {
        return promoSlides;
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useTickerItems() {
  return useQuery<string[]>({
    queryKey: ['tickerItems'],
    queryFn: async () => {
      try {
        const data = await publicFetch('/api/ticker-items');
        if (Array.isArray(data) && data.length > 0) return data;
        return tickerItems;
      } catch {
        return tickerItems;
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUser() {
  return useQuery<User>({
    queryKey: ['user'],
    queryFn: async () => {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (!s?.access_token) throw new Error('Not authenticated');
      const data = await authFetch('/api/me/profile');
      return {
        id: data.id,
        username: data.username || 'Player',
        avatar: data.avatar || 'https://ui-avatars.com/api/?name=Player&background=6C63FF&color=fff&size=200&bold=true&format=png',
        crowns: data.crowns ?? 0,
        memberSince: formatMemberSince(data.memberSince),
        contestsEntered: data.contestsEntered ?? 0,
        wins: data.wins ?? 0,
        currentStreak: data.currentStreak ?? 0,
        bestStreak: data.bestStreak ?? 0,
        badgeCount: data.badgeCount ?? 0,
        role: data.role || 'user',
        is_admin: data.is_admin || false,
      };
    },
    staleTime: 30_000,
    refetchOnMount: 'always',
    retry: 2,
  });
}

export function useAvatarParts() {
  return useQuery({
    queryKey: ['avatarParts'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('avatar_parts')
          .select('*')
          .order('created_at', { ascending: true });

        if (error || !data) return [];

        return data.map(row => ({
          id: row.id,
          name: row.name,
          category: row.category,
          image: row.image || '',
          price: row.price ?? 0,
          rarity: row.rarity as 'common' | 'rare' | 'epic' | 'legendary',
          unlockCondition: {
            type: row.unlock_type as 'free' | 'crowns' | 'contest_entry' | 'achievement',
            value: row.unlock_value ?? undefined,
            contestId: row.unlock_contest_id ?? undefined,
            achievementId: row.unlock_achievement_id ?? undefined,
          },
          isDefault: row.is_default ?? false,
        }));
      } catch {
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useRoomItems() {
  return useQuery({
    queryKey: ['roomItems'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('room_items')
          .select('*')
          .order('created_at', { ascending: true });

        if (error || !data) return [];

        return data.map(row => ({
          id: row.id,
          name: row.name,
          category: row.category,
          image: row.image || '',
          price: row.price ?? 0,
          rarity: row.rarity as 'common' | 'rare' | 'epic' | 'legendary',
          unlockCondition: {
            type: row.unlock_type as 'free' | 'crowns' | 'contest_entry' | 'achievement',
            value: row.unlock_value ?? undefined,
            contestId: row.unlock_contest_id ?? undefined,
            achievementId: row.unlock_achievement_id ?? undefined,
          },
          url: row.url ?? undefined,
          width: row.width ?? 1,
          depth: row.depth ?? 1,
          zHeight: row.z_height ?? 1,
          placementSurface: row.placement_surface as 'floor' | 'wall' | 'stacked',
          isStackable: row.is_stackable ?? false,
          wallSide: row.wall_side as 'left' | 'right' | undefined,
        }));
      } catch {
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useRoomCategories() {
  return useQuery({
    queryKey: ['roomCategories'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('room_categories')
          .select('*')
          .order('sort_order', { ascending: true });

        if (error || !data) return ['furniture', 'decor', 'flooring', 'wall', 'trophy', 'tech'];

        return data.map(row => row.name);
      } catch {
        return ['furniture', 'decor', 'flooring', 'wall', 'trophy', 'tech'];
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useAchievements() {
  return useQuery({
    queryKey: ['achievements'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('achievements')
          .select('*')
          .order('created_at', { ascending: true });

        if (error || !data) return [];

        return data.map(row => ({
          id: row.id,
          name: row.name,
          description: row.description,
          icon: row.icon,
          condition: {
            type: row.condition_type as 'wins' | 'contests' | 'crowns_earned' | 'streak' | 'room_items' | 'avatar_parts',
            value: row.condition_value,
          },
          reward: row.reward,
        }));
      } catch {
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

function formatTimestamp(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return '1 day ago';
  return `${diffDays} days ago`;
}

function formatMemberSince(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

export function useBracketContests() {
  return useQuery({
    queryKey: ['bracket-contests'],
    queryFn: async () => {
      try {
        const data = await publicFetch('/api/bracket-contests');
        return data;
      } catch { return []; }
    },
  });
}

export function useBracketContest(id: string) {
  return useQuery({
    queryKey: ['bracket-contest', id],
    queryFn: () => publicFetch(`/api/bracket-contests/${id}`),
    enabled: !!id,
  });
}

export function useBracketTeams(contestId: string) {
  return useQuery({
    queryKey: ['bracket-teams', contestId],
    queryFn: () => publicFetch(`/api/bracket-contests/${contestId}/teams`),
    enabled: !!contestId,
  });
}

export function useBracketStandings(contestId: string) {
  return useQuery({
    queryKey: ['bracket-standings', contestId],
    queryFn: () => publicFetch(`/api/bracket-contests/${contestId}/standings`),
    enabled: !!contestId,
  });
}

export function useBracketMyPicks(contestId: string) {
  return useQuery({
    queryKey: ['bracket-my-picks', contestId],
    queryFn: () => authFetch(`/api/bracket-contests/${contestId}/my-picks`),
    enabled: !!contestId,
  });
}
