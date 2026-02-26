import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/colors';
import Constants from 'expo-constants';

const faqs = [
  {
    question: 'How do I earn crowns?',
    answer: 'You earn crowns by entering contests, maintaining weekly streaks, winning contests, and through referral bonuses. Every crown also counts as an entry into the monthly giveaway.',
  },
  {
    question: 'What are the crown status tiers?',
    answer: 'There are 5 tiers: Squire (0+), Knight (500+), Baron (2,000+), Duke (5,000+), and Royalty (10,000+). Higher tiers unlock exclusive avatar parts and room items.',
  },
  {
    question: 'How do contests work?',
    answer: 'Select a contest, pick winners for each game matchup, and submit your picks before the contest locks. Points are awarded based on correct predictions. Top performers earn crowns and badges.',
  },
  {
    question: 'What is the monthly giveaway?',
    answer: 'Each month, your total crown balance serves as entries into the giveaway. More crowns = more entries = better chances of winning. Crowns are never deducted for giveaway entries.',
  },
  {
    question: 'How do streaks work?',
    answer: 'Enter at least one contest per week to maintain your streak. Streak milestones (2, 4, and 8 weeks) award bonus crowns. Missing a week resets your streak to zero.',
  },
  {
    question: 'Can I customize my avatar and room?',
    answer: 'Yes! Use the Character Creator to customize your avatar and the Room Builder to decorate your room. Some items are free, while others require crowns or achievements to unlock.',
  },
  {
    question: 'How do referrals work?',
    answer: 'Share your referral code with friends. When they sign up and enter their first contest, both of you receive bonus crowns. You can find your referral code on your profile page.',
  },
  {
    question: 'Are contests free to enter?',
    answer: 'Yes! All contests on Fantasy Royale are free to enter. Contests are sponsored, so you never have to pay to participate or win prizes.',
  },
];

export default function HelpSupportScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const webTopPadding = Platform.OS === 'web' ? 67 : 0;
  const topPadding = insets.top || webTopPadding;

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  const toggleFaq = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Help & Support</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Frequently Asked Questions</Text>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {faqs.map((faq, index) => (
            <Pressable
              key={index}
              onPress={() => toggleFaq(index)}
              style={[
                styles.faqItem,
                index !== faqs.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.cardBorder },
              ]}
            >
              <View style={styles.faqHeader}>
                <Text style={[styles.faqQuestion, { color: colors.text }]}>{faq.question}</Text>
                <Ionicons
                  name={expandedIndex === index ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.textMuted}
                />
              </View>
              {expandedIndex === index && (
                <Text style={[styles.faqAnswer, { color: colors.textSecondary }]}>{faq.answer}</Text>
              )}
            </Pressable>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}>Contact Us</Text>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Pressable
            onPress={() => Linking.openURL('mailto:support@fantasyroyale.com')}
            style={[styles.contactRow, { borderBottomWidth: 1, borderBottomColor: colors.cardBorder }]}
          >
            <View style={styles.contactLeft}>
              <Ionicons name="mail-outline" size={22} color={Colors.primary} />
              <View>
                <Text style={[styles.contactLabel, { color: colors.text }]}>Email Support</Text>
                <Text style={[styles.contactValue, { color: colors.textMuted }]}>support@fantasyroyale.com</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>

          <Pressable
            style={[styles.contactRow, { borderBottomWidth: 0 }]}
          >
            <View style={styles.contactLeft}>
              <Ionicons name="chatbubble-ellipses-outline" size={22} color={Colors.primary} />
              <View>
                <Text style={[styles.contactLabel, { color: colors.text }]}>In-App Chat</Text>
                <Text style={[styles.contactValue, { color: colors.textMuted }]}>Coming soon</Text>
              </View>
            </View>
          </Pressable>
        </View>

        <View style={[styles.appInfoCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={[styles.appInfoLabel, { color: colors.textMuted }]}>App Version</Text>
          <Text style={[styles.appInfoValue, { color: colors.text }]}>{appVersion}</Text>
        </View>
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
  sectionTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginBottom: 12 },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 8 },
  faqItem: { paddingHorizontal: 16, paddingVertical: 14 },
  faqHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  faqQuestion: { fontSize: 14, fontFamily: 'Inter_600SemiBold', flex: 1, marginRight: 8 },
  faqAnswer: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 10, lineHeight: 20 },
  contactRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  contactLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  contactLabel: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  contactValue: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  appInfoCard: {
    borderRadius: 16, borderWidth: 1, padding: 16, marginTop: 16,
    alignItems: 'center',
  },
  appInfoLabel: { fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 4 },
  appInfoValue: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});
