import React from 'react';

import { Message, Dropdown, Button, Header, Select, Checkbox, Form, List, Image, Icon, Card, Popup } from 'semantic-ui-react';

import STTApi from '../api';
import {
	CONFIG,
	bestVoyageShip,
	loadVoyage,
	startVoyage,
	resolveDilemma,
	recallVoyage,
	formatCrewStats,
	bonusCrewForCurrentEvent,
	formatTimeSeconds
} from '../api';
import { CollapsibleSection } from './CollapsibleSection';
import { RarityStars } from './RarityStars';
import ReactTable from 'react-table';
import Moment from 'moment';

import { download } from '../utils/pal';
import { calculateVoyage, estimateVoyageRemaining, exportVoyageData } from '../utils/voyageCalc';

export class VoyageCrew extends React.Component {
	constructor(props) {
		super(props);

		let peopleList = [];
		STTApi.roster.forEach(crew => {
			peopleList.push({
				key: crew.crew_id || crew.id,
				value: crew.crew_id || crew.id,
				image: { avatar: true, src: crew.iconUrl },
				text: crew.name
			});
		});
		peopleList.sort((a,b) => (a.text < b.text) ? -1 : ((a.text > b.text) ? 1 : 0));

		let bestVoyageShips = bestVoyageShip();
		this.state = {
			bestShips: bestVoyageShips,
			selectedShip: bestVoyageShips[0].ship.id,
			includeFrozen: false,
			includeActive: false,
			shipName: undefined,
			state: undefined,
			searchDepth: 6,
			extendsTarget: 0,
			activeEvent: undefined,
			peopleList,
			currentSelectedItems: [],
			error: undefined,
			generatingVoyCrewRank: false
		};

		// See which crew is needed in the event to give the user a chance to remove them from consideration
		let result = bonusCrewForCurrentEvent();
		if (result) {
			this.state.activeEvent = result.eventName;
			this.state.currentSelectedItems = result.crewIds;
		}

		this._calcVoyageData = this._calcVoyageData.bind(this);
		this._startVoyage = this._startVoyage.bind(this);
	}

	getIndexBySlotName(slotName) {
		const crewSlots = STTApi.playerData.character.voyage_descriptions[0].crew_slots;
		for (let slotIndex = 0; slotIndex < crewSlots.length; slotIndex++) {
			if (crewSlots[slotIndex].name === slotName) {
				return slotIndex;
			}
		}
	}

	renderBestCrew() {
		if (this.state.state === 'inprogress' || this.state.state === 'done') {
			let crewSpans = [];
			this.state.crewSelection.forEach(entry => {
				if (entry.choice) {
					let status = entry.choice.frozen > 0 ? 'frozen' : entry.choice.active_id > 0 ? 'active' : 'available';
					let statusColor = status === 'frozen' ? 'red' : status === 'active' ? 'yellow' : 'green';
					let crew = (
						<Card key={entry.choice.crew_id || entry.choice.id} color={statusColor}>
							<Card.Content>
								<Image floated='right' size='mini' src={entry.choice.iconUrl} />
								<Card.Header>{entry.choice.name}</Card.Header>
								<Card.Meta>{STTApi.playerData.character.voyage_descriptions[0].crew_slots[entry.slotId].name}</Card.Meta>
								<Card.Description>{formatCrewStats(entry.choice)}</Card.Description>
							</Card.Content>
							<Card.Content extra>Status: {status}</Card.Content>
						</Card>
					);

					crewSpans[entry.slotId] = crew;
				} else {
					console.error(entry);
				}
			});

			return (
				<div>
					<br />
					{this.state.state === 'inprogress' && <div className='ui medium centered text active inline loader'>Still calculating...</div>}
					<Card.Group>{crewSpans}</Card.Group>
				</div>
			);
		} else {
			return <span />;
		}
	}

