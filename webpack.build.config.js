const webpack = require('webpack');
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const PACKAGE = require('./package.json');

// Config directories
const SRC_DIR = path.resolve(__dirname, 'src');
const SHARED_DIR = path.resolve(__dirname, 'shared');
const OUTPUT_DIR = path.resolve(__dirname, 'dist');

// Any directories you will be adding code/files into, need to be added to this array so webpack will pick them up
const defaultInclude = [SRC_DIR, SHARED_DIR];

module.exports = {
	entry: {
		main: SRC_DIR + '/index.js',
		server: SRC_DIR + '/index_server.js'
	},
	output: {
		path: OUTPUT_DIR,
		publicPath: './',
		filename: '[name].js',
		globalObject: 'this'
	},
	module: {
		rules: [
			{
				test: /\.css$/,
				use: [
					MiniCssExtractPlugin.loader,
					"css-loader"
				]
			},
			{
				test: /\.jsx?$/,
				use: [{ loader: 'babel-loader' }],
				include: defaultInclude
			},
			{
				test: /\.tsx?$/,
        		use: 'ts-loader',
        		exclude: /node_modules/,
				include: defaultInclude
			},
			{
				test: /\.(jpe?g|png|gif)$/,
				use: [{ loader: 'file-loader?name=img/[name]__[hash:base64:5].[ext]' }],
				include: defaultInclude
			},
			{
				test: /\.(eot|svg|ttf|woff|woff2)$/,
				use: [{ loader: 'file-loader?name=font/[name]__[hash:base64:5].[ext]' }],
				include: defaultInclude
			}
		]
	},
	resolve: {
		extensions: [".ts", ".tsx", ".js"]
	},
	target: 'electron-renderer',
	plugins: [
		new HtmlWebpackPlugin({
			title: 'Star Trek Timelines Crew Management v' + PACKAGE.version,
			chunks: ['main']
		}),
		new HtmlWebpackPlugin({
			filename: 'server.html',
			title: 'SERVER - Star Trek Timelines Crew Management v' + PACKAGE.version,
			chunks: ['server']
		}),
		new MiniCssExtractPlugin({
			// Options similar to the same options in webpackOptions.output
			// both options are optional
			filename: "[name].css",
			chunkFilename: "[id].css"
		}),
		new webpack.DefinePlugin({
			'process.env.NODE_ENV': JSON.stringify('production')
		})
	],
	stats: {
		colors: true,
		children: false,
		chunks: false,
		modules: false
	}
};
