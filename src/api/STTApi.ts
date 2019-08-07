/*
    StarTrekTimelinesSpreadsheet - A tool to help with crew management in Star Trek Timelines
    Copyright (c) 2017 - 2018 IAmPicard

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/
import { NetworkInterface } from './NetworkInterface';
import { NetworkFetch } from './NetworkFetch';
import { DexieCache, QuestsTable, EquipmentTable, ImmortalsDB, ConfigTable, WikiImageTable } from './Cache';
import { IChallengeSuccess } from './MissionCrewSuccess';
import { matchCrew, calculateBuffConfig, BuffStat } from './CrewTools';
import { MinimalComplement } from './MinimalComplement';
import { mergeDeep } from './ObjectMerge';
import { ImageProvider, ImageCache } from './ImageProvider';
import { WikiImageProvider } from './WikiImageTools';
import { AssetImageProvider } from './AssetImageProvider';
import { NeededEquipmentClass, IEquipNeedFilter, IEquipNeed } from './EquipmentTools';
import Dexie from 'dexie';
import CONFIG from './CONFIG';
import Moment from 'moment';

export class STTApiClass {
	private _accessToken: string | undefined;
	private _net: NetworkInterface;
	private _playerData?: { player: PlayerDTO; item_archetype_cache: { archetypes: ItemArchetypeDTO[]; id: number; }; };
	private _starbaseData: any;
	private _fleetMemberInfo: any;
	private _cache: DexieCache;
	private _buffConfig: { [index: string]: BuffStat };
	private _neededEquipment: NeededEquipmentClass;

	public platformConfig: any;
	public crewAvatars: CrewAvatar[];
	public serverConfig: any;
	public shipSchematics: any;
	public fleetData: any;
	public roster: CrewData[];
	public ships: any;
	public missions: any;
	public missionSuccess!: IChallengeSuccess[];
	public minimalComplement?: MinimalComplement;
	public imageProvider!: ImageProvider;
	public inWebMode: boolean;
	public allcrew!: CrewData[];

	public serverAddress: string = 'http://localhost/';

	// Used with Moment when adding an offset. Does not need to be used when
	// doing a fresh request for data such as for gauntlet or voyage status
	public lastSync: any;

	constructor() {
		this.refreshEverything(true);
		this._net = new NetworkFetch();
		this._neededEquipment = new NeededEquipmentClass();

		// TODO: Dexie uses IndexedDB, so doesn't work in plain node.js without polyfill - should the caching be an interface?
		this._cache = new DexieCache('sttcache');

		this.inWebMode = false;
		this._buffConfig = {};
		this.allcrew = [];
	}

	setWebMode(webMode: boolean, keepServerAddress: boolean) {
		this.inWebMode = webMode;

		if (this.inWebMode) {
			// In web mode, we don't hardcode the server, but simply load from the domain root
			if (!keepServerAddress) {
				this.serverAddress = '/';
			}

			this._net.setProxy(this.serverAddress + 'proxy');
		}
	}

	async refreshEverything(logout: boolean) {
		this.crewAvatars = [];
		this.serverConfig = null;
		this._playerData = undefined;
		this.platformConfig = null;
		this.shipSchematics = null;
		this._starbaseData = null;
		this.fleetData = null;
		this._fleetMemberInfo = null;
		this.roster = [];
		this.ships = null;
		this.missions = null;
		this.missionSuccess = [];
		this.minimalComplement = undefined;

		if (logout) {
			this._accessToken = undefined;

			if (this._cache) {
				await this._cache.config
					.where('key')
					.equals('autoLogin')
					.delete();
				await this._cache.config
					.where('key')
					.equals('accessToken')
					.delete();
			}
		}
	}

	setImageProvider(useAssets: boolean, imageCache: ImageCache) {
		if (useAssets) {
			this.imageProvider = new AssetImageProvider(imageCache);
		} else {
			this.imageProvider = new WikiImageProvider();
		}
	}

	setImageProviderOverride(iProvider: ImageProvider) {
		this.imageProvider = iProvider;
	}

	get networkHelper(): NetworkInterface {
		return this._net;
	}

	get quests(): Dexie.Table<QuestsTable, number> {
		return this._cache.quests;
	}

	get equipmentCache(): Dexie.Table<EquipmentTable, string> {
		return this._cache.equipment;
	}

	get immortals(): Dexie.Table<ImmortalsDB, string> {
		return this._cache.immortals;
	}

	get wikiImages(): Dexie.Table<WikiImageTable, string> {
		return this._cache.wikiImages;
	}

	get config(): Dexie.Table<ConfigTable, string> {
		return this._cache.config;
	}

	get loggedIn(): boolean {
		return this._accessToken != null;
	}

	get playerData(): PlayerDTO {
		return this._playerData!.player;
	}

	get itemArchetypeCache(): { archetypes: ItemArchetypeDTO[]; } {
		return this._playerData!.item_archetype_cache;
	}

	get fleetMembers(): any {
		return this._fleetMemberInfo.members;
	}

	get fleetSquads(): any {
		return this._fleetMemberInfo.squads;
	}

	get starbaseRooms(): any {
		return this._starbaseData[0].character.starbase_rooms;
	}

	getTraitName(trait: string): string {
		return this.platformConfig.config.trait_names[trait] ? this.platformConfig.config.trait_names[trait] : trait;
	}

	getShipTraitName(trait: string): string {
		return this.platformConfig.config.ship_trait_names[trait] ? this.platformConfig.config.ship_trait_names[trait] : trait;
	}

	getCrewAvatarById(id: number): CrewAvatar | undefined {
		return this.crewAvatars.find((avatar: CrewAvatar) => avatar.id === id);
	}

	getCrewAvatarBySymbol(symbol: string): CrewAvatar | undefined {
		return this.crewAvatars.find((avatar: CrewAvatar) => avatar.symbol === symbol);
	}

	async login(username: string, password: string, autoLogin: boolean): Promise<any> {
		let data = await this._net.post_proxy(CONFIG.URL_PLATFORM + 'oauth2/token', {
			username: username,
			password: password,
			client_id: CONFIG.CLIENT_ID,
			grant_type: 'password'
		});

		if (data.error_description) {
			throw new Error(data.error_description);
		} else if (data.access_token) {
			return this._loginWithAccessToken(data.access_token, autoLogin);
		} else {
			throw new Error('Invalid data for login!');
		}
	}

	async loginWithCachedAccessToken(): Promise<boolean> {
		let entry = await this._cache.config
			.where('key')
			.equals('autoLogin')
			.first();
		if (entry && entry.value === true) {
			entry = await this._cache.config
				.where('key')
				.equals('accessToken')
				.first();
			if (entry && entry.value) {
				this._accessToken = entry.value;
				return true;
			} else {
				return false;
			}
		} else {
			return false;
		}
	}

	private async _loginWithAccessToken(access_token: string, autoLogin: boolean): Promise<void> {
		this._accessToken = access_token;

		/*await*/ this._cache.config.put({
			key: 'autoLogin',
			value: autoLogin
		});

		if (autoLogin) {
			/*await*/ this._cache.config.put({
				key: 'accessToken',
				value: access_token
			});
		}
	}

	async loginWithFacebook(facebookAccessToken: string, facebookUserId: string, autoLogin: boolean): Promise<any> {
		let data = await this._net.post_proxy(CONFIG.URL_PLATFORM + 'oauth2/token', {
			'third_party.third_party': 'facebook',
			'third_party.access_token': facebookAccessToken,
			'third_party.uid': facebookUserId,
			client_id: CONFIG.CLIENT_ID,
			grant_type: 'third_party'
		});

		if (data.error_description) {
			throw new Error(data.error_description);
		} else if (data.access_token) {
			return this._loginWithAccessToken(data.access_token, autoLogin);
		} else {
			throw new Error('Invalid data for login!');
		}
	}

	async executeGetRequest(resourceUrl: string, qs: any = {}): Promise<any> {
		if (this._accessToken === undefined) {
			throw new Error('Not logged in!');
		}

		return this._net.get_proxy(
			CONFIG.URL_SERVER + resourceUrl,
			Object.assign({ client_api: CONFIG.CLIENT_API_VERSION, access_token: this._accessToken }, qs)
		);
	}

	async executeGetRequestWithUpdates(resourceUrl: string, qs: any = {}): Promise<any> {
		if (this._accessToken === undefined) {
			throw new Error('Not logged in!');
		}

		return this._net
			.get_proxy(
				CONFIG.URL_SERVER + resourceUrl,
				Object.assign({ client_api: CONFIG.CLIENT_API_VERSION, access_token: this._accessToken }, qs)
			)
			.then((data: any) => this.applyUpdates(data));
	}

	async executePostRequest(resourceUrl: string, qs: any): Promise<any> {
		if (this._accessToken === undefined) {
			throw new Error('Not logged in!');
		}

		return this._net.post_proxy(
			CONFIG.URL_SERVER + resourceUrl,
			Object.assign({ client_api: CONFIG.CLIENT_API_VERSION }, qs),
			this._accessToken
		);
	}

	async executePostRequestWithUpdates(resourceUrl: string, qs: any = {}): Promise<any> {
		if (this._accessToken === undefined) {
			throw new Error('Not logged in!');
		}

		return this._net
			.post_proxy(CONFIG.URL_SERVER + resourceUrl, Object.assign({ client_api: CONFIG.CLIENT_API_VERSION }, qs), this._accessToken)
			.then((data: any) => this.applyUpdates(data));
	}

	async loadServerConfig(): Promise<void> {
		let data = await this.executeGetRequest('config', {
			platform: 'WebGLPlayer',
			device_type: 'Desktop',
			client_version: CONFIG.CLIENT_VERSION,
			platform_folder: CONFIG.CLIENT_PLATFORM
		});

		this.serverConfig = data;
	}

	async loadCrewArchetypes(): Promise<void> {
		let data = await this.executeGetRequest('character/get_avatar_crew_archetypes');
		if (data.crew_avatars) {
			this.crewAvatars = data.crew_avatars as CrewAvatar[];
		} else {
			throw new Error('Invalid data for crew avatars!');
		}
	}

	async loadPlatformConfig(): Promise<void> {
		let data = await this.executeGetRequest('config/platform');
		this.platformConfig = data;
	}

	async loadPlayerData(): Promise<void> {
		let data = await this.executeGetRequest('player');
		if (data.player) {
			this._playerData = data;

			this.lastSync = Moment();

			// After loading player data, we can calculate the buff config for collections and starbase
			this._buffConfig = calculateBuffConfig();
		} else {
			throw new Error('Invalid data for player!');
		}
	}

	async resyncPlayerCurrencyData(): Promise<void> {
		// this code reloads minimal stuff to update the player information and merge things back in
		let data = await this.executeGetRequest('player/resync_currency');
		if (data.player) {
			this._playerData!.player = mergeDeep(this._playerData!.player, data.player);
		} else {
			throw new Error('Invalid data for player!');
		}
	}

	async resyncInventory(): Promise<any> {
		// TODO: we should sync this data back into _playerData.player somehow (but we're adding too much stuff onto it now to work, like iconUrls, immortals, etc.)
		let data = await this.executeGetRequest('player/resync_inventory');
		if (data.player) {
			return data;
		} else {
			throw new Error('Invalid data for player!');
		}
	}

	async loadShipSchematics(): Promise<void> {
		let data = await this.executeGetRequest('ship_schematic');
		if (data.schematics) {
			this.shipSchematics = data.schematics;
		} else {
			throw new Error('Invalid data for ship schematics!');
		}
	}

	async loadFrozenCrew(symbol: string): Promise<CrewDTO> {
		let data = await this.executePostRequest('stasis_vault/immortal_restore_info', { symbol: symbol });
		if (data.crew) {
			return data.crew as CrewDTO;
		} else {
			throw new Error('Invalid data for frozen crew!');
		}
	}

	async sellCrew(id: number): Promise<any> {
		return this.executePostRequestWithUpdates('crew/sell', { id: id });
	}

	async sellManyCrew(ids: number[]): Promise<any> {
		return this.executePostRequestWithUpdates('crew/sell_many', { ids: ids });
	}

	async warpQuest(id: number, mastery_level: number, factor: number): Promise<any> {
		let data = await this.executeGetRequest('quest/warp', { id, mastery_level, factor });
		if (data) {
			return this.applyUpdates(data);
		} else {
			throw new Error('Invalid data for quest warp!');
		}
	}

	async loadFleetMemberInfo(guildId: string): Promise<void> {
		let data = await this.executePostRequest('fleet/complete_member_info', { guild_id: guildId });
		if (data) {
			this._fleetMemberInfo = data;
		} else {
			throw new Error('Invalid data for fleet member info!');
		}
	}

	async loadFleetData(guildId: string): Promise<void> {
		let data = await this.executeGetRequest('fleet/' + guildId);
		if (data.fleet) {
			this.fleetData = data.fleet;
		} else {
			throw new Error('Invalid data for fleet!');
		}
	}

	async loadStarbaseData(guildId: string): Promise<void> {
		let data = await this.executeGetRequest('starbase/get');
		if (data) {
			this._starbaseData = data;
		} else {
			throw new Error('Invalid data for starbase!');
		}
	}

	async inspectPlayer(playerId: string): Promise<any> {
		let data = await this.executeGetRequest('player/inspect/' + playerId);
		if (data.player) {
			return data.player;
		} else {
			throw new Error('Invalid data for player!');
		}
	}

	// getGithubReleases(): Promise<any> {
	// 	return this._net.get(CONFIG.URL_GITHUBRELEASES, {});
	// }

	async refreshRoster(): Promise<void> {
		// TODO: need to reload icon urls as well
		this.roster = await matchCrew(this._playerData!.player.character);
	}

	async applyUpdates(data: any): Promise<any[]> {
		if (!data) {
			return [];
		}

		if (Array.isArray(data)) {
			let ephemerals: any[] = [];
			for (let val of data) {
				let e = await this.applyUpdates(val);
				ephemerals = ephemerals.concat(e);
			}

			return ephemerals;
		} else {
			if (!data.action) {
				console.log(`Not sure what message this is; should we be updating something: '${data}'`);
				return [data];
			}

			if (data.action === 'update') {
				if (data.player) {
					this._playerData!.player = mergeDeep(this._playerData!.player, data.player);
				}

				if (data.character) {
					this._playerData!.player.character = mergeDeep(this._playerData!.player.character, data.character);
				}

				if (data.event) {
					if(this._playerData!.player.character.events && this._playerData!.player.character.events.length === 1) {
						this._playerData!.player.character.events[0] = mergeDeep(this._playerData!.player.character.events[0], data.event);
					}
				}
			} else if (data.action === 'delete') {
				// TODO
				// For example, data.character.items, array with objects with just the id property in them

				if (data.character) {
					let pc :any = this._playerData!.player.character; // remove type info to allow object indexing
					for (let prop in data.character) {
						if (Array.isArray(data.character[prop]) && Array.isArray(pc[prop])) {
							for (let item of data.character[prop]) {
								pc[prop] = pc[prop].filter((itm: any) => itm.id !== item.id);
							}
						}
					}
				} else if (
					data.event &&
					data.event.content.gather_pool &&
					data.event.content.gather_pool.length === 1 &&
					data.event.content.gather_pools[0].adventures &&
					data.event.content.gather_pools[0].adventures.length === 1
				) {
					this._playerData!.player.character.events[0].content.gather_pools[0].adventures = this._playerData!.player.character.events[0].content.gather_pools[0].adventures.filter(
						(itm: any) => itm.id !== data.event.content.gather_pools[0].adventures[0].id
					);
				} else {
					console.warn('Delete not applied; data is most likely stale; user should refresh');
				}
			} else if (data.action === 'ephemeral') {
				return [data];
			} else {
				console.log(`Unknown data action '${data.action}' not applied. Data is most likely stale; user should refresh`);
			}

			return [];
		}
	}

	/// Takes the raw stats from a crew and applies the current player buff config (useful for imported crew)
	applyBuffConfig(crew: CrewDTO): void {
		const getMultiplier = (skill: string, stat: string) => {
			return this._buffConfig[`${skill}_${stat}`].multiplier + this._buffConfig[`${skill}_${stat}`].percent_increase;
		};

		for (let skill in crew.base_skills) {
			let cs: any = crew.skills;
			let css: SkillDTO = cs[skill];
			let cb: any = crew.base_skills;
			let cbs: SkillDTO = cb[skill];

			if (!cbs) {
				continue;
			}

			css.core = Math.round(cbs.core * getMultiplier(skill, 'core'));
			css.range_min = Math.round(cbs.range_min * getMultiplier(skill, 'range_min'));
			css.range_max = Math.round(cbs.range_max * getMultiplier(skill, 'range_max'));
		}
	}

	getNeededEquipment(filters: IEquipNeedFilter, limitCrew: number[]): IEquipNeed[] {
		return this._neededEquipment.filterNeededEquipment(filters, limitCrew);
	}

	getEquipmentManager() : NeededEquipmentClass {
		return this._neededEquipment;
	}
}

