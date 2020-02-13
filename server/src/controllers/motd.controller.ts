import { Router, Request, Response } from 'express';

// Assign router to the express.Router() instance
const router: Router = Router();

router.get('/get', (req: Request, res: Response) => {
	let webApp = req.query && (req.query.webApp === "true");

	// TODO: read these from a config file
	if (webApp ) {
		res.json({
			show: true,
			title: 'BETA',
			contents: `
<p>The web tool is currently in BETA and can be shut down / stop working at any time</p>
<p>I'm in the process of evaluating costs and performance<p>`
		});
	} else {
		res.json({
			show: false,
			title: '.',
			contents: `<p>Nothing new</p>`
		});
	}
});

// Export the express.Router() instance to be used by server.ts
export const MotdController: Router = router;