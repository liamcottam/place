const webpack = require('webpack');
const production = process.env.NODE_ENV === 'production';
const webpackConfig = production
  ? require('./webpack.prod')
  : require('./webpack.dev');

var compiler = webpack(webpackConfig);

const onRun = (err, stats) => {
  if (err) throw err;
  process.stdout.write(
    stats.toString({
      colors: true,
      modules: false,
      children: false,
      chunks: false,
      chunkModules: false,
    }) + '\n\n',
  );
};

compiler.run(onRun);

if (!production) {
  compiler.watch(
    {
      aggregateTimeout: 300,
    },
    onRun,
  );
}
