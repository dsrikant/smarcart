/**
 * credentialVault.test.ts
 *
 * Unit tests for the credential vault. expo-secure-store and biometrics are
 * fully mocked — no native modules are invoked.
 */

// Mock expo-secure-store with an in-memory store.
// Variable must be prefixed "mock" so Jest allows access from the hoisted factory.
const mockSecureStoreMap = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockSecureStoreMap.set(key, value);
  }),
  getItemAsync: jest.fn(async (key: string) => {
    return mockSecureStoreMap.get(key) ?? null;
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockSecureStoreMap.delete(key);
  }),
}));

// Mock biometrics to pass by default
jest.mock('../services/biometrics', () => ({
  requireBiometrics: jest.fn(async () => {
    // resolves without throwing — biometrics passed
  }),
  isBiometricsAvailable: jest.fn(async () => true),
}));

// Mock the database used in clearAllCredentials
jest.mock('../db', () => ({
  __esModule: true,
  default: {
    get: jest.fn(() => ({
      query: jest.fn(() => ({
        fetch: jest.fn(async () => []),
      })),
    })),
  },
}));

import {
  setStoreCredentials,
  getStoreCredentials,
  deleteStoreCredentials,
  hasStoreCredentials,
  setSessionCookie,
  getSessionCookie,
  clearSessionCookie,
  setResendApiKey,
  getResendApiKey,
  clearAllCredentials,
} from '../services/credentialVault';

const { requireBiometrics } = jest.requireMock('../services/biometrics') as {
  requireBiometrics: jest.MockedFunction<() => Promise<void>>;
};

beforeEach(() => {
  mockSecureStoreMap.clear();
  requireBiometrics.mockClear();
  requireBiometrics.mockResolvedValue(undefined);
});

// ─── Store credentials ────────────────────────────────────────────────────────

describe('setStoreCredentials / getStoreCredentials round-trip', () => {
  it('stores and retrieves username and password', async () => {
    await setStoreCredentials('store-1', 'user@example.com', 'secret');
    const result = await getStoreCredentials('store-1');
    expect(result).toEqual({ username: 'user@example.com', password: 'secret' });
  });
});

describe('hasStoreCredentials', () => {
  it('returns false before credentials are set', async () => {
    expect(await hasStoreCredentials('store-2')).toBe(false);
  });

  it('returns true after credentials are set', async () => {
    await setStoreCredentials('store-2', 'u', 'p');
    expect(await hasStoreCredentials('store-2')).toBe(true);
  });
});

describe('deleteStoreCredentials', () => {
  it('removes credentials and hasStoreCredentials returns false', async () => {
    await setStoreCredentials('store-3', 'u', 'p');
    expect(await hasStoreCredentials('store-3')).toBe(true);
    await deleteStoreCredentials('store-3');
    expect(await hasStoreCredentials('store-3')).toBe(false);
  });
});

describe('getStoreCredentials with unknown storeId', () => {
  it('returns null for an unknown storeId (does not throw)', async () => {
    const result = await getStoreCredentials('non-existent-store');
    expect(result).toBeNull();
  });
});

// ─── Session cookie ───────────────────────────────────────────────────────────

describe('setSessionCookie / getSessionCookie round-trip', () => {
  it('stores and retrieves cookie with correct shape', async () => {
    const before = Date.now();
    await setSessionCookie('store-4', 'my-cookie-value');
    const result = await getSessionCookie('store-4');
    expect(result).not.toBeNull();
    expect(result!.cookie).toBe('my-cookie-value');
    expect(result!.storedAt).toBeGreaterThanOrEqual(before);
    expect(result!.isExpired).toBe(false);
  });
});

describe('getSessionCookie expiry', () => {
  it('marks cookie as expired when storedAt is > 24 hours ago', async () => {
    const staleTimestamp = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago
    const payload = JSON.stringify({ cookie: 'stale-cookie', storedAt: staleTimestamp });
    // Write directly into the mock store to simulate a stored stale cookie
    mockSecureStoreMap.set('store_cred_store-5_sessionCookie', payload);

    const result = await getSessionCookie('store-5');
    expect(result).not.toBeNull();
    expect(result!.isExpired).toBe(true);
  });
});

describe('clearSessionCookie', () => {
  it('removes the cookie so getSessionCookie returns null', async () => {
    await setSessionCookie('store-6', 'c');
    await clearSessionCookie('store-6');
    const result = await getSessionCookie('store-6');
    expect(result).toBeNull();
  });
});

// ─── Resend API key ────────────────────────────────────────────────────────────

describe('getResendApiKey before set', () => {
  it('returns null when no key has been stored', async () => {
    expect(await getResendApiKey()).toBeNull();
  });
});

describe('setResendApiKey / getResendApiKey round-trip', () => {
  it('stores and retrieves the Resend API key', async () => {
    await setResendApiKey('re_abc123');
    expect(await getResendApiKey()).toBe('re_abc123');
  });
});

// ─── clearAllCredentials ──────────────────────────────────────────────────────

describe('clearAllCredentials', () => {
  it('deletes all app-level keys and returns correct count', async () => {
    await setResendApiKey('re_key');
    const count = await clearAllCredentials();
    // With no stores in the mocked DB: 3 app-level keys deleted (RESEND, SMTP, HOME_ADDRESS)
    expect(count).toBe(3);
    expect(await getResendApiKey()).toBeNull();
  });

  it('requires biometric auth', async () => {
    await clearAllCredentials();
    expect(requireBiometrics).toHaveBeenCalled();
  });
});
