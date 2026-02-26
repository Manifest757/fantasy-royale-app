import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  useCrownBalance,
  useCatalogAvatarParts,
  useCatalogRoomItems,
  useCatalogRoomCategories,
  useUnlockStatus,
  usePurchaseItem,
  useBadges,
} from '@/lib/gamification-api';
import { useQueryClient } from '@tanstack/react-query';

export type UnlockConditionType = 'crowns' | 'contest_entry' | 'achievement' | 'free' | 'elo_placement' | 'giveaway_win' | 'referral_count';

export interface UnlockCondition {
  type: UnlockConditionType;
  value?: number;
  contestId?: string;
  seasonId?: string;
  achievementId?: string;
  giveawayId?: string;
  eloRank?: number;
}

export interface AvatarPart {
  id: string;
  name: string;
  category: 'shoes' | 'pants' | 'shirt' | 'jacket' | 'accessories' | 'hair' | 'eyebrows' | 'eyes' | 'mouth' | 'body';
  image: string;
  price: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlockCondition: UnlockCondition;
  isDefault?: boolean;
}

export type PlacementSurface = 'floor' | 'wall' | 'stacked';

export interface RoomItem {
  id: string;
  name: string;
  category: string;
  image: string;
  price: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlockCondition: UnlockCondition;
  url?: string;
  width: number;
  depth: number;
  zHeight: number;
  placementSurface: PlacementSurface;
  isStackable?: boolean;
  wallSide?: 'left' | 'right';
}

export interface PlacedItem {
  id: string;
  itemId: string;
  x: number;
  y: number;
  rotation: number;
}

export interface UserAvatar {
  shoes?: string;
  pants?: string;
  shirt?: string;
  jacket?: string;
  accessories?: string;
  hair?: string;
  eyebrows?: string;
  eyes?: string;
  mouth?: string;
  body?: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: {
    type: 'wins' | 'contests' | 'crowns_earned' | 'streak' | 'room_items' | 'avatar_parts';
    value: number;
  };
  reward: number;
  isCompleted?: boolean;
}

interface GamificationContextValue {
  crowns: number;
  crownStatus: string;
  addCrowns: (amount: number) => void;
  spendCrowns: (amount: number) => boolean;

  ownedAvatarParts: string[];
  ownedRoomItems: string[];
  purchaseAvatarPart: (partId: string, price: number) => Promise<boolean>;
  purchaseRoomItem: (itemId: string, price: number) => Promise<boolean>;
  isItemUnlocked: (item: AvatarPart | RoomItem) => boolean;

  avatar: UserAvatar;
  setAvatarPart: (category: string, partId: string | undefined) => void;

  placedItems: PlacedItem[];
  placeItem: (item: PlacedItem) => void;
  removeItem: (placedItemId: string) => void;
  moveItem: (placedItemId: string, x: number, y: number) => void;
  rotateItem: (placedItemId: string) => void;

  avatarParts: AvatarPart[];
  roomItems: RoomItem[];
  achievements: Achievement[];

  addAvatarPart: (part: AvatarPart) => void;
  updateAvatarPart: (id: string, updates: Partial<AvatarPart>) => void;
  deleteAvatarPart: (id: string) => void;

  addRoomItem: (item: RoomItem) => void;
  updateRoomItem: (id: string, updates: Partial<RoomItem>) => void;
  deleteRoomItem: (id: string) => void;

  roomCategories: string[];
  addRoomCategory: (category: string) => void;
  updateRoomCategory: (oldName: string, newName: string) => void;
  deleteRoomCategory: (category: string) => void;

  contestsEntered: string[];
  enterContest: (contestId: string) => void;

  badgeIds: string[];
  eloData: Array<{ sport_id: string; season_id: string; current_elo_int: number; current_tier: string }>;
  giveawayWinIds: string[];
  referralCount: number;

  isAdmin: boolean;
  setIsAdmin: (value: boolean) => void;
}

