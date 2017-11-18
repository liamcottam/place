const merge = require('webpack-merge');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const FriendlyErrorsPlugin = require('friendly-errors-webpack-plugin');

const baseWebpackConfig = require('./webpack.base');

module.exports = merge(baseWebpackConfig, {
  devtool: '#cheap-module-eval-source-map',
  rules: [
    {
      test: /\.scss$/,
      use: [
        {
          loader: 'style-loader', // creates style nodes from JS strings
        },
        {
          loader: 'css-loader', // translates CSS into CommonJS
        },
        {
          loader: 'sass-loader', // compiles Sass to CSS
        },
      ],
    },
  ]
  plugins: [
    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: 'client/index.html',
      inject: true,
    }),
    new FriendlyErrorsPlugin(),
  ],
});
