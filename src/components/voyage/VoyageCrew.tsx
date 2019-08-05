import React from 'react';

import { Message, Dropdown, Button, Header, Select, Checkbox, Form, List, Image, Icon, Card, Popup } from 'semantic-ui-react';

import STTApi from '../../api';
import {
	CONFIG,
	formatCrewStats,
	bonusCrewForCurrentEvent,
	formatTimeSeconds
} from '../../api';
import { CollapsibleSection } from '../CollapsibleSection';
import { RarityStars } from '../RarityStars';

import { bestVoyageShip, startVoyage } from './VoyageTools';
import { download } from '../../utils/pal';
import { calculateVoyage, estimateVoyageRemaining, exportVoyageData } from './voyageCalc';

export class VoyageCrew extends React.Component<any,any> {
	constructor(props:any) {
		super(props);

		let peopleList: any= [];
		STTApi.roster.forEach(crew => {
			peopleList.push({
				key: crew.crew_id || crew.id,
				value: crew.crew_id || crew.id,
				image: { avatar: true, src: crew.iconUrl },
				text: crew.name
			});
		});
		peopleList.sort((a: any, b: any) => (a.text < b.text) ? -1 : ((a.text > b.text) ? 1 : 0));

		let bestVoyageShips = bestVoyageShip();
		// See which crew is needed in the event to give the user a chance to remove them from consideration
		let result = bonusCrewForCurrentEvent();
		this.state = {
			bestShips: bestVoyageShips,
			selectedShip: bestVoyageShips[0].ship.id,
			includeFrozen: false,
			includeActive: false,
			shipName: undefined,
			state: undefined,
			searchDepth: 6,
			extendsTarget: 0,
			peopleList,
			error: undefined,
			generatingVoyCrewRank: false,
			activeEvent : result ? result.eventName : undefined,
			currentSelectedItems : result ? result.crewIds : [],
		};

		this._calcVoyageData = this._calcVoyageData.bind(this);
		this._startVoyage = this._startVoyage.bind(this);
	}

	getIndexBySlotName(slotName: any) {
		const crewSlots = STTApi.playerData.character.voyage_descriptions[0].crew_slots;
		for (let slotIndex = 0; slotIndex < crewSlots.length; slotIndex++) {
			if (crewSlots[slotIndex].name === slotName) {
				return slotIndex;
			}
		}
	}

	renderBestCrew() {
		if (this.state.state === 'inprogress' || this.state.state === 'done') {
			let crewSpans: any= [];
			this.state.crewSelection.forEach((entry: any) => {
				if (entry.choice) {
					let status = entry.choice.frozen > 0 ? 'frozen' : entry.choice.active_id > 0 ? 'active' : 'available';
					let statusColor = status === 'frozen' ? 'red' : status === 'active' ? 'yellow' : 'green';
					let crew = (
						<Card key={entry.choice.crew_id || entry.choice.id} color={status === 'frozen' ? 'red' : status === 'active' ? 'yellow' : 'green'}>
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
							onChange={(e: any, { value }: any) => this.setState({ searchDepth: value })}
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
							onChange={(e:any, { value }:any) => this.setState({ extendsTarget: value })}
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
							placeholder={this.state.bestShips.find((s: any) => s.ship.id == this.state.selectedShip).ship.name}
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
							onChange={(e: any, { value }: any) => this.setState({ currentSelectedItems: value })}
						/>
					</Form.Group>

					<Form.Group inline>
						<Form.Field
							control={Checkbox}
							label='Include active (on shuttles) crew'
							checked={this.state.includeActive}
							onChange={(e: any, { checked }: any) => this.setState({ includeActive: checked })}
						/>

						<Form.Field
							control={Checkbox}
							label='Include frozen (vaulted) crew'
							checked={this.state.includeFrozen}
							onChange={(e: any, { checked }: any) => this.setState({ includeFrozen: checked })}
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
			let entry = this.state.crewSelection.find((entry: any) => entry.slotId === i);

			if (!entry.choice.crew_id || entry.choice.active_id > 0) {
				this.setState({ error: `Cannot start voyage with frozen or active crew '${entry.choice.name}'` });
				return;
			}

			selectedCrewIds.push(entry.choice.crew_id);
		}

		startVoyage(
			STTApi.playerData.character.voyage_descriptions[0].symbol,
			this.state.bestShips.find((s: any) => s.ship.id == this.state.selectedShip).ship.id,
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
				this.state.currentSelectedItems.some((ignored: any) => ignored === (crew.crew_id || crew.id))
			) {
				return false;
			}

			return true;
		});

		return {
			searchDepth: this.state.searchDepth,
			extendsTarget: this.state.extendsTarget,
			shipAM: this.state.bestShips.find((s: any) => s.ship.id == this.state.selectedShip).score,
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
			(entries: any, score: any) => {
				this.setState({
					crewSelection: entries,
					estimatedDuration: score,
					state: 'inprogress'
				});
			},
			(entries: any, score: any) => {
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
		function nthIndex(str:string, pat:string, n:number) {
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
			(rankResult: any, estimateResult: any) => {
				// estimateResult is of the form "Primary,Secondary,Estimate,Crew\nDIP, CMD, 8.2, crew1 | crew2 | crew3 | crew4 | crew5 | ... crew12\nCMD, DIP, 8.2, crew1 | ... "
				// crew names may have spaces and commas
				let lines = estimateResult.split('\n');
				let estimateResultSplit = "";
				lines.forEach((line: string,index:number) => {
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
						let part : string | number = est.substring(whole.length); // include decimal
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
				let includedCrew : any = {};
				linesCrew.forEach((line:string, index:number) => {
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


					let value : string | number = "";
					let status : string | number = line.substring(posStatus +1, posName);
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
							status = crew.rarity == crew.max_rarity ? crew.max_rarity : (crew.rarity + '/' + crew.max_rarity);
							if (crew.frozen > 0)
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
						if (crew.buyback || crew.isExternal || crew.usage_value === undefined)
							return;
						if (crew.usage_value > 0 || (crew.max_rarity > 3 && crew.frozen < 1)) {
							includedCrew[crew.id] = crew;
							let status : string | number = crew.rarity == crew.max_rarity ? crew.max_rarity : (crew.rarity + '/' + crew.max_rarity);
							if (crew.frozen > 0)
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
			(progressResult:any) => {
				console.log('unexpected progress result!'); // not implemented yet..
			}
		);
	}
	// #!endif
}
