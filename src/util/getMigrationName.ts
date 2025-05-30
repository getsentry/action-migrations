type MigrationName = [appLabel: string, name: string];

export function* getMigrationNames(name: string, fallbackApp: string): Generator<MigrationName> {
  for (const part of name.trim().split(/\s+/)) {
    const parts = part.split('/');
    const relevantParts = parts.slice(-3);

    const migrationName = stripExtension(relevantParts.pop() ?? '');

    // Not enough paths segments to determine the app name.
    if (relevantParts.length < 2) {
      yield [fallbackApp, migrationName];
    } else {
      let appName = fallbackApp;
      if (relevantParts[relevantParts.length - 1] === 'migrations') {
        appName = relevantParts[relevantParts.length - 2] ?? fallbackApp;
      } else {
        appName = relevantParts.pop() ?? fallbackApp;
      }
      if (appName && appName.startsWith("'")) {
        appName = appName.slice(1);
      }

      yield [appName, migrationName];
    }
  }
}

const quotePattern = /(.*?)([']?)$/;

function stripExtension(name: string): string {
  const matches = name.trim().match(quotePattern);
  if (!matches) {
    return name;
  }
  let [, migration, quote] = matches;
  migration = migration.replace('.py', '');

  return `${quote}${migration}${quote}`;
}
