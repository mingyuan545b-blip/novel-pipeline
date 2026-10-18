#!/usr/bin/env node
'use strict';

/**
 * PostToolUse hook: run ESLint --fix on the file that was just edited.
 * It never blocks the tool call; it only surfaces lint output to the agent.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

let input = {};
try {
    input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
} catch {
    process.exit(0);
}

const rawPath = input.tool_input?.file_path || input.tool_input?.filePath || input.tool_input?.path;
if (!rawPath || !/\.(js|jsx)$/.test(rawPath)) process.exit(0);

const abs = path.resolve(input.cwd || process.cwd(), rawPath);
if (!fs.existsSync(abs)) process.exit(0);

const rel = path.relative(process.cwd(), abs).split(path.sep).join('/');
// client/ has its own ESLint config and is linted by its own extension/CI.
if (!/^(server|scripts|tests)\//.test(rel)) process.exit(0);

// Spawn the ESLint entry with the current Node binary. Spawning the .cmd
// shim directly fails with EINVAL on Windows (Node 24).
const eslintEntry = path.join(process.cwd(), 'node_modules', 'eslint', 'bin', 'eslint.js');
const result = spawnSync(process.execPath, [eslintEntry, '--fix', '--no-warn-ignored', rel], {
    cwd: process.cwd(),
    stdio: 'inherit',
    timeout: 15000
});

if (result.error) {
    console.error('[lint-edited] eslint failed:', result.error.message);
}

process.exit(0);
