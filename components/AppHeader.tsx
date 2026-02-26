import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/colors';

export function AppHeader() {
  const { isDark, colors } = useTheme();
  const insets = useSafeAreaInsets();

  const webTopPadding = Platform.OS === 'web' ? 67 : 0;
  const topPadding = insets.top || webTopPadding;

  const handleSponsorPress = () => {
    router.push('/sponsor');
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={80}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.95)' }]} />
      )}
      <View style={styles.content}>
        <Pressable onPress={() => router.replace('/')} style={styles.logoContainer}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={styles.logo}
            contentFit="contain"
          />
        </Pressable>

        <View style={styles.rightSection}>
          <Pressable
            onPress={handleSponsorPress}
            style={({ pressed }) => [
              styles.sponsorButton,
              { 
                borderColor: colors.textSecondary,
                opacity: pressed ? 0.7 : 1 
              }
            ]}
          >
            <Feather name="link" size={12} color={colors.text} />
            <Text style={[styles.sponsorText, { color: colors.text }]}>Sponsor</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/profile')}
            style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.7 : 1 }]}
          >
            <MaterialCommunityIcons name="crown" size={22} color="#FFD700" />
          </Pressable>

          <Pressable
            onPress={() => router.push('/profile')}
            style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather name="user" size={20} color={Colors.primary} />
          </Pressable>
        </View>
      </View>
      <View style={[styles.border, { backgroundColor: colors.cardBorder }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 140,
    height: 40,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sponsorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  sponsorText: {
    fontSize: 10,
    fontWeight: '500',
  },
  border: {
    height: 1,
    width: '100%',
  },
});
