import React from 'react';
import { Image, List, Popup, Label } from 'semantic-ui-react';

import { ItemDisplay } from './ItemDisplay';
import Moment from 'moment';

import STTApi from '../api';
import { CONFIG, getChronitonCount, formatTimeSeconds, loadVoyage } from '../api';
import { loadGauntlet } from '../api/GauntletTools';

import { openDevTools } from '../utils/pal';
import { EVENT_TYPES, CrewData, SHUTTLE_STATE_NAMES, SHUTTLE_STATE_NAME_UNKNOWN, SHUTTLE_STATE_COMPLETE } from '../api/DTO';

const Priority = Object.freeze({
	INFO: 'info circle green',
	CHECK: 'check circle green',
	QUESTION: 'question circle yellow',
	HOURGLASS: 'hourglass half yellow',
	EXCLAMATION: 'exclamation circle yellow',
	EXCLAMATIONRED: 'exclamation circle red'
});

type RecommendationProps = {
	icon: string;
	title: string;
	children?: any;
};

const Recommendation = (props:RecommendationProps) => {
	return (
		<div
			style={{
				display: 'grid',
				gridTemplateColumns: 'minmax(min-content,50px) auto',
				gridTemplateAreas: `'icon description'`,
				marginBottom: '10px'
			}}>
			<div style={{ gridArea: 'icon' }}>
				<i className={'huge icon ' + props.icon || Priority.CHECK} />
			</div>
			<div style={{ gridArea: 'description' }}>
				<h5 style={{ margin: '0' }}>{props.title}</h5>
				<div>{props.children}</div>
			</div>
		</div>
	);
}

type HomePageProps = {
	captainAvatarBodyUrl? : string;
	onLogout : () => void;
	onRefresh : () => void;
	onTabSwitch? : (newTab:string) => void;
}

type Recommendation = {
	icon: string;
	title: string;
	content?: React.ReactNode;
}

