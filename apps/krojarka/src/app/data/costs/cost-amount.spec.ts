import { formatCostAmount, normalizeCostAmount, sumCostAmounts, reportCsv } from '@splk/domain';
describe('exact cost amounts', () => {
  it('adds decimal units and large opposite amounts without floating point loss', () => {
    expect(sumCostAmounts(['0.1', '0.2'])).toBe('0.3000');
    expect(sumCostAmounts(['12345678901234.1234', '-12345678901234.1233'])).toBe('0.0001');
    expect(sumCostAmounts(['-20.25', '10'])).toBe('-10.2500'); expect(normalizeCostAmount('-0')).toBe('0.0000');
  });
  it('rejects precision loss, exponent notation and ambiguous input', () => {
    for (const value of ['1e3', '1.12345', '100000000000000', '01', '+1', 'NaN', '1,2', '1\n']) expect(() => normalizeCostAmount(value)).toThrow();
  });
  it('formats every retained decimal without rounding into another amount', () => {
    expect(formatCostAmount('12345678901234.1234')).toBe('12\u00a0345\u00a0678\u00a0901\u00a0234,1234');
    expect(formatCostAmount('-20.2500')).toBe('-20,25'); expect(formatCostAmount('0.0001')).toBe('0,0001');
  });
  it('keeps valid negative money numeric in CSV while neutralizing text formulas', () => {
    const csv = reportCsv({ unitId: 1, title: 'Costs', generatedAt: 'now', notice: '', sections: [{ title: '', columns: ['Value'], rows: [['-25.1234'], ['-3+4'], ['=HYPERLINK("bad")']] }] });
    expect(csv).toContain('\r\n-25.1234\r\n'); expect(csv).toContain("\r\n'-3+4\r\n"); expect(csv).toContain("'=HYPERLINK");
  });
});
