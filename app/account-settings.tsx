import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, TextInput, Alert, ActionSheetIOS, ActivityIndicator, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useGamification } from '@/contexts/GamificationContext';
import { useUser } from '@/lib/supabase-data';
import { useCrownBalance } from '@/lib/gamification-api';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { queryClient } from '@/lib/query-client';

const DEFAULT_AVATAR = 'https://ui-avatars.com/api/?name=Player&background=6C63FF&color=fff&size=200&bold=true&format=png';

export default function AccountSettingsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { session, signOut } = useAuth();
  const { data: user } = useUser();
  const { data: crownData } = useCrownBalance();
  const { avatar: gamificationAvatar, avatarParts } = useGamification();

  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showWebMenu, setShowWebMenu] = useState(false);

  const webTopPadding = Platform.OS === 'web' ? 67 : 0;
  const topPadding = insets.top || webTopPadding;

  const email = session?.user?.email ?? 'Not signed in';
  const username = user?.username ?? 'Player';
  const rawAvatar = user?.avatar ?? '';
  const avatar = rawAvatar && rawAvatar.length > 5 ? rawAvatar : DEFAULT_AVATAR;
  const memberSince = user?.memberSince ?? '';
  const status = crownData?.status || 'Squire';

  const authFetch = async (url: string, options?: RequestInit) => {
    const { data: { session: s } } = await supabase.auth.getSession();
    const token = s?.access_token;
    const res = await fetch(`${process.env.EXPO_PUBLIC_DOMAIN ? 'https://' + process.env.EXPO_PUBLIC_DOMAIN : 'http://localhost:5000'}${url}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options?.headers },
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
    return json;
  };

  const handlePickPhoto = async () => {
    setShowWebMenu(false);

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      const msg = 'Permission to access photos is required to upload a profile picture.';
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert('Permission Denied', msg);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
      base64: true,
    });

    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      let base64Data = asset.base64;

      if (!base64Data && Platform.OS === 'web' && asset.uri) {
        try {
          const response = await fetch(asset.uri);
          const blob = await response.blob();
          base64Data = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const dataUrl = reader.result as string;
              resolve(dataUrl.split(',')[1]);
            };
            reader.readAsDataURL(blob);
          });
        } catch {
          const msg = 'Could not read the selected image. Please try a different photo.';
          if (Platform.OS === 'web') alert(msg);
          else Alert.alert('Error', msg);
          return;
        }
      }

      if (!base64Data) {
        const msg = 'Could not process the selected image. Please try again.';
        if (Platform.OS === 'web') alert(msg);
        else Alert.alert('Error', msg);
        return;
      }

      setIsUploading(true);
      try {
        const uploadResult = await authFetch('/api/me/avatar-upload', {
          method: 'POST',
          body: JSON.stringify({ type: 'photo', base64: base64Data }),
        });
        if (uploadResult.error) throw new Error(uploadResult.error);
        await Promise.all([
          queryClient.refetchQueries({ queryKey: ['user'] }),
          queryClient.refetchQueries({ queryKey: ['user-summary'] }),
        ]);
      } catch (err: any) {
        const msg = err?.message || 'Failed to upload photo. Please try again.';
        if (Platform.OS === 'web') alert(msg);
        else Alert.alert('Upload Error', msg);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleUseAvatar = async () => {
    setShowWebMenu(false);

    const bodyPartId = gamificationAvatar.body;
    const bodyPart = avatarParts.find(p => p.id === bodyPartId);

    if (!bodyPart || !bodyPart.image) {
      const msg = 'Create an avatar first in Character Creator';
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert('No Avatar', msg);
      return;
    }

    setIsUploading(true);
    try {
      const uploadResult = await authFetch('/api/me/avatar-upload', {
        method: 'POST',
        body: JSON.stringify({ type: 'avatar', avatarUrl: bodyPart.image }),
      });
      if (uploadResult.error) throw new Error(uploadResult.error);
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['user'] }),
        queryClient.refetchQueries({ queryKey: ['user-summary'] }),
      ]);
    } catch (err: any) {
      const msg = err?.message || 'Failed to set avatar. Please try again.';
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert('Error', msg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAvatarPress = () => {
    if (isUploading) return;

    if (Platform.OS === 'web') {
      setShowWebMenu(true);
      return;
    }

    const options = ['Choose from Photos', 'Use Character Avatar', 'Cancel'];
    const cancelButtonIndex = 2;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex },
        (buttonIndex) => {
          if (buttonIndex === 0) handlePickPhoto();
          else if (buttonIndex === 1) handleUseAvatar();
        }
      );
    } else {
      Alert.alert('Change Profile Photo', 'Choose an option', [
        { text: 'Choose from Photos', onPress: handlePickPhoto },
        { text: 'Use Character Avatar', onPress: handleUseAvatar },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const handleSaveUsername = async () => {
    if (!newUsername.trim() || !session?.user?.id) return;
    setIsSaving(true);
    try {
      const result = await authFetch('/api/me/profile', {
        method: 'PUT',
        body: JSON.stringify({ username: newUsername.trim() }),
      });
      if (result.error) throw new Error(result.error);
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['user'] }),
        queryClient.refetchQueries({ queryKey: ['user-summary'] }),
      ]);
      setIsEditingUsername(false);
      setNewUsername('');
    } catch (err: any) {
      const msg = err?.message || 'Failed to update username. Please try again.';
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert('Error', msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    const doSignOut = async () => {
      try {
        await signOut();
        queryClient.clear();
        router.replace('/');
      } catch (e) {
        queryClient.clear();
        router.replace('/');
      }
    };
    if (Platform.OS === 'web') {
      if (confirm('Are you sure you want to log out?')) doSignOut();
    } else {
      Alert.alert('Log Out', 'Are you sure you want to log out?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', style: 'destructive', onPress: doSignOut },
      ]);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Account Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.avatarSection}>
          <Pressable
            onPress={handleAvatarPress}
            style={({ pressed }) => [
              styles.avatarWrapper,
              Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
              pressed && styles.avatarPressed,
            ]}
            testID="avatar-press"
          >
            <Image
              source={{ uri: avatar }}
              style={styles.avatar}
              contentFit="cover"
              placeholder={DEFAULT_AVATAR}
              transition={200}
            />
            {isUploading ? (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator size="small" color="#FFF" />
              </View>
            ) : (
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={14} color="#FFF" />
              </View>
            )}
          </Pressable>
          <Text style={[styles.avatarHint, { color: colors.textMuted }]}>
            {Platform.OS === 'web' ? 'Click to change profile photo' : 'Tap to change profile photo'}
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={[styles.fieldRow, { borderBottomColor: colors.cardBorder }]}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Email</Text>
            <Text style={[styles.fieldValue, { color: colors.text }]}>{email}</Text>
          </View>

          <View style={[styles.fieldRow, { borderBottomColor: colors.cardBorder }]}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Username</Text>
            {isEditingUsername ? (
              <View style={styles.editRow}>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.cardBorder }]}
                  value={newUsername}
                  onChangeText={setNewUsername}
                  placeholder={username}
                  placeholderTextColor={colors.textMuted}
                  autoFocus
                />
                <Pressable onPress={handleSaveUsername} disabled={isSaving} style={[styles.saveBtn, { backgroundColor: Colors.primary }]}>
                  <Text style={styles.saveBtnText}>{isSaving ? '...' : 'Save'}</Text>
                </Pressable>
                <Pressable onPress={() => { setIsEditingUsername(false); setNewUsername(''); }}>
                  <Ionicons name="close" size={20} color={colors.textMuted} />
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => { setIsEditingUsername(true); setNewUsername(username); }} style={styles.editableRow}>
                <Text style={[styles.fieldValue, { color: colors.text }]}>{username}</Text>
                <Ionicons name="pencil" size={16} color={Colors.primary} />
              </Pressable>
            )}
          </View>

          <View style={[styles.fieldRow, { borderBottomColor: colors.cardBorder }]}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Crown Status</Text>
            <Text style={[styles.fieldValue, { color: colors.text }]}>{status}</Text>
          </View>

          <View style={[styles.fieldRow, { borderBottomWidth: 0 }]}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Member Since</Text>
            <Text style={[styles.fieldValue, { color: colors.text }]}>{memberSince}</Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Account Actions</Text>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Pressable onPress={handleSignOut} style={[styles.actionRow, { borderBottomWidth: 0 }]}>
            <View style={styles.actionLeft}>
              <Ionicons name="log-out-outline" size={22} color={Colors.error} />
              <Text style={[styles.actionLabel, { color: Colors.error }]}>Log Out</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      </ScrollView>

      {Platform.OS === 'web' && showWebMenu && (
        <Modal transparent animationType="fade" visible={showWebMenu} onRequestClose={() => setShowWebMenu(false)}>
          <Pressable style={styles.webMenuBackdrop} onPress={() => setShowWebMenu(false)}>
            <View style={[styles.webMenuContainer, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Text style={[styles.webMenuTitle, { color: colors.text }]}>Change Profile Photo</Text>
              <Pressable
                onPress={handlePickPhoto}
                style={({ pressed }) => [styles.webMenuItem, pressed && { backgroundColor: colors.cardBorder }]}
              >
                <Ionicons name="image-outline" size={22} color={Colors.primary} />
                <Text style={[styles.webMenuLabel, { color: colors.text }]}>Choose from Photos</Text>
              </Pressable>
              <Pressable
                onPress={handleUseAvatar}
                style={({ pressed }) => [styles.webMenuItem, pressed && { backgroundColor: colors.cardBorder }]}
              >
                <Ionicons name="person-outline" size={22} color={Colors.primary} />
                <Text style={[styles.webMenuLabel, { color: colors.text }]}>Use Character Avatar</Text>
              </Pressable>
              <Pressable
                onPress={() => setShowWebMenu(false)}
                style={({ pressed }) => [styles.webMenuCancel, pressed && { backgroundColor: colors.cardBorder }]}
              >
                <Text style={[styles.webMenuCancelText, { color: colors.textMuted }]}>Cancel</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      )}
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
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatarWrapper: { position: 'relative' as const },
  avatarPressed: { opacity: 0.7 },
  avatar: {
    width: 100, height: 100, borderRadius: 50, borderWidth: 3,
    borderColor: Colors.primary, marginBottom: 8, backgroundColor: '#2A2A3E',
  },
  avatarOverlay: {
    position: 'absolute' as const, top: 0, left: 0, width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute' as const, bottom: 6, right: -2,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#000',
  },
  avatarHint: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 4 },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 24 },
  fieldRow: {
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  fieldLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', marginBottom: 4 },
  fieldValue: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  editableRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1, fontSize: 15, fontFamily: 'Inter_500Medium',
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  saveBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  saveBtnText: { color: '#FFF', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginBottom: 12 },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  actionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actionLabel: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  webMenuBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  webMenuContainer: {
    width: 300, borderRadius: 16, borderWidth: 1,
    overflow: 'hidden', paddingVertical: 8,
  },
  webMenuTitle: {
    fontSize: 16, fontFamily: 'Inter_600SemiBold',
    textAlign: 'center', paddingVertical: 12, paddingHorizontal: 16,
  },
  webMenuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 14,
  },
  webMenuLabel: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  webMenuCancel: {
    paddingVertical: 14, alignItems: 'center',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', marginTop: 4,
  },
  webMenuCancelText: { fontSize: 15, fontFamily: 'Inter_500Medium' },
});
