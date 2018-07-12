import { Request, Response, NextFunction } from 'express';

import DBTools from '../DBTools';

export class ApiController {
    public nocache(req: Request, res: Response, next: NextFunction) {
        res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
        res.header('Expires', '-1');
        res.header('Pragma', 'no-cache');
        next();
    }

    async login(req: Request, res: Response) {
        let loginData = req.body;

        if (!loginData.username || !loginData.password) {
            res.status(403).send('username and password required').end();
        } else {
            try
            {
                let access_token = await DBTools.login(loginData.username, loginData.password);

                // Store a cookie with the access token so users don't need to login every time
                req.session.access_token = access_token;

                res.status(200).json({access_token}).end();
            }
            catch(error) {
                res.status(403).send(error).end();
            }
        }
    }

    public logout(req: Request, res: Response) {
        (req as any).session = null;

        res.status(200).send('logged out');
    }

    public loginStatus(req: Request, res: Response) {
        if (req.session.access_token) {
            res.status(200).send(req.session.access_token).end();
        } else {
            res.status(200).send(``).end();
        }
    }
}