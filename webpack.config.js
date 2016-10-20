const path = require('path')
const webpack = require('webpack')

const PATHS = {
  app: path.resolve(__dirname, './lib')
}


module.exports = {
  entry: {
    index: './lib/index.js'
  },

  output: {
    path: 'dist/',
    filename: 'ot.js'
  },

  plugins: [
    //new webpack.optimize.DedupePlugin(),
    //new webpack.optimize.UglifyJsPlugin(),
    //new webpack.optimize.OccurenceOrderPlugin(),
    //new webpack.optimize.AggressiveMergingPlugin(),
    new webpack.NoErrorsPlugin()
  ],

  externals: {
    'react': 'React'
  },

  resolve: {
    extensions: ['', '.js', '.js.flow'],
    modulesDirectories: [
      __dirname,
      './node_modules',
      PATHS.app
    ],
    root: [path.resolve('lib')]
  },

  module: {

    loaders: [
      {
        test: /\.(js|js\.flow)$/,
        exclude: /(node_modules)/,
        loaders: [
          'babel-loader'
        ]
      }
    ]
  }
}
