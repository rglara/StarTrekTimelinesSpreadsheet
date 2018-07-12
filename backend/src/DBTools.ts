import { NetworkFetch } from './NetworkFetch';
import CONFIG from './CONFIG';

export class DBToolsClass {
    private _net: NetworkFetch;

    constructor() {
        this._net = new NetworkFetch();
    }

    async login(username: string, password: string): Promise<any> {
		let data = await this._net.post(CONFIG.URL_PLATFORM + "oauth2/token", {
			"username": username,
			"password": password,
			"client_id": CONFIG.CLIENT_ID,
			"grant_type": "password"
		});

		if (data.error_description) {
			throw new Error(data.error_description);
		} else if (data.access_token) {
			return data.access_token;
		} else {
			throw new Error("Invalid data for login!");
		}
	}
}

let DBTools = new DBToolsClass();
export default DBTools;