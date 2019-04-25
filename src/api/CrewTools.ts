import STTApi from "./index";
import CONFIG from "./CONFIG";

export interface IBuffStat {
	multiplier: number;
	percent_increase: number;
};

export function calculateBuffConfig(): { [index: string]: IBuffStat } {
	const skills = ['command_skill', 'science_skill', 'security_skill', 'engineering_skill', 'diplomacy_skill', 'medicine_skill'];
	const buffs = ['core', 'range_min', 'range_max'];

	const buffConfig: { [index: string]: IBuffStat } = {};

	for(let skill of skills) {
		for(let buff of buffs) {
			buffConfig[`${skill}_${buff}`] = {
				multiplier: 1,
				percent_increase: 0
			};
		}
	}

	for(let buff of STTApi.playerData.character.crew_collection_buffs.concat(STTApi.playerData.character.starbase_buffs)) {
		if (buffConfig[buff.stat]) {
			if (buff.operator === 'percent_increase') {
				buffConfig[buff.stat].percent_increase += buff.value;
			} else if (buff.operator === "multiplier") {
				buffConfig[buff.stat].multiplier = buff.value;
			} else {
				console.warn(`Unknown buff operator '${buff.operator }' for '${buff.stat}'.`);
			}
		}
	}

	return buffConfig;
}

// WIP Interface for the Crew data.
export interface ICrew {
	level: number;
	max_level: number;
	rarity: number;
	in_buy_back_state: boolean;
	favorite: boolean;
	id: number;
	active_id: number;
}

function rosterFromCrew(rosterEntry: any, crew: any|ICrew): void {
	rosterEntry.level = crew.level;
	rosterEntry.max_level = crew.max_level;
	rosterEntry.rarity = crew.rarity;
	rosterEntry.buyback = crew.in_buy_back_state;
	rosterEntry.expires_in = crew.expires_in;
	rosterEntry.favorite = crew.favorite;
	rosterEntry.crew_id = crew.id;
	rosterEntry.active_id = crew.active_id;

	rosterEntry.voyage_score = 0;
	rosterEntry.gauntlet_score = 0;

	for (let skill in crew.skills) {
		rosterEntry[skill].core = crew.skills[skill].core;
		rosterEntry[skill].min = crew.skills[skill].range_min;
		rosterEntry[skill].max = crew.skills[skill].range_max;
		let profAvg = (crew.skills[skill].range_max + crew.skills[skill].range_min) / 2;
		rosterEntry[skill].voy = (crew.skills[skill].core + profAvg) || 0;
		rosterEntry.voyage_score += rosterEntry[skill].voy;
		rosterEntry.gauntlet_score += profAvg;
	}

	rosterEntry.command_skill_core = rosterEntry.command_skill.core;
	rosterEntry.science_skill_core = rosterEntry.science_skill.core;
	rosterEntry.security_skill_core = rosterEntry.security_skill.core;
	rosterEntry.engineering_skill_core = rosterEntry.engineering_skill.core;
	rosterEntry.diplomacy_skill_core = rosterEntry.diplomacy_skill.core;
	rosterEntry.medicine_skill_core = rosterEntry.medicine_skill.core;

	rosterEntry.command_skill_voy = rosterEntry.command_skill.voy;
	rosterEntry.science_skill_voy = rosterEntry.science_skill.voy;
	rosterEntry.security_skill_voy = rosterEntry.security_skill.voy;
	rosterEntry.engineering_skill_voy = rosterEntry.engineering_skill.voy;
	rosterEntry.diplomacy_skill_voy = rosterEntry.diplomacy_skill.voy;
	rosterEntry.medicine_skill_voy = rosterEntry.medicine_skill.voy;
	rosterEntry.usage_value = 0;

	rosterEntry.ship_battle = crew.ship_battle;
	rosterEntry.action = crew.action;
	rosterEntry.flavor = crew.flavor;

	rosterEntry.equipment_slots = crew.equipment_slots;

	rosterEntry.equipment_slots.forEach((equipment: any) => {
		equipment.have = false;
	});

	crew.equipment.forEach((equipment: any) => {
		rosterEntry.equipment_slots[equipment[0]].have = true;
	});

	rosterEntry.traits = '';
	rosterEntry.traits = crew.traits.concat(crew.traits_hidden).map((trait: any) => { return STTApi.getTraitName(trait); }).join();
	rosterEntry.rawTraits = crew.traits.concat(crew.traits_hidden);

	// Replace "nonhuman" with "alien" to make the search easier
	let nh = rosterEntry.rawTraits.indexOf('nonhuman');
	if (nh > -1) {
		rosterEntry.rawTraits.splice(nh,1);
		rosterEntry.rawTraits.push('alien');
	}
}

function getDefaultsInner(crew: any): any {
	if (!crew) {
		return undefined;
	}

	return {
		id: crew.id, name: crew.name, short_name: crew.short_name, max_rarity: crew.max_rarity, symbol: crew.symbol, isExternal: false,
		level: 0, rarity: 0, frozen: 0, buyback: false, traits: '', rawTraits: [], portrait: crew.portrait, full_body: crew.full_body,
		command_skill: { 'core': 0, 'min': 0, 'max': 0 }, science_skill: { 'core': 0, 'min': 0, 'max': 0 },
		security_skill: { 'core': 0, 'min': 0, 'max': 0 }, engineering_skill: { 'core': 0, 'min': 0, 'max': 0 },
		diplomacy_skill: { 'core': 0, 'min': 0, 'max': 0 }, medicine_skill: { 'core': 0, 'min': 0, 'max': 0 }
	};
}

