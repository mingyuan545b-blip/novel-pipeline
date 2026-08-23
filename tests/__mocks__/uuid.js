let counter = 0;
function v4() {
    counter++;
    return `mock-uuid-${counter}-${Date.now()}`;
}
module.exports = { v4, v1: v4, v3: v4, v5: v4, validate: () => true, version: () => 4 };