export const HomePage = (props: HomePageProps) => {
	const [recVoy, setRecVoy] = React.useState([] as Recommendation[]);
	const [recGauntlet, setRecGauntlet] = React.useState([] as Recommendation[]);

	React.useEffect(() => {
		delayedGauntletRecommendation();
		delayedVoyageRecommendation();
	}, []);

	let recommendations = [...recVoy, ...recGauntlet];

	let replicator_uses_left = STTApi.playerData.replicator_limit - STTApi.playerData.replicator_uses_today;
	if (replicator_uses_left === 0) {
		recommendations.push({
			title: 'No replicator uses left',
			icon: Priority.CHECK,
			content: <p style={{ margin: '0' }}>You used all replicator rations ({STTApi.playerData.replicator_limit}) for today.</p>
		});
	} else {
		recommendations.push({
			title: 'Replicator uses remaining',
			icon: Priority.EXCLAMATION,
			content: (
				<p style={{ margin: '0' }}>
					You have {replicator_uses_left} replicator uses left for today. See the 'Needed Equipment' tab for recommendations on what to
					spend them on.
				</p>
			)
		});
	}

	if (STTApi.starbaseDonationsRemaining > 0) {
		recommendations.push({
			title: 'Fleet Starbase donations remaining',
			icon: Priority.EXCLAMATION,
			content: (
				<p style={{ margin: '0' }}>
					You have {STTApi.starbaseDonationsRemaining} starbase donations left today. Help your fleet get their dailies!
				</p>
			)
		});
	}

	let cadet = STTApi.playerData.character.cadet_schedule.missions.find((m:any) => m.id === STTApi.playerData.character.cadet_schedule.current);
	if (STTApi.playerData.character.cadet_tickets.current === 0) {
		recommendations.push({
			title: 'Cadet tickets used',
			icon: Priority.CHECK,
			content: (
				<p style={{ margin: '0' }}>
					You used all cadet tickets ({STTApi.playerData.character.cadet_tickets.max}) for today's {cadet!.title}.
				</p>
			)
		});
	} else {
		recommendations.push({
			title: 'Cadet tickets remaining',
			icon: Priority.HOURGLASS,
			content: (
				<div>
					<p style={{ margin: '0' }}>
						You have {STTApi.playerData.character.cadet_tickets.current} cadet tickets left for today's {cadet!.title}; it ends in{' '}
						{formatTimeSeconds(STTApi.playerData.character.cadet_schedule.ends_in)}.
					</p>
					<p style={{ margin: '0' }}>See the 'Needed Equipment' tab for recommendations on which missions to run for items you need.</p>
				</div>
			)
		});
	}

	let itemCount = STTApi.playerData.character.items.length;
	if (itemCount > STTApi.playerData.character.item_limit - 5) {
		recommendations.push({
			title: 'You are over the inventory limit and are losing items',
			icon: Priority.EXCLAMATIONRED,
			content: (
				<div>
					<p style={{ margin: '0' }}>
						You have {STTApi.playerData.character.items.length} types of items in your inventory out of a maximum of{' '}
						{STTApi.playerData.character.item_limit}; the game is randomly dismissing items.
					</p>
					<p style={{ margin: '0' }}>
						Get rid of some items by equipping, or throwing them in the replicator. See the 'Needed Equipment' tab for recommendations on
						what equipment you may no longer need.
					</p>
				</div>
			)
		});
	} else if ((itemCount * 100) / STTApi.playerData.character.item_limit > 90) {
		recommendations.push({
			title: 'Approaching inventory limit',
			icon: Priority.QUESTION,
			content: (
				<div>
					<p style={{ margin: '0' }}>
						You have {STTApi.playerData.character.items.length} types of items in your inventory out of a maximum of{' '}
						{STTApi.playerData.character.item_limit}.
					</p>
					<p style={{ margin: '0' }}>
						Consider getting rid of some items by equipping, or throwing them in the replicator. See the 'Needed Equipment' tab for
						recommendations on what equipment you may no longer need.
					</p>
				</div>
			)
		});
	} else {
		recommendations.push({
			title: 'Items in your inventory',
			icon: Priority.INFO,
			content: (
				<p style={{ margin: '0' }}>
					All good. You have {STTApi.playerData.character.items.length} types of items in your inventory out of a maximum of{' '}
					{STTApi.playerData.character.item_limit}.
				</p>
			)
		});
	}

	if (STTApi.playerData.character.shuttle_adventures.length < STTApi.playerData.character.shuttle_bays) {
		recommendations.push({
			title: 'Unused shuttle(s)',
			icon: Priority.QUESTION,
			content: (
				<div>
					<p style={{ margin: '0' }}>
						You have {STTApi.playerData.character.shuttle_bays - STTApi.playerData.character.shuttle_adventures.length} shuttle(s) just
						idling in their bays instead of out bringing goodies.
					</p>
					<p style={{ margin: '0' }}>See the 'Needed Equipment' tab for recommendations on best factions to send your shuttles for.</p>
				</div>
			)
		});
	}

	let shuttles = STTApi.playerData.character.shuttle_adventures.map(sa => sa.shuttles[0]);
	if (shuttles.length > 0) {
		let shuttleReturn = shuttles.filter(sa => sa.state === SHUTTLE_STATE_COMPLETE).length;
		if (shuttleReturn > 0) {
			recommendations.push({
				title: 'Some shuttles are back',
				icon: Priority.EXCLAMATION,
				content: (
					<p style={{ margin: '0' }}>
						Your shuttles (
						{shuttles
							.filter(sa => sa.state === SHUTTLE_STATE_COMPLETE)
							.map(sa => sa.name)
							.join(', ')}
						) have returned. Go into the game to collect your rewards and send them back out!
					</p>
				)
			});
		}

		recommendations.push({
			title: 'Shuttle status',
			icon: Priority.CHECK,
			content: (
				<p style={{ margin: '0' }}>
					{shuttles.sort((a,b) => a.expires_in - b.expires_in)
						.map((sa, index:number) => (
							<span key={sa.id}>
								{sa.name} - {SHUTTLE_STATE_NAMES[sa.state] || SHUTTLE_STATE_NAME_UNKNOWN} ({formatTimeSeconds(sa.expires_in)}
								{' '}at {Moment(STTApi.lastSync).add(sa.expires_in, 's').format('h:mma')})
								{(index === shuttles.length -1) ? '': ', '}
							</span>
						))
					}
				</p>
			)
		});
	}

	let overflowingItems = STTApi.playerData.character.items.filter(item => item.quantity > 32000);
	if (overflowingItems.length > 0) {
		recommendations.push({
			title: 'Overflowing items',
			icon: Priority.EXCLAMATION,
			content: (
				<div>
					<p style={{ margin: '0' }}>
						Some of your items are overflowing; the item quantity is capped at 32768 by the game, and any extras are lost:
					</p>
					<div style={{ display: 'flex' }}>
						{overflowingItems.map((item, idx) => (
							<span style={{ display: 'contents' }} key={idx}>
								<ItemDisplay src={item.iconUrl || ''} size={24} maxRarity={item.rarity} rarity={item.rarity} /> {item.name} ({item.quantity}){' '}
							</span>
						))}
					</div>
				</div>
			)
		});
	}

	if (STTApi.playerData.character.open_packs && STTApi.playerData.character.open_packs.length > 0) {
		// Active behold
		// TODO: help with making choice
	}

	const delayedVoyageRecommendation = () => {
		if (STTApi.playerData.character.voyage.length === 0) {
			let newRecommendation = {
				title: 'No voyage running',
				icon: Priority.EXCLAMATION,
				content: <p style={{ margin: '0' }}>
					Start a voyage in the <Label as='a' onClick={() => props.onTabSwitch && props.onTabSwitch('Voyage')}>Voyage
					</Label> tab to collect rewards.</p>
			};

			setRecVoy([newRecommendation]);
		} else {
			loadVoyage(STTApi.playerData.character.voyage[0].id, true).then(narrative => {
				let newRecommendation = undefined;
				let voyage = STTApi.playerData.character.voyage[0];

				if (voyage.state === 'recalled') {
					if (voyage.recall_time_left! > 0) {
						newRecommendation = {
							title: `Voyage returning`,
							icon: Priority.CHECK,
							content: (
								<p style={{ margin: '0' }}>
									Voyage has lasted for {formatTimeSeconds(voyage.voyage_duration)} and it's currently returning (
									{formatTimeSeconds(voyage.recall_time_left)} at {Moment().add(voyage.recall_time_left, 's').format('h:mma')}).
								</p>
							)
						};
					} else {
						newRecommendation = {
							title: 'Voyage has returned',
							icon: Priority.EXCLAMATION,
							content: <p style={{ margin: '0' }}>The voyage is back. Claim your rewards in the game.</p>
						};
					}
				} else if (voyage.state === 'failed') {
					newRecommendation = {
						title: `Voyage failed`,
						icon: Priority.EXCLAMATIONRED,
						content: (
							<p style={{ margin: '0' }}>
								Voyage has run out of antimatter after {formatTimeSeconds(voyage.voyage_duration)} and it's waiting to be abandoned or
								replenished.
							</p>
						)
					};
				} else if (voyage.seconds_between_dilemmas === voyage.seconds_since_last_dilemma) {
					newRecommendation = {
						title: 'Voyage is waiting on your dilemma decision',
						icon: Priority.EXCLAMATION,
						content: <p style={{ margin: '0' }}>Resolve the dilemma in the <Label as='a' onClick={() => props.onTabSwitch && props.onTabSwitch('Voyage')}>Voyage
							</Label> tab or in the game.</p>
					};
				} else {
					// TODO: check the chances to reach a dilemma and go red if 0%
					newRecommendation ={
						title: `Voyage ongoing`,
						icon: Priority.CHECK,
						content: (
							<p style={{ margin: '0' }}>
								<Label as='a' onClick={() => props.onTabSwitch && props.onTabSwitch('Voyage')}>Voyage</Label> has been
								ongoing for {formatTimeSeconds(voyage.voyage_duration)} (new dilemma in{' '}
								{formatTimeSeconds(voyage.seconds_between_dilemmas - voyage.seconds_since_last_dilemma)}
								{' '}at {Moment().add(voyage.seconds_between_dilemmas - voyage.seconds_since_last_dilemma, 's').format('h:mma')})
							</p>
						)
					};
				}

				if (newRecommendation) {
					setRecVoy([newRecommendation]);
				}
			});
		}
	}

	const delayedGauntletRecommendation = () => {
		loadGauntlet().then(gauntlet => {
			let newRecommendation = undefined;

			if (gauntlet.state === 'NONE') {
				newRecommendation = {
					title: 'Start a gauntlet',
					icon: Priority.EXCLAMATION,
					content: (
						<p style={{ margin: '0' }}>
							You're not currently in a gauntlet; join one in the 'Gauntlet' tab, you're missing out on rewards. Next gauntlet starts in{' '}
							{formatTimeSeconds(gauntlet.seconds_to_join)}.
						</p>
					)
				};
			} else if (gauntlet.state === 'ENDED_WITH_REWARDS') {
				newRecommendation = {
					title: `Gauntlet has ended (your rank is ${gauntlet.rank})`,
					icon: Priority.EXCLAMATION,
					content: <p style={{ margin: '0' }}>The gauntlet has ended; claim your rewards in the game or in the 'Gauntlet' tab.</p>
				};
			} else if (gauntlet.state === 'STARTED') {
				const anyEnabled = gauntlet.contest_data.selected_crew.some(c => !c.disabled);
				newRecommendation = {
					title: 'Gauntlet is active',
					icon: anyEnabled ? Priority.HOURGLASS : Priority.INFO,
					content: (
						<p style={{ margin: '0' }}>
							{
								anyEnabled && `Some crew still available to compete. `
							}
							{
								!anyEnabled && `No crew available to compete. `
							}
							The <Label as='a' onClick={() => props.onTabSwitch && props.onTabSwitch('Gauntlet')}>Gauntlet</Label> ends in {formatTimeSeconds(gauntlet.seconds_to_end)}, next crew refresh in{' '}
							{formatTimeSeconds(gauntlet.seconds_to_next_crew_refresh)}
							{' '}at {Moment().add(gauntlet.seconds_to_next_crew_refresh, 's').format('h:mma')}.
						</p>
					)
				};

				// TODO: check if crew is unused (debuff 0)
			}

			if (newRecommendation) {
				setRecGauntlet([newRecommendation]);
			}
		});
	}

	if (STTApi.playerData.character.events &&
		 STTApi.playerData.character.events.length > 0 &&
		 STTApi.playerData.character.events[0].content) {
		let eventData = STTApi.playerData.character.events[0];

		//TODO: check event start time and change icon
		let hasStarted = eventData.seconds_to_start <= 0;
		let hasEnded = eventData.seconds_to_end <= 0;
		let msg = '';
		if (hasEnded) {
			msg = ' has ended and has rewards to collect in-game';
		} else if (hasStarted) {
			msg = ' has started and ends in ' + formatTimeSeconds(eventData.seconds_to_end);
		} else {
			msg = ' starts in ' + formatTimeSeconds(eventData.seconds_to_start);
		}
		if (eventData.content.content_type === EVENT_TYPES.SHUTTLES) {
			recommendations.push({
				title: `Faction/Shuttle Event ` + msg,
				icon: Priority.INFO,
				content: <div style={{ margin: '0' }}>
					{!hasEnded &&
						<Label as='a' onClick={() => props.onTabSwitch && props.onTabSwitch('Events')}>Event Details</Label>
					}
					</div>
			});
		}
		else if (eventData.content.content_type === EVENT_TYPES.GATHER) {
			recommendations.push({
				title: `Galaxy Event ` + msg,
				icon: Priority.INFO,
				content: <div style={{ margin: '0' }}>
					{!hasEnded  &&
						<Label as='a' onClick={() => props.onTabSwitch && props.onTabSwitch('Events')}>Event Details</Label>
					}
				</div>
			});
		}
		else if (eventData.content.content_type === EVENT_TYPES.SKIRMISH) {
			recommendations.push({
				title: `Skirmish Event ` + msg,
				icon: Priority.INFO,
				content: <div style={{ margin: '0' }}>
					{!hasEnded &&
						<Label as='a' onClick={() => props.onTabSwitch && props.onTabSwitch('Events')}>Event Details</Label>
					}
				</div>
			});
		}
		else{
			recommendations.push({
				title: `Event ` + msg,
				icon: Priority.INFO,
				content: <div style={{ margin: '0' }}>
				</div>
			});
		}
	}

	// const neededEquipment = STTApi.getNeededEquipment(
	// 	{ onlyNeeded: true, onlyFaction: false, cadetable: false, allLevels: false, userText: undefined },
	// 	[]
	// );
	// let factionBuyable = [];
	// for (let equipment of neededEquipment) {
	// 	factionBuyable = factionBuyable.concat(
	// 		equipment.factionSources.map(
	// 			entry =>
	// 				`${equipment.equipment.name} for ${entry.cost_amount} ${CONFIG.CURRENCIES[entry.cost_currency].name} in the ${
	// 					entry.faction.name
	// 				} shop`
	// 		)
	// 	);
	// }
	// if (factionBuyable.length > 0) {
	// 	recommendations.push({
	// 		title: 'Needed equipment in the faction shops',
	// 		icon: Priority.INFO,
	// 		content: (
	// 			<p style={{ margin: '0' }}>
	// 				You can find some needed equipment in the faction shops: <b>{factionBuyable.join(', ')}</b>. Check them out in the 'Factions'
	// 				tab.
	// 			</p>
	// 		)
	// 	});
	// }

	if (!STTApi.loggedIn) {
		return <span />;
	}

	let order = [Priority.INFO, Priority.CHECK, Priority.QUESTION, Priority.HOURGLASS, Priority.EXCLAMATION, Priority.EXCLAMATIONRED];
	order.reverse();
	let sorted = recommendations.sort((a, b) => {
		return order.indexOf(a.icon) - order.indexOf(b.icon);
	});

	return (
		<div>
			<div className='ui right aligned inverted segment'>
				<div className='ui black large image label'>
					<img src={CONFIG.SPRITES['energy_icon'].url} className='ui' />
					{getChronitonCount()}
				</div>

				<div className='ui black large image label'>
					<img src={CONFIG.SPRITES['images_currency_pp_currency_0'].url} className='ui' />
					{STTApi.playerData.premium_purchasable}
				</div>

				<div className='ui black large image label'>
					<img src={CONFIG.SPRITES['images_currency_pe_currency_0'].url} className='ui' />
					{STTApi.playerData.premium_earnable}
				</div>

				<div className='ui black large image label'>
					<img src={CONFIG.SPRITES['images_currency_honor_currency_0'].url} className='ui' />
					{STTApi.playerData.honor}
				</div>

				<div className='ui black large image label'>
					<img src={CONFIG.SPRITES['images_currency_sc_currency_0'].url} className='ui' />
					{STTApi.playerData.money}
				</div>

				{ STTApi.playerData.character.stimpack &&
					<div className='ui black large image label'>
						Supply Kit Active (expires in {formatTimeSeconds(STTApi.playerData.character.stimpack.ends_in)})
					</div>
				}

				<button className='ui primary button' onClick={() => props.onLogout()}>
					<i className='icon sign out' />
					Logout
				</button>
				<button className='ui primary button' onClick={() => props.onRefresh()}>
					<i className='icon refresh' />
					Refresh
				</button>
				<button className='ui icon button' onClick={() => openDevTools()}>
					<i className='icon bug' />
				</button>
			</div>

			<div style={{ display: 'grid', gridTemplateColumns: 'min-content auto', gridTemplateAreas: `'image description'` }}>
				<div style={{ gridArea: 'image' }}>
					<img src={props.captainAvatarBodyUrl} height='320px' />
				</div>
				<div style={{ gridArea: 'description' }}>
					<h3>Welcome, {STTApi.playerData.character.display_name}!</h3>
					<p>DBID {STTApi.playerData.dbid}</p>
					<p>
						Location{' '}
						{
							STTApi.playerData.character.navmap.places.find((place:any) => place.symbol === STTApi.playerData.character.location.place)!
								.display_name
						}
					</p>

					{STTApi.fleetData && <h4>Note from your fleet ({STTApi.fleetData.name}) admiral</h4>}
					{STTApi.fleetData && <p>{STTApi.fleetData.motd}</p>}

					{STTApi.playerData.motd && STTApi.playerData.motd.title && <h4>Note from DisruptorBeam: {STTApi.playerData.motd.title}</h4>}
					{STTApi.playerData.motd && STTApi.playerData.motd.text && (
						<p
							style={{ fontSize: '0.9em' }}
							dangerouslySetInnerHTML={{ __html: STTApi.playerData.motd.text.trim().replace(/(?:\r\n|\r|\n)/g, '<br />') }}
						/>
					)}
				</div>
			</div>

			<div>
				{sorted.map((r, idx) => (
					<Recommendation key={idx} title={r.title} icon={r.icon}>
						{r.content}
					</Recommendation>
				))}
			</div>
		</div>
	);
}
