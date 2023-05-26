const path = require("path");
const {merge} = require("webpack-merge");
const common = require("./webpack.common.js");

module.exports = merge(common, {
  entry: {
    "cad-viewer": "./src/index.ts"
  },
  devtool: "source-map",
  output: {
    path: path.resolve(__dirname, "dist"),
    libraryTarget: "window",
    globalObject: "this",
    library: ["lucilor", "cadViewer"]
  }
});
