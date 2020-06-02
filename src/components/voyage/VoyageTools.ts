import Moment from 'moment';
import VoyWorker from "worker-loader!./VoyageWorker";
import STTApi, { CONFIG } from '../../api/index';
import { mergeDeep } from '../../api/ObjectMerge';
import { CrewData, VoyageUpdateDTO, VoyageNarrativeDTO, ShipDTO, VoyageExportData, VoyageDescriptionDTO } from '../../api/DTO';
import { CalcChoice, CalcExportData } from './voyageCalc';
import { VoyageWorkerResult } from './VoyageWorker';

/**
 * Worst-case voyage AM decay rate (if all hazards fail)
 * One hazard every 80 seconds, skip every sixth (480s is loot);
 * 30 AM loss per hazard, +3 AM loss for three ticks at 20, 40, 60
 * = -33AM/80s
 * = -.4125 AM/s
 * Non-30 loss every 480s
 * = 30AM/480s = .0625 AM/s
 * Add 1 loss every 480s
 * = 1/480 = .002083
 * = -.4125 + .0625 + .002083 = -.347916 (*60 s/m) = 20.875 AM/m
 */
export const VOYAGE_AM_DECAY_PER_MINUTE = 20.875;

export const SECONDS_PER_TICK: number = 20;
export const TICKS_PER_DILEMMA: number = 360; // sec/min(60) * tick/sec(1/20) * min/hr(60) * hr/dilemma(2) = 360

export async function loadVoyage(voyageId: number, newOnly: boolean = true): Promise<VoyageNarrativeDTO[]> {
	let data = await STTApi.executePostRequest('voyage/refresh', { voyage_status_id: voyageId, new_only: newOnly });
	if (data) {
		let voyageNarrative: VoyageNarrativeDTO[] = [];

		data.forEach((action: any) => {
			if (action.character && action.character.voyage) {
				let voy: VoyageUpdateDTO = action.character.voyage[0];

				// Clear out the dilemma resolutions before load to avoid duplicates
				if (STTApi.playerData.character.voyage[0] && STTApi.playerData.character.voyage[0].dilemma) {
					STTApi.playerData.character.voyage[0].dilemma.resolutions = [];
				}
				STTApi.playerData.character.voyage[0] = mergeDeep(STTApi.playerData.character.voyage[0], voy);
			} else if (action.voyage_narrative) {
				voyageNarrative = action.voyage_narrative;
			}
		});

		STTApi.lastSyncVoyage = Moment();
		return voyageNarrative;
	} else {
		throw new Error('Invalid data for voyage!');
	}
}

export async function recallVoyage(voyageId: number): Promise<void> {
	let data = await STTApi.executePostRequest('voyage/recall', { voyage_status_id: voyageId });
	if (!data) {
		throw new Error('Invalid data for voyage!');
	}
}

export async function completeVoyage(voyageId: number): Promise<void> {
	let data = await STTApi.executePostRequest('voyage/complete', { voyage_status_id: voyageId });
	if (!data) {
		throw new Error('Invalid data for voyage completion!');
	}

	data = await STTApi.executePostRequest('voyage/claim', { voyage_status_id: voyageId });
	if (!data) {
		throw new Error('Invalid data for voyage claim!');
	}
}

export async function reviveVoyage(voyageId: number): Promise<void> {
	let data = await STTApi.executePostRequest('voyage/revive', { voyage_status_id: voyageId });
	if (!data) {
		throw new Error('Invalid data for voyage revive!');
	}
}

export async function resolveDilemma(voyageId: number, dilemmaId: number, index: number): Promise<void> {
	await STTApi.executePostRequestWithUpdates('voyage/resolve_dilemma', {
		voyage_status_id: voyageId,
		dilemma_id: dilemmaId,
		resolution_index: index
	});
}

export async function startVoyage(
	voyageSymbol: string,
	shipId: number,
	shipName: string | undefined,
	selectedCrewIds: Array<number>
): Promise<void> {
	// Start by getting up-to-date crew status
	let currentPlayer = await STTApi.resyncInventory();

	let availableCrew = new Set<number>();
	currentPlayer.player.character.crew.forEach((crew) => {
		if (!crew.active_id) {
			availableCrew.add(crew.id);
		}
	});

	// Validate all selected crew is available and not already active
	selectedCrewIds.forEach(crewid => {
		if (!availableCrew.has(crewid)) {
			let crew = STTApi.roster.find((crew: CrewData) => crew.crew_id === crewid);
			throw new Error(
				`Cannot send '${
					crew ? crew.name : crewid
				}' out on a voyage because they are already active! Please DO NOT use this tool at the same time as the game on any platform. Close all game clients then close and restart the tool to try again!`
			);
		}
	});

	let params: any = {
		voyage_symbol: voyageSymbol,
		ship_id: shipId,
		crew_ids_string: selectedCrewIds.join(',')
	};

	if (shipName !== undefined) {
		params.ship_name = shipName;
	}

	await STTApi.executePostRequestWithUpdates('voyage/start', params);
}

