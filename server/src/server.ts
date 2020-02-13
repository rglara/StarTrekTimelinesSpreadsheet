import express from 'express';
import cors from 'cors';
import { Request, Response } from 'express';
import bodyParser from 'body-parser';

import expressWinston from 'express-winston';

import { AssetController, ProxyController, MotdController } from './controllers';
import { Logger } from './logic/logger';
import { AssetCache } from './logic/assetcache';

import fs from 'fs';
import https from 'https';

// TODO: "certbot renew"

// Create a new express application instance
const app: express.Application = express();

// Certificate
// const privateKey = fs.readFileSync('/home/stt/stt/certs/privkey.pem', 'utf8');
// const certificate = fs.readFileSync('/home/stt/stt/certs/cert.pem', 'utf8');
// const ca = fs.readFileSync('/home/stt/stt/certs/ca.pem', 'utf8');

// const credentials = {
	// key: privateKey,
	// cert: certificate,
	// ca: ca
// };

// The port the express app will listen on
const port: number = 8060;

let nocache = (req: Request, res: Response, next: any) => {
    res.setHeader('Surrogate-Control', 'no-store');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    next();
};

// Add logger
let expressLogger = expressWinston.logger({
    transports: Logger.transports, colorize: true,
    msg: "HTTP {{req.method}} {{req.url}} ({{res.responseTime}}ms) from {{req.ip}}"
});

app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

// Add CORS support
let corsOptions: any = {
  // origin: 'http://localhost:8050', //TODO: will need origin if deployed anywhere reachable
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
};

app.use(cors(corsOptions));

// Mount the controllers' routes
app.use('/asset', nocache, /*expressLogger,*/ AssetController);
app.use('/proxy', nocache, /*expressLogger,*/ ProxyController);
app.use('/motd', nocache, expressLogger, MotdController);

// Static assets go into the 'public' folder
app.use('/assets', express.static(AssetCache.AssetPath));

// The website (bundle, index.html) go into the 'static' folder
app.use(express.static('static'))

// use like this without SSL:
app.listen(port, () => {
  // Success callback
  console.log(`Listening at ${port}/`);
});

// const httpsServer = https.createServer(credentials, app);

// httpsServer.listen(port, () => {
// 	console.log(`HTTPS Server running on port ${port}`);
// });
