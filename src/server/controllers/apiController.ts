import { Request, Response, NextFunction } from 'express';

export class ApiController {
    public nocache(req: Request, res: Response, next: NextFunction) {
        res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
        res.header('Expires', '-1');
        res.header('Pragma', 'no-cache');
        next();
    }

    public login(req: Request, res: Response) {
        let loginData = req.body;

        if (!loginData.username || !loginData.password) {
            res.status(403).send('username and password required').end();
        } else {
            //TODO: login
            let whatever = {
                foo: 'bar'
            };

            // Store a cookie with the access token so users don't need to login every time
            req.session.access_token = 'aa';

            res.status(200).json(whatever).end();
        }
    }

    public logout(req: Request, res: Response) {
        (req as any).session = null;

        res.status(200).send('logged out');
    }

    public loginStatus(req: Request, res: Response) {
        if (req.session.access_token) {
            res.status(200).send(`true`).end();
        } else {
            res.status(200).send(`false`).end();
        }
    }
}