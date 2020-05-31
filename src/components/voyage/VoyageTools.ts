import Moment from 'moment';
import STTApi, { CONFIG } from '../../api/index';
import { mergeDeep } from '../../api/ObjectMerge';
import { CrewData, VoyageUpdateDTO, VoyageNarrativeDTO, ShipDTO, VoyageExportData, VoyageDescriptionDTO } from '../../api/DTO';
import { CalcChoice, CalcExportData } from './voyageCalc';

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
	sels.forEach((ch, sid) => {
		Object.keys(ch.choice.skills).forEach(sk => {
			if (!svs[sk]) { svs[sk] = 0; }
			svs[sk] += ch.choice.skills[sk].voy;
		});
		const t = vdesc.crew_slots[sid].trait;
		// if (ch.choice.rawTraits.includes(t)) {
		// 	am += ANTIMATTER_FOR_SKILL_MATCH;
		// }
	});
	return svs;
}

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

const LOG_CALCULATE = false;
const ANTIMATTER_FOR_SKILL_MATCH = 25;

// Compute "best" crew for the voyage
// Uses a basic simulated annealing metaheuristic approach:
//   select first unused for each slot (decent good selection)
//   permutate slightly
//   keep better result; keep worse result if it passes a threshhold (to jump to another local maximum)
export function calculateVoyage(options: {
	vd: VoyageDescriptionDTO;
	roster: CrewData[];
	shipAM: number;
},
	progressCallback: (choices: CalcChoice[], hoursLeft: number) => void,
	doneCallback: (choices: CalcChoice[], hoursLeft: number) => void) : void
{
	const bestCrew : CrewData[][] = [];
	options.vd.crew_slots.forEach((slot, sid) => {
		let best = bestCrew[sid];
		if (!best) {
			best = [];
			bestCrew[sid] = best;
		}
		options.roster.forEach(c => {
			let vs = c.skills[slot.skill].voy;
			if (vs > 0) {
				best.push(c);
			}
		});
		// Sort by total voy skill (desc)
		best.sort((a,b) => b.voyage_score - a.voyage_score);
	});

	// Initial configuration
	let current = selectRandom(undefined);
	let next: CalcChoice[] = [];
	let iteration = 0;
	let alpha = 0.999;
	let temperature = 400.0;
	let epsilon = 0.001;
	let currentNrg = nrgToMax(current);
	// Not necessary, but keeps from blowing up indefinitely if the math goes wrong
	const maxIter = 100000;

	//console.log("Initial energy: " + currentNrg);
	progressCallback(current, currentNrg / 60);

	//while the temperature did not reach epsilon
	while (temperature > epsilon && iteration < maxIter) {
		iteration++;
		// report every 400 iterations
		if (iteration % 400 == 0) {
			// console.log(currentNrg);
			progressCallback(current, currentNrg / 60);
		}

		next = selectRandom(current);
		let nextNrg = nrgToMax(next);
		if (nextNrg == currentNrg) {
			continue;
		}
		if (nextNrg > currentNrg) {
			if (LOG_CALCULATE) {
				console.log("Better energy: " + nextNrg + " > " + currentNrg);
			}
			current = next;
			currentNrg = nextNrg;
		}
		else {
			const proba = Math.random();
			//if the new nrg is worse accept
			//it but with a probability level
			//if the probability is less than
			//E to the power -delta/temperature.
			//otherwise the old value is kept
			const delta = nextNrg - currentNrg;
			const threshold = Math.exp(delta / temperature);
			if (proba < threshold) {
				if (LOG_CALCULATE) {
					console.log("Override better energy: " + nextNrg + " < " + currentNrg + " @ " + proba + " " + threshold);
				}
				current = next;
				currentNrg = nextNrg;
			}
		}
		//cooling process on every iteration
		temperature *= alpha;
	}

	//if (LOG_CALCULATE) {
	console.log("Best energy: " + currentNrg + " iters:" + iteration);
	//}
	doneCallback(current, currentNrg / 60);
	//return current;

	// Energy function for annealing.
	// Voyage estimated running time (in hours)
	function nrgToMax(sels: CalcChoice[]): number {
		const vd = options.vd;
		let am = options.shipAM;
		const svs = toSkillValues(sels, vd);
		sels.forEach((ch, sid) => {
			const t = vd.crew_slots[sid].trait;
			if (ch.choice.rawTraits.includes(t)) {
				am += ANTIMATTER_FOR_SKILL_MATCH;
			}
		});
		const dur = estimateVoyageDuration(vd.skills.primary_skill, vd.skills.secondary_skill, svs, 0, am, false);
		return dur;
	}

	function selectRandom(selsCurrent?: CalcChoice[]): CalcChoice[] {
		let sels: CalcChoice[] = [];
		let usedCrew: Set<number> = new Set<number>();

		//TODO: allow user override of crew-slot choices here
		// options.userChoices.forEach(ch => {
		// 	let userChosen = userChoices.find(uc => uc.calc.shuttle.id === calc.shuttle.id)?.chosen ?? [];
		// 	userChosen.forEach(uc => {
		// 		const c = uc.item;
		// 		if (c) {
		// 			let crid = cid(c.crew)
		// 			if (crid) {
		// 				usedCrew.add(crid);
		// 			}
		// 		}
		// 	});
		// });

		// function shuffle(array: any[]) {
		// 	for (let i = array.length - 1; i > 0; i--) {
		// 		const j = Math.floor(Math.random() * (i + 1));
		// 		[array[i], array[j]] = [array[j], array[i]];
		// 	}
		// }
		// let calcs = shuttleCalcs.slice();
		// shuffle(calcs);

		options.vd.crew_slots.forEach((cs, sid) => {
			let choice : CrewData | undefined = undefined;
			//TODO: allow user override of crew-slot choice
			// const userSel = userChoices.find(uc => uc.calc.shuttle.id === calc.shuttle.id);
			// let userChosen = userSel?.chosen ?? [];
			// let userChoice = userChosen.find(uc => uc.slotIndex === si);
			// if (userChoice?.item) {
			// 	choice = userChoice.item;
			// }
			// else
			{
				if (selsCurrent) {
					const bestOpts = bestCrew[sid].filter(c => !usedCrew.has(c.crew_id));
					// Weight the random selection toward the front of the list
					for (let i = 0; i < bestOpts.length; ++i) {
						const r = Math.random();
						// Select if the random value is below the curve in the higher probability range
						const gap = .5; // 50% chance of select starting with first index - others may be better due to total voy still or trait match
						const pass = r < gap;
						if (pass) {
							choice = bestOpts[i];
							break;
						}
						//console.log("skipped option " + i + " " + r + " " + ci + "," + si)
					}
					//console.log("selecting random option " + ci + "," + si)
					// Grab random selection of crew
				}
			}

			// could not find a best select or need to initialize, pull first best option
			if (!choice) {
				choice = bestCrew[sid].filter(c => !usedCrew.has(c.crew_id)).shift();

				if (!choice) {
					// look anywhere for a choice
					choice = options.roster.filter(c => !usedCrew.has(c.crew_id)).shift();
				}

				if (!choice) {
					//TODO: ensure at least 12 crew are provided to calculation
					// failed to find anyone
					throw new Error('Failed finding enough crew in supplied roster');
				}
			}

			usedCrew.add(choice.crew_id);

			let chosen: CalcChoice = {
				slotId: sid,
				choice: choice
			};

			sels.push(chosen);
		});

		return sels;
	}
}

