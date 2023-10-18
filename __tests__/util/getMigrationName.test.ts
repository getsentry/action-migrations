import {getMigrationName} from '@app/util/getMigrationName';

test('handles garbage input', () => {
  const [app, migration] = getMigrationName('', 'sentry');
  expect(migration).toBe('');
  expect(app).toBe('sentry')
});

test('gets filename without extension', () => {
  const [app, migration] = getMigrationName('./src/sentry/migrations/001_testing.py', 'notused');
  expect(migration).toBe('001_testing');
  expect(app).toBe('sentry');
});

test('gets filename when passed only filename with extension', () => {
  const [app, migration] = getMigrationName('001_testing.py', 'sentry');
  expect(migration).toBe('001_testing');
  expect(app).toBe('sentry');
});

test('gets filename without extension', () => {
  const [app, migration] = getMigrationName('./src/sentry/migrations/001_testing.py', 'notused');
  expect(migration).toBe('001_testing');
  expect(app).toBe('sentry')
});

test('gets filename with partial path', () => {
  const [app, migration] = getMigrationName('migrations/001_testing.py', 'sentry');
  expect(migration).toBe('001_testing');
  expect(app).toBe('sentry');
});

test('gets application names from nested apps', () => {
  const [app, migration] = getMigrationName('./src/sentry/feedback/migrations/001_testing.py', 'notused');
  expect(migration).toBe('001_testing');
  expect(app).toBe('feedback')
});

test('preserve single quotes (e.g. if used to escape)', () => {
  const [app, migration] = getMigrationName(`'foo/migrations/001_testing.py'`, 'notused');
  expect(migration).toBe(`'001_testing'`);
  expect(app).toBe('foo');
});
