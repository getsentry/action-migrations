import * as core from '@actions/core';

import {
  CommentClient,
  IssueComment,
  commentIntro,
  commentName,
  createPlaceholder,
  marker,
  planComment,
  removeComments,
  syncComment,
} from '@app/util/comments';

jest.mock('@actions/core');

function body(name: string, migration: string, sql: string): string {
  return `${marker(name)}\n${commentIntro(migration, name)}\n\n${sql}`;
}

function legacy(name: string, migration: string, sql: string): string {
  return `${commentIntro(migration, name)}\n\n${sql}`;
}

function legacyRaw(name: string, migration: string, sql: string): string {
  return `<!-- ${commentIntro(migration, name)} -->\n${sql}`;
}

function bot(id: number, text: string): IssueComment {
  return {id, body: text, isBot: true};
}

const human: IssueComment = {id: 99, body: 'lgtm', isBot: false};

describe('commentName', () => {
  test('reads the marker', () => {
    expect(commentName(body('primary', 'a.py', 'x'))).toBe('primary');
    expect(commentName(body('', 'a.py', 'x'))).toBe('');
  });

  test('reads legacy comments', () => {
    expect(commentName(legacy('', 'a.py\nb.py', 'x'))).toBe('');
    expect(commentName(legacy('control', 'a.py\nb.py', 'x'))).toBe('control');
    expect(commentName(legacy('a (b)', 'a.py', 'x'))).toBe('a (b)');
  });

  test('reads legacy raw comments', () => {
    expect(commentName(legacyRaw('', 'json-schema-changes', 'x'))).toBe('');
    expect(commentName(legacyRaw('raw', 'json-schema-changes', 'x'))).toBe(
      'raw'
    );
  });

  test('reads legacy placeholders', () => {
    expect(commentName(legacy('primary', 'a.py', '```\nwait\n```'))).toBe(
      'primary'
    );
  });

  test('ignores other comments', () => {
    expect(commentName('lgtm')).toBeNull();
    expect(commentName(`> ${legacy('', 'a.py', 'x')}`)).toBeNull();
  });
});

describe('planComment', () => {
  test('creates when no comment exists', () => {
    expect(planComment([human], '', body('', 'a.py', 'x'))).toEqual({
      updateId: null,
      create: true,
      deleteIds: [],
    });
  });

  test('updates in place when only our comments follow it', () => {
    const comments = [
      human,
      bot(1, body('primary', 'a.py', 'old')),
      bot(2, body('control', 'a.py', 'old')),
    ];
    expect(
      planComment(comments, 'primary', body('primary', 'a.py', 'new'))
    ).toEqual({updateId: 1, create: false, deleteIds: []});
  });

  test('does nothing when unchanged even if buried', () => {
    const comments = [bot(1, body('', 'a.py', 'x')), human];
    expect(planComment(comments, '', body('', 'a.py', 'x'))).toEqual({
      updateId: null,
      create: false,
      deleteIds: [],
    });
  });

  test('adds the marker to an unchanged legacy comment', () => {
    const comments = [bot(1, legacy('', 'a.py', 'x')), human];
    expect(planComment(comments, '', body('', 'a.py', 'x'))).toEqual({
      updateId: 1,
      create: false,
      deleteIds: [],
    });
  });

  test('reposts and deletes old comments when changed and buried', () => {
    const comments = [
      bot(1, legacy('', '0020.py\n0021.py', 'x')),
      bot(2, legacy('', '0021.py\n0022.py', 'x')),
      human,
    ];
    expect(planComment(comments, '', body('', '0022.py', 'y'))).toEqual({
      updateId: null,
      create: true,
      deleteIds: [1, 2],
    });
  });

  test('treats other bots as burying the comment', () => {
    const comments = [
      bot(1, body('', 'a.py', 'x')),
      bot(2, 'Codecov report'),
    ];
    expect(planComment(comments, '', body('', 'a.py', 'y')).create).toBe(true);
  });

  test('keeps the latest and deletes older duplicates', () => {
    const comments = [
      bot(1, legacy('', 'a.py', 'old')),
      human,
      bot(2, legacy('', 'a.py', 'x')),
    ];
    expect(planComment(comments, '', body('', 'a.py', 'x'))).toEqual({
      updateId: 2,
      create: false,
      deleteIds: [1],
    });
  });

  test('only touches comments with the same name', () => {
    const comments = [bot(1, body('control', 'a.py', 'x')), human];
    expect(
      planComment(comments, 'primary', body('primary', 'a.py', 'x'))
    ).toEqual({updateId: null, create: true, deleteIds: []});
  });

  test('ignores matching comments from non-bot users', () => {
    const comments = [{id: 1, body: body('', 'a.py', 'x'), isBot: false}];
    expect(planComment(comments, '', body('', 'a.py', 'x')).create).toBe(true);
  });
});

