/**
 * credentials.ts
 *
 * Shared types for credentialVault.ts and biometrics.ts.
 * These types are intentionally kept outside the services layer so they
 * can be imported by callers (e.g. UI sheets) without pulling in native modules.
 */

// ─── Vault types ──────────────────────────────────────────────────────────────

export type StoreCredentials = {
  username: string;
  /** Never log this field. Never include in error messages. */
  password: string;
};

export type SessionCookieResult = {
  cookie: string;
  storedAt: number; // unix timestamp ms
  isExpired: boolean; // true if storedAt is > 24 hours ago
};

export class VaultError extends Error {
  constructor(
    public readonly operation: string,
    public readonly storeId: string | null,
    message: string,
  ) {
    super(message);
    this.name = 'VaultError';
  }
}

// ─── Biometrics types ─────────────────────────────────────────────────────────

export type BiometricStatus = {
  isAvailable: boolean;
  isEnrolled: boolean;
  authenticationType: 'fingerprint' | 'face' | 'iris' | 'none';
};

export class BiometricAuthError extends Error {
  constructor(
    public readonly reason: 'cancelled' | 'failed' | 'not_available' | 'not_enrolled',
    message: string,
  ) {
    super(message);
    this.name = 'BiometricAuthError';
  }
}
