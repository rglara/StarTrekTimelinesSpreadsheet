import * as express from 'express';
import { Request, Response } from 'express';
import { ApiController } from '../controllers/apiController';

export class Routes {
    private apiController: ApiController = new ApiController();

    public routes(app: express.Application): void {
        app.route('/')
            .get((req: Request, res: Response) => {
                // TODO: if deployed on a real server, this should fetch the static resources (index.html)
            });

        app.route('/login').post(this.apiController.login);
        app.route('/logout').get(this.apiController.logout);
        app.route('/loginStatus').get(this.apiController.nocache, this.apiController.loginStatus);
    }
}