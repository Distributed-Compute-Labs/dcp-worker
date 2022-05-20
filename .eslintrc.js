module.exports = {
  'env': {
    'browser': true,
    'commonjs': true,
    'es2021': true,
    'node': true
  },
  'extends': 'eslint:recommended',
  'parserOptions': {
    'ecmaVersion': 13
  },
  globals: {
    dcpConfig: true
  },
  'rules': {
    'indent': [
      'warn',
      2,
      {
        'SwitchCase': 1,
        'ignoredNodes': ['CallExpression', 'ForStatement'],
      }
    ],
    'linebreak-style': [
      'error',
      'unix'
    ],
    'quotes': [
      'warn',
      'single'
    ],
    'func-call-spacing': [
      'off', 'never'
    ],
    'no-prototype-builtins': 'off',
    'quotes': ['warn', 'single', 'avoid-escape'],
    'no-unused-vars': ['warn', { 'vars': 'all', 'args': 'none', 'ignoreRestSiblings': false }],
    'no-empty': [ 'warn' ],
    'no-trailing-spaces': [
      'off', {
        skipBlankLines: true,
        ignoreComments: true
      }
    ],
    'no-multi-spaces': [
      'off',
    ],
    'prettier/prettier': [
      'off',
    ],
    'vars-on-top': [
      'error',
    ],
    'no-var': [
      'off',
    ],
    'spaced-comment': [
      'warn',
    ],
    'brace-style': [
      /* 'warn', 'allman', { 'allowSingleLine': true } */
      'off'
    ],
    'no-eval': [
      'error',
    ],
    'object-curly-spacing': [
      'warn',
      'always'
    ],
    'no-dupe-keys':             [ 'warn' ],
    'no-constant-condition':    [ 'warn' ],
    'no-extra-boolean-cast':    [ 'warn' ],
    'no-sparse-arrays':         [ 'off' ],
    'no-inner-declarations':    [ 'off' ],
    'no-loss-of-precision':     [ 'warn' ],
    'require-atomic-updates':   [ 'warn' ], /* watch for false positives, remove if (m)any */
    'eqeqeq':                   [ 'warn', 'always' ],
    'no-dupe-keys':             [ 'warn' ],
    'no-dupe-class-members':    [ 'warn' ],
    'no-fallthrough':           [ 'warn', { commentPattern: 'fall[ -]*through' }],
    'no-invalid-this':          [ 'error' ],
    'no-return-assign':         [ 'error' ],
    'no-return-await':          [ 'warn' ],
    'no-unused-expressions':    [ 'warn', { allowShortCircuit: true, allowTernary: true } ],
    'prefer-promise-reject-errors': [ 'error' ],
    'no-throw-literal':         [ 'error' ],
    'semi':                     [ 'off', { omitLastInOneLineBlock: true }], /* does not work right with exports.X = function allmanStyle */
    'semi-style':               [ 'warn', 'last' ],
    'semi-spacing':             [ 'error', {'before': false, 'after': true}],
    'no-extra-semi':            [ 'warn' ],
    'no-tabs':                  [ 'error' ],
    'symbol-description':       [ 'error' ],
    'operator-linebreak':       [ 'warn', 'before' ],
    'new-cap':                  [ 'warn' ],
    'consistent-this':          [ 'error', 'that' ],
    'no-use-before-define':     [ 'error', { functions: false, classes: false } ],
    'no-shadow':                [ 'error' ],
    'no-label-var':             [ 'error' ],
    'radix':                    [ 'error' ],
    'no-self-compare':          [ 'error' ],
    'require-await':            [ 'error' ],
    'require-yield':            [ 'error' ],
    'no-promise-executor-return':       [ 'off' ],
    'no-template-curly-in-string':      [ 'warn' ],
    'no-unmodified-loop-condition':     [ 'warn' ],
    'no-unused-private-class-members':  [ 'warn' ],
    'no-use-before-define':             ['error', { functions: false, classes: true, variables: true }],
    "no-implicit-coercion": [1, {
      disallowTemplateShorthand: false,
      boolean: true,
      number: true,
      string: true,
      allow: ['!!'] /* really only want to allow if(x) and if(!x) but not if(!!x) */
    }],
  }
};
