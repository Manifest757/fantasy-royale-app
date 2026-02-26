import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, Switch, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useFocusEffect } from 'expo-router';

const defaultPrefs = {
  privacy_profile_public: true,
  privacy_show_contest_history: true,
  privacy_show_badges: true,
  privacy_show_streak: true,
  privacy_show_crown_status: false,
  privacy_show_in_leaderboards: true,
  privacy_allow_referrals: true,
};

type PrefKey = keyof typeof defaultPrefs;

const sections = [
  {
    title: 'Profile Visibility',
    items: [
      { key: 'privacy_profile_public' as PrefKey, label: 'Public Profile', desc: 'Allow other players to view your profile' },
      { key: 'privacy_show_contest_history' as PrefKey, label: 'Contest History', desc: 'Show your contest entries and results' },
      { key: 'privacy_show_badges' as PrefKey, label: 'Display Badges', desc: 'Show earned badges on your profile' },
      { key: 'privacy_show_streak' as PrefKey, label: 'Show Streak', desc: 'Display your current streak publicly' },
      { key: 'privacy_show_crown_status' as PrefKey, label: 'Show Crown Status', desc: 'Display your crown rank on your profile' },
    ],
  },
  {
    title: 'Activity & Engagement',
    items: [
      { key: 'privacy_show_in_leaderboards' as PrefKey, label: 'Appear in Leaderboards', desc: 'Show your name on public leaderboards' },
      { key: 'privacy_allow_referrals' as PrefKey, label: 'Allow Referrals', desc: 'Let others find you via referral codes' },
    ],
  },
];

const apiBase = process.env.EXPO_PUBLIC_DOMAIN ? 'https://' + process.env.EXPO_PUBLIC_DOMAIN : 'http://localhost:5000';

async function authFetch(url: string, options?: RequestInit) {
  const { data: { session: s } } = await supabase.auth.getSession();
  const token = s?.access_token;
  const res = await fetch(`${apiBase}${url}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options?.headers },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

export default function PrivacySettingsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [prefs, setPrefs] = useState(defaultPrefs);
  const [loading, setLoading] = useState(true);

  const webTopPadding = Platform.OS === 'web' ? 67 : 0;
  const topPadding = insets.top || webTopPadding;

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      authFetch('/api/me/preferences')
        .then(data => {
          const merged: any = { ...defaultPrefs };
          for (const k of Object.keys(defaultPrefs)) {
            if (typeof data[k] === 'boolean') merged[k] = data[k];
          }
          setPrefs(merged);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [])
  );

  const togglePref = async (key: PrefKey) => {
    const previous = { ...prefs };
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    try {
      await authFetch('/api/me/preferences', { method: 'PUT', body: JSON.stringify({ [key]: updated[key] }) });
    } catch {
      setPrefs(previous);
      const msg = 'Failed to save setting. Please try again.';
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert('Error', msg);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Privacy</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.introText, { color: colors.textSecondary }]}>
          Control what information is visible to other Fantasy Royale players.
        </Text>

        {sections.map(section => (
          <View key={section.title}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              {section.items.map((item, idx) => (
                <View
                  key={item.key}
                  style={[
                    styles.settingRow,
                    idx !== section.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.cardBorder },
                  ]}
                >
                  <View style={styles.settingInfo}>
                    <Text style={[styles.settingLabel, { color: colors.text }]}>{item.label}</Text>
                    <Text style={[styles.settingDesc, { color: colors.textMuted }]}>{item.desc}</Text>
                  </View>
                  <Switch
                    value={prefs[item.key]}
                    onValueChange={() => togglePref(item.key)}
                    trackColor={{ false: colors.cardBorder, true: Colors.primary }}
                    thumbColor="#FFF"
                  />
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  scrollView: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16 },
  introText: { fontSize: 13, fontFamily: 'Inter_400Regular', marginBottom: 16, lineHeight: 18 },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginBottom: 12, marginTop: 8 },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 8 },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  settingInfo: { flex: 1, marginRight: 12 },
  settingLabel: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  settingDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
});
