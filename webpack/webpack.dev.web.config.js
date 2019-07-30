const path = require('path');
const merge = require('webpack-merge');
const WebpackCdnPlugin = require('webpack-cdn-plugin');
const baseConfig = require('./webpack.base.config.js');
const WebappWebpackPlugin = require('webapp-webpack-plugin');

// Config directories
const SRC_DIR = path.resolve(__dirname, '../src');
const OUTPUT_DIR = path.resolve(__dirname, '../dist');

// TODO: Figure out how to serve voymod.wasm

module.exports = merge(baseConfig('webtest', true), {
	plugins: [
		new WebappWebpackPlugin({
			logo: SRC_DIR + '/assets/logo.png',
			prefix: 'img/',
			emitStats: false,
			persistentCache: true,
			inject: true,
			background: '#393737',
			title: 'Star Trek Timelines Crew Management',
			icons: {
				android: true,
				appleIcon: true,
				appleStartup: true,
				coast: false,
				favicons: true,
				firefox: true,
				opengraph: false,
				twitter: false,
				yandex: false,
				windows: true
			}
		}),
		new WebpackCdnPlugin({
			modules: [
				{ name: 'xlsx-populate', var: 'XlsxPopulate', path: 'browser/xlsx-populate.js' },
				{ name: 'react', var: 'React', path: `umd/react.production.min.js` },
				{ name: 'react-dom', var: 'ReactDOM', path: `umd/react-dom.production.min.js` }
			],
			publicPath: '/node_modules'
		})
	],
	devServer: {
		contentBase: OUTPUT_DIR
	}
});
