const createWindowsInstaller = require('electron-winstaller').createWindowsInstaller;
const path = require('path');
const fs = require('fs');

var version = JSON.parse(fs.readFileSync('package.json'), 'utf8').version;

getInstallerConfig()
	.then(createWindowsInstaller)
	.catch((error) => {
		console.error(error.message || error)
		process.exit(1)
	});

function getInstallerConfig() {
	console.log('creating windows installer');
	const rootPath = path.join('./');
	const outPath = path.join(rootPath, 'builds');

	return Promise.resolve({
		appDirectory: path.join(outPath, 'startrektimelinestool-win32-x64'),
		authors: 'IAmPicard',
		noMsi: false,
		outputDirectory: path.join(outPath, 'windows-installer'),
		exe: 'startrektimelinestool.exe',
		setupExe: 'setup-startrektimelinestool-' + version + '.exe'
	});
}