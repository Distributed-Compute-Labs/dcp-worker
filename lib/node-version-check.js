/**
 * @file     node-version-check.js - preload module
 * @author   Wes Garland, wes@distributive.network
 * @date     Sep 2024
 */
'use strict';

if (!(parseInt(process.versions.node, 10) >= 18))
{
  console.error(`Your version of node (${process.version}) is far to old to run this program. Please upgrade to a supported version of Node.js.`);
  console.error('For more information, visit', require('../package').homepage);
  process.exit(1);
}
