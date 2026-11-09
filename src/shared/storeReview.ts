import { STORAGE_KEYS } from './constants';

const DAY = 24 * 60 * 60 * 1000;
const REQUIRED_SAVES = 5;

interface ReviewState {
  startedAt: number;
  saves: number;
  stage?: 'first' | 'snoozed' | 'done';
  remindAt?: number;
}

export function storeReviewUrl(): string | undefined {
  switch (chrome.runtime.id) {
    case 'khcbepelehjlhplgepkmapfhcjimgedf':
      return 'https://chromewebstore.google.com/detail/videotracker/khcbepelehjlhplgepkmapfhcjimgedf/reviews';
    case 'kdokhkcebfbaaiobnknjilhpfjbillie':
      return 'https://microsoftedge.microsoft.com/addons/detail/videotracker/kdokhkcebfbaaiobnknjilhpfjbillie';
  }
  // Keep the UI available in local builds and the store preview.
  if (import.meta.env.DEV) {
    return 'https://chromewebstore.google.com/detail/videotracker/khcbepelehjlhplgepkmapfhcjimgedf/reviews';
  }
}

async function read(): Promise<ReviewState | undefined> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.STORE_REVIEW);
  return result[STORAGE_KEYS.STORE_REVIEW];
}

function write(state: ReviewState) {
  return chrome.storage.local.set({ [STORAGE_KEYS.STORE_REVIEW]: state });
}

// All writes run through the background mutation queue.
export async function initializeStoreReview() {
  if (!(await read())) await write({ startedAt: Date.now(), saves: 0 });
}

export async function countReviewSave() {
  const state = (await read()) ?? { startedAt: Date.now(), saves: 0 };
  if (state.saves < REQUIRED_SAVES) await write({ ...state, saves: state.saves + 1 });
}

export async function claimStoreReview(): Promise<'first' | 'reminder' | undefined> {
  const state = await read();
  if (!state || state.saves < REQUIRED_SAVES || Date.now() < state.startedAt + 7 * DAY) return;
  if (!state.stage) {
    await write({ ...state, stage: 'first' });
    return 'first';
  }
  if (state.stage === 'snoozed' && Date.now() >= (state.remindAt ?? Infinity)) {
    await write({ ...state, stage: 'done' });
    return 'reminder';
  }
}

export async function snoozeStoreReview() {
  const state = await read();
  if (state?.stage === 'first') {
    await write({ ...state, stage: 'snoozed', remindAt: Date.now() + 30 * DAY });
  }
}
