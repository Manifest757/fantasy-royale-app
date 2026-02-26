import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, Share, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/colors';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import { useUser } from '@/lib/supabase-data';
import { supabase } from '@/lib/supabase';
import { useCrownBalance, useStreak, useBadges, useGiveaway, getCurrentMonthKey, useUnreadNotificationCount, useGenerateReferralCode, useUserSummary, useNotifications, useMarkNotificationsRead, useDeleteNotifications } from '@/lib/gamification-api';
import { FlatList } from 'react-native';
import { queryClient } from '@/lib/query-client';

const settingsItems = [
  { icon: 'person-outline', label: 'Account Settings', route: '/account-settings' },
  { icon: 'notifications-outline', label: 'Notifications', route: '/notifications-settings' },
  { icon: 'shield-outline', label: 'Privacy', route: '/privacy-settings' },
  { icon: 'help-circle-outline', label: 'Help & Support', route: '/help-support' },
  { icon: 'document-text-outline', label: 'Terms of Service', route: '/terms-of-service' },
];

const STATUS_COLORS: Record<string, string> = {
  Squire: '#9CA3AF',
  Knight: '#3B82F6',
  Baron: '#8B5CF6',
  Duke: '#F59E0B',
  Royalty: '#EF4444',
};

function getStreakMilestone(current: number): string {
  if (current < 2) return 'Next: 2-week streak (+50 crowns)';
  if (current < 4) return 'Next: 4-week streak (+150 crowns)';
  if (current < 8) return 'Next: 8-week streak (+400 crowns)';
  return 'Milestone reached!';
}

function formatMonthName(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
}

