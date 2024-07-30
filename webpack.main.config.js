const path = require("node:path");
const CopyWebpackPlugin = require("copy-webpack-plugin");
// const nodeExternals = require('webpack-node-externals');

const assets = [ 'static' ]; // asset directories
const copyPlugins = assets.map((asset) => {
  return new CopyWebpackPlugin({
    patterns: [{ from: path.resolve(__dirname, 'src', asset), to: asset }],
  });
});

module.exports = {
  /**
   * This is the main entry point for your application, it's the first file
   * that runs in the main process.
   */
  entry: "./src/main.js",
  // Put your normal webpack config below here
  module: {
    rules: require("./webpack.rules"),
  },
  plugins: [
    ...copyPlugins,
  ],
  // externals: [nodeExternals()],
};
