import React from 'react';

import { Button, Image, Item, List, Dropdown } from 'semantic-ui-react';

import STTApi from '../api';
import { CONFIG, formatTimeSeconds } from '../api';
import { CrewAvatar } from '../api/STTApi';

export interface ShuttlesProps {

}

interface ShuttlesState {
	eventImageUrl?: string;
	shuttles?: any[];
}

export const Shuttles = (props:ShuttlesProps) => {
	const [eventImageUrl, setEventImageUrl] = React.useState();
	const [shuttles, setShuttles] = React.useState();
	let shuttlesToRender = shuttles;
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
	} | undefined = undefined;

	if (
		STTApi.playerData.character.events &&
		STTApi.playerData.character.events.length > 0 &&
		STTApi.playerData.character.events[0].content.content_type === 'shuttles' &&
		STTApi.playerData.character.events[0].opened
	) {
		// In a shuttle event
		let event = STTApi.playerData.character.events[0];

		STTApi.imageProvider
			.getImageUrl(event.phases[event.opened_phase].splash_image.file, event.id)
			.then(found => {
				setEventImageUrl(found.url);
			})
			.catch(error => {
				console.warn(error);
			});

		let crew_bonuses = [];
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
	let calcSlots : {[shuttle_id: number] : any } = {};
	slotCalculator();

	// calcCrew(shuttle) {
	// 	const getCrewSkill = (crew, skill) => {
	// 		let val = crew[skill + '_core'];
	// 		if (crew.tired) {
	// 			val *= STTApi.serverConfig.config.conflict.tired_crew_coefficient;
	// 		}

	// 		return val;
	// 	};

	// 	const calcSkill = (slot, crew, boost) => {
	// 		let secondary_skill_percentage = STTApi.serverConfig.config.shuttle_adventures.secondary_skill_percentage;

	// 		let winnerComboVal = 0;
	// 		let totalFromBoost = 0;
	// 		slot.skills.forEach(skill => {
	// 			let andSkills = skill.split(',');

	// 			andSkills.forEach(ors => {
	// 				if (boost && boost.bonuses && boost.bonuses[ors]) {
	// 					totalFromBoost += boost.bonuses[ors].core;
	// 				}
	// 			});

	// 			andSkills = andSkills
	// 				.map(ors => getCrewSkill(crew, ors))
	// 				.sort()
	// 				.reverse();

	// 			let val = 0;
	// 			for (let k = 0; k < andSkills.Length; k++) {
	// 				if (k == 0) {
	// 					val += andSkills[k];
	// 				} else {
	// 					val += andSkills[k] * secondary_skill_percentage;
	// 				}
	// 			}

	// 			val += totalFromBoost;

	// 			winnerComboVal = Math.max(winnerComboVal, val);
	// 		});

	// 		// TODO: what is slot.trait_bonuses? Looks like an empty object; never used

	// 		let bonusMultiplier = 1; // TODO get bonus for crew from current event

	// 		return winnerComboVal * bonusMultiplier;
	// 	};

	// 	let skillSum = 0;
	// 	shuttle.slots.forEach(slot => {
	// 		skillSum += calcSkill(slot, crew, boost);
	// 	});

	// 	let challengeRating = shuttleAdventure.challenge_rating * shuttle.slots.length;
	// 	let sigmoid_steepness = STTApi.serverConfig.config.shuttle_adventures.sigmoid_steepness;
	// 	let sigmoid_midpoint = STTApi.serverConfig.config.shuttle_adventures.sigmoid_midpoint;
	// 	let percent = 1 / (1 + Math.exp(-sigmoid_steepness * (skillSum / challengeRating - sigmoid_midpoint)));

	// 	let actualPercent = percent * 100;
	// }

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
		let crew_bonuses: { [crew_symbol: string]: number; } = {};
		if (
			STTApi.playerData.character.events &&
			STTApi.playerData.character.events.length > 0 &&
			STTApi.playerData.character.events[0].content.content_type === 'shuttles' &&
			STTApi.playerData.character.events[0].opened
		) {
			// In a shuttle event
			let event = STTApi.playerData.character.events[0];
			crew_bonuses = event.content.shuttles![0].crew_bonuses;
		}

		let sortedRoster : any[] = [];
		STTApi.roster.forEach(crew => {
			if (crew.buyback || crew.frozen > 0) {
				return;
			}

			let bonus = 1;
			if (crew_bonuses[crew.symbol]) {
				bonus = crew_bonuses[crew.symbol];
			}

			sortedRoster.push({
				active: !!crew.active_id,
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
			calcSlots[shuttle.id] = [];
			shuttle.slots.forEach((slot:any) => {
				let calcSlot : any = {
					bestCrew: JSON.parse(JSON.stringify(sortedRoster)) // Start with a copy
				};
				if (slot.skills.length === 1) {
					// AND or single
					calcSlot.skills = slot.skills[0].split(',');
					if (calcSlot.skills.length === 1) {
						calcSlot.type = 'SINGLE';
						calcSlot.bestCrew.forEach((c:any) => {
							c.total = c[calcSlot.skills[0]];
						});
					} else {
						calcSlot.type = 'AND';
						calcSlot.bestCrew.forEach((c: any) => {
							let a1 = c[calcSlot.skills[0]];
							let a2 = c[calcSlot.skills[1]];
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
						c.total = Math.max(c[calcSlot.skills[0]], c[calcSlot.skills[1]]);
					});
				}

				let seen = new Set();
				calcSlot.bestCrew = calcSlot.bestCrew.filter((c: any) => c.total > 0 && !c.active).filter((c: any) => (seen.has(c.crew_id) ? false : seen.add(c.crew_id)));
				calcSlot.bestCrew.sort((a: any, b: any) => a.total - b.total);
				calcSlot.bestCrew = calcSlot.bestCrew.reverse();

				calcSlot.bestCrew.forEach((c: any) => {
					c.crew = STTApi.roster.find(cr => cr.id === c.crew_id);
					c.text = `${c.crew.name} (${c.total})`;
					c.value = c.crew.symbol;
					c.image = c.crew.iconUrl;
				});

				calcSlot.selection = calcSlot.bestCrew[0].value;

				// TODO: we could cache the presorted lists since more than one slot will share the same config
				calcSlots[shuttle.id].push(calcSlot);
			});
		});

		//setImmediate(() => _reconcileCalc());
		_reconcileCalc();
	}

	function _chooseSlot(calcSlot:any, value:any) {
		calcSlot.selection = value;

		_reconcileCalc(calcSlot);
	}

	function _reconcileCalc(modified?:any) {
		// A crew can't be part of multiple shuttles

		// TODO: balancing
		let selections = new Set();
		if (modified) {
			selections.add(modified.selection);
		}

		STTApi.playerData.character.shuttle_adventures.forEach(adventure => {
			let shuttle = adventure.shuttles[0];
			// if (shuttle.state != 0) {
			// 	return;
			// }

			calcSlots[shuttle.id].forEach((calcSlot:any) => {
				if (calcSlot === modified) {
					return;
				}

				calcSlot.selection = undefined;
				for (let bc of calcSlot.bestCrew) {
					if (!selections.has(bc.value)) {
						calcSlot.selection = bc.value;
						selections.add(bc.value);
						break;
					}
				}
			});
		});

		let newShuttles = STTApi.playerData.character.shuttle_adventures.map(adventure => adventure.shuttles[0]);

		if (modified)
			setShuttles(newShuttles);
		else
			shuttlesToRender = newShuttles;
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

	function renderShuttle(shuttle:any) {
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
						{calcSlots[shuttle.id].map((calcSlot:any, idx:number) => (
							<div key={idx}>
								<b>{calcSlot.skills.map((s:any) => CONFIG.SKILLS[s]).join(` ${calcSlot.type} `)}</b>
								<Dropdown
									fluid
									selection
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
							calcSlots[shuttle.id].reduce((p:any, c:any) => {
								return p + (c.selection ? c.bestCrew.find((cr:any) => cr.value === c.selection).total : 0);
							}, 0)
						)}{' '}
						%
					</Item.Description>
					<Item.Extra>
						State: {getState(shuttle.state)}
					</Item.Extra>
				</Item.Content>
			</Item>
		);
	}

	function renderEvent() {
		if (!currentEvent) {
			return <span />;
		}

		return (
			<div>
				<h2>Current event: {currentEvent.name}</h2>
				<Image src={eventImageUrl} />
				<p>{currentEvent.description}</p>
				<h3>Crew bonuses:</h3>
				<List horizontal>
					{currentEvent.crew_bonuses.map((cb: any) => (
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

	if (!shuttlesToRender) {
		return <p>Calculating...</p>;
	}

	return (
		<div className='tab-panel' data-is-scrollable='true'>
			<div style={{ padding: '10px' }}>
				{renderEvent()}
				<Item.Group divided>{shuttlesToRender.map((shuttle:any) => renderShuttle(shuttle))}</Item.Group>
			</div>
		</div>
	);
}
