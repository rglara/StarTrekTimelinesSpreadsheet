import CONFIG from './CONFIG';

// Polyfill if fetch is not natively available in the environment
if (!self.fetch) {
    self.fetch = require('node-fetch');
}

export class NetworkFetch {
	async post(uri: string, form: any, bearerToken: string | undefined = undefined, getjson: boolean = true): Promise<any> {
		let searchParams: URLSearchParams = new URLSearchParams();
		for (const prop of Object.keys(form)) {
			searchParams.set(prop, form[prop]);
		}

		let headers: any = {
			"Content-type": "application/x-www-form-urlencoded; charset=UTF-8"
		};

		if (bearerToken !== undefined) {
			headers.Authorization = "Bearer " + btoa(bearerToken);
		}

		let response = await fetch(uri, {
			method: "post",
			headers: headers,
			body: searchParams.toString()
		});

		if (getjson) {
			return response.json();
		} else {
			return response.text();
		}
	}

	async postjson(uri: string, form: any): Promise<any> {
		let headers: any = {
			"Content-type": "application/json"
		};
	
		let response = await fetch(uri, {
			method: "post",
			headers: headers,
			body: JSON.stringify(form)
		});
	
		return response.text();
	}

	async get(uri: string, qs: any): Promise<any> {
		let searchParams: URLSearchParams = new URLSearchParams();
		for (const prop of Object.keys(qs)) {
			if (Array.isArray(qs[prop])) {
				qs[prop].forEach((entry: any): void => {
					searchParams.append(prop + '[]', entry);
				});
			}
			else {
				searchParams.set(prop, qs[prop]);
			}
		}

		let response = await fetch(uri + "?" + searchParams.toString());

		if (response.ok) {
			return response.json();
		} else {
			let data = await response.text();
			throw new Error(`Network error; status ${response.status}; reply ${data}.`);
		}
	}

	async getRaw(uri: string, qs: any): Promise<any> {
		// TODO: this should not be in here (networkfetch should be agnostic of its callers)
		let headers: any = {
			'Origin': CONFIG.URL_SERVER,
			'Referer': CONFIG.URL_SERVER,
			'Accept': '*/*',
			'Accept-Encoding': 'gzip, deflate, br'
		};

		let response = await fetch(uri, {
			method: "get",
			headers: headers
		});

		if (response && response.ok && response.body) {
			var reader = response.body.getReader();
			let buffers: Buffer[] = [];
			let getAllData = async (): Promise<any> => {
				let result = await reader.read();
				if (!result.done) {
					buffers.push(new Buffer(result.value));
					return getAllData();
				}

				return Buffer.concat(buffers);
			}

			return getAllData();
		}

		throw new Error("Fail loading data");
	}
}