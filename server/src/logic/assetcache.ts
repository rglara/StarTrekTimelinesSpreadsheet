import fs from 'fs';
import { parseAssetBundle } from '../unitiyfs-asset-parser';
import fetch from 'node-fetch';
import pngjs from 'pngjs';

import { Logger } from './logger';

export class AssetCacheClass {
    private _images: Set<string>;

    public AssetPath: string;

    constructor() {
        this.AssetPath = "public/";

        if (!fs.existsSync(this.AssetPath)) {
            fs.mkdirSync(this.AssetPath);
        }

        let images = fs.readdirSync(this.AssetPath);

        // Filter to images
        images = images.filter(item => item.endsWith('.png'));

        Logger.info('Initializing asset cache', { size: images.length });

        this._images = new Set(images);
    }

    private formatImageName(asset_file: string, sprite_name: string): string {
        if (!asset_file) {
            //Logger.info('Unformatted sprite name: ' + asset_file + ', ' + sprite_name + ' -> ' + sprite_name);
            if (sprite_name.startsWith('atlas') || sprite_name.startsWith('images'))
                return sprite_name.substr(1);
            return sprite_name;
        }

        let imageName = (asset_file + ((sprite_name && (sprite_name.length > 0)) ? ('_' + sprite_name) : '')).replace(new RegExp('/', 'g'), '_').replace('.png', '');

        let rv = imageName.startsWith('_') ? imageName.substr(1) : imageName;
        //HACK: to correct a different bug; these image files are missing the first letter
        if (rv.startsWith('atlas') || rv.startsWith('images'))
            rv = rv.substr(1);
        //Logger.info('Formatted image name: ' + asset_file + ', ' + sprite_name + ' -> ' + rv);
        return rv;
    }

    list(): string[] {
        return Array.from(this._images.values());
    }

    async get(client_platform: string, client_version: string, asset_server: string, asset_bundle_version: string, asset_file: string, sprite_name: string): Promise<string> {
        let imageName = this.formatImageName(asset_file, sprite_name);

        if (this._images.has(imageName + '.png')) {
            return imageName + '.png';
        }

        // We don't have it yet, download and process it now
        let urlAsset = `${asset_server}bundles/${client_platform}/default/${client_version}/${asset_bundle_version}/`;
        if (!sprite_name) {
            urlAsset += 'images_' + imageName;
        } else {
            urlAsset += asset_file ? asset_file : sprite_name;
        }

        const k = true;
        if (k) {
            throw new Error(`Failed to parse '${urlAsset}'`);
        }

        Logger.info('Downloading new asset', { urlAsset });

        let headers = {
            'Accept': '*/*',
            'Accept-Encoding': 'gzip, deflate, br'
        };

        let response = await fetch(urlAsset + '.sd', { method: 'GET', headers: headers });

        if (!response.ok) {
            response = await fetch(urlAsset + '.ld', { method: 'GET', headers: headers });
        }

        if (!response.ok) {
            throw new Error(`Failed to fetch '${urlAsset}'`);
        }

        let data = await response.buffer();
        let assetBundle = parseAssetBundle(new Uint8Array(data.buffer));

        if (!assetBundle) {
            throw new Error(`Failed to parse '${urlAsset}'`);
        }

        let pngImage: Buffer;
        if (sprite_name && asset_file) {
            let sprite = assetBundle.sprites.find((sprite) => sprite['spriteName'] === sprite_name);
            if (!sprite) {
                throw new Error(`Failed to find sprite '${sprite_name}' in asset '${urlAsset}'`);
            }
            let png = new pngjs.PNG({ width: sprite['spriteBitmap']['width'], height: sprite['spriteBitmap']['height'] });
            png.data = sprite['spriteBitmap']['data'];
            pngImage = pngjs.PNG.sync.write(png);
        } else {
            let png = new pngjs.PNG({ width: assetBundle.imageBitmap.width, height: assetBundle.imageBitmap.height });
            png.data = assetBundle.imageBitmap.data;
            pngImage = pngjs.PNG.sync.write(png);
        }

        await new Promise((resolve, reject) => {
            fs.writeFile(this.AssetPath + imageName + '.png', pngImage, (err) => {
                if (err) {
                    reject(err);
                }

                this._images.add(imageName + '.png');
                resolve();
            });
        });

        return imageName + '.png';
    }
}

export let AssetCache = new AssetCacheClass();