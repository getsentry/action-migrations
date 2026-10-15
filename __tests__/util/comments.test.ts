import {commentName, marker, planComment} from '@app/util/comments';

const HEADER = 'This PR has a migration; here is the generated SQL for ';

function body(name: string, files: string, sql: string): string {
  const intro = `${HEADER} \`${files}\`${name ? ` (${name})` : ''}`;
  return `${marker(name)}\n${intro}\n\n${sql}`;
}

function legacy(name: string, files: string, sql: string): string {
  return `${HEADER} \`${files}\`${name ? ` (${name})` : ''}\n\n${sql}`;
}

const human = {id: 99, body: 'lgtm', isBot: false};

test('commentName reads marker', () => {
  expect(commentName(body('primary', 'a.py', 'x'))).toBe('primary');
  expect(commentName(body('', 'a.py', 'x'))).toBe('');
});

test('commentName reads legacy comments', () => {
  expect(commentName(legacy('', 'a.py\nb.py', 'x'))).toBe('');
  expect(commentName(legacy('control', 'a.py\nb.py', 'x'))).toBe('control');
  expect(commentName(`<!-- ${HEADER} \`json-schema-changes\` -->\nx`)).toBe(
    ''
  );
});

test('commentName ignores other comments', () => {
  expect(commentName('lgtm')).toBeNull();
});

test('creates when no comment exists', () => {
  expect(planComment([human], '', body('', 'a.py', 'x'))).toEqual({
    updateId: null,
    create: true,
    deleteIds: [],
  });
});

test('updates in place when still at the bottom', () => {
  const comments = [
    human,
    {id: 1, body: body('primary', 'a.py', 'old'), isBot: true},
    {id: 2, body: body('control', 'a.py', 'old'), isBot: true},
  ];
  expect(planComment(comments, 'primary', body('primary', 'a.py', 'new'))).toEqual({
    updateId: 1,
    create: false,
    deleteIds: [],
  });
});

test('does nothing when unchanged even if buried', () => {
  const comments = [{id: 1, body: body('', 'a.py', 'x'), isBot: true}, human];
  expect(planComment(comments, '', body('', 'a.py', 'x'))).toEqual({
    updateId: null,
    create: false,
    deleteIds: [],
  });
});

test('reposts and deletes old comments when changed and buried', () => {
  const comments = [
    {id: 1, body: legacy('', '0020.py\n0021.py', 'x'), isBot: true},
    {id: 2, body: legacy('', '0021.py\n0022.py', 'x'), isBot: true},
    human,
  ];
  expect(planComment(comments, '', body('', '0022.py', 'y'))).toEqual({
    updateId: null,
    create: true,
    deleteIds: [1, 2],
  });
});

test('dedupes legacy comments when unchanged', () => {
  const comments = [
    {id: 1, body: legacy('', 'a.py', 'old'), isBot: true},
    human,
    {id: 2, body: legacy('', 'a.py', 'x'), isBot: true},
  ];
  expect(planComment(comments, '', body('', 'a.py', 'x'))).toEqual({
    updateId: 2,
    create: false,
    deleteIds: [1],
  });
});

test('only touches comments with the same name', () => {
  const comments = [
    {id: 1, body: body('control', 'a.py', 'x'), isBot: true},
    human,
  ];
  expect(planComment(comments, 'primary', body('primary', 'a.py', 'x'))).toEqual({
    updateId: null,
    create: true,
    deleteIds: [],
  });
});

test('ignores matching comments from non-bot users', () => {
  const comments = [{id: 1, body: body('', 'a.py', 'x'), isBot: false}];
  expect(planComment(comments, '', body('', 'a.py', 'x')).create).toBe(true);
});