export interface CrewAvatar {
	id: number;
	symbol: string;
	name: string;
	short_name: string;
	max_rarity: number;
	traits: string[];
	traits_hidden: string[];
	skills: string[];
	default_avatar: boolean;
	full_body: ImageData;
	icon: ImageData;
	portrait: ImageData;

	hide_from_cryo: boolean;

	// These properties are added by the app
	iconUrl?: string;
}

export interface ImageData {
	file: string;
}

export interface SkillDTO {
	core: number;
	range_min: number;
	range_max: number;
}
export interface SkillData {
	core: number;
	min: number;
	max: number;
	voy?: number;
}

export interface CrewActionDTO {
	ability: {
		amount: number;
		condition: number;
		type: number;
	};
	bonus_amount: number;
	bonus_type: number;
	charge_phases?: { charge_time: number; ability_amount: number; }[];
	cooldown: number;
	crew: number;
	duration: number;
	icon: ImageData;
	initial_cooldown: number;
	name: string;
	special: boolean;
	symbol: string;
}

export interface CrewDTO {
	action: CrewActionDTO;
	active_id: any;
	active_index: number;
	active_status: number;
	archetype_id: number;
	base_skills: { [sk: string] : SkillDTO; };
	cap_achiever: {
		date: number;
		name: string;
	};

