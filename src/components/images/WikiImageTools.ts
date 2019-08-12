import STTApi from "../../api/index";
import CONFIG from "../../api/CONFIG";
import { ImageProvider, IFoundResult } from './ImageProvider';
import { CrewData, ShipDTO } from "../../api/STTApi";

async function getWikiImageUrl(fileName: string, id: any): Promise<IFoundResult> {
	let entry = await STTApi.wikiImages.where('fileName').equals(fileName).first();
	if (entry) {
		if (entry.url) {
			return { id, url: entry.url };
		} else {
			if ((Date.now() - entry.lastQueried) / 3600000 < CONFIG.HOURS_TO_RECOVERY) {
				throw new Error('The Wiki didn\'t have an image for ' + fileName);
			}
		}
	}

	let data = await STTApi.networkHelper.get('https://stt.wiki/w/api.php', {
			action: 'query',
			titles: 'File:' + fileName + "|File:" + fileName.replace('png', 'PNG') + "|File:" + fileName.replace('.png', '_Full.png') + "|File:" + fileName.replace('_', '-'),
			prop: 'imageinfo',
			iiprop: 'url|metadata',
			format: 'json'
		});

	let foundUrl = undefined;
	Object.keys(data.query.pages).forEach((pageKey: any) => {
		let page = data.query.pages[pageKey];
		if (page.imageinfo) {
			page.imageinfo.forEach((imgInfo: any) => {
				foundUrl = imgInfo.url;
			});
		}
	});

	STTApi.wikiImages.put({
		fileName: fileName,
		url: foundUrl,
		lastQueried: Date.now()
	});

	if (foundUrl) {
		return { id, url: foundUrl };
	}
	else {
		// the Wiki doesn't have this image yet, or it was named in a non-standard way
		//console.info('Caching the fact that ' + fileName + ' is not available in the wiki yet');
		throw new Error('The Wiki doesn\'t have an image yet for ' + fileName);
	}
}

export class WikiImageProvider implements ImageProvider {
	getCrewImageUrl(crew: CrewData, fullBody: boolean, id: number = 0): Promise<IFoundResult> {
		let fileName = crew.name.split(' ').join('_') + (fullBody ? '' : '_Head') + '.png';
		return getWikiImageUrl(fileName, id);
	}

	getShipImageUrl(ship: { name: string; icon: { file: string } }, id: any): Promise<IFoundResult> {
		let fileName = ship.name.split(' ').join('_').split('.').join('').split('\'').join('') + '.png';
		return getWikiImageUrl(fileName, id);
	}

	getItemImageUrl(item: any, id: number): Promise<IFoundResult> {
		let fileName : string = item.name;
		if (item.type === 2) {
			fileName += '.png';
		}
		else {
			fileName += CONFIG.RARITIES[item.rarity].name + '.png';
		}
		fileName = fileName.replace(/[ ']/g, '');
		return getWikiImageUrl(fileName, id);
	}

	getFactionImageUrl(faction: any, id: any): Promise<IFoundResult> {
		let fileName = 'Icon' + faction.name.split(' ').join('') + '.png';
		return getWikiImageUrl(fileName, id);
	}

	getSprite(assetName: string, spriteName: string, id: any): Promise<IFoundResult> {
		return Promise.reject('Not implemented');
	}

	getImageUrl(iconFile: string, id: any): Promise<IFoundResult> {
		let fileName = iconFile + '.png';
		return getWikiImageUrl(fileName, id);
	}

	getCached(withIcon: any): string {
		return '';
	}

	getCrewCached(crew: CrewData, fullBody: boolean): string {
		return '';
	}

	getSpriteCached(assetName: string, spriteName: string): string {
		return '';
	}
}

export class ImageProviderChain implements ImageProvider {
	base: ImageProvider;
	ext?: ImageProvider;

	constructor(base: ImageProvider, ext?: ImageProvider) {
		this.base = base;
		this.ext = ext;
	}

	async getCrewImageUrl(crew: CrewData, fullBody: boolean, id: number = 0): Promise<IFoundResult> {
		let result = await this.base.getCrewImageUrl(crew, fullBody, id);
		if (this.ext && (!result.url || result.url === '')) {
			return this.ext.getCrewImageUrl(crew, fullBody, id);
		}
		return result;
	}

	async getShipImageUrl(ship: { name: string; icon: { file: string } }, name: string): Promise<IFoundResult> {
		let result = await this.base.getShipImageUrl(ship, name);
		if (this.ext && (!result.url || result.url === '')) {
			return this.ext.getShipImageUrl(ship, name);
		}
		return result;
	}

	async getItemImageUrl(item: any, id: number): Promise<IFoundResult> {
		let result = await this.base.getItemImageUrl(item, id);
		if (this.ext && (!result.url || result.url === '')) {
			return this.ext.getItemImageUrl(item, id);
		}
		return result;
	}

	async getFactionImageUrl(faction: any, id: any): Promise<IFoundResult> {
		let result = await this.base.getFactionImageUrl(faction, id);
		if (this.ext && (!result.url || result.url === '')) {
			return this.ext.getFactionImageUrl(faction, id);
		}
		return result;
	}

	async getSprite(assetName: string, spriteName: string, id: string): Promise<IFoundResult> {
		let result = await this.base.getSprite(assetName, spriteName, id);
		if (this.ext && (!result.url || result.url === '')) {
			return this.ext.getSprite(assetName, spriteName, id);
		}
		return result;
	}

	async getImageUrl(iconFile: string, id: any): Promise<IFoundResult> {
		let result = await this.base.getImageUrl(iconFile, id);
		if (this.ext && (!result.url || result.url === '')) {
			return this.ext.getImageUrl(iconFile, id);
		}
		return result;
	}

	getCached(withIcon: any): string {
		let result = this.base.getCached(withIcon);
		if (this.ext && (!result || result === '')) {
			return this.ext.getCached(withIcon);
		}
		return result;
	}

	getCrewCached(crew: CrewData, fullBody: boolean): string {
		let result = this.base.getCrewCached(crew, fullBody);
		if (this.ext && (!result || result === '')) {
			return this.ext.getCrewCached(crew, fullBody);
		}
		return result;
	}

	getSpriteCached(assetName: string, spriteName: string): string {
		let result = this.base.getSpriteCached(assetName, spriteName);
		if (this.ext && (!result || result === '')) {
			return this.ext.getSpriteCached(assetName, spriteName);
		}
		return result;
	}
}