	render() {
		let shipSpans = [];
		for (let entry of this.state.bestShips) {
			shipSpans.push({
				key: entry.ship.id,
				text: entry.ship.name,
				value: entry.ship.id,
				content: (
					<Header
						icon={<img src={entry.ship.iconUrl} height={48} style={{ display: 'inline-block' }} />}
						content={entry.ship.name}
						subheader={`${entry.score.toFixed(0)} antimatter`}
					/>
				)
			});
		}

		let curVoy = '';
		if (STTApi.playerData.character.voyage_descriptions && STTApi.playerData.character.voyage_descriptions.length > 0) {
			curVoy = `${CONFIG.SKILLS[STTApi.playerData.character.voyage_descriptions[0].skills.primary_skill]} primary / ${
				CONFIG.SKILLS[STTApi.playerData.character.voyage_descriptions[0].skills.secondary_skill]
			} secondary`;
		}
		if (STTApi.playerData.character.voyage && STTApi.playerData.character.voyage.length > 0) {
			curVoy = `${CONFIG.SKILLS[STTApi.playerData.character.voyage[0].skills.primary_skill]} primary / ${
				CONFIG.SKILLS[STTApi.playerData.character.voyage[0].skills.secondary_skill]
			} secondary`;
		}

		return (
			<div style={{ margin: '5px' }}>
				<Message attached>
					Configure the settings below, then click on the "Calculate" button to see the recommendations. Current voyage is <b>{curVoy}</b>.
				</Message>
				<Form className='attached fluid segment' loading={this.state.generatingVoyCrewRank || this.state.state === 'inprogress'}>
					<Form.Group inline>
						<Form.Field
							control={Select}
							label='Search depth'
							options={[
								{ key: '4', text: '4 (fastest)', value: 4 },
								{ key: '5', text: '5 (faster)', value: 5 },
								{ key: '6', text: '6 (normal)', value: 6 },
								{ key: '7', text: '7 (slower)', value: 7 },
								{ key: '8', text: '8 (slowest)', value: 8 },
								{ key: '9', text: '9 (for supercomputers)', value: 9 }
							]}
							value={this.state.searchDepth}
							onChange={(e, { value }) => this.setState({ searchDepth: value })}
							placeholder='Search depth'
						/>
						<Form.Field
							control={Select}
							label='Extends (target)'
							options={[
								{ key: '0', text: 'none (default)', value: 0 },
								{ key: '1', text: 'one', value: 1 },
								{ key: '2', text: 'two', value: 2 }
							]}
							value={this.state.extendsTarget}
							onChange={(e, { value }) => this.setState({ extendsTarget: value })}
							placeholder='How many times you plan to revive'
						/>
					</Form.Group>

					<Form.Group inline>
						<Form.Field>
							<label>Choose a ship</label>
							<Dropdown
								className='ship-dropdown'
								selection
								options={shipSpans}
								placeholder='Choose a ship for your voyage'
								value={this.state.selectedShip}
								onChange={(ev, { value }) => this.setState({ selectedShip: value })}
							/>
						</Form.Field>

						<Form.Input
							label='Ship name'
							value={this.state.shipName}
							placeholder={this.state.bestShips.find(s => s.ship.id == this.state.selectedShip).ship.name}
							onChange={(ev, { value }) => this.setState({ shipName: value })}
						/>
					</Form.Group>

					<Form.Group>
						<Form.Field
							control={Dropdown}
							clearable
							fluid
							multiple
							search
							selection
							options={this.state.peopleList}
							placeholder='Select or search for crew'
							label={
								"Crew you don't want to consider for voyage" +
								(this.state.activeEvent ? ` (preselected crew which gives bonus in the event ${this.state.activeEvent})` : '')
							}
							value={this.state.currentSelectedItems}
							onChange={(e, { value }) => this.setState({ currentSelectedItems: value })}
						/>
					</Form.Group>

					<Form.Group inline>
						<Form.Field
							control={Checkbox}
							label='Include active (on shuttles) crew'
							checked={this.state.includeActive}
							onChange={(e, { checked }) => this.setState({ includeActive: checked })}
						/>

						<Form.Field
							control={Checkbox}
							label='Include frozen (vaulted) crew'
							checked={this.state.includeFrozen}
							onChange={(e, { checked }) => this.setState({ includeFrozen: checked })}
						/>
					</Form.Group>

					{(this.state.state === 'inprogress' || this.state.state === 'done') && (
						<h3>
							Estimated duration: <b>{formatTimeSeconds(this.state.estimatedDuration * 60 * 60)}</b>
						</h3>
					)}

					<Form.Group>
						<Form.Button primary onClick={this._calcVoyageData} disabled={this.state.state === 'inprogress'}>
							Calculate best crew selection
						</Form.Button>
						<Form.Button secondary onClick={this._startVoyage} disabled={this.state.state !== 'done'}>
							Start voyage with recommendations
						</Form.Button>

						{/* #!if ENV === 'electron' */}
						<Form.Button onClick={() => this._generateVoyCrewRank()} disabled={this.state.state === 'inprogress'}>
							Export CSV with crew Voyage ranking...
						</Form.Button>
						{/* #!endif */}
					</Form.Group>
				</Form>
				<Message attached='bottom' error hidden={!this.state.error}>
					Error: {this.state.error}
				</Message>

				{this.renderBestCrew()}
			</div>
		);
	}

