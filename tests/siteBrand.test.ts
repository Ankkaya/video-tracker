import { describe, expect, it } from 'vitest';
import { getSiteBrand, siteBrands } from '../src/shared/siteBrand';

describe('record website identification', () => {
  it('recognizes built-in domains and their subdomains for generic records', () => {
    for (const brand of siteBrands) {
      for (const domain of brand.domains) {
        expect(getSiteBrand({ url: `https://player.${domain}/watch`, platform: 'generic' })?.id).toBe(brand.id);
      }
    }
  });
  it('does not match a site name inside an unrelated host or URL path', () => {
    for (const url of ['https://notyoutube.com/watch', 'https://youtube.com.example.org/', 'https://example.org/youtube.com', 'invalid']) {
      expect(getSiteBrand({ url, platform: 'generic' })).toBeNull();
    }
  });
  it('uses the URL first and supports older records with only a platform', () => {
    expect(getSiteBrand({ url: 'https://youtu.be/123', platform: 'bilibili' })?.id).toBe('youtube');
    expect(getSiteBrand({ url: 'invalid', platform: 'vqq' })?.icon).toBe('/site-icons/vqq.ico');
    expect(getSiteBrand({ url: 'invalid', platform: 'douyin' })?.id).toBe('tiktok');
    expect(getSiteBrand({ url: 'https://example.org/', platform: 'manual' })).toBeNull();
  });
});
