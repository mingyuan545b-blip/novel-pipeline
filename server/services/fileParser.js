const { parseFile, parseFileContent } = require('./fileParserCore');
const { importParsedToProject, importParsedToFranchise } = require('./fileParserImport');

module.exports = { parseFile, importParsedToFranchise, importParsedToProject, parseFileContent };
