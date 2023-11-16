/**
 * @file    .eslintrc.js - ESLint configuration file, following the Core Team's JS Style Guide.
 *
 * @author  Wes Garland <wes@distributive.network>
 * @author  Bryan Hoang <bryan@distributive.network>
 * @date    Mar. 2022, Sep. 2023
 */

'use strict';

/**
 * @see {@link https://eslint.org/docs/latest/use/configure/}
 * @type {import('eslint').Linter.Config}
 */
module.exports = {
  root: true,
  reportUnusedDisableDirectives: true,
  extends: ['eslint:recommended', '@distributive'],
  env: {
    node: true,
    es2022: true,
  },
  globals: {
    dcpConfig: true,
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'script',
  },
  rules: {},
};
