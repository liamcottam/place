const path = require('path');
const webpack = require('webpack');
const eslintFriendlyFormatter = require('eslint-friendly-formatter');

module.exports = {
  entry: {
    app: './client/js/app.js',
    mod_tools: './client/js/mod_tools.js',
  },
  output: {
    path: path.resolve(__dirname, '../../dist'),
    filename: 'js/[name].js',
    publicPath: '/',
  },
  module: {
    rules: [
      /* {
        test: /\.js$/,
        loader: 'eslint-loader',
        enforce: 'pre',
        options: {
          formatter: eslintFriendlyFormatter,
        },
      }, */
      {
        test: /\.js$/,
        loader: 'babel-loader',
      },
    ],
  },
};
