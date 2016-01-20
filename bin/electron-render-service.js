#!/usr/bin/env node

var path = require('path');
var electron = require('electron-prebuilt');
var proc = require('child_process');

var child = proc.spawn(electron, [path.join(__dirname, '../lib/server.js')], { stdio: 'inherit' });

child.on('close', function childExit(code) {
  process.exit(code);
});
