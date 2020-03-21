const path = require("path");
const merge = require("webpack-merge");
const common = require("./webpack.common.js");

module.exports = merge(common, {
	devtool: "#source-map",
	output: {
		path: path.resolve(__dirname, "dist"),
		libraryTarget: "window",
		globalObject: "this"
	}
});
