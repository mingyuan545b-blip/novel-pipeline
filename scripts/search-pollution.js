require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const PID = 'f3f70acb-1a6a-4271-ba27-0afdb27b6493';
const KEYWORD = '纹身';

async function search() {
    // Get all tables in public schema
    const tableRes = await pool.query(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
    );
    console.log('=== Searching for pollution keyword:', KEYWORD, 'in project:', PID, '===');

    for (const { tablename } of tableRes.rows) {
        try {
            // Get columns for this table
            const colRes = await pool.query(
                "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1",
                [tablename]
            );
            const cols = colRes.rows.map(r => r.column_name);

            // Check if table has project_id column
            if (!cols.includes('project_id')) continue;

            // Build search query - search all text columns
            const textCols = cols.filter(c => {
                return !['id', 'project_id', 'created_at', 'updated_at'].includes(c);
            });

            if (textCols.length === 0) continue;

            const conditions = textCols.map((c, i) => `CAST("${c}" AS TEXT) LIKE $${i + 2}`).join(' OR ');
            const params = [PID, ...textCols.map(() => `%${KEYWORD}%`)];

            const q = `SELECT id, ${textCols.map(c => `substring(CAST("${c}" AS TEXT), 1, 300)`).join(', ')} FROM "${tablename}" WHERE project_id = $1 AND (${conditions})`;
            const r = await pool.query(q, params);

            if (r.rows.length > 0) {
                console.log(`\nTABLE: ${tablename} | Polluted rows: ${r.rows.length}`);
                r.rows.forEach(row => {
                    console.log('  id:', row.id);
                    textCols.forEach(c => {
                        if (row[c] && row[c].includes(KEYWORD)) {
                            console.log(`  ${c}:`, row[c].slice(0, 300));
                        }
                    });
                });
            }
        } catch (e) {
            // Skip tables with wrong structure
        }
    }

    // Also search without project_id filter (global pollution)
    console.log('\n=== Global search (no project filter) ===');
    for (const { tablename } of tableRes.rows) {
        try {
            const colRes = await pool.query(
                "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1",
                [tablename]
            );
            const cols = colRes.rows.map(r => r.column_name);
            const textCols = cols.filter(c => !['id', 'created_at', 'updated_at'].includes(c));
            if (textCols.length === 0) continue;

            const conditions = textCols.map((c, i) => `CAST("${c}" AS TEXT) LIKE $${i + 1}`).join(' OR ');
            const params = textCols.map(() => `%${KEYWORD}%`);

            const q = `SELECT id, project_id, ${textCols.map(c => `substring(CAST("${c}" AS TEXT), 1, 200)`).join(', ')} FROM "${tablename}" WHERE ${conditions} LIMIT 5`;
            const r = await pool.query(q, params);

            if (r.rows.length > 0) {
                console.log(`TABLE: ${tablename} | Rows with '${KEYWORD}': ${r.rows.length}`);
                r.rows.forEach(row => {
                    console.log('  id:', row.id, '| project_id:', row.project_id || '(none)');
                });
            }
        } catch (e) {
            // Skip
        }
    }

    await pool.end();
}

search().catch(e => { console.error(e); process.exit(1); });