	cross_fuse_targets: any;
	default_avatar: boolean;
	equipment: number[][];
	equipment_rank: number;
	equipment_slots: {
		level: number;
		archetype: number;
	} [];
	expires_in: any;
	favorite: boolean;
	flavor: string;
	full_body: ImageData;
	icon: ImageData;
	id: number;
	in_buy_back_state: boolean;
	level: number;
	max_equipment_rank: number;
	max_level: number;
	max_rarity: number;
	max_xp: number;
	name: string;
	passive_id: any;
	passive_index: number;
	passive_status: number;
	portrait: ImageData;
	rarity: number;
	ship_battle: {
		accuracy: number;
		crit_bonus: number;
		crit_chance: number;
		evasion: number;
	};
	short_name: string;
	skills: { [sk: string]: SkillDTO; };
	symbol: string;
	traits: string[];
	traits_hidden: string[];
	voice_over: any;
	xp: number;
	xp_for_current_level: number;
	xp_for_next_level: number;

	// These properties are added by the app
	//TODO: where is this needed?
	/** @deprecated */
	archetypes?: any;
}

export interface CrewData {

	full_body: ImageData;
	id: number;
	crew_id?: number;
	//TODO: remove if unused
	active_id?: any;
	level: number;
	max_level?: number;
	max_rarity: number;
	name: string;
	portrait: ImageData;
	rarity: number;
	short_name: string;
	skills: { [sk:string] : SkillData; };
	//TODO: deprecate these raw fields and use the indexed 'skills' structure
	command_skill: SkillData;
	diplomacy_skill: SkillData;
	engineering_skill: SkillData;
	medicine_skill: SkillData;
	science_skill: SkillData;
	security_skill: SkillData;
	command_skill_core?: number;
	diplomacy_skill_core?: number;
	engineering_skill_core?: number;
	medicine_skill_core?: number;
	science_skill_core?: number;
	security_skill_core?: number;
	command_skill_voy?: number;
	diplomacy_skill_voy?: number;
	engineering_skill_voy?: number;
	medicine_skill_voy?: number;
	science_skill_voy?: number;
	security_skill_voy?: number;

