const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres@localhost:5432/novel_pipeline' });

const PID = 'f3f70acb-1a6a-4271-ba27-0afdb27b6493';

(async () => {
    // Clean chapters
    const ch = await pool.query("DELETE FROM chapters WHERE projectid = $1", [PID]);
    console.log('Chapters deleted:', ch.rowCount);

    // Clean chapter-outlines from kv_store
    const co = await pool.query("DELETE FROM kv_store WHERE type = 'chapter-outlines' AND data LIKE $1", [`%${PID}%`]);
    console.log('Chapter-outlines deleted:', co.rowCount);

    // Clean infinite pipeline state
    const ips = await pool.query("DELETE FROM kv_store WHERE type = 'infinite-pipeline-state' AND data LIKE $1", [`%${PID}%`]);
    console.log('Pipeline state deleted:', ips.rowCount);

    // Clean reviews
    const rv = await pool.query("DELETE FROM kv_store WHERE type = 'reviews' AND data LIKE $1", [`%${PID}%`]);
    console.log('Reviews deleted:', rv.rowCount);

    // Clean pipeline logs
    const pl = await pool.query("DELETE FROM kv_store WHERE type = 'pipeline-logs' AND data LIKE $1", [`%${PID}%`]);
    console.log('Pipeline logs deleted:', pl.rowCount);

    await pool.end();
})();
