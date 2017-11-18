const path = require('path');
const webpack = require('webpack');
const merge = require('webpack-merge');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const OptimizeCSSPlugin = require('optimize-css-assets-webpack-plugin');

const baseWebpackConfig = require('./webpack.base');

module.exports = merge(baseWebpackConfig, {
  devtool: false,
  module: {
    rules: [
      {
        test: /\.scss$/,
        use: ExtractTextPlugin.extract({
          fallback: 'style-loader',
          use: [
            {
              loader: 'css-loader', // translates CSS into CommonJS
            },
            {
              loader: 'sass-loader', // compiles Sass to CSS
            },
          ],
        }),
      },
    ],
  },
  plugins: [
    new webpack.optimize.OccurrenceOrderPlugin(),
    new webpack.optimize.UglifyJsPlugin({
      parallel: {
        cache: true,
      },
      compress: {
        warnings: false,
      },
      mangle: true,
      warnings: false,
      extractComments: true,
      sourceMap: false,
    }),
    // Extract CSS into its own file
    new ExtractTextPlugin({
      filename: 'css/[name].css',
    }),
    new OptimizeCSSPlugin({
      cssProcessorOptions: {
        discardComments: {
          removeAll: true
        }
      },
    }),
    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: 'client/index.html',
      inject: true,
      minify: {
        removeComments: true,
        collapseWhitespace: true,
        removeAttributeQuotes: true,
      },
      chunksSortMode: 'dependency',
    }),
  ],
});
