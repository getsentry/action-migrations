import * as core from '@actions/core';

export type IssueComment = {
  id: number;
  body: string;
  isBot: boolean;
};

export type CommentClient = {
  list(): Promise<IssueComment[]>;
  create(body: string): Promise<void>;
  update(id: number, body: string): Promise<void>;
  remove(id: number): Promise<void>;
};

export type CommentPlan = {
  updateId: number | null;
  create: boolean;
  deleteIds: number[];
};

const HEADER = 'This PR has a migration; here is the generated SQL for ';

const MARKER_RE = /^<!-- action-migrations:name=(.*?) -->\n?/;

// Matches the intro of comments posted before the marker was added.
const LEGACY_RE = new RegExp(
  `^(?:<!-- )?${HEADER} \`[^\`]*\`(?: \\((.*)\\))?(?: -->)?(?:\\n|$)`
);

export function marker(name: string): string {
  return `<!-- action-migrations:name=${name} -->`;
}

export function commentIntro(migration: string, name: string): string {
  return `${HEADER} \`${migration}\`${name ? ` (${name})` : ''}`;
}

// Returns the `name` input that produced the comment, or null if this action
// did not post it.
export function commentName(body: string): string | null {
  const markerMatch = body.match(MARKER_RE);
  if (markerMatch) {
    return markerMatch[1];
  }
  const legacyMatch = body.match(LEGACY_RE);
  if (legacyMatch) {
    return legacyMatch[1] ?? '';
  }
  return null;
}

function stripMarker(body: string): string {
  return body.replace(MARKER_RE, '');
}

function ownComments(comments: IssueComment[], name: string): IssueComment[] {
  return comments.filter(c => c.isBot && commentName(c.body) === name);
}

// Keep a single comment per name. Edit it in place when nothing but our own
// comments follow it or the content is unchanged; otherwise post a new one at
// the bottom and delete the old ones.
export function planComment(
  comments: IssueComment[],
  name: string,
  body: string
): CommentPlan {
  const ours = ownComments(comments, name);
  if (ours.length === 0) {
    return {updateId: null, create: true, deleteIds: []};
  }

  const latest = ours[ours.length - 1];
  const atBottom = comments
    .slice(comments.indexOf(latest) + 1)
    .every(c => c.isBot && commentName(c.body) !== null);
  const unchanged = stripMarker(latest.body) === stripMarker(body);

  if (atBottom || unchanged) {
    return {
      updateId: latest.body === body ? null : latest.id,
      create: false,
      deleteIds: ours.slice(0, -1).map(c => c.id),
    };
  }

  return {updateId: null, create: true, deleteIds: ours.map(c => c.id)};
}

export async function syncComment(
  client: CommentClient,
  name: string,
  body: string
): Promise<void> {
  const plan = planComment(await client.list(), name, body);

  if (plan.updateId !== null) {
    await client.update(plan.updateId, body);
  }
  if (plan.create) {
    await client.create(body);
  }

  // Delete after posting so a failed post never leaves the PR without SQL.
  await deleteComments(client, plan.deleteIds);
}

// Delete every comment for this name, e.g. when the PR no longer has any SQL
// to show, so stale SQL or a placeholder isn't left behind.
export async function removeComments(
  client: CommentClient,
  name: string
): Promise<void> {
  const ids = ownComments(await client.list(), name).map(c => c.id);
  await deleteComments(client, ids);
}

async function deleteComments(
  client: CommentClient,
  ids: number[]
): Promise<void> {
  for (const id of ids) {
    try {
      await client.remove(id);
    } catch (error) {
      core.warning(`Failed to delete comment ${id}: ${error}`);
    }
  }
}

export async function createPlaceholder(
  client: CommentClient,
  name: string,
  body: string
): Promise<void> {
  if (ownComments(await client.list(), name).length === 0) {
    await client.create(body);
  }
}
