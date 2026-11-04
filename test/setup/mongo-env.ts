/**
 * Env for `npm run test:e2e:mongo`. Set here rather than on the command
 * line so the script also works on Windows.
 *
 * MONGO_DB is always a test database, which the tests drop. Point the suite
 * at another server with TEST_MONGO_URI; a shell's MONGO_URI is ignored so
 * tests never touch the database the app uses.
 */
process.env.STORAGE = 'mongo';
process.env.MONGO_URI =
  process.env.TEST_MONGO_URI ?? 'mongodb://127.0.0.1:27017';
process.env.MONGO_DB = 'smart_logistics_test';
