module.exports = {
  root: true,
  parser: 'babel-eslint',
  parserOptions: {
    sourceType: 'module',
  },
  env: {
    browser: true,
    jquery: true,
  },
  extends: 'airbnb-base',
  rules: {
    'no-debugger': process.env.NODE_ENV === 'production' ? 2 : 0,
    'no-plusplus': 0,
    'no-bitwise': 0,
    'no-new': 0,
    'no-param-reassign': 0,
    'no-restricted-globals': 0,
    'class-methods-use-this': 0,
  },
};
