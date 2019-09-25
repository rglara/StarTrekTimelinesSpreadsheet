import STTApi from "./index";
import CONFIG from "./CONFIG";
import { CrewAvatar, CrewData, CrewDTO, PlayerCharacterDTO, SkillData} from './STTApi'

export interface BuffStat {
	multiplier: number;
	percent_increase: number;
};

export function calculateBuffConfig(): { [index: string]: BuffStat } {
	const skills = Object.keys(CONFIG.SKILLS);
	const buffs = ['core', 'range_min', 'range_max'];

	const buffConfig: { [index: string]: BuffStat } = {};

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


function rosterFromCrew(rosterEntry: CrewData, crew: CrewDTO): void {
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

	rosterEntry.skills = {};

	for (let skill in crew.skills) {
		let re: any = rosterEntry;
		let cs: any = crew.skills;
		let sd: SkillData = {
			core: cs[skill].core,
			min: cs[skill].range_min,
			max: cs[skill].range_max,
		};
		re[skill] = sd;
		rosterEntry.skills[skill] = sd;
		let profAvg = (cs[skill].range_max + cs[skill].range_min) / 2;
		sd.voy = (cs[skill].core + profAvg) || 0;
		rosterEntry.voyage_score += re[skill].voy;
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
	if (!rosterEntry.ship_battle.accuracy) {
		rosterEntry.ship_battle.accuracy = 0;
	}
	if (!rosterEntry.ship_battle.crit_bonus) {
		rosterEntry.ship_battle.crit_bonus = 0;
	}
	if (!rosterEntry.ship_battle.crit_chance) {
		rosterEntry.ship_battle.crit_chance = 0;
	}
	if (!rosterEntry.ship_battle.evasion) {
		rosterEntry.ship_battle.evasion = 0;
	}
	rosterEntry.action = crew.action;
	rosterEntry.flavor = crew.flavor;

	rosterEntry.equipment_slots = crew.equipment_slots;

	rosterEntry.equipment_slots.forEach((equipment) => {
		equipment.have = false;
	});

	crew.equipment.forEach(equipment => {
		rosterEntry.equipment_slots[equipment[0]].have = true;
	});

	rosterEntry.traits = '';
	rosterEntry.traits = crew.traits.concat(crew.traits_hidden).map((trait) => STTApi.getTraitName(trait)).join();
	rosterEntry.rawTraits = crew.traits.concat(crew.traits_hidden);

	// Replace "nonhuman" with "alien" to make the search easier
	let nh = rosterEntry.rawTraits.indexOf('nonhuman');
	if (nh > -1) {
		rosterEntry.rawTraits.splice(nh,1);
		rosterEntry.rawTraits.push('alien');
	}
}

function getDefaultsInner(crew?: CrewAvatar | CrewDTO): CrewData | undefined {
	if (!crew) {
		return undefined;
	}

	return {
		id: crew.id, name: crew.name, short_name: crew.short_name, max_rarity: crew.max_rarity, symbol: crew.symbol, isExternal: false,
		level: 0, rarity: 0, frozen: 0, buyback: false, traits: '', rawTraits: [], portrait: crew.portrait, full_body: crew.full_body,
		command_skill: { 'core': 0, 'min': 0, 'max': 0 }, science_skill: { 'core': 0, 'min': 0, 'max': 0 },
		security_skill: { 'core': 0, 'min': 0, 'max': 0 }, engineering_skill: { 'core': 0, 'min': 0, 'max': 0 },
		diplomacy_skill: { 'core': 0, 'min': 0, 'max': 0 }, medicine_skill: { 'core': 0, 'min': 0, 'max': 0 },
		equipment_slots: [], skills: {}
	};
}

function getDefaults(id: number): CrewData | undefined {
	return getDefaultsInner(STTApi.getCrewAvatarById(id));
}

export function formatAllCrew(allcrew: CrewDTO[]): CrewData[] {
	let roster: CrewData[] = [];
	let dupeChecker = new Set<string>();
	allcrew.forEach((crew: CrewDTO) => {
		// Sometimes duplicates can sneak into our allcrew list, filter them out
		let key = crew.symbol + '.' + crew.level + '.' + crew.rarity;
		if (dupeChecker.has(key)) {
			return;
		}

		dupeChecker.add(key);

		STTApi.applyBuffConfig(crew);

		let rosterEntry = getDefaultsInner(crew);
		if (!rosterEntry) {
			return;
		}
		rosterEntry.isExternal = true;

		rosterFromCrew(rosterEntry, crew);

		rosterEntry.archetypes = crew.archetypes;

		let avatar = STTApi.getCrewAvatarBySymbol(crew.symbol);
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

export async function matchCrew(character: PlayerCharacterDTO): Promise<CrewData[]> {
	let roster: CrewData[] = [];

	// Add all the crew in the active roster
	character.crew.forEach((crew) => {
		let rosterEntry = getDefaults(crew.archetype_id);
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
		let frozenPromises: Promise<void>[] = [];

		character.stored_immortals.forEach((imm) => {
			let rosterEntry = getDefaults(imm.id);
			if (!rosterEntry) {
				console.error(`Could not find the crew avatar for frozen archetype_id ${imm.id}`);
				return;
			}
			rosterEntry.frozen = imm.quantity;
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

	// collects usage_value field for the given skill
	function collect(skillField: string, extField: string, max:number):void {
		let filtered = roster.filter(c => !c.buyback);
		if (extField) {
			filtered = filtered.filter((c: any) => c[skillField][extField] > 0)
				.sort((a: any, b: any) => b[skillField][extField] - a[skillField][extField]);
		}
		else {
			filtered = filtered.filter((c: any) => c[skillField] > 0)
				.sort((a: any, b: any) => b[skillField] - a[skillField]);
		}
		for (let i = 0; i < max && i < filtered.length; ++i) {
			// allow frozen items to be exported but not count towards top-10
			let c = filtered[i];
			if (c.frozen > 0)
				++max;
			let value = c.usage_value;
			if (c.usage_value === undefined) {
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

async function loadFrozen(rosterEntry: CrewData): Promise<void> {
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

export function formatCrewStats(crew: CrewData): string {
	let result = '';
	for (let skillName in CONFIG.SKILLS) {
		let skill = crew.skills[skillName];

		if (skill && skill.core && (skill.core > 0)) {
			result += `${CONFIG.SKILLS_SHORT[skillName]} (${Math.floor(skill.core + (skill.min + skill.max) / 2)}) `;
		}
	}
	return result;
}