const GamificationContext = createContext<GamificationContextValue | null>(null);

const STORAGE_KEYS = {
  ownedAvatarParts: 'fr_owned_avatar_parts',
  ownedRoomItems: 'fr_owned_room_items',
  avatar: 'fr_avatar',
  placedItems: 'fr_placed_items',
  isAdmin: 'fr_is_admin',
};

const DEFAULT_ROOM_CATEGORIES = ['furniture', 'decor', 'flooring', 'wall', 'trophy', 'tech'];

const defaultAvatarParts: AvatarPart[] = [
  { id: 'body_default', name: 'Default Body', category: 'body', image: '', price: 0, rarity: 'common', unlockCondition: { type: 'free' }, isDefault: true },
  { id: 'body_athletic', name: 'Athletic Build', category: 'body', image: '', price: 150, rarity: 'rare', unlockCondition: { type: 'crowns', value: 150 } },
  { id: 'hair_short', name: 'Short Hair', category: 'hair', image: '', price: 0, rarity: 'common', unlockCondition: { type: 'free' }, isDefault: true },
  { id: 'hair_long', name: 'Long Hair', category: 'hair', image: '', price: 75, rarity: 'common', unlockCondition: { type: 'crowns', value: 75 } },
  { id: 'hair_mohawk', name: 'Mohawk', category: 'hair', image: '', price: 150, rarity: 'rare', unlockCondition: { type: 'crowns', value: 1000 } },
  { id: 'eyes_default', name: 'Default Eyes', category: 'eyes', image: '', price: 0, rarity: 'common', unlockCondition: { type: 'free' }, isDefault: true },
  { id: 'eyes_sunglasses', name: 'Sunglasses', category: 'eyes', image: '', price: 100, rarity: 'rare', unlockCondition: { type: 'crowns', value: 100 } },
  { id: 'mouth_default', name: 'Default Mouth', category: 'mouth', image: '', price: 0, rarity: 'common', unlockCondition: { type: 'free' }, isDefault: true },
  { id: 'mouth_smile', name: 'Big Smile', category: 'mouth', image: '', price: 50, rarity: 'common', unlockCondition: { type: 'crowns', value: 50 } },
  { id: 'shirt_default', name: 'Basic Tee', category: 'shirt', image: '', price: 0, rarity: 'common', unlockCondition: { type: 'free' }, isDefault: true },
  { id: 'shirt_jersey', name: 'Sports Jersey', category: 'shirt', image: '', price: 200, rarity: 'rare', unlockCondition: { type: 'contest_entry', contestId: '1' } },
  { id: 'shirt_hoodie', name: 'Champion Hoodie', category: 'shirt', image: '', price: 300, rarity: 'epic', unlockCondition: { type: 'crowns', value: 300 } },
  { id: 'jacket_none', name: 'No Jacket', category: 'jacket', image: '', price: 0, rarity: 'common', unlockCondition: { type: 'free' }, isDefault: true },
  { id: 'jacket_blazer', name: 'Victory Blazer', category: 'jacket', image: '', price: 400, rarity: 'epic', unlockCondition: { type: 'achievement', achievementId: 'first_win' } },
  { id: 'pants_default', name: 'Basic Pants', category: 'pants', image: '', price: 0, rarity: 'common', unlockCondition: { type: 'free' }, isDefault: true },
  { id: 'pants_shorts', name: 'Athletic Shorts', category: 'pants', image: '', price: 75, rarity: 'common', unlockCondition: { type: 'crowns', value: 75 } },
  { id: 'shoes_default', name: 'Sneakers', category: 'shoes', image: '', price: 0, rarity: 'common', unlockCondition: { type: 'free' }, isDefault: true },
  { id: 'shoes_gold', name: 'Gold Kicks', category: 'shoes', image: '', price: 500, rarity: 'legendary', unlockCondition: { type: 'crowns', value: 500 } },
  { id: 'acc_none', name: 'No Accessories', category: 'accessories', image: '', price: 0, rarity: 'common', unlockCondition: { type: 'free' }, isDefault: true },
  { id: 'acc_chain', name: 'Gold Chain', category: 'accessories', image: '', price: 350, rarity: 'epic', unlockCondition: { type: 'crowns', value: 350 } },
];

