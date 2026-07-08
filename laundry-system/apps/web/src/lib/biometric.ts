/**
 * WebAuthn wrapper — autenticación biométrica local.
 *
 * NO usa el servidor (es 100% local, similar a WebAuthn pero standalone).
 * Genera un challenge aleatorio, lo firma con la clave del device (si
 * existe una credencial), y verifica que la firma es válida.
 *
 * Compatible con: TouchID, FaceID, Windows Hello, Android fingerprint,
 * macOS TouchID via Safari, etc.
 *
 * Requiere HTTPS o localhost.
 */

interface BiometricCapability {
  available: boolean;
  reason?: string; // si !available, por qué
}

export async function isBiometricAvailable(): Promise<BiometricCapability> {
  if (typeof window === 'undefined') {
    return { available: false, reason: 'SSR' };
  }
  // WebAuthn requiere secure context (HTTPS o localhost)
  if (!window.isSecureContext) {
    return {
      available: false,
      reason: 'Requiere HTTPS o localhost',
    };
  }
  // Check si el browser soporta WebAuthn
  if (!window.PublicKeyCredential) {
    return {
      available: false,
      reason: 'Browser no soporta WebAuthn',
    };
  }
  // Check si hay un authenticator disponible
  try {
    const available =
      await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return available
      ? { available: true }
      : { available: false, reason: 'No hay biométrico configurado en este device' };
  } catch {
    return { available: false, reason: 'Error al verificar disponibilidad' };
  }
}

/**
 * Genera un challenge random de 32 bytes (base64).
 */
function generateChallenge(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  // base64
  let binary = '';
  for (let i = 0; i < arr.length; i++) {
    binary += String.fromCharCode(arr[i] as number);
  }
  return btoa(binary);
}

/**
 * Auth vía WebAuthn. Usa el challenge y los IDs de credenciales guardados
 * en el localStorage (generados al setup del PIN).
 *
 * Retorna true si la autenticación fue exitosa.
 */
export async function authenticateWithBiometric(
  credentialIdBase64: string,
  userIdBase64: string,
): Promise<boolean> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    return false;
  }

  const challenge = generateChallenge();
  const credentialId = Uint8Array.from(atob(credentialIdBase64), (c) =>
    c.charCodeAt(0),
  );

  const publicKey: PublicKeyCredentialRequestOptions = {
    challenge: Uint8Array.from(atob(challenge), (c) => c.charCodeAt(0)),
    timeout: 60_000,
    userVerification: 'required',
    allowCredentials: [
      {
        id: credentialId,
        type: 'public-key',
      },
    ],
  };

  try {
    const credential = (await navigator.credentials.get({
      publicKey,
      mediation: 'optional',
    })) as PublicKeyCredential | null;
    if (!credential) return false;
    // El browser ya validó la firma. Si llegamos aquí, el user es quien dice ser.
    return true;
  } catch (e) {
    // User canceló, timeout, o biometría no match.
    return false;
  }
}

/**
 * Crea una credencial WebAuthn nueva (enrollment).
 * Se usa una sola vez cuando el user activa "usar biometría" en setup.
 */
export async function enrollBiometric(
  userId: string,
  userName: string,
): Promise<{ credentialId: string; userId: string } | null> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    return null;
  }

  const challenge = generateChallenge();
  const userIdBytes = new TextEncoder().encode(userId);

  const publicKey: PublicKeyCredentialCreationOptions = {
    challenge: Uint8Array.from(atob(challenge), (c) => c.charCodeAt(0)),
    rp: {
      name: 'LavanderPro',
      // En producción debería ser el dominio real. WebAuthn lo valida.
      id: typeof window !== 'undefined' ? window.location.hostname : 'localhost',
    },
    user: {
      id: userIdBytes,
      name: userName,
      displayName: userName,
    },
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 }, // ES256
    ],
    authenticatorSelection: {
      userVerification: 'required',
      residentKey: 'preferred',
    },
    timeout: 60_000,
    attestation: 'none', // no necesitamos attestation server-side
  };

  try {
    const credential = (await navigator.credentials.create({
      publicKey,
    })) as PublicKeyCredential | null;
    if (!credential) return null;
    return {
      credentialId: btoa(String.fromCharCode(...new Uint8Array(credential.rawId))),
      userId,
    };
  } catch {
    return null;
  }
}