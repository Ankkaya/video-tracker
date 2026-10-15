import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, BackgroundUnavailableError } from '../src/options/composables/useApi';
import { MSG } from '../src/shared/constants';

const sendMessage = vi.fn();
beforeEach(() => {
  sendMessage.mockReset();
  vi.stubGlobal('chrome', { runtime: { sendMessage } });
});
afterEach(() => vi.unstubAllGlobals());

describe('completion API errors', () => {
  it('identifies missing and older background handlers', async () => {
    for (const response of [undefined, { error: 'Unknown message type' }]) {
      sendMessage.mockResolvedValueOnce(response);
      await expect(api.setCompleted('record', true)).rejects.toBeInstanceOf(BackgroundUnavailableError);
    }
    sendMessage.mockRejectedValueOnce(new Error('Could not establish connection. Receiving end does not exist.'));
    await expect(api.setCompleted('record', true)).rejects.toBeInstanceOf(BackgroundUnavailableError);
  });
  it('preserves the actual save error without asking users to reload for a quota error', async () => {
    sendMessage.mockResolvedValueOnce({ success: false, error: 'QUOTA_BYTES quota exceeded' });
    const error = await api.setCompleted('record', true).catch(error => error);
    expect(error.message).toBe('QUOTA_BYTES quota exceeded');
    expect(error).not.toBeInstanceOf(BackgroundUnavailableError);
    expect(sendMessage).toHaveBeenCalledOnce();
    expect(sendMessage).toHaveBeenCalledWith({ type: MSG.SET_RECORD_COMPLETED, data: { id: 'record', completed: true } });
  });
});
