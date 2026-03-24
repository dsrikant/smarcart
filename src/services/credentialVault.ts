/**
 * credentialVault.ts
 *
 * All sensitive credentials are stored exclusively in Android Keystore via
 * expo-secure-store. This module is the ONLY place in the codebase that
 * reads or writes credentials. Values must never be logged, stored in
 * React state, or placed in React Query cache keys.
 */

import * as SecureStore from 'expo-secure-store';
import { requireBiometrics } from './biometrics';
import { VaultError, StoreCredentials, SessionCookieResult } from '@/types/credentials';
import database from '@/db';
import Store from '@/db/models/Store';

export { VaultError } from '@/types/credentials';
export type { StoreCredentials, SessionCookieResult } from '@/types/credentials';

// ─── Key helpers ──────────────────────────────────────────────────────────────

function storeUsernameKey(storeId: string): string {
  return `store_cred_${storeId}_username`;
}

function storePasswordKey(storeId: string): string {
  return `store_cred_${storeId}_password`;
}

function storeSessionCookieKey(storeId: string): string {
  return `store_cred_${storeId}_sessionCookie`;
}

const RESEND_API_KEY = 'app_resend_api_key';
const SMTP_CONFIG_KEY = 'app_smtp_config';

// Extra app-level key added beyond spec (documented in ASSUMPTIONS.md)
const HOME_ADDRESS_KEY = 'app_home_address_full';

// ─── Store credentials ────────────────────────────────────────────────────────

/**
 * Store a credential. Overwrites silently if key exists.
 * Requires biometric auth.
 */
export async function setStoreCredentials(
  storeId: string,
  username: string,
  password: string,
): Promise<void> {
  await requireBiometrics('Authenticate to save credentials');
  try {
    await SecureStore.setItemAsync(storeUsernameKey(storeId), username);
    await SecureStore.setItemAsync(storePasswordKey(storeId), password);
  } catch (e) {
    throw new VaultError('setStoreCredentials', storeId, `Failed to store credentials: ${String(e)}`);
  }
}

/**
 * Retrieve credentials. Returns null if not found (not an error).
 * Requires biometric auth.
 */
export async function getStoreCredentials(
  storeId: string,
): Promise<StoreCredentials | null> {
  await requireBiometrics('Authenticate to access credentials');
  try {
    const username = await SecureStore.getItemAsync(storeUsernameKey(storeId));
    const password = await SecureStore.getItemAsync(storePasswordKey(storeId));
    if (username === null || password === null) {
      return null;
    }
    return { username, password };
  } catch (e) {
    throw new VaultError('getStoreCredentials', storeId, `Failed to read credentials: ${String(e)}`);
  }
}

/**
 * Delete all credentials for a store (called on store deletion).
 */
export async function deleteStoreCredentials(storeId: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(storeUsernameKey(storeId));
    await SecureStore.deleteItemAsync(storePasswordKey(storeId));
    await SecureStore.deleteItemAsync(storeSessionCookieKey(storeId));
  } catch (e) {
    throw new VaultError('deleteStoreCredentials', storeId, `Failed to delete credentials: ${String(e)}`);
  }
}

/**
 * Check whether credentials exist for a store without retrieving them.
 * Does NOT require biometric auth (safe to call for UI state checks).
 */
export async function hasStoreCredentials(storeId: string): Promise<boolean> {
  const username = await SecureStore.getItemAsync(storeUsernameKey(storeId));
  return username !== null;
}

// ─── Session cookie management ────────────────────────────────────────────────

/**
 * Store a session cookie with a timestamp for TTL tracking.
 * Requires biometric auth.
 */
export async function setSessionCookie(storeId: string, cookie: string): Promise<void> {
  await requireBiometrics('Authenticate to save session');
  const payload = JSON.stringify({ cookie, storedAt: Date.now() });
  try {
    await SecureStore.setItemAsync(storeSessionCookieKey(storeId), payload);
  } catch (e) {
    throw new VaultError('setSessionCookie', storeId, `Failed to store session cookie: ${String(e)}`);
  }
}

/**
 * Retrieve session cookie. Computes isExpired client-side (24-hour TTL).
 * Returns null if no cookie is stored.
 * Requires biometric auth.
 */
export async function getSessionCookie(storeId: string): Promise<SessionCookieResult | null> {
  await requireBiometrics('Authenticate to access session');
  try {
    const raw = await SecureStore.getItemAsync(storeSessionCookieKey(storeId));
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as { cookie: string; storedAt: number };
    return {
      cookie: parsed.cookie,
      storedAt: parsed.storedAt,
      isExpired: Date.now() - parsed.storedAt > 86_400_000,
    };
  } catch (e) {
    throw new VaultError('getSessionCookie', storeId, `Failed to read session cookie: ${String(e)}`);
  }
}

/**
 * Delete the stored session cookie for a store.
 */
export async function clearSessionCookie(storeId: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(storeSessionCookieKey(storeId));
  } catch (e) {
    throw new VaultError('clearSessionCookie', storeId, `Failed to clear session cookie: ${String(e)}`);
  }
}

// ─── Resend API key ────────────────────────────────────────────────────────────

export async function setResendApiKey(key: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(RESEND_API_KEY, key);
  } catch (e) {
    throw new VaultError('setResendApiKey', null, `Failed to store Resend API key: ${String(e)}`);
  }
}

/** Requires biometric auth. */
export async function getResendApiKey(): Promise<string | null> {
  await requireBiometrics('Authenticate to access API key');
  try {
    return await SecureStore.getItemAsync(RESEND_API_KEY);
  } catch (e) {
    throw new VaultError('getResendApiKey', null, `Failed to read Resend API key: ${String(e)}`);
  }
}

// ─── Extra helpers (beyond spec — documented in ASSUMPTIONS.md) ───────────────

export async function deleteResendApiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(RESEND_API_KEY);
}

export async function hasResendApiKey(): Promise<boolean> {
  const val = await SecureStore.getItemAsync(RESEND_API_KEY);
  return val !== null;
}

export async function setHomeAddress(address: Record<string, string | null>): Promise<void> {
  await SecureStore.setItemAsync(HOME_ADDRESS_KEY, JSON.stringify(address));
}

export async function getHomeAddress(): Promise<Record<string, string | null> | null> {
  await requireBiometrics('Authenticate to access home address');
  const raw = await SecureStore.getItemAsync(HOME_ADDRESS_KEY);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as Record<string, string | null>;
  } catch {
    return null;
  }
}

// ─── Clear all credentials ────────────────────────────────────────────────────

/**
 * Clear ALL credentials for all stores.
 * Used in Settings → "Clear all data".
 * Requires biometric auth.
 * Returns count of keys deleted.
 */
export async function clearAllCredentials(): Promise<number> {
  await requireBiometrics('Authenticate to clear all credentials');
  let deleted = 0;

  // Delete per-store keys by querying the stores table
  const stores = await database.get<Store>('stores').query().fetch();
  for (const store of stores) {
    await SecureStore.deleteItemAsync(storeUsernameKey(store.id));
    await SecureStore.deleteItemAsync(storePasswordKey(store.id));
    await SecureStore.deleteItemAsync(storeSessionCookieKey(store.id));
    deleted += 3;
  }

  // Delete app-level keys
  await SecureStore.deleteItemAsync(RESEND_API_KEY);
  await SecureStore.deleteItemAsync(SMTP_CONFIG_KEY);
  await SecureStore.deleteItemAsync(HOME_ADDRESS_KEY);
  deleted += 3;

  return deleted;
}