function fakeClient(initial: IssueComment[]): {
  client: CommentClient;
  comments: IssueComment[];
  calls: string[];
} {
  const comments = [...initial];
  const calls: string[] = [];
  let nextId = 1000;
  const client: CommentClient = {
    async list() {
      return [...comments];
    },
    async create(text) {
      calls.push('create');
      comments.push(bot(nextId++, text));
    },
    async update(id, text) {
      calls.push(`update ${id}`);
      comments.find(c => c.id === id)!.body = text;
    },
    async remove(id) {
      calls.push(`remove ${id}`);
      comments.splice(
        comments.findIndex(c => c.id === id),
        1
      );
    },
  };
  return {client, comments, calls};
}

describe('syncComment', () => {
  test('posts before deleting old comments', async () => {
    const {client, comments, calls} = fakeClient([
      bot(1, body('', 'a.py', 'x')),
      human,
    ]);
    const next = body('', 'b.py', 'y');
    await syncComment(client, '', next);
    expect(calls).toEqual(['create', 'remove 1']);
    expect(comments.map(c => c.body)).toEqual(['lgtm', next]);
  });

  test('is stable when run again', async () => {
    const {client, calls} = fakeClient([human]);
    await syncComment(client, '', body('', 'a.py', 'x'));
    await syncComment(client, '', body('', 'a.py', 'x'));
    expect(calls).toEqual(['create']);
  });

  test('keeps deleting when one delete fails', async () => {
    const {client, calls} = fakeClient([
      bot(1, legacy('', 'a.py', 'x')),
      bot(2, legacy('', 'b.py', 'x')),
      human,
    ]);
    const remove = client.remove;
    client.remove = async id => {
      await remove(id);
      if (id === 1) {
        throw new Error('gone');
      }
    };
    await syncComment(client, '', body('', 'c.py', 'y'));
    expect(calls).toEqual(['create', 'remove 1', 'remove 2']);
    expect(core.warning).toHaveBeenCalledWith(
      'Failed to delete comment 1: Error: gone'
    );
  });

  test('does not delete when posting fails', async () => {
    const {client, calls} = fakeClient([bot(1, body('', 'a.py', 'x')), human]);
    client.create = async () => {
      throw new Error('nope');
    };
    await expect(
      syncComment(client, '', body('', 'b.py', 'y'))
    ).rejects.toThrow('nope');
    expect(calls).toEqual([]);
  });
});

describe('createPlaceholder', () => {
  test('creates when missing', async () => {
    const {client, calls} = fakeClient([bot(1, body('control', 'a.py', 'x'))]);
    await createPlaceholder(client, 'primary', body('primary', 'a.py', 'wait'));
    expect(calls).toEqual(['create']);
  });

  test('skips when a comment exists', async () => {
    const {client, calls} = fakeClient([bot(1, legacy('primary', 'a.py', 'x'))]);
    await createPlaceholder(client, 'primary', body('primary', 'a.py', 'wait'));
    expect(calls).toEqual([]);
  });
});

describe('removeComments', () => {
  test('removes only comments for this name', async () => {
    const {client, comments, calls} = fakeClient([
      bot(1, body('primary', 'a.py', 'x')),
      human,
      bot(2, legacy('primary', 'a.py', 'wait')),
      bot(3, body('control', 'a.py', 'x')),
    ]);
    await removeComments(client, 'primary');
    expect(calls).toEqual(['remove 1', 'remove 2']);
    expect(comments.map(c => c.id)).toEqual([99, 3]);
  });

  test('does nothing when there is no comment', async () => {
    const {client, calls} = fakeClient([human]);
    await removeComments(client, 'primary');
    expect(calls).toEqual([]);
  });
});
