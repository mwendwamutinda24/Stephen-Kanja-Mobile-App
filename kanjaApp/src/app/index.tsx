import { useEffect } from 'react';
import { router } from 'expo-router';

import { type Role, useAuth } from '@/context/AuthContext';

// Where each role lands after a successful redirect.
// Mirrors the Student → Teachers fallthrough your web login already does —
// the difference is the role comes back from /api/login.php or /api/me.php
// instead of being tried table-by-table here on the client.
const ROLE_ROUTES: Record<Role, string> = {
  hoi: '/(hoi)/dashboard',
  teacher: '/(teacher)/dashboard',
  student: '/(student)/dashboard',
};

export default function IndexScreen() {
  const { isLoading, token, role } = useAuth();

  useEffect(() => {
    if (isLoading) return; // still checking SecureStore for a saved token

    if (!token || !role) {
      router.replace('/(auth)/login');
      return;
    }

    router.replace(ROLE_ROUTES[role] as any);
  }, [isLoading, token, role]);

  // Nothing to render — this screen is just a redirect gate.
  return null;
}