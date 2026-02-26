import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, TextInput, ActivityIndicator, KeyboardAvoidingView, Animated, Easing } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/colors';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import { supabase } from '@/lib/supabase';

export default function AuthScreen() {
  const { colors } = useTheme();
  const { signIn, signUp } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const webTopPadding = Platform.OS === 'web' ? 67 : 0;
  const topPadding = insets.top || webTopPadding;

  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoGlow = useRef(new Animated.Value(0)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleTranslateY = useRef(new Animated.Value(15)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;
  const formTranslateY = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(logoGlow, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(subtitleOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(subtitleTranslateY, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(formOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(formTranslateY, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  const handleSubmit = async () => {
    if (isForgotPassword) {
      if (!email.trim()) {
        setError('Please enter your email address');
        return;
      }
      setLoading(true);
      setError('');
      setSuccessMessage('');
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
        if (error) {
          setError(error.message);
        } else {
          setSuccessMessage('Password reset link sent! Check your email inbox.');
        }
      } catch (e: any) {
        setError(e.message || 'Something went wrong');
      } finally {
        setLoading(false);
      }
      return;
    }
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password');
      return;
    }
    setLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      const result = isSignUp
        ? await signUp(email.trim(), password)
        : await signIn(email.trim(), password);
      if (result.error) {
        setError(result.error.message);
      }
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AnimatedBackground />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.loginContent, { paddingTop: topPadding + 60, paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.loginIconContainer}>
            <Animated.View style={{
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            }}>
              <Image
                source={{ uri: 'https://zfdrbwfvcccaouisqywp.supabase.co/storage/v1/object/public/avatars/app-assets/logo.png' }}
                style={styles.loginLogo}
                contentFit="contain"
              />
            </Animated.View>
            <Animated.Text style={[styles.loginSubtitle, {
              color: colors.textMuted,
              opacity: subtitleOpacity,
              transform: [{ translateY: subtitleTranslateY }],
            }]}>
              {isForgotPassword
                ? "Enter your email and we'll send you a reset link"
                : isSignUp
                  ? 'Create your account to get started'
                  : 'Sign in to start competing'}
            </Animated.Text>
          </View>

          <Animated.View style={{
            opacity: formOpacity,
            transform: [{ translateY: formTranslateY }],
            width: '100%',
            alignItems: 'center',
          }}>
            {error ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={16} color="#FFF" />
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            ) : null}

            {successMessage ? (
              <View style={styles.successBanner}>
                <Ionicons name="checkmark-circle" size={16} color="#FFF" />
                <Text style={styles.successBannerText}>{successMessage}</Text>
              </View>
            ) : null}

            <View style={[styles.inputGroup, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={styles.inputRow}>
                <Ionicons name="mail-outline" size={20} color={colors.textMuted} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Email"
                  placeholderTextColor={colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  testID="auth-email"
                />
              </View>
              {!isForgotPassword && (
                <>
                  <View style={[styles.inputDivider, { backgroundColor: colors.cardBorder }]} />
                  <View style={styles.inputRow}>
                    <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} />
                    <TextInput
                      style={[styles.input, { color: colors.text }]}
                      placeholder="Password"
                      placeholderTextColor={colors.textMuted}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      testID="auth-password"
                    />
                    <Pressable onPress={() => setShowPassword(!showPassword)}>
                      <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
                    </Pressable>
                  </View>
                </>
              )}
            </View>

            {!isSignUp && !isForgotPassword && (
              <Pressable onPress={() => { setIsForgotPassword(true); setError(''); setSuccessMessage(''); }} style={styles.forgotPassword}>
                <Text style={[styles.forgotPasswordText, { color: '#F97316' }]}>Forgot Password?</Text>
              </Pressable>
            )}

            <Pressable
              onPress={handleSubmit}
              disabled={loading}
              style={({ pressed }) => [styles.loginButton, pressed && { opacity: 0.8 }]}
              testID="auth-submit"
            >
              <LinearGradient
                colors={['#F97316', '#EF4444']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.loginButtonGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.loginButtonText}>
                    {isForgotPassword ? 'Send Reset Link' : isSignUp ? 'Create Account' : 'Sign In'}
                  </Text>
                )}
              </LinearGradient>
            </Pressable>

            <Pressable onPress={() => { setIsForgotPassword(false); setIsSignUp(!isSignUp && !isForgotPassword); setError(''); setSuccessMessage(''); }} style={styles.switchAuth}>
              <Text style={[styles.switchAuthText, { color: colors.textMuted }]}>
                {isForgotPassword ? 'Back to ' : isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                <Text style={{ color: '#F97316', fontFamily: 'Inter_600SemiBold' }}>
                  {isForgotPassword ? 'Sign In' : isSignUp ? 'Sign In' : 'Sign Up'}
                </Text>
              </Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  loginContent: {
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  loginIconContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  loginLogo: {
    width: 280,
    height: 110,
    marginBottom: 16,
  },
  loginSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.error,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
    width: '100%',
  },
  errorBannerText: {
    color: '#FFF',
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    flex: 1,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#22C55E',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
    width: '100%',
  },
  successBannerText: {
    color: '#FFF',
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    flex: 1,
  },
  inputGroup: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    width: '100%',
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  inputDivider: {
    height: 1,
    width: '100%',
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
  },
  loginButton: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
  },
  loginButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  switchAuth: {
    paddingVertical: 8,
  },
  switchAuthText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: -8,
    marginBottom: 16,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
});
