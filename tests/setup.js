const { resetForTesting, closeDatabase } = require('../server/db/database');

afterAll(() => {
    closeDatabase();
});
