const {CleanWebpackPlugin} = require("clean-webpack-plugin");
const path = require("path");

module.exports = {
  mode: "production",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
    alias: {"@utils": path.resolve(__dirname, "src/utils/src")},
    fallback: {events: require.resolve("events/")}
  },
  output: {
    filename: "[name].js" // 输出文件
  },
  plugins: [new CleanWebpackPlugin()]
};