	_startVoyage() {
		let selectedCrewIds = [];
		for (let i = 0; i < STTApi.playerData.character.voyage_descriptions[0].crew_slots.length; i++) {
			let entry = this.state.crewSelection.find(entry => entry.slotId === i);

			if (!entry.choice.crew_id || entry.choice.active_id > 0) {
				this.setState({ error: `Cannot start voyage with frozen or active crew '${entry.choice.name}'` });
				return;
			}

			selectedCrewIds.push(entry.choice.crew_id);
		}

		startVoyage(
			STTApi.playerData.character.voyage_descriptions[0].symbol,
			this.state.bestShips.find(s => s.ship.id == this.state.selectedShip).ship.id,
			this.state.shipName,
			selectedCrewIds
		)
			.then(() => {
				this.props.onRefreshNeeded();

				let voyage = STTApi.playerData.character.voyage[0];
				if (voyage && voyage.id) {
					// this.state.estimatedDuration
					// Save it somewhere
				}
			})
			.catch(err => {
				this.setState({ error: err.message });
			});
	}

	_packVoyageOptions() {
		let filteredRoster = STTApi.roster.filter(crew => {
			// Filter out buy-back crew
			if (crew.buyback) {
				return false;
			}

			if (!this.state.includeActive && crew.active_id > 0) {
				return false;
			}

			if (!this.state.includeFrozen && crew.frozen > 0) {
				return false;
			}

			// TODO: ignore crew crashes
			// TODO: fix wasm

			// Filter out crew the user has chosen not to include
			if (
				this.state.currentSelectedItems.length > 0 &&
				this.state.currentSelectedItems.some(ignored => ignored === (crew.crew_id || crew.id))
			) {
				return false;
			}

			return true;
		});

		return {
			searchDepth: this.state.searchDepth,
			extendsTarget: this.state.extendsTarget,
			shipAM: this.state.bestShips.find(s => s.ship.id == this.state.selectedShip).score,
			skillPrimaryMultiplier: 3.5,
			skillSecondaryMultiplier: 2.5,
			skillMatchingMultiplier: 1.1,
			traitScoreBoost: 200,
			voyage_description: STTApi.playerData.character.voyage_descriptions[0],
			roster: filteredRoster
		};
	}

	_calcVoyageData() {
		let options = this._packVoyageOptions();

		calculateVoyage(
			options,
			(entries, score) => {
				this.setState({
					crewSelection: entries,
					estimatedDuration: score,
					state: 'inprogress'
				});
			},
			(entries, score) => {
				this.setState({
					crewSelection: entries,
					estimatedDuration: score,
					state: 'done'
				});
			}
		);
	}

	// #!if ENV === 'electron'
	_generateVoyCrewRank() {
		function nthIndex(str, pat, n) {
			let L = str.length, i = -1;
			while (n-- && i++ < L) {
				i = str.indexOf(pat, i);
				if (i < 0) break;
			}
			return i;
		}

		this.setState({ generatingVoyCrewRank: true });

		let dataToExport = exportVoyageData(this._packVoyageOptions());

		const NativeExtension = require('electron').remote.require('stt-native');
		NativeExtension.calculateVoyageCrewRank(
			JSON.stringify(dataToExport),
			(rankResult, estimateResult) => {
				// estimateResult is of the form "Primary,Secondary,Estimate,Crew\nDIP, CMD, 8.2, crew1 | crew2 | crew3 | crew4 | crew5 | ... crew12\nCMD, DIP, 8.2, crew1 | ... "
				// crew names may have spaces and commas
				let lines = estimateResult.split('\n');
				let estimateResultSplit = "";
				lines.forEach((line,index) => {
					// skip column headers line
					if (index <= 0) {
						estimateResultSplit += line + '\n';
						return;
					}
					if (line.trim().length <= 0) {
						return;
					}
					let posEst = nthIndex(line, ',', 2);
					let posNames = nthIndex(line, ',', 3);
					let est = line.substring(posEst+1, posNames);
					if (est.indexOf('.') >= 0) {
						let whole = est.substring(0, est.indexOf('.'));
						let part = est.substring(whole.length); // include decimal
						if (part.length > 0) {
							part = 60 * Number(part);
							if (part < 10)
								part = '0' + part;
						}
						else {
							part = '00';
						}
						est = whole + ':' + part;
					}
					else {
						est = est + ':00';
					}
					let crewline = line.substring(posNames+1);
					let crewlist = crewline.split('|');

					crewlist = crewlist.map(s => s.trim());// don't sort so you can see position assignments //.sort();

					estimateResultSplit += line.substring(0, posEst) + ',' + est + ', "' + crewlist.join(' | ') + '"\n'; // join back with pipe to make easier equations
				});

				this.setState({ generatingVoyCrewRank: false });

				// Now also update rankResult to add crew usage value column
				// Format is: "Score,Alt 1,Alt 2,Alt 3,Alt 4,Alt 5,Status,Crew,Voyages (Pri),Voyages(alt)"
				let linesCrew = rankResult.split('\n');
				let rankResultSplit = "";
				let includedCrew = {};
				linesCrew.forEach((line, index) => {
					let posName = nthIndex(line, ',', 7);
					let partA = line.substring(0, posName);
					let partB = line.substring(posName);
					// If first line of titles
					if (index <= 0) {
						rankResultSplit += partA + ",Value" + partB + '\n';
						return;
					}

					let posStatus = nthIndex(line, ',', 6);
					partA = line.substring(0, posStatus);
					//let partB = line.substring(posName);


					let value = "";
					let status = line.substring(posStatus +1, posName);
					// Crew name should be in double quotes after a comma within partB
					let posNameEnd = partB.indexOf('"',2);
					if (posNameEnd > 0) {
						let crewName = partB.substring(2, posNameEnd);
						let crew = STTApi.roster.find(crew => crew.name == crewName);
						if (crew && crew.usage_value) {
							value = crew.usage_value;
						}
						if (crew) {
							includedCrew[crew.id] = crew;
							status = '' + crew.rarity == crew.max_rarity ? crew.max_rarity : (crew.rarity + '/' + crew.max_rarity);
							if (crew.frozen)
								status += 'Frz';
							else if (crew.level == 100 && crew.rarity == crew.max_rarity)
								status += 'Imm';
						}
					}

					rankResultSplit += partA + ',' + status + ',' + value + partB + '\n'; // join back with pipe to make easier equations
				});

				// Inject any crew with a usage value but no voyage score
				STTApi.roster.forEach(crew => {
					if (!includedCrew[crew.id]) {
						if (crew.buyback || crew.isExternal)
							return;
						if (crew.usage_value > 0 || (crew.max_rarity > 3 && !crew.frozen)) {
							includedCrew[crew.id] = crew;
							let status = '' + crew.rarity == crew.max_rarity ? crew.max_rarity : (crew.rarity + '/' + crew.max_rarity);
							if (crew.frozen)
								status += 'Frz';
							else if (crew.level == 100 && crew.rarity == crew.max_rarity)
								status += 'Imm';
							else if (crew.level < 100)
								status += ':' + crew.level;

							rankResultSplit += '0,,,,,,'+status+','+crew.usage_value+',"'+crew.name+'",,\n';
						}
					}
				});

				download('My Voyage Crew.csv', rankResultSplit, 'Export Star Trek Timelines voyage crew ranking', 'Export');
				download('My Voyage Estimates.csv', estimateResultSplit, 'Export Star Trek Timelines voyage estimates', 'Export');
			},
			progressResult => {
				console.log('unexpected progress result!'); // not implemented yet..
			}
		);
	}
	// #!endif
}

