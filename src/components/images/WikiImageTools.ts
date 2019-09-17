import STTApi from "../../api/index";
import CONFIG from "../../api/CONFIG";
import { ImageProvider, IFoundResult, ImageCache, CrewImageData } from './ImageProvider';
import { ShipDTO, ImageDataDTO } from "../../api/STTApi";

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
	getCrewImageUrl(crew: CrewImageData, fullBody: boolean): Promise<IFoundResult> {
		let fileName = crew.name.split(' ').join('_') + (fullBody ? '' : '_Head') + '.png';
		return getWikiImageUrl(fileName, 0);
	}

	getShipImageUrl(ship: ShipDTO): Promise<IFoundResult> {
		let fileName = ship.name.split(' ').join('_').split('.').join('').split('\'').join('') + '.png';
		return getWikiImageUrl(fileName, ship.name);
	}

	getItemImageUrl(item: any, id: number): Promise<IFoundResult> {
		let fileName : string = item.name;
		//HACK: for particular images that the wiki has as nonstandard names
		if (item.symbol === 'energy' && item.type === 3) {
			fileName = "Chroniton_icon.png";
		}
		else {
			if (item.type === 2) {
				fileName += '.png';
			}
			else {
				fileName += CONFIG.RARITIES[item.rarity].name + '.png';
			}
			fileName = fileName.replace(/[ ']/g, '');
		}
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

	getCached(withIcon: { icon?: ImageDataDTO }): string {
		return '';
	}

	getCrewCached(crew: CrewImageData, fullBody: boolean): string {
		return '';
	}

	getSpriteCached(assetName: string, spriteName: string): string {
		return '';
	}
}

export class ImageProviderChain implements ImageProvider {
	imageCache: ImageCache;
	base: ImageProvider;
	ext?: ImageProvider;

	constructor(cache: ImageCache, base: ImageProvider, ext?: ImageProvider) {
		this.imageCache = cache;
		this.base = base;
		this.ext = ext;
	}

	async getCrewImageUrl(crew: CrewImageData, fullBody: boolean): Promise<IFoundResult> {
		if (!crew) {
			return this.getImageUrl("", 0);
		}
		// let cached = this.getImageUrl(fullBody ? crew.full_body.file : crew.portrait.file, 0);

		let result = await this.base.getCrewImageUrl(crew, fullBody);
		if (this.ext && (!result.url || result.url === '')) {
			return this.ext.getCrewImageUrl(crew, fullBody);
		}
		return result;
	}

	async getShipImageUrl(ship: ShipDTO): Promise<IFoundResult> {
		let result = await this.base.getShipImageUrl(ship);
		if (this.ext && (!result.url || result.url === '')) {
			return this.ext.getShipImageUrl(ship);
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
		if (!iconFile) {
			return { id, url: undefined };
		}
		let cachedUrl = await this.imageCache.getImage(iconFile);
		if (cachedUrl) {
			return { id, url: cachedUrl };
		}

		let result = await this.base.getImageUrl(iconFile, id);
		if (this.ext && (!result.url || result.url === '')) {
			result = await this.ext.getImageUrl(iconFile, id);
		}

		if (result && result.url) {
			//TODO: get raw bitmap and save to the cache here
			//this.imageCache.saveImage(iconFile, rawBitmap);
		}
		return result;
	}

	getCached(withIcon: { icon?: ImageDataDTO }): string {
		if (!withIcon.icon)
			return '';

		if (!withIcon.icon.file)
			return '';

		return this.imageCache.getCached(withIcon.icon.file);
	}

	getCrewCached(crew: CrewImageData, fullBody: boolean): string {
		return this.imageCache.getCached(fullBody ? crew.full_body.file : crew.portrait.file);
	}

	getSpriteCached(assetName: string, spriteName: string): string {
		return this.imageCache.getCached(((assetName.length > 0) ? (assetName + '_') : '') + spriteName);
	}
}
