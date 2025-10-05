const path = require('path');

process.env.TS_NODE_PROJECT = path.join(__dirname, '..', 'tsconfig.spec.json');
process.env.TS_NODE_TRANSPILE_ONLY = 'true';
require('ts-node/register');
require('tsconfig-paths/register');
