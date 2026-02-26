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
  notif_contest_reminders: true,
  notif_contest_results: true,
  notif_giveaway_alerts: true,
  notif_badge_awards: true,
  notif_streak_reminders: true,
  notif_crown_updates: true,
  notif_live_game_updates: true,
  notif_social_activity: false,
  notif_marketing_emails: false,
};

type PrefKey = keyof typeof defaultPrefs;

const sections = [
  {
    title: 'Contest Notifications',
    items: [
      { key: 'notif_contest_reminders' as PrefKey, label: 'Contest Reminders', desc: 'Get reminded before contests lock' },
      { key: 'notif_contest_results' as PrefKey, label: 'Contest Results', desc: 'Notified when contest results are in' },
      { key: 'notif_live_game_updates' as PrefKey, label: 'Live Game Updates', desc: 'Score updates and game alerts during live contests' },
    ],
  },
  {
    title: 'Rewards & Progress',
    items: [
      { key: 'notif_giveaway_alerts' as PrefKey, label: 'Giveaway Alerts', desc: 'Monthly giveaway updates and winners' },
      { key: 'notif_badge_awards' as PrefKey, label: 'Badge Awards', desc: 'When you earn a new badge' },
      { key: 'notif_streak_reminders' as PrefKey, label: 'Streak Reminders', desc: 'Reminders to maintain your streak' },
      { key: 'notif_crown_updates' as PrefKey, label: 'Crown Updates', desc: 'Crown balance changes and milestones' },
    ],
  },
  {
    title: 'Other',
    items: [
      { key: 'notif_social_activity' as PrefKey, label: 'Social Activity', desc: 'Likes, comments, and mentions' },
      { key: 'notif_marketing_emails' as PrefKey, label: 'Marketing Emails', desc: 'Promotions and feature announcements' },
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

export default function NotificationsSettingsScreen() {
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
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
  content: { paddingHorizontal: 16, paddingTop: 8 },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginBottom: 12, marginTop: 16 },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 8 },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  settingInfo: { flex: 1, marginRight: 12 },
  settingLabel: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  settingDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
});
