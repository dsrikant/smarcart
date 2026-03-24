/**
 * biometrics.ts
 *
 * Wraps expo-local-authentication. Used as a gate before reading any
 * secret from credentialVault.ts when biometric lock is enabled.
 */

import * as LocalAuthentication from 'expo-local-authentication';

export async function isBiometricsAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  return hasHardware && isEnrolled;
}

/**
 * Prompts the user for biometric (or device PIN) authentication.
 * Returns true if authentication succeeded, false if cancelled or failed.
 */
export async function requireBiometrics(): Promise<boolean> {
  const available = await isBiometricsAvailable();
  if (!available) {
    // Device has no enrolled biometrics — treat as passed so the app
    // doesn't lock users out on incompatible hardware.
    return true;
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Authenticate to access credentials',
    cancelLabel: 'Cancel',
    fallbackLabel: 'Use PIN',
    disableDeviceFallback: false,
  });

  return result.success;
}
