import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, Pressable, Platform, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { useStore } from '@/contexts/StoreContext';
import { Colors } from '@/constants/colors';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import { AppHeader } from '@/components/AppHeader';
import { ProductCard } from '@/components/ProductCard';
import { CartDrawer } from '@/components/CartDrawer';
import { useProducts } from '@/lib/supabase-data';

const categories = ['All', 'T-Shirts', 'Hats', 'Apparel'];

export default function MerchScreen() {
  const { colors } = useTheme();
  const { cartCount } = useStore();
  const insets = useSafeAreaInsets();
  const [activeCategory, setActiveCategory] = useState('All');
  const [cartVisible, setCartVisible] = useState(false);
  const { data: products = [], refetch, isRefetching } = useProducts();
  
  const webTopPadding = Platform.OS === 'web' ? 67 : 0;
  const headerHeight = (insets.top || webTopPadding) + 56;

  const filteredProducts = activeCategory === 'All'
    ? products
    : products.filter(p => p.category === activeCategory);

  const featuredProducts = products.filter(p => p.badge);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AnimatedBackground />
      <AppHeader />
      
      <View style={[styles.merchHeader, { top: headerHeight }]}>
        <View style={styles.merchTitleRow}>
          <View style={styles.merchTitleLeft}>
            <Ionicons name="bag" size={24} color={Colors.primary} />
            <Text style={[styles.merchTitle, { color: colors.text }]}>Merch</Text>
          </View>
          <Pressable
            onPress={() => setCartVisible(true)}
            style={({ pressed }) => [styles.cartButton, { opacity: pressed ? 0.8 : 1 }]}
          >
            <Ionicons name="cart-outline" size={24} color={colors.text} />
            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingTop: headerHeight + 60, paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} colors={[Colors.primary]} />}
      >
        <View style={[styles.crownsRewards, { borderColor: colors.cardBorder }]}>
          <LinearGradient
            colors={['rgba(34, 211, 238, 0.1)', 'rgba(168, 85, 247, 0.1)', 'rgba(249, 115, 22, 0.1)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <MaterialCommunityIcons name="crown" size={24} color={Colors.gradientEnd} />
          <Text style={[styles.crownsText, { color: colors.text }]}>Earn 10 Crowns per $1 spent!</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesRow}
        >
          {categories.map(cat => (
            <Pressable
              key={cat}
              onPress={() => setActiveCategory(cat)}
              style={[
                styles.categoryPill,
                {
                  backgroundColor: cat === activeCategory ? Colors.primary : colors.card,
                  borderColor: cat === activeCategory ? Colors.primary : colors.cardBorder,
                }
              ]}
            >
              <Text style={[
                styles.categoryText,
                { color: cat === activeCategory ? '#000' : colors.text }
              ]}>
                {cat}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {activeCategory === 'All' && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>FEATURED</Text>
            <FlatList
              horizontal
              data={featuredProducts}
              keyExtractor={item => item.id}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => <ProductCard product={item} compact />}
              contentContainerStyle={styles.featuredList}
            />
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
            {activeCategory === 'All' ? 'ALL PRODUCTS' : activeCategory.toUpperCase()}
          </Text>
          <View style={styles.productsGrid}>
            {filteredProducts.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </View>
        </View>
      </ScrollView>

      <CartDrawer visible={cartVisible} onClose={() => setCartVisible(false)} />
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
    flexGrow: 1,
  },
  merchHeader: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 50,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  merchTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  merchTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  merchTitle: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
  },
  cartButton: {
    position: 'relative',
    padding: 8,
  },
  cartBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: '#000',
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
  },
  crownsRewards: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  crownsText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  categoriesRow: {
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 24,
  },
  categoryPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  categoryText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  featuredList: {
    paddingHorizontal: 16,
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
  },
});
