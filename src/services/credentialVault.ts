/**
 * credentialVault.ts
 *
 * All sensitive credentials are stored exclusively in Android Keystore via
 * expo-secure-store. This module is the ONLY place in the codebase that
 * reads or writes credentials. Values must never be logged, stored in
 * React state, or placed in React Query cache keys.
 */

import * as SecureStore from 'expo-secure-store';
import { HomeAddress } from '@/types/models';
import { HomeAddressSchema } from '@/types/schemas';
import { requireBiometrics } from './biometrics';
import database from '@/db';
import AppSettings from '@/db/models/AppSettings';

// ─── Key helpers ──────────────────────────────────────────────────────────────

function storeUsernameKey(storeId: string): string {
  return `store_cred_${storeId}_username`;
}

function storePasswordKey(storeId: string): string {
  return `store_cred_${storeId}_password`;
}

const RESEND_API_KEY = 'app_resend_api_key';
const HOME_ADDRESS_KEY = 'app_home_address_full';

// ─── Biometric gate helper ────────────────────────────────────────────────────

async function isBiometricLockEnabled(): Promise<boolean> {
  try {
    const settings = await database
      .get<AppSettings>('app_settings')
      .find('singleton');
    return false; // Phase 2: biometric setting stored in SecureStore
  } catch {
    return false;
  }
}

async function gateWithBiometrics(): Promise<void> {
  const enabled = await isBiometricLockEnabled();
  if (enabled) {
    const passed = await requireBiometrics();
    if (!passed) {
      throw new Error('Biometric authentication failed or was cancelled.');
    }
  }
}

// ─── Store credentials ────────────────────────────────────────────────────────

export async function setStoreCredentials(
  storeId: string,
  username: string,
  password: string
): Promise<void> {
  await SecureStore.setItemAsync(storeUsernameKey(storeId), username);
  await SecureStore.setItemAsync(storePasswordKey(storeId), password);
}

export async function getStoreCredentials(
  storeId: string
): Promise<{ username: string; password: string } | null> {
  await gateWithBiometrics();
  const username = await SecureStore.getItemAsync(storeUsernameKey(storeId));
  const password = await SecureStore.getItemAsync(storePasswordKey(storeId));
  if (username === null || password === null) {
    return null;
  }
  return { username, password };
}

export async function deleteStoreCredentials(storeId: string): Promise<void> {
  await SecureStore.deleteItemAsync(storeUsernameKey(storeId));
  await SecureStore.deleteItemAsync(storePasswordKey(storeId));
}

export async function hasStoreCredentials(storeId: string): Promise<boolean> {
  const username = await SecureStore.getItemAsync(storeUsernameKey(storeId));
  return username !== null;
}

// ─── Resend API key ────────────────────────────────────────────────────────────

export async function setResendApiKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(RESEND_API_KEY, key);
}

export async function getResendApiKey(): Promise<string | null> {
  await gateWithBiometrics();
  return SecureStore.getItemAsync(RESEND_API_KEY);
}

export async function deleteResendApiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(RESEND_API_KEY);
}

export async function hasResendApiKey(): Promise<boolean> {
  const val = await SecureStore.getItemAsync(RESEND_API_KEY);
  return val !== null;
}

// ─── Home address ──────────────────────────────────────────────────────────────

export async function setHomeAddress(address: HomeAddress): Promise<void> {
  const validated = HomeAddressSchema.parse(address);
  await SecureStore.setItemAsync(HOME_ADDRESS_KEY, JSON.stringify(validated));
}

export async function getHomeAddress(): Promise<HomeAddress | null> {
  await gateWithBiometrics();
  const raw = await SecureStore.getItemAsync(HOME_ADDRESS_KEY);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return HomeAddressSchema.parse(parsed);
  } catch {
    return null;
  }
}

// ─── Clear all ────────────────────────────────────────────────────────────────

/**
 * Deletes the home address and Resend API key from secure store.
 * Store credentials must be cleared individually via deleteStoreCredentials.
 */
export async function clearNonStoreSecrets(): Promise<void> {
  await SecureStore.deleteItemAsync(RESEND_API_KEY);
  await SecureStore.deleteItemAsync(HOME_ADDRESS_KEY);
}
