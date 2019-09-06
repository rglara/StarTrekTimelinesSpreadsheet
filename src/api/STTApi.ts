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
import { ImageCache, ImageProvider, WikiImageProvider, AssetImageProvider, ServerImageProvider, ImageProviderChain, FileImageCache } from './';
import { NeededEquipmentClass, EquipNeedFilter, EquipNeed } from './EquipmentTools';
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

	public platformConfig?: { config: PlatformConfigDTO; };
	public crewAvatars: CrewAvatar[];
	public serverConfig?: { config: ServerConfigDTO; };;
	public shipSchematics: ShipSchematicDTO[];
	public fleetData: any;
	public roster: CrewData[];
	public ships: ShipDTO[];
	public missions: MissionDTO[];
	public missionSuccess!: IChallengeSuccess[];
	public minimalComplement?: MinimalComplement;
	public imageProvider!: ImageProvider;
	public inWebMode: boolean;
	public allcrew!: CrewData[];

	public serverAddress: string = 'http://localhost/';

	// Used with Moment when adding an offset. Does not need to be used when
	// doing a fresh request for data such as for gauntlet or voyage status
	public lastSync: Moment.Moment = Moment();

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
			this.imageProvider = new ServerImageProvider(this.serverAddress);
		}
		else {
			//TODO: cache images coming from the wiki to prevent hammering their website with requests
			let cache : ImageCache = new FileImageCache();
			this.imageProvider = new ImageProviderChain(new AssetImageProvider(cache), new WikiImageProvider());
		}
	}

	async refreshEverything(logout: boolean) {
		this.crewAvatars = [];
		this.serverConfig = undefined;
		this._playerData = undefined;
		this.platformConfig = undefined;
		this.shipSchematics = [];
		this._starbaseData = null;
		this.fleetData = null;
		this._fleetMemberInfo = null;
		this.roster = [];
		this.ships = [];
		this.missions = [];
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
		return this.platformConfig!.config.trait_names[trait] ? this.platformConfig!.config.trait_names[trait] : trait;
	}

	getShipTraitName(trait: string): string {
		return this.platformConfig!.config.ship_trait_names[trait] ? this.platformConfig!.config.ship_trait_names[trait] : trait;
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

	async resyncInventory(): Promise<{ player: PlayerDTO }> {
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
						(itm) => itm.id !== data.event.content.gather_pools[0].adventures[0].id
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

	getNeededEquipment(filters: EquipNeedFilter, limitCrew: number[]): EquipNeed[] {
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
	full_body: ImageDataDTO;
	icon: ImageDataDTO;
	portrait: ImageDataDTO;

	hide_from_cryo: boolean;

	// These properties are added by the app
	iconUrl?: string;
}

export interface ImageDataDTO {
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
	ability?: {
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
	icon: ImageDataDTO;
	initial_cooldown: number;
	limit?: number;
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
	full_body: ImageDataDTO;
	icon: ImageDataDTO;
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
	portrait: ImageDataDTO;
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

	full_body: ImageDataDTO;
	id: number;
	crew_id?: number;
	//TODO: remove if unused
	active_id?: any;
	level: number;
	max_level?: number;
	max_rarity: number;
	name: string;
	portrait: ImageDataDTO;
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
	icon: ImageDataDTO;
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
	icon: ImageDataDTO;
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
	rewards?: { loot: RewardDTO[] };
}

export interface RewardDTO {
	bonuses?: { [key:number]: number };
	flavor: string;
	full_name: string;
	icon: ImageDataDTO;
	id: number;
	item_type?: number; // defined if type == 2
	name: string;
	quantity: number;
	rarity: number;
	symbol: string;
	type: number;
}

export interface VoyagePendingLootDTO {
	flavor: string;
	full_name: string;
	icon: ImageDataDTO;
	id: number;
	item_type?: number;
	name: string;
	quantity: number;
	rarity: number;
	symbol: string;
	type: number;
	action?: CrewActionDTO;
	full_body?: ImageDataDTO;
	portrait?: ImageDataDTO;
	skills?: { [skill: string]: SkillDTO; };
	traits?: string[];

	//TODO: added by the app?
	iconUrl?: string;
}

export interface VoyageDTO {
	completed_at: any; // was null; probably a string
	created_at: string;
	crew_slots: {
		crew: CrewDTO;
		name: string;
		skill: string;
		symbol: string;
		trait: string;
	}[];
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

export interface VoyageDescriptionDTO {
	crew_slots: {
		name: string;
		skill: string;
		symbol: string;
		trait: string;
	}[];
	description: string;
	icon: string; // unused?
	id: number; // unused?
	name: string; // unused?
	potential_rewards: any[];
	ship_trait: string;
	skills: { primary_skill: string; secondary_skill: string; };
	symbol: string; // unused?
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
	events: EventDTO[];
	factions: FactionDTO[];
	fleet_activities: any[];
	freestanding_quests: any[];
	gauntlets?: GauntletDTO[]; // Does not come with initial fetch, but gauntlet update is within character
	honor_reward_by_rarity: number[];
	id: number;
	item_limit: number;
	items: ItemDTO[];
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
	ships: ShipDTO[];
	shuttle_adventures: PlayerShuttleAdventureDTO[];
	shuttle_bayse: number;
	starbase_buffs: any[];
	stimpack: any; // null
	stored_immortals: { id: number; quantity: number; }[];
	tng_the_game_level: number;
	tutorials: any[];
	using_default_name: boolean;
	video_ad_chroniton_boost_reward: any;
	voyage: VoyageDTO[];
	voyage_descriptions: VoyageDescriptionDTO[];
	voyage_summaries: any;
	xp: number;
	xp_for_current_level: number;
	xp_for_next_level: number;
}

export interface PlayerShuttleAdventureDTO {
	challenge_rating: number;
	completes_in_seconds:number;
	faction_id: number;
	id:number;
	name: string;
	shuttles: PlayerShuttleDTO[];
	symbol: string;
	token_archetype_id: any; // null
	x: number;
	y: number;
}

export interface PlayerShuttleDTO {
	description: string;
	expires_in: number;
	faction_id: number
	id: number;
	is_rental: boolean;
	name: string;
	rewards: ShuttleRewardDTO[];
	slots: {
		level: any;
		required_trait: any;
		skills: string[];
		trait_bonuses: any;
	}[];
	state: number;
}

export interface FactionDTO {
	completed_shuttle_adventures: number;
	discovered: any; // number/bool
	event_winner_rewards: any[];
	home_system:string;
	icon: ImageDataDTO;
	id: number;
	name: string;
	representative_full_body: ImageDataDTO;
	representative_icon: ImageDataDTO;
	reputation: number;
	reputation_icon: ImageDataDTO;
	reputation_item_icon: ImageDataDTO;
	shop_layout: string;
	shuttle_mission_rewards: (PotentialRewardDTO | RewardDTO)[];
	shuttle_token_id: number;
	shuttle_token_preview_item: any;

	//HACK: added by app
	iconUrl?: string;
	storeItems?: FactionStoreItemDTO[];
}

export interface FactionStoreItemDTO {
	cost: { amount: number; currency: string; };
	count: number;
	info: string;
	lock_prereq: any;
	locked: boolean;
	offer: {
		cost: { amount: number; currency: string; };
		currency_bundle: string;
		game_item: RewardDTO;
		obtain: any;
		purchase_avail: number;
		purchase_limit: number;
	};
	symbol: string;
	type: string;
}

export interface ShipDTO {
	accuracy: number;
	actions: any[];
	antimatter: number;
	archetype_id: number;
	attack: number;
	attacks_per_second: number;
	battle_stations: any[];
	crit_bonus: number;
	crit_chance: number;
	evasion: number;
	flavor: string;
	hull: number;
	icon: ImageDataDTO;
	id: number;
	level: number;
	max_level: number;
	model: string;
	name: string;
	rarity: number;
	schematic_gain_cost_next_level: number;
	schematic_icon: ImageDataDTO;
	schematic_id: number;
	shield_regen: number;
	shields: number;
	symbol: string;
	traits: string[];
	traits_hidden: string;

	//Added by app
	traitNames?: string;
	iconUrl?: string;
}

export interface ShipSchematicDTO {
	cost: number;
	icon: ImageDataDTO;
	id: number;
	rarity: number;

	//HACK: using fields of ship DTO, but some fields are not provided by the schematic version
	ship: ShipDTO;
	// {
	// 	accuracy: number;
	// 	actions: any[];
	// 	antimatter: number;
	// 	archetype_id: number;
	// 	attack: number;
	// 	attacks_per_second: number;
	// 	crit_bonus: number;
	// 	crit_chance: number;
	// 	evasion: number;
	// 	flavor: string;
	// 	hull: number;
	// 	icon: ImageDataDTO;
	// 	max_level: number;
	// 	name: string;
	// 	rarity: number;
	// 	shield_regen: number;
	// 	shields: number;
	// 	symbol: string;
	// 	traits: string[];
	// 	traits_hidden: string;
	// };
}

export interface ItemArchetypeDTO {
	bonuses?: {[key:number] : number};
	flavor: string;
	icon: ImageDataDTO;
	id: number;
	//TODO: type details
	item_sources: any[];
	name: string;
	rarity: number;
	//TODO: type details
	recipe: any;
	short_name?: string;
	symbol: string;
	type: number;

	//HACK: added by the app
	iconUrl?: string;
}

export interface ItemDTO {
	archetype_id: number;
	expires_in: any;
	flavor: string;
	icon: ImageDataDTO;
	id: number;
	name: string;
	quantity: number;
	rarity: number;
	symbol: string;
	type: number;

	//HACK: added by app
	iconUrl?: string;
	//typeName?: string;
	cadetable?: string;
	factions?: string;
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

export interface PlatformConfigDTO {
	crew_exp_trainings: any[];
	faction_config: {
		reputation_buckets: {
			name: string;
			upper_bound?: number;
			status: string;
		}[];
	};
	honorable_citations: any[];
	id: number;
	platform: any;
	replicator_config: {
		currency_costs: { amount:number; currency:number;}[];
		fuel_blacklist: number[];
		fuel_costs: { item_type: number; rarity: number; fuel: number; }[];
		fuel_values: { item_type: number; rarity: number; fuel: number; }[];
		target_blacklist: number[];
	};
	ship_trait_names: { [trait: string]: string };
	trait_names: { [trait: string]: string };
	vip: any;
}

export interface ServerConfigDTO {
	asset_bundle_version: string;
	asset_force_cache_clean: any; // number/bool? came as 0
	asset_server: string;
	conflict: { tired_crew_coefficient: number; untrained_skill_coefficient: number; };
	craft_config: {
		cost_by_rarity_for_component: { currency: number; amount: number; }[];
		cost_by_rarity_for_equipment: { currency: number; amount: number; }[];
		recipe_tree: {
			digest: string;
			recipes: {
				id: number;
				recipe: {
					archetype_id: number;
					count: number;
				}[];
			}[];
		};
		specialist_challenge_rating: number;
		specialist_chance_formula: any;
		specialist_failure_bonus: number;
		specialist_maximum_success_chance: number;
	};
	crew_config: { fusion_cost_by_rarity: any[] };
	custom_event_batch_batch_limit: number;
	custom_event_batch_delay_period: number;
	default_galaxy_map_position: number[];
	default_galaxy_map_zoom: number;
	features_unlock_config: any;
	flag_for_voyage_death: number;
	fusion_costs: any;
	hazard_countdown_max: number;
	hazard_countdown_min: number;
	id: number;
	min_fleet_hours_for_activity: number;
	minimal_crew_count: number;
	performance_profile: any;
	platform: any;
	pvp: any;
	scans: any;
	server_environment: any;
	ship: any;
	shuttle_adventures: {
		secondary_skill_percentage: number;
		//unlisted: shuttle_speedup_formula_v2_dil_cost_1 through _5
		//unlisted: shuttle_speedup_formula_v2_time_1 through _5
		sigmoid_midpoint: number;
		sigmoid_steepness: number;
		speedup_formula_coefficient_1: number;
		speedup_formula_coefficient_2: number;
		speedup_formula_coefficient_3: number;
		speedup_seconds_per_currency_unit: number;
	};
	stats_config: any;
	tokens: { id: number; symbol: string; faction_id: number; }[];
	voyage_dying_indicator: number;
	voyages_matched_crew_trait_bonus: number;
	voyages_matched_ship_trait_bonus: number;
	voyages_seconds_per_narrative_event: number;
}

export interface MissionDTO {
	description: string;
	episode_title: string;
	id: number;
	quests: MissionQuestDTO[];
	stars_earned: number;
	total_stars: number;
}

export interface MissionQuestDTO {
	action: string;
	cadet: boolean;
	challenges: {
		children: number[];
		critical: {
			claimed: boolean;
			reward: RewardDTO[];
			standard_loot: PotentialRewardDTO[];
			threshold: number;
		};
		difficulty: number;
		difficulty_by_mastery: number[];
		grid_x: number;
		grid_y: number;
		id: number;
		image: ImageDataDTO;
		locks: any[];
		name: string;
		skill: string;
		trait_bonuses: {trait: string; bonuses: number[] }[];
	}[];
	crew_requirement: {
		description: string;
		max_stars: number;
		min_stars: number;
		traits: string[];
	};
	description: string;
	id: number;
	locked: boolean;
	mastery_levels: {
		energy_cost: number;
		id: number;
		jackpots: any[];
		locked: boolean;
		progress: { goal_progress: number; goals: number; };
		rewards: (PotentialRewardDTO | RewardDTO)[]; // first item is PotentialRewardDTO with type=0, second is RewardDTO
	}[];
	material_bundle: string;
	name: string;
	place: string;
	quest_type: string;
	star_background: boolean;
	symbol: string;
	timeline_action: ImageDataDTO;
	unlock_text: any;
}

export interface PotentialRewardDTO {
	icon: ImageDataDTO;
	potential_rewards: RewardDTO[];
	quantity: number;
	rarity: number;
	type: number; // =0
}

export interface EventDTO {
	bonus_text: string;
	bonus_victory_points: number;
	content: {
		content_type: string; // "gather" | "shuttles" | "skirmish" | ?

		// Galaxy/gather events
		craft_bonus: number;
		crew_bonuses?: {
			[crew_symbol: string] : number;
		};
		gather_pools: EventGatherPoolDTO[];
		refresh_cost: { amount: number; currency: number; };
		supports_boosts: boolean;

		// skirmish events
		bonus_crew?: {
			[crew_symbol: string]: number;
		};

		// faction events
		shuttles?: EventShuttleDTO[];

		// expedetion events
		special_crew?: string[];
	};
	description: string;
	featured_crew: {
		action: CrewActionDTO;
		flavor: string;
		full_body: ImageDataDTO;
		full_name: string;
		icon: ImageDataDTO;
		id: number;
		name: string;
		portrait: ImageDataDTO;
		quantity: number;
		rarity: number;
		skills: { [sk: string]: SkillDTO; };
		symbol: string;
		traits: string[];
		type: number;
	}[];
	id: number;
	instance_id: number;
	last_threshold_points: number;
	name: string;
	next_threshold_points: number;
	next_threshold_rewards: any[];
	opened: boolean;
	opened_phase: number;
	phases: any[];
	ranked_brackets: any[];
	rewards_teaser: string;
	rules: string;
	seconds_to_end: number;
	seconds_to_start: number;
	shop_layout: string;
	squadron_ranked_brackets: any[];
	status: number;
	threshold_rewards: any[];
	unclaimed_threshold_rewards: any[];
	victory_points: number;
}

export interface EventShuttleDTO {
	allow_borrow: boolean;
	crew_bonuses: { [crew_symbol: string] : number; };
	shuttle_mission_rewards: ShuttleRewardDTO[];
	token: number;
}

export interface ShuttleRewardDTO {
	flavor?: string;
	icon: ImageDataDTO;
	id?: number;
	name?: string;
	potential_rewards?: any[];
	quantity: number;
	rarity?: number;
	symbol?: string;
	type: number; // == 0 (rewards), 11 (VP), 12 (faction rep)
}

export interface EventGatherPoolAdventureDTO {
	demands: { archetype_id: number; count: number; }[];
	description: string;
	golden_octopus: boolean;
	id: number;
	name: string;
}

export interface EventGatherPoolDTO {
	adventures: EventGatherPoolAdventureDTO[];
	goal_index: number;
	golden_octopus_rewards: {
		faction_id: number;
		flavor: string;
		icon: ImageDataDTO;
		name: string;
		quantity: number;
		symbol: string;
		type: number;
	}[];
	id : number;
	rewards: any[];
}