import { describe, expect, it } from 'vitest';
import { InvalidDateError, UnknownUnitError, adminUnits, loadAdminUnits } from './admin-units.ts';
import { syntheticRelease } from './testing/synthetic.ts';

// Synthetic release as of 2900-06-01: SP1 > SP1-D1 > SP1-D1-M1 > SP1-D1-M1-W1, and SP1-D2,
// renamed on 2896-01-01.
describe('administrative units (synthetic release)', () => {
  it('gets units as of the release date by default, or as of another date', () => {
    expect(adminUnits.asOf()).toBe('2900-06-01');
    expect(adminUnits.get('SP1-D2').name.en).toBe('Synthetic District 2');
    expect(adminUnits.get('SP1-D2', { asOf: '2893-01-01' }).name.en).toBe(
      'Synthetic District 2 (old)',
    );
    expect(adminUnits.history('SP1-D2').map((u) => u.valid_from)).toEqual([
      '2890-01-01',
      '2896-01-01',
    ]);
  });

  it('walks the hierarchy', () => {
    expect(adminUnits.children('SP1').map((u) => u.code)).toEqual(['SP1-D1', 'SP1-D2']);
    expect(adminUnits.ancestors('SP1-D1-M1-W1').map((u) => u.code)).toEqual([
      'SP1-D1-M1',
      'SP1-D1',
      'SP1',
    ]);
    expect(adminUnits.list({ level: 'district' }).map((u) => u.code)).toEqual(['SP1-D1', 'SP1-D2']);
  });

  it('searches English and Nepali names', () => {
    expect(adminUnits.search('ward').map((u) => u.code)).toEqual(['SP1-D1-M1-W1']);
    expect(adminUnits.search('प्रदेश').map((u) => u.code)).toEqual(['SP1']);
    expect(adminUnits.search('synthetic', { level: 'district', limit: 1 })).toHaveLength(1);
    expect(adminUnits.search('  ')).toEqual([]);
  });

  it('throws UnknownUnitError for unknown codes and for dates a unit did not exist', () => {
    expect(() => adminUnits.get('SP9')).toThrow(UnknownUnitError);
    expect(() => adminUnits.get('SP1-D1', { asOf: '2880-01-01' })).toThrow(/did not exist/);
    expect(adminUnits.find('SP9')).toBeUndefined();
    expect(() => adminUnits.get('SP1', { asOf: '2900-13-01' })).toThrow(InvalidDateError);
  });

  it('returns copies, so callers cannot change the bundled data', () => {
    adminUnits.get('SP1').name.en = 'changed by caller';
    expect(adminUnits.get('SP1').name.en).toBe('Synthetic Province 1');
  });

  it('loads a downloaded release', async () => {
    const { manifest, data } = await syntheticRelease('admin-units');
    expect(loadAdminUnits(manifest, data).get('SP1').level).toBe('province');
  });
});
