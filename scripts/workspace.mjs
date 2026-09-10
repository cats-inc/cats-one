#!/usr/bin/env node
import { realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { inspectWorkspace } from './shared/workspace-plan.mjs';

const HELP = `Cats developer workspace (checkout command; read-only phase)

Usage:
  node cats-one/scripts/workspace.mjs sync --root <parent> [--agent codex|claude|all] --dry-run
  node cats-one/scripts/workspace.mjs check --root <parent> [--agent codex|claude|all]

Options:
  --root <parent>   Required existing parent of all four Cats checkouts
  --agent <target>  Selected skill mirror; defaults to codex
  --dry-run        Preview sync without writing; required for sync in this phase
  -h, --help       Show help without a root or installed developer dependencies

Setup once in the cats-one checkout: npm ci --include=dev
Commands run offline and never install dependencies or start services.
Exit codes: 0 = successful preview / in-sync check; 1 = check found drift;
            2 = invalid input, conflict, pending apply or I/O failure.
`;

export async function main(args = process.argv.slice(2)) {
  try {
    const { values, positionals, tokens } = parseArgs({ args, allowPositionals: true, strict: true, tokens: true, options: {
      root: { type: 'string' }, agent: { type: 'string' },
      'dry-run': { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
    } });
    const options = tokens.filter(token => token.kind === 'option').map(token => token.name);
    if (new Set(options).size !== options.length) throw new Error('Repeated options are not supported');
    if (positionals.length > 1 || (positionals[0] && !['sync', 'check'].includes(positionals[0]))) {
      throw new Error('Expected exactly one command: sync or check');
    }
    if (values.help) { process.stdout.write(HELP); return 0; }
    const command = positionals[0];
    if (!command) throw new Error('A command is required: sync or check. Use --help for usage.');
    if (!values.root?.trim()) throw new Error('An explicit --root is required');
    if (command === 'check' && values['dry-run']) throw new Error('check is already read-only; --dry-run is only valid with sync');
    if (command === 'sync' && !values['dry-run']) throw new Error('Materialization is not implemented yet. Use sync --dry-run or check; no files were written.');
    const checkoutRoot = fileURLToPath(new URL('../', import.meta.url));
    const report = await inspectWorkspace({ root: values.root, checkoutRoot, agent: values.agent ?? 'codex' });
    process.stdout.write(`Read-only ${command === 'sync' ? 'preview' : 'check'}: ${report.manifest.members.length} members, ${report.skills.length} canonical skills, target ${values.agent ?? 'codex'}\n`);
    for (const entry of report.actions) {
      process.stdout.write(`${entry.action.padEnd(9)} ${entry.path} <- ${entry.member}/${entry.source} (${entry.reason})\n`);
    }
    if (report.hasConflicts) return 2;
    return command === 'check' && report.hasDrift ? 1 : 0;
  } catch (error) {
    process.stderr.write(`workspace: ${error.message}\n`);
    return 2;
  }
}

// Node resolves module URLs physically; argv can retain an ancestor alias
// (for example /var versus /private/var on macOS). Compare the same form.
const entryPath = process.argv[1] ? await realpath(process.argv[1]).catch(() => null) : null;
if (entryPath === await realpath(fileURLToPath(import.meta.url))) {
  process.exitCode = await main();
}
