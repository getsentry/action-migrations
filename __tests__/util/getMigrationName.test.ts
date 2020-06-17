import {getMigrationName} from '@app/util/getMigrationName';

test('gets filename without extension', () => {
  const input = getMigrationName('./src/sentry/migrations/001_testing.py');
  expect(input).toBe('001_testing');
});

test('gets filename when passed only filename with extension', () => {
  const input = getMigrationName('001_testing.py');
  expect(input).toBe('001_testing');
});
