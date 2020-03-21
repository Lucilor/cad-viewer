const {CleanWebpackPlugin} = require("clean-webpack-plugin");

module.exports = {
	mode: "production",
	entry: {
		index: "./src/index.ts",
	},
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
		filename: "[name].js" // 输出文件
	},
	plugins: [new CleanWebpackPlugin()]
};
