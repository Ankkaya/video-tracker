import { describe, expect, it } from 'vitest';
import { customPlatformOptions, matchesPlatform } from '../src/shared/platformFilter';

describe('custom platform filters', () => {
  it('lists only domains present in non-built-in records', () => {
    expect(customPlatformOptions([
      { platform: 'generic', url: 'https://player.example.com/watch' },
      { platform: 'manual', url: 'https://old.test/watch' },
      { platform: 'youtube', url: 'https://www.youtube.com/watch' },
      { platform: 'generic', url: 'invalid' },
    ])).toEqual([
      { label: 'old.test', value: 'site:old.test' },
      { label: 'player.example.com', value: 'site:player.example.com' },
    ]);
  });
  it('matches old generic and manual records by domain with subdomain boundaries', () => {
    expect(matchesPlatform({ platform: 'generic', url: 'https://player.example.com/watch' }, 'site:example.com')).toBe(true);
    expect(matchesPlatform({ platform: 'manual', url: 'https://example.com/watch' }, 'site:example.com')).toBe(true);
    expect(matchesPlatform({ platform: 'generic', url: 'https://fakeexample.com/watch' }, 'site:example.com')).toBe(false);
    expect(matchesPlatform({ platform: 'generic', url: 'invalid' }, 'site:example.com')).toBe(false);
    expect(matchesPlatform({ platform: 'youtube', url: 'invalid' }, 'youtube')).toBe(true);
    expect(matchesPlatform({ platform: 'generic', url: 'invalid' }, 'all')).toBe(true);
  });
});
