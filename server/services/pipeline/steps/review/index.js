const { handleFirstReview } = require('./firstReview');
const { handleFastReview } = require('./fastReview');
const { handleSecondReview } = require('./secondReview');
const { checkWordCountGate } = require('./wordCountGate');

module.exports = { handleFirstReview, handleFastReview, handleSecondReview, checkWordCountGate };
