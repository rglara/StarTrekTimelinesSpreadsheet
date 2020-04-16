import React from 'react';
import { Item, Dropdown, Label } from 'semantic-ui-react';

import STTApi, { CONFIG, formatTimeSeconds, CrewSkills } from '../api';
import { CrewData, PlayerShuttleDTO, EventDTO,
	EVENT_TYPES, BorrowedCrewDTO,
	SHUTTLE_STATE_NAMES, SHUTTLE_STATE_NAME_UNKNOWN, SHUTTLE_STATE_OPENED,
	PlayerShuttleAdventureDTO, SHUTTLE_STATE_INPROGRESS } from '../api/DTO';

interface CrewChoice {
	slotIndex: number;
	item?: CrewItem;
	userSelect?: boolean;
}

interface ShuttleSelection {
	calc: ShuttleCalc;
	chosen: CrewChoice[];
}

interface ShuttleCalc {
	challenge_rating: number;
	shuttle: PlayerShuttleDTO;
	chance: (crew: (CrewItem | undefined)[]) => number;
	slots: ShuttleCalcSlot[];
}

interface ShuttleCalcSlot {
	skillText: string;
	slotIndex: number;
	crewValue: (crew: CrewItem) => number;
	bestCrew: CrewItem[];
}

interface CrewItem {
	crew: CrewData | BorrowedCrewDTO;
	skills: { [sk: string] : number };
	total: number;

	// These three are needed for the item to appear in a combo
	text?: string;
	content?: any;
	value?: number;
	image?: string;
}

function cid(c: CrewData | BorrowedCrewDTO) : number {
	if ((c as CrewData).crew_id) {
		return (c as CrewData).crew_id;
	}
	return c.id;
}

export const Shuttles = (props: {
	onTabSwitch?: (newTab: string) => void;
}) => {
	let [userChoices, setUserChoices] = React.useState<{ [shuttle_id: number]: CrewChoice[]}>({});

	let event : EventDTO | undefined = undefined;
	if (
		STTApi.playerData.character.events &&
		STTApi.playerData.character.events.length > 0 &&
		STTApi.playerData.character.events[0].content.content_type === EVENT_TYPES.SHUTTLES
	) {
		event = STTApi.playerData.character.events[0];
	}

	const activeShuttleAdventures = STTApi.playerData.character.shuttle_adventures;
	const bonusedRoster = getBonusedRoster(event?.content.shuttles?.[0].crew_bonuses ?? {});

	const shuttleCalcs: ShuttleCalc[] = buildSlotCalculator(bonusedRoster, event, activeShuttleAdventures);
	const selections: ShuttleSelection[] = selectCrew();

	function _chooseSlot(calc: ShuttleCalc, calcSlot: ShuttleCalcSlot, value: number) {
		let sel = calcSlot.bestCrew.find(c => cid(c.crew) === value);

		let newChoices = {...userChoices};
		let chs = newChoices[calc.shuttle.id] ?? [];
		let chOld = chs.find(c => c.slotIndex === calcSlot.slotIndex);
		if (chOld) {
			chOld.item = sel;
		}
		else {
			chs.push({
				slotIndex: calcSlot.slotIndex,
				item: sel,
				userSelect: true
			});
		}
		newChoices[calc.shuttle.id] = chs;
		setUserChoices(newChoices);
	}

	function resetSelections(calc: ShuttleCalc) {
		let newUserChoices = { ...userChoices };
		newUserChoices[calc.shuttle.id] = [];
		setUserChoices(newUserChoices);
	}

	function selectCrew() : ShuttleSelection[] {
		let sels: ShuttleSelection[] = [];

		let usedCrew: Set<number> = new Set<number>();

		// First, mark active (on shuttles or voyages) and user-selected crew as "used"
		bonusedRoster.filter(c => c.crew.active_id).forEach(ac => usedCrew.add(cid(ac.crew)));
		shuttleCalcs.forEach(calc => {
			let userChosen = userChoices[calc.shuttle.id] ?? [];
			userChosen.forEach(uc => {
				const c = uc.item;
				if (c) {
					let crid = cid(c.crew)
					if (crid) {
						usedCrew.add(crid);
					}
				}
			});
		});

		// Now fill up empty slots
		shuttleCalcs.forEach(calc => {
			let chosen : CrewChoice[] = [];
			let userChosen = userChoices[calc.shuttle.id] ?? [];
			calc.slots.forEach((scs, i) => {
				let userChoice = userChosen.find(uc => uc.slotIndex === i);
				if (userChoice?.item) {
					chosen.push(userChoice);
				}
				else if (calc.shuttle.state !== SHUTTLE_STATE_OPENED) {
					// Ignore used crew and find them in the roster
					let item = bonusedRoster.filter(c => c.crew.active_id === calc.shuttle.id && c.crew.active_index === i).shift();
					chosen.push({
						slotIndex: i,
						item
					});
				}
				else {
					let item : CrewItem | undefined = undefined;

					// Grab the first unused crew by score
					item = scs.bestCrew.filter(c => !usedCrew.has(cid(c.crew))).shift();
					if (item) {
						usedCrew.add(cid(item.crew))
					}

					chosen.push({
						slotIndex: i,
						item
					});
				}
			});

			sels.push({
				calc,
				chosen
			});
		})

		return sels;
	}

	return (
		<div className='tab-panel' data-is-scrollable='true'>
			<div style={{ padding: '10px' }}>
				{event && <div>
					<h2>Current event: {event.name}</h2>
					{props.onTabSwitch &&
						<span>Click to see bonus crew and other event details: <Label as='a' onClick={() =>
							props.onTabSwitch && props.onTabSwitch('Events')}>Event Details</Label>
					</span>}
				</div>}
				<h3>Active shuttles</h3>
				{(!activeShuttleAdventures || activeShuttleAdventures.length == 0) && <div>
					You have no active shuttles. Open some shuttle missions in the game client
				</div>}
				<Item.Group divided>{selections.sort((a, b) => a.calc.shuttle.expires_in - b.calc.shuttle.expires_in).map(sel =>
					<ShuttleItem
						key={sel.calc.shuttle.id}
						selection={sel}
						chooseSlot={_chooseSlot}
						challengeRating={sel.calc.challenge_rating}
						resetSelections={resetSelections} />)}
				</Item.Group>
			</div>
		</div>
	);
}