	symbol: string;
	traits: string;
	rawTraits: string[];

	isExternal: boolean;
	frozen: number;
	buyback: boolean;

	iconUrl?: string;
	iconBodyUrl?: string;
	expires_in?: number;
	favorite?: boolean;
	usage_value?: number;
	voyage_score?: number;
	gauntlet_score?: number;

	ship_battle?: any;
	action?: any;
	flavor?: string;
	equipment_slots: {
		archetype: number;
		level: number;
		symbol?: any;
		have?: boolean;
	}[];

	archetypes?: any[];
}

export interface GauntletDTO {
	bracket_id: string;
	consecutive_wins: number;
	contest_data: {
		featured_skill: string;
		primary_skill: string;
		secondary_skill: string;
		traits: string[];
		selected_crew: GauntletCrewDTO[];

		contest_rewards: any[];
		ranked_rewards: any[];
		crit_chance_per_trait: number;
	};

	gauntlet_id: number;
	jackpot_crew: string;
	opponents: GauntletOpponentDTO[];

	rank: number;
	score: number;
	seconds_to_end: number;
	seconds_to_join?: number; // only if gauntlet has not started
	seconds_to_next_crew_refresh: number;
	seconds_to_next_opponent_refresh: number;
	state: string;
	refresh_cost: { currency:number; amount:number};
	revive_and_save_cost: { currency: number; amount: number };
	revive_cost: {currency: number; amount: number};
}

