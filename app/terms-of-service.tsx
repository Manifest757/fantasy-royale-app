import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';

const sections = [
  {
    title: '1. Acceptance of Terms',
    body: 'By accessing or using the Fantasy Royale application ("App"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not use the App. We reserve the right to update these Terms at any time, and your continued use of the App after changes constitutes acceptance.',
  },
  {
    title: '2. Eligibility',
    body: 'You must be at least 18 years of age to use the App. By using the App, you represent and warrant that you meet this age requirement. Fantasy Royale contests are free to enter and do not constitute gambling or wagering.',
  },
  {
    title: '3. Account Registration',
    body: 'You must create an account to use certain features of the App. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to provide accurate and complete information during registration.',
  },
  {
    title: '4. Contests and Prizes',
    body: 'All contests on Fantasy Royale are free to enter and are sponsored by third-party partners. Prize availability, values, and distribution are determined by contest sponsors and are subject to change. Fantasy Royale reserves the right to modify, suspend, or cancel any contest at any time.',
  },
  {
    title: '5. Crown Economy',
    body: 'Crowns are virtual points earned through participation in contests, streaks, referrals, and other activities. Crowns have no monetary value and cannot be exchanged for cash. Crowns serve as entries into monthly giveaways and as currency for unlocking virtual items within the App.',
  },
  {
    title: '6. User Conduct',
    body: 'You agree not to: (a) use the App for any unlawful purpose; (b) create multiple accounts to gain unfair advantages; (c) attempt to manipulate contest outcomes; (d) harass, abuse, or harm other users; (e) reverse engineer or attempt to extract the source code of the App; (f) use automated systems or bots to interact with the App.',
  },
  {
    title: '7. Intellectual Property',
    body: 'All content, features, and functionality of the App, including but not limited to text, graphics, logos, icons, images, and software, are the property of Fantasy Royale or its licensors and are protected by copyright, trademark, and other intellectual property laws.',
  },
  {
    title: '8. Privacy Policy',
    body: 'Your use of the App is also governed by our Privacy Policy. We collect and process personal data including your email address, username, contest participation history, and app usage data. We do not sell your personal data to third parties. Data is stored securely using industry-standard encryption and access controls.',
  },
  {
    title: '9. Disclaimer of Warranties',
    body: 'The App is provided on an "as is" and "as available" basis without warranties of any kind, either express or implied. Fantasy Royale does not warrant that the App will be uninterrupted, error-free, or free of harmful components.',
  },
  {
    title: '10. Limitation of Liability',
    body: 'In no event shall Fantasy Royale be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or relating to your use of the App, whether based on warranty, contract, tort, or any other legal theory.',
  },
  {
    title: '11. Termination',
    body: 'We may terminate or suspend your account and access to the App at our sole discretion, without prior notice, for conduct that we determine violates these Terms or is harmful to other users, us, or third parties.',
  },
  {
    title: '12. Contact Information',
    body: 'If you have any questions about these Terms, please contact us at legal@fantasyroyale.com.',
  },
];

export default function TermsOfServiceScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const webTopPadding = Platform.OS === 'web' ? 67 : 0;
  const topPadding = insets.top || webTopPadding;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Terms of Service</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.lastUpdated, { color: colors.textMuted }]}>
          Last updated: February 2026
        </Text>

        {sections.map((section, index) => (
          <View key={index} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
            <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>{section.body}</Text>
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
  lastUpdated: { fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 20, textAlign: 'center' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', marginBottom: 8 },
  sectionBody: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 22 },
});