const ShuttleItem = (props: {
	selection: ShuttleSelection;
	challengeRating: number;
	chooseSlot: (calc: ShuttleCalc, calcSlot: ShuttleCalcSlot, value: number) => void;
	resetSelections: (calc: ShuttleCalc) => void;
}) => {
	const shuttle = props.selection.calc.shuttle;
	let faction = STTApi.playerData.character.factions.find(faction => faction.id === shuttle.faction_id);
	const chosenItems = props.selection.chosen.map(ch => ch.item);

	return (
		<Item key={shuttle.id}>
			<Item.Image size='small' src={faction!.iconUrl} style={{ 'backgroundColor': '#aaa' }} />

			<Item.Content verticalAlign='middle'>
				<Item.Header>
					{shuttle.name} {shuttle.is_rental ? ' (rental)' : ''}
				</Item.Header>
				<Item.Description>
					<p>{shuttle.description}</p>
					<p>Faction: {faction!.name}</p>
					<p>{shuttle.state === SHUTTLE_STATE_INPROGRESS ? 'Completes' : 'Expires'} in {formatTimeSeconds(shuttle.expires_in)}</p>
					{props.selection.calc.slots.map((calcSlot, idx) => {
						let cc = props.selection.chosen[idx]?.item?.crew;
						let currentSel = undefined;
						if (cc) {
							currentSel = cid(cc);
						}
						return <div key={idx}>
							<b>{calcSlot.skillText}</b>
							<Dropdown
								fluid
								selection
								disabled={shuttle.state !== SHUTTLE_STATE_OPENED}
								options={calcSlot.bestCrew}
								onChange={(e, { value }) => props.chooseSlot(props.selection.calc, calcSlot, value as number)}
								value={currentSel}
							/>
						</div>;
					})}
					Chance:{' '}{props.selection.calc.chance(chosenItems)}{' '}%
					{shuttle.state === SHUTTLE_STATE_OPENED &&
						props.selection.chosen.map(cs => cs.userSelect ?? false).reduce((p, c) => p || c, false)
						&&
						<Label as='a' onClick={() => props.resetSelections(props.selection.calc)}>Reset Selections</Label>
					}
				</Item.Description>
				<Item.Extra>
					State: {SHUTTLE_STATE_NAMES[shuttle.state] || SHUTTLE_STATE_NAME_UNKNOWN}
				</Item.Extra>
			</Item.Content>
		</Item>
	);
}

