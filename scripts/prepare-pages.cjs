const { copyFileSync } = require('node:fs');
const { join } = require('node:path');

copyFileSync(join(__dirname, '..', 'dist', 'dist.js'), join(__dirname, '..', 'public', 'dist.js'));
