import { isPeakHour, parseDepartureTime } from './departure-time.js';

describe('parseDepartureTime', () => {
  it.each([
    ['00:00', 0],
    ['08:00', 480],
    ['12:30', 750],
    ['23:59', 1439],
  ])('parses %p as minute %p', (text, minute) => {
    expect(parseDepartureTime(text)).toBe(minute);
  });

  it.each([
    '24:00',
    '7:00',
    '08:60',
    '0800',
    '08:00:00',
    '',
    ' 08:00',
    '08:0a',
  ])('rejects %p', (text) => {
    expect(() => parseDepartureTime(text)).toThrow(RangeError);
  });
});

describe('isPeakHour', () => {
  it.each([
    ['00:00', false],
    ['06:59', false],
    ['07:00', true],
    ['08:00', true],
    ['08:59', true],
    ['09:00', false],
    ['12:00', false],
    ['16:59', false],
    ['17:00', true],
    ['18:59', true],
    ['19:00', false],
    ['23:59', false],
  ])('%p is peak: %p', (text, peak) => {
    expect(isPeakHour(parseDepartureTime(text))).toBe(peak);
  });
});
