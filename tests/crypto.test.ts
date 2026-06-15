import { afterEach, describe, expect, it } from 'vitest';
import {
  base64ToBytes,
  bytesToBase64,
  decryptBytes,
  decryptJson,
  deriveKek,
  encryptBytes,
  encryptJson,
  exportAesKey,
  generateDataKey,
  generateSalt,
  importAesKey,
} from '../src/shared/crypto';
import { STORAGE_KEYS } from '../src/shared/constants';
import {
  clearRememberedDataKey,
  rememberSessionDataKey,
  restoreRememberedDataKey,
} from '../src/shared/keyManager';

const mockStorage: Record<string, any> = {};
const chromeMock: any = {
  storage: {
    local: {
      get: async (key: string) => ({ [key]: mockStorage[key] }),
      set: async (items: Record<string, any>) => {
        Object.assign(mockStorage, items);
      },
      remove: async (key: string) => {
        delete mockStorage[key];
      },
    },
  },
};
globalThis.chrome = chromeMock;

describe('encrypted sync crypto helpers', () => {
  afterEach(async () => {
    await clearRememberedDataKey();
    for (const key of Object.keys(mockStorage)) delete mockStorage[key];
  });

  it('round-trips bytes through base64', () => {
    const bytes = new Uint8Array([0, 1, 2, 253, 254, 255]);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });

  it('encrypts and decrypts JSON with a Data Key', async () => {
    const key = await generateDataKey();
    const value = {
      version: 1,
      records: [{ id: '1', title: '测试视频', progress: 0.5 }],
      customSites: [{ domain: 'example.com', enabled: true }],
    };

    const encrypted = await encryptJson(value, key);
    expect(encrypted.algorithm).toBe('AES-GCM');
    expect(encrypted.data).not.toContain('测试视频');

    await expect(decryptJson(encrypted, key)).resolves.toEqual(value);
  });

  it('exports and imports AES keys', async () => {
    const key = await generateDataKey();
    const rawKey = await exportAesKey(key);
    const imported = await importAesKey(rawKey);
    const encrypted = await encryptJson({ ok: true }, imported);

    await expect(decryptJson(encrypted, key)).resolves.toEqual({ ok: true });
  });

  it('derives a KEK that can protect a Data Key', async () => {
    const dataKey = await generateDataKey();
    const rawDataKey = await exportAesKey(dataKey);
    const salt = generateSalt();
    const kek = await deriveKek('correct-password', salt, 1000);

    const encryptedDataKey = await encryptBytes(rawDataKey, kek);
    const decryptedDataKey = await decryptBytes(encryptedDataKey, kek);

    expect(decryptedDataKey).toEqual(rawDataKey);
  });

  it('rejects decryption with the wrong password-derived KEK', async () => {
    const dataKey = await generateDataKey();
    const rawDataKey = await exportAesKey(dataKey);
    const salt = generateSalt();
    const correctKek = await deriveKek('correct-password', salt, 1000);
    const wrongKek = await deriveKek('wrong-password', salt, 1000);
    const encryptedDataKey = await encryptBytes(rawDataKey, correctKek);

    await expect(decryptBytes(encryptedDataKey, wrongKek)).rejects.toThrow();
  });

  it('remembers and restores the current device Data Key', async () => {
    const key = await generateDataKey();
    const encrypted = await encryptJson({ remembered: true }, key);

    // Seed the keyManager session through the remembered key path.
    mockStorage[STORAGE_KEYS.ENCRYPTION_DEVICE_KEY] = {
      version: 1,
      algorithm: 'AES-GCM',
      dataKey: bytesToBase64(await exportAesKey(key)),
      savedAt: Date.now(),
    };

    const restored = await restoreRememberedDataKey();
    expect(restored).toBeTruthy();
    await expect(decryptJson(encrypted, restored!)).resolves.toEqual({ remembered: true });

    await rememberSessionDataKey();
    expect(mockStorage[STORAGE_KEYS.ENCRYPTION_DEVICE_KEY].dataKey).toBeTruthy();
  });
});
