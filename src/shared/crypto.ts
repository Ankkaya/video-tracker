export const CRYPTO_CONFIG = {
  algorithm: 'AES-GCM',
  dataKeyLength: 256,
  ivLength: 12,
  saltLength: 16,
  kdf: 'PBKDF2',
  kdfHash: 'SHA-256',
  kdfIterations: 210000,
} as const;

export interface EncryptedPayload {
  version: 1;
  algorithm: typeof CRYPTO_CONFIG.algorithm;
  iv: string;
  data: string;
}

function getCrypto(): Crypto {
  const cryptoImpl = globalThis.crypto;
  if (!cryptoImpl?.subtle) {
    throw new Error('Web Crypto API is not available');
  }
  return cryptoImpl;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export function getRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  getCrypto().getRandomValues(bytes);
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function generateSalt(): string {
  return bytesToBase64(getRandomBytes(CRYPTO_CONFIG.saltLength));
}

export async function deriveKek(
  password: string,
  salt: string,
  iterations: number = CRYPTO_CONFIG.kdfIterations,
): Promise<CryptoKey> {
  const cryptoImpl = getCrypto();
  const passwordBytes = new TextEncoder().encode(password);
  const baseKey = await cryptoImpl.subtle.importKey(
    'raw',
    passwordBytes,
    CRYPTO_CONFIG.kdf,
    false,
    ['deriveKey'],
  );

  return cryptoImpl.subtle.deriveKey(
    {
      name: CRYPTO_CONFIG.kdf,
      salt: toArrayBuffer(base64ToBytes(salt)),
      iterations,
      hash: CRYPTO_CONFIG.kdfHash,
    },
    baseKey,
    { name: CRYPTO_CONFIG.algorithm, length: CRYPTO_CONFIG.dataKeyLength },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function generateDataKey(): Promise<CryptoKey> {
  return getCrypto().subtle.generateKey(
    { name: CRYPTO_CONFIG.algorithm, length: CRYPTO_CONFIG.dataKeyLength },
    true,
    ['encrypt', 'decrypt'],
  );
}

export async function importAesKey(rawKey: Uint8Array): Promise<CryptoKey> {
  return getCrypto().subtle.importKey(
    'raw',
    toArrayBuffer(rawKey),
    { name: CRYPTO_CONFIG.algorithm, length: CRYPTO_CONFIG.dataKeyLength },
    true,
    ['encrypt', 'decrypt'],
  );
}

export async function exportAesKey(key: CryptoKey): Promise<Uint8Array> {
  const exported = await getCrypto().subtle.exportKey('raw', key);
  return new Uint8Array(exported);
}

export async function encryptBytes(bytes: Uint8Array, key: CryptoKey): Promise<EncryptedPayload> {
  const iv = getRandomBytes(CRYPTO_CONFIG.ivLength);
  const encrypted = await getCrypto().subtle.encrypt(
    { name: CRYPTO_CONFIG.algorithm, iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(bytes),
  );

  return {
    version: 1,
    algorithm: CRYPTO_CONFIG.algorithm,
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(encrypted)),
  };
}

export async function decryptBytes(payload: EncryptedPayload, key: CryptoKey): Promise<Uint8Array> {
  if (payload.version !== 1 || payload.algorithm !== CRYPTO_CONFIG.algorithm) {
    throw new Error('Unsupported encrypted payload');
  }

  const decrypted = await getCrypto().subtle.decrypt(
    { name: CRYPTO_CONFIG.algorithm, iv: toArrayBuffer(base64ToBytes(payload.iv)) },
    key,
    toArrayBuffer(base64ToBytes(payload.data)),
  );

  return new Uint8Array(decrypted);
}

export async function encryptJson<T>(value: T, key: CryptoKey): Promise<EncryptedPayload> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return encryptBytes(bytes, key);
}

export async function decryptJson<T>(payload: EncryptedPayload, key: CryptoKey): Promise<T> {
  const bytes = await decryptBytes(payload, key);
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}
