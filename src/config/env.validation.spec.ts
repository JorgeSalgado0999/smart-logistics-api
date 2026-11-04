import { validateEnv } from './env.validation.js';

describe('validateEnv', () => {
  it('applies defaults when nothing is set', () => {
    expect(validateEnv({})).toEqual({ STORAGE: 'memory', PORT: 3000 });
  });

  it('treats blank values as unset', () => {
    expect(validateEnv({ STORAGE: '  ', PORT: '' })).toEqual({
      STORAGE: 'memory',
      PORT: 3000,
    });
  });

  it('reads a valid port', () => {
    expect(validateEnv({ PORT: '8080' }).PORT).toBe(8080);
  });

  it.each(['0', '65536', 'abc', '30.5', '-1'])('rejects PORT=%p', (port) => {
    expect(() => validateEnv({ PORT: port })).toThrow(/PORT must be/);
  });

  it('rejects an unknown STORAGE', () => {
    expect(() => validateEnv({ STORAGE: 'redis' })).toThrow(
      /STORAGE must be one of/,
    );
  });

  it('lists every problem in one error', () => {
    expect(() => validateEnv({ STORAGE: 'redis', PORT: 'x' })).toThrow(
      /STORAGE must be[\s\S]*PORT must be/,
    );
  });
});
