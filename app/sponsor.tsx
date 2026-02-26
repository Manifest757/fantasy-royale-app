import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  ActivityIndicator,
  TextInput,
  Alert,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useGamification } from '@/contexts/GamificationContext';
import { Colors } from '@/constants/colors';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import {
  useSponsorProfile,
  useUpdateSponsorProfile,
  useSponsorCampaigns,
  useCreateCampaign,
  useDeleteCampaign,
  useSubmitCampaign,
  useSponsorAnalytics,
  useAdminSponsors,
  useAdminSponsorPortal,
} from '@/lib/gamification-api';

type ViewState = 'dashboard' | 'tiers' | 'wizard' | 'sales' | 'success' | 'manage' | 'templates' | 'print-order' | 'analytics' | 'marketing' | 'settings';

const BRAND_COLORS = ['#00D4AA', '#3B82F6', '#8B5CF6', '#F97316', '#EC4899', '#22C55E', '#EF4444', '#EAB308'];
const SCREEN_WIDTH = Dimensions.get('window').width;

export default function SponsorPortal() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { isAdmin } = useGamification();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ sponsorId?: string }>();

  const webTopPadding = Platform.OS === 'web' ? 67 : 0;
  const topPadding = insets.top || webTopPadding;
  const webBottomPadding = Platform.OS === 'web' ? 34 : 0;
  const bottomPadding = insets.bottom || webBottomPadding;

  const [view, setView] = useState<ViewState>('dashboard');
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [adminSelectedSponsorId, setAdminSelectedSponsorId] = useState<string | null>(params.sponsorId || null);

  const [wizardStep, setWizardStep] = useState(1);
  const [selectedTier, setSelectedTier] = useState('');
  const [contestType, setContestType] = useState('');
  const [duration, setDuration] = useState('');
  const [audienceSize, setAudienceSize] = useState(50);
  const [prizes, setPrizes] = useState(0);
  const [boosts, setBoosts] = useState<string[]>([]);
  const [contestName, setContestName] = useState('');
  const [brandName, setBrandName] = useState('');

  const [salesName, setSalesName] = useState('');
  const [salesEmail, setSalesEmail] = useState('');
  const [salesPhone, setSalesPhone] = useState('');
  const [salesCompany, setSalesCompany] = useState('');
  const [salesGoals, setSalesGoals] = useState('');

  const [manageContestId, setManageContestId] = useState('');
  const [manageContestName, setManageContestName] = useState('Super Bowl Challenge');
  const [managePrizePool, setManagePrizePool] = useState('$500');
  const [manageStartDate, setManageStartDate] = useState('2026-02-01');
  const [manageEndDate, setManageEndDate] = useState('2026-02-15');
  const [manageMaxEntries, setManageMaxEntries] = useState('500');
  const [manageStatus, setManageStatus] = useState<'Active' | 'Paused' | 'Ended'>('Active');

  const [printStep, setPrintStep] = useState(1);
  const [printQuantities, setPrintQuantities] = useState([0, 0, 0, 0, 0]);
  const [printLocations, setPrintLocations] = useState([{ name: '', address: '' }]);

  const [templateFilter, setTemplateFilter] = useState('All Templates');
  const [marketingFilter, setMarketingFilter] = useState('All Assets');

  const [settingsCompany, setSettingsCompany] = useState('');
  const [settingsBusinessType, setSettingsBusinessType] = useState('Restaurant/Bar');
  const [settingsCity, setSettingsCity] = useState('');
  const [settingsState, setSettingsState] = useState('');
  const [settingsBrandColor, setSettingsBrandColor] = useState('#00D4AA');
  const [settingsNotifications, setSettingsNotifications] = useState([true, true, false, true]);
  const [businessTypeOpen, setBusinessTypeOpen] = useState(false);

  const adminSponsorsQuery = useAdminSponsors(!!isAdmin);
  const adminPortalQuery = useAdminSponsorPortal(isAdmin ? adminSelectedSponsorId : null);
  const isAdminViewing = isAdmin && adminSelectedSponsorId;

  const profileQuery = useSponsorProfile();
  const hasSponsorProfile = !!profileQuery.data && !profileQuery.isError;
  const campaignsQuery = useSponsorCampaigns(hasSponsorProfile);
  const analyticsQuery = useSponsorAnalytics(hasSponsorProfile);
  const updateProfileMutation = useUpdateSponsorProfile();
  const createCampaignMutation = useCreateCampaign();
  const deleteCampaignMutation = useDeleteCampaign();
  const submitCampaignMutation = useSubmitCampaign();

  const profile = isAdminViewing ? adminPortalQuery.data?.profile : profileQuery.data;
  const isApproved = profile?.status === 'approved';
  const isPending = profile?.status === 'pending';
  const isSuspended = profile?.status === 'suspended';
  const isNotSponsor = !isAdmin && (profileQuery.isError || (!profileQuery.isLoading && !profile));

  const resetWizard = () => {
    setWizardStep(1);
    setSelectedTier('');
    setContestType('');
    setDuration('');
    setAudienceSize(50);
    setPrizes(0);
    setBoosts([]);
    setContestName('');
    setBrandName('');
  };

  const tierBasePrice = (): number => {
    if (selectedTier === 'local') return 750;
    if (selectedTier === 'office') return 99;
    return 0;
  };

  const durationMultiplier = (): number => {
    if (duration === 'single') return 1;
    if (duration === 'weekly') return 1.5;
    if (duration === 'monthly') return 2;
    if (duration === 'season') return 3.5;
    return 1;
  };

  const audienceCost = (): number => {
    if (selectedTier === 'free') return 0;
    if (audienceSize > 100) return Math.floor((audienceSize - 100) * 0.5);
    return 0;
  };

  const boostsCost = (): number => {
    let total = 0;
    if (boosts.includes('bonus')) total += 50;
    if (boosts.includes('double')) total += 100;
    if (boosts.includes('featured')) total += 250;
    return total;
  };

  const totalPrice = (): number => {
    if (selectedTier === 'free') return 0;
    return Math.round(tierBasePrice() * durationMultiplier()) + audienceCost() + prizes + boostsCost();
  };

  const carouselSlides = [
    { title: 'Nike Super Bowl', subtitle: 'Championship Challenge', gradient: ['#FF6B35', '#FF3D00'] as [string, string] },
    { title: 'Buffalo Wild Wings', subtitle: 'March Madness Bracket', gradient: ['#FFB300', '#FF8F00'] as [string, string] },
    { title: 'Launch Your Contest', subtitle: 'Reach thousands of fans', gradient: [Colors.primary, '#3B82F6'] as [string, string] },
    { title: 'Boost Your Brand', subtitle: 'Premium sponsorship tools', gradient: ['#8B5CF6', '#EC4899'] as [string, string] },
  ];

  const weeklyEngagement = [
    { day: 'Mon', value: 340 },
    { day: 'Tue', value: 520 },
    { day: 'Wed', value: 410 },
    { day: 'Thu', value: 680 },
    { day: 'Fri', value: 590 },
    { day: 'Sat', value: 320 },
    { day: 'Sun', value: 450 },
  ];
  const maxEngagement = Math.max(...weeklyEngagement.map(w => w.value));

  const mockContests = [
    { id: '1', name: 'Super Bowl Challenge', sport: 'Football', entries: 342, maxEntries: 500, status: 'Active' as const },
    { id: '2', name: 'March Madness Bracket', sport: 'Basketball', entries: 189, maxEntries: 300, status: 'Active' as const },
  ];

  const renderHeader = (title: string, onBack?: () => void, rightAction?: React.ReactNode) => (
    <View style={[styles.header, { paddingTop: topPadding + 12, backgroundColor: isDark ? 'rgba(0,0,0,0.92)' : 'rgba(255,255,255,0.96)', borderBottomColor: colors.cardBorder }]}>
      <View style={styles.headerRow}>
        {onBack ? (
          <Pressable onPress={onBack} style={({ pressed }) => [styles.headerIconBtn, { opacity: pressed ? 0.7 : 1 }]}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
        ) : (
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.headerIconBtn, { opacity: pressed ? 0.7 : 1 }]}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
        )}
        <Text style={[styles.headerTitle, { color: colors.text }]}>{title}</Text>
        {rightAction || <View style={{ width: 40 }} />}
      </View>
    </View>
  );

  const renderNotLoggedIn = () => (
    <View style={styles.centerContent}>
      <Ionicons name="lock-closed" size={48} color={colors.textMuted} />
      <Text style={[styles.centerTitle, { color: colors.text }]}>Sign In Required</Text>
      <Text style={[styles.centerSub, { color: colors.textMuted }]}>Please sign in to access the sponsor portal.</Text>
    </View>
  );

  const renderPending = () => (
    <View style={styles.centerContent}>
      <Ionicons name="time" size={56} color={Colors.warning} />
      <Text style={[styles.centerTitle, { color: colors.text }]}>Application Under Review</Text>
      <Text style={[styles.centerSub, { color: colors.textMuted }]}>
        Your sponsor application is currently being reviewed by our team. We will notify you once a decision has been made.
      </Text>
    </View>
  );

  const renderSuspended = () => (
    <View style={styles.centerContent}>
      <Ionicons name="alert-circle" size={56} color={Colors.error} />
      <Text style={[styles.centerTitle, { color: colors.text }]}>Account Suspended</Text>
      <Text style={[styles.centerSub, { color: colors.textMuted }]}>
        Your sponsor account has been suspended. Please contact support for more information.
      </Text>
    </View>
  );

  const renderAccessDenied = () => {
    const perks = [
      { icon: 'trophy-outline' as const, title: 'Run Branded Contests', desc: 'Create custom fantasy contests with your brand front and center' },
      { icon: 'people-outline' as const, title: 'Reach Engaged Fans', desc: 'Connect with thousands of passionate sports fans' },
      { icon: 'stats-chart-outline' as const, title: 'Track Performance', desc: 'Real-time analytics on impressions, engagement, and ROI' },
      { icon: 'megaphone-outline' as const, title: 'Marketing Tools', desc: 'Templates, print assets, and promotional materials included' },
    ];
    const tiers = [
      { name: 'Free Royale', price: 'Free', color: '#22C55E', desc: 'Up to 50 entries' },
      { name: 'Office Royale', price: '$99', color: '#3B82F6', desc: 'Up to 200 entries' },
      { name: 'Local Legends', price: '$750', color: '#8B5CF6', desc: 'Up to 500 entries' },
      { name: 'Premier Brand', price: 'Custom', color: '#F59E0B', desc: 'Unlimited + dedicated support' },
    ];
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: bottomPadding + 40 }} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['rgba(249,115,22,0.2)', 'rgba(139,92,246,0.15)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: 20, paddingTop: 32, paddingBottom: 24, alignItems: 'center' }}
        >
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(249,115,22,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
            <Ionicons name="storefront-outline" size={36} color={Colors.primary} />
          </View>
          <Text style={{ color: colors.text, fontSize: 24, fontFamily: 'Inter_700Bold', textAlign: 'center', marginBottom: 8 }}>Sponsor Hub</Text>
          <Text style={{ color: colors.textMuted, fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20, maxWidth: 300 }}>
            Put your brand in front of thousands of engaged fantasy sports fans with custom contests and campaigns.
          </Text>
        </LinearGradient>

        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontFamily: 'Inter_600SemiBold', marginBottom: 14 }}>Why Sponsor on Fantasy Royale?</Text>
          {perks.map((perk, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 14, marginBottom: 16, alignItems: 'flex-start' }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(249,115,22,0.1)', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name={perk.icon} size={20} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 14, fontFamily: 'Inter_600SemiBold', marginBottom: 2 }}>{perk.title}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 }}>{perk.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ paddingHorizontal: 20, marginBottom: 28 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontFamily: 'Inter_600SemiBold', marginBottom: 14 }}>Sponsorship Tiers</Text>
          {tiers.map((tier, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 12, padding: 14, marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tier.color }} />
                <View>
                  <Text style={{ color: colors.text, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>{tier.name}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11, fontFamily: 'Inter_400Regular' }}>{tier.desc}</Text>
                </View>
              </View>
              <Text style={{ color: tier.color, fontSize: 15, fontFamily: 'Inter_700Bold' }}>{tier.price}</Text>
            </View>
          ))}
        </View>

        <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
          <LinearGradient
            colors={[Colors.primary, Colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ borderRadius: 14, padding: 20, alignItems: 'center' }}
          >
            <Text style={{ color: '#000', fontSize: 16, fontFamily: 'Inter_700Bold', marginBottom: 6 }}>Interested in Sponsoring?</Text>
            <Text style={{ color: 'rgba(0,0,0,0.7)', fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', marginBottom: 14, lineHeight: 18 }}>
              Contact our team to get started. We'll set up your brand account and have you running contests in no time.
            </Text>
            <Text style={{ color: '#000', fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>sponsors@fantasyroyale.com</Text>
          </LinearGradient>
        </View>

        <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }]}>
            <Text style={{ color: colors.textMuted, fontSize: 14, fontFamily: 'Inter_500Medium' }}>Back to Home</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  };

  // === VIEW 1: DASHBOARD ===
  const renderDashboard = () => (
    <>
      {renderHeader(
        isAdminViewing ? (profile?.company_name || 'Sponsor Hub') : 'Sponsor Hub',
        isAdminViewing ? () => setAdminSelectedSponsorId(null) : () => router.back(),
        <Pressable onPress={() => setView('settings')} style={({ pressed }) => [styles.headerIconBtn, { opacity: pressed ? 0.7 : 1 }]}>
          <Ionicons name="settings-outline" size={22} color={colors.text} />
        </Pressable>
      )}
      {isAdminViewing ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary + '15', paddingHorizontal: 16, paddingVertical: 8 }}>
          <Ionicons name="shield-checkmark" size={16} color={Colors.primary} style={{ marginRight: 6 }} />
          <Text style={{ color: Colors.primary, fontSize: 12, fontWeight: '600', flex: 1 }}>Viewing as Admin</Text>
          <Pressable onPress={() => setAdminSelectedSponsorId(null)}>
            <Text style={{ color: Colors.primary, fontSize: 12, fontWeight: '600' }}>Switch Sponsor</Text>
          </Pressable>
        </View>
      ) : null}
      <ScrollView style={styles.scrollView} contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding + 20 }]} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 4 }]}>Featured Campaigns</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder, padding: 0, overflow: 'hidden' as const }]}>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={(e) => setCarouselIndex(Math.round(e.nativeEvent.contentOffset.x / (SCREEN_WIDTH - 48)))}>
            {carouselSlides.map((slide, i) => (
              <LinearGradient key={i} colors={slide.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.carouselSlide, { width: SCREEN_WIDTH - 48 }]}>
                <Text style={styles.carouselTitle}>{slide.title}</Text>
                <Text style={styles.carouselSubtitle}>{slide.subtitle}</Text>
              </LinearGradient>
            ))}
          </ScrollView>
          <View style={styles.dotsRow}>
            {carouselSlides.map((_, i) => (
              <View key={i} style={[styles.dot, { backgroundColor: i === carouselIndex ? Colors.primary : colors.textMuted, opacity: i === carouselIndex ? 1 : 0.4 }]} />
            ))}
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Engagement This Week</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.chartRow}>
            {weeklyEngagement.map((item, i) => (
              <View key={i} style={styles.barCol}>
                <View style={styles.barTrack}>
                  <LinearGradient colors={[Colors.primary, '#3B82F6']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={[styles.barFill, { height: `${(item.value / maxEngagement) * 100}%` }]} />
                </View>
                <Text style={[styles.barDayLabel, { color: colors.textMuted }]}>{item.day}</Text>
              </View>
            ))}
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text }]}>2.4K</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Entries</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text }]}>45K</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Reach</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text }]}>3</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Active</Text>
            </View>
          </View>
        </View>

        <Pressable onPress={() => setView('tiers')} style={({ pressed }) => [styles.primaryButton, { opacity: pressed ? 0.7 : 1, marginHorizontal: 16, marginTop: 8 }]}>
          <Ionicons name="add-circle" size={20} color="#000" style={{ marginRight: 8 }} />
          <Text style={styles.primaryButtonText}>Create New Contest</Text>
        </Pressable>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
        <View style={styles.gridRow}>
          <Pressable onPress={() => setView('templates')} style={({ pressed }) => [styles.quickAction, { backgroundColor: colors.card, borderColor: colors.cardBorder, opacity: pressed ? 0.7 : 1 }]}>
            <Ionicons name="document-text" size={24} color={colors.text} />
            <Text style={[styles.quickActionLabel, { color: colors.text }]}>Templates</Text>
          </Pressable>
          <Pressable onPress={() => setView('analytics')} style={({ pressed }) => [styles.quickAction, { backgroundColor: colors.card, borderColor: colors.cardBorder, opacity: pressed ? 0.7 : 1 }]}>
            <Ionicons name="bar-chart" size={24} color={colors.text} />
            <Text style={[styles.quickActionLabel, { color: colors.text }]}>Analytics</Text>
          </Pressable>
        </View>
        <View style={styles.gridRow}>
          <Pressable onPress={() => setView('marketing')} style={({ pressed }) => [styles.quickAction, { backgroundColor: colors.card, borderColor: colors.cardBorder, opacity: pressed ? 0.7 : 1 }]}>
            <Ionicons name="megaphone" size={24} color={colors.text} />
            <Text style={[styles.quickActionLabel, { color: colors.text }]}>Marketing</Text>
          </Pressable>
          <Pressable onPress={() => setView('print-order')} style={({ pressed }) => [styles.quickAction, { backgroundColor: Colors.primary + '15', borderColor: Colors.primary, opacity: pressed ? 0.7 : 1 }]}>
            <Ionicons name="cart" size={24} color={Colors.primary} />
            <Text style={[styles.quickActionLabel, { color: Colors.primary }]}>Order Assets</Text>
          </Pressable>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Active Contests</Text>
        {mockContests.map((contest) => (
          <View key={contest.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.contestRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.contestName, { color: colors.text }]}>{contest.name}</Text>
                <Text style={[styles.mutedText, { color: colors.textMuted }]}>{contest.sport} -- {contest.entries}/{contest.maxEntries} entries</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: Colors.success + '20' }]}>
                <View style={[styles.statusDot, { backgroundColor: Colors.success }]} />
                <Text style={[styles.statusBadgeText, { color: Colors.success }]}>{contest.status}</Text>
              </View>
            </View>
            <Pressable onPress={() => { setManageContestId(contest.id); setManageContestName(contest.name); setView('manage'); }} style={({ pressed }) => [styles.outlineButton, { borderColor: Colors.primary, opacity: pressed ? 0.7 : 1, marginTop: 10 }]}>
              <Text style={[styles.outlineButtonText, { color: Colors.primary }]}>Manage</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </>
  );

  // === VIEW 2: TIER SELECTION ===
  const renderTiers = () => {
    const tiers = [
      { key: 'premier', name: 'Premier Brand Royale', price: 'Contact Sales', accent: '#EAB308', features: ['Unlimited audience size', 'Custom branding & analytics', 'Dedicated account manager', 'Multi-event campaigns'] },
      { key: 'local', name: 'Local Legends Royale', price: '$750', accent: '#3B82F6', features: ['Up to 750 participants', 'Full analytics dashboard', 'Custom prize packages', 'Priority support'] },
      { key: 'office', name: 'Office Royale', price: '$99', accent: '#22C55E', features: ['Up to 250 participants', 'Basic analytics', 'Standard prize options'] },
      { key: 'free', name: 'Free Royale', price: 'Free', accent: '#6B7280', features: ['Up to 50 participants', 'Basic contest creation', 'Community support'] },
    ];
    return (
      <>
        {renderHeader('Choose Your Tier', () => setView('dashboard'))}
        <ScrollView style={styles.scrollView} contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding + 20 }]} showsVerticalScrollIndicator={false}>
          {tiers.map((tier) => (
            <Pressable
              key={tier.key}
              onPress={() => {
                if (tier.key === 'premier') { setView('sales'); }
                else { setSelectedTier(tier.key); setWizardStep(1); setView('wizard'); }
              }}
              style={({ pressed }) => [styles.card, { backgroundColor: colors.card, borderColor: tier.accent + '60', opacity: pressed ? 0.7 : 1 }]}
            >
              <View style={[styles.tierAccent, { backgroundColor: tier.accent }]} />
              <Text style={[styles.tierName, { color: colors.text }]}>{tier.name}</Text>
              <Text style={[styles.tierPrice, { color: tier.accent }]}>{tier.price}</Text>
              {tier.features.map((f, i) => (
                <View key={i} style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={16} color={tier.accent} />
                  <Text style={[styles.featureText, { color: colors.textSecondary }]}>{f}</Text>
                </View>
              ))}
            </Pressable>
          ))}
        </ScrollView>
      </>
    );
  };

  // === VIEW 3: WIZARD ===
  const renderWizard = () => {
    const contestTypes = [
      { key: 'weekly', label: 'Weekly Picks', icon: 'calendar' as const },
      { key: 'bracket', label: 'Bracket Challenge', icon: 'git-merge' as const },
      { key: 'survivor', label: 'Survivor Pool', icon: 'shield-checkmark' as const },
      { key: 'props', label: 'Prop Bets', icon: 'flash' as const },
    ];
    const durations = [
      { key: 'single', label: 'Single Event', mult: '1x' },
      { key: 'weekly', label: 'Weekly', mult: '1.5x' },
      { key: 'monthly', label: 'Monthly', mult: '2x' },
      { key: 'season', label: 'Full Season', mult: '3.5x' },
    ];
    const maxAudience = selectedTier === 'free' ? 50 : 750;
    const isFree = selectedTier === 'free';

    const canContinue = (): boolean => {
      if (wizardStep === 1) return !!contestType;
      if (wizardStep === 2) return !!duration;
      if (wizardStep === 3) return audienceSize >= 10;
      if (wizardStep === 4) return true;
      if (wizardStep === 5) return !!contestName.trim();
      return false;
    };

    return (
      <>
        {renderHeader(
          `Step ${wizardStep} of 5`,
          () => { if (wizardStep === 1) setView('tiers'); else setWizardStep(wizardStep - 1); },
          <Pressable onPress={() => { resetWizard(); setView('dashboard'); }} style={({ pressed }) => [styles.headerIconBtn, { opacity: pressed ? 0.7 : 1 }]}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        )}
        <ScrollView style={styles.scrollView} contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding + 100 }]} showsVerticalScrollIndicator={false}>
          <View style={styles.progressBar}>
            {[1, 2, 3, 4, 5].map((s) => (
              <View key={s} style={[styles.progressSegment, { backgroundColor: s <= wizardStep ? Colors.primary : colors.cardBorder }]} />
            ))}
          </View>

          {wizardStep === 1 && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Select Contest Type</Text>
              {contestTypes.map((ct) => (
                <Pressable key={ct.key} onPress={() => setContestType(ct.key)} style={({ pressed }) => [styles.card, { backgroundColor: colors.card, borderColor: contestType === ct.key ? Colors.primary : colors.cardBorder, opacity: pressed ? 0.7 : 1 }]}>
                  <View style={styles.contestRow}>
                    <Ionicons name={ct.icon} size={24} color={contestType === ct.key ? Colors.primary : colors.textMuted} />
                    <Text style={[styles.contestName, { color: colors.text, marginLeft: 12 }]}>{ct.label}</Text>
                    {contestType === ct.key && <Ionicons name="checkmark-circle" size={22} color={Colors.primary} style={{ marginLeft: 'auto' as const }} />}
                  </View>
                </Pressable>
              ))}
            </>
          )}

          {wizardStep === 2 && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Select Duration</Text>
              {durations.map((d) => (
                <Pressable key={d.key} onPress={() => setDuration(d.key)} style={({ pressed }) => [styles.card, { backgroundColor: colors.card, borderColor: duration === d.key ? Colors.primary : colors.cardBorder, opacity: pressed ? 0.7 : 1 }]}>
                  <View style={styles.contestRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.contestName, { color: colors.text }]}>{d.label}</Text>
                      {!isFree && <Text style={[styles.mutedText, { color: colors.textMuted }]}>Price multiplier: {d.mult}</Text>}
                    </View>
                    {duration === d.key && <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />}
                  </View>
                </Pressable>
              ))}
            </>
          )}

          {wizardStep === 3 && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Audience Size</Text>
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <Text style={[styles.audienceValue, { color: Colors.primary }]}>{audienceSize}</Text>
                <Text style={[styles.mutedText, { color: colors.textMuted, textAlign: 'center' as const, marginBottom: 16 }]}>participants</Text>
                <View style={styles.sliderRow}>
                  <Text style={[styles.sliderLabel, { color: colors.textMuted }]}>10</Text>
                  <View style={styles.sliderTrack}>
                    <View style={[styles.sliderFill, { width: `${((audienceSize - 10) / (maxAudience - 10)) * 100}%`, backgroundColor: Colors.primary }]} />
                    <View style={styles.sliderButtons}>
                      {[10, Math.floor(maxAudience * 0.25), Math.floor(maxAudience * 0.5), Math.floor(maxAudience * 0.75), maxAudience].map((v) => (
                        <Pressable key={v} onPress={() => setAudienceSize(v)} style={[styles.sliderDot, { backgroundColor: audienceSize >= v ? Colors.primary : colors.cardBorder }]} />
                      ))}
                    </View>
                  </View>
                  <Text style={[styles.sliderLabel, { color: colors.textMuted }]}>{maxAudience}</Text>
                </View>
                <View style={styles.sliderQuickButtons}>
                  {[10, 25, 50, 100, 250, maxAudience].filter(v => v <= maxAudience).map((v) => (
                    <Pressable key={v} onPress={() => setAudienceSize(v)} style={({ pressed }) => [styles.chipButton, { backgroundColor: audienceSize === v ? Colors.primary : colors.card, borderColor: audienceSize === v ? Colors.primary : colors.cardBorder, opacity: pressed ? 0.7 : 1 }]}>
                      <Text style={[styles.chipText, { color: audienceSize === v ? '#000' : colors.text }]}>{v}</Text>
                    </Pressable>
                  ))}
                </View>
                {!isFree && audienceSize > 500 && (
                  <View style={[styles.infoBanner, { backgroundColor: Colors.warning + '15', borderColor: Colors.warning + '30' }]}>
                    <Ionicons name="information-circle" size={18} color={Colors.warning} />
                    <Text style={[styles.infoText, { color: Colors.warning }]}>For 500+ participants, contact sales for custom pricing.</Text>
                  </View>
                )}
                {isFree && audienceSize >= 50 && (
                  <Pressable onPress={() => setView('tiers')} style={{ marginTop: 8 }}>
                    <Text style={[styles.linkText, { color: Colors.primary }]}>View Upgrade Options</Text>
                  </Pressable>
                )}
              </View>
            </>
          )}

          {wizardStep === 4 && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Prizes & Boosts</Text>
              {isFree ? (
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                  <Text style={[styles.contestName, { color: colors.text }]}>Free Tier</Text>
                  <Text style={[styles.mutedText, { color: colors.textMuted, marginTop: 8 }]}>
                    With the Free tier, you provide your own prizes. Upgrade to a paid tier for prize packages and Crown Boosts.
                  </Text>
                  <Pressable onPress={() => setView('tiers')} style={{ marginTop: 12 }}>
                    <Text style={[styles.linkText, { color: Colors.primary }]}>View paid tiers</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                    <Text style={[styles.contestName, { color: colors.text, marginBottom: 12 }]}>Prize Package</Text>
                    {[{ label: 'No additional prizes', value: 0 }, { label: 'Bronze Package (+$100)', value: 100 }, { label: 'Gold Package (+$200)', value: 200 }].map((p) => (
                      <Pressable key={p.value} onPress={() => setPrizes(p.value)} style={({ pressed }) => [styles.radioRow, { opacity: pressed ? 0.7 : 1 }]}>
                        <View style={[styles.radio, { borderColor: prizes === p.value ? Colors.primary : colors.cardBorder }]}>
                          {prizes === p.value && <View style={[styles.radioInner, { backgroundColor: Colors.primary }]} />}
                        </View>
                        <Text style={[styles.radioLabel, { color: colors.text }]}>{p.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                    <Text style={[styles.contestName, { color: colors.text, marginBottom: 12 }]}>Crown Boosts</Text>
                    {[
                      { key: 'bonus', label: 'Bonus Crown Week', price: '+$50' },
                      { key: 'double', label: 'Double Crown Activation', price: '+$100' },
                      { key: 'featured', label: 'Featured Crown Challenge', price: '+$250' },
                    ].map((b) => (
                      <Pressable key={b.key} onPress={() => setBoosts(prev => prev.includes(b.key) ? prev.filter(x => x !== b.key) : [...prev, b.key])} style={({ pressed }) => [styles.radioRow, { opacity: pressed ? 0.7 : 1 }]}>
                        <View style={[styles.checkbox, { borderColor: boosts.includes(b.key) ? Colors.primary : colors.cardBorder, backgroundColor: boosts.includes(b.key) ? Colors.primary : 'transparent' }]}>
                          {boosts.includes(b.key) && <Ionicons name="checkmark" size={14} color="#000" />}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.radioLabel, { color: colors.text }]}>{b.label}</Text>
                          <Text style={[styles.mutedText, { color: colors.textMuted }]}>{b.price}</Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
            </>
          )}

          {wizardStep === 5 && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Contest Details</Text>
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Contest Name *</Text>
                <TextInput style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.cardBorder }]} value={contestName} onChangeText={setContestName} placeholder="Enter contest name" placeholderTextColor={colors.textMuted} />

                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Brand Name</Text>
                <TextInput style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.cardBorder }]} value={brandName} onChangeText={setBrandName} placeholder="Your brand name" placeholderTextColor={colors.textMuted} />

                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Logo</Text>
                <View style={[styles.uploadPlaceholder, { borderColor: colors.cardBorder }]}>
                  <Ionicons name="cloud-upload-outline" size={32} color={colors.textMuted} />
                  <Text style={[styles.mutedText, { color: colors.textMuted, marginTop: 8 }]}>Tap to upload logo</Text>
                </View>
              </View>
            </>
          )}
        </ScrollView>

        {!isFree && selectedTier && (
          <View style={[styles.priceBreakdown, { backgroundColor: colors.card, borderTopColor: colors.cardBorder }]}>
            <View style={styles.priceRow}>
              <Text style={[styles.priceLabel, { color: colors.textMuted }]}>Base</Text>
              <Text style={[styles.priceValue, { color: colors.text }]}>${tierBasePrice()}</Text>
            </View>
            {duration && (
              <View style={styles.priceRow}>
                <Text style={[styles.priceLabel, { color: colors.textMuted }]}>Duration ({durationMultiplier()}x)</Text>
                <Text style={[styles.priceValue, { color: colors.text }]}>${Math.round(tierBasePrice() * durationMultiplier())}</Text>
              </View>
            )}
            {audienceCost() > 0 && (
              <View style={styles.priceRow}>
                <Text style={[styles.priceLabel, { color: colors.textMuted }]}>Audience</Text>
                <Text style={[styles.priceValue, { color: colors.text }]}>+${audienceCost()}</Text>
              </View>
            )}
            {prizes > 0 && (
              <View style={styles.priceRow}>
                <Text style={[styles.priceLabel, { color: colors.textMuted }]}>Prizes</Text>
                <Text style={[styles.priceValue, { color: colors.text }]}>+${prizes}</Text>
              </View>
            )}
            {boostsCost() > 0 && (
              <View style={styles.priceRow}>
                <Text style={[styles.priceLabel, { color: colors.textMuted }]}>Boosts</Text>
                <Text style={[styles.priceValue, { color: colors.text }]}>+${boostsCost()}</Text>
              </View>
            )}
            <View style={[styles.priceRow, { borderTopWidth: 1, borderTopColor: colors.cardBorder, paddingTop: 8, marginTop: 4 }]}>
              <Text style={[styles.totalLabel, { color: colors.text }]}>Total</Text>
              <Text style={[styles.totalValue, { color: Colors.primary }]}>${totalPrice()}</Text>
            </View>
          </View>
        )}

        <View style={[styles.bottomBar, { backgroundColor: colors.card, borderTopColor: colors.cardBorder, paddingBottom: bottomPadding + 12 }]}>
          <Pressable
            onPress={() => {
              if (wizardStep < 5) { setWizardStep(wizardStep + 1); }
              else { setView('success'); }
            }}
            disabled={!canContinue()}
            style={({ pressed }) => [styles.primaryButton, { opacity: pressed && canContinue() ? 0.7 : canContinue() ? 1 : 0.4, flex: 1 }]}
          >
            <Text style={styles.primaryButtonText}>
              {wizardStep < 5 ? 'Continue' : (isFree ? 'Launch Free Contest' : `Launch Contest - $${totalPrice()}`)}
            </Text>
          </Pressable>
        </View>
      </>
    );
  };

  // === VIEW 4: SALES FORM ===
  const renderSales = () => (
    <>
      {renderHeader('Premier Brand Royale', () => setView('tiers'))}
      <ScrollView style={styles.scrollView} contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding + 20 }]} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#EAB308', '#F59E0B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.salesBanner}>
          <Text style={styles.salesBannerTitle}>Premier Brand Royale</Text>
          <Text style={styles.salesBannerSub}>Custom enterprise sponsorship solutions</Text>
        </LinearGradient>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Name</Text>
          <TextInput style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.cardBorder }]} value={salesName} onChangeText={setSalesName} placeholder="Your full name" placeholderTextColor={colors.textMuted} />

          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Email</Text>
          <TextInput style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.cardBorder }]} value={salesEmail} onChangeText={setSalesEmail} placeholder="email@company.com" placeholderTextColor={colors.textMuted} keyboardType="email-address" autoCapitalize="none" />

          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Phone</Text>
          <TextInput style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.cardBorder }]} value={salesPhone} onChangeText={setSalesPhone} placeholder="(555) 555-5555" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" />

          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Company Name</Text>
          <TextInput style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.cardBorder }]} value={salesCompany} onChangeText={setSalesCompany} placeholder="Company name" placeholderTextColor={colors.textMuted} />

          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Goals</Text>
          <TextInput style={[styles.input, styles.textArea, { backgroundColor: colors.card, color: colors.text, borderColor: colors.cardBorder }]} value={salesGoals} onChangeText={setSalesGoals} placeholder="What are your sponsorship goals?" placeholderTextColor={colors.textMuted} multiline numberOfLines={4} textAlignVertical="top" />

          <Pressable onPress={() => Alert.alert('Success', 'Quote request received!')} style={({ pressed }) => [styles.primaryButton, { backgroundColor: '#EAB308', opacity: pressed ? 0.7 : 1 }]}>
            <Text style={[styles.primaryButtonText, { color: '#000' }]}>Request Custom Quote</Text>
          </Pressable>
        </View>
      </ScrollView>
    </>
  );

  // === VIEW 5: SUCCESS ===
  const renderSuccess = () => (
    <>
      {renderHeader('Contest Created')}
      <ScrollView style={styles.scrollView} contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding + 20, alignItems: 'center' as const }]} showsVerticalScrollIndicator={false}>
        <View style={{ marginTop: 40, alignItems: 'center' as const }}>
          <Ionicons name="checkmark-circle" size={80} color={Colors.success} />
          <Text style={[styles.successTitle, { color: colors.text }]}>Contest Created!</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder, width: '100%' as const }]}>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Contest</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{contestName || 'My Contest'}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Type</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{contestType || 'Weekly Picks'}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Capacity</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{audienceSize} participants</Text>
          </View>
        </View>

        <View style={[styles.gridRow, { width: '100%' as const }]}>
          <Pressable onPress={() => Alert.alert('Coming soon', 'This feature is coming soon.')} style={({ pressed }) => [styles.quickAction, { backgroundColor: colors.card, borderColor: colors.cardBorder, opacity: pressed ? 0.7 : 1 }]}>
            <Ionicons name="share-outline" size={22} color={colors.text} />
            <Text style={[styles.quickActionLabel, { color: colors.text }]}>Share Link</Text>
          </Pressable>
          <Pressable onPress={() => Alert.alert('Coming soon', 'This feature is coming soon.')} style={({ pressed }) => [styles.quickAction, { backgroundColor: colors.card, borderColor: colors.cardBorder, opacity: pressed ? 0.7 : 1 }]}>
            <Ionicons name="qr-code-outline" size={22} color={colors.text} />
            <Text style={[styles.quickActionLabel, { color: colors.text }]}>QR Code</Text>
          </Pressable>
        </View>
        <View style={[styles.gridRow, { width: '100%' as const }]}>
          <Pressable onPress={() => Alert.alert('Coming soon', 'This feature is coming soon.')} style={({ pressed }) => [styles.quickAction, { backgroundColor: colors.card, borderColor: colors.cardBorder, opacity: pressed ? 0.7 : 1 }]}>
            <Ionicons name="gift-outline" size={22} color={colors.text} />
            <Text style={[styles.quickActionLabel, { color: colors.text }]}>Promo Kit</Text>
          </Pressable>
          <Pressable onPress={() => Alert.alert('Coming soon', 'This feature is coming soon.')} style={({ pressed }) => [styles.quickAction, { backgroundColor: colors.card, borderColor: colors.cardBorder, opacity: pressed ? 0.7 : 1 }]}>
            <Ionicons name="code-slash-outline" size={22} color={colors.text} />
            <Text style={[styles.quickActionLabel, { color: colors.text }]}>Embed Code</Text>
          </Pressable>
        </View>

        <Pressable onPress={() => { resetWizard(); setView('dashboard'); }} style={({ pressed }) => [styles.primaryButton, { opacity: pressed ? 0.7 : 1, width: '100%' as const, marginTop: 20 }]}>
          <Text style={styles.primaryButtonText}>Go to Dashboard</Text>
        </Pressable>
      </ScrollView>
    </>
  );

  // === VIEW 6: MANAGE CONTEST ===
  const renderManage = () => {
    const statusColors: Record<string, string> = { Active: Colors.success, Paused: Colors.warning, Ended: '#6B7280' };
    return (
      <>
        {renderHeader('Manage Contest', () => setView('dashboard'))}
        <ScrollView style={styles.scrollView} contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding + 20 }]} showsVerticalScrollIndicator={false}>
          <View style={[styles.statusBadge, { backgroundColor: statusColors[manageStatus] + '20', alignSelf: 'flex-start' as const, marginBottom: 16 }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColors[manageStatus] }]} />
            <Text style={[styles.statusBadgeText, { color: statusColors[manageStatus] }]}>{manageStatus}</Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.contestName, { color: colors.text }]}>{manageContestName}</Text>
            <Text style={[styles.mutedText, { color: colors.textMuted, marginTop: 4 }]}>Weekly Picks -- Football</Text>
            <View style={[styles.progressTrack, { backgroundColor: colors.cardBorder, marginTop: 12 }]}>
              <View style={[styles.progressFill, { width: '68%', backgroundColor: Colors.primary }]} />
            </View>
            <Text style={[styles.mutedText, { color: colors.textMuted, marginTop: 4 }]}>342/500 entries</Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.text }]}>12.4K</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Views</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.text }]}>890</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Shares</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.text }]}>2.5x</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Crown Mult</Text>
              </View>
            </View>
          </View>

          <View style={styles.gridRow}>
            {[{ icon: 'share-outline' as const, label: 'Share' }, { icon: 'qr-code-outline' as const, label: 'QR Code' }].map((a) => (
              <Pressable key={a.label} onPress={() => Alert.alert('Coming soon', 'This feature is coming soon.')} style={({ pressed }) => [styles.quickAction, { backgroundColor: colors.card, borderColor: colors.cardBorder, opacity: pressed ? 0.7 : 1 }]}>
                <Ionicons name={a.icon} size={22} color={colors.text} />
                <Text style={[styles.quickActionLabel, { color: colors.text }]}>{a.label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.gridRow}>
            {[{ icon: 'people-outline' as const, label: 'Entries' }, { icon: 'trophy-outline' as const, label: 'Leaderboard' }].map((a) => (
              <Pressable key={a.label} onPress={() => Alert.alert('Coming soon', 'This feature is coming soon.')} style={({ pressed }) => [styles.quickAction, { backgroundColor: colors.card, borderColor: colors.cardBorder, opacity: pressed ? 0.7 : 1 }]}>
                <Ionicons name={a.icon} size={22} color={colors.text} />
                <Text style={[styles.quickActionLabel, { color: colors.text }]}>{a.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>Edit Contest</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Contest Name</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.cardBorder }]} value={manageContestName} onChangeText={setManageContestName} placeholderTextColor={colors.textMuted} />

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Prize Pool</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.cardBorder }]} value={managePrizePool} onChangeText={setManagePrizePool} placeholderTextColor={colors.textMuted} />

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Start Date</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.cardBorder }]} value={manageStartDate} onChangeText={setManageStartDate} placeholderTextColor={colors.textMuted} />

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>End Date</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.cardBorder }]} value={manageEndDate} onChangeText={setManageEndDate} placeholderTextColor={colors.textMuted} />

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Max Entries</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.cardBorder }]} value={manageMaxEntries} onChangeText={setManageMaxEntries} placeholderTextColor={colors.textMuted} keyboardType="number-pad" />
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>Contest Status</Text>
          <View style={styles.statusToggleRow}>
            {(['Active', 'Paused', 'Ended'] as const).map((s) => (
              <Pressable key={s} onPress={() => setManageStatus(s)} style={({ pressed }) => [styles.statusToggle, { backgroundColor: manageStatus === s ? statusColors[s] : colors.card, borderColor: manageStatus === s ? statusColors[s] : colors.cardBorder, opacity: pressed ? 0.7 : 1 }]}>
                <Text style={[styles.statusToggleText, { color: manageStatus === s ? '#fff' : colors.text }]}>{s}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable onPress={() => { Alert.alert('Saved', 'Changes saved successfully.'); setView('dashboard'); }} style={({ pressed }) => [styles.primaryButton, { opacity: pressed ? 0.7 : 1, marginHorizontal: 16, marginTop: 16 }]}>
            <Text style={styles.primaryButtonText}>Save Changes</Text>
          </Pressable>

          <Pressable onPress={() => Alert.alert('Delete Contest', 'Are you sure you want to delete this contest? This action cannot be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => setView('dashboard') }])} style={({ pressed }) => [styles.outlineButton, { borderColor: Colors.error, opacity: pressed ? 0.7 : 1, marginHorizontal: 16, marginTop: 12 }]}>
            <Text style={[styles.outlineButtonText, { color: Colors.error }]}>Delete Contest</Text>
          </Pressable>
        </ScrollView>
      </>
    );
  };

  // === VIEW 7: TEMPLATE GALLERY ===
  const renderTemplates = () => {
    const categories = ['All Templates', 'Social Posts', 'Stories', 'Banners', 'Print'];
    const templates = [
      { name: 'Contest Announcement', category: 'Social Posts', size: '1080x1080', gradient: [Colors.primary, '#3B82F6'] as [string, string] },
      { name: 'Winner Reveal', category: 'Social Posts', size: '1080x1080', gradient: ['#F97316', '#EF4444'] as [string, string] },
      { name: 'Story Promo', category: 'Stories', size: '1080x1920', gradient: ['#8B5CF6', '#EC4899'] as [string, string] },
      { name: 'Entry Reminder', category: 'Stories', size: '1080x1920', gradient: ['#22C55E', Colors.primary] as [string, string] },
      { name: 'Web Banner', category: 'Banners', size: '728x90', gradient: ['#3B82F6', '#6366F1'] as [string, string] },
      { name: 'Leaderboard Banner', category: 'Banners', size: '300x250', gradient: ['#EAB308', '#F97316'] as [string, string] },
      { name: 'Event Flyer', category: 'Print', size: '8.5x11"', gradient: ['#EC4899', '#8B5CF6'] as [string, string] },
      { name: 'Table Tent', category: 'Print', size: '4x6"', gradient: ['#14B8A6', '#22C55E'] as [string, string] },
    ];
    const filtered = templateFilter === 'All Templates' ? templates : templates.filter(t => t.category === templateFilter);

    return (
      <>
        {renderHeader('Template Gallery', () => setView('dashboard'))}
        <ScrollView style={styles.scrollView} contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding + 20 }]} showsVerticalScrollIndicator={false}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
            {categories.map((c) => (
              <Pressable key={c} onPress={() => setTemplateFilter(c)} style={({ pressed }) => [styles.filterChip, { backgroundColor: templateFilter === c ? Colors.primary : colors.card, borderColor: templateFilter === c ? Colors.primary : colors.cardBorder, opacity: pressed ? 0.7 : 1 }]}>
                <Text style={[styles.filterChipText, { color: templateFilter === c ? '#000' : colors.text }]}>{c}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={[styles.infoBanner, { backgroundColor: Colors.primary + '10', borderColor: Colors.primary + '30', marginHorizontal: 16 }]}>
            <Ionicons name="information-circle" size={18} color={Colors.primary} />
            <Text style={[styles.infoText, { color: Colors.primary }]}>All templates are customizable with your brand colors and logo.</Text>
          </View>

          <View style={styles.templateGrid}>
            {filtered.map((t, i) => (
              <View key={i} style={[styles.templateCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <LinearGradient colors={t.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.templatePreview}>
                  <Ionicons name="image-outline" size={28} color="rgba(255,255,255,0.6)" />
                </LinearGradient>
                <Text style={[styles.templateName, { color: colors.text }]} numberOfLines={1}>{t.name}</Text>
                <Text style={[styles.mutedText, { color: colors.textMuted, fontSize: 11 }]}>{t.category} -- {t.size}</Text>
                <Pressable onPress={() => Alert.alert('Downloaded!', `${t.name} has been downloaded.`)} style={({ pressed }) => [styles.smallButton, { backgroundColor: Colors.primary, opacity: pressed ? 0.7 : 1 }]}>
                  <Text style={styles.smallButtonText}>Download</Text>
                </Pressable>
              </View>
            ))}
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder, marginTop: 8 }]}>
            <Text style={[styles.contestName, { color: colors.text }]}>Need Custom Graphics?</Text>
            <Text style={[styles.mutedText, { color: colors.textMuted, marginTop: 4, marginBottom: 12 }]}>Our design team can create custom assets for your brand.</Text>
            <Pressable onPress={() => Alert.alert('Request Sent', 'Our team will contact you about custom design options.')} style={({ pressed }) => [styles.outlineButton, { borderColor: Colors.primary, opacity: pressed ? 0.7 : 1 }]}>
              <Text style={[styles.outlineButtonText, { color: Colors.primary }]}>Request Custom Design</Text>
            </Pressable>
          </View>

          <Pressable onPress={() => { setPrintStep(1); setView('print-order'); }} style={({ pressed }) => [styles.primaryButton, { opacity: pressed ? 0.7 : 1, marginHorizontal: 16, marginTop: 12 }]}>
            <Ionicons name="cart" size={18} color="#000" style={{ marginRight: 8 }} />
            <Text style={styles.primaryButtonText}>Order Print Assets</Text>
          </Pressable>
        </ScrollView>
      </>
    );
  };

  // === VIEW 8: PRINT ORDER ===
  const renderPrintOrder = () => {
    const products = [
      { name: 'Promotional Flyers', price: 0.35, min: 50 },
      { name: 'Table Toppers', price: 1.25, min: 25 },
      { name: 'Posters', price: 2.50, min: 10 },
      { name: 'Small Banners', price: 12, min: 1 },
      { name: 'Pull Up Banners', price: 89, min: 1 },
    ];
    const hasProducts = printQuantities.some(q => q > 0);
    const hasLocations = printLocations.some(l => l.name.trim() && l.address.trim());
    const subtotal = printQuantities.reduce((sum, qty, i) => sum + qty * products[i].price, 0);
    const shipping = printLocations.length * 8.99;
    const total = subtotal + shipping;

    return (
      <>
        {renderHeader(
          printStep === 1 ? 'Select Products' : printStep === 2 ? 'Shipping Locations' : 'Checkout',
          () => { if (printStep === 1) setView('templates'); else setPrintStep(printStep - 1); }
        )}
        <ScrollView style={styles.scrollView} contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding + 20 }]} showsVerticalScrollIndicator={false}>
          <View style={styles.progressBar}>
            {[1, 2, 3].map((s) => (
              <View key={s} style={[styles.progressSegment, { backgroundColor: s <= printStep ? Colors.primary : colors.cardBorder }]} />
            ))}
          </View>

          {printStep === 1 && (
            <>
              {products.map((p, i) => (
                <View key={i} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                  <View style={styles.contestRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.contestName, { color: colors.text }]}>{p.name}</Text>
                      <Text style={[styles.mutedText, { color: colors.textMuted }]}>${p.price.toFixed(2)}/ea -- Min: {p.min}</Text>
                    </View>
                    <View style={styles.quantityControls}>
                      <Pressable
                        onPress={() => {
                          const newQ = [...printQuantities];
                          if (newQ[i] > 0) { newQ[i] = Math.max(0, newQ[i] - p.min); }
                          setPrintQuantities(newQ);
                        }}
                        style={({ pressed }) => [styles.qtyButton, { backgroundColor: colors.card, borderColor: colors.cardBorder, opacity: pressed ? 0.7 : 1 }]}
                      >
                        <Feather name="minus" size={16} color={colors.text} />
                      </Pressable>
                      <Text style={[styles.qtyValue, { color: colors.text }]}>{printQuantities[i]}</Text>
                      <Pressable
                        onPress={() => {
                          const newQ = [...printQuantities];
                          if (newQ[i] === 0) newQ[i] = p.min;
                          else newQ[i] += p.min;
                          setPrintQuantities(newQ);
                        }}
                        style={({ pressed }) => [styles.qtyButton, { backgroundColor: colors.card, borderColor: colors.cardBorder, opacity: pressed ? 0.7 : 1 }]}
                      >
                        <Feather name="plus" size={16} color={colors.text} />
                      </Pressable>
                    </View>
                  </View>
                </View>
              ))}
              <Pressable onPress={() => setPrintStep(2)} disabled={!hasProducts} style={({ pressed }) => [styles.primaryButton, { opacity: pressed && hasProducts ? 0.7 : hasProducts ? 1 : 0.4, marginHorizontal: 16, marginTop: 8 }]}>
                <Text style={styles.primaryButtonText}>Continue to Locations</Text>
              </Pressable>
            </>
          )}

          {printStep === 2 && (
            <>
              {printLocations.map((loc, i) => (
                <View key={i} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Location {i + 1} Name</Text>
                  <TextInput style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.cardBorder }]} value={loc.name} onChangeText={(t) => { const n = [...printLocations]; n[i] = { ...n[i], name: t }; setPrintLocations(n); }} placeholder="Location name" placeholderTextColor={colors.textMuted} />
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Address</Text>
                  <TextInput style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.cardBorder }]} value={loc.address} onChangeText={(t) => { const n = [...printLocations]; n[i] = { ...n[i], address: t }; setPrintLocations(n); }} placeholder="Full shipping address" placeholderTextColor={colors.textMuted} />
                </View>
              ))}
              <Pressable onPress={() => setPrintLocations([...printLocations, { name: '', address: '' }])} style={({ pressed }) => [styles.outlineButton, { borderColor: Colors.primary, opacity: pressed ? 0.7 : 1, marginHorizontal: 16 }]}>
                <Ionicons name="add" size={18} color={Colors.primary} style={{ marginRight: 6 }} />
                <Text style={[styles.outlineButtonText, { color: Colors.primary }]}>Add Another Location</Text>
              </Pressable>
              <Pressable onPress={() => setPrintStep(3)} disabled={!hasLocations} style={({ pressed }) => [styles.primaryButton, { opacity: pressed && hasLocations ? 0.7 : hasLocations ? 1 : 0.4, marginHorizontal: 16, marginTop: 12 }]}>
                <Text style={styles.primaryButtonText}>Continue to Checkout</Text>
              </Pressable>
            </>
          )}

          {printStep === 3 && (
            <>
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 12 }]}>Order Summary</Text>
                {products.map((p, i) => printQuantities[i] > 0 ? (
                  <View key={i} style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{p.name} x{printQuantities[i]}</Text>
                    <Text style={[styles.summaryValue, { color: colors.text }]}>${(printQuantities[i] * p.price).toFixed(2)}</Text>
                  </View>
                ) : null)}
                <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: colors.cardBorder, paddingTop: 8, marginTop: 8 }]}>
                  <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Subtotal</Text>
                  <Text style={[styles.summaryValue, { color: colors.text }]}>${subtotal.toFixed(2)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Shipping ({printLocations.length} location{printLocations.length > 1 ? 's' : ''} x $8.99)</Text>
                  <Text style={[styles.summaryValue, { color: colors.text }]}>${shipping.toFixed(2)}</Text>
                </View>
                <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: colors.cardBorder, paddingTop: 8, marginTop: 8 }]}>
                  <Text style={[styles.totalLabel, { color: colors.text }]}>Total</Text>
                  <Text style={[styles.totalValue, { color: Colors.primary }]}>${total.toFixed(2)}</Text>
                </View>
              </View>

              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <Text style={[styles.contestName, { color: colors.text, marginBottom: 8 }]}>Shipping To</Text>
                {printLocations.filter(l => l.name.trim()).map((loc, i) => (
                  <View key={i} style={{ marginBottom: 6 }}>
                    <Text style={[styles.mutedText, { color: colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>{loc.name}</Text>
                    <Text style={[styles.mutedText, { color: colors.textMuted }]}>{loc.address}</Text>
                  </View>
                ))}
              </View>

              <Pressable onPress={() => Alert.alert('Payment Required', 'Payment integration required. Please connect Stripe to enable checkout.')} style={({ pressed }) => [styles.primaryButton, { backgroundColor: Colors.success, opacity: pressed ? 0.7 : 1, marginHorizontal: 16, marginTop: 8 }]}>
                <Text style={[styles.primaryButtonText, { color: '#fff' }]}>Pay ${total.toFixed(2)}</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </>
    );
  };

  // === VIEW 9: ANALYTICS DASHBOARD ===
  const renderAnalytics = () => {
    const analyticsWeekly = [
      { day: 'Mon', value: 45 }, { day: 'Tue', value: 62 }, { day: 'Wed', value: 55 },
      { day: 'Thu', value: 78 }, { day: 'Fri', value: 71 }, { day: 'Sat', value: 40 }, { day: 'Sun', value: 58 },
    ];
    const maxAW = Math.max(...analyticsWeekly.map(w => w.value));
    const demographics = [
      { age: '18-24', pct: 22 }, { age: '25-34', pct: 38 }, { age: '35-44', pct: 24 },
      { age: '45-54', pct: 11 }, { age: '55+', pct: 5 },
    ];
    const contestPerf = [
      { name: 'Super Bowl Challenge', views: '45.2K', clicks: '3.8K', entries: '342', ctr: '8.4%' },
      { name: 'March Madness', views: '32.1K', clicks: '2.4K', entries: '189', ctr: '7.5%' },
      { name: 'Weekly NFL Picks', views: '18.7K', clicks: '1.2K', entries: '156', ctr: '6.4%' },
    ];

    return (
      <>
        {renderHeader('Analytics Dashboard', () => setView('dashboard'))}
        <ScrollView style={styles.scrollView} contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding + 20 }]} showsVerticalScrollIndicator={false}>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder, alignItems: 'center' as const }]}>
            <Text style={[styles.mutedText, { color: colors.textMuted }]}>Estimated ROI Value</Text>
            <Text style={[styles.roiValue, { color: Colors.primary }]}>$47,850</Text>
          </View>

          <View style={styles.gridRow}>
            {[{ label: 'Impressions', value: '245K' }, { label: 'Ad Clicks', value: '18.4K' }].map((m) => (
              <View key={m.label} style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <Text style={[styles.metricCardValue, { color: colors.text }]}>{m.value}</Text>
                <Text style={[styles.mutedText, { color: colors.textMuted }]}>{m.label}</Text>
              </View>
            ))}
          </View>
          <View style={styles.gridRow}>
            {[{ label: 'Avg Time', value: '5:42' }, { label: 'CTR', value: '7.5%' }].map((m) => (
              <View key={m.label} style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <Text style={[styles.metricCardValue, { color: colors.text }]}>{m.value}</Text>
                <Text style={[styles.mutedText, { color: colors.textMuted }]}>{m.label}</Text>
              </View>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>Weekly Engagement</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.chartRow}>
              {analyticsWeekly.map((item, i) => (
                <View key={i} style={styles.barCol}>
                  <View style={styles.barTrack}>
                    <LinearGradient colors={[Colors.primary, '#3B82F6']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={[styles.barFill, { height: `${(item.value / maxAW) * 100}%` }]} />
                  </View>
                  <Text style={[styles.barDayLabel, { color: colors.textMuted }]}>{item.day}</Text>
                </View>
              ))}
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>Brand Engagement</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.text }]}>2,340</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Social Shares</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.text }]}>1,890</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Brand Mentions</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.text }]}>8,900</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Return Visitors</Text>
              </View>
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>Conversion Funnel</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            {([{ label: 'Unique Visitors', value: '24,500', width: '100%' as const }, { label: 'Contest Entries', value: '6,870', width: '65%' as const }, { label: 'Email Signups', value: '2,580', width: '37.5%' as const }] as const).map((f, i) => (
              <View key={i} style={{ marginBottom: 12 }}>
                <View style={styles.summaryRow}>
                  <Text style={[styles.mutedText, { color: colors.textSecondary }]}>{f.label}</Text>
                  <Text style={[styles.statValue, { color: colors.text, fontSize: 14 }]}>{f.value}</Text>
                </View>
                <View style={[styles.progressTrack, { backgroundColor: colors.cardBorder }]}>
                  <LinearGradient colors={[Colors.primary, '#3B82F6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.progressFill, { width: f.width }]} />
                </View>
              </View>
            ))}
            <Text style={[styles.mutedText, { color: Colors.primary, textAlign: 'center' as const, marginTop: 4 }]}>37.5% conversion rate</Text>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>Contest Performance</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder, padding: 0, overflow: 'hidden' as const }]}>
            <View style={[styles.tableHeader, { borderBottomColor: colors.cardBorder }]}>
              <Text style={[styles.tableCell, styles.tableCellWide, { color: colors.textMuted }]}>Contest</Text>
              <Text style={[styles.tableCell, { color: colors.textMuted }]}>Views</Text>
              <Text style={[styles.tableCell, { color: colors.textMuted }]}>Clicks</Text>
              <Text style={[styles.tableCell, { color: colors.textMuted }]}>CTR</Text>
            </View>
            {contestPerf.map((c, i) => (
              <View key={i} style={[styles.tableRow, { borderBottomColor: i < contestPerf.length - 1 ? colors.cardBorder : 'transparent' }]}>
                <Text style={[styles.tableCell, styles.tableCellWide, { color: colors.text }]} numberOfLines={1}>{c.name}</Text>
                <Text style={[styles.tableCell, { color: colors.textSecondary }]}>{c.views}</Text>
                <Text style={[styles.tableCell, { color: colors.textSecondary }]}>{c.clicks}</Text>
                <Text style={[styles.tableCell, { color: Colors.primary }]}>{c.ctr}</Text>
              </View>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>Audience Demographics</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            {demographics.map((d, i) => (
              <View key={i} style={{ marginBottom: 10 }}>
                <View style={styles.summaryRow}>
                  <Text style={[styles.mutedText, { color: colors.textSecondary }]}>{d.age}</Text>
                  <Text style={[styles.mutedText, { color: colors.text }]}>{d.pct}%</Text>
                </View>
                <View style={[styles.progressTrack, { backgroundColor: colors.cardBorder }]}>
                  <View style={[styles.progressFill, { width: `${d.pct}%`, backgroundColor: Colors.primary }]} />
                </View>
              </View>
            ))}
          </View>

          <View style={styles.gridRow}>
            <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Text style={[styles.metricCardValue, { color: Colors.primary }]}>12.4%</Text>
              <Text style={[styles.mutedText, { color: colors.textMuted }]}>Engagement Rate</Text>
            </View>
            <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Text style={[styles.metricCardValue, { color: Colors.primary }]}>94</Text>
              <Text style={[styles.mutedText, { color: colors.textMuted }]}>Brand Lift Score</Text>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 12 }]}>Why Fantasy Royale Works</Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: Colors.primary }]}>3.2x</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Higher Engagement</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: Colors.primary }]}>5.8min</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Avg Session</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: Colors.primary }]}>92%</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Return Rate</Text>
              </View>
            </View>
          </View>

          <Pressable onPress={() => Alert.alert('Coming soon', 'Report export is coming soon.')} style={({ pressed }) => [styles.primaryButton, { opacity: pressed ? 0.7 : 1, marginHorizontal: 16, marginTop: 8 }]}>
            <Feather name="download" size={18} color="#000" style={{ marginRight: 8 }} />
            <Text style={styles.primaryButtonText}>Export Full Report</Text>
          </Pressable>
        </ScrollView>
      </>
    );
  };

  // === VIEW 10: MARKETING ASSETS ===
  const renderMarketing = () => {
    const categories = ['All Assets', 'Social Posts', 'Flyers', 'Banners', 'Videos'];
    const assets = [
      { name: 'Social Post - Contest Launch', category: 'Social Posts', gradient: [Colors.primary, '#3B82F6'] as [string, string] },
      { name: 'Social Post - Winner', category: 'Social Posts', gradient: ['#F97316', '#EF4444'] as [string, string] },
      { name: 'Event Flyer Template', category: 'Flyers', gradient: ['#8B5CF6', '#EC4899'] as [string, string] },
      { name: 'Bar Night Flyer', category: 'Flyers', gradient: ['#22C55E', Colors.primary] as [string, string] },
      { name: 'Web Banner 728x90', category: 'Banners', gradient: ['#3B82F6', '#6366F1'] as [string, string] },
      { name: 'Promo Video Intro', category: 'Videos', gradient: ['#EAB308', '#F97316'] as [string, string] },
    ];
    const filtered = marketingFilter === 'All Assets' ? assets : assets.filter(a => a.category === marketingFilter);

    return (
      <>
        {renderHeader('Marketing Assets', () => setView('dashboard'))}
        <ScrollView style={styles.scrollView} contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding + 20 }]} showsVerticalScrollIndicator={false}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
            {categories.map((c) => (
              <Pressable key={c} onPress={() => setMarketingFilter(c)} style={({ pressed }) => [styles.filterChip, { backgroundColor: marketingFilter === c ? Colors.primary : colors.card, borderColor: marketingFilter === c ? Colors.primary : colors.cardBorder, opacity: pressed ? 0.7 : 1 }]}>
                <Text style={[styles.filterChipText, { color: marketingFilter === c ? '#000' : colors.text }]}>{c}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={[styles.infoBanner, { backgroundColor: Colors.primary + '10', borderColor: Colors.primary + '30', marginHorizontal: 16 }]}>
            <Ionicons name="information-circle" size={18} color={Colors.primary} />
            <Text style={[styles.infoText, { color: Colors.primary }]}>Official Fantasy Royale marketing assets for your campaigns.</Text>
          </View>

          <View style={styles.templateGrid}>
            {filtered.map((a, i) => (
              <View key={i} style={[styles.templateCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <LinearGradient colors={a.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.templatePreview}>
                  <Ionicons name="image-outline" size={28} color="rgba(255,255,255,0.6)" />
                </LinearGradient>
                <Text style={[styles.templateName, { color: colors.text }]} numberOfLines={1}>{a.name}</Text>
                <Text style={[styles.mutedText, { color: colors.textMuted, fontSize: 11 }]}>{a.category}</Text>
                <Pressable onPress={() => Alert.alert('Downloaded!', `${a.name} has been downloaded.`)} style={({ pressed }) => [styles.smallButton, { backgroundColor: Colors.primary, opacity: pressed ? 0.7 : 1 }]}>
                  <Text style={styles.smallButtonText}>Download</Text>
                </Pressable>
              </View>
            ))}
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder, marginTop: 8 }]}>
            <Text style={[styles.contestName, { color: colors.text }]}>Need Custom Assets?</Text>
            <Text style={[styles.mutedText, { color: colors.textMuted, marginTop: 4, marginBottom: 12 }]}>Upgrade your tier for access to premium custom assets.</Text>
            <Pressable onPress={() => setView('tiers')} style={({ pressed }) => [styles.outlineButton, { borderColor: Colors.primary, opacity: pressed ? 0.7 : 1 }]}>
              <Text style={[styles.outlineButtonText, { color: Colors.primary }]}>View Pricing Tiers</Text>
            </Pressable>
          </View>
        </ScrollView>
      </>
    );
  };

  // === VIEW 11: SETTINGS ===
  const renderSettings = () => {
    const businessTypes = ['Restaurant/Bar', 'Retail', 'Sports Bar', 'Entertainment', 'Other'];
    const notificationLabels = ['Contest Entry Alerts', 'Weekly Reports', 'Prize Claims', 'Marketing Tips'];
    const teamMembers = [
      { name: 'John Smith', role: 'Owner' },
      { name: 'Sarah Johnson', role: 'Manager' },
    ];
    const integrations = [
      { name: 'Square POS', connected: true },
      { name: 'Mailchimp', connected: false },
      { name: 'Social Media', connected: false },
    ];

    return (
      <>
        {renderHeader('Settings', () => setView('dashboard'))}
        <ScrollView style={styles.scrollView} contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding + 20 }]} showsVerticalScrollIndicator={false}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Company Profile</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Company Name</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.cardBorder }]} value={settingsCompany} onChangeText={setSettingsCompany} placeholder="Your company name" placeholderTextColor={colors.textMuted} />

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Business Type</Text>
            <Pressable onPress={() => setBusinessTypeOpen(!businessTypeOpen)} style={[styles.input, { backgroundColor: colors.card, borderColor: colors.cardBorder, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const }]}>
              <Text style={{ color: colors.text, fontFamily: 'Inter_400Regular', fontSize: 14 }}>{settingsBusinessType}</Text>
              <Ionicons name={businessTypeOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
            </Pressable>
            {businessTypeOpen && (
              <View style={[styles.dropdownList, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                {businessTypes.map((bt) => (
                  <Pressable key={bt} onPress={() => { setSettingsBusinessType(bt); setBusinessTypeOpen(false); }} style={({ pressed }) => [styles.dropdownItem, { opacity: pressed ? 0.7 : 1, backgroundColor: settingsBusinessType === bt ? Colors.primary + '15' : 'transparent' }]}>
                    <Text style={[styles.dropdownText, { color: settingsBusinessType === bt ? Colors.primary : colors.text }]}>{bt}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>City</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.cardBorder }]} value={settingsCity} onChangeText={setSettingsCity} placeholder="City" placeholderTextColor={colors.textMuted} />

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>State</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.cardBorder }]} value={settingsState} onChangeText={setSettingsState} placeholder="State" placeholderTextColor={colors.textMuted} />
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>Brand Assets</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Logo</Text>
            <View style={[styles.uploadPlaceholder, { borderColor: colors.cardBorder }]}>
              <Ionicons name="cloud-upload-outline" size={32} color={colors.textMuted} />
              <Text style={[styles.mutedText, { color: colors.textMuted, marginTop: 8 }]}>Tap to upload logo</Text>
            </View>

            <Text style={[styles.inputLabel, { color: colors.textSecondary, marginTop: 16 }]}>Primary Brand Color</Text>
            <View style={styles.colorSwatches}>
              {BRAND_COLORS.map((c) => (
                <Pressable key={c} onPress={() => setSettingsBrandColor(c)} style={[styles.colorSwatch, { backgroundColor: c, borderWidth: settingsBrandColor === c ? 3 : 0, borderColor: '#fff' }]}>
                  {settingsBrandColor === c && <Ionicons name="checkmark" size={16} color="#fff" />}
                </Pressable>
              ))}
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>Billing & Payments</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.contestRow}>
              <Ionicons name="card" size={24} color={colors.text} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={[styles.contestName, { color: colors.text }]}>Visa ending in 4242</Text>
                <Text style={[styles.mutedText, { color: colors.textMuted }]}>Expires 12/28</Text>
              </View>
            </View>
            <Pressable onPress={() => Alert.alert('Coming soon', 'Payment method management is coming soon.')} style={({ pressed }) => [styles.outlineButton, { borderColor: Colors.primary, opacity: pressed ? 0.7 : 1, marginTop: 12 }]}>
              <Text style={[styles.outlineButtonText, { color: Colors.primary }]}>Add Payment Method</Text>
            </Pressable>
            <View style={[styles.summaryRow, { marginTop: 12 }]}>
              <Text style={[styles.mutedText, { color: colors.textMuted }]}>Current Plan</Text>
              <Text style={[styles.mutedText, { color: Colors.primary, fontFamily: 'Inter_600SemiBold' }]}>Office Royale</Text>
            </View>
            <Pressable onPress={() => Alert.alert('Coming soon', 'Billing history is coming soon.')} style={{ marginTop: 8 }}>
              <Text style={[styles.linkText, { color: Colors.primary }]}>View Billing History</Text>
            </Pressable>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>Notifications</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            {notificationLabels.map((label, i) => (
              <View key={i} style={[styles.notificationRow, i < notificationLabels.length - 1 ? { borderBottomWidth: 1, borderBottomColor: colors.cardBorder } : {}]}>
                <Text style={[styles.notificationLabel, { color: colors.text }]}>{label}</Text>
                <Pressable
                  onPress={() => { const n = [...settingsNotifications]; n[i] = !n[i]; setSettingsNotifications(n); }}
                  style={[styles.toggle, { backgroundColor: settingsNotifications[i] ? Colors.primary : colors.cardBorder }]}
                >
                  <View style={[styles.toggleThumb, { transform: [{ translateX: settingsNotifications[i] ? 20 : 2 }] }]} />
                </Pressable>
              </View>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>Team Members</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            {teamMembers.map((m, i) => (
              <View key={i} style={[styles.teamRow, i < teamMembers.length - 1 ? { borderBottomWidth: 1, borderBottomColor: colors.cardBorder } : {}]}>
                <View style={[styles.teamAvatar, { backgroundColor: Colors.primary + '20' }]}>
                  <Ionicons name="person" size={18} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.contestName, { color: colors.text, fontSize: 14 }]}>{m.name}</Text>
                  <Text style={[styles.mutedText, { color: colors.textMuted }]}>{m.role}</Text>
                </View>
              </View>
            ))}
            <Pressable onPress={() => Alert.alert('Coming soon', 'Team invitations are coming soon.')} style={({ pressed }) => [styles.outlineButton, { borderColor: Colors.primary, opacity: pressed ? 0.7 : 1, marginTop: 12 }]}>
              <Ionicons name="person-add" size={16} color={Colors.primary} style={{ marginRight: 6 }} />
              <Text style={[styles.outlineButtonText, { color: Colors.primary }]}>Invite Team Member</Text>
            </Pressable>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>Integrations</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            {integrations.map((integ, i) => (
              <View key={i} style={[styles.integrationRow, i < integrations.length - 1 ? { borderBottomWidth: 1, borderBottomColor: colors.cardBorder } : {}]}>
                <Text style={[styles.contestName, { color: colors.text, fontSize: 14, flex: 1 }]}>{integ.name}</Text>
                {integ.connected ? (
                  <View style={[styles.statusBadge, { backgroundColor: Colors.success + '20' }]}>
                    <View style={[styles.statusDot, { backgroundColor: Colors.success }]} />
                    <Text style={[styles.statusBadgeText, { color: Colors.success }]}>Connected</Text>
                  </View>
                ) : (
                  <Pressable onPress={() => Alert.alert('Coming soon', `${integ.name} integration is coming soon.`)} style={({ pressed }) => [styles.smallButton, { backgroundColor: Colors.primary, opacity: pressed ? 0.7 : 1 }]}>
                    <Text style={styles.smallButtonText}>Connect</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>

          <Pressable onPress={() => setView('dashboard')} style={({ pressed }) => [styles.outlineButton, { borderColor: Colors.error, opacity: pressed ? 0.7 : 1, marginHorizontal: 16, marginTop: 20 }]}>
            <Ionicons name="log-out-outline" size={18} color={Colors.error} style={{ marginRight: 6 }} />
            <Text style={[styles.outlineButtonText, { color: Colors.error }]}>Sign Out of Sponsor Hub</Text>
          </Pressable>
        </ScrollView>
      </>
    );
  };

  const renderAdminSponsorPicker = () => {
    const sponsors = adminSponsorsQuery.data || [];
    return (
      <>
        {renderHeader('Sponsor Hub — Admin', () => router.back())}
        <ScrollView style={styles.scrollView} contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding + 20 }]}>
          <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Ionicons name="shield-checkmark" size={20} color={Colors.primary} style={{ marginRight: 8 }} />
              <Text style={{ color: Colors.primary, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>Admin View</Text>
            </View>
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 4 }}>Select a Sponsor</Text>
            <Text style={{ color: colors.textMuted, fontSize: 14 }}>Choose a brand to view their sponsor portal</Text>
          </View>

          {adminSponsorsQuery.isLoading ? (
            <View style={styles.centerContent}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : sponsors.length === 0 ? (
            <View style={{ alignItems: 'center', marginTop: 60, paddingHorizontal: 32 }}>
              <Ionicons name="storefront-outline" size={48} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, fontSize: 16, textAlign: 'center', marginTop: 12 }}>No sponsors registered yet</Text>
              <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 4 }}>Add sponsors from the Admin Dashboard first</Text>
            </View>
          ) : (
            sponsors.map((sponsor: any) => {
              const statusColor = sponsor.status === 'approved' ? Colors.success : sponsor.status === 'pending' ? Colors.warning : sponsor.status === 'suspended' ? Colors.error : colors.textMuted;
              return (
                <Pressable
                  key={sponsor.id}
                  onPress={() => {
                    setAdminSelectedSponsorId(sponsor.id);
                    setView('dashboard');
                  }}
                  style={({ pressed }) => [{
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.cardBorder,
                    borderRadius: 12,
                    padding: 16,
                    marginHorizontal: 16,
                    marginBottom: 10,
                    opacity: pressed ? 0.7 : 1,
                  }]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: sponsor.brand_color || '#00D4AA', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                      <Ionicons name="storefront" size={18} color="#FFF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{sponsor.company_name}</Text>
                      {sponsor.business_type ? (
                        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 1 }}>{sponsor.business_type}</Text>
                      ) : null}
                    </View>
                    <View style={{ backgroundColor: statusColor + '22', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginRight: 8 }}>
                      <Text style={{ color: statusColor, fontSize: 11, fontWeight: '600', textTransform: 'uppercase' }}>{sponsor.status || 'pending'}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </View>
                  {sponsor.contact_email ? (
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginLeft: 48 }}>{sponsor.contact_email}</Text>
                  ) : null}
                  {(sponsor.city || sponsor.state) ? (
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginLeft: 48 }}>
                      {[sponsor.city, sponsor.state].filter(Boolean).join(', ')}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </>
    );
  };

  // === MAIN RENDER ===
  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AnimatedBackground />
        {renderHeader('Sponsor Hub')}
        {renderNotLoggedIn()}
      </View>
    );
  }

  if (isAdmin && !adminSelectedSponsorId && (adminSponsorsQuery.data || []).length > 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AnimatedBackground />
        {renderAdminSponsorPicker()}
      </View>
    );
  }

  if (isAdminViewing && adminPortalQuery.isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AnimatedBackground />
        {renderHeader('Sponsor Hub')}
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </View>
    );
  }

  if (false && !isAdmin && profileQuery.isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AnimatedBackground />
        {renderHeader('Sponsor Hub')}
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </View>
    );
  }

  if (false && isNotSponsor) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AnimatedBackground />
        {renderHeader('Sponsor Hub')}
        {renderAccessDenied()}
      </View>
    );
  }

  const renderCurrentView = () => {
    switch (view) {
      case 'dashboard': return renderDashboard();
      case 'tiers': return renderTiers();
      case 'wizard': return renderWizard();
      case 'sales': return renderSales();
      case 'success': return renderSuccess();
      case 'manage': return renderManage();
      case 'templates': return renderTemplates();
      case 'print-order': return renderPrintOrder();
      case 'analytics': return renderAnalytics();
      case 'marketing': return renderMarketing();
      case 'settings': return renderSettings();
      default: return renderDashboard();
    }
  };

  if (!isAdminViewing && isSuspended && profile) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AnimatedBackground />
        {renderHeader('Sponsor Hub')}
        {renderSuspended()}
      </View>
    );
  }

  if (!isAdminViewing && isPending && profile) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AnimatedBackground />
        {renderHeader('Sponsor Hub')}
        {renderPending()}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AnimatedBackground />
      {renderCurrentView()}
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
  scrollContent: {
    paddingTop: 8,
  },
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 10,
  },
  headerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    flex: 1,
    textAlign: 'center' as const,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 32,
  },
  centerTitle: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    marginTop: 16,
    textAlign: 'center' as const,
  },
  centerSub: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    marginTop: 8,
    textAlign: 'center' as const,
    lineHeight: 20,
  },
  formContainer: {
    padding: 16,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top' as const,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexDirection: 'row' as const,
  },
  primaryButtonText: {
    color: '#000',
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  outlineButton: {
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexDirection: 'row' as const,
  },
  outlineButtonText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  mutedText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  linkText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    textDecorationLine: 'underline' as const,
  },
  carouselSlide: {
    height: 140,
    justifyContent: 'center' as const,
    paddingHorizontal: 24,
  },
  carouselTitle: {
    color: '#fff',
    fontSize: 22,
    fontFamily: 'Inter_800ExtraBold',
  },
  carouselSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    marginTop: 4,
  },
  dotsRow: {
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    paddingVertical: 10,
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chartRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    justifyContent: 'space-between' as const,
    height: 120,
    paddingHorizontal: 4,
  },
  barCol: {
    flex: 1,
    alignItems: 'center' as const,
    marginHorizontal: 2,
  },
  barTrack: {
    width: '100%' as const,
    height: 100,
    justifyContent: 'flex-end' as const,
    borderRadius: 4,
    overflow: 'hidden' as const,
  },
  barFill: {
    width: '100%' as const,
    borderRadius: 4,
    minHeight: 4,
  },
  barDayLabel: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-around' as const,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.15)',
  },
  statItem: {
    alignItems: 'center' as const,
  },
  statValue: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    marginTop: 2,
  },
  gridRow: {
    flexDirection: 'row' as const,
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 10,
  },
  quickAction: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
  },
  quickActionLabel: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  contestRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  contestName: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  statusBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  tierAccent: {
    width: 4,
    height: '100%' as any,
    position: 'absolute' as const,
    left: 0,
    top: 0,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  tierName: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    marginLeft: 8,
  },
  tierPrice: {
    fontSize: 22,
    fontFamily: 'Inter_800ExtraBold',
    marginLeft: 8,
    marginTop: 4,
    marginBottom: 10,
  },
  featureRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginLeft: 8,
    marginBottom: 6,
  },
  featureText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  progressBar: {
    flexDirection: 'row' as const,
    gap: 4,
    marginHorizontal: 16,
    marginBottom: 20,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  audienceValue: {
    fontSize: 48,
    fontFamily: 'Inter_900Black',
    textAlign: 'center' as const,
  },
  sliderRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  sliderTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(128,128,128,0.2)',
    justifyContent: 'center' as const,
  },
  sliderFill: {
    height: 6,
    borderRadius: 3,
    position: 'absolute' as const,
  },
  sliderButtons: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 0,
  },
  sliderDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  sliderLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  sliderQuickButtons: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    marginTop: 16,
    justifyContent: 'center' as const,
  },
  chipButton: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  radioRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    paddingVertical: 10,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  radioLabel: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  uploadPlaceholder: {
    borderWidth: 2,
    borderStyle: 'dashed' as const,
    borderRadius: 12,
    height: 100,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: 4,
  },
  priceBreakdown: {
    padding: 16,
    borderTopWidth: 1,
  },
  priceRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 4,
  },
  priceLabel: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  priceValue: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  totalLabel: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  totalValue: {
    fontSize: 18,
    fontFamily: 'Inter_800ExtraBold',
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    flexDirection: 'row' as const,
  },
  salesBanner: {
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  salesBannerTitle: {
    fontSize: 22,
    fontFamily: 'Inter_800ExtraBold',
    color: '#000',
  },
  salesBannerSub: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: 'rgba(0,0,0,0.7)',
    marginTop: 4,
  },
  successTitle: {
    fontSize: 28,
    fontFamily: 'Inter_800ExtraBold',
    marginTop: 16,
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  summaryValue: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden' as const,
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
  },
  statusToggleRow: {
    flexDirection: 'row' as const,
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  statusToggle: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center' as const,
  },
  statusToggleText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  filterScroll: {
    marginBottom: 12,
  },
  filterContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  filterChipText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  infoBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    flex: 1,
  },
  templateGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    paddingHorizontal: 12,
    gap: 8,
  },
  templateCard: {
    width: (SCREEN_WIDTH - 40) / 2,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden' as const,
    marginBottom: 4,
  },
  templatePreview: {
    height: 100,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  templateName: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  smallButton: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignItems: 'center' as const,
    marginHorizontal: 10,
    marginVertical: 8,
  },
  smallButtonText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#000',
  },
  quantityControls: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  qtyButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  qtyValue: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    minWidth: 30,
    textAlign: 'center' as const,
  },
  roiValue: {
    fontSize: 40,
    fontFamily: 'Inter_900Black',
    marginTop: 4,
  },
  metricCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center' as const,
  },
  metricCardValue: {
    fontSize: 22,
    fontFamily: 'Inter_800ExtraBold',
    marginBottom: 4,
  },
  tableHeader: {
    flexDirection: 'row' as const,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  tableRow: {
    flexDirection: 'row' as const,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  tableCell: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  tableCellWide: {
    flex: 2,
  },
  colorSwatches: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 10,
    marginTop: 8,
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  dropdownList: {
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
    overflow: 'hidden' as const,
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dropdownText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  notificationRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 14,
  },
  notificationLabel: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    flex: 1,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center' as const,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  teamRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 12,
    gap: 12,
  },
  teamAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  integrationRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 12,
  },
});
