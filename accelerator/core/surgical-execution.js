#!/usr/bin/env node

'use strict';

const DENIAL =
  'Legacy generic execution is denied. Use an explicit controlled adapter capability.';

function execute() {
  throw new Error(DENIAL);
}

module.exports = { execute };
