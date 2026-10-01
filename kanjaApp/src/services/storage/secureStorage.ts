import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Cross-platform key/value storage:
// - Web: localStorage (SecureStore isn't available in a browser)
// - Native (iOS/Android): expo-secure-store

export async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return localStorage.getItem(key);
    } catch (err) {
      console.error(`secureStorage.getItem('${key}') failed on web:`, err);
      return null;
    }
  }

  try {
    return await SecureStore.getItemAsync(key);
  } catch (err) {
    console.error(`secureStorage.getItem('${key}') failed on native:`, err);
    return null;
  }
}

export async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      localStorage.setItem(key, value);
    } catch (err) {
      console.error(`secureStorage.setItem('${key}') failed on web:`, err);
    }
    return;
  }

  try {
    await SecureStore.setItemAsync(key, value);
  } catch (err) {
    console.error(`secureStorage.setItem('${key}') failed on native:`, err);
  }
}

export async function removeItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      localStorage.removeItem(key);
    } catch (err) {
      console.error(`secureStorage.removeItem('${key}') failed on web:`, err);
    }
    return;
  }

  try {
    await SecureStore.deleteItemAsync(key);
  } catch (err) {
    console.error(`secureStorage.removeItem('${key}') failed on native:`, err);
  }
}