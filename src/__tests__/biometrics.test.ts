/**
 * biometrics.test.ts
 *
 * Unit tests for biometrics.ts. expo-local-authentication is fully mocked —
 * no native modules are invoked.
 */

const mockHasHardwareAsync = jest.fn();
const mockIsEnrolledAsync = jest.fn();
const mockAuthenticateAsync = jest.fn();
const mockSupportedAuthenticationTypesAsync = jest.fn();

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: (...args: unknown[]) => mockHasHardwareAsync(...args),
  isEnrolledAsync: (...args: unknown[]) => mockIsEnrolledAsync(...args),
  authenticateAsync: (...args: unknown[]) => mockAuthenticateAsync(...args),
  supportedAuthenticationTypesAsync: (...args: unknown[]) =>
    mockSupportedAuthenticationTypesAsync(...args),
  AuthenticationType: {
    FINGERPRINT: 1,
    FACIAL_RECOGNITION: 2,
    IRIS: 3,
  },
}));

import {
  isBiometricsAvailable,
  requireBiometrics,
  getBiometricEnrollmentStatus,
  BiometricAuthError,
} from '../services/biometrics';

beforeEach(() => {
  mockHasHardwareAsync.mockReset();
  mockIsEnrolledAsync.mockReset();
  mockAuthenticateAsync.mockReset();
  mockSupportedAuthenticationTypesAsync.mockReset();
});

// ─── isBiometricsAvailable ────────────────────────────────────────────────────

describe('isBiometricsAvailable', () => {
  it('returns false on simulator (not enrolled)', async () => {
    mockHasHardwareAsync.mockResolvedValue(true);
    mockIsEnrolledAsync.mockResolvedValue(false);
    expect(await isBiometricsAvailable()).toBe(false);
  });

  it('returns true when hardware present and enrolled', async () => {
    mockHasHardwareAsync.mockResolvedValue(true);
    mockIsEnrolledAsync.mockResolvedValue(true);
    expect(await isBiometricsAvailable()).toBe(true);
  });
});

// ─── requireBiometrics ────────────────────────────────────────────────────────

describe('requireBiometrics', () => {
  it("throws BiometricAuthError with reason 'cancelled' when user cancels", async () => {
    mockHasHardwareAsync.mockResolvedValue(true);
    mockIsEnrolledAsync.mockResolvedValue(true);
    mockAuthenticateAsync.mockResolvedValue({ success: false, error: 'user_cancel' });

    try {
      await requireBiometrics();
      fail('Expected BiometricAuthError to be thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(BiometricAuthError);
      expect((e as BiometricAuthError).reason).toBe('cancelled');
    }
  });

  it("throws BiometricAuthError with reason 'not_available' when biometrics unavailable", async () => {
    mockHasHardwareAsync.mockResolvedValue(false);

    try {
      await requireBiometrics();
      fail('Expected BiometricAuthError to be thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(BiometricAuthError);
      expect((e as BiometricAuthError).reason).toBe('not_available');
    }
  });

  it("throws BiometricAuthError with reason 'not_enrolled' when not enrolled", async () => {
    mockHasHardwareAsync.mockResolvedValue(true);
    mockIsEnrolledAsync.mockResolvedValue(false);

    try {
      await requireBiometrics();
      fail('Expected BiometricAuthError to be thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(BiometricAuthError);
      expect((e as BiometricAuthError).reason).toBe('not_enrolled');
    }
  });

  it('resolves without throwing when authentication succeeds', async () => {
    mockHasHardwareAsync.mockResolvedValue(true);
    mockIsEnrolledAsync.mockResolvedValue(true);
    mockAuthenticateAsync.mockResolvedValue({ success: true });

    await expect(requireBiometrics('Test prompt')).resolves.toBeUndefined();
  });
});

// ─── getBiometricEnrollmentStatus ─────────────────────────────────────────────

describe('getBiometricEnrollmentStatus', () => {
  it('returns correct shape when fingerprint is enrolled', async () => {
    mockHasHardwareAsync.mockResolvedValue(true);
    mockIsEnrolledAsync.mockResolvedValue(true);
    mockSupportedAuthenticationTypesAsync.mockResolvedValue([1]); // FINGERPRINT = 1

    const status = await getBiometricEnrollmentStatus();
    expect(status).toEqual({
      isAvailable: true,
      isEnrolled: true,
      authenticationType: 'fingerprint',
    });
  });

  it('returns none authenticationType when no hardware', async () => {
    mockHasHardwareAsync.mockResolvedValue(false);
    mockIsEnrolledAsync.mockResolvedValue(false);
    mockSupportedAuthenticationTypesAsync.mockResolvedValue([]);

    const status = await getBiometricEnrollmentStatus();
    expect(status).toEqual({
      isAvailable: false,
      isEnrolled: false,
      authenticationType: 'none',
    });
  });
});
