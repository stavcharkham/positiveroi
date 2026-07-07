// Shim so the documented `node --test packages/claude-plugin/test/` invocation
// works on Node 23+, where a bare directory argument is executed as an entry
// module (CJS directory resolution → this file) instead of being scanned for
// test files. Running the file directly also works:
//   node --test packages/claude-plugin/test/capture.test.mjs
module.exports = import("./capture.test.mjs");
