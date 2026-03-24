/**
 * biometrics.ts
 *
 * Wraps expo-local-authentication. Used as a gate before reading any
 * secret from credentialVault.ts. requireBiometrics() throws BiometricAuthError
 * on failure or cancellation — callers do not need to check a return value.
 */

import * as LocalAuthentication from 'expo-local-authentication';
import { BiometricAuthError, BiometricStatus } from '@/types/credentials';

export { BiometricAuthError } from '@/types/credentials';
export type { BiometricStatus } from '@/types/credentials';

export async function isBiometricsAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  return hasHardware && isEnrolled;
}

/**
 * Gate function. Throws BiometricAuthError if auth fails or is cancelled.
 * All credential reads go through this. Call at the top of each vault read.
 */
export async function requireBiometrics(promptMessage?: string): Promise<void> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) {
    throw new BiometricAuthError('not_available', 'This device does not have biometric hardware.');
  }

  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  if (!isEnrolled) {
    throw new BiometricAuthError('not_enrolled', 'No biometrics are enrolled on this device.');
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: promptMessage ?? 'Authenticate to access credentials',
    cancelLabel: 'Cancel',
    fallbackLabel: 'Use PIN',
    disableDeviceFallback: false,
  });

  if (!result.success) {
    // expo-local-authentication returns error codes like 'user_cancel', 'system_cancel', etc.
    const cancelled =
      'error' in result &&
      (result.error === 'user_cancel' || result.error === 'system_cancel');
    if (cancelled) {
      throw new BiometricAuthError('cancelled', 'Biometric authentication was cancelled.');
    }
    throw new BiometricAuthError('failed', 'Biometric authentication failed.');
  }
}

/**
 * One-time check at app startup: are biometrics enrolled on this device?
 * Used by Settings screen to show/hide the biometric toggle.
 */
export async function getBiometricEnrollmentStatus(): Promise<BiometricStatus> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();

  let authenticationType: BiometricStatus['authenticationType'] = 'none';

  if (hasHardware) {
    const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (
      supportedTypes.includes(
        LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
      )
    ) {
      authenticationType = 'face';
    } else if (
      supportedTypes.includes(
        LocalAuthentication.AuthenticationType.FINGERPRINT,
      )
    ) {
      authenticationType = 'fingerprint';
    } else if (
      supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)
    ) {
      authenticationType = 'iris';
    }
  }

  return {
    isAvailable: hasHardware,
    isEnrolled,
    authenticationType,
  };
}
