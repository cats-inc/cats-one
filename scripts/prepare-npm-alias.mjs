import { copyFileSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));

export function createAliasManifest(canonical) {
  if (canonical.name !== '@cats-inc/cats-one' || !canonical.version) {
    throw new Error('The alias must be generated from the canonical cats-one manifest.');
  }
  return {
    name: 'cats-one',
    version: canonical.version,
    description: 'Bootstrap installer entrypoint for the Cats ecosystem (unscoped alias of @cats-inc/cats-one).',
    bin: { 'cats-one': 'bin/cli.js' },
    dependencies: { '@cats-inc/cats-one': canonical.version },
    license: canonical.license,
    repository: canonical.repository,
    homepage: canonical.homepage,
    bugs: canonical.bugs,
    keywords: canonical.keywords,
    engines: canonical.engines,
    publishConfig: { access: 'public' },
    files: ['bin/', 'README.md', 'LICENSE'],
  };
}

export function prepareNpmAlias(outputDirectory = join(repositoryRoot, '.npm', 'alias')) {
  const directory = resolve(outputDirectory);
  const canonical = JSON.parse(readFileSync(join(repositoryRoot, 'package.json'), 'utf8'));
  const manifest = createAliasManifest(canonical);
  mkdirSync(join(directory, 'bin'), { recursive: true });
  copyFileSync(join(repositoryRoot, 'npm-alias', 'bin', 'cli.js'), join(directory, 'bin', 'cli.js'));
  for (const name of ['README.md', 'LICENSE']) {
    copyFileSync(join(repositoryRoot, name), join(directory, name));
  }
  writeFileSync(join(directory, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return { directory, manifest };
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { directory, manifest } = prepareNpmAlias();
  console.log(`Prepared ${manifest.name}@${manifest.version} in ${directory}`);
}
