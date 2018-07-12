import * as express from 'express';
import * as cors from 'cors';
import cookieSession = require('cookie-session');
import * as bodyParser from 'body-parser';
import { Routes } from './routes/apiRoutes';

export class App {
    private app: express.Application;
    private routes: Routes = new Routes();

    // TODO: URLs
    private allowedOrigins = ['http://localhost:8080', 'http://todo.todo'];

    constructor() {
        this.app = express();
        this.config();
        this.routes.routes(this.app);
    }

    private config(): void {
        // support application/json type post data
        this.app.use(bodyParser.json());

        // support application/x-www-form-urlencoded post data
        this.app.use(bodyParser.urlencoded({ extended: false }));

        // set up Cookies
        this.app.use(cookieSession({
            name: 'session',
            keys: ['S3cr3t', 'V3ryS3cr3t'],
            httpOnly: false,
            maxAge: 10 * 24 * 60 * 60 * 1000 // 10 days
        }));

        // Updates the session cookie on each request, to keep it alive
        this.app.use(function (req, res, next) {
            req.session.nowInMinutes = Math.floor(Date.now() / 60e3);
            next();
        });

        // set up CORS
        this.app.use(cors({
            credentials: true,
            origin: (origin, callback) => {
                if (!origin) {
                    //return callback(new Error(`Unknown Origin. Please don't abuse my bandwidth; hosting this isn't cheap!`), false);
                    return callback(null, true);
                }

                if (this.allowedOrigins.indexOf(origin) === -1) {
                    return callback(new Error('The CORS policy for this site does not allow access from the specified Origin.'), false);
                }

                // Let everything else through
                return callback(null, true);
            }
        }));
    }

    public getExpressApplication(): express.Application {
        return this.app;
    }
}