import { Router, Request, Response } from 'express';
import { STTProxy } from '../logic/sttproxy';
import { Logger } from '../logic/logger';
import fetch from 'node-fetch';

// Assign router to the express.Router() instance
const router: Router = Router();

router.post('/get', async (req: Request, res: Response, next) => {
    if (!req.body || !req.body.origURI || !req.body.qs) {
        if (req.body.origURI) {
            try {
                Logger.info('Proxy GET', { uri: req.body.origURI });
                let response = await fetch(req.body.origURI);
                let proxyResp = {
                    Status: response.status,
                    Body: await response.text()
                };
                res.status(proxyResp.Status).send(proxyResp.Body);
                return;
            } catch (e) {
                next(e);
            }
        }
        res.status(400).send('Whaat?');
        return;
    }

    try {
        let proxyRes = await STTProxy.get(req.body.origURI, req.body.qs, req.ip);
        res.status(proxyRes.Status).send(proxyRes.Body);
    } catch (e) {
        next(e);
    }
});

router.post('/post', async (req: Request, res: Response, next) => {
    if (!req.body || !req.body.origURI || !req.body.form) {
        res.status(400).send('Whaat?');
        return;
    }

    try {
        let proxyRes = await STTProxy.post(req.body.origURI, req.body.form, req.body.bearerToken);
        res.status(proxyRes.Status).send(proxyRes.Body);
    } catch (e) {
        next(e);
    }
});

// Export the express.Router() instance to be used by server.ts
export const ProxyController: Router = router;