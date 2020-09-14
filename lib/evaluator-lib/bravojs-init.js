/**
 *  @file       worker/evaluator-lib/bravojs-init.js
 *              Copyright (c) 2018, Kings Distributed Systems, Ltd.  All Rights Reserved.
 *
 *              This file sets up the environment for bravojs to load properly.
 *
 *  @author     Ryan Rossiter, ryan@kingsds.network
 *  @date       Sept 2020
 */

self.wrapScriptLoading({ scriptName: 'bravojs-init' }, () => {
  self.bravojs = {
    url: '/bravojs/bravo.js',
    mainModuleDir: '.'
  }
});
