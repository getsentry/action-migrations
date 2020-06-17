export function getMigrationName(name: string): string {
  return name
    .trim()
    .split('/')
    .slice(-1)[0]
    .replace('.py', '');
}
