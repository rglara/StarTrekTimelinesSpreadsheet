import STTApi, { CONFIG, IFoundResult, ImageProvider }  from '../../api';
import { ShipDTO, ImageDataDTO } from '../../api/STTApi';
import { CrewImageData } from './ImageProvider';

export class ServerImageProvider implements ImageProvider {
    _baseURLAsset: string;
    _cachedAssets: Set<string>;
    _serverURL: string;

    constructor(serverURL: string) {
        this._serverURL = serverURL;
        this._baseURLAsset = this._serverURL + 'assets/';

        this._cachedAssets = new Set();

        this.fillCache();
    }

    async fillCache() {
        let assetList = await STTApi.networkHelper.get(this._serverURL + 'asset/list', { dummy: true });
        this._cachedAssets = new Set(assetList);
    }

    formatUrl(url: string): string {
        let imageName = url.replace(new RegExp('/', 'g'), '_') + '.png';
        imageName = imageName.startsWith('_') ? imageName.substr(1) : imageName;

        return imageName;
    }

    getCached(withIcon: { icon?: ImageDataDTO }): string {
        if (!withIcon.icon)
            return '';

        if (!withIcon.icon.file)
            return '';

        return this.internalGetCached(withIcon.icon.file);
    }

    internalGetCached(url: string): string {
        if (this._cachedAssets.has(this.formatUrl(url))) {
            return this._baseURLAsset + this.formatUrl(url);
        } else {
            return '';
        }
    }

    getCrewCached(crew: CrewImageData, fullBody: boolean): string {
        return this.internalGetCached(fullBody ? crew.full_body.file : crew.portrait.file);
    }

    getSpriteCached(assetName: string, spriteName: string): string {
        if (!assetName) {
            return this.internalGetCached(spriteName);
        }

        return this.internalGetCached(((assetName.length > 0) ? (assetName + '_') : '') + spriteName);
    }

    getCrewImageUrl(crew: CrewImageData, fullBody: boolean, id: number = 0): Promise<IFoundResult> {
        return this.getImageUrl(fullBody ? crew.full_body.file : crew.portrait.file, id);
    }

    getShipImageUrl(ship: ShipDTO): Promise<IFoundResult> {
        return this.getImageUrl(ship.icon.file, ship.name);
    }

    getItemImageUrl(item: any, id: number): Promise<IFoundResult> {
        return this.getImageUrl(item.icon.file, id);
    }

    getFactionImageUrl(faction: any, id: any): Promise<IFoundResult> {
        return this.getImageUrl(faction.icon.file, id);
    }

    async getSprite(assetName: string, spriteName: string, id: string): Promise<IFoundResult> {
        let cachedUrl = this.getSpriteCached(assetName, spriteName);
        if (cachedUrl) {
            return { id, url: cachedUrl };
        }

        let assetUrl = await STTApi.networkHelper.get(this._serverURL + 'asset/get', {
            "client_platform": CONFIG.CLIENT_PLATFORM,
            "client_version": CONFIG.CLIENT_VERSION,
            "asset_server": STTApi.serverConfig!.config.asset_server,
            "asset_bundle_version": STTApi.serverConfig!.config.asset_bundle_version,
            "asset_file": assetName,
            "sprite_name": spriteName
        }, false);

        this._cachedAssets.add(assetUrl);
        return { id, url: this._baseURLAsset + assetUrl };
    }

    async getImageUrl(iconFile: string, id: any): Promise<IFoundResult> {
        if (!iconFile) {
            return { id: undefined, url: undefined};
        }
        let cachedUrl = this.internalGetCached(iconFile);
        if (cachedUrl) {
            return { id, url: cachedUrl };
        }

        let assetUrl = await STTApi.networkHelper.get(this._serverURL + 'asset/get', {
            "client_platform": CONFIG.CLIENT_PLATFORM,
            "client_version": CONFIG.CLIENT_VERSION,
            "asset_server": STTApi.serverConfig!.config.asset_server,
            "asset_bundle_version": STTApi.serverConfig!.config.asset_bundle_version,
            "asset_file": iconFile
        }, false);

        this._cachedAssets.add(assetUrl);
        return { id, url: this._baseURLAsset + assetUrl };
    }
}
