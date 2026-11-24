import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { checkSchema } from './schemas.ts';

describe('precompiled schema validators', () => {
  it('compile no code at runtime, so they run on Cloudflare Workers', async () => {
    const code = await readFile(new URL('./generated/validators.js', import.meta.url), 'utf8');
    expect(code).not.toMatch(/new Function|\beval\(|\brequire\(/);
  });

  it('report schema errors with a path, as before precompiling', () => {
    const issues = checkSchema('manifest', 'manifest.json', { dataset: 'synthetic-unknown' });
    expect(issues.length).toBeGreaterThan(1); // allErrors: every problem, not just the first
    expect(issues.every((issue) => issue.code === 'schema')).toBe(true);
    expect(issues.some((issue) => issue.path === 'manifest.json#/dataset')).toBe(true);
  });

  it('keep reporting the name of an unexpected property', () => {
    const issues = checkSchema('calendar', 'data/calendar.json', {
      dataset: 'calendar',
      version: '2026.1',
      schema_version: '1.0.0',
      records: [],
      synthetic_extra: true,
    });
    expect(issues.map((issue) => issue.message).join(' ')).toContain('(synthetic_extra)');
  });
});
