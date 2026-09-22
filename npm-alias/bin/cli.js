#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const target = require.resolve('@cats-inc/cats-one/bin/cli.js');
const result = spawnSync(process.execPath, [target, ...process.argv.slice(2)], { stdio: 'inherit', windowsHide: true });
process.exit(result.status ?? 1);