export function bestVoyageShip(): {ship: ShipDTO, score: number }[] {
	let voyage = STTApi.playerData.character.voyage_descriptions[0];

	let consideredShips: { ship: ShipDTO, score: number }[] = [];
	STTApi.ships.forEach((ship) => {
		if (ship.id > 0) {
			let entry = {
				ship: ship,
				score: ship.antimatter
			};

			if (ship.traits.find((trait) => trait == voyage.ship_trait)) {
				entry.score += 150; // TODO: where is this constant coming from (Config)?
			}

			consideredShips.push(entry);
		}
	});

	consideredShips = consideredShips.sort((a, b) => b.score - a.score);

	return consideredShips;
}

// Determines actual voyage duration from the narrative
export function voyDuration(narrative: VoyageNarrativeDTO[]) : number {
	if (!narrative || narrative.length == 0)
		return 0;
	let maxLogIndex: number = narrative[narrative.length - 1].index;
	let dilemmaCount = Math.floor(maxLogIndex / TICKS_PER_DILEMMA);
	let lastDilemmaTick = dilemmaCount * TICKS_PER_DILEMMA;

	let tailTickCount = maxLogIndex - lastDilemmaTick;

	//console.log('max ' + maxLogIndex + " dil count" + dilemmaCount + ' tail ' + tailTickCount);

	if (tailTickCount > 0) {
		let firstAfter: VoyageNarrativeDTO | undefined = narrative.find(entry => entry.index === (lastDilemmaTick + 1));
		if (firstAfter) {
			let tailTime = narrative[narrative.length - 1].event_time - firstAfter.event_time;
			let tailTicks = tailTime / SECONDS_PER_TICK + 1; // add one back because the subtraction was to the "first after"

			let totalTime = (dilemmaCount * TICKS_PER_DILEMMA + tailTicks) * SECONDS_PER_TICK;
			//console.log('tailticks: ' + tailTicks + ' total time: ' + formatTimeSeconds(totalTime, true));
			return totalTime;
		}
	}

	return dilemmaCount * TICKS_PER_DILEMMA * SECONDS_PER_TICK;
}

export function toSkillValues(sels: CalcChoice[], vdesc: VoyageDescriptionDTO) : {[sk:string]:number} {
	let svs : {[sk:string]:number} = {};
	sels.forEach(ch => Object.keys(ch.choice.skills).forEach(sk => {
		if (!svs[sk]) { svs[sk] = 0; }
		svs[sk] += ch.choice.skills[sk].voy;
	}));
	return svs;
}

