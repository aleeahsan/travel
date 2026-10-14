import { describe, expect, it } from 'vitest';
import { convertRows, IMPORT_SPECS, matchColumns, parseDate, parseNumber, parseTable } from './importer';

describe('parseTable', () => {
  it('reads tab-separated text copied from Google Sheets', () => {
    expect(parseTable('Date\tSpend\n14/10/2026\t$1,200.50\n')).toEqual([['Date', 'Spend'], ['14/10/2026', '$1,200.50']]);
  });
  it('reads CSV with quoted commas', () => {
    expect(parseTable('a,b\n"Smith, J",5')).toEqual([['a', 'b'], ['Smith, J', '5']]);
  });
});

describe('parseNumber', () => {
  it.each([
    ['$1,200.50', 1200.5],
    ['45%', 45],
    ['(300)', -300],
    ['-12', -12],
    ['', null],
    ['abc', null],
  ])('%s → %s', (raw, out) => expect(parseNumber(raw)).toBe(out));
});

describe('parseDate', () => {
  it('handles common sheet formats', () => {
    expect(parseDate('2026-10-14')).toBe('2026-10-14');
    expect(parseDate('14/10/2026')).toBe('2026-10-14');
    expect(parseDate('10/14/2026')).toBe('2026-10-14');
    expect(parseDate('03/04/2026', true)).toBe('2026-04-03');
    expect(parseDate('03/04/2026', false)).toBe('2026-03-04');
    expect(parseDate('14-Oct-2026')).toBe('2026-10-14');
    expect(parseDate('Oct 14, 2026')).toBe('2026-10-14');
    expect(parseDate('nonsense')).toBeNull();
  });
});

describe('column matching + conversion', () => {
  it('matches loose headers and reports row errors', () => {
    const spec = IMPORT_SPECS.paid!;
    const [headers, ...rows] = parseTable('Date\tOur Brand\tCustomer Brand\tPlatform\tAmount Spent\tLink Clicks\n14/10/2026\tNorthwind\tLumen\tMeta\t$500\t120\nbad\tNorthwind\t\tMeta\t\t');
    const cols = matchColumns(headers, spec.fields);
    expect(cols.brand).toBe(1);
    expect(cols.clientBrand).toBe(2);
    expect(cols.channel).toBe(3);
    expect(cols.spend).toBe(4);
    expect(cols.clicks).toBe(5);
    const out = convertRows(rows, spec.fields, cols);
    expect(out[0].errors).toEqual([]);
    expect(out[0].values).toMatchObject({ date: '2026-10-14', spend: 500, clicks: 120 });
    expect(out[1].errors.length).toBeGreaterThan(0);
  });
});