export interface GauntletCrewDTO {
	archetype_symbol: string;
	crew_id: number;
	crit_chance: number;
	debuff: number;
	disabled: boolean;
	level: number;
	max_rarity: number;
	rarity: any; // huh? came in as boolean
	selected: boolean;
	skills: {min: number; max:number; skill:string}[];

	/** @deprecated Added by app, but unused? */
	iconUrl?: any;
}

export interface GauntletOpponentDTO {
	crew_contest_data: { crew: GauntletCrewDTO[]; };
	icon: ImageData;
	level: number;
	name: string;
	player_id: number;
	rank: number;
	value: number;
}

export interface GauntletContestDTO {
	player_rolls: number[];
	player_crit_rolls: boolean[];
	opponent_rolls: number[];
	opponent_crit_rolls: boolean[];
	opponent_score: number;
	opponent_value: number;
	value: number;
	win: boolean;
	action: string;
	loot_box_rarity: number;
}

export interface GauntletContestLootDTO {
	flavor: string;
	full_name: string;
	icon: ImageData;
	id: number;
	instance: {bucket:string; id:number;};
	name: string;
	quantity: number;
	rarity: number;
	symbol: string;
	type: number;
}

export interface VoyageUpdateDTO {
	hp: number;
	id: number;
	seconds_since_last_dilemma: number;
	state: string;
	time_to_next_event: number;
	voyage_duration: number;
}

