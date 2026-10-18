#!/usr/bin/env node
'use strict';

/** PreToolUse guard: block destructive shell commands. */

const fs = require('fs');

let input = {};
try {
    input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
} catch {
    process.exit(0);
}

const command = String(input.tool_input?.command || '');
const blocked = [
    /git\s+reset\s+--hard/i,
    /git\s+push\s+.*--force/i,
    /git\s+clean\s+-[a-z]*f/i,
    /\brm\s+-rf\s+[\/~]/i,
    /\bdel\s+\/[fsq]/i,
    /\bformat\s+[a-z]:/i,
    />\s*\.env\b/i
];

if (blocked.some((pattern) => pattern.test(command))) {
    console.error(`[guard-bash] blocked destructive command: ${command}`);
    process.exit(2);
}

process.exit(0);
