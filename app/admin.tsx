import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, TextInput, Alert, Modal, Image, KeyboardAvoidingView, Dimensions, ActivityIndicator } from 'react-native';
import { fetch } from 'expo/fetch';
import { supabase } from '@/lib/supabase';
import { getApiUrl } from '@/lib/query-client';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/contexts/ThemeContext';
import { useGamification, UnlockConditionType, PlacementSurface } from '@/contexts/GamificationContext';
import { Colors } from '@/constants/colors';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import DatePickerField from '@/components/DatePickerField';
import { useContests } from '@/lib/supabase-data';
import { 
  useGamificationConfig, useUpdateGamificationConfig,
  useConcludeContest,
  useAdminEloConfigs, useCreateEloConfig, useCreateBadge,
  useRuleSets, useCreateRuleSet, useActivateRuleSet,
  useAuditLog, useFraudFlags, useResolveFraudFlag,
  useAdminAvatarParts, useCreateAvatarPart, useUpdateAvatarPart, useDeleteAvatarPart,
  useAdminRoomItems, useCreateRoomItem, useUpdateRoomItem, useDeleteRoomItem,
  useAdminRoomCategories, useCreateRoomCategory, useUpdateRoomCategory, useDeleteRoomCategory,
  useUpdateBadge, useDeleteBadge,
  useCreateContest, useUpdateContest, useDeleteContest,
  useUpdateRuleSet, useDeleteRuleSet,
  useAdminReferrals,
  useAdminUsers, useAdjustUserCrowns, useBanUser, useUnbanUser, useToggleUserAdmin,
  useCreateUser, useEditUser, useDeleteUser, useAdminBadges, uploadAssetImage,
  useGiveawaysV2, useGiveawayV2Detail, useCreateGiveawayV2, useUpdateGiveawayV2, useDeleteGiveawayV2,
  useOpenGiveawayV2, useEvaluateGiveawayV2, useLockGiveawayV2, useDrawGiveawayV2, useAwardGiveawayWinner, useCancelGiveawayV2,
  useAwardContestCrowns, useTodayGames, useGamesRange,
  useSportsSeasons, useSportsTeams, useSportsPlayers,
  useAdminSponsors, useCreateSponsor, useUpdateSponsor, useDeleteSponsor,
  useSponsorResources, useUploadSponsorResource, useDeleteSponsorResource,
} from '@/lib/gamification-api';

type TabType = 'avatar' | 'room' | 'categories' | 'crowns' | 'elo' | 'contests' | 'bracket' | 'badges' | 'giveaways' | 'rules' | 'sponsors' | 'audit' | 'fraud' | 'referrals' | 'users';
type EditMode = 'add' | 'edit' | null;

const AVATAR_CATEGORIES = ['body', 'hair', 'eyebrows', 'eyes', 'mouth', 'shirt', 'jacket', 'pants', 'shoes', 'accessories'];
const RARITIES = ['common', 'rare', 'epic', 'legendary'];
const UNLOCK_TYPES: UnlockConditionType[] = ['free', 'crowns', 'contest_entry', 'elo_placement', 'giveaway_win', 'referral_count', 'achievement'];
const PLACEMENT_SURFACES: PlacementSurface[] = ['floor', 'wall', 'stacked'];

const clampDimension = (value: string, allowZero: boolean = false): string => {
  const num = parseInt(value, 10);
  const min = allowZero ? 0 : 1;
  if (isNaN(num) || num < min) return String(min);
  if (num > 12) return '12';
  return String(num);
};

