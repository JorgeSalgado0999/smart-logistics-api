import { validateEnv } from './env.validation.js';

describe('validateEnv', () => {
  it('applies defaults when nothing is set', () => {
    expect(validateEnv({})).toEqual({
      STORAGE: 'memory',
      PORT: 3000,
      MONGO_URI: undefined,
      MONGO_DB: 'smart_logistics',
    });
  });

  it('treats blank values as unset', () => {
    expect(validateEnv({ STORAGE: '  ', PORT: '' })).toMatchObject({
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

  it('accepts mongo storage with a URI', () => {
    expect(
      validateEnv({
        STORAGE: 'mongo',
        MONGO_URI: 'mongodb://localhost:27017',
        MONGO_DB: 'my_db',
      }),
    ).toEqual({
      STORAGE: 'mongo',
      PORT: 3000,
      MONGO_URI: 'mongodb://localhost:27017',
      MONGO_DB: 'my_db',
    });
  });

  it('accepts a mongodb+srv URI', () => {
    expect(
      validateEnv({
        STORAGE: 'mongo',
        MONGO_URI: 'mongodb+srv://cluster.example.net',
      }).MONGO_URI,
    ).toBe('mongodb+srv://cluster.example.net');
  });

  it('requires MONGO_URI when STORAGE=mongo', () => {
    expect(() => validateEnv({ STORAGE: 'mongo' })).toThrow(
      /MONGO_URI is required/,
    );
  });

  it('rejects a MONGO_URI without the mongodb scheme', () => {
    expect(() =>
      validateEnv({ STORAGE: 'mongo', MONGO_URI: 'http://localhost' }),
    ).toThrow(/MONGO_URI must start with/);
  });

  it.each(['my.db', 'a b', 'x'.repeat(64), 'db$'])(
    'rejects MONGO_DB=%p',
    (db) => {
      expect(() => validateEnv({ MONGO_DB: db })).toThrow(/MONGO_DB must be/);
    },
  );

  it('lists every problem in one error', () => {
    expect(() => validateEnv({ STORAGE: 'redis', PORT: 'x' })).toThrow(
      /STORAGE must be[\s\S]*PORT must be/,
    );
  });
});
