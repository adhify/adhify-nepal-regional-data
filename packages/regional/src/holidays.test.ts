import { describe, expect, it } from 'vitest';
import { OutOfRangeError, holidays, loadHolidays } from './holidays.ts';
import { syntheticRelease } from './testing/synthetic.ts';

// Synthetic release, AD 2900: A national (01-15), B province SP1 (03-02),
// C group synthetic-group, changed from 05-19 to 05-20, D national cancelled (08-08).
describe('holidays (synthetic release)', () => {
  it('returns every scope when no filter is given, and skips cancelled ones', () => {
    expect(holidays.on('2900-03-02').map((h) => h.id)).toEqual(['hol-synthetic-b']);
    expect(holidays.on('2900-08-08')).toEqual([]);
    expect(holidays.on('2900-08-08', { includeCancelled: true })[0]?.status).toBe('cancelled');
  });

  it('with a scope, keeps national holidays plus the matching province and groups', () => {
    const year = { from: '2900-01-01', to: '2900-12-31' };
    const ids = (filter: Parameters<typeof holidays.between>[2]) =>
      holidays.between(year.from, year.to, filter).map((h) => h.id);
    expect(ids({ scope: {} })).toEqual(['hol-synthetic-a']);
    expect(ids({ scope: { province: 'SP1' } })).toEqual(['hol-synthetic-a', 'hol-synthetic-b']);
    expect(ids({ scope: { groups: ['synthetic-group'] } })).toEqual([
      'hol-synthetic-a',
      'hol-synthetic-c',
    ]);
    expect(holidays.isHoliday('2900-03-02', { scope: { province: 'SP9' } })).toBe(false);
    expect(holidays.isHoliday('2900-01-15', { scope: {} })).toBe(true);
  });

  it('keeps the source status and previous date of changed holidays', () => {
    const changed = holidays.get('hol-synthetic-c');
    expect(changed).toMatchObject({ status: 'changed', previous_date: '2900-05-19' });
    expect(holidays.on('2900-05-19')).toEqual([]);
  });

  it('returns copies, so callers cannot change the bundled data', () => {
    const first = holidays.get('hol-synthetic-a');
    first!.name.en = 'changed by caller';
    expect(holidays.get('hol-synthetic-a')?.name.en).toBe('Synthetic holiday A');
  });

  it('throws OutOfRangeError outside the covered years', () => {
    expect(holidays.range()).toEqual({ from: '2900-01-01', to: '2900-12-31' });
    expect(() => holidays.on('2901-01-01')).toThrow(OutOfRangeError);
    expect(() => holidays.between('2899-12-31', '2900-01-31')).toThrow(OutOfRangeError);
  });

  it('loads a downloaded release', async () => {
    const { manifest, data } = await syntheticRelease('holidays');
    expect(loadHolidays(manifest, data).isHoliday('2900-01-15')).toBe(true);
  });
});