export default function AdminScreen() {
  const { colors } = useTheme();
  const { isAdmin, setIsAdmin } = useGamification();
  const insets = useSafeAreaInsets();

  const { data: avatarPartsData } = useAdminAvatarParts();
  const { data: roomItemsData } = useAdminRoomItems();
  const { data: roomCategoriesData } = useAdminRoomCategories();

  const avatarParts: any[] = avatarPartsData || [];
  const roomItems: any[] = roomItemsData || [];
  const roomCategories: any[] = roomCategoriesData || [];

  const createAvatarPartMutation = useCreateAvatarPart();
  const updateAvatarPartMutation = useUpdateAvatarPart();
  const deleteAvatarPartMutation = useDeleteAvatarPart();
  const createRoomItemMutation = useCreateRoomItem();
  const updateRoomItemMutation = useUpdateRoomItem();
  const deleteRoomItemMutation = useDeleteRoomItem();
  const createRoomCategoryMutation = useCreateRoomCategory();
  const updateRoomCategoryMutation = useUpdateRoomCategory();
  const deleteRoomCategoryMutation = useDeleteRoomCategory();

  const updateBadgeMutation = useUpdateBadge();
  const deleteBadgeMutation = useDeleteBadge();
  const createContestMutation = useCreateContest();
  const updateContestMutation = useUpdateContest();
  const deleteContestMutation = useDeleteContest();
  const awardContestCrownsMutation = useAwardContestCrowns();
  const { data: todayGamesData } = useTodayGames();
  const [eloLeague, setEloLeague] = useState<'NBA' | 'NCAAB' | 'custom'>('custom');
  const [eloSeason, setEloSeason] = useState('');
  const [eloSelectedContestIds, setEloSelectedContestIds] = useState<string[]>([]);
  const [eloTeamSearch, setEloTeamSearch] = useState('');
  const [eloPlayerSearch, setEloPlayerSearch] = useState('');
  const { data: seasonsData } = useSportsSeasons();
  const { data: teamsData, isFetching: teamsFetching } = useSportsTeams(eloLeague, eloLeague !== 'custom');
  const { data: playersData, isFetching: playersFetching } = useSportsPlayers(eloLeague, eloPlayerSearch, eloLeague !== 'custom');
  const updateRuleSetMutation = useUpdateRuleSet();
  const deleteRuleSetMutation = useDeleteRuleSet();

  const { data: adminReferralsData } = useAdminReferrals();

  const [userSearch, setUserSearch] = useState('');
  const { data: adminUsersData } = useAdminUsers(userSearch);
  const adjustCrownsMutation = useAdjustUserCrowns();
  const banUserMutation = useBanUser();
  const unbanUserMutation = useUnbanUser();
  const toggleAdminMutation = useToggleUserAdmin();
  const createUserMutation = useCreateUser();
  const editUserMutation = useEditUser();
  const deleteUserMutation = useDeleteUser();

  const [showCreateUser, setShowCreateUser] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [newUserForm, setNewUserForm] = useState({ email: '', password: '', username: '', role: 'user', is_admin: false });
  const [editUserForm, setEditUserForm] = useState({ username: '', email: '', password: '', role: 'user', is_admin: false });

  const [activeTab, setActiveTab] = useState<TabType>('contests');
  const [editMode, setEditMode] = useState<EditMode>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [formData, setFormData] = useState({
    id: '',
    name: '',
    category: '',
    price: '0',
    rarity: 'common',
    unlockType: 'free' as UnlockConditionType,
    unlockValue: '',
    unlockContestId: '',
    unlockSeasonId: '',
    unlockGiveawayId: '',
    unlockEloRank: '',
    url: '',
    image: '',
    width: '1',
    depth: '1',
    zHeight: '1',
    placementSurface: 'floor' as PlacementSurface,
    isStackable: false,
    wallSide: '' as '' | 'left' | 'right',
  });
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');

  const { data: gamificationConfig, isLoading: configLoading } = useGamificationConfig();
  const updateConfigMutation = useUpdateGamificationConfig();
  const { data: contestsData, isLoading: contestsLoading } = useContests();
  const concludeContestMutation = useConcludeContest();
  const { data: badgesData, isLoading: badgesLoading } = useAdminBadges();
  const createBadgeMutation = useCreateBadge();
  const { data: eloConfigsData, isLoading: eloConfigsLoading } = useAdminEloConfigs();
  const createEloConfigMutation = useCreateEloConfig();

  const { data: giveawaysV2Data, isLoading: giveawaysV2Loading } = useGiveawaysV2();
  const createGiveawayV2Mutation = useCreateGiveawayV2();
  const updateGiveawayV2Mutation = useUpdateGiveawayV2();
  const deleteGiveawayV2Mutation = useDeleteGiveawayV2();
  const openGiveawayV2Mutation = useOpenGiveawayV2();
  const evaluateGiveawayV2Mutation = useEvaluateGiveawayV2();
  const lockGiveawayV2Mutation = useLockGiveawayV2();
  const drawGiveawayV2Mutation = useDrawGiveawayV2();
  const awardGiveawayWinnerMutation = useAwardGiveawayWinner();
  const cancelGiveawayV2Mutation = useCancelGiveawayV2();

  const [showGiveawayForm, setShowGiveawayForm] = useState(false);
  const [editingGiveawayId, setEditingGiveawayId] = useState<string | null>(null);
  const [selectedGiveawayId, setSelectedGiveawayId] = useState<string | null>(null);
  const { data: selectedGiveawayDetail } = useGiveawayV2Detail(selectedGiveawayId);
  const [drawWinnerCount, setDrawWinnerCount] = useState('3');
  const [giveawayForm, setGiveawayForm] = useState({
    title: '',
    description: '',
    prize_description: '',
    starts_at: '',
    ends_at: '',
    max_winners: '1',
    entry_methods: [] as Array<{ type: string; config: any; entries_awarded: number }>,
  });

  const ENTRY_METHOD_TYPES = [
    { value: 'free', label: 'Free Entry' },
    { value: 'crown_threshold', label: 'Crown Threshold' },
    { value: 'contest_entry', label: 'Contest Entry' },
    { value: 'contest_placement', label: 'Contest Placement' },
    { value: 'referral', label: 'Referral' },
    { value: 'streak', label: 'Streak' },
    { value: 'social_share', label: 'Social Share' },
    { value: 'badge_holder', label: 'Badge Holder' },
  ];

  const [crownConfig, setCrownConfig] = useState({
    entry_crowns: '10', first_time_bonus: '50',
    first_place_reward: '200', top_10_reward: '100', beat_avg_reward: '25',
    streak_2w_bonus: '50', streak_4w_bonus: '150', streak_8w_bonus: '400',
    referral_bonus: '100', share_bonus: '25', share_daily_limit: '3', nametag_badge_limit: '3',
  });
  const [crownConfigInitialized, setCrownConfigInitialized] = useState(false);

  const [showEloForm, setShowEloForm] = useState(false);
  const [eloForm, setEloForm] = useState({
    sport_id: '', season_id: '', league: '', bronze: '0', silver: '500', gold: '1500', champion: '3000',
    points_per_pick: '25', champion_penalty: '15',
  });


  const [badgeForm, setBadgeForm] = useState({
    code: '', name: '', description: '', type: 'TROPHY_ONLY', icon_ref: '',
    unlockType: 'free' as UnlockConditionType,
    unlockValue: '',
    unlockContestId: '',
    unlockSeasonId: '',
    unlockGiveawayId: '',
    unlockEloRank: '',
  });
  const [editingBadgeId, setEditingBadgeId] = useState<string | null>(null);
  const [showBadgeForm, setShowBadgeForm] = useState(false);

  const { data: ruleSetsData, isLoading: ruleSetsLoading } = useRuleSets();
  const createRuleSetMutation = useCreateRuleSet();
  const activateRuleSetMutation = useActivateRuleSet();
  const { data: auditLogData, isLoading: auditLoading } = useAuditLog(100);
  const { data: fraudFlagsData, isLoading: fraudLoading } = useFraudFlags(true);
  const resolveFraudMutation = useResolveFraudFlag();

  const [showRuleSetForm, setShowRuleSetForm] = useState(false);
  const [ruleSetForm, setRuleSetForm] = useState({
    scope_type: 'GLOBAL',
    scope_id: '',
    rules_json: '',
  });
  const [editingRuleSetId, setEditingRuleSetId] = useState<string | null>(null);
  const [ruleSetName, setRuleSetName] = useState('');
  const [ruleSetScopeType, setRuleSetScopeType] = useState('GLOBAL');
  const [ruleSetScopeId, setRuleSetScopeId] = useState('');
  const [ruleSetPointsPerPick, setRuleSetPointsPerPick] = useState('10');
  const [ruleSetEntryCrowns, setRuleSetEntryCrowns] = useState('10');
  const [ruleSetEntryCrownsEnabled, setRuleSetEntryCrownsEnabled] = useState(true);
  const [ruleSetPlacements, setRuleSetPlacements] = useState<Array<{ place: number; crowns: number; label: string }>>([
    { place: 1, crowns: 100, label: '1st Place' },
    { place: 2, crowns: 50, label: '2nd Place' },
    { place: 3, crowns: 25, label: '3rd Place' },
  ]);
  const [fraudResolveNote, setFraudResolveNote] = useState('');
  const [selectedFraudId, setSelectedFraudId] = useState<string | null>(null);

  const [contestForm, setContestForm] = useState({
    title: '', sport_id: '', season_id: '', league: '', status: 'open',
    starts_at: '', ends_at: '', contest_type: 'nightly_slate' as string,
  });
  const [editingContestId, setEditingContestId] = useState<string | null>(null);
  const [showContestForm, setShowContestForm] = useState(false);
  const [contestSport, setContestSport] = useState<'NBA' | 'NCAAB' | 'custom' | 'special'>('NBA');
  const [gameRangeStart, setGameRangeStart] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  });
  const [gameRangeEnd, setGameRangeEnd] = useState('');
  const [gameSearchQuery, setGameSearchQuery] = useState('');
  const [selectedGames, setSelectedGames] = useState<any[]>([]);
  const [fetchGamesEnabled, setFetchGamesEnabled] = useState(false);
  const { data: rangeGamesData, isFetching: isFetchingRangeGames } = useGamesRange(
    gameRangeStart, gameRangeEnd, contestSport, fetchGamesEnabled && contestSport !== 'custom'
  );
  const [awardingContestId, setAwardingContestId] = useState<string | null>(null);
  const [crownAwardForm, setCrownAwardForm] = useState({ user_ids: '', amount: '100', reason: '' });

  const [adjustingUserId, setAdjustingUserId] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  const { data: adminSponsorsData } = useAdminSponsors();
  const createSponsorMutation = useCreateSponsor();
  const updateSponsorMutation = useUpdateSponsor();
  const deleteSponsorMutation = useDeleteSponsor();
  const uploadSponsorResourceMutation = useUploadSponsorResource();
  const deleteSponsorResourceMutation = useDeleteSponsorResource();

  const [showSponsorForm, setShowSponsorForm] = useState(false);
  const [editingSponsorId, setEditingSponsorId] = useState<string | null>(null);
  const [sponsorForm, setSponsorForm] = useState({
    company_name: '',
    contact_email: '',
    website: '',
    description: '',
    brand_color: '#00D4AA',
    business_type: '',
    city: '',
    state: '',
    user_id: '',
  });
  const [viewingSponsorResources, setViewingSponsorResources] = useState<string | null>(null);
  const { data: sponsorResourcesData, refetch: refetchSponsorResources } = useSponsorResources(viewingSponsorResources || '');

  if (!crownConfigInitialized && gamificationConfig) {
    setCrownConfig({
      entry_crowns: String(gamificationConfig.entry_crowns ?? 10),
      first_time_bonus: String(gamificationConfig.first_time_bonus ?? 50),
      first_place_reward: String(gamificationConfig.first_place_reward ?? 200),
      top_10_reward: String(gamificationConfig.top_10_reward ?? 100),
      beat_avg_reward: String(gamificationConfig.beat_avg_reward ?? 25),
      streak_2w_bonus: String(gamificationConfig.streak_2w_bonus ?? 50),
      streak_4w_bonus: String(gamificationConfig.streak_4w_bonus ?? 150),
      streak_8w_bonus: String(gamificationConfig.streak_8w_bonus ?? 400),
      referral_bonus: String(gamificationConfig.referral_bonus ?? 100),
      share_bonus: String(gamificationConfig.share_bonus ?? 25),
      share_daily_limit: String(gamificationConfig.share_daily_limit ?? 3),
      nametag_badge_limit: String(gamificationConfig.nametag_badge_limit ?? 3),
    });
    setCrownConfigInitialized(true);
  }

  const BADGE_TYPES = ['TROPHY_ONLY', 'NAMETAG_BADGE', 'NAMETAG_SKIN'];
  const CONTEST_STATUSES = ['draft', 'open', 'active', 'concluded'];
  const CONTEST_TYPES = [
    { value: 'nightly_slate', label: 'Nightly Slate' },
    { value: 'weekly_wire', label: 'Weekly Wire' },
    { value: 'over_under', label: 'Over/Under Showdown' },
  ];

  const todayDate = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  })();

  const webTopPadding = Platform.OS === 'web' ? 67 : 0;
  const topPadding = insets.top || webTopPadding;

  const items = activeTab === 'avatar' ? avatarParts : activeTab === 'room' ? roomItems : [];
  const categoryNames = activeTab === 'avatar' ? AVATAR_CATEGORIES : roomCategories.map((c: any) => typeof c === 'string' ? c : c.name);

  const resetForm = () => {
    setFormData({
      id: '',
      name: '',
      category: categoryNames[0] || '',
      price: '0',
      rarity: 'common',
      unlockType: 'free',
      unlockValue: '',
      unlockContestId: '',
      unlockSeasonId: '',
      unlockGiveawayId: '',
      unlockEloRank: '',
      url: '',
      image: '',
      width: '1',
      depth: '1',
      zHeight: '1',
      placementSurface: 'floor',
      isStackable: false,
      wallSide: '' as '' | 'left' | 'right',
    });
  };

  const [isBadgeUploading, setIsBadgeUploading] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setIsUploading(true);
      try {
        const fileName = asset.fileName || `asset_${Date.now()}.webp`;
        const folder = activeTab === 'avatar' ? 'avatar-parts' : activeTab === 'room' ? 'room-items' : 'general';
        const uploaded = await uploadAssetImage(
          { uri: asset.uri, name: fileName, type: asset.mimeType || 'image/webp' },
          folder
        );
        setFormData(prev => ({ ...prev, image: uploaded.url }));
      } catch (err: any) {
        Alert.alert('Upload Failed', err.message || 'Could not upload image to storage');
        console.error('Image upload error:', err);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const pickBadgeImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setIsBadgeUploading(true);
      try {
        const fileName = asset.fileName || `badge_${Date.now()}.webp`;
        const uploaded = await uploadAssetImage(
          { uri: asset.uri, name: fileName, type: asset.mimeType || 'image/webp' },
          'general'
        );
        setBadgeForm(prev => ({ ...prev, icon_ref: uploaded.url }));
      } catch (err: any) {
        Alert.alert('Upload Failed', err.message || 'Could not upload image to storage');
        console.error('Badge image upload error:', err);
      } finally {
        setIsBadgeUploading(false);
      }
    }
  };

  const pickAndUploadResource = async (sponsorId: string) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const fileName = asset.fileName || `resource_${Date.now()}.${asset.type === 'video' ? 'mp4' : 'jpg'}`;
      const fileType = asset.type === 'video' ? 'video' : 'image';
      const mimeType = asset.type === 'video' ? 'video/mp4' : 'image/jpeg';
      uploadSponsorResourceMutation.mutate({
        sponsorId,
        file_data: asset.base64!,
        file_name: fileName,
        file_type: fileType,
        mime_type: mimeType,
      });
    }
  };

  const handleAdd = () => {
    if (activeTab === 'elo') {
      setShowEloForm(true);
      setEloForm({ sport_id: '', season_id: '', league: '', bronze: '0', silver: '500', gold: '1500', champion: '3000', points_per_pick: '25', champion_penalty: '15' });
      return;
    }
    if (activeTab === 'giveaways') {
      setShowGiveawayForm(true);
      setEditingGiveawayId(null);
      setGiveawayForm({ title: '', description: '', prize_description: '', starts_at: '', ends_at: '', max_winners: '1', entry_methods: [] });
      return;
    }
    if (activeTab === 'contests') {
      setEditingContestId(null);
      setContestForm({ title: '', sport_id: '', season_id: '', league: '', status: 'open', starts_at: '', ends_at: '', contest_type: 'nightly_slate' });
      setShowContestForm(true);
      return;
    }
    if (activeTab === 'badges') {
      setEditingBadgeId(null);
      setBadgeForm({ code: '', name: '', description: '', type: 'TROPHY_ONLY', icon_ref: '', unlockType: 'free', unlockValue: '', unlockContestId: '', unlockSeasonId: '', unlockGiveawayId: '', unlockEloRank: '' });
      setShowBadgeForm(true);
      return;
    }
    if (activeTab === 'sponsors') {
      setEditingSponsorId(null);
      setSponsorForm({
        company_name: '', contact_email: '', website: '', description: '',
        brand_color: '#00D4AA', business_type: '', city: '', state: '', user_id: '',
      });
      setViewingSponsorResources(null);
      setShowSponsorForm(true);
      return;
    }
    if (activeTab === 'rules') {
      setEditingRuleSetId(null);
      setRuleSetName('');
      setRuleSetScopeType('GLOBAL');
      setRuleSetScopeId('');
      setRuleSetPointsPerPick('10');
      setRuleSetEntryCrowns('10');
      setRuleSetEntryCrownsEnabled(true);
      setRuleSetPlacements([
        { place: 1, crowns: 100, label: '1st Place' },
        { place: 2, crowns: 50, label: '2nd Place' },
        { place: 3, crowns: 25, label: '3rd Place' },
      ]);
      setShowRuleSetForm(true);
      return;
    }
    setEditMode('add');
    resetForm();
    setFormData(prev => ({ ...prev, category: categoryNames[0] || '' }));
    setShowModal(true);
  };

  const handleEdit = (item: any) => {
    setEditMode('edit');
    setEditingItem(item);
    const unlockCond = item.unlock_condition_json || item.unlockCondition || {};
    setFormData({
      id: item.id,
      name: item.name,
      category: item.category,
      price: String(item.price),
      rarity: item.rarity,
      unlockType: unlockCond.type || 'free',
      unlockValue: String(unlockCond.value || ''),
      unlockContestId: unlockCond.contestId || '',
      unlockSeasonId: unlockCond.seasonId || '',
      unlockGiveawayId: unlockCond.giveawayId || '',
      unlockEloRank: String(unlockCond.eloRank || ''),
      url: item.url || '',
      image: item.image || '',
      width: String(item.width ?? item.width ?? 1),
      depth: String(item.depth ?? 1),
      zHeight: String(item.z_height ?? item.zHeight ?? 1),
      placementSurface: item.placement_surface || item.placementSurface || 'floor',
      isStackable: item.is_stackable ?? item.isStackable ?? false,
      wallSide: (item.wall_side || item.wallSide || '') as '' | 'left' | 'right',
    });
    setShowModal(true);
  };

  const performDelete = (item: any) => {
    if (activeTab === 'avatar') {
      deleteAvatarPartMutation.mutate(item.id);
    } else {
      deleteRoomItemMutation.mutate(item.id);
    }
  };

  const handleDelete = (item: any) => {
    if (Platform.OS === 'web') {
      if (confirm(`Are you sure you want to delete "${item.name}"?`)) {
        performDelete(item);
      }
    } else {
      Alert.alert(
        'Delete Item',
        `Are you sure you want to delete "${item.name}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => performDelete(item) },
        ]
      );
    }
  };

  const handleSave = () => {
    if (!formData.name || !formData.category) {
      Alert.alert('Error', 'Name and category are required');
      return;
    }

    const unlock_condition_json = {
      type: formData.unlockType,
      value: formData.unlockType === 'crowns' ? parseInt(formData.unlockValue, 10) || 0
        : formData.unlockType === 'referral_count' ? parseInt(formData.unlockValue, 10) || 0
        : undefined,
      contestId: (formData.unlockType === 'contest_entry' || formData.unlockType === 'elo_placement') ? formData.unlockContestId || undefined : undefined,
      seasonId: formData.unlockType === 'elo_placement' ? formData.unlockSeasonId || undefined : undefined,
      eloRank: formData.unlockType === 'elo_placement' ? parseInt(formData.unlockEloRank, 10) || undefined : undefined,
      giveawayId: formData.unlockType === 'giveaway_win' ? formData.unlockGiveawayId || undefined : undefined,
    };

    if (activeTab === 'avatar') {
      const payload = {
        name: formData.name,
        category: formData.category,
        image: formData.image,
        price: parseInt(formData.price, 10) || 0,
        rarity: formData.rarity,
        unlock_condition_json,
      };

      if (editMode === 'add') {
        createAvatarPartMutation.mutate(payload);
      } else {
        updateAvatarPartMutation.mutate({ id: formData.id, ...payload });
      }
    } else if (activeTab === 'room') {
      const payload = {
        name: formData.name,
        category: formData.category,
        image: formData.image,
        price: parseInt(formData.price, 10) || 0,
        rarity: formData.rarity,
        unlock_condition_json,
        url: formData.url || undefined,
        width: parseInt(formData.width, 10) || 1,
        depth: parseInt(formData.depth, 10) || 1,
        z_height: parseInt(formData.zHeight, 10) || 1,
        placement_surface: formData.placementSurface,
        is_stackable: formData.isStackable,
        wall_side: formData.wallSide || undefined,
      };

      if (editMode === 'add') {
        createRoomItemMutation.mutate(payload);
      } else {
        updateRoomItemMutation.mutate({ id: formData.id, ...payload });
      }
    }

    setShowModal(false);
    setEditMode(null);
    setEditingItem(null);
  };

  const confirmAction = (title: string, message: string, onConfirm: () => void) => {
    if (Platform.OS === 'web') {
      if (confirm(message)) onConfirm();
    } else {
      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', style: 'destructive', onPress: onConfirm },
      ]);
    }
  };

  if (!isAdmin) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AnimatedBackground />
        <View style={[styles.header, { paddingTop: topPadding + 12 }]}>
          <Pressable onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/'); }} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Admin Panel</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.lockedContainer}>
          <Ionicons name="lock-closed" size={60} color={colors.textMuted} />
          <Text style={[styles.lockedText, { color: colors.text }]}>Admin Access Required</Text>
          <Pressable
            onPress={() => setIsAdmin(true)}
            style={[styles.enableButton, { backgroundColor: Colors.primary }]}
          >
            <Text style={styles.enableButtonText}>Enable Admin Mode</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AnimatedBackground />

      <View style={[styles.header, { paddingTop: topPadding + 12 }]}>
        <Pressable onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/'); }} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Admin CMS</Text>
        {(activeTab === 'avatar' || activeTab === 'room' || activeTab === 'elo' || activeTab === 'contests' || activeTab === 'bracket' || activeTab === 'badges' || activeTab === 'rules' || activeTab === 'giveaways' || activeTab === 'sponsors') ? (
          <Pressable onPress={handleAdd} style={styles.addButton} testID="admin-add-button" accessibilityLabel="Add new item" accessibilityRole="button">
            <Ionicons name="add" size={24} color={Colors.primary} />
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs} contentContainerStyle={styles.tabsContent}>
        {([
          { key: 'contests' as TabType, label: 'Contests' },
          { key: 'bracket' as TabType, label: 'Bracket' },
          { key: 'room' as TabType, label: `Room (${roomItems.length})` },
          { key: 'categories' as TabType, label: `Categories (${roomCategories.length})` },
          { key: 'avatar' as TabType, label: `Avatar (${avatarParts.length})` },
          { key: 'crowns' as TabType, label: 'Crowns' },
          { key: 'elo' as TabType, label: 'ELO' },
          { key: 'badges' as TabType, label: 'Badges' },
          { key: 'giveaways' as TabType, label: 'Giveaways' },
          { key: 'rules' as TabType, label: 'Rules' },
          { key: 'sponsors' as TabType, label: `Sponsors (${(adminSponsorsData || []).length})` },
          { key: 'audit' as TabType, label: 'Audit' },
          { key: 'fraud' as TabType, label: 'Fraud' },
          { key: 'referrals' as TabType, label: 'Referrals' },
          { key: 'users' as TabType, label: 'Users' },
        ]).map(t => (
          <Pressable
            key={t.key}
            onPress={() => setActiveTab(t.key)}
            style={[
              styles.tab,
              { backgroundColor: activeTab === t.key ? Colors.primary : colors.card },
            ]}
          >
            <Text style={[styles.tabText, { color: activeTab === t.key ? '#000' : colors.text }]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'categories' ? (
          <>
            <View style={[styles.addCategoryRow, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <TextInput
                style={[styles.categoryInput, { backgroundColor: colors.cardBorder, color: colors.text }]}
                value={newCategoryName}
                onChangeText={setNewCategoryName}
                placeholder="New category name..."
                placeholderTextColor={colors.textMuted}
              />
              <Pressable
                onPress={() => {
                  if (newCategoryName.trim()) {
                    createRoomCategoryMutation.mutate(newCategoryName.trim().toLowerCase());
                    setNewCategoryName('');
                  }
                }}
                style={[styles.addCategoryBtn, { backgroundColor: Colors.primary }]}
              >
                <Ionicons name="add" size={20} color="#000" />
              </Pressable>
            </View>

            {roomCategories.map((cat: any) => {
              const catId = typeof cat === 'string' ? cat : cat.id;
              const catName = typeof cat === 'string' ? cat : cat.name;
              return (
                <View key={catId} style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                  {editingCategory === catId ? (
                    <View style={styles.editCategoryRow}>
                      <TextInput
                        style={[styles.categoryEditInput, { backgroundColor: colors.cardBorder, color: colors.text }]}
                        value={editCategoryName}
                        onChangeText={setEditCategoryName}
                        autoFocus
                      />
                      <Pressable
                        onPress={() => {
                          if (editCategoryName.trim()) {
                            updateRoomCategoryMutation.mutate({ id: catId, name: editCategoryName.trim().toLowerCase() });
                          }
                          setEditingCategory(null);
                          setEditCategoryName('');
                        }}
                        style={[styles.actionIcon, { backgroundColor: Colors.primary }]}
                      >
                        <Ionicons name="checkmark" size={16} color="#000" />
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          setEditingCategory(null);
                          setEditCategoryName('');
                        }}
                        style={styles.actionIcon}
                      >
                        <Ionicons name="close" size={16} color={colors.textMuted} />
                      </Pressable>
                    </View>
                  ) : (
                    <>
                      <View style={styles.itemInfo}>
                        <Text style={[styles.itemName, { color: colors.text }]}>{catName}</Text>
                        <Text style={[styles.itemMeta, { color: colors.textSecondary }]}>
                          {roomItems.filter((i: any) => i.category === catName).length} items
                        </Text>
                      </View>
                      <View style={styles.itemActions}>
                        <Pressable
                          onPress={() => {
                            setEditingCategory(catId);
                            setEditCategoryName(catName);
                          }}
                          style={styles.actionIcon}
                        >
                          <Ionicons name="pencil" size={18} color={Colors.primary} />
                        </Pressable>
                        <Pressable
                          onPress={() => {
                            confirmAction(
                              'Delete Category',
                              `Delete "${catName}"? Items in this category won't be deleted.`,
                              () => deleteRoomCategoryMutation.mutate(catId)
                            );
                          }}
                          style={styles.actionIcon}
                        >
                          <Ionicons name="trash" size={18} color={Colors.error} />
                        </Pressable>
                      </View>
                    </>
                  )}
                </View>
              );
            })}
          </>
        ) : activeTab === 'avatar' || activeTab === 'room' ? (
          items.map((item: any) => {
            const unlockCond = item.unlock_condition_json || item.unlockCondition || {};
            return (
              <View key={item.id} style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                {item.image ? (
                  <Image source={{ uri: item.image }} style={styles.itemThumbnail} />
                ) : (
                  <View style={[styles.itemThumbnail, styles.noImagePlaceholder, { backgroundColor: colors.cardBorder }]}>
                    <Ionicons name="image-outline" size={20} color={colors.textMuted} />
                  </View>
                )}
                <View style={styles.itemInfo}>
                  <Text style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[styles.itemMeta, { color: colors.textSecondary }]}>
                    {item.category} | {item.rarity} | {item.price} crowns
                  </Text>
                  <Text style={[styles.itemUnlock, { color: colors.textMuted }]}>
                    Unlock: {unlockCond.type}
                    {unlockCond.value && ` (${unlockCond.value})`}
                    {unlockCond.contestId && ` (Contest: ${unlockCond.contestId})`}
                  </Text>
                  {item.url && (
                    <Text style={[styles.itemUrl, { color: Colors.primary }]} numberOfLines={1}>
                      URL: {item.url}
                    </Text>
                  )}
                </View>
                <View style={styles.itemActions}>
                  <Pressable onPress={() => handleEdit(item)} style={styles.actionIcon}>
                    <Ionicons name="pencil" size={18} color={Colors.primary} />
                  </Pressable>
                  <Pressable onPress={() => handleDelete(item)} style={styles.actionIcon}>
                    <Ionicons name="trash" size={18} color={Colors.error} />
                  </Pressable>
                </View>
              </View>
            );
          })
        ) : activeTab === 'crowns' ? (
          configLoading ? (
            <Text style={[styles.itemName, { color: colors.text, textAlign: 'center', marginTop: 40 }]}>Loading...</Text>
          ) : (
            <>
              <View style={[styles.configCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <View style={styles.configSection}>
                  <Text style={[styles.configSectionTitle, { color: colors.text }]}>CONTEST REWARDS</Text>
                  {[
                    { label: 'Entry Crowns Per Contest', key: 'entry_crowns' },
                    { label: 'First Time Bonus', key: 'first_time_bonus' },
                    { label: '1st Place Reward', key: 'first_place_reward' },
                    { label: 'Top 10% Reward', key: 'top_10_reward' },
                    { label: 'Beat Average Reward', key: 'beat_avg_reward' },
                  ].map(field => (
                    <View key={field.key} style={styles.configRow}>
                      <Text style={[styles.configLabel, { color: colors.textSecondary }]}>{field.label}</Text>
                      <TextInput
                        style={[styles.configInput, { backgroundColor: colors.cardBorder, color: colors.text }]}
                        value={crownConfig[field.key as keyof typeof crownConfig]}
                        onChangeText={text => setCrownConfig(prev => ({ ...prev, [field.key]: text }))}
                        keyboardType="numeric"
                      />
                    </View>
                  ))}
                </View>

                <View style={styles.configSection}>
                  <Text style={[styles.configSectionTitle, { color: colors.text }]}>STREAK BONUSES</Text>
                  {[
                    { label: '2-Week Streak Bonus', key: 'streak_2w_bonus' },
                    { label: '4-Week Streak Bonus', key: 'streak_4w_bonus' },
                    { label: '8-Week Streak Bonus', key: 'streak_8w_bonus' },
                  ].map(field => (
                    <View key={field.key} style={styles.configRow}>
                      <Text style={[styles.configLabel, { color: colors.textSecondary }]}>{field.label}</Text>
                      <TextInput
                        style={[styles.configInput, { backgroundColor: colors.cardBorder, color: colors.text }]}
                        value={crownConfig[field.key as keyof typeof crownConfig]}
                        onChangeText={text => setCrownConfig(prev => ({ ...prev, [field.key]: text }))}
                        keyboardType="numeric"
                      />
                    </View>
                  ))}
                </View>

                <View style={styles.configSection}>
                  <Text style={[styles.configSectionTitle, { color: colors.text }]}>SOCIAL & LIMITS</Text>
                  {[
                    { label: 'Referral Bonus', key: 'referral_bonus' },
                    { label: 'Share Bonus', key: 'share_bonus' },
                    { label: 'Share Daily Limit', key: 'share_daily_limit' },
                    { label: 'Nametag Badge Limit', key: 'nametag_badge_limit' },
                  ].map(field => (
                    <View key={field.key} style={styles.configRow}>
                      <Text style={[styles.configLabel, { color: colors.textSecondary }]}>{field.label}</Text>
                      <TextInput
                        style={[styles.configInput, { backgroundColor: colors.cardBorder, color: colors.text }]}
                        value={crownConfig[field.key as keyof typeof crownConfig]}
                        onChangeText={text => setCrownConfig(prev => ({ ...prev, [field.key]: text }))}
                        keyboardType="numeric"
                      />
                    </View>
                  ))}
                </View>
              </View>

              <Pressable
                onPress={() => {
                  const parsed: Record<string, number> = {};
                  Object.entries(crownConfig).forEach(([k, v]) => { parsed[k] = parseInt(v, 10) || 0; });
                  updateConfigMutation.mutate(parsed);
                }}
                style={[styles.saveButton, { backgroundColor: Colors.primary }]}
              >
                <Text style={styles.saveButtonText}>
                  {updateConfigMutation.isPending ? 'Saving...' : 'Save Config'}
                </Text>
              </Pressable>
            </>
          )
        ) : activeTab === 'elo' ? (
          eloConfigsLoading ? (
            <Text style={[styles.itemName, { color: colors.text, textAlign: 'center', marginTop: 40 }]}>Loading...</Text>
          ) : (
            <>
              {showEloForm && (
                <View style={[styles.configCard, { backgroundColor: colors.card, borderColor: Colors.primary, marginBottom: 16 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={[styles.configSectionTitle, { color: colors.text, marginBottom: 0 }]}>NEW ELO CONFIG</Text>
                    <Pressable onPress={() => setShowEloForm(false)}>
                      <Ionicons name="close" size={22} color={colors.text} />
                    </Pressable>
                  </View>

                  <Text style={[styles.label, { color: colors.textSecondary }]}>League</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
                    {(['NBA', 'NCAAB', 'custom'] as const).map(s => (
                      <Pressable
                        key={s}
                        onPress={() => {
                          setEloLeague(s);
                          if (s !== 'custom') {
                            setEloForm(prev => ({ ...prev, sport_id: s.toLowerCase(), league: s }));
                          }
                          setEloSelectedContestIds([]);
                        }}
                        style={[styles.pickerItem, { backgroundColor: eloLeague === s ? Colors.primary : colors.cardBorder }]}
                      >
                        <Text style={{ color: eloLeague === s ? '#000' : colors.text, fontSize: 12 }}>
                          {s === 'custom' ? 'Custom' : s}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  {eloLeague !== 'custom' && seasonsData?.seasons && (
                    <View style={{ marginBottom: 8 }}>
                      <Text style={[styles.label, { color: colors.textSecondary }]}>Season</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {(seasonsData.seasons as number[]).map((yr: number) => (
                          <Pressable
                            key={yr}
                            onPress={() => {
                              const s = String(yr);
                              setEloSeason(s);
                              setEloForm(prev => ({ ...prev, season_id: s }));
                            }}
                            style={[styles.chipBtn, {
                              backgroundColor: eloSeason === String(yr) ? Colors.primary : colors.cardBorder,
                              marginRight: 6, paddingHorizontal: 10, paddingVertical: 6,
                            }]}
                          >
                            <Text style={{ color: eloSeason === String(yr) ? '#000' : colors.text, fontSize: 12 }}>
                              {yr}-{yr + 1}
                            </Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  <Text style={[styles.configSectionTitle, { color: colors.text, marginTop: 8, marginBottom: 4 }]}>CONTESTS</Text>
                  {contestsLoading ? (
                    <Text style={[styles.itemMeta, { color: colors.textMuted }]}>Loading contests...</Text>
                  ) : (() => {
                    const filtered = eloLeague !== 'custom'
                      ? (contestsData || []).filter((c: any) => (c.league || '').toUpperCase() === eloLeague)
                      : (contestsData || []);
                    if (filtered.length === 0) {
                      return <Text style={[styles.itemMeta, { color: colors.textMuted, marginBottom: 8 }]}>No contests found{eloLeague !== 'custom' ? ` for ${eloLeague}` : ''}. Create contests first.</Text>;
                    }
                    const allSelected = filtered.every((c: any) => eloSelectedContestIds.includes(c.id));
                    return (
                      <View style={{ marginBottom: 8 }}>
                        <Pressable
                          onPress={() => {
                            if (allSelected) {
                              setEloSelectedContestIds([]);
                            } else {
                              setEloSelectedContestIds(filtered.map((c: any) => c.id));
                            }
                          }}
                          style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}
                        >
                          <Ionicons name={allSelected ? 'checkbox' : 'square-outline'} size={20} color={Colors.primary} />
                          <Text style={{ color: Colors.primary, fontSize: 12, marginLeft: 6, fontWeight: '600' as const }}>
                            Select All Season ({filtered.length})
                          </Text>
                        </Pressable>
                        <View style={{ maxHeight: 150 }}>
                          <ScrollView nestedScrollEnabled>
                            {filtered.map((c: any) => {
                              const isSelected = eloSelectedContestIds.includes(c.id);
                              return (
                                <Pressable
                                  key={c.id}
                                  onPress={() => {
                                    setEloSelectedContestIds(prev =>
                                      isSelected ? prev.filter(id => id !== c.id) : [...prev, c.id]
                                    );
                                  }}
                                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingHorizontal: 4 }}
                                >
                                  <Ionicons name={isSelected ? 'checkbox' : 'square-outline'} size={18} color={isSelected ? Colors.primary : colors.textMuted} />
                                  <Text style={{ color: colors.text, fontSize: 12, marginLeft: 6, flex: 1 }}>
                                    {c.title || c.id.substring(0, 8)}
                                  </Text>
                                  <Text style={{ color: colors.textMuted, fontSize: 10 }}>{c.status || ''}</Text>
                                </Pressable>
                              );
                            })}
                          </ScrollView>
                        </View>
                        {eloSelectedContestIds.length > 0 && (
                          <Text style={[styles.itemMeta, { color: Colors.primary, marginTop: 4 }]}>
                            {eloSelectedContestIds.length} contest(s) selected
                          </Text>
                        )}
                      </View>
                    );
                  })()}

                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.label, { color: colors.textSecondary }]}>Sport ID</Text>
                      <TextInput
                        style={[styles.inputField, { backgroundColor: colors.cardBorder, color: colors.text, fontSize: 12 }]}
                        value={eloForm.sport_id}
                        onChangeText={text => setEloForm(prev => ({ ...prev, sport_id: text }))}
                        placeholder="UUID or name"
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.label, { color: colors.textSecondary }]}>Season ID</Text>
                      <TextInput
                        style={[styles.inputField, { backgroundColor: colors.cardBorder, color: colors.text, fontSize: 12 }]}
                        value={eloForm.season_id}
                        onChangeText={text => setEloForm(prev => ({ ...prev, season_id: text }))}
                        placeholder="UUID or name"
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>
                  </View>

                  {eloForm.league ? (
                    <Text style={[styles.itemMeta, { color: Colors.primary, marginBottom: 4 }]}>League: {eloForm.league}</Text>
                  ) : null}

                  {eloLeague !== 'custom' && (
                    <View style={{ marginTop: 8, marginBottom: 8 }}>
                      <Text style={[styles.configSectionTitle, { color: colors.text, marginBottom: 4 }]}>TEAMS</Text>
                      {teamsFetching ? (
                        <Text style={[styles.itemMeta, { color: colors.textMuted }]}>Loading teams...</Text>
                      ) : (
                        <View>
                          <TextInput
                            style={[styles.inputField, { backgroundColor: colors.cardBorder, color: colors.text, fontSize: 12, marginBottom: 4 }]}
                            value={eloTeamSearch}
                            onChangeText={setEloTeamSearch}
                            placeholder="Filter teams..."
                            placeholderTextColor={colors.textMuted}
                          />
                          {(() => {
                            const allTeams: any[] = teamsData?.teams || [];
                            const q = eloTeamSearch.toLowerCase().trim();
                            const filtered = q ? allTeams.filter((t: any) =>
                              (t.full_name || t.name || '').toLowerCase().includes(q) ||
                              (t.abbreviation || '').toLowerCase().includes(q)
                            ) : allTeams;
                            const display = filtered.slice(0, 15);
                            if (display.length === 0 && allTeams.length > 0) {
                              return <Text style={[styles.itemMeta, { color: colors.textMuted }]}>No matching teams</Text>;
                            }
                            return (
                              <View style={{ maxHeight: 120 }}>
                                <ScrollView nestedScrollEnabled>
                                  {display.map((t: any) => (
                                    <View key={t.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, paddingHorizontal: 6, backgroundColor: colors.cardBorder, borderRadius: 4, marginBottom: 2 }}>
                                      <Text style={{ color: colors.text, fontSize: 11 }}>{t.full_name || t.name}</Text>
                                      <Text style={{ color: colors.textMuted, fontSize: 10 }}>{t.abbreviation}{t.conference ? ` / ${t.conference}` : ''}</Text>
                                    </View>
                                  ))}
                                  {filtered.length > 15 && (
                                    <Text style={[styles.itemMeta, { color: colors.textMuted, textAlign: 'center', marginTop: 2 }]}>+{filtered.length - 15} more</Text>
                                  )}
                                </ScrollView>
                              </View>
                            );
                          })()}
                        </View>
                      )}

                      <Text style={[styles.configSectionTitle, { color: colors.text, marginTop: 8, marginBottom: 4 }]}>PLAYERS</Text>
                      <TextInput
                        style={[styles.inputField, { backgroundColor: colors.cardBorder, color: colors.text, fontSize: 12, marginBottom: 4 }]}
                        value={eloPlayerSearch}
                        onChangeText={setEloPlayerSearch}
                        placeholder="Search players (min 2 chars)..."
                        placeholderTextColor={colors.textMuted}
                      />
                      {playersFetching ? (
                        <Text style={[styles.itemMeta, { color: colors.textMuted }]}>Searching...</Text>
                      ) : eloPlayerSearch.length >= 2 && playersData?.players ? (
                        <View style={{ maxHeight: 120 }}>
                          <ScrollView nestedScrollEnabled>
                            {(playersData.players as any[]).length === 0 ? (
                              <Text style={[styles.itemMeta, { color: colors.textMuted }]}>No players found</Text>
                            ) : (
                              (playersData.players as any[]).slice(0, 20).map((p: any) => (
                                <View key={p.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, paddingHorizontal: 6, backgroundColor: colors.cardBorder, borderRadius: 4, marginBottom: 2 }}>
                                  <Text style={{ color: colors.text, fontSize: 11 }}>{p.first_name} {p.last_name}</Text>
                                  <Text style={{ color: colors.textMuted, fontSize: 10 }}>{p.position || ''}{p.team ? ` / ${p.team}` : ''}</Text>
                                </View>
                              ))
                            )}
                          </ScrollView>
                        </View>
                      ) : eloPlayerSearch.length > 0 && eloPlayerSearch.length < 2 ? (
                        <Text style={[styles.itemMeta, { color: colors.textMuted }]}>Type at least 2 characters</Text>
                      ) : null}
                    </View>
                  )}

                  <Text style={[styles.configSectionTitle, { color: colors.text, marginTop: 8 }]}>THRESHOLDS</Text>
                  <View style={styles.configSection}>
                    {[
                      { label: 'Bronze', key: 'bronze' },
                      { label: 'Silver', key: 'silver' },
                      { label: 'Gold', key: 'gold' },
                      { label: 'Champion', key: 'champion' },
                    ].map(field => (
                      <View key={field.key} style={styles.configRow}>
                        <Text style={[styles.configLabel, { color: colors.textSecondary }]}>{field.label}</Text>
                        <TextInput
                          style={[styles.configInput, { backgroundColor: colors.cardBorder, color: colors.text }]}
                          value={eloForm[field.key as keyof typeof eloForm]}
                          onChangeText={text => setEloForm(prev => ({ ...prev, [field.key]: text }))}
                          keyboardType="numeric"
                        />
                      </View>
                    ))}
                  </View>

                  <View style={styles.configSection}>
                    {[
                      { label: 'Points Per Correct Pick', key: 'points_per_pick' },
                      { label: 'Champion Incorrect Penalty', key: 'champion_penalty' },
                    ].map(field => (
                      <View key={field.key} style={styles.configRow}>
                        <Text style={[styles.configLabel, { color: colors.textSecondary }]}>{field.label}</Text>
                        <TextInput
                          style={[styles.configInput, { backgroundColor: colors.cardBorder, color: colors.text }]}
                          value={eloForm[field.key as keyof typeof eloForm]}
                          onChangeText={text => setEloForm(prev => ({ ...prev, [field.key]: text }))}
                          keyboardType="numeric"
                        />
                      </View>
                    ))}
                  </View>

                  <Pressable
                    onPress={() => {
                      if (!eloForm.sport_id.trim() || !eloForm.season_id.trim()) {
                        Alert.alert('Error', 'Sport ID and Season ID are required');
                        return;
                      }
                      createEloConfigMutation.mutate({
                        sport_id: eloForm.sport_id,
                        season_id: eloForm.season_id,
                        thresholds_json: {
                          Bronze: parseInt(eloForm.bronze, 10) || 0,
                          Silver: parseInt(eloForm.silver, 10) || 500,
                          Gold: parseInt(eloForm.gold, 10) || 1500,
                          Champion: parseInt(eloForm.champion, 10) || 3000,
                        },
                        points_per_correct_pick_default_int: parseInt(eloForm.points_per_pick, 10) || 25,
                        points_per_incorrect_pick_champion_int: parseInt(eloForm.champion_penalty, 10) || 15,
                        contest_ids: eloSelectedContestIds.length > 0 ? eloSelectedContestIds : null,
                      }, {
                        onSuccess: () => {
                          setShowEloForm(false);
                          setEloSelectedContestIds([]);
                        },
                      });
                    }}
                    style={[styles.saveButton, { backgroundColor: Colors.primary, marginTop: 8 }]}
                  >
                    <Text style={styles.saveButtonText}>
                      {createEloConfigMutation.isPending ? 'Saving...' : 'Save ELO Config'}
                    </Text>
                  </Pressable>
                </View>
              )}

              {(!eloConfigsData || (eloConfigsData as any[]).length === 0) ? (
                <Text style={[styles.itemMeta, { color: colors.textMuted, textAlign: 'center', marginTop: 40 }]}>
                  No ELO configs yet. Tap + to create one.
                </Text>
              ) : (
                (eloConfigsData as any[]).map((cfg: any) => (
                  <View key={cfg.id || `${cfg.sport_id}-${cfg.season_id}`} style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                    <View style={styles.itemInfo}>
                      <Text style={[styles.itemName, { color: colors.text }]}>
                        {cfg.sport_id} / {cfg.season_id}
                      </Text>
                      <Text style={[styles.itemMeta, { color: colors.textSecondary }]}>
                        B:{cfg.thresholds_json?.Bronze ?? '?'} S:{cfg.thresholds_json?.Silver ?? '?'} G:{cfg.thresholds_json?.Gold ?? '?'} C:{cfg.thresholds_json?.Champion ?? '?'}
                      </Text>
                      <Text style={[styles.itemMeta, { color: colors.textMuted }]}>
                        +{cfg.points_per_correct_pick_default_int ?? 25}/pick | -{cfg.points_per_incorrect_pick_champion_int ?? 15} champ penalty
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </>
          )
        ) : activeTab === 'bracket' ? (
          <BracketAdminTab colors={colors} />
        ) : activeTab === 'contests' ? (
          <>
            {showContestForm && (
              <View style={[styles.configCard, { backgroundColor: colors.card, borderColor: Colors.primary, marginBottom: 16 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={[styles.configSectionTitle, { color: colors.text, marginBottom: 0 }]}>
                    {editingContestId ? 'EDIT CONTEST' : 'ADD CONTEST'}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Pressable onPress={() => { setEditingContestId(null); setContestForm({ title: '', sport_id: '', season_id: '', league: '', status: 'open', starts_at: '', ends_at: '', contest_type: 'nightly_slate' }); setSelectedGames([]); setContestSport('custom'); const n = new Date(); setGameRangeStart(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`); setGameRangeEnd(''); setGameSearchQuery(''); setFetchGamesEnabled(false); }}>
                      <Ionicons name="refresh" size={20} color={Colors.primary} />
                    </Pressable>
                    <Pressable onPress={() => { setShowContestForm(false); setEditingContestId(null); setContestForm({ title: '', sport_id: '', season_id: '', league: '', status: 'open', starts_at: '', ends_at: '', contest_type: 'nightly_slate' }); setSelectedGames([]); }}>
                      <Ionicons name="close" size={22} color={colors.text} />
                    </Pressable>
                  </View>
                </View>

                <Text style={[styles.label, { color: colors.textSecondary }]}>Sport</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
                  {(['NBA', 'NCAAB', 'custom', 'special'] as const).map(s => (
                    <Pressable
                      key={s}
                      onPress={() => {
                        setContestSport(s);
                        if (s === 'special') {
                          setContestForm(prev => ({ ...prev, contest_type: 'bracket_challenge', sport_id: 'special', league: 'Special' }));
                        }
                      }}
                      style={[styles.pickerItem, { backgroundColor: contestSport === s ? Colors.primary : colors.cardBorder }]}
                    >
                      <Text style={{ color: contestSport === s ? '#000' : colors.text, fontSize: 12 }}>
                        {s === 'custom' ? 'Custom' : s === 'special' ? 'Special' : s}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>

                <Text style={[styles.label, { color: colors.textSecondary }]}>Contest Type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
                  {contestSport === 'special' ? (
                    <Pressable
                      onPress={() => {
                        setContestForm(prev => ({ ...prev, contest_type: 'bracket_challenge' }));
                      }}
                      style={[styles.pickerItem, { backgroundColor: contestForm.contest_type === 'bracket_challenge' ? Colors.primary : colors.cardBorder }]}
                    >
                      <Text style={{ color: contestForm.contest_type === 'bracket_challenge' ? '#000' : colors.text, fontSize: 12 }}>Bracket Challenge</Text>
                    </Pressable>
                  ) : (
                  CONTEST_TYPES.map(t => (
                    <Pressable
                      key={t.value}
                      onPress={() => {
                        const now = new Date();
                        const pad = (n: number) => String(n).padStart(2, '0');
                        const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
                        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                        let starts_at = '';
                        let ends_at = '';
                        if (t.value === 'nightly_slate') {
                          starts_at = localDate(today);
                          ends_at = localDate(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59));
                        } else if (t.value === 'weekly_wire') {
                          const dayOfWeek = now.getDay();
                          const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
                          const sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilSunday);
                          starts_at = localDate(dayOfWeek === 0 ? today : sunday);
                          ends_at = localDate(new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + 6, 23, 59, 59));
                        } else if (t.value === 'over_under') {
                          starts_at = localDate(today);
                          ends_at = localDate(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59));
                        }
                        setContestForm(prev => ({ ...prev, contest_type: t.value, starts_at, ends_at }));
                      }}
                      style={[styles.pickerItem, { backgroundColor: contestForm.contest_type === t.value ? Colors.primary : colors.cardBorder }]}
                    >
                      <Text style={{ color: contestForm.contest_type === t.value ? '#000' : colors.text, fontSize: 12 }}>{t.label}</Text>
                    </Pressable>
                  ))
                  )}
                </ScrollView>

                {contestSport !== 'custom' && contestSport !== 'special' && (
                  <View style={{ marginBottom: 8 }}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Date Range (max 60 days)</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
                      <View style={{ flex: 1 }}>
                        <DatePickerField
                          value={gameRangeStart}
                          onChange={v => { setGameRangeStart(v); setFetchGamesEnabled(false); }}
                          placeholder="Start date"
                          format="date"
                          backgroundColor={colors.cardBorder}
                          textColor={colors.text}
                          placeholderColor={colors.textMuted}
                          fontSize={12}
                          minDate={todayDate}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <DatePickerField
                          value={gameRangeEnd}
                          onChange={v => { setGameRangeEnd(v); setFetchGamesEnabled(false); }}
                          placeholder="End date"
                          format="date"
                          backgroundColor={colors.cardBorder}
                          textColor={colors.text}
                          placeholderColor={colors.textMuted}
                          fontSize={12}
                          minDate={todayDate}
                        />
                      </View>
                      <Pressable
                        onPress={() => {
                          if (!gameRangeStart || !gameRangeEnd) { Alert.alert('Error', 'Enter both start and end dates'); return; }
                          setFetchGamesEnabled(true);
                        }}
                        style={[styles.chipBtn, { backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 10, alignSelf: 'flex-start' }]}
                      >
                        <Text style={{ color: '#000', fontSize: 12, fontWeight: '600' as const }}>
                          {isFetchingRangeGames ? 'Loading...' : 'Fetch'}
                        </Text>
                      </Pressable>
                    </View>

                    {fetchGamesEnabled && rangeGamesData && (
                      <View style={{ marginBottom: 4 }}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>
                          Search Games ({rangeGamesData.total || 0} found)
                        </Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: colors.cardBorder, color: colors.text, fontSize: 12, marginBottom: 4 }]}
                          value={gameSearchQuery}
                          onChangeText={setGameSearchQuery}
                          placeholder="Type to filter by team name..."
                          placeholderTextColor={colors.textMuted}
                        />
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <Text style={{ color: Colors.primary, fontSize: 12, fontWeight: '600' as const }}>
                            {selectedGames.length} game{selectedGames.length !== 1 ? 's' : ''} selected
                          </Text>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <Pressable onPress={() => {
                              const allGames: any[] = rangeGamesData?.games || [];
                              setSelectedGames(allGames);
                            }}>
                              <Text style={{ color: Colors.primary, fontSize: 11 }}>Select All</Text>
                            </Pressable>
                            <Pressable onPress={() => setSelectedGames([])}>
                              <Text style={{ color: '#ff453a', fontSize: 11 }}>Clear</Text>
                            </Pressable>
                          </View>
                        </View>
                        {(() => {
                          const allGames: any[] = rangeGamesData.games || [];
                          const q = gameSearchQuery.toLowerCase().trim();
                          const filtered = q
                            ? allGames.filter((g: any) =>
                                (g.home_team || '').toLowerCase().includes(q) ||
                                (g.away_team || '').toLowerCase().includes(q) ||
                                (g.home_team_full || '').toLowerCase().includes(q) ||
                                (g.away_team_full || '').toLowerCase().includes(q)
                              )
                            : allGames;
                          const display = filtered.slice(0, 20);
                          if (display.length === 0) {
                            return <Text style={[styles.itemMeta, { color: colors.textMuted }]}>No matching games</Text>;
                          }
                          return (
                            <View style={{ maxHeight: 200 }}>
                              <ScrollView nestedScrollEnabled>
                                {display.map((g: any, idx: number) => {
                                  const label = `${g.away_team} @ ${g.home_team}`;
                                  const isSelected = selectedGames.some(sg => sg.id === g.id);
                                  return (
                                    <Pressable
                                      key={`${g.id}-${idx}`}
                                      onPress={() => {
                                        if (isSelected) {
                                          setSelectedGames(prev => prev.filter(sg => sg.id !== g.id));
                                        } else {
                                          setSelectedGames(prev => [...prev, g]);
                                          setContestForm(prev => ({
                                            ...prev,
                                            sport_id: prev.sport_id || contestSport.toLowerCase(),
                                            league: prev.league || contestSport,
                                          }));
                                        }
                                      }}
                                      style={{
                                        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                                        paddingVertical: 8, paddingHorizontal: 10, marginBottom: 2,
                                        backgroundColor: isSelected ? Colors.primary : colors.cardBorder,
                                        borderRadius: 6,
                                      }}
                                    >
                                      <View style={{ flex: 1, gap: 2 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                          <Ionicons name={isSelected ? 'checkbox' : 'square-outline'} size={16} color={isSelected ? '#000' : colors.textMuted} />
                                          <Text style={{ color: isSelected ? '#000' : colors.text, fontSize: 12, flex: 1 }}>{g.away_team_full || g.away_team} @ {g.home_team_full || g.home_team}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 22 }}>
                                          <Text style={{ color: isSelected ? 'rgba(0,0,0,0.6)' : colors.textMuted, fontSize: 10 }}>{g.date || ''}{(() => { const t = g.game_time || g.status || ''; try { const d = new Date(t); if (!isNaN(d.getTime()) && /^\d{4}-\d{2}-\d{2}T/.test(t)) return ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET'; } catch {} return ''; })()}</Text>
                                          {g.away_moneyline != null && <Text style={{ color: isSelected ? 'rgba(0,0,0,0.6)' : colors.textMuted, fontSize: 10 }}>ML: {g.away_moneyline > 0 ? '+' : ''}{g.away_moneyline} / {g.home_moneyline > 0 ? '+' : ''}{g.home_moneyline}</Text>}
                                        </View>
                                      </View>
                                    </Pressable>
                                  );
                                })}
                                {filtered.length > 20 && (
                                  <Text style={[styles.itemMeta, { color: colors.textMuted, textAlign: 'center', marginTop: 4 }]}>
                                    +{filtered.length - 20} more - refine your search
                                  </Text>
                                )}
                              </ScrollView>
                            </View>
                          );
                        })()}
                        {selectedGames.length > 0 && (
                          <View style={{ marginTop: 8 }}>
                            <Text style={[styles.label, { color: colors.textSecondary }]}>Selected Games</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                              {selectedGames.map((g: any) => (
                                <View key={g.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, gap: 4 }}>
                                  <Text style={{ color: '#000', fontSize: 10 }}>{g.away_team_full || g.away_team} @ {g.home_team_full || g.home_team}</Text>
                                  <Pressable onPress={() => setSelectedGames(prev => prev.filter(sg => sg.id !== g.id))}>
                                    <Ionicons name="close-circle" size={14} color="#000" />
                                  </Pressable>
                                </View>
                              ))}
                            </View>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                )}

                <Text style={[styles.label, { color: colors.textSecondary }]}>Title</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.cardBorder, color: colors.text }]}
                  value={contestForm.title}
                  onChangeText={text => setContestForm(prev => ({ ...prev, title: text }))}
                  placeholder="Contest title"
                  placeholderTextColor={colors.textMuted}
                />

                <Text style={[styles.label, { color: colors.textSecondary }]}>Status</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
                  {CONTEST_STATUSES.map(s => (
                    <Pressable
                      key={s}
                      onPress={() => setContestForm(prev => ({ ...prev, status: s }))}
                      style={[styles.pickerItem, { backgroundColor: contestForm.status === s ? Colors.primary : colors.cardBorder }]}
                    >
                      <Text style={{ color: contestForm.status === s ? '#000' : colors.text, fontSize: 12 }}>{s}</Text>
                    </Pressable>
                  ))}
                </ScrollView>

                <Text style={[styles.label, { color: colors.textSecondary }]}>Starts At</Text>
                <DatePickerField
                  value={contestForm.starts_at}
                  onChange={text => setContestForm(prev => ({ ...prev, starts_at: text }))}
                  placeholder="Select start date/time"
                  format="datetime"
                  backgroundColor={colors.cardBorder}
                  textColor={colors.text}
                  placeholderColor={colors.textMuted}
                />

                <Text style={[styles.label, { color: colors.textSecondary }]}>Ends At</Text>
                <DatePickerField
                  value={contestForm.ends_at}
                  onChange={text => setContestForm(prev => ({ ...prev, ends_at: text }))}
                  placeholder="Select end date/time"
                  format="datetime"
                  backgroundColor={colors.cardBorder}
                  textColor={colors.text}
                  placeholderColor={colors.textMuted}
                />

                <Pressable
                  onPress={() => {
                    if (!contestForm.title.trim()) {
                      Alert.alert('Error', 'Title is required');
                      return;
                    }
                    const autoSportId = contestSport !== 'custom' ? contestSport.toLowerCase() : (contestForm.sport_id || undefined);
                    const autoLeague = contestSport !== 'custom' ? contestSport : (contestForm.league || undefined);
                    const payload = {
                      title: contestForm.title,
                      sport_id: autoSportId,
                      season_id: contestForm.season_id || undefined,
                      league: autoLeague,
                      status: contestForm.status,
                      starts_at: contestForm.starts_at || undefined,
                      ends_at: contestForm.ends_at || undefined,
                      game_ids: selectedGames.length > 0 ? selectedGames : undefined,
                      contest_type: contestForm.contest_type,
                    };
                    const mutationCallbacks = {
                      onSuccess: () => {
                        Alert.alert('Success', editingContestId ? 'Contest updated successfully!' : 'Contest created successfully!');
                        setContestForm({ title: '', sport_id: '', season_id: '', league: '', status: 'open', starts_at: '', ends_at: '', contest_type: 'nightly_slate' });
                        setSelectedGames([]);
                        setEditingContestId(null);
                        setShowContestForm(false);
                      },
                      onError: (err: any) => {
                        Alert.alert('Error', err.message || 'Failed to save contest');
                      },
                    };
                    if (editingContestId) {
                      updateContestMutation.mutate({ id: editingContestId, ...payload }, mutationCallbacks);
                    } else {
                      createContestMutation.mutate(payload, mutationCallbacks);
                    }
                  }}
                  style={[styles.saveButton, { backgroundColor: Colors.primary }]}
                >
                  <Text style={styles.saveButtonText}>
                    {(createContestMutation.isPending || updateContestMutation.isPending) ? 'Saving...' :
                      editingContestId ? 'Update Contest' : 'Create Contest'}
                  </Text>
                </Pressable>
              </View>
            )}

            {contestsLoading ? (
              <Text style={[styles.itemName, { color: colors.text, textAlign: 'center', marginTop: 20 }]}>Loading...</Text>
            ) : (contestsData || []).length === 0 && !showContestForm ? (
              <View style={{ alignItems: 'center', marginTop: 60 }}>
                <Ionicons name="trophy-outline" size={48} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted, fontSize: 16, marginTop: 12 }}>No contests yet</Text>
                <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>Tap + to create your first contest</Text>
              </View>
            ) : (
              (contestsData || []).map((contest: any) => (
                <React.Fragment key={contest.id}>
                  <View style={[styles.contestCard, { backgroundColor: colors.card, borderColor: editingContestId === contest.id ? Colors.primary : colors.cardBorder }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemName, { color: colors.text }]}>{contest.title}</Text>
                      <Text style={[styles.itemMeta, { color: colors.textSecondary }]}>
                        {contest.entries ?? 0} entries | {contest.league || 'N/A'} | {contest.status || 'draft'}
                      </Text>
                    </View>
                    <View style={styles.itemActions}>
                      <Pressable
                        onPress={() => {
                          setEditingContestId(contest.id);
                          setContestForm({
                            title: contest.title || '',
                            sport_id: contest.sport_id || '',
                            season_id: contest.season_id || '',
                            league: contest.league || '',
                            status: contest.status || 'open',
                            starts_at: contest.opens_at || '',
                            ends_at: contest.ends_at || '',
                            contest_type: contest.contest_type || 'nightly_slate',
                          });
                          const league = (contest.league || '').toUpperCase();
                          if (contest.contest_type === 'bracket_challenge') {
                            setContestSport('special');
                          } else if (league === 'NBA') {
                            setContestSport('NBA');
                          } else if (league === 'NCAAB') {
                            setContestSport('NCAAB');
                          } else {
                            setContestSport('custom');
                          }
                          const existingGames = contest.scoring_json?.games || [];
                          setSelectedGames(existingGames);
                          setShowContestForm(true);
                        }}
                        style={styles.actionIcon}
                      >
                        <Ionicons name="pencil" size={18} color={Colors.primary} />
                      </Pressable>
                      <Pressable
                        onPress={() => confirmAction(
                          'Delete Contest',
                          `Are you sure you want to delete "${contest.title}"?`,
                          () => deleteContestMutation.mutate(contest.id, {
                            onError: (err: any) => Alert.alert('Error', err.message || 'Failed to delete contest'),
                          })
                        )}
                        style={styles.actionIcon}
                      >
                        <Ionicons name="trash" size={18} color={Colors.error} />
                      </Pressable>
                      <Pressable
                        onPress={() => concludeContestMutation.mutate(contest.id)}
                        style={[styles.concludeBtn, { backgroundColor: Colors.primary }]}
                      >
                        <Text style={styles.concludeBtnText}>
                          {concludeContestMutation.isPending ? '...' : 'Conclude'}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          setAwardingContestId(awardingContestId === contest.id ? null : contest.id);
                          setCrownAwardForm({ user_ids: '', amount: '100', reason: `Winner prize - ${contest.title}` });
                        }}
                        style={styles.actionIcon}
                      >
                        <Ionicons name="gift-outline" size={18} color="#F59E0B" />
                      </Pressable>
                    </View>
                  </View>
                  {awardingContestId === contest.id && (
                    <View style={[styles.configCard, { backgroundColor: colors.card, borderColor: '#F59E0B', marginBottom: 8, padding: 10 }]}>
                      <Text style={[styles.label, { color: colors.textSecondary }]}>Award Crowns for "{contest.title}"</Text>
                      <Text style={[styles.label, { color: colors.textSecondary, fontSize: 11 }]}>User IDs (comma-separated)</Text>
                      <TextInput
                        style={[styles.inputField, { backgroundColor: colors.cardBorder, color: colors.text, fontSize: 12, minHeight: 40 }]}
                        value={crownAwardForm.user_ids}
                        onChangeText={v => setCrownAwardForm(f => ({ ...f, user_ids: v }))}
                        placeholder="user-id-1, user-id-2"
                        placeholderTextColor={colors.textMuted}
                        multiline
                      />
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.label, { color: colors.textSecondary, fontSize: 11 }]}>Crowns Each</Text>
                          <TextInput
                            style={[styles.inputField, { backgroundColor: colors.cardBorder, color: colors.text, fontSize: 12 }]}
                            value={crownAwardForm.amount}
                            onChangeText={v => setCrownAwardForm(f => ({ ...f, amount: v }))}
                            keyboardType="numeric"
                          />
                        </View>
                        <View style={{ flex: 2 }}>
                          <Text style={[styles.label, { color: colors.textSecondary, fontSize: 11 }]}>Reason</Text>
                          <TextInput
                            style={[styles.inputField, { backgroundColor: colors.cardBorder, color: colors.text, fontSize: 12 }]}
                            value={crownAwardForm.reason}
                            onChangeText={v => setCrownAwardForm(f => ({ ...f, reason: v }))}
                          />
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                        <Pressable
                          onPress={() => {
                            const ids = crownAwardForm.user_ids.split(',').map(s => s.trim()).filter(Boolean);
                            if (ids.length === 0) { Alert.alert('Error', 'Enter at least one user ID'); return; }
                            const amt = parseInt(crownAwardForm.amount) || 0;
                            if (amt <= 0) { Alert.alert('Error', 'Amount must be positive'); return; }
                            awardContestCrownsMutation.mutate({
                              contestId: contest.id,
                              user_ids: ids,
                              amount: amt,
                              reason: crownAwardForm.reason || `Contest prize`,
                            }, {
                              onSuccess: () => {
                                Alert.alert('Success', `Awarded ${amt} crowns to ${ids.length} user(s)`);
                                setAwardingContestId(null);
                              },
                            });
                          }}
                          style={[styles.chipBtn, { backgroundColor: '#F59E0B', paddingHorizontal: 12, paddingVertical: 8 }]}
                        >
                          <Text style={{ color: '#000', fontSize: 12, fontWeight: '600' as const }}>
                            {awardContestCrownsMutation.isPending ? 'Awarding...' : 'Award'}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => setAwardingContestId(null)}
                          style={[styles.chipBtn, { backgroundColor: colors.cardBorder, paddingHorizontal: 12, paddingVertical: 8 }]}
                        >
                          <Text style={{ color: colors.text, fontSize: 12 }}>Cancel</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                </React.Fragment>
              ))
            )}
          </>
        ) : activeTab === 'badges' ? (
          <>
            {showBadgeForm && (
              <View style={[styles.configCard, { backgroundColor: colors.card, borderColor: Colors.primary, marginBottom: 16 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={[styles.configSectionTitle, { color: colors.text, marginBottom: 0 }]}>
                    {editingBadgeId ? 'EDIT BADGE' : 'ADD BADGE'}
                  </Text>
                  <Pressable onPress={() => { setShowBadgeForm(false); setEditingBadgeId(null); setBadgeForm({ code: '', name: '', description: '', type: 'TROPHY_ONLY', icon_ref: '', unlockType: 'free', unlockValue: '', unlockContestId: '', unlockSeasonId: '', unlockGiveawayId: '', unlockEloRank: '' }); }}>
                    <Ionicons name="close" size={22} color={colors.text} />
                  </Pressable>
                </View>

                <Text style={[styles.label, { color: colors.textSecondary }]}>Code</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.cardBorder, color: colors.text }]}
                  value={badgeForm.code}
                  onChangeText={text => setBadgeForm(prev => ({ ...prev, code: text }))}
                  placeholder="unique_badge_code"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                />

                <Text style={[styles.label, { color: colors.textSecondary }]}>Name</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.cardBorder, color: colors.text }]}
                  value={badgeForm.name}
                  onChangeText={text => setBadgeForm(prev => ({ ...prev, name: text }))}
                  placeholder="Badge Name"
                  placeholderTextColor={colors.textMuted}
                />

                <Text style={[styles.label, { color: colors.textSecondary }]}>Description</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.cardBorder, color: colors.text }]}
                  value={badgeForm.description}
                  onChangeText={text => setBadgeForm(prev => ({ ...prev, description: text }))}
                  placeholder="Badge description..."
                  placeholderTextColor={colors.textMuted}
                />

                <Text style={[styles.label, { color: colors.textSecondary }]}>Type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
                  {BADGE_TYPES.map(bt => (
                    <Pressable
                      key={bt}
                      onPress={() => setBadgeForm(prev => ({ ...prev, type: bt }))}
                      style={[styles.pickerItem, { backgroundColor: badgeForm.type === bt ? Colors.primary : colors.cardBorder }]}
                    >
                      <Text style={{ color: badgeForm.type === bt ? '#000' : colors.text, fontSize: 12 }}>{bt.replace(/_/g, ' ')}</Text>
                    </Pressable>
                  ))}
                </ScrollView>

                <Text style={[styles.label, { color: colors.textSecondary }]}>Badge Image</Text>
                <View style={styles.imagePickerRow}>
                  {badgeForm.icon_ref ? (
                    <Image source={{ uri: badgeForm.icon_ref }} style={{ width: 64, height: 64, borderRadius: 8 }} />
                  ) : (
                    <View style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: colors.cardBorder, justifyContent: 'center', alignItems: 'center' }}>
                      <Ionicons name="image-outline" size={28} color={colors.textMuted} />
                    </View>
                  )}
                  <View style={{ flex: 1, gap: 6 }}>
                    <Pressable onPress={pickBadgeImage} disabled={isBadgeUploading} style={[styles.imageBtn, { backgroundColor: Colors.primary, opacity: isBadgeUploading ? 0.6 : 1 }]}>
                      <Ionicons name="cloud-upload-outline" size={16} color="#000" />
                      <Text style={styles.imageBtnText}>{isBadgeUploading ? 'Uploading...' : 'Upload Image'}</Text>
                    </Pressable>
                    {badgeForm.icon_ref ? (
                      <Pressable onPress={() => setBadgeForm(prev => ({ ...prev, icon_ref: '' }))} style={[styles.imageBtn, { backgroundColor: Colors.error }]}>
                        <Ionicons name="close-circle-outline" size={16} color="#fff" />
                        <Text style={[styles.imageBtnText, { color: '#fff' }]}>Remove</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>

                <Text style={[styles.label, { color: colors.textSecondary }]}>Unlock Condition</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
                  {UNLOCK_TYPES.map(t => (
                    <Pressable
                      key={t}
                      onPress={() => setBadgeForm(prev => ({ ...prev, unlockType: t }))}
                      style={[styles.pickerItem, { backgroundColor: badgeForm.unlockType === t ? Colors.primary : colors.cardBorder }]}
                    >
                      <Text style={{ color: badgeForm.unlockType === t ? '#000' : colors.text, fontSize: 12 }}>
                        {t.replace(/_/g, ' ')}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>

                {badgeForm.unlockType === 'crowns' && (
                  <>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Crowns Required</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.cardBorder, color: colors.text }]}
                      value={badgeForm.unlockValue}
                      onChangeText={text => setBadgeForm(prev => ({ ...prev, unlockValue: text }))}
                      keyboardType="numeric"
                      placeholder="e.g. 500"
                      placeholderTextColor={colors.textMuted}
                    />
                  </>
                )}

                {badgeForm.unlockType === 'contest_entry' && (
                  <>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Select Contest</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
                      {(contestsData || []).map((contest: any) => (
                        <Pressable
                          key={contest.id}
                          onPress={() => setBadgeForm(prev => ({ ...prev, unlockContestId: contest.id }))}
                          style={[styles.contestPicker, { backgroundColor: badgeForm.unlockContestId === contest.id ? Colors.primary : colors.cardBorder }]}
                        >
                          <Text style={{ color: badgeForm.unlockContestId === contest.id ? '#000' : colors.text, fontSize: 11 }}>{contest.title}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </>
                )}

                {badgeForm.unlockType === 'elo_placement' && (
                  <>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>ELO Rank (Top N)</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.cardBorder, color: colors.text }]}
                      value={badgeForm.unlockEloRank}
                      onChangeText={text => setBadgeForm(prev => ({ ...prev, unlockEloRank: text }))}
                      keyboardType="numeric"
                      placeholder="e.g. 10 (top 10)"
                      placeholderTextColor={colors.textMuted}
                    />
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Contest (optional)</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
                      <Pressable
                        onPress={() => setBadgeForm(prev => ({ ...prev, unlockContestId: '' }))}
                        style={[styles.contestPicker, { backgroundColor: !badgeForm.unlockContestId ? Colors.primary : colors.cardBorder }]}
                      >
                        <Text style={{ color: !badgeForm.unlockContestId ? '#000' : colors.text, fontSize: 11 }}>Any</Text>
                      </Pressable>
                      {(contestsData || []).map((contest: any) => (
                        <Pressable
                          key={contest.id}
                          onPress={() => setBadgeForm(prev => ({ ...prev, unlockContestId: contest.id }))}
                          style={[styles.contestPicker, { backgroundColor: badgeForm.unlockContestId === contest.id ? Colors.primary : colors.cardBorder }]}
                        >
                          <Text style={{ color: badgeForm.unlockContestId === contest.id ? '#000' : colors.text, fontSize: 11 }}>{contest.title}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Season (optional)</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.cardBorder, color: colors.text }]}
                      value={badgeForm.unlockSeasonId}
                      onChangeText={text => setBadgeForm(prev => ({ ...prev, unlockSeasonId: text }))}
                      placeholder="Season ID"
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="none"
                    />
                  </>
                )}

                {badgeForm.unlockType === 'giveaway_win' && (
                  <>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Select Giveaway</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
                      {(giveawaysV2Data || []).map((gw: any) => (
                        <Pressable
                          key={gw.id}
                          onPress={() => setBadgeForm(prev => ({ ...prev, unlockGiveawayId: gw.id }))}
                          style={[styles.contestPicker, { backgroundColor: badgeForm.unlockGiveawayId === gw.id ? Colors.primary : colors.cardBorder }]}
                        >
                          <Text style={{ color: badgeForm.unlockGiveawayId === gw.id ? '#000' : colors.text, fontSize: 11 }}>{gw.title}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </>
                )}

                {badgeForm.unlockType === 'referral_count' && (
                  <>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Referrals Required</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.cardBorder, color: colors.text }]}
                      value={badgeForm.unlockValue}
                      onChangeText={text => setBadgeForm(prev => ({ ...prev, unlockValue: text }))}
                      keyboardType="numeric"
                      placeholder="e.g. 5"
                      placeholderTextColor={colors.textMuted}
                    />
                  </>
                )}

                <Pressable
                  onPress={() => {
                    if (!badgeForm.code.trim() || !badgeForm.name.trim()) {
                      Alert.alert('Error', 'Code and Name are required');
                      return;
                    }
                    const badgeUnlockCondition = {
                      type: badgeForm.unlockType,
                      value: badgeForm.unlockType === 'crowns' || badgeForm.unlockType === 'referral_count'
                        ? parseInt(badgeForm.unlockValue, 10) || 0 : undefined,
                      contestId: (badgeForm.unlockType === 'contest_entry' || badgeForm.unlockType === 'elo_placement')
                        ? badgeForm.unlockContestId || undefined : undefined,
                      seasonId: badgeForm.unlockType === 'elo_placement' ? badgeForm.unlockSeasonId || undefined : undefined,
                      eloRank: badgeForm.unlockType === 'elo_placement' ? parseInt(badgeForm.unlockEloRank, 10) || undefined : undefined,
                      giveawayId: badgeForm.unlockType === 'giveaway_win' ? badgeForm.unlockGiveawayId || undefined : undefined,
                    };
                    const payload = {
                      code: badgeForm.code,
                      name: badgeForm.name,
                      description: badgeForm.description,
                      type: badgeForm.type,
                      icon_asset_ref: badgeForm.icon_ref || undefined,
                      rules_json: badgeUnlockCondition,
                    };
                    if (editingBadgeId) {
                      updateBadgeMutation.mutate({ id: editingBadgeId, ...payload });
                    } else {
                      createBadgeMutation.mutate(payload);
                    }
                    setBadgeForm({ code: '', name: '', description: '', type: 'TROPHY_ONLY', icon_ref: '', unlockType: 'free', unlockValue: '', unlockContestId: '', unlockSeasonId: '', unlockGiveawayId: '', unlockEloRank: '' });
                    setEditingBadgeId(null);
                    setShowBadgeForm(false);
                  }}
                  style={[styles.saveButton, { backgroundColor: Colors.primary }]}
                >
                  <Text style={styles.saveButtonText}>
                    {(createBadgeMutation.isPending || updateBadgeMutation.isPending) ? 'Saving...' :
                      editingBadgeId ? 'Update Badge' : 'Create Badge'}
                  </Text>
                </Pressable>
              </View>
            )}

            {badgesLoading ? (
              <Text style={[styles.itemName, { color: colors.text, textAlign: 'center', marginTop: 20 }]}>Loading badges...</Text>
            ) : (badgesData || []).length === 0 && !showBadgeForm ? (
              <View style={{ alignItems: 'center', marginTop: 60 }}>
                <Ionicons name="ribbon-outline" size={48} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted, fontSize: 16, marginTop: 12 }}>No badges yet</Text>
                <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>Tap + to add your first badge</Text>
              </View>
            ) : (
              (badgesData || []).map((badge: any, idx: number) => (
                <View key={badge.id || idx} style={[styles.itemCard, { backgroundColor: colors.card, borderColor: editingBadgeId === badge.id ? Colors.primary : colors.cardBorder }]}>
                  {badge.icon_asset_ref ? (
                    <Image source={{ uri: badge.icon_asset_ref }} style={{ width: 40, height: 40, borderRadius: 6, marginRight: 10 }} />
                  ) : null}
                  <View style={styles.itemInfo}>
                    <Text style={[styles.itemName, { color: colors.text }]}>{badge.name || badge.code}</Text>
                    <Text style={[styles.itemMeta, { color: colors.textSecondary }]}>
                      {badge.code} | {badge.type}
                    </Text>
                    {badge.rules_json?.type && badge.rules_json.type !== 'free' ? (
                      <Text style={[styles.itemMeta, { color: Colors.primary }]}>
                        Unlock: {badge.rules_json.type.replace(/_/g, ' ')}{badge.rules_json.value ? ` (${badge.rules_json.value})` : ''}{badge.rules_json.eloRank ? ` Top ${badge.rules_json.eloRank}` : ''}
                      </Text>
                    ) : null}
                    {badge.description ? (
                      <Text style={[styles.itemUnlock, { color: colors.textMuted }]}>{badge.description}</Text>
                    ) : null}
                  </View>
                  <View style={styles.itemActions}>
                    <Pressable
                      onPress={() => {
                        setEditingBadgeId(badge.id);
                        const bUnlock = badge.rules_json || {};
                        setBadgeForm({ code: badge.code, name: badge.name, description: badge.description || '', type: badge.type, icon_ref: badge.icon_asset_ref || '', unlockType: bUnlock.type || 'free', unlockValue: String(bUnlock.value || ''), unlockContestId: bUnlock.contestId || '', unlockSeasonId: bUnlock.seasonId || '', unlockGiveawayId: bUnlock.giveawayId || '', unlockEloRank: String(bUnlock.eloRank || '') });
                        setShowBadgeForm(true);
                      }}
                      style={styles.actionIcon}
                    >
                      <Ionicons name="pencil" size={18} color={Colors.primary} />
                    </Pressable>
                    <Pressable
                      onPress={() => confirmAction(
                        'Delete Badge',
                        `Are you sure you want to delete "${badge.name}"?`,
                        () => deleteBadgeMutation.mutate(badge.id)
                      )}
                      style={styles.actionIcon}
                    >
                      <Ionicons name="trash" size={18} color={Colors.error} />
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </>
        ) : activeTab === 'giveaways' ? (
          giveawaysV2Loading ? (
            <Text style={[styles.itemName, { color: colors.text, textAlign: 'center', marginTop: 40 }]}>Loading...</Text>
          ) : (
            <>
              {showGiveawayForm && (
                <View style={[styles.configCard, { backgroundColor: colors.card, borderColor: Colors.primary, marginBottom: 16 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={[styles.configSectionTitle, { color: colors.text, marginBottom: 0 }]}>
                      {editingGiveawayId ? 'EDIT GIVEAWAY' : 'NEW GIVEAWAY'}
                    </Text>
                    <Pressable onPress={() => { setShowGiveawayForm(false); setEditingGiveawayId(null); }}>
                      <Ionicons name="close" size={22} color={colors.text} />
                    </Pressable>
                  </View>

                  <Text style={[styles.label, { color: colors.textSecondary }]}>Title</Text>
                  <TextInput
                    style={[styles.inputField, { backgroundColor: colors.cardBorder, color: colors.text }]}
                    value={giveawayForm.title}
                    onChangeText={v => setGiveawayForm(f => ({ ...f, title: v }))}
                    placeholder="Monthly Crown Giveaway"
                    placeholderTextColor={colors.textMuted}
                  />

                  <Text style={[styles.label, { color: colors.textSecondary }]}>Description</Text>
                  <TextInput
                    style={[styles.inputField, { backgroundColor: colors.cardBorder, color: colors.text, minHeight: 60 }]}
                    value={giveawayForm.description}
                    onChangeText={v => setGiveawayForm(f => ({ ...f, description: v }))}
                    placeholder="Win prizes by meeting entry requirements"
                    placeholderTextColor={colors.textMuted}
                    multiline
                  />

                  <Text style={[styles.label, { color: colors.textSecondary }]}>Prize Description</Text>
                  <TextInput
                    style={[styles.inputField, { backgroundColor: colors.cardBorder, color: colors.text }]}
                    value={giveawayForm.prize_description}
                    onChangeText={v => setGiveawayForm(f => ({ ...f, prize_description: v }))}
                    placeholder="$100 Gift Card"
                    placeholderTextColor={colors.textMuted}
                  />

                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.label, { color: colors.textSecondary }]}>Starts At</Text>
                      <DatePickerField
                        value={giveawayForm.starts_at}
                        onChange={v => setGiveawayForm(f => ({ ...f, starts_at: v }))}
                        placeholder="Select start date"
                        format="date"
                        backgroundColor={colors.cardBorder}
                        textColor={colors.text}
                        placeholderColor={colors.textMuted}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.label, { color: colors.textSecondary }]}>Ends At</Text>
                      <DatePickerField
                        value={giveawayForm.ends_at}
                        onChange={v => setGiveawayForm(f => ({ ...f, ends_at: v }))}
                        placeholder="Select end date"
                        format="date"
                        backgroundColor={colors.cardBorder}
                        textColor={colors.text}
                        placeholderColor={colors.textMuted}
                      />
                    </View>
                  </View>

                  <Text style={[styles.label, { color: colors.textSecondary }]}>Max Winners</Text>
                  <TextInput
                    style={[styles.inputField, { backgroundColor: colors.cardBorder, color: colors.text, width: 80 }]}
                    value={giveawayForm.max_winners}
                    onChangeText={v => setGiveawayForm(f => ({ ...f, max_winners: v }))}
                    keyboardType="numeric"
                  />

                  <Text style={[styles.configSectionTitle, { color: colors.text, marginTop: 12 }]}>ENTRY METHODS</Text>
                  
                  {giveawayForm.entry_methods.map((method, idx) => (
                    <View key={idx} style={[styles.configCard, { backgroundColor: colors.background, borderColor: colors.cardBorder, marginBottom: 8, padding: 10 }]}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <Text style={[styles.itemName, { color: colors.text, fontSize: 13 }]}>
                          {ENTRY_METHOD_TYPES.find(t => t.value === method.type)?.label || method.type}
                        </Text>
                        <Pressable onPress={() => {
                          setGiveawayForm(f => ({ ...f, entry_methods: f.entry_methods.filter((_, i) => i !== idx) }));
                        }}>
                          <Ionicons name="trash-outline" size={18} color="#EF4444" />
                        </Pressable>
                      </View>
                      
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.label, { color: colors.textSecondary, fontSize: 11 }]}>Entries Awarded</Text>
                          <TextInput
                            style={[styles.inputField, { backgroundColor: colors.cardBorder, color: colors.text, fontSize: 13 }]}
                            value={String(method.entries_awarded)}
                            onChangeText={v => {
                              const updated = [...giveawayForm.entry_methods];
                              updated[idx] = { ...updated[idx], entries_awarded: parseInt(v) || 1 };
                              setGiveawayForm(f => ({ ...f, entry_methods: updated }));
                            }}
                            keyboardType="numeric"
                          />
                        </View>
                        {method.type === 'crown_threshold' && (
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.label, { color: colors.textSecondary, fontSize: 11 }]}>Min Crowns</Text>
                            <TextInput
                              style={[styles.inputField, { backgroundColor: colors.cardBorder, color: colors.text, fontSize: 13 }]}
                              value={String(method.config?.min_crowns || '')}
                              onChangeText={v => {
                                const updated = [...giveawayForm.entry_methods];
                                updated[idx] = { ...updated[idx], config: { ...updated[idx].config, min_crowns: parseInt(v) || 0 } };
                                setGiveawayForm(f => ({ ...f, entry_methods: updated }));
                              }}
                              keyboardType="numeric"
                            />
                          </View>
                        )}
                        {method.type === 'contest_entry' && (
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.label, { color: colors.textSecondary, fontSize: 11 }]}>Contest ID</Text>
                            <TextInput
                              style={[styles.inputField, { backgroundColor: colors.cardBorder, color: colors.text, fontSize: 13 }]}
                              value={String(method.config?.contest_id || '')}
                              onChangeText={v => {
                                const updated = [...giveawayForm.entry_methods];
                                updated[idx] = { ...updated[idx], config: { ...updated[idx].config, contest_id: v } };
                                setGiveawayForm(f => ({ ...f, entry_methods: updated }));
                              }}
                            />
                          </View>
                        )}
                        {method.type === 'contest_placement' && (
                          <>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.label, { color: colors.textSecondary, fontSize: 11 }]}>Contest ID</Text>
                              <TextInput
                                style={[styles.inputField, { backgroundColor: colors.cardBorder, color: colors.text, fontSize: 13 }]}
                                value={String(method.config?.contest_id || '')}
                                onChangeText={v => {
                                  const updated = [...giveawayForm.entry_methods];
                                  updated[idx] = { ...updated[idx], config: { ...updated[idx].config, contest_id: v } };
                                  setGiveawayForm(f => ({ ...f, entry_methods: updated }));
                                }}
                              />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.label, { color: colors.textSecondary, fontSize: 11 }]}>Top N</Text>
                              <TextInput
                                style={[styles.inputField, { backgroundColor: colors.cardBorder, color: colors.text, fontSize: 13 }]}
                                value={String(method.config?.top_n || '')}
                                onChangeText={v => {
                                  const updated = [...giveawayForm.entry_methods];
                                  updated[idx] = { ...updated[idx], config: { ...updated[idx].config, top_n: parseInt(v) || 0 } };
                                  setGiveawayForm(f => ({ ...f, entry_methods: updated }));
                                }}
                                keyboardType="numeric"
                              />
                            </View>
                          </>
                        )}
                        {method.type === 'referral' && (
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.label, { color: colors.textSecondary, fontSize: 11 }]}>Min Referrals</Text>
                            <TextInput
                              style={[styles.inputField, { backgroundColor: colors.cardBorder, color: colors.text, fontSize: 13 }]}
                              value={String(method.config?.min_referrals || '')}
                              onChangeText={v => {
                                const updated = [...giveawayForm.entry_methods];
                                updated[idx] = { ...updated[idx], config: { ...updated[idx].config, min_referrals: parseInt(v) || 0 } };
                                setGiveawayForm(f => ({ ...f, entry_methods: updated }));
                              }}
                              keyboardType="numeric"
                            />
                          </View>
                        )}
                        {method.type === 'streak' && (
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.label, { color: colors.textSecondary, fontSize: 11 }]}>Min Weeks</Text>
                            <TextInput
                              style={[styles.inputField, { backgroundColor: colors.cardBorder, color: colors.text, fontSize: 13 }]}
                              value={String(method.config?.min_weeks || '')}
                              onChangeText={v => {
                                const updated = [...giveawayForm.entry_methods];
                                updated[idx] = { ...updated[idx], config: { ...updated[idx].config, min_weeks: parseInt(v) || 0 } };
                                setGiveawayForm(f => ({ ...f, entry_methods: updated }));
                              }}
                              keyboardType="numeric"
                            />
                          </View>
                        )}
                        {method.type === 'social_share' && (
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.label, { color: colors.textSecondary, fontSize: 11 }]}>Min Shares</Text>
                            <TextInput
                              style={[styles.inputField, { backgroundColor: colors.cardBorder, color: colors.text, fontSize: 13 }]}
                              value={String(method.config?.min_shares || '')}
                              onChangeText={v => {
                                const updated = [...giveawayForm.entry_methods];
                                updated[idx] = { ...updated[idx], config: { ...updated[idx].config, min_shares: parseInt(v) || 0 } };
                                setGiveawayForm(f => ({ ...f, entry_methods: updated }));
                              }}
                              keyboardType="numeric"
                            />
                          </View>
                        )}
                        {method.type === 'badge_holder' && (
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.label, { color: colors.textSecondary, fontSize: 11 }]}>Badge Code</Text>
                            <TextInput
                              style={[styles.inputField, { backgroundColor: colors.cardBorder, color: colors.text, fontSize: 13 }]}
                              value={String(method.config?.badge_code || '')}
                              onChangeText={v => {
                                const updated = [...giveawayForm.entry_methods];
                                updated[idx] = { ...updated[idx], config: { ...updated[idx].config, badge_code: v } };
                                setGiveawayForm(f => ({ ...f, entry_methods: updated }));
                              }}
                            />
                          </View>
                        )}
                      </View>
                    </View>
                  ))}

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                    {ENTRY_METHOD_TYPES.filter(t => !giveawayForm.entry_methods.some(m => m.type === t.value)).map(type => (
                      <Pressable
                        key={type.value}
                        onPress={() => {
                          setGiveawayForm(f => ({
                            ...f,
                            entry_methods: [...f.entry_methods, { type: type.value, config: {}, entries_awarded: 1 }],
                          }));
                        }}
                        style={[styles.chipBtn, { backgroundColor: colors.cardBorder, marginRight: 6 }]}
                      >
                        <Ionicons name="add" size={14} color={colors.text} />
                        <Text style={[styles.chipText, { color: colors.text }]}>{type.label}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  <Pressable
                    onPress={() => {
                      const payload = {
                        title: giveawayForm.title,
                        description: giveawayForm.description || null,
                        prize_description: giveawayForm.prize_description || null,
                        starts_at: giveawayForm.starts_at || null,
                        ends_at: giveawayForm.ends_at || null,
                        max_winners: parseInt(giveawayForm.max_winners) || 1,
                        entry_methods: giveawayForm.entry_methods,
                      };
                      if (editingGiveawayId) {
                        updateGiveawayV2Mutation.mutate({ id: editingGiveawayId, ...payload }, {
                          onSuccess: () => { setShowGiveawayForm(false); setEditingGiveawayId(null); },
                        });
                      } else {
                        createGiveawayV2Mutation.mutate(payload, {
                          onSuccess: () => { setShowGiveawayForm(false); },
                        });
                      }
                    }}
                    style={[styles.saveButton, { backgroundColor: Colors.primary, marginTop: 8 }]}
                  >
                    <Text style={styles.saveButtonText}>
                      {(createGiveawayV2Mutation.isPending || updateGiveawayV2Mutation.isPending) ? 'Saving...' : editingGiveawayId ? 'Update Giveaway' : 'Create Giveaway'}
                    </Text>
                  </Pressable>
                </View>
              )}

              {selectedGiveawayId && selectedGiveawayDetail && (
                <View style={[styles.configCard, { backgroundColor: colors.card, borderColor: Colors.primary, marginBottom: 16 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={[styles.configSectionTitle, { color: colors.text, marginBottom: 0 }]}>
                      {selectedGiveawayDetail.title}
                    </Text>
                    <Pressable onPress={() => setSelectedGiveawayId(null)}>
                      <Ionicons name="close" size={22} color={colors.text} />
                    </Pressable>
                  </View>

                  <Text style={[styles.itemMeta, { color: colors.textSecondary, marginBottom: 4 }]}>
                    Status: {selectedGiveawayDetail.status} | Max Winners: {selectedGiveawayDetail.max_winners}
                  </Text>
                  {selectedGiveawayDetail.prize_description && (
                    <Text style={[styles.itemMeta, { color: colors.textSecondary, marginBottom: 4 }]}>
                      Prize: {selectedGiveawayDetail.prize_description}
                    </Text>
                  )}
                  {selectedGiveawayDetail.starts_at && (
                    <Text style={[styles.itemMeta, { color: colors.textSecondary, marginBottom: 4 }]}>
                      {new Date(selectedGiveawayDetail.starts_at).toLocaleDateString()} - {selectedGiveawayDetail.ends_at ? new Date(selectedGiveawayDetail.ends_at).toLocaleDateString() : 'No end date'}
                    </Text>
                  )}

                  {selectedGiveawayDetail.entry_methods?.length > 0 && (
                    <View style={{ marginTop: 8, marginBottom: 8 }}>
                      <Text style={[styles.label, { color: colors.textSecondary }]}>Entry Methods:</Text>
                      {selectedGiveawayDetail.entry_methods.map((m: any, i: number) => (
                        <Text key={i} style={[styles.itemMeta, { color: colors.text, marginLeft: 8 }]}>
                          {ENTRY_METHOD_TYPES.find(t => t.value === m.type)?.label || m.type} (+{m.entries_awarded} entries)
                        </Text>
                      ))}
                    </View>
                  )}

                  {selectedGiveawayDetail.entries && (
                    <Text style={[styles.itemMeta, { color: Colors.primary, marginBottom: 8, fontWeight: '600' as const }]}>
                      {selectedGiveawayDetail.entries.length} qualified entries
                    </Text>
                  )}

                  {selectedGiveawayDetail.winners?.length > 0 && (
                    <View style={{ marginBottom: 8 }}>
                      <Text style={[styles.label, { color: colors.textSecondary }]}>Winners:</Text>
                      {selectedGiveawayDetail.winners.map((w: any) => (
                        <View key={w.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 }}>
                          <Text style={[styles.itemMeta, { color: colors.text }]}>
                            {w.user_id?.substring(0, 8)}... ({w.total_entries} entries) - {w.awarded ? 'Awarded' : 'Pending'}
                          </Text>
                          {!w.awarded && (
                            <Pressable onPress={() => {
                              awardGiveawayWinnerMutation.mutate({ giveaway_id: selectedGiveawayId!, winner_id: w.id });
                            }}>
                              <Ionicons name="gift-outline" size={18} color={Colors.primary} />
                            </Pressable>
                          )}
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                    {selectedGiveawayDetail.status === 'draft' && (
                      <Pressable
                        onPress={() => openGiveawayV2Mutation.mutate(selectedGiveawayId!)}
                        style={[styles.chipBtn, { backgroundColor: '#10B981', paddingHorizontal: 12, paddingVertical: 8 }]}
                      >
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' as const }}>
                          {openGiveawayV2Mutation.isPending ? 'Opening...' : 'Open'}
                        </Text>
                      </Pressable>
                    )}
                    {selectedGiveawayDetail.status === 'open' && (
                      <Pressable
                        onPress={() => evaluateGiveawayV2Mutation.mutate(selectedGiveawayId!)}
                        style={[styles.chipBtn, { backgroundColor: '#3B82F6', paddingHorizontal: 12, paddingVertical: 8 }]}
                      >
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' as const }}>
                          {evaluateGiveawayV2Mutation.isPending ? 'Evaluating...' : 'Evaluate Entries'}
                        </Text>
                      </Pressable>
                    )}
                    {(selectedGiveawayDetail.status === 'open' || selectedGiveawayDetail.status === 'evaluated') && (
                      <Pressable
                        onPress={() => lockGiveawayV2Mutation.mutate(selectedGiveawayId!)}
                        style={[styles.chipBtn, { backgroundColor: '#F59E0B', paddingHorizontal: 12, paddingVertical: 8 }]}
                      >
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' as const }}>
                          {lockGiveawayV2Mutation.isPending ? 'Locking...' : 'Lock'}
                        </Text>
                      </Pressable>
                    )}
                    {selectedGiveawayDetail.status === 'locked' && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <TextInput
                          style={[styles.inputField, { backgroundColor: colors.cardBorder, color: colors.text, width: 50, textAlign: 'center' }]}
                          value={drawWinnerCount}
                          onChangeText={setDrawWinnerCount}
                          keyboardType="numeric"
                        />
                        <Pressable
                          onPress={() => drawGiveawayV2Mutation.mutate({ id: selectedGiveawayId!, num_winners: parseInt(drawWinnerCount) || 3 })}
                          style={[styles.chipBtn, { backgroundColor: '#8B5CF6', paddingHorizontal: 12, paddingVertical: 8 }]}
                        >
                          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' as const }}>
                            {drawGiveawayV2Mutation.isPending ? 'Drawing...' : 'Draw Winners'}
                          </Text>
                        </Pressable>
                      </View>
                    )}
                    {selectedGiveawayDetail.status !== 'cancelled' && selectedGiveawayDetail.status !== 'completed' && (
                      <Pressable
                        onPress={() => {
                          Alert.alert('Cancel Giveaway', 'Are you sure?', [
                            { text: 'No' },
                            { text: 'Yes', style: 'destructive', onPress: () => {
                              cancelGiveawayV2Mutation.mutate(selectedGiveawayId!);
                              setSelectedGiveawayId(null);
                            }},
                          ]);
                        }}
                        style={[styles.chipBtn, { backgroundColor: '#EF4444', paddingHorizontal: 12, paddingVertical: 8 }]}
                      >
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' as const }}>Cancel</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              )}

              {(!giveawaysV2Data || (giveawaysV2Data as any[]).length === 0) ? (
                <Text style={[styles.itemMeta, { color: colors.textMuted, textAlign: 'center', marginTop: 40 }]}>
                  No giveaways yet. Tap + to create one.
                </Text>
              ) : (
                (giveawaysV2Data as any[]).map((g: any) => (
                  <Pressable
                    key={g.id}
                    onPress={() => setSelectedGiveawayId(g.id)}
                    style={[styles.itemCard, { backgroundColor: selectedGiveawayId === g.id ? colors.cardBorder : colors.card, borderColor: colors.cardBorder }]}
                  >
                    <View style={styles.itemInfo}>
                      <Text style={[styles.itemName, { color: colors.text }]}>{g.title}</Text>
                      <Text style={[styles.itemMeta, { color: colors.textSecondary }]}>
                        Status: {g.status} | Max: {g.max_winners} winner{g.max_winners !== 1 ? 's' : ''}
                      </Text>
                      {g.entry_methods?.length > 0 && (
                        <Text style={[styles.itemMeta, { color: colors.textMuted }]}>
                          {g.entry_methods.length} entry method{g.entry_methods.length !== 1 ? 's' : ''}
                        </Text>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {g.status === 'draft' && (
                        <Pressable onPress={() => {
                          setEditingGiveawayId(g.id);
                          setGiveawayForm({
                            title: g.title || '',
                            description: g.description || '',
                            prize_description: g.prize_description || '',
                            starts_at: g.starts_at ? g.starts_at.split('T')[0] : '',
                            ends_at: g.ends_at ? g.ends_at.split('T')[0] : '',
                            max_winners: String(g.max_winners || 1),
                            entry_methods: g.entry_methods || [],
                          });
                          setShowGiveawayForm(true);
                        }}>
                          <Ionicons name="pencil" size={18} color={Colors.primary} />
                        </Pressable>
                      )}
                      {g.status === 'draft' && (
                        <Pressable onPress={() => {
                          Alert.alert('Delete Giveaway', 'Are you sure?', [
                            { text: 'No' },
                            { text: 'Yes', style: 'destructive', onPress: () => deleteGiveawayV2Mutation.mutate(g.id) },
                          ]);
                        }}>
                          <Ionicons name="trash-outline" size={18} color="#EF4444" />
                        </Pressable>
                      )}
                    </View>
                  </Pressable>
                ))
              )}
            </>
          )
        ) : activeTab === 'rules' ? (
          <>
            {showRuleSetForm && (
              <View style={[styles.configCard, { backgroundColor: colors.card, borderColor: Colors.primary, marginBottom: 16 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={[styles.configSectionTitle, { color: colors.text, marginBottom: 0 }]}>
                    {editingRuleSetId ? 'EDIT RULE SET' : 'NEW RULE SET'}
                  </Text>
                  <Pressable onPress={() => { setShowRuleSetForm(false); setEditingRuleSetId(null); }}>
                    <Ionicons name="close" size={22} color={colors.text} />
                  </Pressable>
                </View>

                {!editingRuleSetId && (
                  <>
                    <Text style={[styles.label, { color: colors.textSecondary, marginTop: 0 }]}>START WITH A TEMPLATE</Text>
                    <View style={{ gap: 10, marginBottom: 16 }}>
                      <Pressable
                        onPress={() => {
                          setRuleSetName('Standard Contest');
                          setRuleSetPointsPerPick('10');
                          setRuleSetEntryCrowns('10');
                          setRuleSetEntryCrownsEnabled(true);
                          setRuleSetPlacements([
                            { place: 1, crowns: 100, label: '1st Place' },
                            { place: 2, crowns: 50, label: '2nd Place' },
                            { place: 3, crowns: 25, label: '3rd Place' },
                          ]);
                        }}
                        style={[styles.rsPresetCard, { backgroundColor: colors.cardBorder }]}
                      >
                        <Ionicons name="trophy" size={24} color="#FFD700" />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.rsPresetTitle, { color: colors.text }]}>Standard Contest</Text>
                          <Text style={[styles.rsPresetDesc, { color: colors.textMuted }]}>10 pts/pick, 10 crowns entry, top 3 rewards</Text>
                        </View>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          setRuleSetName('Premium Contest');
                          setRuleSetPointsPerPick('10');
                          setRuleSetEntryCrowns('25');
                          setRuleSetEntryCrownsEnabled(true);
                          setRuleSetPlacements([
                            { place: 1, crowns: 500, label: '1st Place' },
                            { place: 2, crowns: 250, label: '2nd Place' },
                            { place: 3, crowns: 100, label: '3rd Place' },
                            { place: 4, crowns: 50, label: '4th Place' },
                            { place: 5, crowns: 25, label: '5th Place' },
                          ]);
                        }}
                        style={[styles.rsPresetCard, { backgroundColor: colors.cardBorder }]}
                      >
                        <MaterialCommunityIcons name="crown" size={24} color="#FFD700" />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.rsPresetTitle, { color: colors.text }]}>Premium Contest</Text>
                          <Text style={[styles.rsPresetDesc, { color: colors.textMuted }]}>10 pts/pick, 25 crowns entry, top 5 rewards</Text>
                        </View>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          setRuleSetName('');
                          setRuleSetPointsPerPick('');
                          setRuleSetEntryCrowns('');
                          setRuleSetEntryCrownsEnabled(false);
                          setRuleSetPlacements([{ place: 1, crowns: 0, label: '1st Place' }]);
                        }}
                        style={[styles.rsPresetCard, { backgroundColor: colors.cardBorder }]}
                      >
                        <Ionicons name="construct" size={24} color={Colors.primary} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.rsPresetTitle, { color: colors.text }]}>Custom</Text>
                          <Text style={[styles.rsPresetDesc, { color: colors.textMuted }]}>Build from scratch with your own values</Text>
                        </View>
                      </Pressable>
                    </View>
                  </>
                )}

                <Text style={[styles.configSectionTitle, { color: Colors.primary, fontSize: 12 }]}>NAME YOUR RULE SET</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.cardBorder, color: colors.text, marginBottom: 16 }]}
                  value={ruleSetName}
                  onChangeText={setRuleSetName}
                  placeholder="e.g. NBA Daily Standard"
                  placeholderTextColor={colors.textMuted}
                />

                <Text style={[styles.configSectionTitle, { color: Colors.primary, fontSize: 12 }]}>WHERE DOES THIS APPLY?</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                  {([
                    { key: 'GLOBAL', label: 'All Contests', icon: 'globe-outline' as const },
                    { key: 'SPORT', label: 'Specific Sport', icon: 'basketball-outline' as const },
                    { key: 'CONTEST', label: 'Specific Contest', icon: 'ribbon-outline' as const },
                    { key: 'SPONSOR', label: 'Sponsor Contests', icon: 'business-outline' as const },
                  ]).map(scope => (
                    <Pressable
                      key={scope.key}
                      onPress={() => setRuleSetScopeType(scope.key)}
                      style={[styles.rsScopeBtn, {
                        backgroundColor: ruleSetScopeType === scope.key ? Colors.primary : colors.cardBorder,
                      }]}
                    >
                      <Ionicons name={scope.icon} size={16} color={ruleSetScopeType === scope.key ? '#000' : colors.text} />
                      <Text style={{ color: ruleSetScopeType === scope.key ? '#000' : colors.text, fontSize: 12, fontFamily: 'Inter_500Medium' }}>
                        {scope.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {ruleSetScopeType !== 'GLOBAL' && (
                  <View style={{ marginBottom: 16 }}>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.cardBorder, color: colors.text }]}
                      value={ruleSetScopeId}
                      onChangeText={setRuleSetScopeId}
                      placeholder="Enter the ID"
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="none"
                    />
                    <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4 }}>
                      The unique identifier for the {ruleSetScopeType === 'SPORT' ? 'sport' : ruleSetScopeType === 'CONTEST' ? 'contest' : 'sponsor'}
                    </Text>
                  </View>
                )}

                <Text style={[styles.configSectionTitle, { color: Colors.primary, fontSize: 12, marginTop: 8 }]}>SCORING</Text>
                <View style={[styles.rsScoreRow, { backgroundColor: colors.cardBorder }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rsFieldLabel, { color: colors.text }]}>Points per correct pick</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>Players earn this many points for each correct game pick</Text>
                  </View>
                  <View style={styles.rsStepperRow}>
                    <Pressable
                      onPress={() => setRuleSetPointsPerPick(String(Math.max(1, (parseInt(ruleSetPointsPerPick) || 0) - 1)))}
                      style={[styles.rsStepperBtn, { backgroundColor: colors.card }]}
                    >
                      <Ionicons name="remove" size={18} color={colors.text} />
                    </Pressable>
                    <TextInput
                      style={[styles.rsStepperInput, { color: colors.text, backgroundColor: colors.card }]}
                      value={ruleSetPointsPerPick}
                      onChangeText={setRuleSetPointsPerPick}
                      keyboardType="number-pad"
                    />
                    <Pressable
                      onPress={() => setRuleSetPointsPerPick(String((parseInt(ruleSetPointsPerPick) || 0) + 1))}
                      style={[styles.rsStepperBtn, { backgroundColor: colors.card }]}
                    >
                      <Ionicons name="add" size={18} color={colors.text} />
                    </Pressable>
                  </View>
                </View>

                <Text style={[styles.configSectionTitle, { color: Colors.primary, fontSize: 12, marginTop: 16 }]}>CROWN REWARDS</Text>
                <View style={[styles.rsScoreRow, { backgroundColor: colors.cardBorder }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rsFieldLabel, { color: colors.text }]}>Award crowns for entering?</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>Players get these crowns just for participating</Text>
                  </View>
                  <Pressable
                    onPress={() => setRuleSetEntryCrownsEnabled(!ruleSetEntryCrownsEnabled)}
                    style={[styles.toggleTrack, { backgroundColor: ruleSetEntryCrownsEnabled ? Colors.primary : colors.cardBorder }]}
                  >
                    <View style={[styles.toggleThumb, { alignSelf: ruleSetEntryCrownsEnabled ? 'flex-end' : 'flex-start' }]} />
                  </Pressable>
                </View>
                {ruleSetEntryCrownsEnabled && (
                  <View style={[styles.rsScoreRow, { backgroundColor: colors.cardBorder, marginTop: 8 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <MaterialCommunityIcons name="crown" size={18} color="#FFD700" />
                      <Text style={[styles.rsFieldLabel, { color: colors.text }]}>Entry crowns amount</Text>
                    </View>
                    <View style={styles.rsStepperRow}>
                      <Pressable
                        onPress={() => setRuleSetEntryCrowns(String(Math.max(0, (parseInt(ruleSetEntryCrowns) || 0) - 5)))}
                        style={[styles.rsStepperBtn, { backgroundColor: colors.card }]}
                      >
                        <Ionicons name="remove" size={18} color={colors.text} />
                      </Pressable>
                      <TextInput
                        style={[styles.rsStepperInput, { color: colors.text, backgroundColor: colors.card }]}
                        value={ruleSetEntryCrowns}
                        onChangeText={setRuleSetEntryCrowns}
                        keyboardType="number-pad"
                      />
                      <Pressable
                        onPress={() => setRuleSetEntryCrowns(String((parseInt(ruleSetEntryCrowns) || 0) + 5))}
                        style={[styles.rsStepperBtn, { backgroundColor: colors.card }]}
                      >
                        <Ionicons name="add" size={18} color={colors.text} />
                      </Pressable>
                    </View>
                  </View>
                )}

                <Text style={[styles.configSectionTitle, { color: Colors.primary, fontSize: 12, marginTop: 16 }]}>PLACEMENT REWARDS</Text>
                {ruleSetPlacements.map((p, idx) => {
                  const medalColor = p.place === 1 ? '#FFD700' : p.place === 2 ? '#C0C0C0' : p.place === 3 ? '#CD7F32' : '#888';
                  return (
                    <View key={p.place} style={[styles.rsPlacementCard, { backgroundColor: colors.cardBorder }]}>
                      <Ionicons name="trophy" size={22} color={medalColor} />
                      <Text style={[styles.rsPlacementLabel, { color: colors.text }]}>{p.label}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, justifyContent: 'flex-end' }}>
                        <MaterialCommunityIcons name="crown" size={16} color="#FFD700" />
                        <TextInput
                          style={[styles.rsStepperInput, { color: colors.text, backgroundColor: colors.card, width: 60 }]}
                          value={String(p.crowns)}
                          onChangeText={text => {
                            const updated = [...ruleSetPlacements];
                            updated[idx] = { ...updated[idx], crowns: parseInt(text) || 0 };
                            setRuleSetPlacements(updated);
                          }}
                          keyboardType="number-pad"
                        />
                        {p.place > 1 && (
                          <Pressable onPress={() => setRuleSetPlacements(ruleSetPlacements.filter((_, i) => i !== idx))}>
                            <Ionicons name="close-circle" size={20} color={Colors.error} />
                          </Pressable>
                        )}
                      </View>
                    </View>
                  );
                })}
                <Pressable
                  onPress={() => {
                    const next = ruleSetPlacements.length + 1;
                    const ordinal = next === 1 ? '1st' : next === 2 ? '2nd' : next === 3 ? '3rd' : `${next}th`;
                    setRuleSetPlacements([...ruleSetPlacements, { place: next, crowns: 0, label: `${ordinal} Place` }]);
                  }}
                  style={[styles.rsAddPlacementBtn, { borderColor: Colors.primary }]}
                >
                  <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
                  <Text style={{ color: Colors.primary, fontSize: 13, fontFamily: 'Inter_500Medium' }}>Add Placement</Text>
                </Pressable>

                <Text style={[styles.configSectionTitle, { color: Colors.primary, fontSize: 12, marginTop: 16 }]}>PREVIEW</Text>
                <View style={[styles.rsPreviewCard, { backgroundColor: colors.cardBorder }]}>
                  <Text style={[styles.rsPreviewLine, { color: colors.text }]}>
                    Applies to: {ruleSetScopeType === 'GLOBAL' ? 'All Contests' : ruleSetScopeType === 'SPORT' ? 'Specific Sport' : ruleSetScopeType === 'CONTEST' ? 'Specific Contest' : 'Sponsor Contests'}
                  </Text>
                  <Text style={[styles.rsPreviewLine, { color: colors.text }]}>
                    Points per correct pick: {ruleSetPointsPerPick || '0'}
                  </Text>
                  {ruleSetEntryCrownsEnabled && (
                    <Text style={[styles.rsPreviewLine, { color: colors.text }]}>
                      Entry bonus: {ruleSetEntryCrowns || '0'} crowns
                    </Text>
                  )}
                  <Text style={[styles.rsPreviewLine, { color: colors.text }]}>
                    {ruleSetPlacements.map(p => `${p.label}: ${p.crowns} crowns`).join(', ')}
                  </Text>
                </View>

                <Pressable
                  onPress={() => {
                    if (!ruleSetName.trim()) {
                      Alert.alert('Missing Name', 'Please give your rule set a name');
                      return;
                    }
                    const rulesJson: any = {
                      name: ruleSetName.trim(),
                      scoring: { points_per_correct_pick: parseInt(ruleSetPointsPerPick) || 0 },
                      crowns: { contest_entry: ruleSetEntryCrownsEnabled ? (parseInt(ruleSetEntryCrowns) || 0) : 0 },
                      placement_rewards: {} as Record<string, number>,
                    };
                    ruleSetPlacements.forEach(p => {
                      rulesJson.placement_rewards[String(p.place)] = p.crowns;
                    });

                    const payload = {
                      scope_type: ruleSetScopeType,
                      scope_id: ruleSetScopeType === 'GLOBAL' ? null : ruleSetScopeId || null,
                      rules_json: rulesJson,
                    };

                    if (editingRuleSetId) {
                      updateRuleSetMutation.mutate({ id: editingRuleSetId, ...payload });
                    } else {
                      createRuleSetMutation.mutate(payload);
                    }
                    setShowRuleSetForm(false);
                    setEditingRuleSetId(null);
                  }}
                  style={[styles.saveButton, { backgroundColor: Colors.primary, marginTop: 16 }]}
                >
                  <Text style={styles.saveButtonText}>
                    {editingRuleSetId
                      ? (updateRuleSetMutation.isPending ? 'Saving...' : 'Save Changes')
                      : (createRuleSetMutation.isPending ? 'Creating...' : 'Create Rule Set')}
                  </Text>
                </Pressable>
              </View>
            )}

            {ruleSetsLoading ? (
              <Text style={[styles.itemName, { color: colors.text, textAlign: 'center', marginTop: 20 }]}>Loading...</Text>
            ) : (ruleSetsData || []).length === 0 && !showRuleSetForm ? (
              <View style={{ alignItems: 'center', marginTop: 60 }}>
                <Ionicons name="settings-outline" size={48} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted, fontSize: 16, marginTop: 12 }}>No rule sets yet</Text>
                <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>Tap + to add your first rule set</Text>
              </View>
            ) : (
              (ruleSetsData || []).map((rs: any) => {
                const rj = rs.rules_json || {};
                const rsName = rj.name || rs.scope_type;
                const ptsPerPick = rj.scoring?.points_per_correct_pick ?? '?';
                const entryCrowns = rj.crowns?.contest_entry ?? 0;
                const firstPlace = rj.placement_rewards?.['1'] ?? 0;
                const scopeLabel = rs.scope_type === 'GLOBAL' ? 'All Contests' : rs.scope_type === 'SPORT' ? 'Specific Sport' : rs.scope_type === 'CONTEST' ? 'Specific Contest' : 'Sponsor Contests';

                return (
                  <Pressable
                    key={rs.id}
                    onPress={() => {
                      setEditingRuleSetId(rs.id);
                      setRuleSetName(rj.name || '');
                      setRuleSetScopeType(rs.scope_type || 'GLOBAL');
                      setRuleSetScopeId(rs.scope_id || '');
                      setRuleSetPointsPerPick(String(rj.scoring?.points_per_correct_pick ?? 10));
                      const ec = rj.crowns?.contest_entry ?? 0;
                      setRuleSetEntryCrowns(String(ec));
                      setRuleSetEntryCrownsEnabled(ec > 0);
                      const pr = rj.placement_rewards || {};
                      const placements = Object.entries(pr).map(([place, crowns]) => {
                        const p = parseInt(place);
                        const ordinal = p === 1 ? '1st' : p === 2 ? '2nd' : p === 3 ? '3rd' : `${p}th`;
                        return { place: p, crowns: crowns as number, label: `${ordinal} Place` };
                      }).sort((a, b) => a.place - b.place);
                      setRuleSetPlacements(placements.length > 0 ? placements : [{ place: 1, crowns: 0, label: '1st Place' }]);
                      setShowRuleSetForm(true);
                    }}
                    style={[styles.rsListCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Text style={[styles.rsListName, { color: colors.text }]}>{rsName}</Text>
                        <View style={[styles.rsStatusBadge, { backgroundColor: rs.is_active ? '#22C55E20' : colors.cardBorder }]}>
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: rs.is_active ? '#22C55E' : '#888' }} />
                          <Text style={{ fontSize: 10, fontFamily: 'Inter_600SemiBold', color: rs.is_active ? '#22C55E' : '#888' }}>
                            {rs.is_active ? 'ACTIVE' : 'INACTIVE'}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 2 }}>
                        {ptsPerPick} pts/pick {entryCrowns > 0 ? `\u2022 ${entryCrowns} crowns entry ` : ''}{firstPlace > 0 ? `\u2022 1st: ${firstPlace} crowns` : ''}
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: 11 }}>Applies to: {scopeLabel}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {!rs.is_active && (
                        <>
                          <Pressable
                            onPress={(e) => { e.stopPropagation(); activateRuleSetMutation.mutate(rs.id); }}
                            style={[styles.concludeBtn, { backgroundColor: Colors.primary }]}
                          >
                            <Text style={styles.concludeBtnText}>Activate</Text>
                          </Pressable>
                          <Pressable
                            onPress={(e) => {
                              e.stopPropagation();
                              confirmAction(
                                'Delete Rule Set',
                                'Are you sure you want to delete this inactive rule set?',
                                () => deleteRuleSetMutation.mutate(rs.id)
                              );
                            }}
                          >
                            <Ionicons name="trash" size={18} color={Colors.error} />
                          </Pressable>
                        </>
                      )}
                      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                    </View>
                  </Pressable>
                );
              })
            )}
          </>
        ) : activeTab === 'sponsors' ? (
          <>
            {viewingSponsorResources ? (() => {
              const sponsor = (adminSponsorsData || []).find((s: any) => s.id === viewingSponsorResources);
              return (
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <Text style={[styles.configSectionTitle, { color: colors.text, flex: 1 }]}>
                      Resources for {sponsor?.company_name || 'Sponsor'}
                    </Text>
                    <Pressable onPress={() => setViewingSponsorResources(null)}>
                      <Ionicons name="close" size={24} color={colors.text} />
                    </Pressable>
                  </View>
                  <Pressable
                    style={[styles.saveButton, { backgroundColor: Colors.primary, marginBottom: 12 }]}
                    onPress={() => pickAndUploadResource(viewingSponsorResources)}
                  >
                    <Text style={styles.saveButtonText}>Upload Resource</Text>
                  </Pressable>
                  {(sponsorResourcesData || []).length === 0 ? (
                    <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 20 }}>No resources uploaded yet</Text>
                  ) : (
                    (sponsorResourcesData || []).map((res: any, idx: number) => (
                      <View key={res.file_name || idx} style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.cardBorder, flexDirection: 'row', alignItems: 'center' }]}>
                        {res.mime_type?.startsWith('image') && res.url ? (
                          <Image source={{ uri: res.url }} style={{ width: 50, height: 50, borderRadius: 6, marginRight: 10 }} />
                        ) : null}
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.itemName, { color: colors.text }]}>{res.file_name}</Text>
                          <Text style={[styles.itemMeta, { color: colors.textMuted }]}>{res.file_type} - {res.mime_type}</Text>
                        </View>
                        <Pressable onPress={() => confirmAction('Delete Resource', `Delete "${res.file_name}"?`, () => deleteSponsorResourceMutation.mutate({ sponsorId: viewingSponsorResources, fileName: res.file_name }))}>
                          <Ionicons name="trash" size={18} color={Colors.error} />
                        </Pressable>
                      </View>
                    ))
                  )}
                </View>
              );
            })() : showSponsorForm ? (
              <View>
                <Text style={[styles.configSectionTitle, { color: colors.text, marginBottom: 12 }]}>
                  {editingSponsorId ? 'EDIT SPONSOR' : 'NEW SPONSOR'}
                </Text>
                <Text style={[styles.label, { color: colors.text }]}>Company Name *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.cardBorder }]}
                  value={sponsorForm.company_name}
                  onChangeText={v => setSponsorForm(p => ({ ...p, company_name: v }))}
                  placeholder="Company name"
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={[styles.label, { color: colors.text }]}>Contact Email *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.cardBorder }]}
                  value={sponsorForm.contact_email}
                  onChangeText={v => setSponsorForm(p => ({ ...p, contact_email: v }))}
                  placeholder="email@example.com"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="email-address"
                />
                <Text style={[styles.label, { color: colors.text }]}>Website</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.cardBorder }]}
                  value={sponsorForm.website}
                  onChangeText={v => setSponsorForm(p => ({ ...p, website: v }))}
                  placeholder="https://..."
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={[styles.label, { color: colors.text }]}>Description</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.cardBorder, minHeight: 80 }]}
                  value={sponsorForm.description}
                  onChangeText={v => setSponsorForm(p => ({ ...p, description: v }))}
                  placeholder="About this sponsor..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                />
                <Text style={[styles.label, { color: colors.text }]}>Brand Color</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                  {['#00D4AA', '#3B82F6', '#8B5CF6', '#F97316', '#EC4899', '#22C55E', '#EF4444', '#EAB308'].map(c => (
                    <Pressable
                      key={c}
                      onPress={() => setSponsorForm(p => ({ ...p, brand_color: c }))}
                      style={{
                        width: 32, height: 32, borderRadius: 16, backgroundColor: c,
                        borderWidth: sponsorForm.brand_color === c ? 3 : 0,
                        borderColor: '#fff',
                      }}
                    />
                  ))}
                </View>
                <Text style={[styles.label, { color: colors.text }]}>Business Type</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.cardBorder }]}
                  value={sponsorForm.business_type}
                  onChangeText={v => setSponsorForm(p => ({ ...p, business_type: v }))}
                  placeholder="e.g. Restaurant/Bar, Retail, Tech"
                  placeholderTextColor={colors.textMuted}
                />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: colors.text }]}>City</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.cardBorder }]}
                      value={sponsorForm.city}
                      onChangeText={v => setSponsorForm(p => ({ ...p, city: v }))}
                      placeholder="City"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: colors.text }]}>State</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.cardBorder }]}
                      value={sponsorForm.state}
                      onChangeText={v => setSponsorForm(p => ({ ...p, state: v }))}
                      placeholder="State"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                </View>
                <Text style={[styles.label, { color: colors.text }]}>Link to User</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.cardBorder }]}
                  value={sponsorForm.user_id}
                  onChangeText={v => setSponsorForm(p => ({ ...p, user_id: v }))}
                  placeholder="User ID"
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: -8, marginBottom: 12 }}>
                  Enter a user ID to give them sponsor portal access
                </Text>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                  <Pressable
                    style={[styles.saveButton, { backgroundColor: colors.card, flex: 1 }]}
                    onPress={() => setShowSponsorForm(false)}
                  >
                    <Text style={[styles.saveButtonText, { color: colors.text }]}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.saveButton, { backgroundColor: Colors.primary, flex: 1 }]}
                    onPress={() => {
                      if (!sponsorForm.company_name || !sponsorForm.contact_email) {
                        Alert.alert('Error', 'Company name and contact email are required');
                        return;
                      }
                      if (editingSponsorId) {
                        updateSponsorMutation.mutate({ id: editingSponsorId, ...sponsorForm }, { onSuccess: () => setShowSponsorForm(false) });
                      } else {
                        createSponsorMutation.mutate(sponsorForm, { onSuccess: () => setShowSponsorForm(false) });
                      }
                    }}
                  >
                    <Text style={styles.saveButtonText}>Save</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <>
                <Text style={[styles.configSectionTitle, { color: colors.text, marginBottom: 8 }]}>BRAND SPONSORS</Text>
                {(adminSponsorsData || []).length === 0 ? (
                  <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 40 }}>No sponsors yet. Tap + to add one.</Text>
                ) : (
                  (adminSponsorsData || []).map((sponsor: any) => {
                    const statusColor = sponsor.status === 'approved' ? Colors.success : sponsor.status === 'pending' ? Colors.warning : sponsor.status === 'suspended' ? Colors.error : colors.textMuted;
                    return (
                      <View key={sponsor.id} style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                          <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: sponsor.brand_color || '#00D4AA', marginRight: 8 }} />
                          <Text style={[styles.itemName, { color: colors.text, flex: 1 }]}>{sponsor.company_name}</Text>
                          <View style={{ backgroundColor: statusColor + '22', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                            <Text style={{ color: statusColor, fontSize: 11, fontWeight: '600', textTransform: 'uppercase' }}>{sponsor.status || 'pending'}</Text>
                          </View>
                        </View>
                        <Text style={[styles.itemMeta, { color: colors.textMuted }]}>{sponsor.contact_email}</Text>
                        {(sponsor.business_type || sponsor.city || sponsor.state) ? (
                          <Text style={[styles.itemMeta, { color: colors.textMuted }]}>
                            {[sponsor.business_type, [sponsor.city, sponsor.state].filter(Boolean).join(', ')].filter(Boolean).join(' / ')}
                          </Text>
                        ) : null}
                        <Text style={[styles.itemMeta, { color: colors.textMuted, fontSize: 11 }]}>
                          {sponsor.user_id ? `User: ${sponsor.user_id.substring(0, 8)}...` : 'No user linked'}
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                          <Pressable onPress={() => router.push(`/sponsor?sponsorId=${sponsor.id}`)}>
                            <Ionicons name="eye" size={18} color={Colors.primary} />
                          </Pressable>
                          <Pressable onPress={() => {
                            setEditingSponsorId(sponsor.id);
                            setSponsorForm({
                              company_name: sponsor.company_name || '',
                              contact_email: sponsor.contact_email || '',
                              website: sponsor.website || '',
                              description: sponsor.description || '',
                              brand_color: sponsor.brand_color || '#00D4AA',
                              business_type: sponsor.business_type || '',
                              city: sponsor.city || '',
                              state: sponsor.state || '',
                              user_id: sponsor.user_id || '',
                            });
                            setShowSponsorForm(true);
                          }}>
                            <Ionicons name="pencil" size={18} color={Colors.primary} />
                          </Pressable>
                          <Pressable onPress={() => setViewingSponsorResources(sponsor.id)}>
                            <Ionicons name="folder" size={18} color={Colors.primary} />
                          </Pressable>
                          <Pressable onPress={() => confirmAction('Delete Sponsor', `Delete "${sponsor.company_name}"?`, () => deleteSponsorMutation.mutate(sponsor.id))}>
                            <Ionicons name="trash" size={18} color={Colors.error} />
                          </Pressable>
                        </View>
                      </View>
                    );
                  })
                )}
              </>
            )}
          </>
        ) : activeTab === 'audit' ? (
          auditLoading ? (
            <Text style={[styles.itemName, { color: colors.text, textAlign: 'center', marginTop: 40 }]}>Loading...</Text>
          ) : (
            <>
              <Text style={[styles.configSectionTitle, { color: colors.text, marginBottom: 8 }]}>AUDIT LOG</Text>
              {(auditLogData || []).length === 0 ? (
                <Text style={[styles.giveawayStatus, { color: colors.textMuted, textAlign: 'center', marginTop: 40 }]}>No audit entries yet</Text>
              ) : (
                (auditLogData || []).map((entry: any) => (
                  <View key={entry.id} style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                    <View style={styles.itemInfo}>
                      <Text style={[styles.itemName, { color: colors.text }]}>{entry.action}</Text>
                      <Text style={[styles.itemMeta, { color: colors.textSecondary }]}>
                        {entry.entity_type} {entry.entity_id ? `/ ${entry.entity_id.slice(0, 8)}...` : ''}
                      </Text>
                      <Text style={[styles.itemUnlock, { color: colors.textMuted }]}>
                        {new Date(entry.created_at).toLocaleString()} {entry.actor_user_id ? `by ${entry.actor_user_id.slice(0, 8)}...` : ''}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </>
          )
        ) : activeTab === 'fraud' ? (
          fraudLoading ? (
            <Text style={[styles.itemName, { color: colors.text, textAlign: 'center', marginTop: 40 }]}>Loading...</Text>
          ) : (
            <>
              <Text style={[styles.configSectionTitle, { color: colors.text, marginBottom: 8 }]}>FRAUD FLAGS</Text>
              {(fraudFlagsData || []).length === 0 ? (
                <Text style={[styles.giveawayStatus, { color: colors.textMuted, textAlign: 'center', marginTop: 40 }]}>No fraud flags</Text>
              ) : (
                (fraudFlagsData || []).map((flag: any) => (
                  <View key={flag.id} style={[styles.configCard, { backgroundColor: colors.card, borderColor: colors.cardBorder, marginBottom: 10 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={[styles.itemName, { color: colors.text }]}>{flag.flag_type}</Text>
                      <View style={{ backgroundColor: flag.severity >= 3 ? Colors.error : Colors.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                        <Text style={{ color: '#000', fontSize: 11, fontFamily: 'Inter_600SemiBold' }}>Severity {flag.severity}</Text>
                      </View>
                    </View>
                    <Text style={[styles.itemMeta, { color: colors.textSecondary }]}>
                      User: {flag.user_id?.slice(0, 12)}...
                    </Text>
                    <Text style={[styles.itemUnlock, { color: colors.textMuted, marginBottom: 8 }]}>
                      {new Date(flag.created_at).toLocaleString()}
                    </Text>
                    {flag.meta && (
                      <Text style={[styles.itemUnlock, { color: colors.textMuted, marginBottom: 8 }]} numberOfLines={3}>
                        {JSON.stringify(flag.meta)}
                      </Text>
                    )}
                    {!flag.resolved_at && (
                      <>
                        {selectedFraudId === flag.id ? (
                          <View style={{ gap: 8 }}>
                            <TextInput
                              style={[styles.input, { backgroundColor: colors.cardBorder, color: colors.text }]}
                              value={fraudResolveNote}
                              onChangeText={setFraudResolveNote}
                              placeholder="Resolution note..."
                              placeholderTextColor={colors.textMuted}
                            />
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                              <Pressable
                                onPress={() => {
                                  resolveFraudMutation.mutate({ flagId: flag.id, note: fraudResolveNote });
                                  setSelectedFraudId(null);
                                  setFraudResolveNote('');
                                }}
                                style={[styles.concludeBtn, { backgroundColor: Colors.primary, flex: 1, alignItems: 'center' }]}
                              >
                                <Text style={styles.concludeBtnText}>Resolve</Text>
                              </Pressable>
                              <Pressable
                                onPress={() => { setSelectedFraudId(null); setFraudResolveNote(''); }}
                                style={[styles.concludeBtn, { backgroundColor: colors.cardBorder, flex: 1, alignItems: 'center' }]}
                              >
                                <Text style={[styles.concludeBtnText, { color: colors.text }]}>Cancel</Text>
                              </Pressable>
                            </View>
                          </View>
                        ) : (
                          <Pressable
                            onPress={() => setSelectedFraudId(flag.id)}
                            style={[styles.concludeBtn, { backgroundColor: Colors.primary, alignSelf: 'flex-start' }]}
                          >
                            <Text style={styles.concludeBtnText}>Resolve Flag</Text>
                          </Pressable>
                        )}
                      </>
                    )}
                    {flag.resolved_at && (
                      <View style={{ backgroundColor: colors.cardBorder, padding: 8, borderRadius: 8, marginTop: 4 }}>
                        <Text style={[styles.itemMeta, { color: colors.textSecondary }]}>
                          Resolved: {new Date(flag.resolved_at).toLocaleString()}
                        </Text>
                        {flag.resolution_note && (
                          <Text style={[styles.itemUnlock, { color: colors.textMuted }]}>{flag.resolution_note}</Text>
                        )}
                      </View>
                    )}
                  </View>
                ))
              )}
            </>
          )
        ) : activeTab === 'referrals' ? (
          <>
            <Text style={[styles.configSectionTitle, { color: colors.text, marginBottom: 8 }]}>REFERRAL CODES</Text>
            {(adminReferralsData || []).length === 0 ? (
              <View style={[styles.configCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <Text style={[styles.giveawayStatus, { color: colors.textMuted, textAlign: 'center' }]}>No referral codes found</Text>
                <Text style={[styles.giveawayStatus, { color: colors.textMuted }]}>
                  Referral codes are auto-generated per user. When a referred user completes their first contest entry, both users earn crowns.
                </Text>
                <View style={styles.configSection}>
                  <View style={styles.configRow}>
                    <Text style={[styles.configLabel, { color: colors.textSecondary }]}>Referrer Bonus</Text>
                    <Text style={[styles.configInput, { color: colors.text }]}>{gamificationConfig?.referral_bonus || 100}</Text>
                  </View>
                </View>
                <Text style={[styles.giveawayStatus, { color: colors.textMuted }]}>
                  Adjust referral bonus amounts in the Crowns tab under Social & Limits.
                </Text>
              </View>
            ) : (
              (adminReferralsData || []).map((ref: any) => (
                <View key={ref.id} style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                  <View style={styles.itemInfo}>
                    <Text style={[styles.itemName, { color: colors.text }]}>{ref.code}</Text>
                    <Text style={[styles.itemMeta, { color: colors.textSecondary }]}>
                      Referrer: {ref.referrer_id?.slice(0, 12)}...
                    </Text>
                    <Text style={[styles.itemUnlock, { color: colors.textMuted }]}>
                      Used: {ref.referred_count ?? 0} times | {ref.is_active ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </>
        ) : activeTab === 'users' ? (
          <>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <TextInput
                style={[styles.input, { backgroundColor: colors.cardBorder, color: colors.text, flex: 1 }]}
                value={userSearch}
                onChangeText={setUserSearch}
                placeholder="Search users by name or email..."
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
              />
              <Pressable
                onPress={() => {
                  setShowCreateUser(!showCreateUser);
                  setEditingUser(null);
                  setNewUserForm({ email: '', password: '', username: '', role: 'user', is_admin: false });
                }}
                style={[styles.concludeBtn, { backgroundColor: Colors.primary, paddingHorizontal: 14 }]}
              >
                <Text style={styles.concludeBtnText}>{showCreateUser ? 'Cancel' : '+ Add User'}</Text>
              </Pressable>
            </View>

            {showCreateUser && (
              <View style={[styles.configCard, { backgroundColor: colors.card, borderColor: Colors.primary, marginBottom: 16 }]}>
                <Text style={[styles.itemName, { color: colors.text, marginBottom: 10 }]}>Create New User</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.cardBorder, color: colors.text, marginBottom: 8 }]}
                  value={newUserForm.username}
                  onChangeText={(v) => setNewUserForm(p => ({ ...p, username: v }))}
                  placeholder="Username"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                />
                <TextInput
                  style={[styles.input, { backgroundColor: colors.cardBorder, color: colors.text, marginBottom: 8 }]}
                  value={newUserForm.email}
                  onChangeText={(v) => setNewUserForm(p => ({ ...p, email: v }))}
                  placeholder="Email"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <TextInput
                  style={[styles.input, { backgroundColor: colors.cardBorder, color: colors.text, marginBottom: 8 }]}
                  value={newUserForm.password}
                  onChangeText={(v) => setNewUserForm(p => ({ ...p, password: v }))}
                  placeholder="Password"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                />
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                  {['user', 'moderator', 'admin', 'sponsor'].map(r => (
                    <Pressable
                      key={r}
                      onPress={() => setNewUserForm(p => ({ ...p, role: r, is_admin: r === 'admin' ? true : p.is_admin }))}
                      style={[styles.concludeBtn, { backgroundColor: newUserForm.role === r ? Colors.primary : colors.cardBorder }]}
                    >
                      <Text style={[styles.concludeBtnText, { color: newUserForm.role === r ? '#000' : colors.text }]}>
                        {r.charAt(0).toUpperCase() + r.slice(1)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Pressable
                  onPress={() => setNewUserForm(p => ({ ...p, is_admin: !p.is_admin }))}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}
                >
                  <Ionicons name={newUserForm.is_admin ? 'checkbox' : 'square-outline'} size={22} color={Colors.primary} />
                  <Text style={{ color: colors.text, fontSize: 14 }}>Grant Admin Access</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (!newUserForm.email || !newUserForm.password) {
                      Alert.alert('Error', 'Email and password are required');
                      return;
                    }
                    if (newUserForm.password.length < 6) {
                      Alert.alert('Error', 'Password must be at least 6 characters');
                      return;
                    }
                    createUserMutation.mutate(newUserForm, {
                      onSuccess: () => {
                        setShowCreateUser(false);
                        setNewUserForm({ email: '', password: '', username: '', role: 'user', is_admin: false });
                        Alert.alert('Success', 'User created successfully');
                      },
                      onError: (err: any) => Alert.alert('Error', err?.message || 'Failed to create user'),
                    });
                  }}
                  style={[styles.concludeBtn, { backgroundColor: Colors.primary, alignItems: 'center' }]}
                >
                  <Text style={styles.concludeBtnText}>{createUserMutation.isPending ? 'Creating...' : 'Create User'}</Text>
                </Pressable>
              </View>
            )}

            {(adminUsersData || []).length === 0 ? (
              <Text style={[styles.giveawayStatus, { color: colors.textMuted, textAlign: 'center', marginTop: 40 }]}>No users found</Text>
            ) : (
              (adminUsersData || []).map((user: any) => (
                <View key={user.id} style={[styles.configCard, { backgroundColor: colors.card, borderColor: editingUser?.id === user.id ? Colors.primary : colors.cardBorder, marginBottom: 10 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemName, { color: colors.text }]}>{user.username || 'No username'}</Text>
                      <Text style={[styles.itemMeta, { color: colors.textSecondary }]}>{user.email || 'No email'}</Text>
                      <Text style={[styles.itemUnlock, { color: colors.textMuted }]}>
                        Crowns: {user.crown_balance ?? 0} | Role: {user.role || 'user'}{user.is_admin ? ' | Admin' : ''}{user.is_banned ? ' | BANNED' : ''}
                      </Text>
                    </View>
                  </View>

                  {editingUser?.id === user.id ? (
                    <View style={{ gap: 8, marginBottom: 8 }}>
                      <TextInput
                        style={[styles.input, { backgroundColor: colors.cardBorder, color: colors.text }]}
                        value={editUserForm.username}
                        onChangeText={(v) => setEditUserForm(p => ({ ...p, username: v }))}
                        placeholder="Username"
                        placeholderTextColor={colors.textMuted}
                        autoCapitalize="none"
                      />
                      <TextInput
                        style={[styles.input, { backgroundColor: colors.cardBorder, color: colors.text }]}
                        value={editUserForm.email}
                        onChangeText={(v) => setEditUserForm(p => ({ ...p, email: v }))}
                        placeholder="Email"
                        placeholderTextColor={colors.textMuted}
                        autoCapitalize="none"
                        keyboardType="email-address"
                      />
                      <TextInput
                        style={[styles.input, { backgroundColor: colors.cardBorder, color: colors.text }]}
                        value={editUserForm.password}
                        onChangeText={(v) => setEditUserForm(p => ({ ...p, password: v }))}
                        placeholder="New password (leave blank to keep)"
                        placeholderTextColor={colors.textMuted}
                        secureTextEntry
                      />
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {['user', 'moderator', 'admin', 'sponsor'].map(r => (
                          <Pressable
                            key={r}
                            onPress={() => setEditUserForm(p => ({ ...p, role: r }))}
                            style={[styles.concludeBtn, { backgroundColor: editUserForm.role === r ? Colors.primary : colors.cardBorder }]}
                          >
                            <Text style={[styles.concludeBtnText, { color: editUserForm.role === r ? '#000' : colors.text }]}>
                              {r.charAt(0).toUpperCase() + r.slice(1)}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                      <Pressable
                        onPress={() => setEditUserForm(p => ({ ...p, is_admin: !p.is_admin }))}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                      >
                        <Ionicons name={editUserForm.is_admin ? 'checkbox' : 'square-outline'} size={22} color={Colors.primary} />
                        <Text style={{ color: colors.text, fontSize: 14 }}>Admin Access</Text>
                      </Pressable>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Pressable
                          onPress={() => {
                            const updates: any = { userId: user.id };
                            if (editUserForm.username !== (user.username || '')) updates.username = editUserForm.username;
                            if (editUserForm.email !== (user.email || '')) updates.email = editUserForm.email;
                            if (editUserForm.password) updates.password = editUserForm.password;
                            if (editUserForm.role !== (user.role || 'user')) updates.role = editUserForm.role;
                            if (editUserForm.is_admin !== (user.is_admin || false)) updates.is_admin = editUserForm.is_admin;
                            editUserMutation.mutate(updates, {
                              onSuccess: () => {
                                setEditingUser(null);
                                Alert.alert('Success', 'User updated');
                              },
                              onError: (err: any) => Alert.alert('Error', err?.message || 'Failed to update user'),
                            });
                          }}
                          style={[styles.concludeBtn, { backgroundColor: Colors.primary, flex: 1, alignItems: 'center' }]}
                        >
                          <Text style={styles.concludeBtnText}>{editUserMutation.isPending ? 'Saving...' : 'Save Changes'}</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => setEditingUser(null)}
                          style={[styles.concludeBtn, { backgroundColor: colors.cardBorder, flex: 1, alignItems: 'center' }]}
                        >
                          <Text style={[styles.concludeBtnText, { color: colors.text }]}>Cancel</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                      <Pressable
                        onPress={() => {
                          setEditingUser(user);
                          setShowCreateUser(false);
                          setEditUserForm({
                            username: user.username || '',
                            email: user.email || '',
                            password: '',
                            role: user.role || 'user',
                            is_admin: user.is_admin || false,
                          });
                        }}
                        style={[styles.concludeBtn, { backgroundColor: Colors.primary }]}
                      >
                        <Text style={styles.concludeBtnText}>Edit</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          if (adjustingUserId === user.id) {
                            setAdjustingUserId(null);
                          } else {
                            setAdjustingUserId(user.id);
                            setAdjustAmount('');
                            setAdjustReason('');
                          }
                        }}
                        style={[styles.concludeBtn, { backgroundColor: colors.cardBorder }]}
                      >
                        <Text style={[styles.concludeBtnText, { color: colors.text }]}>Adjust Crowns</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => confirmAction(
                          user.is_banned ? 'Unban User' : 'Ban User',
                          `Are you sure you want to ${user.is_banned ? 'unban' : 'ban'} "${user.username}"?`,
                          () => user.is_banned ? unbanUserMutation.mutate(user.id) : banUserMutation.mutate(user.id)
                        )}
                        style={[styles.concludeBtn, { backgroundColor: user.is_banned ? Colors.success : Colors.error }]}
                      >
                        <Text style={styles.concludeBtnText}>{user.is_banned ? 'Unban' : 'Ban'}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => confirmAction(
                          'Toggle Admin',
                          `Are you sure you want to ${user.is_admin ? 'remove admin from' : 'make admin'} "${user.username}"?`,
                          () => toggleAdminMutation.mutate(user.id)
                        )}
                        style={[styles.concludeBtn, { backgroundColor: colors.cardBorder }]}
                      >
                        <Text style={[styles.concludeBtnText, { color: colors.text }]}>{user.is_admin ? 'Remove Admin' : 'Make Admin'}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => confirmAction(
                          'Delete User',
                          `Are you sure you want to permanently delete "${user.username}"? This cannot be undone.`,
                          () => deleteUserMutation.mutate(user.id, {
                            onSuccess: () => Alert.alert('Deleted', 'User has been removed'),
                            onError: (err: any) => Alert.alert('Error', err?.message || 'Failed to delete user'),
                          })
                        )}
                        style={[styles.concludeBtn, { backgroundColor: Colors.error }]}
                      >
                        <Text style={styles.concludeBtnText}>Delete</Text>
                      </Pressable>
                    </View>
                  )}

                  {adjustingUserId === user.id && editingUser?.id !== user.id && (
                    <View style={{ marginTop: 12, gap: 8 }}>
                      <TextInput
                        style={[styles.input, { backgroundColor: colors.cardBorder, color: colors.text }]}
                        value={adjustAmount}
                        onChangeText={setAdjustAmount}
                        placeholder="Amount (positive or negative)"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="numeric"
                      />
                      <TextInput
                        style={[styles.input, { backgroundColor: colors.cardBorder, color: colors.text }]}
                        value={adjustReason}
                        onChangeText={setAdjustReason}
                        placeholder="Reason for adjustment"
                        placeholderTextColor={colors.textMuted}
                      />
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Pressable
                          onPress={() => {
                            const amount = parseInt(adjustAmount, 10);
                            if (isNaN(amount) || !adjustReason.trim()) {
                              Alert.alert('Error', 'Amount and reason are required');
                              return;
                            }
                            adjustCrownsMutation.mutate({ userId: user.id, amount, reason: adjustReason });
                            setAdjustingUserId(null);
                            setAdjustAmount('');
                            setAdjustReason('');
                          }}
                          style={[styles.concludeBtn, { backgroundColor: Colors.primary, flex: 1, alignItems: 'center' }]}
                        >
                          <Text style={styles.concludeBtnText}>
                            {adjustCrownsMutation.isPending ? 'Adjusting...' : 'Submit'}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => { setAdjustingUserId(null); setAdjustAmount(''); setAdjustReason(''); }}
                          style={[styles.concludeBtn, { backgroundColor: colors.cardBorder, flex: 1, alignItems: 'center' }]}
                        >
                          <Text style={[styles.concludeBtnText, { color: colors.text }]}>Cancel</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>
              ))
            )}
          </>
        ) : null}
      </ScrollView>

      <Modal visible={showModal} transparent animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        <View style={[styles.modalOverlay, { paddingTop: Math.max(insets.top, Platform.OS === 'web' ? 67 : 0) }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, paddingBottom: Math.max(insets.bottom, Platform.OS === 'web' ? 34 : 20), flex: 1 }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editMode === 'add' ? 'Add Item' : 'Edit Item'}
              </Text>
              <Pressable onPress={() => setShowModal(false)} hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.formScroll} contentContainerStyle={styles.formScrollContent} showsVerticalScrollIndicator={true} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
              <Text style={[styles.label, { color: colors.textSecondary }]}>Image Asset</Text>
              <View style={styles.imagePickerRow}>
                {formData.image ? (
                  <Image source={{ uri: formData.image }} style={styles.imagePreview} />
                ) : (
                  <View style={[styles.imagePreview, styles.noImagePlaceholder, { backgroundColor: colors.cardBorder }]}>
                    <Ionicons name="image-outline" size={32} color={colors.textMuted} />
                  </View>
                )}
                <View style={styles.imageButtons}>
                  <Pressable onPress={pickImage} disabled={isUploading} style={[styles.imageBtn, { backgroundColor: Colors.primary, opacity: isUploading ? 0.6 : 1 }]}>
                    <Ionicons name={isUploading ? "cloud-upload" : "folder-open"} size={16} color="#000" />
                    <Text style={styles.imageBtnText}>{isUploading ? 'Uploading...' : 'Upload Image'}</Text>
                  </Pressable>
                  {formData.image && (
                    <Pressable
                      onPress={() => setFormData(prev => ({ ...prev, image: '' }))}
                      style={[styles.imageBtn, { backgroundColor: colors.cardBorder }]}
                    >
                      <Ionicons name="trash-outline" size={16} color={Colors.error} />
                      <Text style={[styles.imageBtnText, { color: Colors.error }]}>Remove</Text>
                    </Pressable>
                  )}
                </View>
              </View>
              <TextInput
                style={[styles.input, { backgroundColor: colors.cardBorder, color: colors.text, marginTop: 8 }]}
                value={formData.image}
                onChangeText={text => setFormData(prev => ({ ...prev, image: text }))}
                placeholder="Or paste image URL..."
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
              />

              <Text style={[styles.label, { color: colors.textSecondary }]}>Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.cardBorder, color: colors.text }]}
                value={formData.name}
                onChangeText={text => setFormData(prev => ({ ...prev, name: text }))}
                placeholder="Item name"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={[styles.label, { color: colors.textSecondary }]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
                {categoryNames.map((cat: string) => (
                  <Pressable
                    key={cat}
                    onPress={() => setFormData(prev => ({ ...prev, category: cat }))}
                    style={[
                      styles.pickerItem,
                      { backgroundColor: formData.category === cat ? Colors.primary : colors.cardBorder },
                    ]}
                  >
                    <Text style={{ color: formData.category === cat ? '#000' : colors.text, fontSize: 12 }}>
                      {cat}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Text style={[styles.label, { color: colors.textSecondary }]}>Price (Crowns)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.cardBorder, color: colors.text }]}
                value={formData.price}
                onChangeText={text => setFormData(prev => ({ ...prev, price: text }))}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={[styles.label, { color: colors.textSecondary }]}>Rarity</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
                {RARITIES.map(r => (
                  <Pressable
                    key={r}
                    onPress={() => setFormData(prev => ({ ...prev, rarity: r }))}
                    style={[
                      styles.pickerItem,
                      { backgroundColor: formData.rarity === r ? Colors.primary : colors.cardBorder },
                    ]}
                  >
                    <Text style={{ color: formData.rarity === r ? '#000' : colors.text, fontSize: 12 }}>
                      {r}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Text style={[styles.label, { color: colors.textSecondary }]}>Unlock Condition</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
                {UNLOCK_TYPES.map(t => (
                  <Pressable
                    key={t}
                    onPress={() => setFormData(prev => ({ ...prev, unlockType: t }))}
                    style={[
                      styles.pickerItem,
                      { backgroundColor: formData.unlockType === t ? Colors.primary : colors.cardBorder },
                    ]}
                  >
                    <Text style={{ color: formData.unlockType === t ? '#000' : colors.text, fontSize: 12 }}>
                      {t.replace('_', ' ')}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {formData.unlockType === 'crowns' && (
                <>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>
                    Crowns Required
                  </Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.cardBorder, color: colors.text }]}
                    value={formData.unlockValue}
                    onChangeText={text => setFormData(prev => ({ ...prev, unlockValue: text }))}
                    keyboardType="numeric"
                    placeholder="Enter value"
                    placeholderTextColor={colors.textMuted}
                  />
                </>
              )}

              {formData.unlockType === 'contest_entry' && (
                <>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Select Contest</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
                    {(contestsData || []).map((contest: any) => (
                      <Pressable
                        key={contest.id}
                        onPress={() => setFormData(prev => ({ ...prev, unlockContestId: contest.id }))}
                        style={[
                          styles.contestPicker,
                          { backgroundColor: formData.unlockContestId === contest.id ? Colors.primary : colors.cardBorder },
                        ]}
                      >
                        <Text style={{ color: formData.unlockContestId === contest.id ? '#000' : colors.text, fontSize: 11 }}>
                          {contest.title}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </>
              )}

              {formData.unlockType === 'elo_placement' && (
                <>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>ELO Rank (Top N)</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.cardBorder, color: colors.text }]}
                    value={formData.unlockEloRank}
                    onChangeText={text => setFormData(prev => ({ ...prev, unlockEloRank: text }))}
                    keyboardType="numeric"
                    placeholder="e.g. 10 (top 10)"
                    placeholderTextColor={colors.textMuted}
                  />
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Contest (optional)</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
                    <Pressable
                      onPress={() => setFormData(prev => ({ ...prev, unlockContestId: '' }))}
                      style={[styles.contestPicker, { backgroundColor: !formData.unlockContestId ? Colors.primary : colors.cardBorder }]}
                    >
                      <Text style={{ color: !formData.unlockContestId ? '#000' : colors.text, fontSize: 11 }}>Any</Text>
                    </Pressable>
                    {(contestsData || []).map((contest: any) => (
                      <Pressable
                        key={contest.id}
                        onPress={() => setFormData(prev => ({ ...prev, unlockContestId: contest.id }))}
                        style={[styles.contestPicker, { backgroundColor: formData.unlockContestId === contest.id ? Colors.primary : colors.cardBorder }]}
                      >
                        <Text style={{ color: formData.unlockContestId === contest.id ? '#000' : colors.text, fontSize: 11 }}>{contest.title}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Season (optional)</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.cardBorder, color: colors.text }]}
                    value={formData.unlockSeasonId}
                    onChangeText={text => setFormData(prev => ({ ...prev, unlockSeasonId: text }))}
                    placeholder="Season ID"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                  />
                </>
              )}

              {formData.unlockType === 'giveaway_win' && (
                <>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Select Giveaway</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
                    {(giveawaysV2Data || []).map((gw: any) => (
                      <Pressable
                        key={gw.id}
                        onPress={() => setFormData(prev => ({ ...prev, unlockGiveawayId: gw.id }))}
                        style={[styles.contestPicker, { backgroundColor: formData.unlockGiveawayId === gw.id ? Colors.primary : colors.cardBorder }]}
                      >
                        <Text style={{ color: formData.unlockGiveawayId === gw.id ? '#000' : colors.text, fontSize: 11 }}>{gw.title}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </>
              )}

              {formData.unlockType === 'referral_count' && (
                <>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Referrals Required</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.cardBorder, color: colors.text }]}
                    value={formData.unlockValue}
                    onChangeText={text => setFormData(prev => ({ ...prev, unlockValue: text }))}
                    keyboardType="numeric"
                    placeholder="e.g. 5"
                    placeholderTextColor={colors.textMuted}
                  />
                </>
              )}

              {activeTab === 'room' && (
                <>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Dimensions</Text>
                  <View style={styles.dimensionRow}>
                    <View style={styles.dimensionField}>
                      <Text style={[styles.dimensionLabel, { color: colors.textMuted }]}>Width (X)</Text>
                      <TextInput
                        style={[styles.dimensionInput, { backgroundColor: colors.cardBorder, color: colors.text }]}
                        value={formData.width}
                        onChangeText={text => setFormData(prev => ({ ...prev, width: text.replace(/[^0-9]/g, '') }))}
                        onBlur={() => setFormData(prev => ({ ...prev, width: clampDimension(prev.width) }))}
                        keyboardType="number-pad"
                        placeholder="1"
                        placeholderTextColor={colors.textMuted}
                        maxLength={2}
                      />
                    </View>
                    <View style={styles.dimensionField}>
                      <Text style={[styles.dimensionLabel, { color: colors.textMuted }]}>Depth (Y)</Text>
                      <TextInput
                        style={[styles.dimensionInput, { backgroundColor: colors.cardBorder, color: colors.text }]}
                        value={formData.depth}
                        onChangeText={text => setFormData(prev => ({ ...prev, depth: text.replace(/[^0-9]/g, '') }))}
                        onBlur={() => setFormData(prev => ({ ...prev, depth: clampDimension(prev.depth) }))}
                        keyboardType="number-pad"
                        placeholder="1"
                        placeholderTextColor={colors.textMuted}
                        maxLength={2}
                      />
                    </View>
                    <View style={styles.dimensionField}>
                      <Text style={[styles.dimensionLabel, { color: colors.textMuted }]}>Height (Z) 0-12</Text>
                      <TextInput
                        style={[styles.dimensionInput, { backgroundColor: colors.cardBorder, color: colors.text }]}
                        value={formData.zHeight}
                        onChangeText={text => setFormData(prev => ({ ...prev, zHeight: text.replace(/[^0-9]/g, '') }))}
                        onBlur={() => setFormData(prev => ({ ...prev, zHeight: clampDimension(prev.zHeight, true) }))}
                        keyboardType="number-pad"
                        placeholder="1"
                        placeholderTextColor={colors.textMuted}
                        maxLength={2}
                      />
                    </View>
                  </View>
                  <Text style={[styles.dimensionHint, { color: colors.textMuted }]}>
                    3D Bounding Box: {formData.width} x {formData.depth} x {formData.zHeight} (WxDxH)
                  </Text>

                  <Text style={[styles.label, { color: colors.textSecondary }]}>Placement Surface</Text>
                  <View style={styles.surfaceRow}>
                    {PLACEMENT_SURFACES.map(surface => (
                      <Pressable
                        key={surface}
                        onPress={() => setFormData(prev => ({ ...prev, placementSurface: surface }))}
                        style={[
                          styles.surfaceBtn,
                          { backgroundColor: formData.placementSurface === surface ? Colors.primary : colors.cardBorder },
                        ]}
                      >
                        <Ionicons
                          name={surface === 'floor' ? 'grid-outline' : surface === 'wall' ? 'tablet-landscape-outline' : 'layers-outline'}
                          size={16}
                          color={formData.placementSurface === surface ? '#000' : colors.text}
                        />
                        <Text style={{ color: formData.placementSurface === surface ? '#000' : colors.text, fontSize: 12, fontFamily: 'Inter_500Medium', marginLeft: 6, textTransform: 'capitalize' }}>
                          {surface}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Pressable
                    onPress={() => setFormData(prev => ({ ...prev, isStackable: !prev.isStackable }))}
                    style={[styles.stackableRow, { backgroundColor: colors.cardBorder }]}
                  >
                    <View style={styles.stackableInfo}>
                      <Ionicons name="layers" size={18} color={formData.isStackable ? Colors.primary : colors.textMuted} />
                      <View style={styles.stackableText}>
                        <Text style={[styles.stackableLabel, { color: colors.text }]}>Allow Stacking</Text>
                        <Text style={[styles.stackableHint, { color: colors.textMuted }]}>Other items can be placed on top</Text>
                      </View>
                    </View>
                    <View style={[styles.toggleTrack, { backgroundColor: formData.isStackable ? Colors.primary : colors.background }]}>
                      <View style={[styles.toggleThumb, { transform: [{ translateX: formData.isStackable ? 16 : 0 }] }]} />
                    </View>
                  </Pressable>

                  {formData.category === 'wall' && (
                    <View>
                      <Text style={[styles.label, { color: colors.textSecondary }]}>Wall Side</Text>
                      <View style={styles.rarityRow}>
                        {(['', 'left', 'right'] as const).map(side => (
                          <Pressable
                            key={side || 'none'}
                            onPress={() => setFormData(prev => ({ ...prev, wallSide: side }))}
                            style={[
                              styles.rarityOption,
                              {
                                backgroundColor: formData.wallSide === side ? Colors.primary + '20' : colors.cardBorder,
                                borderColor: formData.wallSide === side ? Colors.primary : colors.cardBorder,
                                borderWidth: 1,
                              },
                            ]}
                          >
                            <Ionicons
                              name={side === 'left' ? 'arrow-back' : side === 'right' ? 'arrow-forward' : 'remove-circle-outline'}
                              size={14}
                              color={formData.wallSide === side ? Colors.primary : colors.textMuted}
                            />
                            <Text style={[styles.rarityLabel, { color: formData.wallSide === side ? Colors.primary : colors.text }]}>
                              {side === '' ? 'None' : side === 'left' ? 'Left' : 'Right'}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  )}

                  <Text style={[styles.label, { color: colors.textSecondary }]}>URL (optional)</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.cardBorder, color: colors.text }]}
                    value={formData.url}
                    onChangeText={text => setFormData(prev => ({ ...prev, url: text }))}
                    placeholder="https://..."
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                  />
                </>
              )}

              <Pressable onPress={handleSave} style={[styles.saveButton, { backgroundColor: Colors.primary }]}>
                <Text style={styles.saveButtonText}>Save Item</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

function BracketAdminTab({ colors }: { colors: any }) {
  const [bracketContests, setBracketContests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingContest, setEditingContest] = useState<any>(null);
  const [selectedContest, setSelectedContest] = useState<any>(null);
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [form, setForm] = useState({
    title: '',
    season: 'March Madness',
    year: new Date().getFullYear().toString(),
    prize_pool_crowns: '500',
    lock_time: '',
  });

  const fetchBrackets = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const apiUrl = getApiUrl().replace(/\/$/, '');
      const res = await fetch(`${apiUrl}/api/bracket-contests`, { headers: { Authorization: `Bearer ${session?.access_token}` } });
      const data = await res.json();
      setBracketContests(data || []);
    } catch (e) { console.error('[BracketAdmin] fetchBrackets error:', e); }
    setLoading(false);
  };

  useEffect(() => { fetchBrackets(); }, []);

  const handleSelectContest = async (bc: any) => {
    setSelectedContest(bc);
    setSimResult(null);
    setLoadingEntries(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const apiUrl = getApiUrl().replace(/\/$/, '');
      const res = await fetch(`${apiUrl}/api/bracket-contests/${bc.id}/standings`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json();
      setEntries(data || []);
    } catch (e) { console.error('[BracketAdmin] fetch entries error:', e); }
    setLoadingEntries(false);
  };

  const handleSimulateAll = async (contestId: string) => {
    setSimulating(true);
    setSimResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const apiUrl = getApiUrl().replace(/\/$/, '');
      const res = await fetch(`${apiUrl}/api/bracket-contests/${contestId}/simulate-all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const result = await res.json();
      if (res.ok) {
        setSimResult(result);
        const updatedContest = { ...selectedContest, status: 'concluded' };
        setSelectedContest(updatedContest);
        await handleSelectContest(updatedContest);
        fetchBrackets();
      } else {
        Alert.alert('Error', result.error || 'Failed to simulate');
      }
    } catch (e: any) { Alert.alert('Error', e.message); }
    setSimulating(false);
  };

  const [creating, setCreating] = useState(false);
  const handleSave = async () => {
    const isNew = !editingContest;
    if (isNew) setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const apiUrl = getApiUrl().replace(/\/$/, '');
      const method = editingContest ? 'PUT' : 'POST';
      const endpoint = editingContest 
        ? `${apiUrl}/api/admin/bracket-contests/${editingContest.id}`
        : `${apiUrl}/api/admin/bracket-contests`;
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          title: form.title,
          season: form.season,
          year: parseInt(form.year),
          prize_pool_crowns: parseInt(form.prize_pool_crowns) || 0,
          lock_time: form.lock_time || null,
        }),
      });
      if (res.ok) {
        if (isNew) {
          const created = await res.json();
          const contestId = created.id;
          const mockRes = await fetch(`${apiUrl}/api/admin/bracket-contests/${contestId}/setup-mock`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${session?.access_token}` },
          });
          const mockResult = await mockRes.json();
          setShowForm(false);
          setEditingContest(null);
          fetchBrackets();
          if (mockRes.ok) {
            if (Platform.OS === 'web') {
              router.push(`/bracket/${contestId}`);
            } else {
              Alert.alert('Bracket Created!', 'Your March Madness bracket is ready.', [
                { text: 'View Bracket', onPress: () => router.push(`/bracket/${contestId}`) },
              ]);
            }
          } else {
            Alert.alert('Partial Success', `Contest created but mock setup failed: ${mockResult.error || 'Unknown error'}. You can try Setup Mock manually.`);
          }
        } else {
          Alert.alert('Success', 'Bracket contest updated');
          setShowForm(false);
          setEditingContest(null);
          fetchBrackets();
        }
      } else {
        const errBody = await res.json();
        Alert.alert('Error', errBody.error || 'Failed to save');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setCreating(false);
  };

  const handleSetupMock = async (contestId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const apiUrl = getApiUrl().replace(/\/$/, '');
      const res = await fetch(`${apiUrl}/api/admin/bracket-contests/${contestId}/setup-mock`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const result = await res.json();
      if (res.ok) {
        Alert.alert('Success', `Mock bracket created!\n${result.teams_created} teams, ${result.games_created} R1 games, ${result.rounds_created} rounds`);
        fetchBrackets();
      } else {
        Alert.alert('Error', result.error || 'Failed to set up mock bracket');
      }
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const handleStatusChange = async (contestId: string, status: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const apiUrl = getApiUrl().replace(/\/$/, '');
      const res = await fetch(`${apiUrl}/api/admin/bracket-contests/${contestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        Alert.alert('Success', `Status changed to ${status}`);
        fetchBrackets();
      } else {
        const err = await res.json();
        Alert.alert('Error', err.error || 'Failed to update status');
      }
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const handleGradeRound = async (contestId: string, roundNumber: number) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const apiUrl = getApiUrl().replace(/\/$/, '');
      const res = await fetch(`${apiUrl}/api/admin/bracket-contests/${contestId}/grade/${roundNumber}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.ok) {
        const result = await res.json();
        Alert.alert('Success', `Round ${roundNumber} graded. ${result.graded || 0} picks graded.`);
      } else {
        const err = await res.json();
        Alert.alert('Error', err.error || 'Failed to grade round');
      }
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const [deleting, setDeleting] = useState<string | null>(null);
  const handleDelete = async (contestId: string, title: string) => {
    const doDelete = async () => {
      setDeleting(contestId);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const apiUrl = getApiUrl().replace(/\/$/, '');
        const res = await fetch(`${apiUrl}/api/admin/bracket-contests/${contestId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
        if (res.ok) {
          fetchBrackets();
        } else {
          const err = await res.json();
          Alert.alert('Error', err.error || 'Failed to delete bracket');
        }
      } catch (e: any) { Alert.alert('Error', e.message); }
      setDeleting(null);
    };

    if (Platform.OS === 'web') {
      if (confirm(`Delete "${title}"? This will remove all teams, games, entries, and picks. This cannot be undone.`)) {
        doDelete();
      }
    } else {
      Alert.alert('Delete Bracket', `Delete "${title}"? This will remove all teams, games, entries, and picks. This cannot be undone.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const [tablesExist, setTablesExist] = useState(true);
  const [settingUp, setSettingUp] = useState(false);

  useEffect(() => {
    if (Array.isArray(bracketContests)) setTablesExist(true);
    else if (bracketContests && (bracketContests as any).error) setTablesExist(false);
  }, [bracketContests]);

  const handleSetupTables = async () => {
    setSettingUp(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const apiUrl = getApiUrl().replace(/\/$/, '');
      const res = await fetch(`${apiUrl}/api/admin/bracket-setup-tables`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const result = await res.json();
      if (res.ok) {
        Alert.alert('Success', 'Bracket tables created! Refreshing...');
        setTablesExist(true);
        setTimeout(() => fetchBrackets(), 2000);
      } else {
        Alert.alert('Error', result.error || 'Failed to create tables');
      }
    } catch (e: any) { Alert.alert('Error', e.message); }
    setSettingUp(false);
  };

  if (loading) return <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />;

  return (
    <>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text style={{ color: colors.text, fontSize: 18, fontFamily: 'Inter_700Bold' }}>Bracket Challenges</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {!tablesExist && (
            <Pressable
              onPress={handleSetupTables}
              disabled={settingUp}
              style={{ backgroundColor: Colors.warning, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, opacity: settingUp ? 0.5 : 1 }}
            >
              <Text style={{ color: '#000', fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>{settingUp ? 'Setting up...' : 'Setup Tables'}</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => {
              setEditingContest(null);
              setForm({ title: '', season: 'March Madness', year: new Date().getFullYear().toString(), prize_pool_crowns: '500', lock_time: '' });
              setShowForm(true);
            }}
            style={{ backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }}
          >
            <Text style={{ color: '#000', fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>+ New Bracket</Text>
          </Pressable>
        </View>
      </View>

      {showForm && (
        <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.cardBorder }}>
          <Text style={{ color: colors.text, fontSize: 14, fontFamily: 'Inter_600SemiBold', marginBottom: 8 }}>
            {editingContest ? 'Edit Bracket Contest' : 'New Bracket Contest'}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 4 }}>Title</Text>
          <TextInput
            style={{ backgroundColor: colors.cardBorder, color: colors.text, borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 14 }}
            value={form.title}
            onChangeText={t => setForm(f => ({ ...f, title: t }))}
            placeholder="2025 March Madness Bracket"
            placeholderTextColor={colors.textMuted}
          />
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 4 }}>Season</Text>
              <TextInput
                style={{ backgroundColor: colors.cardBorder, color: colors.text, borderRadius: 8, padding: 10, fontSize: 14 }}
                value={form.season}
                onChangeText={t => setForm(f => ({ ...f, season: t }))}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 4 }}>Year</Text>
              <TextInput
                style={{ backgroundColor: colors.cardBorder, color: colors.text, borderRadius: 8, padding: 10, fontSize: 14 }}
                value={form.year}
                onChangeText={t => setForm(f => ({ ...f, year: t }))}
                keyboardType="numeric"
              />
            </View>
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 4 }}>Prize Pool (Crowns)</Text>
          <TextInput
            style={{ backgroundColor: colors.cardBorder, color: colors.text, borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 14 }}
            value={form.prize_pool_crowns}
            onChangeText={t => setForm(f => ({ ...f, prize_pool_crowns: t }))}
            keyboardType="numeric"
          />
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 4 }}>Lock Time</Text>
          <View style={{ marginBottom: 12 }}>
            <DatePickerField
              value={form.lock_time}
              onChange={(dateStr) => setForm(f => ({ ...f, lock_time: dateStr }))}
              placeholder="Select lock date & time"
              format="datetime"
              backgroundColor={colors.cardBorder}
              textColor={colors.text}
              placeholderColor={colors.textMuted}
              fontSize={14}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              onPress={() => { setShowForm(false); setEditingContest(null); }}
              style={{ flex: 1, backgroundColor: colors.cardBorder, paddingVertical: 10, borderRadius: 8, alignItems: 'center' }}
            >
              <Text style={{ color: colors.text, fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={creating}
              style={{ flex: 1, backgroundColor: creating ? '#666' : Colors.primary, paddingVertical: 10, borderRadius: 8, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
            >
              {creating && <ActivityIndicator size="small" color="#000" />}
              <Text style={{ color: '#000', fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>{creating ? 'Creating Bracket...' : editingContest ? 'Update' : 'Create'}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {bracketContests.length === 0 && !showForm && (
        <View style={{ alignItems: 'center', paddingVertical: 40 }}>
          <Ionicons name="basketball-outline" size={40} color={colors.textMuted} />
          <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 8 }}>No bracket contests yet</Text>
        </View>
      )}

      {selectedContest ? (
        <View>
          <Pressable onPress={() => { setSelectedContest(null); setSimResult(null); setEntries([]); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 }}>
            <Ionicons name="arrow-back" size={20} color={Colors.primary} />
            <Text style={{ color: Colors.primary, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>Back to all brackets</Text>
          </Pressable>

          <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.cardBorder }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 20, fontFamily: 'Inter_700Bold' }}>{selectedContest.title}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>{selectedContest.season} {selectedContest.year} | {selectedContest.prize_pool_crowns} Crowns</Text>
              </View>
              <View style={{ backgroundColor: selectedContest.status === 'open' ? Colors.success + '30' : selectedContest.status === 'active' ? Colors.primary + '30' : Colors.warning + '30', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
                <Text style={{ color: selectedContest.status === 'open' ? Colors.success : selectedContest.status === 'active' ? Colors.primary : Colors.warning, fontSize: 12, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' }}>{selectedContest.status}</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              <Pressable
                onPress={() => {
                  setEditingContest(selectedContest);
                  setForm({
                    title: selectedContest.title,
                    season: selectedContest.season || '',
                    year: String(selectedContest.year || ''),
                    prize_pool_crowns: String(selectedContest.prize_pool_crowns || 0),
                    lock_time: selectedContest.lock_time || '',
                  });
                  setShowForm(true);
                }}
                style={{ backgroundColor: Colors.primary + '20', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}
              >
                <Text style={{ color: Colors.primary, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>Edit</Text>
              </Pressable>
              {selectedContest.status === 'draft' && (
                <Pressable onPress={() => handleStatusChange(selectedContest.id, 'open')} style={{ backgroundColor: Colors.success + '20', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}>
                  <Text style={{ color: Colors.success, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>Open</Text>
                </Pressable>
              )}
              {selectedContest.status === 'open' && (
                <Pressable onPress={() => handleStatusChange(selectedContest.id, 'active')} style={{ backgroundColor: Colors.primary + '20', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}>
                  <Text style={{ color: Colors.primary, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>Lock Entries</Text>
                </Pressable>
              )}
              {selectedContest.status === 'active' && (
                <Pressable onPress={() => handleStatusChange(selectedContest.id, 'concluded')} style={{ backgroundColor: Colors.error + '20', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}>
                  <Text style={{ color: Colors.error, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>Conclude</Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => handleDelete(selectedContest.id, selectedContest.title)}
                disabled={deleting === selectedContest.id}
                style={{ backgroundColor: Colors.error + '20', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, opacity: deleting === selectedContest.id ? 0.5 : 1 }}
              >
                <Text style={{ color: Colors.error, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>{deleting === selectedContest.id ? 'Deleting...' : 'Delete'}</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={() => handleSimulateAll(selectedContest.id)}
              disabled={simulating}
              style={({ pressed }) => ({
                backgroundColor: simulating ? '#666' : '#7C3AED',
                paddingVertical: 14,
                borderRadius: 10,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 8,
                opacity: pressed ? 0.9 : 1,
              })}
            >
              {simulating ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Ionicons name="flash" size={18} color="#FFF" />
              )}
              <Text style={{ color: '#FFF', fontSize: 15, fontFamily: 'Inter_700Bold' }}>
                {simulating ? 'Simulating All Games...' : 'Simulate All Games & Grade Brackets'}
              </Text>
            </Pressable>

            {simResult && (
              <View style={{ backgroundColor: Colors.success + '15', borderRadius: 10, padding: 14, marginTop: 12, borderWidth: 1, borderColor: Colors.success + '30' }}>
                <Text style={{ color: Colors.success, fontSize: 14, fontFamily: 'Inter_700Bold', marginBottom: 8 }}>Simulation Complete</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ color: colors.text, fontSize: 20, fontFamily: 'Inter_700Bold' }}>{simResult.rounds_simulated}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>Rounds</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ color: colors.text, fontSize: 20, fontFamily: 'Inter_700Bold' }}>{simResult.total_games}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>Games</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ color: colors.text, fontSize: 20, fontFamily: 'Inter_700Bold' }}>{simResult.picks_graded}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>Picks Graded</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ color: colors.text, fontSize: 20, fontFamily: 'Inter_700Bold' }}>{simResult.entries_scored}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>Entries Scored</Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          <Text style={{ color: colors.text, fontSize: 16, fontFamily: 'Inter_700Bold', marginBottom: 12 }}>
            Submitted Brackets ({entries.length})
          </Text>

          {loadingEntries ? (
            <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 20 }} />
          ) : entries.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 30 }}>
              <Ionicons name="people-outline" size={36} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 8 }}>No entries yet</Text>
            </View>
          ) : (
            entries.map((entry: any, idx: number) => (
              <View key={entry.entry_id || idx} style={{ backgroundColor: colors.card, borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.cardBorder, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: idx === 0 ? '#FFD700' : idx === 1 ? '#C0C0C0' : idx === 2 ? '#CD7F32' : colors.cardBorder, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: idx < 3 ? '#000' : colors.text, fontSize: 12, fontFamily: 'Inter_700Bold' }}>{idx + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 14, fontFamily: 'Inter_600SemiBold' }} numberOfLines={1}>{entry.username || 'Unknown'}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>Rank #{entry.rank || idx + 1}</Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: Colors.primary, fontSize: 18, fontFamily: 'Inter_700Bold' }}>{entry.total_score || 0}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>points</Text>
                </View>
              </View>
            ))
          )}
        </View>
      ) : (
        <>
          {bracketContests.map((bc: any) => (
            <Pressable key={bc.id} onPress={() => handleSelectContest(bc)} style={({ pressed }) => ({ opacity: pressed ? 0.95 : 1 })}>
              <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.cardBorder }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 16, fontFamily: 'Inter_700Bold' }}>{bc.title}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{bc.season} {bc.year} | {bc.prize_pool_crowns} Crowns</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ backgroundColor: bc.status === 'open' ? Colors.success + '30' : bc.status === 'active' ? Colors.primary + '30' : Colors.warning + '30', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                      <Text style={{ color: bc.status === 'open' ? Colors.success : bc.status === 'active' ? Colors.primary : Colors.warning, fontSize: 11, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' }}>{bc.status}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </View>
                </View>
                <Text style={{ color: colors.textMuted, fontSize: 11 }}>Tap to manage & simulate</Text>
              </View>
            </Pressable>
          ))}

          <Pressable
            onPress={() => handleDelete(bracketContests[0]?.id, bracketContests[0]?.title)}
            disabled={!bracketContests.length || deleting === bracketContests[0]?.id}
            style={{ display: 'none' }}
          >
            <Text>hidden</Text>
          </Pressable>
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
  },
  addButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: {
    marginBottom: 16,
    maxHeight: 48,
  },
  tabsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
  },
  itemCard: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 4,
  },
  itemMeta: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginBottom: 2,
  },
  itemUnlock: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  itemUrl: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  itemActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  actionIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  lockedText: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 16,
    marginBottom: 24,
  },
  enableButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  enableButtonText: {
    color: '#000',
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
  },
  formScroll: {
    flex: 1,
  },
  formScrollContent: {
    padding: 20,
    paddingBottom: 60,
  },
  label: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  pickerRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  pickerItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  contestPicker: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 8,
    maxWidth: 150,
  },
  saveButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 40,
  },
  saveButtonText: {
    color: '#000',
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  itemThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 12,
  },
  noImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCategoryRow: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    gap: 10,
  },
  categoryInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  addCategoryBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editCategoryRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryEditInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  imagePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  imagePreview: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  imageButtons: {
    flex: 1,
    gap: 8,
  },
  imageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  imageBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#000',
  },
  dimensionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  dimensionField: {
    flex: 1,
  },
  dimensionLabel: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    marginBottom: 4,
  },
  dimensionInput: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
  dimensionHint: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    marginBottom: 16,
  },
  surfaceRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  surfaceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  stackableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  stackableInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stackableText: {
    gap: 2,
  },
  stackableLabel: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  stackableHint: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  toggleTrack: {
    width: 40,
    height: 24,
    borderRadius: 12,
    padding: 2,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  rarityRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  rarityOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  rarityLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  configCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  configRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  configLabel: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    flex: 1,
  },
  configInput: {
    width: 80,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
  configSection: {
    marginBottom: 20,
  },
  configSectionTitle: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  contestCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  concludeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  concludeBtnText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#000',
  },
  giveawayCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  giveawayMonth: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    marginBottom: 8,
  },
  giveawayStatus: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    marginBottom: 16,
  },
  giveawayActions: {
    flexDirection: 'row',
    gap: 12,
  },
  giveawayBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  giveawayBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#000',
  },
  winnersInput: {
    width: 60,
    textAlign: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    marginRight: 12,
  },
  chipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  rsPresetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
  },
  rsPresetTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 2,
  },
  rsPresetDesc: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  rsScopeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  rsScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
  },
  rsFieldLabel: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  rsStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rsStepperBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rsStepperInput: {
    width: 48,
    textAlign: 'center' as const,
    paddingHorizontal: 4,
    paddingVertical: 6,
    borderRadius: 8,
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  rsPlacementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  rsPlacementLabel: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    minWidth: 70,
  },
  rsAddPlacementBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed' as const,
    marginTop: 4,
  },
  rsPreviewCard: {
    padding: 14,
    borderRadius: 10,
    gap: 4,
  },
  rsPreviewLine: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  rsListCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rsListName: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  rsStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  inputField: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    borderWidth: 1,
    marginBottom: 4,
  },
});
