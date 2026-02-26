import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, Pressable, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/colors';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import { AppHeader } from '@/components/AppHeader';
import { NewsCard } from '@/components/NewsCard';
import { useNews } from '@/lib/supabase-data';

const platformNews = [
  {
    id: 'p1',
    title: 'Fantasy Royale reaches 1 million users!',
    description: 'Thank you to our amazing community for making this milestone possible.',
    timestamp: '1 day ago',
  },
  {
    id: 'p2',
    title: 'New Crown rewards system launching soon',
    description: 'Earn more Crowns with our revamped rewards program.',
    timestamp: '3 days ago',
  },
];

export default function NewsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { data: news = [], refetch, isRefetching } = useNews();
  
  const webTopPadding = Platform.OS === 'web' ? 67 : 0;
  const headerHeight = (insets.top || webTopPadding) + 56;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AnimatedBackground />
      <AppHeader />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingTop: headerHeight + 16, paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} colors={[Colors.primary]} />}
      >
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.text }]}>News</Text>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>SPORTS HEADLINES</Text>
          {news.map(item => (
            <NewsCard key={item.id} news={item} />
          ))}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>PLATFORM NEWS</Text>
          {platformNews.map(item => (
            <Pressable key={item.id} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}>
              <View style={[styles.platformCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <View style={styles.platformIcon}>
                  <Ionicons name="megaphone" size={20} color={Colors.primary} />
                </View>
                <View style={styles.platformContent}>
                  <Text style={[styles.platformTitle, { color: colors.text }]}>{item.title}</Text>
                  <Text style={[styles.platformDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                    {item.description}
                  </Text>
                  <Text style={[styles.platformTime, { color: colors.textMuted }]}>{item.timestamp}</Text>
                </View>
              </View>
            </Pressable>
          ))}
        </View>

        <Pressable style={({ pressed }) => [styles.talkLink, { opacity: pressed ? 0.9 : 1 }]}>
          <View style={[styles.talkCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.talkLeft}>
              <Ionicons name="play-circle" size={24} color={Colors.primary} />
              <View>
                <Text style={[styles.talkTitle, { color: colors.text }]}>Trash Talk</Text>
                <Text style={[styles.talkDesc, { color: colors.textSecondary }]}>
                  Watch predictions and celebrations
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </View>
        </Pressable>
      </ScrollView>
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
  content: {
    paddingHorizontal: 16,
    flexGrow: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFF',
    marginRight: 4,
  },
  liveText: {
    color: '#FFF',
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
    marginBottom: 12,
  },
  platformCard: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  platformIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(34, 211, 238, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  platformContent: {
    flex: 1,
  },
  platformTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 4,
  },
  platformDesc: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
    marginBottom: 6,
  },
  platformTime: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  talkLink: {
    marginBottom: 24,
  },
  talkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  talkLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  talkTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  talkDesc: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
});
