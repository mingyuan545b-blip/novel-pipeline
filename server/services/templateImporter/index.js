const { validateTemplate, REQUIRED_SECTIONS, OPTIONAL_SECTIONS, MATERIAL_TYPES } = require('./templateValidator');
const { importTemplate } = require('./templateImporterCore');
const { exportProjectAsTemplate } = require('./templateExporter');

module.exports = { validateTemplate, importTemplate, exportProjectAsTemplate, REQUIRED_SECTIONS, OPTIONAL_SECTIONS, MATERIAL_TYPES };
