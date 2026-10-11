'use strict';
/** _lib.js — 验证会话公共库（HTTP + 落盘 + 断言） */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '.env'), override: true });
const http = require('http');
const fs = require('fs');
const path = require('path');
const SECRET = process.env.REQUEST_SECRET || '';

function api(method, p, body, timeoutMs = 120000) {
    return new Promise((resolve, reject) => {
        const data = body ? JSON.stringify(body) : null;
        const opts = { hostname: 'localhost', port: 3001, path: p, method,
            headers: { 'Authorization': 'Bearer ' + SECRET, 'Content-Type': 'application/json' }, timeout: timeoutMs };
        if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
        const r = http.request(opts, (res) => {
            let d = ''; res.on('data', c => d += c);
            res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(d) }); } catch (e) { resolve({ status: res.statusCode, data: d }); } });
        });
        r.on('error', reject); r.on('timeout', () => { r.destroy(); reject(new Error('timeout ' + timeoutMs)); });
        if (data) r.write(data); r.end();
    });
}
const get = (p) => api('GET', p, null);
const post = (p, b, t) => api('POST', p, b, t);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function out(name, obj) { fs.writeFileSync(path.join(__dirname, name), typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2)); }
function readId() { try { return fs.readFileSync(path.join(__dirname, 'project_id.txt'), 'utf8').trim(); } catch (e) { return process.env.PID_OVERRIDE || ''; } }

class Checker {
    constructor(title) { this.title = title; this.rows = []; }
    add(name, ok, detail) { this.rows.push({ name, ok: !!ok, detail: detail === undefined ? '' : detail }); }
    report() {
        const pass = this.rows.filter(r => r.ok).length;
        console.log(`\n===== ${this.title} (${pass}/${this.rows.length}) =====`);
        for (const r of this.rows) console.log(`  ${r.ok ? '✅' : '❌'} ${r.name}${r.detail ? '  — ' + r.detail : ''}`);
        return { pass, total: this.rows.length, rows: this.rows };
    }
}
module.exports = { api, get, post, sleep, out, readId, Checker };
