#!/usr/bin/env node
// Copies config/economy.json into prototype/economy.js so the prototype, a static page
// with no build step, can load the shared numbers with a plain <script> tag.
// Run after every change to economy.json:  node config/sync.js
// `node config/sync.js --check` exits 1 if the copy is out of date.
'use strict';
const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, 'economy.json');
const dst = path.join(__dirname, '..', 'prototype', 'economy.js');
const data = JSON.parse(fs.readFileSync(src, 'utf8'));
const text =
  '// GENERATED from config/economy.json by `node config/sync.js`. Do not edit by hand.\n' +
  '(function (root) {\n  const ECONOMY = ' + JSON.stringify(data) + ';\n' +
  "  if (typeof module !== 'undefined' && module.exports) module.exports = ECONOMY;\n  else root.ECONOMY = ECONOMY;\n" +
  "})(typeof window !== 'undefined' ? window : globalThis);\n";
if (process.argv.includes('--check')) {
  const have = fs.existsSync(dst) ? fs.readFileSync(dst, 'utf8') : '';
  if (have !== text) { console.error('prototype/economy.js is out of date. Run: node config/sync.js'); process.exit(1); }
  console.log('prototype/economy.js matches config/economy.json');
} else {
  fs.writeFileSync(dst, text);
  console.log('wrote ' + path.relative(process.cwd(), dst));
}
