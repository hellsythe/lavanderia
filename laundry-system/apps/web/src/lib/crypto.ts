/**
 * Web Crypto helpers — AES-GCM (encriptación) + PBKDF2 (derivación de clave).
 *
 * Patrón:
 *   1. User crea PIN (4-6 dígitos)
 *   2. generateSalt() → 16 bytes random
 *   3. deriveKey(pin, salt) → AES-GCM 256-bit key con PBKDF2-HMAC-SHA256
 *      100k iteraciones (≈100ms en mobile, aceptable para un setup único)
 *   4. encrypt(plaintext, key) → { ciphertext, iv }
 *   5. save: { encryptedAccessToken, iv, salt, iterations, ... } en IndexedDB
 *
 * Para unlock:
 *   1. User ingresa PIN
 *   2. deriveKey(pin, savedSalt) con mismas iteraciones
 *   3. decrypt(ciphertext, iv, key) → plaintext
 *   4. Si la desencriptación falla → PIN incorrecto
 *
 * IMPORTANTE: requiere HTTPS o localhost. Web Crypto API está bloqueada
 * en HTTP no-localhost. Coolify genera TLS automático via Let's Encrypt.
 */

const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH_BITS = 256;
const IV_LENGTH_BYTES = 12; // recomendado para AES-GCM

function getCrypto(): Crypto {
  // globalThis.crypto está disponible en browsers y Node 19+
  if (typeof globalThis === 'undefined' || !globalThis.crypto?.subtle) {
    throw new Error('Web Crypto API no disponible — requiere HTTPS o localhost');
  }
  return globalThis.crypto;
}

// ─── Base64 helpers ────────────────────────────────────────
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] as number);
  }
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ─── Salts ────────────────────────────────────────────────
export function generateSalt(bytes = 16): string {
  const arr = new Uint8Array(bytes);
  getCrypto().getRandomValues(arr);
  return bytesToBase64(arr);
}

// ─── Key derivation (PBKDF2) ─────────────────────────────
async function deriveKey(
  pin: string,
  saltB64: string,
  iterations: number,
): Promise<CryptoKey> {
  const crypto = getCrypto();
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(pin) as BufferSource,
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: base64ToBytes(saltB64) as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH_BITS },
    false,
    ['encrypt', 'decrypt'],
  );
}

// ─── Encrypt / Decrypt ───────────────────────────────────
export interface Encrypted {
  ciphertext: string; // base64
  iv: string;          // base64
}

/**
 * Encripta un plaintext usando AES-GCM con la key derivada del PIN.
 */
export async function encryptWithPin(
  plaintext: string,
  pin: string,
  saltB64: string,
  iterations: number = CRYPTO_CONSTANTS.PBKDF2_ITERATIONS,
): Promise<Encrypted> {
  const crypto = getCrypto();
  const key = await deriveKey(pin, saltB64, iterations);
  const iv = new Uint8Array(IV_LENGTH_BYTES);
  crypto.getRandomValues(iv);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    new TextEncoder().encode(plaintext) as BufferSource,
  );
  return {
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    iv: bytesToBase64(iv),
  };
}

/**
 * Desencripta. Si el PIN es incorrecto, la desencriptación falla con
 * OperationError (AES-GCM detecta autenticidad del ciphertext).
 */
export async function decryptWithPin(
  encrypted: Encrypted,
  pin: string,
  saltB64: string,
  iterations: number = CRYPTO_CONSTANTS.PBKDF2_ITERATIONS,
): Promise<string> {
  const crypto = getCrypto();
  const key = await deriveKey(pin, saltB64, iterations);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(encrypted.iv) as BufferSource },
    key,
    base64ToBytes(encrypted.ciphertext) as BufferSource,
  );
  return new TextDecoder().decode(plaintext);
}

// ─── PIN verifier (sin descifrar) ───────────────────────
/**
 * Hash del PIN para verificar sin descifrar (defensa en profundidad).
 * Si alguien roba IndexedDB, no puede brute-force el PIN sin
 * también conocer este verifier.
 */
export async function hashPinVerifier(
  pin: string,
  saltB64: string,
  iterations: number = CRYPTO_CONSTANTS.PBKDF2_ITERATIONS,
): Promise<string> {
  const crypto = getCrypto();
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(pin + ':' + saltB64) as BufferSource, // domain separation
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode('verifier') as BufferSource,
      iterations: 10_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  );
  return bytesToBase64(new Uint8Array(bits));
}

export const CRYPTO_CONSTANTS = {
  PBKDF2_ITERATIONS,
  IV_LENGTH_BYTES,
  KEY_LENGTH_BITS,
} as const;