function getDefaults(id: number): any {
	return getDefaultsInner(STTApi.getCrewAvatarById(id));
}

export function formatAllCrew(allcrew: any[]) {
	let roster: any[] = [];
	let dupeChecker = new Set<string>();
	allcrew.forEach((crew: any) => {
		// Sometimes duplicates can sneak into our allcrew list, filter them out
		if (dupeChecker.has(crew.symbol)) {
			return;
		}

		dupeChecker.add(crew.symbol);

		STTApi.applyBuffConfig(crew);

		let rosterEntry = getDefaultsInner(crew);
		rosterEntry.isExternal = true;

		rosterFromCrew(rosterEntry, crew);

		rosterEntry.archetypes = crew.archetypes;

		let avatar = STTApi.crewAvatars.find((av: any) => av.symbol === crew.symbol);
		if (avatar) {
			rosterEntry.id = avatar.id;
		}

		roster.push(rosterEntry);
	});

	for (let crew of roster) {
		// Populate default icons (if they're already cached)
		crew.iconUrl = STTApi.imageProvider.getCrewCached(crew, false);
		crew.iconBodyUrl = STTApi.imageProvider.getCrewCached(crew, true);
	}

	return roster;
}

export async function matchCrew(character: any): Promise<any> {
	let roster: any[] = [];
	let rosterEntry: any = {};

	// Add all the crew in the active roster
	character.crew.forEach((crew: any) => {
		rosterEntry = getDefaults(crew.archetype_id);
		if (!rosterEntry) {
			console.error(`Could not find the crew avatar for archetype_id ${crew.archetype_id}`);
			return;
		}

		rosterFromCrew(rosterEntry, crew);
		roster.push(rosterEntry);
	});

	// Now add all the frozen crew
	if (character.stored_immortals && character.stored_immortals.length > 0) {
		// Use the cache wherever possible
		// TODO: does DB ever change the stats of crew? If yes, we may need to ocasionally clear the cache - perhaps based on record's age
		let frozenPromises: Promise<any>[] = [];

		character.stored_immortals.forEach((crew: any) => {
			rosterEntry = getDefaults(crew.id);
			if (!rosterEntry) {
				console.error(`Could not find the crew avatar for frozen archetype_id ${crew.id}`);
				return;
			}
			rosterEntry.frozen = crew.quantity;
			rosterEntry.level = 100;
			rosterEntry.rarity = rosterEntry.max_rarity;
			roster.push(rosterEntry);

			frozenPromises.push(loadFrozen(rosterEntry));
		});

		await Promise.all(frozenPromises);
	}

	for (let crew of roster) {
		// Populate default icons (if they're already cached)
		crew.iconUrl = STTApi.imageProvider.getCrewCached(crew, false);
		crew.iconBodyUrl = STTApi.imageProvider.getCrewCached(crew, true);
	}

	function collect(skillField: string, extField: string, max:number) {
		let filtered = roster.filter(c => !c.buyback);
		if (extField) {
			filtered = filtered.filter(c => c[skillField][extField] > 0)
				.sort((a, b) => b[skillField][extField] - a[skillField][extField]);
		}
		else {
			filtered = filtered.filter(c => c[skillField] > 0)
				.sort((a, b) => b[skillField] - a[skillField]);
		}
		for (let i = 0; i < max && i < filtered.length; ++i) {
			// allow frozen items to be exported but not count towards top-10
			let c = filtered[i];
			if (c.frozen)
				++max;
			let value = c.usage_value;
			if (!c.usage_value) {
				c.usage_value = 1;
			}
			else {
				c.usage_value++;
			}
		}
	}

	collect('command_skill', 'core', 6);
	collect('diplomacy_skill', 'core', 6);
	collect('engineering_skill', 'core', 6);
	collect('medicine_skill', 'core', 6);
	collect('science_skill', 'core', 6);
	collect('security_skill', 'core', 6);
	collect('command_skill', 'max', 3);
	collect('diplomacy_skill', 'max', 3);
	collect('engineering_skill', 'max', 3);
	collect('medicine_skill', 'max', 3);
	collect('science_skill', 'max', 3);
	collect('security_skill', 'max', 3);
	collect('command_skill', 'voy', 9);
	collect('diplomacy_skill', 'voy', 9);
	collect('engineering_skill', 'voy', 9);
	collect('medicine_skill', 'voy', 9);
	collect('science_skill', 'voy', 9);
	collect('security_skill', 'voy', 9);
	collect('voyage_score', '', 9);
	collect('gauntlet_score', '', 9);

	return roster;
}

async function loadFrozen(rosterEntry: any): Promise<void> {
	let entry = await STTApi.immortals.where('symbol').equals(rosterEntry.symbol).first();
	if (entry) {
		//console.info('Found ' + rosterEntry.symbol + ' in the immortalized crew cache');
		STTApi.applyBuffConfig(entry.crew);
		rosterFromCrew(rosterEntry, entry.crew);
	} else {
		let crew = await STTApi.loadFrozenCrew(rosterEntry.symbol);
		rosterFromCrew(rosterEntry, crew);

		// We don't need to await, as this is just populating a cache and can be done whenever
		STTApi.immortals.put({
			symbol: rosterEntry.symbol,
			crew: crew
		});
	}
}

export function formatCrewStats(crew: any): string {
	let result = '';
	for (let skillName in CONFIG.SKILLS) {
		let skill = crew[skillName];

		if (skill.core && (skill.core > 0)) {
			result += `${CONFIG.SKILLS_SHORT[skillName]} (${Math.floor(skill.core + (skill.min + skill.max) / 2)}) `;
		}
	}
	return result;
}