export interface VoyageNarrativeDTO {
	index: number;
	text: string;
	encounter_type: string;
	event_time: number
	crew?: string[];
	skill_check?: { skill: string; passed: boolean; };
	rewards?: { loot: VoyageLootDTO[] };
}

export interface VoyageLootDTO {
	flavor: string;
	full_name: string;
	icon: ImageData;
	id: number;
	item_type?: number;
	name: string;
	quantity: number;
	rarity: number;
	symbol: string;
	type: number;
}

export interface VoyagePendingLootDTO {
	icon: ImageData;
	flavor: string;
	full_name: string;
	id: number;
	item_type?: number;
	name: string;
	quantity: number;
	rarity: number;
	symbol: string;
	type: number;
	action?: CrewActionDTO;
	full_body?: ImageData;
	portrait?: ImageData;
	skills?: {
		command_skill ?: SkillDTO;
		diplomacy_skill ?: SkillDTO;
		engineering_skill ?: SkillDTO;
		medicine_skill ?: SkillDTO;
		science_skill ?: SkillDTO;
		security_skill ?: SkillDTO;
	};

	traits?: string[];

	//TODO: added by the app?
	iconUrl?: string;
}

export interface VoyageDTO {
	completed_at: any; // was null; probably a string
	created_at: string;
	crew_slots: { crew: any; name: string; skill: string; symbol: string; trait: string; }[];
	description: string; // seems to be unused
	dilemma?: any;
	first_leave: boolean;
	granted_rewards: any; // was null
	hp: number;
	icon: string;
	id: number;
	log_index: number;
	max_hp: number;
	name: string; // seems to be unused
	pending_rewards: { loot: VoyagePendingLootDTO[] };
	recalled_at: string;
	recall_time_left?: number;
	seconds_between_dilemmas: number;
	seconds_since_last_dilemma: number;
	seed: number;
	ship_id: number;
	ship_name: string;
	ship_trait: string;
	skill_aggregates: { [sk: string]: { skill: string; core: number; range_min: number; range_max: number; } };
	skills: { primary_skill: string; secondary_skill: string; };
	speedup_cost?: { currency: number; amount: number; };
	state: string;
	time_to_next_event: number;
	voyage_duration: number;
}

