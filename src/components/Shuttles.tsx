import React from 'react';

import { Button, Image, Item, List, Dropdown, Label } from 'semantic-ui-react';

import STTApi from '../api';
import { CONFIG, formatTimeSeconds } from '../api';
import { CrewAvatar, CrewData, PlayerShuttleDTO } from '../api/STTApi';

export interface ShuttlesProps {

}

interface CalcSlot {
	sid: string;
	bestCrew: CrewItem[];
	skills?: string[];
	type?: string;
	selection?: string;
	userSelect?: boolean;
	activeSelect?: boolean;
}

interface CrewItem {
	active_id?: number;
	crew_id: number;
	command_skill: number;
	science_skill: number;
	security_skill: number;
	engineering_skill: number;
	diplomacy_skill: number;
	medicine_skill: number;
	total: number;
	//[key:string] : number;
	crew?: CrewData;
	text?: string;
	value?: string;
	image?: string;
}

export const Shuttles = (props:ShuttlesProps) => {
	if (
		!STTApi.playerData.character.events ||
		STTApi.playerData.character.events.length == 0 ||
		STTApi.playerData.character.events[0].content.content_type !== 'shuttles' ||
		!STTApi.playerData.character.events[0].opened
	) {
		return <span>Not in an active shuttle event</span>;
	}

	const [eventImageUrl, setEventImageUrl] = React.useState();
	let [calcSlots, setCalcSlots] = React.useState({} as { [shuttle_id: number]: CalcSlot[] });
	let shuttlesToRender : PlayerShuttleDTO[] = [];
	let currentEvent: {
		name: string;
		description: string;
		crew_bonuses: {
			avatar: CrewAvatar;
			bonus: number;
			iconUrl: string;
		}[],
		tokens: number[];
		nextVP: number;
	};

	let event = STTApi.playerData.character.events[0];

	STTApi.imageProvider
		.getImageUrl(event.phases[event.opened_phase].splash_image.file, event.id)
		.then(found => {
			setEventImageUrl(found.url);
		})
		.catch(error => {
			console.warn(error);
		});

	let crew_bonuses : {avatar: CrewAvatar; bonus: number; iconUrl: string }[] = [];
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

	let challengeRatings : {[shuttle_id:number] : number} = {};
	slotCalculator();

	if (!shuttlesToRender) {
		return <p>Calculating...</p>;
	}

	shuttlesToRender = STTApi.playerData.character.shuttle_adventures.map(adventure => adventure.shuttles[0]);

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
		let crew_bonuses = event.content.shuttles![0].crew_bonuses;

		let sortedRoster : CrewItem[] = [];
		STTApi.roster.forEach(crew => {
			if (crew.buyback || crew.frozen > 0) {
				return;
			}

			let bonus = 1;
			if (crew_bonuses[crew.symbol]) {
				bonus = crew_bonuses[crew.symbol];
			}

			sortedRoster.push({
				active_id: crew.active_id,
				crew_id: crew.id,
				command_skill: crew.command_skill_core! * bonus,
				science_skill: crew.science_skill_core! * bonus,
				security_skill: crew.security_skill_core! * bonus,
				engineering_skill: crew.engineering_skill_core! * bonus,
				diplomacy_skill: crew.diplomacy_skill_core! * bonus,
				medicine_skill: crew.medicine_skill_core! * bonus,
				total: 0
			});
		});

		STTApi.playerData.character.shuttle_adventures.forEach(adventure => {
			let shuttle = adventure.shuttles[0];
			// if (shuttle.state != 0) {
			// 	return;
			// }
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
						calcSlot.bestCrew.forEach((c:any) => {
							c.total = c[calcSlot.skills![0]];
						});
					} else {
						calcSlot.type = 'AND';
						calcSlot.bestCrew.forEach((c: any) => {
							let a1 = c[calcSlot.skills![0]];
							let a2 = c[calcSlot.skills![1]];
							c.total = Math.floor(
								Math.max(a1, a2) + Math.min(a1, a2) * STTApi.serverConfig!.config.shuttle_adventures.secondary_skill_percentage
							);
						});
					}
				} else {
					// OR
					calcSlot.type = 'OR';
					calcSlot.skills = slot.skills;
					calcSlot.bestCrew.forEach((c: any) => {
						c.total = Math.max(c[calcSlot.skills![0]], c[calcSlot.skills![1]]);
					});
				}

				let seen = new Set();
				let bestCrew = calcSlot.bestCrew.filter(c => shuttle.id === c.active_id);
				if (bestCrew.length == 0) {
					bestCrew = calcSlot.bestCrew
						.filter(c => c.total > 0 && !c.active_id)
						.filter(c => (seen.has(c.crew_id) ? false : seen.add(c.crew_id)));
				}
				bestCrew.sort((a, b) => a.total - b.total);
				calcSlot.bestCrew = bestCrew.reverse();

				calcSlot.bestCrew.forEach((c) => {
					c.crew = STTApi.roster.find(cr => cr.id === c.crew_id);
					c.text = `${c.crew!.name} (${c.total})`;
					c.value = c.crew!.symbol;
					c.image = c.crew!.iconUrl;
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

	function _chooseSlot(calcSlot:CalcSlot, value:any) {
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

	function getState(state:number) {
		switch (state) {
			case 0:
				return 'Opened';
			case 1:
				return 'In progress';
			case 2:
				return 'Complete';
			case 3:
				return 'Expired';
			default:
				return 'UNKNOWN';
		}
	}

	function renderShuttle(shuttle:PlayerShuttleDTO) {
		let faction = STTApi.playerData.character.factions.find(faction => faction.id === shuttle.faction_id);

		return (
			<Item key={shuttle.id}>
				<Item.Image size='small' src={faction!.iconUrl} />

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
									disabled={shuttle.state > 0}
									options={calcSlot.bestCrew}
									onChange={(e, { value }) => _chooseSlot(calcSlot, value)}
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
						{shuttle.state == 0 &&
							calcSlots[shuttle.id].map(cs => cs.userSelect || false).reduce((p, c) => p || c)
						  &&
							<Label as='a' onClick={() => resetSelections(shuttle.id)}>Reset Selections</Label>
						}
					</Item.Description>
					<Item.Extra>
						State: {getState(shuttle.state)}
					</Item.Extra>
				</Item.Content>
			</Item>
		);
	}

	function renderEvent() {
		return (
			<div>
				<h2>Current event: {currentEvent.name}</h2>
				<Image src={eventImageUrl} />
				<p>{currentEvent.description}</p>
				<h3>Crew bonuses:</h3>
				<List horizontal>
					{currentEvent.crew_bonuses.map(cb => (
						<List.Item key={cb.avatar.symbol}>
							<Image avatar src={cb.iconUrl} />
							<List.Content>
								<List.Header>{cb.avatar.name}</List.Header>
								Bonus level {cb.bonus}
							</List.Content>
						</List.Item>
					))}
				</List>
				<h4>Next shuttle VP: {currentEvent.nextVP}</h4>
				<h3>Active shuttles</h3>
			</div>
		);
	}

	return (
		<div className='tab-panel' data-is-scrollable='true'>
			<div style={{ padding: '10px' }}>
				{renderEvent()}
				<Item.Group divided>{shuttlesToRender.map(shuttle => renderShuttle(shuttle))}</Item.Group>
			</div>
		</div>
	);
}