//TODO: duplicated within the voyage worker; push calls to this to the worker as well
// Estimates voyage duration based on skill value and first failure time
export function estimateVoyageDuration(pri: string, sec: string, svs: {[sk:string]:number}, currVoyTimeMinutes: number, amStart: number, log: boolean) : number {
	const iph = 4; // indexes per hazard
	const currVoyTicks = currVoyTimeMinutes * 60 / 20; // conv to seconds and div by tick rate
	//console.log("   voy ticks: " + currVoyTicks);

	let chance: { [sk: string]: number } = {};
	let ffi : { [sk: string] : number } = {};
	let pass: { [sk: string]: number } = {};
	let passAdd: { [sk: string]: number } = {};
	let fail: { [sk: string]: number } = {};
	let failSubtract: { [sk: string]: number } = {};
	let ffiMax = 0;

	//const hazards = narr.narrative.filter(n => n.encounter_type === 'hazard' && n.skill_check?.skill);
	Object.keys(CONFIG.SKILLS_SHORT).forEach(sk => {
		if (log)
			console.log('Skill:' + sk);
		chance[sk] = .1;
		if (sk === pri) {
			chance[sk] = .35;
		}
		else if (sk === sec) {
			chance[sk] = .25;
		}
		if (log)
			console.log('  select chance: ' + chance[sk]);

		let sv = svs[sk];
		if (log)
			console.log('  value: ' + sv);
		if (!sv) {
			return;
		}

		ffi[sk] = sv * .15;
		if (log)
			console.log('  ffi(base): ' + ffi[sk] + ' @' + (ffi[sk] * 20 / 60 / 60));

		// This block is to estimate voyage time remaining, not from the start of a voyage
		if (currVoyTimeMinutes > 0) {
			ffi[sk] -= currVoyTicks;
			if (log)
				console.log('  ffi(remaining): ' + ffi[sk]);
			if (ffi[sk] < 0) {
				ffi[sk] = 0;
			}
		}
		if (log)
			console.log('  ffi: ' + ffi[sk]);

		pass[sk] = ffi[sk] * chance[sk] / iph;
		if (log)
			console.log('  passes: ' + pass[sk]);

		passAdd[sk] = pass[sk] * (5);
		if (log)
			console.log('  pass AM+: ' + passAdd[sk]);

		if (ffi[sk] > ffiMax) {
			ffiMax = ffi[sk];
		}
		//console.log('Skill:' + sk + ' select chance:' + chance[sk] + ' sv:' + sv + ' ffi:' + ffi[sk]);
	});

	Object.keys(CONFIG.SKILLS_SHORT).forEach(sk => {
		fail[sk] = (ffiMax - ffi[sk]) * chance[sk] / iph;
		failSubtract[sk] = fail[sk] * 30;
		if (log) {
			console.log('Skill:' + sk);
			console.log('  fails: ' + fail[sk]);
			console.log('  fail AM-: ' + failSubtract[sk]);
		}
	});

	let amBalance = amStart;
	if (log)
		console.log('AM: ' + amBalance + ' ffiMax:' + ffiMax);

	// subtract 1 AM per tick
	amBalance -= ffiMax;
	if (log)
		console.log('am minus ticks:' + amBalance);
	Object.keys(CONFIG.SKILLS_SHORT).forEach(sk => {
		amBalance += passAdd[sk];
		amBalance -= failSubtract[sk];
		if (log)
			console.log('am:' + amBalance + ' Skill:' + sk);// + ' pass:' + pass[sk] + ' fail:' + fail[sk]+ ' passAdd:' + passAdd[sk] + ' failSubtract:' + failSubtract[sk]);
	});

	if (log)
		console.log('ffiMax: ' + ffiMax + ' amBalance: ' + amBalance + ' am/21: ' + (amBalance/21));
	let fftMins = ffiMax * 20 / 60;

	if (log)
		console.log('fft(min): ' + fftMins + ' fft(hr): ' + (fftMins / 60));
	let vtMins = fftMins + (amBalance / 21) + currVoyTimeMinutes;

	return vtMins;
}

interface VoyCalcOptions {
	vd: VoyageDescriptionDTO;
	roster: CrewData[];
	shipAM: number;
}

export function calculateVoyage(options: VoyCalcOptions,
	progressCallback: (choices: CalcChoice[], hoursLeft: number) => void,
	doneCallback: (choices: CalcChoice[], hoursLeft: number) => void) : void
{
	const worker = new VoyWorker() as Worker;

	worker.onmessage = (event: MessageEvent) => {
		const r = event.data as VoyageWorkerResult
		//console.log(event);
		doneCallback(r.choices, r.hoursLeft);
	};

	progressCallback([], 0);

	worker.postMessage(options /* as VoyageWorkerMessage */);
}

export function calculateVoyageCrewRank(
	options: VoyCalcOptions,
	done: (rankResult: string, estimateResult: string) => void) : void {
	// rankResult format is: "Score,Alt 1,Alt 2,Alt 3,Alt 4,Alt 5,Status,Crew,Voyages (Pri),Voyages(alt)"
	// estimateResult format is "Primary,Secondary,Estimate,Crew\nDIP, CMD, 8.2, crew1 | crew2 | crew3 | crew4 | crew5 | ... crew12\nCMD, DIP, 8.2, crew1 | ... "

	let result : { p: string, s: string, est: number, c: CalcChoice[] }[] = [];
	let tasks : VoyCalcOptions[] = [];

	Object.keys(CONFIG.SKILLS).forEach(pri => {
		Object.keys(CONFIG.SKILLS).forEach(sec => {
			if (pri === sec) {
				return;
			}

			let opts : VoyCalcOptions = {
				...options,
				vd: {
					...options.vd,
					skills: { primary_skill: pri, secondary_skill: sec },
					crew_slots: options.vd.crew_slots.map(cs => {return {...cs, trait: '_no_trait_'};})
				}
			};
			tasks.push(opts);
		})
	});

	tasks.forEach(opts =>
		calculateVoyage(
			opts,
			(entries: CalcChoice[], score: number) => {
			},
			(entries: CalcChoice[], score: number) => {
				console.log(CONFIG.SKILLS_SHORT[opts.vd.skills.primary_skill] + '-' + CONFIG.SKILLS_SHORT[opts.vd.skills.secondary_skill] + ' ' + score);
				result.push({ p: opts.vd.skills.primary_skill, s: opts.vd.skills.secondary_skill, est: score, c: entries});

				if (result.length === tasks.length) {
					//TODO: properly collect results and provide to the handler
					done('', '');
				}
			}
		)
	);
}
