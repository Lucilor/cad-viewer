const path = require("path");
const nodeExternals = require("webpack-node-externals");
const TerserPlugin = require("terser-webpack-plugin");

module.exports = {
	mode: "none",
	entry: {
		index: "./src/index.ts",
		"index.min": "./src/index.ts"
	},
	externals: [nodeExternals()],
	devtool: "#source-map",
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
		extensions: [".tsx", ".ts", ".js"]
	},
	output: {
		path: path.resolve(__dirname, "dist"), // 输出目录
		filename: "[name].js", // 输出文件
		libraryTarget: "umd", // "var" | "assign" | "this" | "window" | "self" | "global" | "commonjs" | "commonjs2" | "commonjs-module" | "amd" | "amd-require" | "umd" | "umd2" | "jsonp" | "system"
		// library: "utils", // 库名称
		// libraryExport: "default", // 兼容 ES6(ES2015) 的模块系统、CommonJS 和 AMD 模块规范
		globalObject: "this" // 兼容node和浏览器运行，避免window is not undefined情况
	},
	optimization: {
		minimize: true,
		minimizer: [
			new TerserPlugin({
				include: /\.min\.js$/ // 只有匹配到.min.js结尾的文件才会压缩
			})
		]
	}
};
