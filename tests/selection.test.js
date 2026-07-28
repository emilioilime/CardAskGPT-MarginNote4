const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const source = fs.readFileSync(
  path.resolve(__dirname, "../src/main.js"),
  "utf8"
)

assert.match(source, /mindmapView\.selViewLst/)
assert.match(source, /function currentSelectedNotes/)
assert.match(source, /function selectionSignature/)
assert.match(source, /function scheduleSelectionSync/)
assert.match(source, /CardAskGPTPanelAPI\.enqueueCards/)
assert.match(source, /notes\.map\(function \(note\)/)
assert.match(
  source,
  /CardAskGPTPanelAPI\.enqueueCards\(extension\.panel, \[\], false\)/
)
assert.match(source, /if \(!notes\.length && fallbackNote\)/)
assert.match(
  source,
  /if \(signature === extension\.lastObservedSelectionSignature\)/
)
assert.doesNotMatch(
  source,
  /if \(!signature \|\| signature === extension\.lastObservedSelectionSignature\)/
)
assert.doesNotMatch(source, /lastObservedFocusNoteId/)

console.log("Selection synchronization structure test passed.")