function LoginScreen() {
  const { colors } = useTheme();
  const { signIn, signUp } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const webTopPadding = Platform.OS === 'web' ? 67 : 0;
  const topPadding = insets.top || webTopPadding;

  const handleSubmit = async () => {
    if (isForgotPassword) {
      if (!email.trim()) {
        setError('Please enter your email address');
        return;
      }
      setLoading(true);
      setError('');
      setSuccessMessage('');
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
        if (error) {
          setError(error.message);
        } else {
          setSuccessMessage('Password reset link sent! Check your email inbox.');
        }
      } catch (e: any) {
        setError(e.message || 'Something went wrong');
      } finally {
        setLoading(false);
      }
      return;
    }
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password');
      return;
    }
    setLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      const result = isSignUp
        ? await signUp(email.trim(), password)
        : await signIn(email.trim(), password);
      if (result.error) {
        setError(result.error.message);
      }
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AnimatedBackground />
      <View style={[styles.header, { paddingTop: topPadding + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {isForgotPassword ? 'Reset Password' : isSignUp ? 'Create Account' : 'Sign In'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.loginContent, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.loginIconContainer}>
            <LinearGradient
              colors={['#F97316', '#EF4444']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.loginIconGradient}
            >
              <MaterialCommunityIcons name="crown" size={48} color="#FFF" />
            </LinearGradient>
            <Text style={[styles.loginTitle, { color: colors.text }]}>Fantasy Royale</Text>
            <Text style={[styles.loginSubtitle, { color: colors.textMuted }]}>
              {isForgotPassword ? 'Enter your email and we\'ll send you a reset link' : isSignUp ? 'Create your account to get started' : 'Sign in to access your profile and settings'}
            </Text>
          </View>

          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={16} color="#FFF" />
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          ) : null}

          {successMessage ? (
            <View style={styles.successBanner}>
              <Ionicons name="checkmark-circle" size={16} color="#FFF" />
              <Text style={styles.successBannerText}>{successMessage}</Text>
            </View>
          ) : null}

          <View style={[styles.inputGroup, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.inputRow}>
              <Ionicons name="mail-outline" size={20} color={colors.textMuted} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Email"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                testID="login-email"
              />
            </View>
            {!isForgotPassword && (
              <>
                <View style={[styles.inputDivider, { backgroundColor: colors.cardBorder }]} />
                <View style={styles.inputRow}>
                  <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    placeholder="Password"
                    placeholderTextColor={colors.textMuted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    testID="login-password"
                  />
                  <Pressable onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
                  </Pressable>
                </View>
              </>
            )}
          </View>

          {!isSignUp && !isForgotPassword && (
            <Pressable onPress={() => { setIsForgotPassword(true); setError(''); setSuccessMessage(''); }} style={styles.forgotPassword} testID="forgot-password-link">
              <Text style={[styles.forgotPasswordText, { color: '#F97316' }]}>Forgot Password?</Text>
            </Pressable>
          )}

          <Pressable
            onPress={handleSubmit}
            disabled={loading}
            style={({ pressed }) => [styles.loginButton, pressed && { opacity: 0.8 }]}
            testID="login-submit"
          >
            <LinearGradient
              colors={['#F97316', '#EF4444']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.loginButtonGradient}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.loginButtonText}>
                  {isForgotPassword ? 'Send Reset Link' : isSignUp ? 'Create Account' : 'Sign In'}
                </Text>
              )}
            </LinearGradient>
          </Pressable>

          <Pressable onPress={() => { setIsForgotPassword(false); setIsSignUp(!isSignUp && !isForgotPassword); setError(''); setSuccessMessage(''); }} style={styles.switchAuth}>
            <Text style={[styles.switchAuthText, { color: colors.textMuted }]}>
              {isForgotPassword ? 'Back to ' : isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              <Text style={{ color: '#F97316', fontFamily: 'Inter_600SemiBold' }}>
                {isForgotPassword ? 'Sign In' : isSignUp ? 'Sign In' : 'Sign Up'}
              </Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

export default function ProfileScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const { session, signOut, isLoading: authLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const { data: user, isLoading: userLoading } = useUser();

  const { data: crownData, isLoading: crownLoading } = useCrownBalance();
  const { data: streakData, isLoading: streakLoading } = useStreak();
  const { data: badgesData, isLoading: badgesLoading } = useBadges();
  const currentMonth = getCurrentMonthKey();
  const { data: giveawayData } = useGiveaway(currentMonth);
  const { data: notifCountData } = useUnreadNotificationCount();
  const { data: summaryData } = useUserSummary();
  const generateReferral = useGenerateReferralCode();
  const unreadCount = notifCountData?.count ?? 0;
  
  const [showEloInfo, setShowEloInfo] = useState(false);
  const [showBadgesInfo, setShowBadgesInfo] = useState(false);
  const [showCrownsInfo, setShowCrownsInfo] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const { data: notifications = [], refetch: refetchNotifications } = useNotifications(50, false);
  const markRead = useMarkNotificationsRead();
  const deleteNotifs = useDeleteNotifications();

  const webTopPadding = Platform.OS === 'web' ? 67 : 0;
  const topPadding = insets.top || webTopPadding;

  const profileDataLoading = authLoading || userLoading || crownLoading || streakLoading || badgesLoading;

  if (profileDataLoading && session) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#F97316" />
      </View>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  const isAdmin = user?.is_admin || false;
  const displayCrowns = crownData?.total ?? user?.crowns ?? 0;
  const status = crownData?.status || 'Squire';
  const statusColor = STATUS_COLORS[status] || STATUS_COLORS.Squire;
  const currentStreak = streakData?.current ?? user?.currentStreak ?? 0;
  const bestStreak = streakData?.best ?? user?.bestStreak ?? 0;
  const entries = giveawayData?.entries ?? crownData?.total ?? displayCrowns;
  const rawBadges = Array.isArray(badgesData) ? badgesData : [];
  const badges = rawBadges
    .filter((b: any) => b.id && b.badge_id && b.badge_definitions)
    .map((b: any) => ({
      id: b.id,
      name: b.badge_definitions?.name || 'Badge',
      icon: b.badge_definitions?.icon_ref || b.badge_definitions?.icon_asset_ref || null,
      awarded_at: b.awarded_at,
    }));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AnimatedBackground />
      
      <View style={[styles.header, { paddingTop: topPadding + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileSection}>
          <Pressable onPress={() => router.push('/account-settings')} style={styles.avatarContainer}>
            <Image source={{ uri: (user?.avatar && user.avatar.length > 5) ? user.avatar : 'https://ui-avatars.com/api/?name=Player&background=6C63FF&color=fff&size=200&bold=true&format=png' }} style={styles.avatar} contentFit="cover" />
            <View style={styles.avatarBadge}>
              <MaterialCommunityIcons name="crown" size={14} color="#FFF" />
            </View>
            <View style={styles.avatarEditBadge}>
              <Ionicons name="camera" size={12} color="#FFF" />
            </View>
          </Pressable>
          <Text style={[styles.username, { color: colors.text }]}>{user?.username ?? ''}</Text>
          <Text style={[styles.memberSince, { color: colors.textSecondary }]}>
            Member since {user?.memberSince ?? ''}
          </Text>
        </View>

        <View style={[styles.crownsCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.crownsLeft}>
            <MaterialCommunityIcons name="crown" size={28} color="#FFD700" />
            <View>
              <Text style={[styles.crownsLabel, { color: colors.textMuted }]}>Crown Balance</Text>
              <Text style={[styles.crownsValue, { color: colors.text }]}>
                {displayCrowns.toLocaleString()}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                <Text style={styles.statusText}>{status}</Text>
              </View>
            </View>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Crown Status & Streak</Text>

        <View style={styles.streakRow}>
          <View style={[styles.streakCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Ionicons name="flame" size={24} color="#F97316" />
            <Text style={[styles.streakValue, { color: colors.text }]}>{currentStreak}</Text>
            <Text style={[styles.streakLabel, { color: colors.textMuted }]}>Weekly Streak</Text>
          </View>
          <View style={[styles.streakCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Ionicons name="trophy" size={24} color="#FFD700" />
            <Text style={[styles.streakValue, { color: colors.text }]}>{bestStreak}</Text>
            <Text style={[styles.streakLabel, { color: colors.textMuted }]}>Best Streak</Text>
          </View>
        </View>

        <Text style={[styles.streakMilestone, { color: colors.textSecondary }]}>
          {getStreakMilestone(currentStreak)}
        </Text>

        <View style={[styles.giveawaySection, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={[styles.giveawayTitle, { color: colors.text }]}>
            {formatMonthName(currentMonth)} Giveaway
          </Text>
          <Text style={[styles.giveawayEntries, { color: Colors.primary }]}>
            Your Entries: {typeof entries === 'number' ? entries.toLocaleString() : entries}
          </Text>
          <Text style={[styles.crownsLabel, { color: colors.textSecondary }]}>
            Every crown = one entry
          </Text>
          <Text style={[styles.giveawayNote, { color: colors.textMuted }]}>
            Crowns never expire
          </Text>
        </View>

        <View style={[styles.giveawaySection, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={[styles.giveawayTitle, { color: colors.text }]}>Referral Program</Text>
          <Text style={[styles.crownsLabel, { color: colors.textSecondary, marginBottom: 12 }]}>
            Invite friends and both earn crowns when they enter their first contest
          </Text>
          <Pressable
            onPress={async () => {
              try {
                const result = await generateReferral.mutateAsync();
                const code = result?.code || result?.referral_code;
                if (code) {
                  Share.share({ message: `Join Fantasy Royale with my referral code: ${code}` });
                }
              } catch (err: any) {
                if (err?.message?.includes('already')) {
                  Share.share({ message: `Join Fantasy Royale and use my referral code!` });
                }
              }
            }}
            style={[styles.statusBadge, { backgroundColor: Colors.primary, alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 10 }]}
          >
            <Text style={styles.statusText}>
              {generateReferral.isPending ? 'Generating...' : 'Share Referral Code'}
            </Text>
          </Pressable>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Badges</Text>

        <View style={styles.badgesSection}>
          {badges.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {badges.map((badge: any, index: number) => (
                <View key={badge.id ?? index} style={styles.badgeItem}>
                  <View style={[styles.badgeIcon, { backgroundColor: colors.card, borderColor: Colors.primary }]}>
                    {badge.icon ? (
                      <Image source={{ uri: badge.icon }} style={{ width: 32, height: 32 }} contentFit="contain" />
                    ) : (
                      <Ionicons name="star" size={24} color="#FFD700" />
                    )}
                  </View>
                  <Text style={[styles.badgeName, { color: colors.textSecondary }]} numberOfLines={2}>
                    {badge.name}
                  </Text>
                </View>
              ))}
            </ScrollView>
          ) : (
            <Text style={[styles.noBadges, { color: colors.textMuted }]}>No badges earned yet</Text>
          )}
        </View>

        {unreadCount > 0 && (
          <Pressable
            onPress={() => {
              setShowNotifications(true);
              refetchNotifications();
              const unreadIds = (notifications as any[]).filter((n: any) => !n.read_at).map((n: any) => n.id);
              if (unreadIds.length > 0) markRead.mutate(unreadIds);
            }}
            style={[styles.giveawaySection, { backgroundColor: colors.card, borderColor: colors.cardBorder, flexDirection: 'row', alignItems: 'center', gap: 12 }]}
          >
            <Ionicons name="notifications" size={24} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.giveawayTitle, { color: colors.text, fontSize: 15 }]}>
                {unreadCount} Unread Notification{unreadCount !== 1 ? 's' : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        )}

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Gamification Hub</Text>

        <View style={styles.gamificationGrid}>
          <Pressable
            onPress={() => router.push('/character')}
            style={({ pressed }) => [
              styles.gamificationCard,
              { backgroundColor: colors.card, borderColor: colors.cardBorder, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <LinearGradient
              colors={['rgba(139, 92, 246, 0.2)', 'rgba(79, 70, 229, 0.2)']}
              style={StyleSheet.absoluteFill}
            />
            <Ionicons name="person" size={32} color="#8B5CF6" />
            <Text style={[styles.gamificationLabel, { color: colors.text }]}>Character{'\n'}Creator</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/room-builder')}
            style={({ pressed }) => [
              styles.gamificationCard,
              { backgroundColor: colors.card, borderColor: colors.cardBorder, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <LinearGradient
              colors={['rgba(34, 211, 238, 0.2)', 'rgba(6, 182, 212, 0.2)']}
              style={StyleSheet.absoluteFill}
            />
            <Ionicons name="home" size={32} color={Colors.primary} />
            <Text style={[styles.gamificationLabel, { color: colors.text }]}>Room{'\n'}Builder</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/admin')}
            style={({ pressed }) => [
              styles.gamificationCard,
              { backgroundColor: colors.card, borderColor: colors.cardBorder, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <LinearGradient
              colors={['rgba(249, 115, 22, 0.2)', 'rgba(236, 72, 153, 0.2)']}
              style={StyleSheet.absoluteFill}
            />
            <Ionicons name="settings" size={32} color="#F97316" />
            <Text style={[styles.gamificationLabel, { color: colors.text }]}>Admin{'\n'}CMS</Text>
            {isAdmin && (
              <View style={styles.adminBadge}>
                <Text style={styles.adminBadgeText}>ON</Text>
              </View>
            )}
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.statNumber, { color: colors.text }]}>{user?.contestsEntered ?? 0}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Contests</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.statNumber, { color: colors.text }]}>{user?.wins ?? 0}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Wins</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.statNumber, { color: colors.text }]}>{currentStreak}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Streak</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <Pressable onPress={() => setShowCrownsInfo(true)} style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.statNumber, { color: colors.text }]}>{displayCrowns.toLocaleString()}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Crowns</Text>
            <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} style={{ position: 'absolute', top: 8, right: 8 }} />
          </Pressable>
          <Pressable onPress={() => setShowBadgesInfo(true)} style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.statNumber, { color: colors.text }]}>{Array.isArray(badges) ? badges.length : 0}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Badges</Text>
            <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} style={{ position: 'absolute', top: 8, right: 8 }} />
          </Pressable>
          <Pressable onPress={() => setShowEloInfo(true)} style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.statNumber, { color: colors.text }]}>{summaryData?.elo?.[0]?.elo ?? 1200}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>ELO</Text>
            <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} style={{ position: 'absolute', top: 8, right: 8 }} />
          </Pressable>
        </View>

        <View style={[styles.settingsSection, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Pressable
            onPress={toggleTheme}
            style={[styles.settingItem, { borderBottomColor: colors.cardBorder }]}
          >
            <View style={styles.settingLeft}>
              <Ionicons name={isDark ? 'moon-outline' : 'sunny-outline'} size={22} color={colors.text} />
              <Text style={[styles.settingLabel, { color: colors.text }]}>
                {isDark ? 'Dark Mode' : 'Light Mode'}
              </Text>
            </View>
            <View style={[styles.toggle, { backgroundColor: Colors.primary }]}>
              <View style={[styles.toggleKnob, isDark ? styles.toggleOn : styles.toggleOff]} />
            </View>
          </Pressable>

          {settingsItems.map((item, index) => (
            <Pressable
              key={item.label}
              onPress={() => item.route && router.push(item.route as any)}
              style={[
                styles.settingItem,
                index !== settingsItems.length - 1 && { borderBottomColor: colors.cardBorder, borderBottomWidth: 1 }
              ]}
            >
              <View style={styles.settingLeft}>
                <Ionicons name={item.icon as any} size={22} color={colors.text} />
                <Text style={[styles.settingLabel, { color: colors.text }]}>{item.label}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={async () => {
            try {
              await signOut();
              queryClient.clear();
              router.replace('/');
            } catch (e) {
              queryClient.clear();
              router.replace('/');
            }
          }}
          style={[styles.logoutButton, { borderColor: Colors.error }]}
        >
          <Feather name="log-out" size={18} color={Colors.error} />
          <Text style={[styles.logoutText, { color: Colors.error }]}>Log Out</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={showEloInfo} transparent animationType="fade" onRequestClose={() => setShowEloInfo(false)}>
        <Pressable onPress={() => setShowEloInfo(false)} style={infoModalStyles.overlay}>
          <Pressable onPress={e => e.stopPropagation()} style={[infoModalStyles.container, { backgroundColor: colors.card }]}>
            <View style={infoModalStyles.header}>
              <Ionicons name="analytics" size={28} color={Colors.primary} />
              <Text style={[infoModalStyles.title, { color: colors.text }]}>ELO Rating</Text>
              <Pressable onPress={() => setShowEloInfo(false)} hitSlop={12}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
              <Text style={[infoModalStyles.body, { color: colors.textSecondary }]}>
                Your ELO rating measures your skill at picking winners. Everyone starts at 0 and climbs through tiers as they make correct picks.
              </Text>
              <Text style={[infoModalStyles.subtitle, { color: colors.text }]}>How It Works</Text>
              <Text style={[infoModalStyles.body, { color: colors.textSecondary }]}>
                {'\u2022'} Each correct pick earns you +25 ELO points{'\n'}
                {'\u2022'} Incorrect picks have no penalty until you reach Champion tier{'\n'}
                {'\u2022'} At Champion level, wrong picks cost -15 ELO (but you can never drop below Champion threshold)
              </Text>
              <Text style={[infoModalStyles.subtitle, { color: colors.text }]}>Tiers</Text>
              <View style={infoModalStyles.tierRow}>
                <View style={[infoModalStyles.tierDot, { backgroundColor: '#9CA3AF' }]} />
                <Text style={[infoModalStyles.tierText, { color: colors.textSecondary }]}>Bronze — 0 ELO</Text>
              </View>
              <View style={infoModalStyles.tierRow}>
                <View style={[infoModalStyles.tierDot, { backgroundColor: '#C0C0C0' }]} />
                <Text style={[infoModalStyles.tierText, { color: colors.textSecondary }]}>Silver — 500 ELO</Text>
              </View>
              <View style={infoModalStyles.tierRow}>
                <View style={[infoModalStyles.tierDot, { backgroundColor: '#FFD700' }]} />
                <Text style={[infoModalStyles.tierText, { color: colors.textSecondary }]}>Gold — 1,500 ELO</Text>
              </View>
              <View style={infoModalStyles.tierRow}>
                <View style={[infoModalStyles.tierDot, { backgroundColor: '#EF4444' }]} />
                <Text style={[infoModalStyles.tierText, { color: colors.textSecondary }]}>Champion — 3,000 ELO</Text>
              </View>
              <Text style={[infoModalStyles.body, { color: colors.textSecondary, marginTop: 12 }]}>
                Your ELO is tracked per sport and season, so you can climb the ranks in NBA, NCAAB, and more independently.
              </Text>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showBadgesInfo} transparent animationType="fade" onRequestClose={() => setShowBadgesInfo(false)}>
        <Pressable onPress={() => setShowBadgesInfo(false)} style={infoModalStyles.overlay}>
          <Pressable onPress={e => e.stopPropagation()} style={[infoModalStyles.container, { backgroundColor: colors.card }]}>
            <View style={infoModalStyles.header}>
              <Ionicons name="ribbon" size={28} color="#FFD700" />
              <Text style={[infoModalStyles.title, { color: colors.text }]}>Badges</Text>
              <Pressable onPress={() => setShowBadgesInfo(false)} hitSlop={12}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
              <Text style={[infoModalStyles.body, { color: colors.textSecondary }]}>
                Badges are achievements you unlock by reaching milestones. Once earned, they're displayed on your profile forever.
              </Text>
              <Text style={[infoModalStyles.subtitle, { color: colors.text }]}>How to Earn Badges</Text>
              <Text style={[infoModalStyles.body, { color: colors.textSecondary }]}>
                {'\u2022'} Enter your first contest{'\n'}
                {'\u2022'} Win a contest (finish 1st place){'\n'}
                {'\u2022'} Build a weekly streak (2, 4, or 8 weeks){'\n'}
                {'\u2022'} Accumulate crown milestones{'\n'}
                {'\u2022'} Reach ELO tier thresholds (Silver, Gold, Champion){'\n'}
                {'\u2022'} Enter a certain number of contests (5, 10, 25, 50+){'\n'}
                {'\u2022'} Win a monthly giveaway{'\n'}
                {'\u2022'} Refer friends who enter their first contest
              </Text>
              <Text style={[infoModalStyles.subtitle, { color: colors.text }]}>Your Badges ({badges.length})</Text>
              {badges.length > 0 ? badges.map((b: any, i: number) => (
                <View key={b.id ?? i} style={infoModalStyles.badgeRow}>
                  {b.icon ? (
                    <Image source={{ uri: b.icon }} style={{ width: 24, height: 24 }} contentFit="contain" />
                  ) : (
                    <Ionicons name="star" size={20} color="#FFD700" />
                  )}
                  <Text style={[infoModalStyles.tierText, { color: colors.textSecondary }]}>{b.name}</Text>
                </View>
              )) : (
                <Text style={[infoModalStyles.body, { color: colors.textMuted, fontStyle: 'italic' }]}>
                  No badges earned yet. Enter a contest to get started!
                </Text>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showCrownsInfo} transparent animationType="fade" onRequestClose={() => setShowCrownsInfo(false)}>
        <Pressable onPress={() => setShowCrownsInfo(false)} style={infoModalStyles.overlay}>
          <Pressable onPress={e => e.stopPropagation()} style={[infoModalStyles.container, { backgroundColor: colors.card }]}>
            <View style={infoModalStyles.header}>
              <MaterialCommunityIcons name="crown" size={28} color="#FFD700" />
              <Text style={[infoModalStyles.title, { color: colors.text }]}>Crowns</Text>
              <Pressable onPress={() => setShowCrownsInfo(false)} hitSlop={12}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
              <Text style={[infoModalStyles.body, { color: colors.textSecondary }]}>
                Crowns are the currency of Fantasy Royale. They track your progress, determine your status tier, and each crown counts as one entry in the monthly giveaway.
              </Text>
              <Text style={[infoModalStyles.subtitle, { color: colors.text }]}>Ways to Earn Crowns</Text>
              <Text style={[infoModalStyles.body, { color: colors.textSecondary }]}>
                {'\u2022'} Enter a contest — earn 10 crowns per entry{'\n'}
                {'\u2022'} First contest ever — bonus 50 crowns{'\n'}
                {'\u2022'} Win a contest (1st place) — earn placement crowns{'\n'}
                {'\u2022'} Finish 2nd or 3rd — earn placement crowns{'\n'}
                {'\u2022'} Weekly streak milestones — 50 to 400+ bonus crowns{'\n'}
                {'\u2022'} Refer a friend — earn crowns when they enter their first contest
              </Text>
              <Text style={[infoModalStyles.subtitle, { color: colors.text }]}>Status Tiers</Text>
              <View style={infoModalStyles.tierRow}>
                <View style={[infoModalStyles.tierDot, { backgroundColor: '#9CA3AF' }]} />
                <Text style={[infoModalStyles.tierText, { color: colors.textSecondary }]}>Squire — Starting tier</Text>
              </View>
              <View style={infoModalStyles.tierRow}>
                <View style={[infoModalStyles.tierDot, { backgroundColor: '#3B82F6' }]} />
                <Text style={[infoModalStyles.tierText, { color: colors.textSecondary }]}>Knight — 500+ crowns</Text>
              </View>
              <View style={infoModalStyles.tierRow}>
                <View style={[infoModalStyles.tierDot, { backgroundColor: '#8B5CF6' }]} />
                <Text style={[infoModalStyles.tierText, { color: colors.textSecondary }]}>Baron — 2,000+ crowns</Text>
              </View>
              <View style={infoModalStyles.tierRow}>
                <View style={[infoModalStyles.tierDot, { backgroundColor: '#F59E0B' }]} />
                <Text style={[infoModalStyles.tierText, { color: colors.textSecondary }]}>Duke — 5,000+ crowns</Text>
              </View>
              <View style={infoModalStyles.tierRow}>
                <View style={[infoModalStyles.tierDot, { backgroundColor: '#EF4444' }]} />
                <Text style={[infoModalStyles.tierText, { color: colors.textSecondary }]}>Royalty — 10,000+ crowns</Text>
              </View>
              <Text style={[infoModalStyles.body, { color: colors.textSecondary, marginTop: 12 }]}>
                Crowns never expire and always count toward the monthly giveaway. The more you play, the more chances you have to win!
              </Text>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showNotifications} transparent animationType="slide" onRequestClose={() => setShowNotifications(false)}>
        <View style={[notifStyles.fullScreen, { backgroundColor: colors.background }]}>
          <View style={[notifStyles.header, { paddingTop: topPadding + 12, borderBottomColor: colors.cardBorder }]}>
            <Pressable onPress={() => setShowNotifications(false)} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
            <Text style={[notifStyles.headerTitle, { color: colors.text }]}>Notifications</Text>
            {(notifications as any[]).length > 0 && (
              <Pressable
                onPress={() => {
                  Alert.alert('Delete All', 'Remove all notifications?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete All', style: 'destructive', onPress: () => {
                      const allIds = (notifications as any[]).map((n: any) => n.id);
                      deleteNotifs.mutate(allIds);
                    }},
                  ]);
                }}
                hitSlop={12}
              >
                <Ionicons name="trash-outline" size={20} color={Colors.error} />
              </Pressable>
            )}
          </View>
          <FlatList
            data={notifications as any[]}
            keyExtractor={(item: any) => item.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingTop: 60 }}>
                <Ionicons name="notifications-off-outline" size={48} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted, fontSize: 15, fontFamily: 'Inter_500Medium', marginTop: 12 }}>No notifications yet</Text>
              </View>
            }
            renderItem={({ item }: { item: any }) => {
              const isUnread = !item.read_at;
              const iconName = item.type === 'BADGE_AWARD' ? 'ribbon' : item.type === 'CROWN_AWARD' ? 'trophy' : item.type === 'CONTEST_RESULT' ? 'podium' : item.type === 'STREAK' ? 'flame' : 'notifications';
              const iconColor = item.type === 'BADGE_AWARD' ? '#FFD700' : item.type === 'CROWN_AWARD' ? '#F59E0B' : item.type === 'CONTEST_RESULT' ? Colors.primary : item.type === 'STREAK' ? '#EF4444' : Colors.primary;
              const timeAgo = getTimeAgo(item.created_at);
              return (
                <View style={[notifStyles.card, { backgroundColor: isUnread ? (isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.06)') : colors.card, borderColor: colors.cardBorder }]}>
                  <View style={notifStyles.cardRow}>
                    <View style={[notifStyles.iconCircle, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}>
                      <Ionicons name={iconName as any} size={20} color={iconColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[notifStyles.cardTitle, { color: colors.text }]}>{item.title}</Text>
                      {item.body ? <Text style={[notifStyles.cardBody, { color: colors.textSecondary }]}>{item.body}</Text> : null}
                      <Text style={[notifStyles.cardTime, { color: colors.textMuted }]}>{timeAgo}</Text>
                    </View>
                    <Pressable
                      onPress={() => deleteNotifs.mutate([item.id])}
                      hitSlop={12}
                      style={{ padding: 4 }}
                    >
                      <Ionicons name="close-circle-outline" size={20} color={colors.textMuted} />
                    </Pressable>
                  </View>
                  {isUnread && <View style={notifStyles.unreadDot} />}
                </View>
              );
            }}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          />
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
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: Colors.primary,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#000',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFD700',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#000',
  },
  username: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    marginBottom: 4,
  },
  memberSince: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  crownsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  crownsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  crownsLabel: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  crownsValue: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFF',
  },
  streakRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  streakCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  streakValue: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
  },
  streakLabel: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    marginTop: 4,
  },
  streakMilestone: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    marginBottom: 24,
    textAlign: 'center',
  },
  giveawaySection: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  giveawayTitle: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    marginBottom: 8,
  },
  giveawayEntries: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    marginBottom: 4,
  },
  giveawayNote: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    marginTop: 8,
  },
  badgesSection: {
    marginBottom: 24,
  },
  badgeItem: {
    alignItems: 'center',
    marginRight: 16,
    width: 70,
  },
  badgeName: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    marginTop: 4,
  },
  badgeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  noBadges: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 12,
  },
  gamificationGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  gamificationCard: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 8,
  },
  gamificationLabel: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 16,
  },
  adminBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: Colors.success,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  adminBadgeText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  statNumber: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    textTransform: 'uppercase',
    marginTop: 4,
  },
  settingsSection: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 24,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingLabel: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    padding: 2,
    justifyContent: 'center',
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFF',
  },
  toggleOff: {
    alignSelf: 'flex-start',
  },
  toggleOn: {
    alignSelf: 'flex-end',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  logoutText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  loginContent: {
    paddingHorizontal: 24,
    paddingTop: 40,
    alignItems: 'center',
  },
  loginIconContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  loginIconGradient: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  loginTitle: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    marginBottom: 8,
  },
  loginSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.error,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
    width: '100%',
  },
  errorBannerText: {
    color: '#FFF',
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    flex: 1,
  },
  inputGroup: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    width: '100%',
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  inputDivider: {
    height: 1,
    width: '100%',
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
  },
  loginButton: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
  },
  loginButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  switchAuth: {
    paddingVertical: 8,
  },
  switchAuthText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: -8,
    marginBottom: 16,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#22C55E',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
    width: '100%',
  },
  successBannerText: {
    color: '#FFF',
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    flex: 1,
  },
});

const infoModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 380,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    flex: 1,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 16,
    marginBottom: 8,
  },
  body: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  tierDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  tierText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
});

function getTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const notifStyles = StyleSheet.create({
  fullScreen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    flex: 1,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    position: 'relative' as const,
    overflow: 'hidden' as const,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 2,
  },
  cardBody: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
    marginBottom: 4,
  },
  cardTime: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  unreadDot: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
});
