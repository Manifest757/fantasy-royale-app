import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product } from '@/data/mockData';

interface CartItem {
  product: Product;
  quantity: number;
  size?: string;
}

interface StoreContextValue {
  cart: CartItem[];
  favorites: string[];
  addToCart: (product: Product, size?: string) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  toggleFavorite: (productId: string) => void;
  isFavorite: (productId: string) => boolean;
  cartTotal: number;
  cartCount: number;
  crownsEarned: number;
}

const StoreContext = createContext<StoreContextValue | null>(null);

const CART_KEY = 'fantasy_royale_cart';
const FAVORITES_KEY = 'fantasy_royale_favorites';

export function StoreProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(CART_KEY),
      AsyncStorage.getItem(FAVORITES_KEY),
    ]).then(([cartData, favData]) => {
      if (cartData) setCart(JSON.parse(cartData));
      if (favData) setFavorites(JSON.parse(favData));
    });
  }, []);

  const saveCart = (newCart: CartItem[]) => {
    setCart(newCart);
    AsyncStorage.setItem(CART_KEY, JSON.stringify(newCart));
  };

  const saveFavorites = (newFavorites: string[]) => {
    setFavorites(newFavorites);
    AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
  };

  const addToCart = (product: Product, size?: string) => {
    const existing = cart.find(item => item.product.id === product.id);
    if (existing) {
      const newCart = cart.map(item =>
        item.product.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
      saveCart(newCart);
    } else {
      saveCart([...cart, { product, quantity: 1, size }]);
    }
  };

  const removeFromCart = (productId: string) => {
    saveCart(cart.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
    } else {
      saveCart(cart.map(item =>
        item.product.id === productId ? { ...item, quantity } : item
      ));
    }
  };

  const clearCart = () => {
    saveCart([]);
  };

  const toggleFavorite = (productId: string) => {
    if (favorites.includes(productId)) {
      saveFavorites(favorites.filter(id => id !== productId));
    } else {
      saveFavorites([...favorites, productId]);
    }
  };

  const isFavorite = (productId: string) => favorites.includes(productId);

  const cartTotal = useMemo(() => 
    cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [cart]
  );

  const cartCount = useMemo(() =>
    cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const crownsEarned = useMemo(() => Math.floor(cartTotal * 10), [cartTotal]);

  return (
    <StoreContext.Provider value={{
      cart,
      favorites,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      toggleFavorite,
      isFavorite,
      cartTotal,
      cartCount,
      crownsEarned,
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
}
