import fs from 'fs';
import { URLSearchParams } from 'url';
import fetch from 'node-fetch';

import { Logger } from './logger';

export class ProxyResult {
    Status: number = 200;
    Body: any = undefined;
}

export class ProxyClass {
    private _item_archetype_cache: any[];

    constructor() {
        if (!fs.existsSync('cache/')) {
            fs.mkdirSync('cache/');
        }

        if (fs.existsSync('cache/archetype_cache.json')) {
            this._item_archetype_cache = JSON.parse(fs.readFileSync('cache/archetype_cache.json', 'utf8'));
        } else {
            this._item_archetype_cache = [];
        }

        Logger.info('Initializing proxy', { size_archetypes: this._item_archetype_cache.length });
    }

    async get(uri: string, qs: any, ip: string): Promise<ProxyResult> {
        if (!uri.startsWith('https://stt.disruptorbeam.com') && !uri.startsWith('https://thorium.disruptorbeam.com')) {
            return {
                Status: 400,
                Body: "How did you get here and what are your intentions!?"
            };
        }

        Logger.info('Proxy GET', { uri });

        let searchParams = new URLSearchParams();
        for (const prop of Object.keys(qs)) {
            if (Array.isArray(qs[prop])) {
                qs[prop].forEach((entry: any) => {
                    searchParams.append(prop + '[]', entry);
                });
            }
            else {
                searchParams.set(prop, qs[prop]);
            }
        }

        let response = await fetch(uri + "?" + searchParams.toString());

        if (response.ok && (uri === 'https://stt.disruptorbeam.com/player')) {
            // Additional processing for player data to save on number of requests
            let playerData = await response.json();
            let originalStatus = response.status;

            await this.preProcessPlayerData(playerData, ip);

            await this.processPlayerData(playerData, qs, 0);

            return {
                Status: originalStatus,
                Body: playerData
            };
        } else {
            return {
                Status: response.status,
                Body: await response.text()
            };
        }
    }

    async post(uri: string, form: any, bearerToken: string | undefined): Promise<ProxyResult> {
        if (!uri.startsWith('https://stt.disruptorbeam.com') && !uri.startsWith('https://thorium.disruptorbeam.com')) {
            return {
                Status: 400,
                Body: "How did you get here and what are your intentions!?"
            };
        }

        Logger.info('Proxy POST', { uri });

        let searchParams = new URLSearchParams();
        for (const prop of Object.keys(form)) {
            searchParams.set(prop, form[prop]);
        }

        let headers: any = {
            "Content-type": "application/x-www-form-urlencoded; charset=UTF-8",
            'Origin': "https://stt.disruptorbeam.com/",
            'Referer': "https://stt.disruptorbeam.com/"
        };

        if (bearerToken !== undefined) {
            headers.Authorization = "Bearer " + Buffer.from(bearerToken).toString('base64');
        }

        let response = await fetch(uri, {
            method: "post",
            headers: headers,
            body: searchParams.toString()
        });

        if (response.ok && (uri === 'https://stt.disruptorbeam.com/stasis_vault/immortal_restore_info')) {
            // Additional processing for immortal restore
            let frozenData = await response.json();
            let originalStatus = response.status;

            await this.processFrozenData(frozenData);

            return {
                Status: originalStatus,
                Body: frozenData
            };
        } else {
            return {
                Status: response.status,
                Body: await response.text()
            };
        }
    }

    // TODO: the immortals should be loaded from cache instead of stored on the client (but with the right buffs applied to skills)
    private async processFrozenData(frozenData: any) {
        // TODO: this should probably live in memory instead (or at least the Set / list of symbols should)
        if (!fs.existsSync(`cache/${frozenData.crew.symbol}.json`)) {
            await new Promise((resolve, reject) => {
                fs.writeFile(`cache/${frozenData.crew.symbol}.json`, JSON.stringify(frozenData), (err) => {
                    if (err) {
                        reject(err);
                    }

                    resolve();
                });
            });
        }
    }

