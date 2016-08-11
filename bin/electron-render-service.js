#!/usr/bin/env node

const path = require('path');
const electron = require('electron');
const proc = require('child_process');

const args = path.join(__dirname, '../src/server.js');
const child = proc.spawn(electron, [args], { stdio: 'inherit' });

child.on('close', code => process.exit(code));
