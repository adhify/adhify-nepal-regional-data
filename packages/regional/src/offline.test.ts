// C-12: the SDK works offline and never needs an API key.
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

const SRC = dirname(fileURLToPath(import.meta.url));

async function sourceFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'testing') files.push(...(await sourceFiles(path)));
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) files.push(path);
  }
  return files;
}

describe('offline (C-12)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('runs every module with all network APIs disabled', async () => {
    const blocked = () => {
      throw new Error('network access attempted');
    };
    vi.stubGlobal('fetch', blocked);
    vi.stubGlobal('XMLHttpRequest', blocked);
    vi.stubGlobal('WebSocket', blocked);
    vi.resetModules();
    const sdk = await import('./index.ts');
    expect(sdk.calendar.toBs('2844-04-13')).toEqual({ year: 2901, month: 1, day: 1 });
    expect(sdk.holidays.isHoliday('2900-01-15')).toBe(true);
    expect(sdk.businessDays.isBusinessDay('2900-01-15')).toBe(false);
    expect(sdk.adminUnits.get('SP1').level).toBe('province');
    expect(sdk.releases().map((r) => `${r.dataset}@${r.version}`)).toEqual([
      'calendar@2026.1',
      'holidays@2026.1',
      'business-calendar@2026.1',
      'admin-units@2026.1',
    ]);
  });

  it('has no network, environment or API-key code in the runtime sources', async () => {
    const forbidden =
      /\bfetch\(|XMLHttpRequest|WebSocket|node:(http|https|net|dns)|process\.env|api[_-]?key/i;
    for (const file of await sourceFiles(SRC)) {
      const text = await readFile(file, 'utf8');
      expect(forbidden.test(text), file).toBe(false);
    }
  });
});
