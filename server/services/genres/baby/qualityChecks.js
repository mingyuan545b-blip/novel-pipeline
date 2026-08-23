/**
 * baby/qualityChecks.js
 */
module.exports = {
  "qualityChecks": {
    "onomatopoeia": {
      "enabled": true,
      "minCount": 15,
      "levels": {
        "high": 5,
        "medium": 10,
        "low": 15
      }
    },
    "visualAnchors": {
      "enabled": true,
      "minCount": 3,
      "levels": {
        "high": 2,
        "medium": 3
      }
    },
    "motherChildDialogue": {
      "enabled": true,
      "minCount": 2,
      "levels": {
        "high": 0,
        "medium": 2
      }
    },
    "modernSlangExtra": true
  }
};
