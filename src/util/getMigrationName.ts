export function getMigrationName(name: string): string {
  const pathRegex = /([']?)(.*?)([']?)$/;

  const matches = name.trim().match(pathRegex);

  if (!matches) {
    return '';
  }

  const [, startQuote, path, endQuote] = matches;

  return `${startQuote}${path
    .split('/')
    .slice(-1)[0]
    .replace('.py', '')}${endQuote}`;
}
