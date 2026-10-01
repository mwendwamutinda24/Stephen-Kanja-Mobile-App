import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { GraduationCap, IdCard, Lock } from 'lucide-react-native';

import  ThemedText  from '@/components/themed-text';
import { type Role, useAuth } from '@/context/AuthContext';

const ROLE_ROUTES: Record<Role, string> = {
  hoi: '/(hoi)/dashboard',
  teacher: '/teachers',
  student: '/studentsDashboard',
};

const NAVY = '#0F2A4A';
const NAVY_DARK = '#0A1F38';
const ACCENT = '#1E4E8C';

type LoginTab = 'student' | 'staff';

export default function LoginScreen() {
  const { login, role } = useAuth();
  const [tab, setTab] = useState<LoginTab>('student');
  const [identifier, setIdentifier] = useState('');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect once the context actually has a role — i.e. login succeeded
  // and api_sessions/me.php confirmed it. Reactive instead of trusting a
  // return value keeps this in sync with index.tsx's own redirect logic.
  useEffect(() => {
    if (role) {
      router.replace(ROLE_ROUTES[role] as any);
    }
  }, [role]);

  // Clear the fields (not just the error) when switching tabs — an
  // assessment number left sitting in the "Email Address" field would
  // just fail against the Teachers table with a confusing error.
  const handleTabChange = (nextTab: LoginTab) => {
    setTab(nextTab);
    setIdentifier('');
    setPasscode('');
    setError(null);
  };

  const handleSubmit = async () => {
    if (!identifier.trim() || !passcode) {
      setError(
        isStudent
          ? 'Enter your assessment number and password.'
          : 'Enter your email and TSC number.'
      );
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      // AuthContext.login posts these as { identifier, passcode } to
      // login.php, which tries the Student table first, then Teachers —
      // so the same call works regardless of which tab is active.
      await login(identifier.trim(), passcode.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isStudent = tab === 'student';

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.card}>
          <View style={styles.badgeCircle}>
            <GraduationCap color="#FFFFFF" size={30} />
          </View>

          <ThemedText style={styles.title}>School Portal</ThemedText>
          <ThemedText style={styles.subtitle}>STUDENT &amp; STAFF ACCESS</ThemedText>

          <View style={styles.tabRow}>
            <Pressable
              onPress={() => handleTabChange('student')}
              style={[styles.tabButton, isStudent && styles.tabButtonActive]}
            >
              <ThemedText style={[styles.tabText, isStudent && styles.tabTextActive]}>
                Student
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => handleTabChange('staff')}
              style={[styles.tabButton, !isStudent && styles.tabButtonActive]}
            >
              <ThemedText style={[styles.tabText, !isStudent && styles.tabTextActive]}>
                Teacher / Staff
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <ThemedText style={styles.dividerText}>SIGN IN</ThemedText>
            <View style={styles.dividerLine} />
          </View>

          <ThemedText style={styles.fieldLabel}>
            {isStudent ? 'ASSESSMENT NUMBER' : 'EMAIL ADDRESS'}
          </ThemedText>
          <View style={styles.inputRow}>
            <IdCard color="#8A8F98" size={18} />
            <TextInput
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={isStudent ? 'default' : 'email-address'}
              placeholder={isStudent ? 'Admission no.' : 'staff@school.ac.ke'}
              placeholderTextColor="#8A8F98"
              style={styles.input}
              editable={!isSubmitting}
              returnKeyType="next"
            />
          </View>
          <ThemedText style={styles.hint}>
            {isStudent
              ? 'Students: your Assessment Number.'
              : 'Teachers: the email address on file with the school.'}
          </ThemedText>

          <ThemedText style={[styles.fieldLabel, styles.fieldLabelSpaced]}>
            {isStudent ? 'PASSWORD' : 'TSC NUMBER'}
          </ThemedText>
          <View style={styles.inputRow}>
            <Lock color="#8A8F98" size={18} />
            <TextInput
              value={passcode}
              onChangeText={setPasscode}
              secureTextEntry={isStudent}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={isStudent ? '••••••••' : 'TSC number'}
              placeholderTextColor="#8A8F98"
              style={styles.input}
              editable={!isSubmitting}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
          </View>
          <ThemedText style={styles.hint}>
            {isStudent ? 'Students: your account password.' : 'Teachers: your TSC Number.'}
          </ThemedText>

          {error && <ThemedText style={styles.error}>{error}</ThemedText>}

          <Pressable
            onPress={handleSubmit}
            disabled={isSubmitting}
            style={({ pressed }) => [
              styles.button,
              (pressed || isSubmitting) && styles.buttonPressed,
            ]}
          >
            <ThemedText style={styles.buttonText}>
              {isSubmitting ? 'SIGNING IN…' : 'ACCESS PORTAL'}
            </ThemedText>
          </Pressable>

          <View style={styles.footerDivider} />
          <ThemedText style={styles.footer}>© 2026 Kelvin Mutinda. All rights reserved.</ThemedText>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: NAVY_DARK,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 410,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  badgeCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: NAVY,
  },
  subtitle: {
    fontSize: 11,
    letterSpacing: 1.2,
    color: '#8A8F98',
    marginTop: 4,
    marginBottom: 20,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#EEF1F6',
    borderRadius: 10,
    padding: 4,
    width: '100%',
    marginBottom: 18,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8A8F98',
  },
  tabTextActive: {
    color: NAVY,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 18,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#D8DCE3',
  },
  dividerText: {
    fontSize: 11,
    letterSpacing: 1,
    color: '#8A8F98',
  },
  fieldLabel: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: '#3A3F47',
    marginBottom: 6,
  },
  fieldLabelSpaced: {
    marginTop: 14,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    backgroundColor: '#EEF1F9',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#1A1D21',
  },
  hint: {
    alignSelf: 'flex-start',
    fontSize: 11,
    color: '#8A8F98',
    marginTop: 6,
  },
  error: {
    alignSelf: 'flex-start',
    fontSize: 12,
    color: '#E0524D',
    marginTop: 12,
  },
  button: {
    width: '100%',
    marginTop: 22,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  footerDivider: {
    width: '100%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#D8DCE3',
    marginTop: 20,
    marginBottom: 14,
  },
  footer: {
    fontSize: 11,
    color: '#8A8F98',
  },
});