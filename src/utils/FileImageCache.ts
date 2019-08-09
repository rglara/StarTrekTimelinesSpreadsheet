import fs from 'fs';

import { getAppPath } from './pal';

export class FileImageCache {
	basePath : string;
	allImages: Set<string>;

	constructor() {
		this.basePath = getAppPath('userData') + '/imagecache/';

		if (!fs.existsSync(this.basePath)) {
			fs.mkdirSync(this.basePath);
		}

		let dirEntries : string[] = fs.readdirSync(this.basePath);

		// Filter to images
		dirEntries = dirEntries.filter(item => item.endsWith('.png'));

		// Remove the .png extension
		this.allImages = new Set(dirEntries.map(item => this.basePath + item));
	}

	getCached(url:string): string {
		if (this.allImages.has(this.formatUrl(url))) {
			return 'file://' + this.formatUrl(url);
		} else {
			return '';
		}
	}

	formatUrl(url: string): string {
		return this.basePath + url.substr(1).replace(new RegExp('/', 'g'), '_') + '.png';
	}

	getImage(url: string) : Promise<string | undefined> {
		return new Promise((resolve, reject) => {
			fs.exists(this.formatUrl(url), (exists) => {
				if (exists) {
					resolve('file://' + this.formatUrl(url));
				}
				else {
					resolve(undefined);
				}
			});
		});
	}

	bitmapToPng(data : {height:number, width:number, data:number[] }, callback: (bytes:Uint8Array) => void) : void {
		let canvas = document.createElement('canvas');
		canvas.height = data.height;
		canvas.width = data.width;

		let ctx = canvas.getContext('2d');
		if (ctx) {
			let myImageData = new ImageData(new Uint8ClampedArray(data.data), data.width, data.height);
			ctx.putImageData(myImageData, 0, 0);
		}

		canvas.toBlob((blob) => {
			let fileReader = new FileReader();
			fileReader.onload = (progressEvent:any) => { // Use 'any' because result is not found on 'target' for some reason
				callback(new Uint8Array(progressEvent.target.result));
			};
			fileReader.readAsArrayBuffer(blob!);
		});
	}

	saveImage(url: string, data: { height: number, width: number, data: number[] }) : Promise<string> {
		return new Promise((resolve, reject) => {
			if (data.data.length > 0) {
				this.bitmapToPng(data, (pngData) => {
					fs.writeFile(this.formatUrl(url), pngData, (err) => {
						resolve('file://' + this.formatUrl(url));
					});
				});
			}
			else {
				reject('Invalid data');
			}
		});
	}
}
