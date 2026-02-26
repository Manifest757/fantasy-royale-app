import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, FlatList, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { useGamification, AvatarPart, UserAvatar } from '@/contexts/GamificationContext';
import { Colors } from '@/constants/colors';
import { AnimatedBackground } from '@/components/AnimatedBackground';

const CATEGORIES = ['body', 'hair', 'eyebrows', 'eyes', 'mouth', 'shirt', 'jacket', 'pants', 'shoes', 'accessories'] as const;
const CATEGORY_LABELS: Record<string, string> = {
  body: 'Body',
  hair: 'Hair',
  eyebrows: 'Eyebrows',
  eyes: 'Eyes',
  mouth: 'Mouth',
  shirt: 'Shirt',
  jacket: 'Jacket',
  pants: 'Pants',
  shoes: 'Shoes',
  accessories: 'Accessories',
};

const AVATAR_RENDER_ORDER: (keyof import('@/contexts/GamificationContext').UserAvatar)[] = [
  'body', 'eyebrows', 'eyes', 'mouth', 'hair', 'shoes', 'pants', 'shirt', 'jacket', 'accessories',
];

const RARITY_COLORS = {
  common: '#9CA3AF',
  rare: '#3B82F6',
  epic: '#8B5CF6',
  legendary: '#F59E0B',
};

export default function CharacterScreen() {
  const { colors, isDark } = useTheme();
  const { crowns, avatarParts, ownedAvatarParts, avatar, setAvatarPart, purchaseAvatarPart, isItemUnlocked } = useGamification();
  const insets = useSafeAreaInsets();
  const [activeCategory, setActiveCategory] = useState<typeof CATEGORIES[number]>('body');

  const webTopPadding = Platform.OS === 'web' ? 67 : 0;
  const topPadding = insets.top || webTopPadding;

  const categoryParts = avatarParts.filter(p => p.category === activeCategory);

  const handleSelectPart = (part: AvatarPart) => {
    const isOwned = ownedAvatarParts.includes(part.id) || part.isDefault || part.price === 0;
    const unlocked = isItemUnlocked(part);

    if (!unlocked) return;

    if (isOwned) {
      setAvatarPart(activeCategory, part.id);
    } else {
      purchaseAvatarPart(part.id, part.price).then(success => {
        if (success) setAvatarPart(activeCategory, part.id);
      });
    }
  };

  const getPartStatus = (part: AvatarPart) => {
    if (avatar[activeCategory as keyof typeof avatar] === part.id) return 'selected';
    if (ownedAvatarParts.includes(part.id) || part.isDefault || part.price === 0) return 'owned';
    if (isItemUnlocked(part)) return 'purchasable';
    return 'locked';
  };

  const renderPart = ({ item }: { item: AvatarPart }) => {
    const status = getPartStatus(item);
    const isSelected = status === 'selected';
    const isLocked = status === 'locked';

    return (
      <Pressable
        onPress={() => handleSelectPart(item)}
        style={[
          styles.partCard,
          {
            backgroundColor: colors.card,
            borderColor: isSelected ? Colors.primary : colors.cardBorder,
            borderWidth: isSelected ? 2 : 1,
            opacity: isLocked ? 0.5 : 1,
          },
        ]}
      >
        <View style={[styles.partPreview, { backgroundColor: colors.cardBorder }]}>
          <Ionicons
            name={isLocked ? 'lock-closed' : 'person'}
            size={32}
            color={isLocked ? colors.textMuted : RARITY_COLORS[item.rarity]}
          />
        </View>
        <Text style={[styles.partName, { color: colors.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.partFooter}>
          {status === 'selected' && (
            <View style={[styles.selectedBadge, { backgroundColor: Colors.primary }]}>
              <Ionicons name="checkmark" size={10} color="#000" />
            </View>
          )}
          {status === 'owned' && !isSelected && (
            <Text style={[styles.ownedText, { color: Colors.success }]}>Owned</Text>
          )}
          {status === 'purchasable' && (
            <View style={styles.priceRow}>
              <MaterialCommunityIcons name="crown" size={12} color="#FFD700" />
              <Text style={styles.priceText}>{item.price}</Text>
            </View>
          )}
          {status === 'locked' && (
            <Text style={[styles.lockedText, { color: colors.textMuted }]}>Locked</Text>
          )}
        </View>
        <View style={[styles.rarityDot, { backgroundColor: RARITY_COLORS[item.rarity] }]} />
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AnimatedBackground />

      <View style={[styles.header, { paddingTop: topPadding + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Character Creator</Text>
        <View style={styles.crownsDisplay}>
          <MaterialCommunityIcons name="crown" size={16} color="#FFD700" />
          <Text style={styles.crownsText}>{crowns.toLocaleString()}</Text>
        </View>
      </View>

      <View style={[styles.previewCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.avatarPreview}>
          <View style={styles.avatarContainer}>
            {AVATAR_RENDER_ORDER.map((category, index) => {
              const partId = avatar[category];
              if (!partId) return null;
              const part = avatarParts.find(p => p.id === partId);
              if (!part?.image) return null;
              return (
                <Image
                  key={category}
                  source={{ uri: part.image }}
                  style={[styles.avatarLayer, { zIndex: index }]}
                  resizeMode="contain"
                />
              );
            })}
            {!AVATAR_RENDER_ORDER.some(cat => {
              const partId = avatar[cat];
              const part = partId ? avatarParts.find(p => p.id === partId) : null;
              return part?.image;
            }) && (
              <LinearGradient
                colors={['#4F46E5', '#7C3AED']}
                style={styles.avatarFallback}
              >
                <Ionicons name="person" size={80} color="#FFF" />
              </LinearGradient>
            )}
          </View>
        </View>
        <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>Your Avatar</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={styles.categoryContent}
      >
        {CATEGORIES.map(cat => (
          <Pressable
            key={cat}
            onPress={() => setActiveCategory(cat)}
            style={[
              styles.categoryTab,
              {
                backgroundColor: activeCategory === cat ? Colors.primary : colors.card,
                borderColor: activeCategory === cat ? Colors.primary : colors.cardBorder,
              },
            ]}
          >
            <Text
              style={[
                styles.categoryText,
                { color: activeCategory === cat ? '#000' : colors.text },
              ]}
            >
              {CATEGORY_LABELS[cat]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <FlatList
        data={categoryParts}
        renderItem={renderPart}
        keyExtractor={item => item.id}
        numColumns={3}
        contentContainerStyle={[styles.partsGrid, { paddingBottom: insets.bottom + 20 }]}
        columnWrapperStyle={styles.partsRow}
        showsVerticalScrollIndicator={false}
      />
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
  crownsDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  crownsText: {
    color: '#FFD700',
    fontSize: 13,
    fontWeight: '700',
  },
  previewCard: {
    marginHorizontal: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarPreview: {
    marginBottom: 8,
  },
  avatarContainer: {
    width: 160,
    height: 160,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 16,
  },
  avatarLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  categoryScroll: {
    maxHeight: 44,
    marginBottom: 16,
  },
  categoryContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryTab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  partsGrid: {
    paddingHorizontal: 16,
  },
  partsRow: {
    gap: 10,
    marginBottom: 10,
  },
  partCard: {
    flex: 1,
    maxWidth: '31%',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  partPreview: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  partName: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    marginBottom: 6,
  },
  partFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 18,
  },
  selectedBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownedText: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  priceText: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '600',
  },
  lockedText: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
  },
  rarityDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