export class VoyageLogEntry extends React.Component {
	constructor(props) {
		super(props);

		this.props.log.forEach(entry => {
			// TODO: some log entries have 2 crew
			if (entry.crew) {
				let rc = STTApi.roster.find(rosterCrew => rosterCrew.symbol == entry.crew[0]);
				if (rc) entry.crewIconUrl = rc.iconUrl;
			}
		});
	}

	render() {
		let listItems = [];
		this.props.log.forEach((entry, index) => {
			if (entry.crewIconUrl) {
				listItems.push(
					<List.Item key={index}>
						<Image avatar src={entry.crewIconUrl} />
						<List.Content>
							<List.Header>
								<span dangerouslySetInnerHTML={{ __html: entry.text }} />
							</List.Header>
							{entry.skill_check && (
								<List.Description>
									<span className='quest-mastery'>
										<img src={CONFIG.SPRITES['icon_' + entry.skill_check.skill].url} height={18} />
										{entry.skill_check.passed == true ? <Icon name='thumbs up' /> : <Icon name='thumbs down' />}
									</span>
								</List.Description>
							)}
						</List.Content>
					</List.Item>
				);
			} else {
				listItems.push(
					<List.Item key={index}>
						<span dangerouslySetInnerHTML={{ __html: entry.text }} />
					</List.Item>
				);
			}
		});

		return <List>{listItems}</List>;
	}
}