export function calculateVoyageCrewRank(
	options: {
		vd: VoyageDescriptionDTO;
		roster: CrewData[];
		shipAM: number;
	},
	result: (rankResult: string, estimateResult: string) => void) : void {
	// rankResult format is: "Score,Alt 1,Alt 2,Alt 3,Alt 4,Alt 5,Status,Crew,Voyages (Pri),Voyages(alt)"
	// estimateResult format is "Primary,Secondary,Estimate,Crew\nDIP, CMD, 8.2, crew1 | crew2 | crew3 | crew4 | crew5 | ... crew12\nCMD, DIP, 8.2, crew1 | ... "

	Object.keys(CONFIG.SKILLS).forEach(pri => {
		Object.keys(CONFIG.SKILLS).forEach(sec => {
			if (pri === sec) {
				return;
			}

			let opts = {
				...options,
				vd: {
					...options.vd,
					skills: { primary_skill: pri, secondary_skill: sec },
					crew_slots: options.vd.crew_slots.map(cs => {return {...cs, trait: '_no_trait_'};})
				}
			};

			calculateVoyage(
				opts,
				(entries: CalcChoice[], score: number) => {
					// setCalcState({
					// 	crewSelection: entries,
					// 	estimatedDuration: score,
					// 	state: 'inprogress'
					// });
				},
				(entries: CalcChoice[], score: number) => {
					// setCalcState({
					// 	crewSelection: entries,
					// 	estimatedDuration: score,
					// 	state: 'done'
					// });
					//TODO: collect results and provide to the handler
					console.log(CONFIG.SKILLS_SHORT[pri] + '-' + CONFIG.SKILLS_SHORT[sec] + ' ' + score);
					result('', '');
				}
			);
		})
	});
}
