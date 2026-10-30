'use strict';
// MIT License — no asar signing required for open source builds.
exports.default = async function afterPack(_context) {
  console.log('[after-pack] Open source build — skipping asar signing.');
};