export class VoyageLog extends React.Component {
	constructor(props) {
		super(props);

		let _columns = [
			{
				id: 'icon',
				Header: '',
				minWidth: 30,
				maxWidth: 30,
				resizable: false,
				accessor: row => row.full_name,
				Cell: p => <img src={p.original.iconUrl} height={25} />
			},
			{
				id: 'quantity',
				Header: 'Quantity',
				minWidth: 50,
				maxWidth: 70,
				resizable: false,
				accessor: row => row.quantity
			},
			{
				id: 'name',
				Header: 'Name',
				minWidth: 150,
				maxWidth: 250,
				resizable: true,
				accessor: row => row.full_name,
				Cell: p => {
					let item = p.original;
					return (
						<a href={'https://stt.wiki/wiki/' + item.full_name.split(' ').join('_')} target='_blank'>
							{item.full_name}
						</a>
					);
				}
			},
			{
				id: 'rarity',
				Header: 'Rarity',
				accessor: c => {
					if (c.type > 2) {
						return -1;
					}
					return c.rarity;
				},
				minWidth: 75,
				maxWidth: 75,
				resizable: false,
				Cell: p => {
					let item = p.original;
					// 3 is for honor, credits, crons
					if (item.type > 2) {
						return <span />;
					}

					return (
						<span key={item.id}>
							<RarityStars min={1} max={item.rarity ? item.rarity : 1} value={item.rarity ? item.rarity : null} colored='true' />
						</span>
					);
				}
			},
			{
				id: 'type',
				Header: 'Type',
				minWidth: 100,
				resizable: true,
				accessor: row => {
					if (row.item_type) {
						return row.type + '.' + row.item_type;
					}
					return row.type;
				},
				Cell: p => {
					let item = p.original;

					if (item.type === 1) {
						// For crew, check if it's useful or not
						let have = STTApi.roster.filter(crew => crew.symbol === item.symbol);
						if (have.length > 0) {
							if (have.some(c => c.frozen === 1)) {
								return <span>Duplicate of frozen crew (airlock-able)</span>;
							}
							if (have.some(c => c.max_rarity === c.rarity)) {
								return <span>Duplicate of fully-fused crew (airlock-able)</span>;
							}

							return <span style={{ fontWeight: 'bold' }}>NEW STAR FOR CREW!</span>;
						}
						return <span style={{ fontWeight: 'bold' }}>NEW CREW!</span>;
					}

					let typeName = CONFIG.REWARDS_ITEM_TYPE[item.item_type];
					if (typeName) {
						return typeName;
					}
					typeName = CONFIG.REWARDS_TYPE[item.type];
					if (typeName) {
						return typeName;
					}

					// fall-through case for items
					typeName = item.icon.file.replace('/items', '').split('/')[1];
					if (typeName) {
						return typeName;
					}

					// show something so we know to fix these
					if (item.item_type) {
						return item.type + '.' + item.item_type;
					}
					return item.type;
				}
			}
		];

		this.state = {
			showSpinner: true,
			includeFlavor: false,
			rewardTableColumns: _columns,
			// By default, sort the voyage rewards table by type and rarity to show crew first
			sorted: [{ id: 'type', desc: false }, { id: 'rarity', desc: true }]
		};

		this.reloadVoyageState();
	}

	componentDidMount() {
		// Every 5 minutes refresh
		// TODO: this should be configurable
		const refreshInterval = 5 * 60;
		// this.intervalLogRefresh = setInterval(() => this.reloadVoyageState(), refreshInterval * 1000);
	}

	componentWillUnmount() {
		// clearInterval(this.intervalLogRefresh);
	}

