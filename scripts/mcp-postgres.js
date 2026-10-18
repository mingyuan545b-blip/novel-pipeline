#!/usr/bin/env node
'use strict';

/**
 * Read-only PostgreSQL MCP wrapper.
 * Loads DATABASE_URL from the project .env so the connection string never
 * has to be written into .mcp.json or committed to the repository.
 *
 * Note: @modelcontextprotocol/server-postgres exposes a single read-only
 * query tool. For multi-database / performance analysis, replace this with
 * crystaldba/postgres-mcp or @bytebase/dbhub in restricted mode.
 */

const path = require('path');
const { spawn } = require('child_process');

require('dotenv').config({
    path: path.join(__dirname, '..', '.env'),
    // IMPORTANT: MCP uses stdout as the protocol channel. Keep dotenv quiet.
    quiet: true
});

const url = process.env.DATABASE_URL;
if (!url) {
    console.error('[mcp-postgres] DATABASE_URL is missing from .env');
    process.exit(1);
}

const entry = path.join(
    __dirname,
    '..',
    'node_modules',
    '@modelcontextprotocol',
    'server-postgres',
    'dist',
    'index.js'
);
const child = spawn(process.execPath, [entry, url], { stdio: 'inherit' });

child.on('error', (err) => {
    console.error('[mcp-postgres] failed to start:', err.message);
    process.exit(1);
});
child.on('exit', (code) => process.exit(code === null ? 1 : code));
