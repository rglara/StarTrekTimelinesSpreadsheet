import React from 'react';
import { Message, Dropdown, Header, Select, Checkbox, Form, Image, Card } from 'semantic-ui-react';

import STTApi, { CONFIG, formatCrewStats, bonusCrewForCurrentEvent, formatTimeSeconds, download, RarityStars } from '../../api';
import { CrewData } from '../../api/DTO';
import { bestVoyageShip, startVoyage } from './VoyageTools';
import { calculateVoyage, exportVoyageData, CalcChoice, cleanCrewName } from './voyageCalc';

interface VoyageCrewEntry {
	key: number;
	value: number;
	image: { avatar: boolean; src: string | undefined; };
	text: string;
}

export const VoyageCrew = (props: {
	onRefreshNeeded: () => void;
}) => {
	const [error, setError] = React.useState(undefined as string | undefined);
	const [generatingVoyCrewRank, setGeneratingVoyCrewRank] = React.useState(false);
	const [searchDepth, setSearchDepth] = React.useState(6);
	const [extendsTarget, setExtendsTarget] = React.useState(0);
	const [includeFrozen, setIncludeFrozen] = React.useState(false);
	const [includeActive, setIncludeActive] = React.useState(false);
	const [shipName, setShipName] = React.useState(undefined as string | undefined);

	const initialCalcState = {
		estimatedDuration: undefined,
		state: undefined,
		crewSelection: []
	} as {
		estimatedDuration: number | undefined,
		state: string | undefined,
		crewSelection: CalcChoice[]
	}

	const [calcState, setCalcState] = React.useState(initialCalcState);

	let bestVoyageShips = bestVoyageShip();
	const [bestShips, setBestShips] = React.useState(bestVoyageShips);
	const [selectedShip, setSelectedShip] = React.useState(bestVoyageShips[0].ship.id as number | undefined);

		let peopleListVal: VoyageCrewEntry[] = [];
		STTApi.roster.forEach(crew => {
			peopleListVal.push({
				key: crew.crew_id || crew.id,
				value: crew.crew_id || crew.id,
				image: { avatar: true, src: crew.iconUrl },
				text: crew.name
			});
		});
		peopleListVal.sort((a, b) => (a.text < b.text) ? -1 : ((a.text > b.text) ? 1 : 0));
	const [peopleList, setPeopleList] = React.useState(peopleListVal);

		// See which crew is needed in the event to give the user a chance to remove them from consideration
		let result = bonusCrewForCurrentEvent();
	const [activeEvent, setActiveEvent] = React.useState(result ? result.eventName : undefined);
	const [currentSelectedItems, setCurrentSelectedItems] = React.useState(result ? result.crewIds : []);

	// function getIndexBySlotName(slotName: any) : number | undefined {
	// 	const crewSlots = STTApi.playerData.character.voyage_descriptions[0].crew_slots;
	// 	for (let slotIndex = 0; slotIndex < crewSlots.length; slotIndex++) {
	// 		if (crewSlots[slotIndex].name === slotName) {
	// 			return slotIndex;
	// 		}
	// 	}
	// }

	let shipSpans = [];
	for (let entry of bestShips) {
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
			<Form className='attached fluid segment' loading={generatingVoyCrewRank || calcState.state === 'inprogress'}>
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
						value={searchDepth}
						onChange={(e: any, { value }: any) => setSearchDepth(value)}
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
						value={extendsTarget}
						onChange={(e:any, { value }:any) => setExtendsTarget(value)}
						placeholder='How many times you plan to revive'
					/>
				</Form.Group>

				<Form.Group inline>
					<Form.Field>
						<label>Choose a ship (Bonus: {STTApi.playerData.character.voyage_descriptions[0].ship_trait})</label>
						<Dropdown
							className='ship-dropdown'
							selection
							options={shipSpans}
							placeholder='Choose a ship for your voyage'
							value={selectedShip}
							onChange={(ev, { value }) => setSelectedShip(value !== undefined ? +value : undefined)}
						/>
					</Form.Field>

					<Form.Input
						label='Ship name'
						value={shipName}
						placeholder={bestShips.find((s) => s.ship.id == selectedShip)!.ship.name}
						onChange={(ev, { value }) => setShipName(value)}
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
						options={peopleList}
						placeholder='Select or search for crew'
						label={
							"Crew you don't want to consider for voyage" +
							(activeEvent ? ` (preselected crew which gives bonus in the event ${activeEvent})` : '')
						}
						value={currentSelectedItems}
						onChange={(e: any, { value }: any) => setCurrentSelectedItems(value)}
					/>
				</Form.Group>

				<Form.Group inline>
					<Form.Field
						control={Checkbox}
						label='Include active (on shuttles) crew'
						checked={includeActive}
						onChange={(e: any, { checked }: any) => setIncludeActive(checked)}
					/>

					<Form.Field
						control={Checkbox}
						label='Include frozen (vaulted) crew'
						checked={includeFrozen}
						onChange={(e: any, { checked }: any) => setIncludeFrozen(checked)}
					/>
				</Form.Group>

				{(calcState.state === 'inprogress' || calcState.state === 'done') && (
					<h3>
						Estimated duration: <b>{formatTimeSeconds(calcState.estimatedDuration! * 60 * 60)}</b>
					</h3>
				)}

				<Form.Group>
					<Form.Button primary onClick={_calcVoyageData} disabled={calcState.state === 'inprogress'}>
						Calculate best crew selection
					</Form.Button>
					<Form.Button secondary onClick={_startVoyage} disabled={calcState.state !== 'done'}>
						Start voyage with recommendations
					</Form.Button>

					{/* #!if ENV === 'electron' */}
					<Form.Button onClick={() => _generateVoyCrewRank()} disabled={calcState.state === 'inprogress'}>
						Export CSV with crew Voyage ranking...
					</Form.Button>
					{/* #!endif */}
				</Form.Group>
			</Form>
			<Message attached='bottom' error hidden={!error}>
				Error: {error}
			</Message>

			<BestCrew state={calcState.state} crewSelection={calcState.crewSelection} />
		</div>
	);

	function _startVoyage() {
		let selectedCrewIds = [];
		for (let i = 0; i < STTApi.playerData.character.voyage_descriptions[0].crew_slots.length; i++) {
			let entry = calcState.crewSelection.find((entry) => entry.slotId === i);
			if (!entry) {
				setError(`Cannot start voyage with unknown crew slot '${i}'`);
				return;
			}

			if (!entry.choice.crew_id || entry.choice.active_id) {
				setError(`Cannot start voyage with frozen or active crew '${entry.choice.name}'`);
				return;
			}

			selectedCrewIds.push(entry.choice.crew_id);
		}

		startVoyage(
			STTApi.playerData.character.voyage_descriptions[0].symbol,
			bestShips.find((s) => s.ship.id == selectedShip)!.ship.id,
			shipName,
			selectedCrewIds
		)
			.then(() => {
				props.onRefreshNeeded();

				let voyage = STTApi.playerData.character.voyage[0];
				if (voyage && voyage.id) {
					// this.state.estimatedDuration
					// Save it somewhere
				}
			})
			.catch(err => {
				setError(err.message);
			});
	}

	function _packVoyageOptions() {
		let filteredRoster = STTApi.roster.filter(crew => {
			// Filter out buy-back crew
			if (crew.buyback) {
				return false;
			}

			if (!includeActive && crew.active_id) {
				return false;
			}

			if (!includeFrozen && crew.frozen > 0) {
				return false;
			}

			// TODO: ignore crew crashes
			// TODO: fix wasm

			// Filter out crew the user has chosen not to include
			if (
				currentSelectedItems.length > 0 &&
				currentSelectedItems.some((ignored) => ignored === (crew.crew_id || crew.id))
			) {
				return false;
			}

			return true;
		});

		return {
			searchDepth: searchDepth,
			extendsTarget: extendsTarget,
			shipAM: bestShips.find((s) => s.ship.id == selectedShip)!.score,
			skillPrimaryMultiplier: 3.5,
			skillSecondaryMultiplier: 2.5,
			skillMatchingMultiplier: 1.1,
			traitScoreBoost: 200,
			voyage_description: STTApi.playerData.character.voyage_descriptions[0],
			roster: filteredRoster
		};
	}

	function _calcVoyageData() {
		let options = _packVoyageOptions();

		calculateVoyage(
			options,
			(entries: CalcChoice[], score: number) => {
				setCalcState({
					crewSelection: entries,
					estimatedDuration: score,
					state: 'inprogress'
				});
			},
			(entries: CalcChoice[], score: number) => {
				setCalcState({
					crewSelection: entries,
					estimatedDuration: score,
					state: 'done'
				});
			}
		);
	}

	// #!if ENV === 'electron'
	function _generateVoyCrewRank() {
		function nthIndex(str:string, pat:string, n:number) {
			let L = str.length, i = -1;
			while (n-- && i++ < L) {
				i = str.indexOf(pat, i);
				if (i < 0) break;
			}
			return i;
		}

		setGeneratingVoyCrewRank(true);

		let dataToExport = exportVoyageData(_packVoyageOptions());

		const NativeExtension = require('electron').remote.require('stt-native');
		NativeExtension.calculateVoyageCrewRank(
			JSON.stringify(dataToExport),
			(rankResult: string, estimateResult: string) => {
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

				setGeneratingVoyCrewRank(false);

				// Now also update rankResult to add crew usage value column
				// Format is: "Score,Alt 1,Alt 2,Alt 3,Alt 4,Alt 5,Status,Crew,Voyages (Pri),Voyages(alt)"
				let linesCrew = rankResult.split('\n');
				let rankResultSplit = "";
				let includedCrew : { [cid:number]: CrewData } = {};
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
						let crew = STTApi.roster.find(crew => cleanCrewName(crew.name) == crewName);
						if (crew && crew.usage_value !== undefined) {
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

							rankResultSplit += '0,,,,,,' + status + ',' + crew.usage_value + ',"' +cleanCrewName(crew.name)+'",,\n';
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

const BestCrew = (props : { state: string | undefined, crewSelection: CalcChoice[]}) => {
	if (props.state === 'inprogress' || props.state === 'done') {
		let crewSpans: any[] = [];
		props.crewSelection.forEach((entry) => {
			if (entry.choice) {
				let isShuttle = false;
				STTApi.playerData.character.shuttle_adventures.forEach((shuttle) => {
					if (shuttle.shuttles[0].id === entry.choice.active_id) {
						isShuttle = true;
					}
				});

				let trait = STTApi.playerData.character.voyage_descriptions[0].crew_slots[entry.slotId].trait;
				let traitMatch = entry.choice.rawTraits.find(t => t === trait);

				let status = entry.choice.frozen > 0 ? 'Frozen' : entry.choice.active_id ? isShuttle ? 'On Shuttle' : 'On Voyage' : 'Available';
				let crew = (
					<Card key={entry.choice.crew_id || entry.choice.id} color={status === 'Frozen' ? 'red' : status === 'Available' ? 'green' : 'yellow'}>
						<Card.Content>
							<Image floated='right' size='mini' src={entry.choice.iconUrl} />
							<Card.Header>{entry.choice.name}</Card.Header>
							<Card.Meta>
								{STTApi.playerData.character.voyage_descriptions[0].crew_slots[entry.slotId].name}<br/>
								{traitMatch ? <b>{trait}</b> : trait }
							</Card.Meta>
							<Card.Description>
								<RarityStars max={entry.choice.max_rarity} value={entry.choice.rarity} colored={true} />
								<div>{formatCrewStats(entry.choice)}</div>
							</Card.Description>
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
				{props.state === 'inprogress' && <div className='ui medium centered text active inline loader'>Still calculating...</div>}
				<Card.Group>{crewSpans}</Card.Group>
			</div>
		);
	} else {
		return <span />;
	}
}
