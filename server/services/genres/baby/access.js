/**
 * baby/access.js
 */
module.exports = {
  "writer": {
    "needs": [
      "character",
      "worldview",
      "relationship",
      "catchphrase",
      "famous-scene",
      "growth-history"
    ],
    "detail": "full"
  },
  "reviser": {
    "needs": [
      "character",
      "worldview",
      "relationship",
      "catchphrase",
      "famous-scene",
      "growth-history"
    ],
    "detail": "full"
  },
  "polisher": {
    "needs": [
      "character",
      "worldview",
      "relationship",
      "catchphrase",
      "famous-scene"
    ],
    "detail": "summary"
  },
  "intent-planner": {
    "needs": [
      "character",
      "worldview",
      "relationship",
      "famous-scene"
    ],
    "detail": "summary"
  },
  "first-review": {
    "needs": [
      "character",
      "worldview",
      "relationship",
      "catchphrase"
    ],
    "detail": "summary"
  },
  "second-review": {
    "needs": [
      "character",
      "worldview",
      "relationship",
      "catchphrase"
    ],
    "detail": "summary"
  },
  "fast-review": {
    "needs": [
      "character",
      "worldview",
      "relationship"
    ],
    "detail": "index"
  },
  "final-editor": {
    "needs": [
      "character",
      "worldview",
      "relationship",
      "catchphrase"
    ],
    "detail": "summary"
  },
  "material-manager": {
    "needs": [
      "character",
      "worldview",
      "relationship",
      "catchphrase",
      "famous-scene",
      "growth-history"
    ],
    "detail": "full"
  },
  "reader": {
    "needs": [
      "character",
      "worldview",
      "relationship"
    ],
    "detail": "summary"
  }
};
