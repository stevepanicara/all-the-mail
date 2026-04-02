import { getAccountShortLabel } from './getAccountShortLabel';

describe('getAccountShortLabel', () => {
  const testCases = [
    { input: 'Ranger & Fox', expected: 'RF' },
    { input: 'Acme Design Studio', expected: 'ADS' },
    { input: 'Notion', expected: 'NOTI' },
    { input: 'john.doe@gmail.com', expected: 'JD' },
    { input: 'demo-account', expected: 'DA' },
    { input: 'Personal Email', expected: 'PE' },
    { input: 'Work', expected: 'WORK' },
    { input: 'my_side_project', expected: 'MSP' },
    { input: 'ACME Corp Ventures LLC', expected: 'ACVL' },
    { input: 'a', expected: 'A' },
    { input: '', expected: '' },
    { input: "Stephen's Personal", expected: 'SSP' },
    { input: 'R&F Design Co.', expected: 'RFDC' },
  ];

  testCases.forEach(({ input, expected }) => {
    it(`"${input}" -> "${expected}"`, () => {
      expect(getAccountShortLabel(input)).toBe(expected);
    });
  });

  it('handles undefined input', () => {
    expect(getAccountShortLabel(undefined)).toBe('');
  });

  it('handles no arguments', () => {
    expect(getAccountShortLabel()).toBe('');
  });
});
