import app from "./app";

const PORT = 3000;

export class STTServer {
    constructor() {
	}

	async start(logCallback: (msg: string) => void) {
        await new Promise((resolve, reject) => app.listen(PORT, () => resolve()));

        logCallback(`Server listening on port ${PORT}`);
    }
}