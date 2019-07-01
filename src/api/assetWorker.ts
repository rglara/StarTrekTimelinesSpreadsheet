import { parseAssetBundle } from './unitiyfs-asset-parser';

function parseFromBundle(data: any): any {
    let assetBundle = undefined;
    try {
        assetBundle = parseAssetBundle(new Uint8Array(data.buffer));
    } catch (err) {
        console.error('Failed to parse an image out of bundle '+data.label+': ' + err);
        return [];
    }
    if (!assetBundle || !assetBundle.imageBitmap) {
        console.error('Failed to parse an image out of bundle ' + data.label);
        return [];
    }
    else {
        if (data.assetName && data.assetName.length > 0) {
            let sprite = assetBundle.sprites.find((sprite: any) => sprite.spriteName === data.spriteName);
            if (!sprite) {
                console.error('Sprite ' + data.label +' not found!');
                return [];
            }
            return sprite['spriteBitmap'];
        }
        else {
            return assetBundle.imageBitmap;
        }
    }
}

self.addEventListener('message', (message: any) => {
    let result = parseFromBundle(message.data);

    if (result && result.data && result.data.length > 0) {
        (self as any).postMessage(result, [result.data.buffer]);
    }
    else {
        (self as any).postMessage(result);
    }

    // close this worker
    self.close();
});