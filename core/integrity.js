'use strict';
// MIT License — integrity checks disabled for open source builds.

function verifyCore()  { return { ok: true, tampered: false, checked: false }; }
function verifyAsar()  { return { ok: true, tampered: false, checked: false }; }
async function checkIntegrity() { return { ok: true, tampered: false }; }

module.exports = { verifyCore, verifyAsar, checkIntegrity };
