import {getMigrationNames} from '@app/util/getMigrationName';

test('handles garbage input', () => {
  const [[app, migration]] = [...getMigrationNames('', 'sentry')];
  expect(migration).toBe('');
  expect(app).toBe('sentry')
});

test('gets filename without extension', () => {
  const [[app, migration]] = [...getMigrationNames('./src/sentry/migrations/001_testing.py', 'notused')];
  expect(migration).toBe('001_testing');
  expect(app).toBe('sentry');
});

test('gets filename when passed only filename with extension', () => {
  const [[app, migration]] = [...getMigrationNames('001_testing.py', 'sentry')];
  expect(migration).toBe('001_testing');
  expect(app).toBe('sentry');
});

test('gets filename without extension', () => {
  const [[app, migration]] = [...getMigrationNames('./src/sentry/migrations/001_testing.py', 'notused')];
  expect(migration).toBe('001_testing');
  expect(app).toBe('sentry')
});

test('gets filename with partial path', () => {
  const [[app, migration]] = [...getMigrationNames('migrations/001_testing.py', 'sentry')];
  expect(migration).toBe('001_testing');
  expect(app).toBe('sentry');
});

test('gets application names from nested apps', () => {
  const [[app, migration]] = [...getMigrationNames('./src/sentry/feedback/migrations/001_testing.py', 'notused')];
  expect(migration).toBe('001_testing');
  expect(app).toBe('feedback')
});

test('preserve single quotes (e.g. if used to escape)', () => {
  const [[app, migration]] = [...getMigrationNames(`'foo/migrations/001_testing.py'`, 'notused')];
  expect(migration).toBe(`'001_testing'`);
  expect(app).toBe('foo');
});

test('handles multiple lines', () => {
    const input = `
src/sentry/migrations/0001_migration.py
src/sentry/feedback/migrations/0002_migration2.py
`;
    const ret = [...getMigrationNames(input, 'sentry')];
    expect(ret).toEqual([['sentry', '0001_migration'], ['feedback', '0002_migration2']]);
});
