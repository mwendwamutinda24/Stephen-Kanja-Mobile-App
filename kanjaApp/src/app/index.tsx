import { useEffect } from 'react';
import { router } from 'expo-router';

import { type Role, useAuth } from '@/context/AuthContext';

// Every role lands on the HOI dashboard for now.
// Teachers use the same (hoi) group since we don't have a separate (teacher) folder yet.
const ROLE_ROUTES: Record<Role, string> = {
  hoi: '/(hoi)/dashboard',
  teacher: '/(hoi)/teachers',
  student: '/(students)/studentsDashboard',
};

export default function IndexScreen() {
  const { isLoading, token, role } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!token || !role) {
      router.replace('/(auth)/login');
      return;
    }

    const target = ROLE_ROUTES[role];
    if (!target) {
      router.replace('/(auth)/login');
      return;
    }

    router.replace(target as any);
  }, [isLoading, token, role]);

  return null;
}