function getBonusedRoster(crew_bonuses: { [crew_symbol: string]: number; }): CrewItem[] {
	let rv: CrewItem[] = [];
	STTApi.roster.forEach(crew => {
		if (crew.buyback || crew.frozen > 0) {
			return;
		}

		const foundBonus = crew_bonuses[crew.symbol] ?? 1;

		let skills: { [sk: string]: number } = {};
		for (let sk in CONFIG.SKILLS) {
			skills[sk] = crew.skills[sk].core * foundBonus;
		}

		rv.push({
			crew: crew,
			skills,
			total: 0
		});
	});

	// These don't show up until you have already used them
	let brws = STTApi.playerData.character.crew_borrows ?? [];
	if (brws.length === 0) {
		// These are synchronized, but don't have "active*" fields
		brws = STTApi.borrowableCrew ?? [];
	}
	if (brws) {
		brws.forEach(crew => {
			const foundBonus = crew_bonuses[crew.symbol] ?? 1;

			let skills: { [sk: string]: number } = {};
			for (let sk in CONFIG.SKILLS) {
				// borrowed crew does not have all skills filled like CrewData does
				if (!crew.skills[sk]) {
					skills[sk] = 0;
				}
				else {
					skills[sk] = crew.skills[sk].core * foundBonus;
				}
			}

			rv.push({
				crew: crew,
				skills,
				total: 0
			});
		});
	}
	return rv;
}

function buildSlotCalculator(bonusedRoster: CrewItem[], event: EventDTO | undefined, activeShuttleAdventures: PlayerShuttleAdventureDTO[]): ShuttleCalc[] {
	let calcs: ShuttleCalc[] = [];

	function shuttleChance(challenge_rating: number, numberofSlots: number, skillSum: number): number {
		return Math.floor(
			100 /
			(1 +
				Math.exp(
					STTApi.serverConfig!.config.shuttle_adventures.sigmoid_steepness *
					(STTApi.serverConfig!.config.shuttle_adventures.sigmoid_midpoint - skillSum / (challenge_rating * numberofSlots))
				))
		);
	}

	activeShuttleAdventures.forEach(adventure => {
		let shuttle = adventure.shuttles[0];

		let slots: ShuttleCalcSlot[] = [];
		let calc: ShuttleCalc = {
			challenge_rating: adventure.challenge_rating,
			shuttle: adventure.shuttles[0],
			chance: (crew: (CrewItem | undefined)[]) => {
				let skillSum = 0;
				for (let i = 0; i < slots.length; ++i) {
					const ci = crew[i];
					if (ci) {
						skillSum += slots[i].crewValue(ci);
					}
				}
				return shuttleChance(adventure.challenge_rating, adventure.shuttles[0].slots.length, skillSum);
			},
			slots
		}
		calcs.push(calc);

		function updateBest(c: ShuttleCalc, cs: ShuttleCalcSlot) {
			// for best crew, doesn't really matter if they don't have the skill, so just include everyone
			cs.bestCrew = bonusedRoster.map(r => { return { ...r, total: cs.crewValue(r) }; }).sort((a, b) => b.total - a.total);
			cs.bestCrew.forEach((c) => {
				c.text = `${c.crew.name} (${c.total})`;
				c.content = <span>{c.crew.name} <CrewSkills crew={c.crew as CrewData} useIcon={true} addScore={c.total} hideProf={true} /></span>;
				c.value = cid(c.crew);
				c.image = (c.crew as any).iconUrl;
			});
		}

		// NOTE: this assumes there are at most 2 skills in each slot
		shuttle.slots.forEach((slot, idx) => {
			if (slot.skills.length === 1) {
				// AND or single
				const sks = slot.skills[0].split(',');
				if (sks.length === 1) {
					const cs = {
						slotIndex: idx,
						skillText: CONFIG.SKILLS[sks[0]],
						crewValue: (crew: CrewItem) => {
							return crew.skills[sks[0]];
						},
						bestCrew: []
					};
					calc.slots.push(cs);
					updateBest(calc, cs);
				} else {
					const cs = {
						slotIndex: idx,
						skillText: CONFIG.SKILLS[sks[0]] + " AND " + CONFIG.SKILLS[sks[1]],
						crewValue: (crew: CrewItem) => {
							let a1 = crew.skills[sks[0]];
							let a2 = crew.skills[sks[1]];
							return Math.floor(
								Math.max(a1, a2) +
								(Math.min(a1, a2) * STTApi.serverConfig!.config.shuttle_adventures.secondary_skill_percentage)
							);
						},
						bestCrew: []
					};
					calc.slots.push(cs);
					updateBest(calc, cs);
				}
			} else {
				const cs = {
					slotIndex: idx,
					skillText: CONFIG.SKILLS[slot.skills[0]] + " OR " + CONFIG.SKILLS[slot.skills[1]],
					crewValue: (crew: CrewItem) => {
						let a1 = crew.skills[slot.skills[0]];
						let a2 = crew.skills[slot.skills[1]];
						return Math.max(a1, a2);
					},
					bestCrew: []
				};

				calc.slots.push(cs);
				updateBest(calc, cs);
			}
		});
	});
	return calcs;
}