export interface PlayerDTO {
	character: PlayerCharacterDTO;
	chats: any;
	commerce: any;
	community_links: any;
	currency_exchanges: any;
	dbid: number;
	display_name: string;
	entitlements: any;
	environment: any;
	fleet: any;
	fleet_invite: any;
	honor: number;
	id: number;
	lang: string;
	locale: string;
	mailbox: any;
	money: number;
	motd: any;
	npe_complete: boolean;
	premium_earnable: number;
	premium_purchasable: number;
	replicator_limit: number;
	replicator_uses_today: number;
	shuttle_rental_tokens: number;
	squad: { id: number; rank: string; };
	timezone: string;
	vip_level: number;
	vip_points: number;
}

export interface PlayerCharacterDTO {
	accepted_missions: any[];
	active_conflict: any; // null
	boost_windows: any[];
	cadet_schedule: any;
	cadet_tickets: any;
	can_purchase_crew_limit_increase: boolean;
	can_purchase_shuttle_bay: boolean;
	crew: CrewDTO[];
	crew_avatar: any;
	crew_borrows: any[];
	crew_collection_buffs: any[];
	crew_limit: number;
	crew_limit_increase_per_purchase: number;
	crew_shares: any[];
	cryo_collections: CryoCollectionDTO[];
	current_ship_id: number;
	daily_activities: any[];
	daily_rewards_state: any;
	destination: any;
	display_name: string;
	dispute_histories: any[];
	disputes: any[];
	event_tickets: any;
	events: any[];
	factions: any[];
	fleet_activities: any[];
	freestanding_quests: any[];
	gauntlets?: GauntletDTO[]; // Does not come with initial fetch, but gauntlet update is within character
	honor_reward_by_rarity: number[];
	id: number;
	item_limit: number;
	items: any[];
	level: number;
	location: { place:string; setup: string; system: string; x: number; y:number; };
	location_channel_prefix: string;
	max_level: number;
	navmap: any;
	next_crew_limit_increase_cost: {currency:number; amount: number; };
	next_daily_activity_reset: number;
	next_fleet_activity_reset: number;
	next_shuttle_bay_cost: any;
	next_starbase_donation_reset: number;
	open_packs: any[];
	pvp_divisions: any[];
	pvp_tickets: any;
	pvp_timer: any;
	replay_energy_max: number;
	replay_energy_overflow: number;
	replay_energy_rate: number;
	reroll_descriptions: any[];
	scan_speedups_today: number;
	seasons: any;
	seconds_from_last_boost_claim: number;
	seconds_from_replay_energy_basis: number;
	seconds_to_scan_cooldown: number;
	ships: any[];
	shuttle_adventures: any[];
	shuttle_bayse: number;
	starbase_buffs: any[];
	stimpack: any; // null
	stored_immortals: { id: number; quantity: number; }[];
	tng_the_game_level: number;
	tutorials: any[];
	using_default_name: boolean;
	video_ad_chroniton_boost_reward: any;
	voyage: VoyageDTO[];
	voyage_descriptions: any[];
	voyage_summaries: any;
	xp: number;
	xp_for_current_level: number;
	xp_for_next_level: number;
}

interface ItemArchetypeDTO {
	bonuses?: {[key:number] : number};
	flavor: string;
	icon: ImageData;
	id: number;
	item_sources: any[];
	name: string;
	rarity: number;
	recipe: any;
	short_name?: string;
	symbol: string;
	type: number;

	//HACK: added by the app
	iconUrl?: string;
}

export interface CryoCollectionDTO {
	claimable_milestone_index: number;
	description: string;
	extra_crew: number[];
	id: number;
	image: string;
	milestone: { rewards: any[]; goal: number; buffs: any[]; };
	name: string;
	progress: number;
	traits: string[];
	type_id: number;

	//HACK: added by the app
	iconUrl?: string;
}