	async reloadVoyageState() {
		let voyage = STTApi.playerData.character.voyage[0];
		if (voyage && voyage.id) {
			let voyageNarrative = await loadVoyage(voyage.id, false);
			let voyageExport = {
				id: voyage.id,
				skills: voyage.skills,
				skillAggregates: [],
				stats: {
					skillChecks: {
						times: [],
					},
					rewards: {
						times: [],
					},
				},
				narrative: voyageNarrative,
			};

			//<Checkbox checked={this.state.includeFlavor} label="Include flavor entries" onChange={(e, isChecked) => { this.setState({ includeFlavor: isChecked }); }} />
			if (!this.state.includeFlavor) {
				// Remove the "flavor" entries (useless text)
				voyageNarrative = voyageNarrative.filter(e => e.encounter_type !== 'flavor');
			}

			// compute skill check counts
			let skillChecks = voyageNarrative.reduce(function(r, a) {
				if (a.skill_check && a.skill_check.skill && a.encounter_type === "hazard") {
					if (!r[a.skill_check.skill])
						r[a.skill_check.skill] = [0,0];
					r[a.skill_check.skill][0]++;
					if (a.skill_check.passed)
						r[a.skill_check.skill][1]++;
					voyageExport.stats.skillChecks.times.push(a.event_time);
				}
				return r;
			}, Object.create(null));

			Object.keys(CONFIG.SKILLS).forEach(sk => {
				if (!skillChecks[sk]) {
					skillChecks[sk] = [0,0];
				}
			});

			voyageNarrative.filter(e => e.encounter_type === "reward").forEach(v => {
				voyageExport.stats.rewards.times.push(v.event_time);
			});

			// at index "index", need to subtract "gap" from all times >=
			let timeGaps = [];

			voyageNarrative.forEach((e,i,ee) => {
				if (i > 1 && ee[i-1].encounter_type === "dilemma" && e.encounter_type !== "dilemma") {
					let timelost = e.event_time - ee[i-1].event_time;
					timeGaps.push({gap: timelost, index:e.index})
					// find the next
				}
			});

			if (voyageExport.stats.skillChecks.times.length > 1) {
				voyageExport.stats.skillChecks.average = voyageExport.stats.skillChecks.times
					.map((v,i,vv) => i == 0 ? 0 : v - vv[i-1])
					.reduce((a,b) => a+b)
					/ voyageExport.stats.skillChecks.times.length;
			}
			if (voyageExport.stats.rewards.times.length > 1) {
				voyageExport.stats.rewards.average = voyageExport.stats.rewards.times
					.map((v,i,vv) => i == 0 ? 0 : v - vv[i-1])
					.reduce((a,b) => a+b)
					/ voyageExport.stats.rewards.times.length;
			}

			let attemptCount = Object.values(skillChecks).map(v => v[0]).reduce((p,c) => p + c);
			Object.keys(skillChecks).forEach(k => {
				let agg = voyage.skill_aggregates[k];
				voyageExport.skillAggregates.push({
					skill: k,
					core: agg.core,
					min: agg.range_min,
					max: agg.range_max,
					// Compute and export the "voyage skill" values displayed in the UI
					score: agg.core + (agg.range_min + agg.range_max) / 2,
					attempts: skillChecks[k][0],
					passed: skillChecks[k][1],
					passedPercent: skillChecks[k][1] / skillChecks[k][0],
					attemptsPercent: skillChecks[k][0] / attemptCount
				});
			});

			// Group by index
			voyageNarrative = voyageNarrative.reduce(function(r, a) {
				r[a.index] = r[a.index] || [];
				r[a.index].push(a);
				return r;
			}, Object.create(null));

			let voyageRewards = voyage.pending_rewards.loot;
			let iconPromises = [];
			voyageRewards.forEach(reward => {
				reward.iconUrl = '';
				if (reward.icon.atlas_info) {
					// This is not fool-proof, but covers currently known sprites
					reward.iconUrl = CONFIG.SPRITES[reward.icon.file].url;
				} else {
					iconPromises.push(
						STTApi.imageProvider
							.getItemImageUrl(reward, reward)
							.then(found => {
								found.id.iconUrl = found.url;
							})
							.catch(error => {
								/*console.warn(error);*/
							})
					);
				}
			});

			await Promise.all(iconPromises);

			let ship_name = voyage.ship_name;
			if (!ship_name) {
				let ship = STTApi.ships.find(ship => ship.id === voyage.ship_id);
				ship_name = ship ? ship.name : '-BUGBUG-';
			}

			this.setState({
				showSpinner: false,
				ship_name: ship_name,
				ship_id: voyage.ship_id,
				created_at: voyage.created_at,
				voyage_duration: voyage.voyage_duration,
				seconds_since_last_dilemma: voyage.seconds_since_last_dilemma,
				seconds_between_dilemmas: voyage.seconds_between_dilemmas,
				skill_aggregates: voyage.skill_aggregates,
				crew_slots: voyage.crew_slots,
				voyage: voyage,
				voyageNarrative: voyageNarrative,
				skillChecks: skillChecks,
				estimatedMinutesLeft: voyage.hp / 21,
				estimatedMinutesLeftRefill: voyage.hp / 21,
				nativeEstimate: false,
				voyageRewards: voyageRewards,
				voyageExport: voyageExport
			});

			// Avoid estimating if voyage is not ongoing
			if (voyage.state !== 'recalled' && voyage.state !== 'failed') {
				this._betterEstimate();
			}
		}
	}

