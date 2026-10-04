import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '../src/shared/constants';
import { decryptBytes, decryptJson, deriveKek, importAesKey, generateDataKey, exportAesKey, bytesToBase64 } from '../src/shared/crypto';

const mock = vi.hoisted(() => ({
  row: { salt: 'old-salt', encrypted_data_key: {} } as any,
  rpc: vi.fn(),
  storage: {} as Record<string, any>,
  storageFailure: false,
}));
vi.mock('../src/supabase', () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: mock.row, error: null }) }) }) }),
  rpc: mock.rpc,
} }));

import { resetEncryptedCloudData } from '../src/shared/encryptedSync';
import { clearRememberedDataKey, clearSessionDataKey, getVerifiedKeySalt, restoreRememberedDataKey } from '../src/shared/keyManager';

beforeEach(async () => {
  vi.stubGlobal('chrome', { storage: { local: {
    get: async (key: string) => ({ [key]: mock.storage[key] }),
    set: async (values: any) => {
      if (mock.storageFailure) throw new Error('Storage unavailable');
      Object.assign(mock.storage, values);
    },
    remove: async (key: string) => { delete mock.storage[key]; },
  } } });
  await clearRememberedDataKey();
  mock.storage = {};
  mock.storageFailure = false;
  mock.row = { salt: 'old-salt', encrypted_data_key: {} };
  mock.rpc.mockReset();
  mock.rpc.mockImplementation(async (_name, args) => {
    mock.row = { salt: args.p_salt, encrypted_data_key: args.p_encrypted_data_key };
    return { error: null };
  });
});

describe('reset encrypted cloud sync', () => {
  it('replaces key and data with one RPC, preserves local data and unlocks with the new password', async () => {
    const records = [{ id: 'local', title: 'Local record' }] as any;
    const sites = [{ domain: 'example.com', autoRecord: true, updatedAt: 1 }];
    const deleted = [{ key: 'old', deletedAt: 1 }];
    mock.storage[STORAGE_KEYS.RECORDS] = records;
    mock.storage[STORAGE_KEYS.SETTINGS] = { siteRules: sites };
    await expect(resetEncryptedCloudData('new-password', records, sites, deleted)).resolves.toEqual({ deviceRemembered: true });
    expect(mock.rpc).toHaveBeenCalledTimes(1);
    const [name, args] = mock.rpc.mock.calls[0];
    expect(name).toBe('reset_encrypted_sync');
    expect(args.p_expected_salt).toBe('old-salt');
    expect(args.p_salt).not.toBe('old-salt');
    const kek = await deriveKek('new-password', args.p_salt);
    const key = await importAesKey(await decryptBytes(args.p_encrypted_data_key, kek));
    expect(await decryptJson(args.p_encrypted_blob, key)).toMatchObject({ version: 2, records, siteRules: sites, deletedRecords: deleted });
    await expect(decryptBytes(args.p_encrypted_data_key, await deriveKek('old-password', args.p_salt))).rejects.toThrow();
    expect(mock.storage[STORAGE_KEYS.RECORDS]).toBe(records);
    expect(mock.storage[STORAGE_KEYS.SETTINGS].siteRules).toBe(sites);
    await expect(getVerifiedKeySalt()).resolves.toBe(args.p_salt);
  });

  it('keeps the remembered key and local records if the cloud transaction fails', async () => {
    mock.storage[STORAGE_KEYS.ENCRYPTION_DEVICE_KEY] = { dataKey: 'unchanged' };
    mock.storage[STORAGE_KEYS.RECORDS] = [{ id: 'keep' }];
    mock.rpc.mockResolvedValue({ error: new Error('Transaction failed') });
    await expect(resetEncryptedCloudData('new', [], [])).rejects.toThrow('Transaction failed');
    expect(mock.storage[STORAGE_KEYS.ENCRYPTION_DEVICE_KEY].dataKey).toBe('unchanged');
    expect(mock.storage[STORAGE_KEYS.RECORDS]).toEqual([{ id: 'keep' }]);
  });

  it('reports cloud success separately if remembering the device key fails', async () => {
    mock.storageFailure = true;
    await expect(resetEncryptedCloudData('new', [], [])).resolves.toEqual({ deviceRemembered: false });
    expect(mock.rpc).toHaveBeenCalledTimes(1);
  });

  it('rejects a stale device key after another device resets, even in memory', async () => {
    await resetEncryptedCloudData('new', [], []);
    mock.row.salt = 'another-device-salt';
    await expect(getVerifiedKeySalt()).rejects.toThrow('Cloud encryption changed');
    expect(mock.storage[STORAGE_KEYS.ENCRYPTION_DEVICE_KEY]).toBeUndefined();
  });

  it('rejects a legacy unversioned key after reset instead of uploading with it', async () => {
    clearSessionDataKey();
    mock.storage[STORAGE_KEYS.ENCRYPTION_DEVICE_KEY] = {
      version: 1, algorithm: 'AES-GCM', dataKey: bytesToBase64(await exportAesKey(await generateDataKey())),
    };
    mock.row.encrypted_data_key = { reset_version: 1 };
    await restoreRememberedDataKey();
    await expect(getVerifiedKeySalt()).rejects.toThrow('Cloud encryption changed');
  });

  it('rejects an empty password without contacting the reset RPC', async () => {
    await expect(resetEncryptedCloudData(' ', [], [])).rejects.toThrow('Please enter');
    expect(mock.rpc).not.toHaveBeenCalled();
  });
});
