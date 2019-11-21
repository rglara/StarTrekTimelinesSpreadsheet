import React from 'react';
import { Item, Dropdown, Label } from 'semantic-ui-react';

import STTApi, { CONFIG, formatTimeSeconds, CrewSkills } from '../api';
import { CrewAvatarDTO, CrewData, PlayerShuttleDTO, EventDTO,
	EVENT_TYPES, SkillDTO, BorrowedCrewDTO,
	SHUTTLE_STATE_NAMES, SHUTTLE_STATE_NAME_UNKNOWN, SHUTTLE_STATE_OPENED } from '../api/DTO';

export interface ShuttlesProps {
	onTabSwitch?: (newTab: string) => void;
}

interface CalcSlot {
	sid: string;
	bestCrew: CrewItem[];
	skills?: string[];
	type?: string;
	selection?: number;
	userSelect?: boolean;
	activeSelect?: boolean;
}

interface CrewItem {
	active_id?: number;
	crew: CrewData | BorrowedCrewDTO;
	crew_id: number;
	skills: { [sk: string] : number };
	total: number;

	// These three are needed for the item to appear in a combo
	text?: string;
	content?: any;
	value?: number;
	image?: string;
}

export const Shuttles = (props:ShuttlesProps) => {
	let [calcSlots, setCalcSlots] = React.useState({} as { [shuttle_id: number]: CalcSlot[] });
	let shuttlesToRender : PlayerShuttleDTO[] = [];
	let currentEvent: {
		name: string;
		description: string;
		crew_bonuses: {
			avatar: CrewAvatarDTO;
			bonus: number;
			iconUrl: string;
		}[],
		tokens: number[];
		nextVP: number;
	} | undefined = undefined;

	let event : EventDTO | undefined = undefined;
	if (
		STTApi.playerData.character.events &&
		STTApi.playerData.character.events.length > 0 &&
		STTApi.playerData.character.events[0].content.content_type === EVENT_TYPES.SHUTTLES
	) {
		event = STTApi.playerData.character.events[0];
	}

	let crew_bonuses: { avatar: CrewAvatarDTO; bonus: number; iconUrl: string }[] = [];
	if (event) {
		for (let cb in event.content.shuttles![0].crew_bonuses) {
			let avatar = STTApi.getCrewAvatarBySymbol(cb);
			if (!avatar) {
				continue;
			}

			crew_bonuses.push({
				avatar,
				bonus: event.content.shuttles![0].crew_bonuses[cb],
				iconUrl: STTApi.imageProvider.getCrewCached(avatar, false)
			});
		}

		let eventVP = event.content.shuttles![0].shuttle_mission_rewards.find(r => r.type === 11);
		currentEvent = {
			name: event.name,
			description: event.description,
			crew_bonuses: crew_bonuses,
			tokens: event.content.shuttles!.map(s => s.token),
			nextVP: eventVP ? eventVP.quantity : 0
		};
	}

	let challengeRatings : {[shuttle_id:number] : number} = {};

	shuttlesToRender = STTApi.playerData.character.shuttle_adventures.map(adventure => adventure.shuttles[0]);
	slotCalculator();

	function _shuttleChance(challenge_rating: number, numberofSlots: number, skillSum: number): number {
		return Math.floor(
			100 /
				(1 +
					Math.exp(
						STTApi.serverConfig!.config.shuttle_adventures.sigmoid_steepness *
							(STTApi.serverConfig!.config.shuttle_adventures.sigmoid_midpoint - skillSum / (challenge_rating * numberofSlots))
					))
		);
	}

	function slotCalculator() {

		const sk = (sd?: SkillDTO) => {
			if (!sd) { return 0; }
			return sd.core || 0;
		};
		let sortedRoster : CrewItem[] = [];

		STTApi.roster.forEach(crew => {
			if (crew.buyback || crew.frozen > 0) {
				return;
			}

			let bonus = 1;
			const foundBonus = crew_bonuses.find(cb => cb.avatar.symbol === crew.symbol);
			if (foundBonus) {
				bonus = foundBonus.bonus;
			}

			let skills : {[sk:string]:number} = { };
			for (let sk in CONFIG.SKILLS) {
				skills[sk] = crew.skills[sk].core * bonus;
			}

			sortedRoster.push({
				crew: crew,
				active_id: crew.active_id,
				crew_id: crew.id,
				skills,
				total: 0
			});
		});

		// These don't show up until you have already used them
		let brws = STTApi.playerData.character.crew_borrows;
		if (STTApi.playerData.character.crew_borrows) {
			STTApi.playerData.character.crew_borrows.forEach(crew => {
				let bonus = 1;
				const foundBonus = crew_bonuses.find(cb => cb.avatar.symbol === crew.symbol);
				if (foundBonus) {
					bonus = foundBonus.bonus;
				}

				let skills: { [sk: string]: number } = {};
				for (let sk in CONFIG.SKILLS) {
					// borrowed crew does not have all skills filled like CrewData does
					if (!crew.skills[sk]) {
						skills[sk] = 0;
					}
					else {
						skills[sk] = crew.skills[sk].core * bonus;
					}
				}

				sortedRoster.push({
					crew: crew,
					active_id: crew.active_id,
					crew_id: crew.id,
					skills,
					total: 0
				});
			});
		}

		STTApi.playerData.character.shuttle_adventures.forEach(adventure => {
			let shuttle = adventure.shuttles[0];
			challengeRatings[shuttle.id] = adventure.challenge_rating;

			// TODO: this assumes there are at most 2 skills in each slot
			if (!calcSlots[shuttle.id])
				calcSlots[shuttle.id] = [];
			shuttle.slots.forEach((slot, idx) => {
				let calcSlot : CalcSlot = {
					sid: shuttle.id + "." + idx,
					bestCrew: JSON.parse(JSON.stringify(sortedRoster)) // Start with a copy
				};
				if (calcSlots[shuttle.id].length > idx && calcSlots[shuttle.id][idx].sid === calcSlot.sid) {
					if (calcSlots[shuttle.id][idx].userSelect || calcSlots[shuttle.id][idx].activeSelect)
						return;
				}
				if (slot.skills.length === 1) {
					// AND or single
					calcSlot.skills = slot.skills[0].split(',');
					if (calcSlot.skills.length === 1) {
						calcSlot.type = 'SINGLE';
						calcSlot.bestCrew.forEach((c) => {
							c.total = c.skills[calcSlot.skills![0]];
						});
					} else {
						calcSlot.type = 'AND';
						calcSlot.bestCrew.forEach((c) => {
							let a1 = c.skills[calcSlot.skills![0]];
							let a2 = c.skills[calcSlot.skills![1]];
							c.total = Math.floor(
								Math.max(a1, a2) + Math.min(a1, a2) * STTApi.serverConfig!.config.shuttle_adventures.secondary_skill_percentage
							);
						});
					}
				} else {
					// OR
					calcSlot.type = 'OR';
					calcSlot.skills = slot.skills;
					calcSlot.bestCrew.forEach((c) => {
						c.total = Math.max(c.skills[calcSlot.skills![0]], c.skills[calcSlot.skills![1]]);
					});
				}

				let userSelected : number[] = [];
				shuttlesToRender.map(sh => calcSlots[sh.id]).filter(cs => cs !== undefined)
					.forEach(cslots => {
						let csf = cslots.filter(cslot => cslot.userSelect && cslot.selection);
						csf.forEach(cslot => userSelected.push(cslot.selection!))
					}
				);

				let seen = new Set();
				// First, match active crew that are on an in-progress shuttle
				let bestCrew = calcSlot.bestCrew.filter(c => shuttle.id === c.active_id);
				// If none match, find other candidates that are not active
				if (bestCrew.length == 0) {
					bestCrew = calcSlot.bestCrew
						.filter(c => c.total > 0 && !c.active_id)
						.filter(c => !userSelected.find(us => us === c.crew_id))
						.filter(c => (seen.has(c.crew_id) ? false : seen.add(c.crew_id)));
				}
				bestCrew.sort((a, b) => a.total - b.total);
				calcSlot.bestCrew = bestCrew.reverse();

				calcSlot.bestCrew.forEach((c) => {
					c.text = `${c.crew.name} (${c.total})`;
					c.content = <span>{c.crew.name} <CrewSkills crew={c.crew as CrewData} useIcon={true} addScore={c.total} hideProf={true} /></span>;
					c.value = c.crew_id;
					c.image = (c.crew as any).iconUrl;
				});

				calcSlot.selection = calcSlot.bestCrew[0].value;

				// TODO: we could cache the presorted lists since more than one slot will share the same config
				if (calcSlots[shuttle.id].length > idx) {
					calcSlots[shuttle.id][idx] = calcSlot;
				}
				else {
					calcSlots[shuttle.id].push(calcSlot);
				}
			});
		});

		//setImmediate(() => _reconcileCalc());
		_reconcileCalc();
	}

	function _chooseSlot(calcSlot:CalcSlot, value: number) {
		let cs = { ... calcSlot, selection: value};

		_reconcileCalc(cs);
	}

	function _reconcileCalc(modified?: CalcSlot) {
		// A crew can't be part of multiple shuttles

		// TODO: balancing
		let selections = new Set();
		if (modified) {
			modified.userSelect = true;
			selections.add(modified.selection);
		}

		let newCalcSlots : { [shuttle_id: number]: CalcSlot[]; } = {};

		STTApi.playerData.character.shuttle_adventures.forEach(adventure => {
			let shuttle = adventure.shuttles[0];
			// if (shuttle.state != 0) {
			// 	return;
			// }

			calcSlots[shuttle.id].forEach(calcSlot => {
				if (!newCalcSlots[shuttle.id])
					newCalcSlots[shuttle.id] = [];
				if (modified && calcSlot.sid === modified.sid) {
					newCalcSlots[shuttle.id].push(modified);
					return;
				}

				let newSlot = {...calcSlot};

				if (newSlot.userSelect || newSlot.activeSelect) {
					newCalcSlots[shuttle.id].push(newSlot);
					return;
				}
				newSlot.selection = undefined;
				for (let bc of newSlot.bestCrew) {
					if (!selections.has(bc.value)) {
						newSlot.selection = bc.value;
						selections.add(bc.value);
						break;
					}
				}
				newCalcSlots[shuttle.id].push(newSlot);
			});
		});

		//let newShuttles = STTApi.playerData.character.shuttle_adventures.map(adventure => adventure.shuttles[0]);

		if (modified)
			//setShuttles(newShuttles);
			setCalcSlots(newCalcSlots);
		else
			calcSlots = newCalcSlots;
			//shuttlesToRender = newShuttles;
	}

	function resetSelections(sid: number) {
		let newCalcSlots: { [shuttle_id: number]: CalcSlot[]; } = {...calcSlots};
		newCalcSlots[sid] = [];

		calcSlots[sid].forEach(calcSlot => {
			let newSlot = { ...calcSlot, userSelect:false };
			newCalcSlots[sid].push(newSlot);
		});

		setCalcSlots(newCalcSlots);
	}

	function renderShuttle(shuttle:PlayerShuttleDTO) {
		let faction = STTApi.playerData.character.factions.find(faction => faction.id === shuttle.faction_id);

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
						<p>Expires in {formatTimeSeconds(shuttle.expires_in)}</p>
						{calcSlots[shuttle.id].map((calcSlot, idx) => (
							<div key={idx}>
								<b>{calcSlot.skills!.map(s => CONFIG.SKILLS[s]).join(` ${calcSlot.type} `)}</b>
								<Dropdown
									fluid
									selection
									disabled={shuttle.state !== SHUTTLE_STATE_OPENED}
									options={calcSlot.bestCrew}
									onChange={(e, { value }) => _chooseSlot(calcSlot, value as number)}
									value={calcSlot.selection}
								/>
							</div>
						))}
						Chance:{' '}
						{_shuttleChance(
							challengeRatings[shuttle.id],
							shuttle.slots.length,
							calcSlots[shuttle.id].reduce((p, c) => {
								return p + (c.selection ? c.bestCrew.find((cr) => cr.value === c.selection)!.total : 0);
							}, 0)
						)}{' '}
						%
						{shuttle.state === SHUTTLE_STATE_OPENED &&
							calcSlots[shuttle.id].map(cs => cs.userSelect || false).reduce((p, c) => p || c)
						  &&
							<Label as='a' onClick={() => resetSelections(shuttle.id)}>Reset Selections</Label>
						}
					</Item.Description>
					<Item.Extra>
						State: {SHUTTLE_STATE_NAMES[shuttle.state] || SHUTTLE_STATE_NAME_UNKNOWN }
					</Item.Extra>
				</Item.Content>
			</Item>
		);
	}

	function renderEvent() {
		if (!currentEvent) {
			return <span/>;
		}
		return (
			<div>
				<h2>Current event: {currentEvent.name}</h2>
				{props.onTabSwitch &&
					<span>Click to see bonus crew and other event details: <Label as='a' onClick={() => props.onTabSwitch && props.onTabSwitch('Events')}>Event Details</Label></span>
				}
				<h4>Next shuttle VP: {currentEvent.nextVP}</h4>
			</div>
		);
	}

	return (
		<div className='tab-panel' data-is-scrollable='true'>
			<div style={{ padding: '10px' }}>
				{currentEvent && renderEvent()}
				<h3>Active shuttles</h3>
				<Item.Group divided>{shuttlesToRender.sort((a, b) => a.expires_in - b.expires_in).map(shuttle => renderShuttle(shuttle))}</Item.Group>
			</div>
		</div>
	);
}
