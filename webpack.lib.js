const path = require("path");
const {merge} = require("webpack-merge");
const common = require("./webpack.common.js");
const nodeExternals = require("webpack-node-externals");

module.exports = merge(common, {
  entry: {
    index: "./src/index.ts"
  },
  externals: [nodeExternals()],
  output: {
    path: path.resolve(__dirname, "lib"),
    libraryTarget: "umd", // "var" | "assign" | "this" | "window" | "self" | "global" | "commonjs" | "commonjs2" | "commonjs-module" | "amd" | "amd-require" | "umd" | "umd2" | "jsonp" | "system"
    // library: "utils", // 库名称
    // libraryExport: "default", // 兼容 ES6(ES2015) 的模块系统、CommonJS 和 AMD 模块规范
    globalObject: "this" // 兼容node和浏览器运行，避免window is not undefined情况
  }
});