const defaultRoomItems: RoomItem[] = [
  { id: 'floor_wood', name: 'Wood Floor', category: 'flooring', image: 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27100%27 height=%27100%27%3E%3Crect width=%27100%27 height=%27100%27 fill=%27%238B6914%27/%3E%3Crect x=%270%27 y=%270%27 width=%2750%27 height=%2750%27 fill=%27%23A0782C%27/%3E%3Crect x=%2750%27 y=%2750%27 width=%2750%27 height=%2750%27 fill=%27%23A0782C%27/%3E%3C/svg%3E', price: 0, rarity: 'common', unlockCondition: { type: 'free' }, width: 1, depth: 1, zHeight: 0, placementSurface: 'floor' },
  { id: 'floor_marble', name: 'Marble Floor', category: 'flooring', image: '', price: 200, rarity: 'rare', unlockCondition: { type: 'crowns', value: 200 }, width: 1, depth: 1, zHeight: 0, placementSurface: 'floor' },
  { id: 'wall_basic', name: 'Basic Wall', category: 'wall', image: '', price: 0, rarity: 'common', unlockCondition: { type: 'free' }, width: 1, depth: 1, zHeight: 4, placementSurface: 'wall' },
  { id: 'wall_sports', name: 'Sports Wall', category: 'wall', image: '/attached_assets/Room-Items_0001s_0000s_0001_abstract-vivid-sports-shaped-art-w_1770388427690.png', price: 150, rarity: 'rare', unlockCondition: { type: 'contest_entry', contestId: '1' }, width: 1, depth: 1, zHeight: 4, placementSurface: 'wall', wallSide: 'left' },
  { id: 'sofa_basic', name: 'Basic Sofa', category: 'furniture', image: '', price: 100, rarity: 'common', unlockCondition: { type: 'crowns', value: 100 }, width: 2, depth: 1, zHeight: 1, placementSurface: 'floor' },
  { id: 'sofa_luxury', name: 'Luxury Sofa', category: 'furniture', image: '', price: 400, rarity: 'epic', unlockCondition: { type: 'crowns', value: 400 }, width: 3, depth: 1, zHeight: 1, placementSurface: 'floor' },
  { id: 'table_coffee', name: 'Coffee Table', category: 'furniture', image: '', price: 75, rarity: 'common', unlockCondition: { type: 'crowns', value: 75 }, width: 1, depth: 1, zHeight: 1, placementSurface: 'floor', isStackable: true },
  { id: 'tv_basic', name: 'TV Screen', category: 'tech', image: '', price: 200, rarity: 'rare', unlockCondition: { type: 'crowns', value: 200 }, width: 2, depth: 1, zHeight: 2, placementSurface: 'wall', url: 'https://fantasyroyale.com/live' },
  { id: 'tv_giant', name: 'Giant Screen', category: 'tech', image: '', price: 600, rarity: 'legendary', unlockCondition: { type: 'crowns', value: 600 }, width: 3, depth: 2, zHeight: 3, placementSurface: 'wall', url: 'https://fantasyroyale.com/live' },
  { id: 'trophy_bronze', name: 'Bronze Trophy', category: 'trophy', image: '', price: 0, rarity: 'rare', unlockCondition: { type: 'achievement', achievementId: 'first_win' }, width: 1, depth: 1, zHeight: 1, placementSurface: 'stacked' },
  { id: 'trophy_silver', name: 'Silver Trophy', category: 'trophy', image: '', price: 0, rarity: 'epic', unlockCondition: { type: 'achievement', achievementId: 'five_wins' }, width: 1, depth: 1, zHeight: 1, placementSurface: 'stacked' },
  { id: 'trophy_gold', name: 'Gold Trophy', category: 'trophy', image: '', price: 0, rarity: 'legendary', unlockCondition: { type: 'achievement', achievementId: 'ten_wins' }, width: 1, depth: 1, zHeight: 1, placementSurface: 'stacked' },
  { id: 'plant_small', name: 'Small Plant', category: 'decor', image: '', price: 50, rarity: 'common', unlockCondition: { type: 'crowns', value: 50 }, width: 1, depth: 1, zHeight: 1, placementSurface: 'floor', isStackable: true },
  { id: 'poster_team', name: 'Team Poster', category: 'decor', image: '', price: 100, rarity: 'rare', unlockCondition: { type: 'contest_entry', contestId: '2' }, width: 1, depth: 1, zHeight: 2, placementSurface: 'wall', url: 'https://fantasyroyale.com/teams' },
  { id: 'gaming_chair', name: 'Gaming Chair', category: 'furniture', image: '', price: 300, rarity: 'epic', unlockCondition: { type: 'crowns', value: 300 }, width: 1, depth: 1, zHeight: 2, placementSurface: 'floor' },
  { id: 'neon_sign', name: 'Neon Crown Sign', category: 'decor', image: '', price: 500, rarity: 'legendary', unlockCondition: { type: 'crowns', value: 500 }, width: 2, depth: 1, zHeight: 1, placementSurface: 'wall' },
];

const defaultAchievements: Achievement[] = [
  { id: 'first_win', name: 'First Victory', description: 'Win your first contest', icon: 'trophy', condition: { type: 'wins', value: 1 }, reward: 100 },
  { id: 'five_wins', name: 'Rising Star', description: 'Win 5 contests', icon: 'star', condition: { type: 'wins', value: 5 }, reward: 250 },
  { id: 'ten_wins', name: 'Champion', description: 'Win 10 contests', icon: 'medal', condition: { type: 'wins', value: 10 }, reward: 500 },
  { id: 'contest_10', name: 'Competitor', description: 'Enter 10 contests', icon: 'flag', condition: { type: 'contests', value: 10 }, reward: 150 },
  { id: 'streak_5', name: 'Hot Streak', description: 'Win 5 contests in a row', icon: 'flame', condition: { type: 'streak', value: 5 }, reward: 300 },
  { id: 'collector', name: 'Collector', description: 'Own 20 avatar parts', icon: 'grid', condition: { type: 'avatar_parts', value: 20 }, reward: 200 },
  { id: 'decorator', name: 'Decorator', description: 'Place 10 items in your room', icon: 'home', condition: { type: 'room_items', value: 10 }, reward: 200 },
];

const syncAvatarConfig = (userId: string, updates: Record<string, any>) => {
  supabase
    .from('user_avatar_configs')
    .upsert({ user_id: userId, ...updates, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .then(({ error }) => { if (error) console.error('Avatar config sync error:', error); });
};

const syncRoomLayout = (userId: string, placedItems: any[]) => {
  supabase
    .from('user_room_layouts')
    .upsert({ user_id: userId, placed_items: placedItems, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .then(({ error }) => { if (error) console.error('Room layout sync error:', error); });
};

export function GamificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAuthenticated = !!user?.id;

  const crownBalanceQuery = useCrownBalance();
  const catalogAvatarPartsQuery = useCatalogAvatarParts();
  const catalogRoomItemsQuery = useCatalogRoomItems();
  const catalogRoomCategoriesQuery = useCatalogRoomCategories();
  const unlockStatusQuery = useUnlockStatus();
  const purchaseMutation = usePurchaseItem();

  const crowns = crownBalanceQuery.data?.total ?? 0;
  const crownStatus = crownBalanceQuery.data?.status ?? 'Squire';

  const badgeIds: string[] = unlockStatusQuery.data?.badges ?? [];
  const eloData = unlockStatusQuery.data?.elo ?? [];
  const giveawayWinIds: string[] = unlockStatusQuery.data?.giveawayWins ?? [];
  const referralCount: number = unlockStatusQuery.data?.referralCount ?? 0;
  const contestsEnteredFromServer: string[] = unlockStatusQuery.data?.contestsEntered ?? [];

  const [ownedAvatarParts, setOwnedAvatarParts] = useState<string[]>([]);
  const [ownedRoomItems, setOwnedRoomItems] = useState<string[]>([]);
  const [avatar, setAvatar] = useState<UserAvatar>({});
  const [placedItems, setPlacedItems] = useState<PlacedItem[]>([]);
  const [contestsEntered, setContestsEntered] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [achievements] = useState<Achievement[]>(defaultAchievements);

  const avatarParts: AvatarPart[] = useMemo(() => {
    const catalogData = catalogAvatarPartsQuery.data;
    if (Array.isArray(catalogData) && catalogData.length > 0) return catalogData;
    return defaultAvatarParts;
  }, [catalogAvatarPartsQuery.data]);

  const roomItems: RoomItem[] = useMemo(() => {
    const catalogData = catalogRoomItemsQuery.data;
    if (Array.isArray(catalogData) && catalogData.length > 0) return catalogData;
    return defaultRoomItems;
  }, [catalogRoomItemsQuery.data]);

  const roomCategories: string[] = useMemo(() => {
    const catData = catalogRoomCategoriesQuery.data;
    if (Array.isArray(catData) && catData.length > 0) return catData.map((c: any) => c.name);
    return DEFAULT_ROOM_CATEGORIES;
  }, [catalogRoomCategoriesQuery.data]);

  const mergedContestsEntered = useMemo(() => {
    const merged = new Set([...contestsEntered, ...contestsEnteredFromServer]);
    return Array.from(merged);
  }, [contestsEntered, contestsEnteredFromServer]);

  const prevUserIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (prevUserIdRef.current && !user?.id) {
      AsyncStorage.multiRemove([
        STORAGE_KEYS.ownedAvatarParts,
        STORAGE_KEYS.ownedRoomItems,
        STORAGE_KEYS.avatar,
        STORAGE_KEYS.placedItems,
        STORAGE_KEYS.isAdmin,
      ]).catch(() => {});
      setOwnedAvatarParts([]);
      setOwnedRoomItems([]);
      setAvatar({});
      setPlacedItems([]);
      setContestsEntered([]);
      setIsAdmin(false);
      queryClient.clear();
    }
    if (user?.id && user.id !== prevUserIdRef.current) {
      queryClient.invalidateQueries();
    }
    prevUserIdRef.current = user?.id;
  }, [user?.id, queryClient]);

  useEffect(() => {
    const loadLocal = async () => {
      try {
        const [storedOwnedParts, storedOwnedItems, storedAvatar, storedPlaced, storedAdmin] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.ownedAvatarParts),
          AsyncStorage.getItem(STORAGE_KEYS.ownedRoomItems),
          AsyncStorage.getItem(STORAGE_KEYS.avatar),
          AsyncStorage.getItem(STORAGE_KEYS.placedItems),
          AsyncStorage.getItem(STORAGE_KEYS.isAdmin),
        ]);

        if (storedOwnedParts) setOwnedAvatarParts(JSON.parse(storedOwnedParts));
        if (storedOwnedItems) setOwnedRoomItems(JSON.parse(storedOwnedItems));
        if (storedAvatar) setAvatar(JSON.parse(storedAvatar));
        if (storedPlaced) setPlacedItems(JSON.parse(storedPlaced));
        if (storedAdmin) setIsAdmin(storedAdmin === 'true');
      } catch (e) {
        console.error('Failed to load gamification data:', e);
      }
    };
    loadLocal();
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    const loadFromSupabase = async () => {
      try {
        const [avatarRes, roomRes] = await Promise.all([
          supabase.from('user_avatar_configs').select('*').eq('user_id', user.id).single(),
          supabase.from('user_room_layouts').select('*').eq('user_id', user.id).single(),
        ]);

        if (avatarRes.data) {
          if (avatarRes.data.avatar && Object.keys(avatarRes.data.avatar).length > 0) {
            setAvatar(avatarRes.data.avatar);
            AsyncStorage.setItem(STORAGE_KEYS.avatar, JSON.stringify(avatarRes.data.avatar));
          }
          if (avatarRes.data.owned_avatar_parts?.length > 0) {
            setOwnedAvatarParts(avatarRes.data.owned_avatar_parts);
            AsyncStorage.setItem(STORAGE_KEYS.ownedAvatarParts, JSON.stringify(avatarRes.data.owned_avatar_parts));
          }
          if (avatarRes.data.owned_room_items?.length > 0) {
            setOwnedRoomItems(avatarRes.data.owned_room_items);
            AsyncStorage.setItem(STORAGE_KEYS.ownedRoomItems, JSON.stringify(avatarRes.data.owned_room_items));
          }
          if (avatarRes.data.contests_entered?.length > 0) {
            setContestsEntered(avatarRes.data.contests_entered);
          }
        }

        if (roomRes.data?.placed_items?.length > 0) {
          setPlacedItems(roomRes.data.placed_items);
          AsyncStorage.setItem(STORAGE_KEYS.placedItems, JSON.stringify(roomRes.data.placed_items));
        }
      } catch (e) {
        console.error('Failed to load from Supabase:', e);
      }
    };

    loadFromSupabase();
  }, [user?.id]);

  const addCrowns = useCallback((_amount: number) => {
    queryClient.invalidateQueries({ queryKey: ['crown-balance'] });
    queryClient.invalidateQueries({ queryKey: ['crown-ledger'] });
    queryClient.invalidateQueries({ queryKey: ['user-summary'] });
  }, [queryClient]);

  const spendCrowns = useCallback((_amount: number): boolean => {
    return false;
  }, []);

  const isItemUnlocked = useCallback((item: AvatarPart | RoomItem): boolean => {
    const cond = item.unlockCondition;
    switch (cond.type) {
      case 'free':
        return true;
      case 'crowns':
        return crowns >= (cond.value || 0);
      case 'contest_entry':
        return !!cond.contestId && mergedContestsEntered.includes(cond.contestId);
      case 'achievement':
        return !!cond.achievementId && badgeIds.includes(cond.achievementId);
      case 'elo_placement':
        if (!cond.eloRank) return false;
        return eloData.some(e => e.current_elo_int > 0);
      case 'giveaway_win':
        if (cond.giveawayId) return giveawayWinIds.includes(cond.giveawayId);
        return giveawayWinIds.length > 0;
      case 'referral_count':
        return referralCount >= (cond.value || 1);
      default:
        return false;
    }
  }, [crowns, mergedContestsEntered, badgeIds, eloData, giveawayWinIds, referralCount]);

  const purchaseAvatarPart = useCallback(async (partId: string, price: number): Promise<boolean> => {
    if (ownedAvatarParts.includes(partId)) return true;
    if (crowns < price) return false;

    try {
      await purchaseMutation.mutateAsync({ itemType: 'avatar_part', itemId: partId, price });
      setOwnedAvatarParts(prev => {
        const newVal = [...prev, partId];
        AsyncStorage.setItem(STORAGE_KEYS.ownedAvatarParts, JSON.stringify(newVal));
        return newVal;
      });
      queryClient.invalidateQueries({ queryKey: ['crown-balance'] });
      queryClient.invalidateQueries({ queryKey: ['unlock-status'] });
      return true;
    } catch (e) {
      console.error('Purchase avatar part failed:', e);
      return false;
    }
  }, [ownedAvatarParts, crowns, purchaseMutation, queryClient]);

  const purchaseRoomItem = useCallback(async (itemId: string, price: number): Promise<boolean> => {
    if (ownedRoomItems.includes(itemId)) return true;
    if (crowns < price) return false;

    try {
      await purchaseMutation.mutateAsync({ itemType: 'room_item', itemId, price });
      setOwnedRoomItems(prev => {
        const newVal = [...prev, itemId];
        AsyncStorage.setItem(STORAGE_KEYS.ownedRoomItems, JSON.stringify(newVal));
        return newVal;
      });
      queryClient.invalidateQueries({ queryKey: ['crown-balance'] });
      queryClient.invalidateQueries({ queryKey: ['unlock-status'] });
      return true;
    } catch (e) {
      console.error('Purchase room item failed:', e);
      return false;
    }
  }, [ownedRoomItems, crowns, purchaseMutation, queryClient]);

  const setAvatarPart = useCallback((category: string, partId: string | undefined) => {
    setAvatar(prev => {
      const newVal = { ...prev, [category]: partId };
      AsyncStorage.setItem(STORAGE_KEYS.avatar, JSON.stringify(newVal));
      if (user?.id) {
        syncAvatarConfig(user.id, { avatar: newVal });
      }
      return newVal;
    });
  }, [user?.id]);

  const placeItem = useCallback((item: PlacedItem) => {
    setPlacedItems(prev => {
      const newVal = [...prev, item];
      AsyncStorage.setItem(STORAGE_KEYS.placedItems, JSON.stringify(newVal));
      if (user?.id) {
        syncRoomLayout(user.id, newVal);
      }
      return newVal;
    });
  }, [user?.id]);

  const removeItem = useCallback((placedItemId: string) => {
    setPlacedItems(prev => {
      const newVal = prev.filter(p => p.id !== placedItemId);
      AsyncStorage.setItem(STORAGE_KEYS.placedItems, JSON.stringify(newVal));
      if (user?.id) {
        syncRoomLayout(user.id, newVal);
      }
      return newVal;
    });
  }, [user?.id]);

  const moveItem = useCallback((placedItemId: string, x: number, y: number) => {
    setPlacedItems(prev => {
      const newVal = prev.map(p => p.id === placedItemId ? { ...p, x, y } : p);
      AsyncStorage.setItem(STORAGE_KEYS.placedItems, JSON.stringify(newVal));
      if (user?.id) {
        syncRoomLayout(user.id, newVal);
      }
      return newVal;
    });
  }, [user?.id]);

  const rotateItem = useCallback((placedItemId: string) => {
    setPlacedItems(prev => {
      const newVal = prev.map(p => p.id === placedItemId ? { ...p, rotation: (p.rotation + 90) % 360 } : p);
      AsyncStorage.setItem(STORAGE_KEYS.placedItems, JSON.stringify(newVal));
      if (user?.id) {
        syncRoomLayout(user.id, newVal);
      }
      return newVal;
    });
  }, [user?.id]);

  const addAvatarPart = useCallback((part: AvatarPart) => {
    queryClient.invalidateQueries({ queryKey: ['catalog-avatar-parts'] });
    queryClient.invalidateQueries({ queryKey: ['admin-avatar-parts'] });
  }, [queryClient]);

  const updateAvatarPart = useCallback((id: string, updates: Partial<AvatarPart>) => {
    queryClient.invalidateQueries({ queryKey: ['catalog-avatar-parts'] });
    queryClient.invalidateQueries({ queryKey: ['admin-avatar-parts'] });
  }, [queryClient]);

  const deleteAvatarPart = useCallback((id: string) => {
    queryClient.invalidateQueries({ queryKey: ['catalog-avatar-parts'] });
    queryClient.invalidateQueries({ queryKey: ['admin-avatar-parts'] });
  }, [queryClient]);

  const addRoomItem = useCallback((item: RoomItem) => {
    queryClient.invalidateQueries({ queryKey: ['catalog-room-items'] });
    queryClient.invalidateQueries({ queryKey: ['admin-room-items'] });
  }, [queryClient]);

  const updateRoomItem = useCallback((id: string, updates: Partial<RoomItem>) => {
    queryClient.invalidateQueries({ queryKey: ['catalog-room-items'] });
    queryClient.invalidateQueries({ queryKey: ['admin-room-items'] });
  }, [queryClient]);

  const deleteRoomItem = useCallback((id: string) => {
    queryClient.invalidateQueries({ queryKey: ['catalog-room-items'] });
    queryClient.invalidateQueries({ queryKey: ['admin-room-items'] });
  }, [queryClient]);

  const addRoomCategory = useCallback((category: string) => {
    queryClient.invalidateQueries({ queryKey: ['catalog-room-categories'] });
    queryClient.invalidateQueries({ queryKey: ['admin-room-categories'] });
  }, [queryClient]);

  const updateRoomCategory = useCallback((oldName: string, newName: string) => {
    queryClient.invalidateQueries({ queryKey: ['catalog-room-categories'] });
    queryClient.invalidateQueries({ queryKey: ['admin-room-categories'] });
  }, [queryClient]);

  const deleteRoomCategory = useCallback((category: string) => {
    queryClient.invalidateQueries({ queryKey: ['catalog-room-categories'] });
    queryClient.invalidateQueries({ queryKey: ['admin-room-categories'] });
  }, [queryClient]);

  const enterContest = useCallback((contestId: string) => {
    if (!mergedContestsEntered.includes(contestId)) {
      setContestsEntered(prev => {
        const newVal = [...prev, contestId];
        if (user?.id) {
          syncAvatarConfig(user.id, { contests_entered: newVal });
        }
        return newVal;
      });
      queryClient.invalidateQueries({ queryKey: ['unlock-status'] });
      queryClient.invalidateQueries({ queryKey: ['crown-balance'] });
    }
  }, [mergedContestsEntered, user?.id, queryClient]);

  const value = useMemo(() => ({
    crowns,
    crownStatus,
    addCrowns,
    spendCrowns,
    ownedAvatarParts,
    ownedRoomItems,
    purchaseAvatarPart,
    purchaseRoomItem,
    isItemUnlocked,
    avatar,
    setAvatarPart,
    placedItems,
    placeItem,
    removeItem,
    moveItem,
    rotateItem,
    avatarParts,
    roomItems,
    achievements,
    addAvatarPart,
    updateAvatarPart,
    deleteAvatarPart,
    addRoomItem,
    updateRoomItem,
    deleteRoomItem,
    roomCategories,
    addRoomCategory,
    updateRoomCategory,
    deleteRoomCategory,
    contestsEntered: mergedContestsEntered,
    enterContest,
    badgeIds,
    eloData,
    giveawayWinIds,
    referralCount,
    isAdmin,
    setIsAdmin: (val: boolean) => {
      setIsAdmin(val);
      AsyncStorage.setItem(STORAGE_KEYS.isAdmin, String(val));
    },
  }), [crowns, crownStatus, addCrowns, spendCrowns, ownedAvatarParts, ownedRoomItems, purchaseAvatarPart, purchaseRoomItem, isItemUnlocked, avatar, setAvatarPart, placedItems, placeItem, removeItem, moveItem, rotateItem, avatarParts, roomItems, achievements, addAvatarPart, updateAvatarPart, deleteAvatarPart, addRoomItem, updateRoomItem, deleteRoomItem, roomCategories, addRoomCategory, updateRoomCategory, deleteRoomCategory, mergedContestsEntered, enterContest, badgeIds, eloData, giveawayWinIds, referralCount, isAdmin]);

  return (
    <GamificationContext.Provider value={value}>
      {children}
    </GamificationContext.Provider>
  );
}

export function useGamification() {
  const context = useContext(GamificationContext);
  if (!context) {
    throw new Error('useGamification must be used within a GamificationProvider');
  }
  return context;
}