    private async preProcessPlayerData(playerData: any, ip: string) {
        let promises: Promise<void>[] = [];
        playerData.player.character.crew.forEach((crew: any) => {
            if ((crew.level === 100) && (crew.rarity === crew.max_rarity)) {
                // Add this to the immortal list
                promises.push(this.processFrozenData({ crew }));
            }
        });

        await Promise.all(promises);
    }

    // TODO: equipment details for frozen crew not loaded
    private async processPlayerData(playerData: any, qs: any, stack: number) {
        let mapEquipment = new Set();
        let missingEquipment = new Set();

        playerData.item_archetype_cache.archetypes.forEach((equipment: any) => {
            mapEquipment.add(equipment.id);
        });

        // Search for all equipment in the recipe tree
        playerData.item_archetype_cache.archetypes.forEach((equipment: any) => {
            if (equipment.recipe && equipment.recipe.demands && (equipment.recipe.demands.length > 0)) {
                equipment.recipe.demands.forEach((item: any) => {
                    if (!mapEquipment.has(item.archetype_id)) {
                        missingEquipment.add(item.archetype_id);
                    }
                });
            }
        });

        // Search for all equipment currently assigned to crew
        playerData.player.character.crew.forEach((crew: any) => {
            crew.equipment_slots.forEach((es: any) => {
                if (!mapEquipment.has(es.archetype)) {
                    missingEquipment.add(es.archetype);
                }
            });
        });

        if (missingEquipment.size > 0) {
            // We have some equipment without details, let's look in the cache
            // TODO: The cache needs to account for a recipe tree digest! - in particular, we should purge the cache when the digest changes

            // Add all equipment in the cache that is not already in playerData
            if (this._item_archetype_cache.length > 0) {
                this._item_archetype_cache.forEach((item) => {
                    if (!mapEquipment.has(item.id)) {
                        playerData.item_archetype_cache.archetypes.push(item);
                        mapEquipment.add(item.id);
                        missingEquipment.delete(item.id);
                    }
                });
            }

            if (missingEquipment.size > 0) {
                // After adding everything in the cache, there is still equipment we don't know about, let's load it from DB's servers
                let loadedArchetypes: any[] = [];

                let equipmentIds = Array.from(missingEquipment);
                while (equipmentIds.length > 0) {
                    // Load 20 at a time, as that appears to be the maximum allowed
                    let toLoad = equipmentIds.splice(0, 20);

                    let searchParams = new URLSearchParams();
                    searchParams.set('client_api', qs.client_api);
                    searchParams.set('access_token', qs.access_token);
                    toLoad.forEach((id) => {
                        searchParams.append('ids[]', id);
                    });

                    let response = await fetch('https://stt.disruptorbeam.com/item/description?' + searchParams.toString());
                    if (!response.ok) {
                        let data = await response.text();
                        throw new Error(`Network error; status ${response.status}; reply ${data}.`);
                    }

                    let data = await response.json();
                    if (data.item_archetype_cache && data.item_archetype_cache.archetypes) {
                        loadedArchetypes = loadedArchetypes.concat(data.item_archetype_cache.archetypes);
                    }
                }

                playerData.item_archetype_cache.archetypes = playerData.item_archetype_cache.archetypes.concat(loadedArchetypes);

                // Now insert them into the cache as well
                await this.updateArchetypeCache(playerData.item_archetype_cache.archetypes);
            }

            // Now recurse to fill in any missing pieces in the recipe tree
            if (stack < 4) {
                await this.processPlayerData(playerData, qs, stack + 1);
            }
        }
    }

    private async updateArchetypeCache(archetypes: any) {
        this._item_archetype_cache = archetypes;

        return new Promise((resolve, reject) => {
            fs.writeFile('cache/archetype_cache.json', JSON.stringify(this._item_archetype_cache), (err) => {
                if (err) {
                    reject(err);
                }

                resolve();
            });
        });
    }
}

export let STTProxy = new ProxyClass();