	renderVoyageState() {
		if (this.state.voyage.state === 'recalled') {
			return (
				<p>
					Voyage has lasted for {formatTimeSeconds(this.state.voyage_duration)} and it's currently returning (
					{formatTimeSeconds(this.state.voyage.recall_time_left)} left).
				</p>
			);
		} else if (this.state.voyage.state === 'failed') {
			return (
				<p>
					Voyage has run out of antimatter after {formatTimeSeconds(this.state.voyage_duration)} and it's waiting to be abandoned or
					replenished.
				</p>
			);
		} else {
			const getDilemmaChance = (estimatedMinutesLeft) => {
				let minEstimate = (estimatedMinutesLeft * 0.75 - 1) * 60;
				let maxEstimate = estimatedMinutesLeft * 60;

				let chanceDilemma =
					(100 * (this.state.seconds_between_dilemmas - this.state.seconds_since_last_dilemma - minEstimate)) / (maxEstimate - minEstimate);
				chanceDilemma = (100 - Math.min(Math.max(chanceDilemma, 0), 100)).toFixed();

				return chanceDilemma;
			};

			return (
				<div>
					<p>
						Voyage has been ongoing for <b>{formatTimeSeconds(this.state.voyage_duration)}</b> (new dilemma in
						{' '}{formatTimeSeconds(this.state.seconds_between_dilemmas - this.state.seconds_since_last_dilemma)}
						{' '}at {Moment().add(this.state.seconds_between_dilemmas - this.state.seconds_since_last_dilemma, 's').format('h:mma')}).
					</p>

					<div className='ui blue label'>
						Estimated time left: <b>{formatTimeSeconds(this.state.estimatedMinutesLeft * 60)}</b>
						{' '}at {Moment().add(this.state.estimatedMinutesLeft, 'm').format('h:mma')}
						{' '}{!this.state.nativeEstimate && <i className='spinner loading icon' />}
					</div>

					<button className='ui mini button' onClick={() => this._recall()}>
						<i className='icon undo' />
						Recall now
					</button>

					<p>There is an estimated {getDilemmaChance(this.state.estimatedMinutesLeft)}% chance for the voyage to reach next dilemma.</p>
				</div>
			);
		}
	}

	async _betterEstimate() {
		const assignedCrew = this.state.voyage.crew_slots.map(slot => slot.crew.id);
		const assignedRoster = STTApi.roster.filter(crew => assignedCrew.includes(crew.crew_id));

		let options = {
			// first three not needed for estimate calculation
			searchDepth: 0,
			extendsTarget: 0,
			shipAM: 0,
			skillPrimaryMultiplier: 3.5,
			skillSecondaryMultiplier: 2.5,
			skillMatchingMultiplier: 1.1,
			traitScoreBoost: 200,
			voyage_description: STTApi.playerData.character.voyage_descriptions[0],
			roster: assignedRoster,
			// Estimate-specific parameters
			voyage_duration: this.state.voyage.voyage_duration,
			remainingAntiMatter: this.state.voyage.hp,
			assignedCrew
		};

		estimateVoyageRemaining(options, estimate => {
			this.setState({ estimatedMinutesLeft: estimate });

			options.remainingAntiMatter += this.state.voyage.max_hp;
			estimateVoyageRemaining(options, estimate => {
				this.setState({ estimatedMinutesLeftRefill: estimate, nativeEstimate: true });
			});
		});
	}

	async _recall() {
		await recallVoyage(STTApi.playerData.character.voyage[0].id);
		this.reloadVoyageState();
	}

	async _chooseDilemma(voyageId, dilemmaId, index) {
		if (index < 0) {
			return;
		}
		await resolveDilemma(voyageId, dilemmaId, index);

		// Remove the dilemma that was just resolved
		STTApi.playerData.character.voyage[0].dilemma = null;

		this.reloadVoyageState();
	}

	renderDilemma() {
		if (this.state.voyage.dilemma && this.state.voyage.dilemma.id) {
			return (
				<div>
					<h3 key={0} className='ui top attached header'>
						Dilemma - <span dangerouslySetInnerHTML={{ __html: this.state.voyage.dilemma.title }} />
					</h3>
					,
					<div key={1} className='ui center aligned inverted attached segment'>
						<div>
							<span dangerouslySetInnerHTML={{ __html: this.state.voyage.dilemma.intro }} />
						</div>
						<div className='ui middle aligned selection list inverted'>
							{this.state.voyage.dilemma.resolutions.map((resolution, index) => {
								if (resolution.locked) {
									return (
										<div className='item' key={index}>
											<div className='content'>
												<div className='header'>
													LOCKED - <span dangerouslySetInnerHTML={{ __html: resolution.option }} />
												</div>
											</div>
										</div>
									);
								} else {
									return (
										<div
											className='item'
											key={index}
											onClick={() => this._chooseDilemma(this.state.voyage.id, this.state.voyage.dilemma.id, index)}>
											<img src={CONFIG.SPRITES['icon_' + resolution.skill].url} height={18} />
											<div className='content'>
												<div className='header'>
													<span dangerouslySetInnerHTML={{ __html: resolution.option }} />
												</div>
											</div>
										</div>
									);
								}
							})}
						</div>
					</div>
				</div>
			);
		} else {
			return <span />;
		}
	}

	renderCrewSkills(crew) {
		return <span key={crew.id}>
			<RarityStars min={1} max={crew.max_rarity} value={crew.rarity} asSpan='true' />&nbsp;{Object.keys(crew.skills).map(s => {
				return (<span key={s}><img src={CONFIG.SPRITES['icon_' + s].url} height={18} />
					{crew.skills[s].core} ({crew.skills[s].range_min}-{crew.skills[s].range_max})
				</span>);
			})}
		</span>
	}

	render() {
		if (this.state.showSpinner) {
			return (
				<div className='centeredVerticalAndHorizontal'>
					<div className='ui massive centered text active inline loader'>Loading voyage details...</div>
				</div>
			);
		}

		const defaultButton = props => (
			<Button {...props} style={{ width: '100%' }}>
				{props.children}
			</Button>
		);

		return (
			<div style={{ userSelect: 'initial' }}>
				<h3>Voyage on the {this.state.ship_name}</h3>
				{this.renderVoyageState()}
				{this.renderDilemma()}
				<p>
					Antimatter remaining: {this.state.voyage.hp} / {this.state.voyage.max_hp}.
				</p>
				<table style={{ borderSpacing: '0' }}>
					<tbody>
						<tr>
							<td>
								<section>
									<h4>Full crew complement and skill aggregates</h4>
									<ul>
										{this.state.crew_slots.map(slot => {
											return (
												<li key={slot.symbol}>
													<span className='quest-mastery'>
														<img src={CONFIG.SPRITES['icon_' + slot.skill].url} height={18} /> &nbsp;
														{slot.name} &nbsp;{' '}
														<Popup flowing
															trigger={<span className='quest-mastery'>
																<img src={STTApi.roster.find(rosterCrew => rosterCrew.id == slot.crew.archetype_id).iconUrl} height={20} />{' '}
																&nbsp; {slot.crew.name}
																</span>}
															content={this.renderCrewSkills(slot.crew)}
														/>
													</span>
												</li>
											);
										})}
									</ul>
								</section>
							</td>
							<td>
								<ul>
									{Object.values(this.state.voyage.skill_aggregates).map(skill => {
										let isPri = skill.skill == this.state.voyage.skills.primary_skill;
										let isSec = skill.skill == this.state.voyage.skills.secondary_skill;
										return (
											<li key={skill.skill}>
												<span className='quest-mastery'>
													<img src={CONFIG.SPRITES['icon_' + skill.skill].url} height={18} /> &nbsp; {skill.core} ({skill.range_min}-
													{skill.range_max})&nbsp;[{skill.core + (skill.range_min + skill.range_max)/2}]&nbsp;
													{isPri ? ' (Pri) ' : ''}
													{isSec ? ' (Sec) ' : ''}
													&nbsp;
													<Popup
														trigger={<span style={isPri ? { color: CONFIG.RARITIES[5].color } : isSec ? { color: CONFIG.RARITIES[1].color} : {}}><Icon name='thumbs up' /></span>}
														content="Skill checks passed"
													/> {this.state.skillChecks[skill.skill][1]}/{this.state.skillChecks[skill.skill][0]}
												</span>
											</li>
										);
									})}
								</ul>
							</td>
						</tr>
					</tbody>
				</table>

				<h3>{'Pending rewards (' + this.state.voyageRewards.length + ')'}</h3>
				<div className='voyage-rewards-grid'>
					<ReactTable
						data={this.state.voyageRewards}
						columns={this.state.rewardTableColumns}
						sorted={this.state.sorted}
						onSortedChange={sorted => this.setState({ sorted })}
						className='-striped -highlight'
						defaultPageSize={10}
						pageSize={10}
						showPagination={this.state.voyageRewards.length > 10}
						showPageSizeOptions={false}
						NextComponent={defaultButton}
						PreviousComponent={defaultButton}
					/>
				</div>
				<br />
				<CollapsibleSection title={"Complete Captain's Log (" + Object.keys(this.state.voyageNarrative).length + ')'}>
					{Object.keys(this.state.voyageNarrative).map(key => {
						return <VoyageLogEntry key={key} log={this.state.voyageNarrative[key]} />;
					})}
				</CollapsibleSection>
				<button className='ui mini button blue'
					onClick={() => download('narrative.'+this.state.voyage.id+'.json',
													JSON.stringify(this.state.voyageExport),
													'Export voyage narrative JSON',
													'Export',
													false)}>
					Export Narrative JSON
				</button>

				<br />
			</div>
		);
	}
}

