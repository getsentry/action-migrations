export type Comment = {
  id: number;
  body: string;
  isBot: boolean;
};

export type CommentPlan = {
  updateId: number | null;
  create: boolean;
  deleteIds: number[];
};

const MARKER_RE = /^<!-- action-migrations:name=(.*?) -->\n?/;

// Comments posted before the marker was added. The name suffix is only present
// when the `name` input was set.
const LEGACY_RE =
  /^(?:<!-- )?This PR has a migration; here is the generated SQL for {2}`[^`]*`(?: \(([^)]*)\))?/;

export function marker(name: string): string {
  return `<!-- action-migrations:name=${name} -->`;
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

// Keep a single comment per name. Edit it in place when nothing but our own
// comments follow it or the content is unchanged; otherwise post a new one at
// the bottom and delete the old ones.
export function planComment(
  comments: Comment[],
  name: string,
  body: string
): CommentPlan {
  const ours = comments.filter(c => c.isBot && commentName(c.body) === name);
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
