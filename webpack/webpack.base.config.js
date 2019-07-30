const webpack = require('webpack');
const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const PACKAGE = require('../package.json');

// Config directories
const SRC_DIR = path.resolve(__dirname, '../src');
const OUTPUT_DIR = path.resolve(__dirname, '../dist');

// Any directories you will be adding code/files into, need to be added to this array so webpack will pick them up
const defaultInclude = [SRC_DIR];

module.exports = function(targetEnv, devEnv) {
	let devElectron = targetEnv === 'electron' && devEnv;

	let config = {
		entry: SRC_DIR + '/index.js',
		output: {
			path: OUTPUT_DIR,
			//publicPath: devEnv ? '' : './',
			publicPath: devEnv ? '' : '',
			//publicPath: devEnv ? 'stt' : 'stt',
			//contentBase: path.join(__dirname, 'stt'),
			filename: 'bundle.js',
			globalObject: 'this'
		},
		module: {
			rules: [
				{
					test: /\.jsx?$/,
					use: [{ loader: 'babel-loader' }, { loader: 'webpack-preprocessor-loader', options: { params: { ENV: targetEnv } } }],
					include: defaultInclude
				},
				{
					test: /\.tsx?$/,
					use: [{ loader: 'ts-loader' }, { loader: 'webpack-preprocessor-loader', options: { params: { ENV: targetEnv } } }],
					include: defaultInclude
				},
				{
					test: /\.(eot|svg|ttf|woff|woff2)$/,
					use: [{ loader: 'file-loader?name=font/[name]__[hash:base64:5].[ext]' }],
					include: defaultInclude
				},
				{
					test: /\.css$/,
					use: [devElectron ? { loader: 'style-loader' } : MiniCssExtractPlugin.loader, 'css-loader']
				},
				{
					test: /\.(jpe?g|png|gif)$/,
					use: [
						devElectron
							? { loader: 'url-loader', options: { limit: 8192 } }
							: { loader: 'file-loader?name=img/[name]__[hash:base64:5].[ext]' }
					],
					include: defaultInclude
				}
			]
		},
		target: targetEnv === 'electron' ? 'electron-renderer' : 'web',
		devtool: devEnv ? 'inline-source-map' : 'cheap-module-source-map',
		resolve: {
			extensions: ['.js', '.ts', '.tsx', '.jsx']
		},
		plugins: [
			new HtmlWebpackPlugin({ template: './webpack/template.html', title: `Star Trek Timelines Crew Management ${PACKAGE.version}` }),
			new webpack.DefinePlugin({
				'process.env.NODE_ENV': JSON.stringify(devEnv ? 'development' : 'production'),
				'process.env.APP_VERSION': JSON.stringify(PACKAGE.version)
			}),
			new CopyWebpackPlugin([{ from: 'src/assets/semantic', to: 'css' }])
		]
	};

	if (!devElectron) {
		config.plugins.push(new MiniCssExtractPlugin({ filename: '[name].css', chunkFilename: '[id].css' }));
	}

	let stats = { colors: true, children: false, chunks: false, modules: false };
	if (devEnv) {
		config.devServer = { stats };
	} else {
		config.stats = stats;
	}

	if (targetEnv !== 'electron') {
		config.node = { fs: 'empty' };
	}

	return config;
};
