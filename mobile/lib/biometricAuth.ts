import * as LocalAuthentication from 'expo-local-authentication';

/**
 * Prompts Face ID / fingerprint (falls back to device passcode if biometrics
 * are unavailable/fail). Runs entirely on-device — the result only gates
 * whether the caller proceeds, it is never sent to the backend.
 */
export async function confirmWithBiometrics(promptMessage: string): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  if (!hasHardware || !isEnrolled) return false;

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: 'Abbrechen',
  });
  return result.success;
}
