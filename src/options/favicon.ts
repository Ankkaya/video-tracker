import { STORAGE_KEYS } from '../shared/constants';
import { StorageManager } from '../shared/storage';
import { drawVideoTrackerIcon } from '../shared/icon';

function createFaviconUrl(enabled: boolean): string {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  drawVideoTrackerIcon(ctx, size, enabled);
  return canvas.toDataURL('image/png');
}

function setFavicon(enabled: boolean): void {
  const href = createFaviconUrl(enabled);
  if (!href) return;

  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.type = 'image/png';
  link.href = href;
}

export async function syncOptionsFavicon(): Promise<void> {
  const settings = await StorageManager.getSettings();
  setFavicon(settings.autoRecord);

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    const settingsChange = changes[STORAGE_KEYS.SETTINGS];
    const autoRecord = settingsChange?.newValue?.autoRecord;
    if (typeof autoRecord === 'boolean') {
      setFavicon(autoRecord);
    }
  });
}