export class VoyageTools extends React.Component {
	constructor(props) {
		super(props);

		this.state = {
			showCalcAnyway: false
		};
	}

	_onRefreshNeeded() {
		this.forceUpdate();
	}

	componentDidMount() {
		this._updateCommandItems();
	}

	_updateCommandItems() {
		if (this.props.onCommandItemsUpdate) {
			const activeVoyage = STTApi.playerData.character.voyage.length > 0;

			if (activeVoyage) {
				this.props.onCommandItemsUpdate([
					{
						key: 'exportExcel',
						name: this.state.showCalcAnyway ? 'Switch to log' : 'Switch to recommendations',
						iconProps: { iconName: 'Switch' },
						onClick: () => {
							this.setState({ showCalcAnyway: !this.state.showCalcAnyway }, () => {
								this._updateCommandItems();
							});
						}
					}
				]);
			} else {
				this.props.onCommandItemsUpdate([]);
			}
		}
	}

	render() {
		const activeVoyage = STTApi.playerData.character.voyage.length > 0;

		return (
			<div className='tab-panel' data-is-scrollable='true'>
				{(!activeVoyage || this.state.showCalcAnyway) && <VoyageCrew onRefreshNeeded={() => this._onRefreshNeeded()} />}
				{activeVoyage && !this.state.showCalcAnyway && <VoyageLog />}
			</div>
		);
	}
}
