import STTApi from '../../api/index';
import { mergeDeep } from '../../api/ObjectMerge';
import { CrewData, VoyageUpdateDTO, VoyageNarrativeDTO, ShipDTO } from '../../api/DTO';

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

export async function loadVoyage(voyageId: number, newOnly: boolean = true): Promise<VoyageNarrativeDTO[]> {
	let data = await STTApi.executePostRequest('voyage/refresh', { voyage_status_id: voyageId, new_only: newOnly });
	if (data) {
		let voyageNarrative: VoyageNarrativeDTO[] = [];

		data.forEach((action: any) => {
			if (action.character && action.character.voyage) {
				// TODO: if DB adds support for more than one voyage at a time this hack won't work
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
	let data = await STTApi.executePostRequest('voyage/resolve_dilemma', {
		voyage_status_id: voyageId,
		dilemma_id: dilemmaId,
		resolution_index: index
	});
	if (!data) {
		throw new Error('Invalid data for voyage resolve_dilemma!');
	}
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

	let data = await STTApi.executePostRequest('voyage/start', params);

	if (data) {
		//console.info("Started voyage");

		data.forEach((action: any) => {
			if (action.character && action.character.voyage) {
				STTApi.playerData.character.voyage = action.character.voyage;
			}
		});
	} else {
		throw new Error('Invalid data for voyage start!');
	}
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
