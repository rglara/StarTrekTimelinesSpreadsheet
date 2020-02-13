import { Router, Request, Response } from 'express';
import { AssetCache } from '../logic/assetcache';

// Assign router to the express.Router() instance
const router: Router = Router();

router.get('/list', (req: Request, res: Response) => {
    res.json(AssetCache.list());
});

router.get('/get', async (req: Request, res: Response, next) => {
    try {
        let { client_platform, client_version, asset_server, asset_bundle_version, asset_file, sprite_name } = req.query;

        //TODO: check the wiki if it can't be retrieved from the asset cache
        let imageName = await AssetCache.get(client_platform, client_version, asset_server, asset_bundle_version, asset_file, sprite_name);

        res.send(imageName);
    } catch (e) {
        next(e);
    }
});

// Export the express.Router() instance to be used by server.ts
export const AssetController: Router = router;