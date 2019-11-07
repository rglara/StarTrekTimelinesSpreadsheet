import React from 'react';
import { Label } from 'office-ui-fabric-react/lib/Label';
import { MessageBar, MessageBarType } from 'office-ui-fabric-react/lib/MessageBar';
import { SpinButton } from 'office-ui-fabric-react/lib/SpinButton';
import { Checkbox } from 'office-ui-fabric-react/lib/Checkbox';
import { Persona, PersonaSize, PersonaPresence } from 'office-ui-fabric-react/lib/Persona';
import { getTheme } from '@uifabric/styling';

// #!if ENV === 'electron'
import Logger from '../utils/logger';
// #!endif

import STTApi, { CONFIG, formatTimeSeconds, formatCrewStatsVoy, download } from '../api';
import {
	GauntletRoundOdds, GauntletData,
	loadGauntlet, gauntletCrewSelection, gauntletRoundOdds, payToGetNewOpponents,
	payToReviveCrew, playContest, enterGauntlet, Match
} from '../api/GauntletTools';
import { GauntletDTO, GauntletCrewDTO, GauntletContestDTO, GauntletContestLootDTO } from '../api/DTO';
import { CircularLabel } from './CircularLabel';
import { ICommandBarItemProps } from 'office-ui-fabric-react/lib/CommandBar';
import { CrewImageData } from './images/ImageProvider';

interface GauntletCrewProps {
	crew: GauntletCrewDTO;
	maxwidth: number;
	showStats: boolean;
	reviveCost: { currency: number; amount: number };
	revive: (save:boolean) => void;
}

const GauntletCrew = (props: GauntletCrewProps) => {
	//let curr = CONFIG.CURRENCIES[this.props.reviveCost.currency];
	let avatar = STTApi.getCrewAvatarBySymbol(props.crew.archetype_symbol);

	return <div className="ui compact segments" style={{ textAlign: 'center', margin: '8px' }}>
		<h5 className="ui top attached header" style={{ color: getTheme().palette.neutralDark,
			backgroundColor: getTheme().palette.themeLighter, padding: '2px' }}
		>{avatar ? avatar.name : ''}</h5>
		<div className="ui attached segment" style={{ backgroundColor: getTheme().palette.themeLighter, padding: '0' }}>
			<div style={{ position: 'relative', display: 'inline-block' }}>
				<img src={avatar ? avatar.iconUrl : ''} className={props.crew.disabled ? 'image-disabled' : ''} height={Math.min(200, props.maxwidth)} />
				<div style={{ position: 'absolute', right: '0', top: '0' }}>
					<CircularLabel percent={props.crew.crit_chance} />
				</div>

			</div>
		</div>
		<div className="ui attached segment" style={{ backgroundColor: getTheme().palette.themeLighter, padding: '2px' }}>
			{props.crew.debuff / 4} battles
		</div>
		{props.showStats && <div className="ui attached segment" style={{ backgroundColor: getTheme().palette.themeLighter, padding: '2px' }}>
			{props.crew.skills.map((skill) =>
				<span className='gauntletCrew-statline' key={skill.skill}>
					<img src={CONFIG.SPRITES['icon_' + skill.skill].url} height={18} /> {CONFIG.SKILLS[skill.skill]} ({skill.min} - {skill.max})
				</span>
			)}
		</div>}
		{(props.crew.debuff > 0 || props.crew.disabled) &&
		<div className="ui bottom attached primary button" onClick={() => props.revive(props.crew.disabled)}>
			<i className="money bill alternate outline icon"></i>
			{props.crew.disabled ? 'Revive (' + props.reviveCost.amount + ' dil)' : 'Restore (' + props.reviveCost.amount + ' dil)'}
		</div>
		}
	</div>;
};

interface GauntletMatchProps {
	gauntlet: GauntletDTO;
	match: Match;
	consecutive_wins: number;
	onNewData: (data: GauntletData, logPath: string | undefined, match: Match) => void;
}

const GauntletMatch = (props: GauntletMatchProps) => {
	let _playMatch = (event:any) => {
		playContest(props.gauntlet, props.match, props.consecutive_wins).
			then((data) => {
				let logPath = undefined;

				// #!if ENV === 'electron'
				logPath = Logger.logGauntletEntry(data, props.match, props.consecutive_wins);
				// #!endif

				props.onNewData(data, logPath, props.match);
			});
	}

	//TODO: 320px hardcoded below!
	let containerStyle = {
		padding: '3px',
		backgroundColor: getTheme().palette.themeLighter,
		display: 'grid',
		gridTemplateColumns: '100px auto 12px auto 100px',
		gridTemplateRows: '14px 46px 50px 32px',
		gridTemplateAreas: `
		"pcrewname pcrewname . ocrewname ocrewname"
		"pcrewimage stats stats stats ocrewimage"
		"pcrewimage chance chance chance ocrewimage"
		"pcrewimage button button button ocrewimage"`};

	let oppCrew = STTApi.getCrewAvatarBySymbol(props.match.opponent.archetype_symbol);
	let crewOdd = STTApi.getCrewAvatarBySymbol(props.match.crewOdd.archetype_symbol);

	return <div className="ui compact segments" style={{ margin: 'unset' }}>
		<h5 className="ui top attached header" style={{ color: getTheme().palette.neutralDark, backgroundColor: getTheme().palette.themeLighter, textAlign: 'center', padding: '2px' }}>
			vs {props.match.opponent.name} (rank {props.match.opponent.rank})
		</h5>
		<div style={containerStyle} className="ui attached segment">
			<span style={{ gridArea: 'pcrewname', justifySelf: 'center' }}>{crewOdd ? crewOdd.short_name : ''}</span>
			<div style={{ gridArea: 'pcrewimage', position: 'relative' }}>
				<img src={props.match.crewOdd.iconUrl} height={128} />
				<CircularLabel percent={props.match.crewOdd.crit_chance} />
			</div>

			<div style={{ gridArea: 'stats' }}>
				<table style={{ width: '100%' }}>
					<tbody>
						<tr>
							<td style={{ textAlign: 'center', verticalAlign: 'middle' }}>{props.match.crewOdd.min[0]}-{props.match.crewOdd.max[0]}</td>
							<td style={{ textAlign: 'center' }}><img src={CONFIG.SPRITES['icon_' + props.gauntlet.contest_data.primary_skill].url} height={18} /></td>
							<td style={{ textAlign: 'center', verticalAlign: 'middle' }}>{props.match.opponent.min[0]}-{props.match.opponent.max[0]}</td>
						</tr>
						<tr>
							<td style={{ textAlign: 'center', verticalAlign: 'middle' }}>{props.match.crewOdd.min[1]}-{props.match.crewOdd.max[1]}</td>
							<td style={{ textAlign: 'center' }}><img src={CONFIG.SPRITES['icon_' + props.gauntlet.contest_data.secondary_skill].url} height={18} /></td>
							<td style={{ textAlign: 'center', verticalAlign: 'middle' }}>{props.match.opponent.min[1]}-{props.match.opponent.max[1]}</td>
						</tr>
					</tbody>
				</table>
			</div>

			<div style={{ gridArea: 'chance', justifySelf: 'center', alignSelf: 'center' }}>
				<p style={{ fontSize: '1.5rem', fontWeight: 800, margin: '4px', paddingTop: '18px', lineHeight: '1.5em' }}><b>{props.match.chance}%</b> chance</p>
				<p style={{ fontSize: '1.2rem', fontWeight: 700, margin: '4px', lineHeight: '1.2em' }}><b>{props.match.opponent.value}</b> points</p>
			</div>

			<div style={{ gridArea: 'button', justifySelf: 'center', alignSelf: 'center' }}>
			</div>

			<div style={{ gridArea: 'ocrewimage', position: 'relative' }}>
				<img src={props.match.opponent.iconUrl} height={128} />
				<CircularLabel percent={props.match.opponent.crit_chance} />
			</div>

			<span style={{ gridArea: 'ocrewname', justifySelf: 'center' }}>{oppCrew ? oppCrew.short_name : "<unknown>"}</span>
		</div>
		<div className="ui bottom attached primary button" onClick={_playMatch}>Engage!</div>
	</div>;
}

const GauntletStat = (props:{
	windowWidth: number,
	value: number | string,
	label: string,
	classAdd?: string
}) => {
	let classSize = 'small';
	if (props.windowWidth < 800) { classSize = 'tiny'; }
	return <div className={`${props.classAdd ? props.classAdd : ''} ui ${classSize} statistic`}>
		<div className="value" style={{ color: props.classAdd || 'unset' }}>{props.value}</div>
		<div className="label" style={{ color: 'unset' }}>{props.label}</div>
	</div>;
}

export interface GauntletHelperProps {
	onCommandItemsUpdate: (items: ICommandBarItemProps[]) => void;
}

interface GauntletHelperState {
	gauntlet?: GauntletDTO;
	roundOdds?: GauntletRoundOdds;
	traits?: string[];
	lastResult?: GauntletContestDTO;
	lastMatch?: Match;
	startsIn?: string;
	featuredSkill?: string;
	lastErrorMessage?: string;
	rewards?: {loot: GauntletContestLootDTO[]};
	logPath?: string;
	showSpinner: boolean;
	showStats: boolean;
	windowWidth: number;
	windowHeight: number;
	bestFirst?: boolean;
}

export class GauntletHelper extends React.Component<GauntletHelperProps, GauntletHelperState> {
	constructor(props: GauntletHelperProps) {
		super(props);

		this.state = {
			gauntlet: undefined,
			lastResult: undefined,
			lastErrorMessage: undefined,
			rewards: undefined,
			logPath: undefined,
			showSpinner: true,
			showStats: false,
			windowWidth: 0,
			windowHeight: 0
		};

		this._reloadGauntletData = this._reloadGauntletData.bind(this);
		this._gauntletDataRecieved = this._gauntletDataRecieved.bind(this);
		this._payForNewOpponents = this._payForNewOpponents.bind(this);
		this._payToReviveCrew = this._payToReviveCrew.bind(this);
		this._exportLog = this._exportLog.bind(this);
		this._reloadGauntletData();
		this.updateWindowDimensions = this.updateWindowDimensions.bind(this);
	}

	updateWindowDimensions() {
		this.setState({ windowWidth: window.innerWidth, windowHeight: window.innerHeight });
	}

	componentDidMount() {
		this._updateCommandItems();

		this.updateWindowDimensions();
		window.addEventListener('resize', this.updateWindowDimensions);
	}

	componentWillUnmount() {
		window.removeEventListener('resize', this.updateWindowDimensions);
	}

	_updateCommandItems() {
		if (this.props.onCommandItemsUpdate) {
			let commandItems: ICommandBarItemProps[] = [];
			if (this.state.logPath) {
				commandItems.push({
					key: 'exportCsv',
					name: 'Export log...',
					iconProps: { iconName: 'ExcelDocument' },
					onClick: (evt:any) => this._exportLog()
				});
			}

			commandItems.push({
				key: 'settings',
				text: 'Settings',
				iconProps: { iconName: 'Equalizer' },
				subMenuProps: {
					items: [{
						key: 'bestFirst',
						text: 'Best match first',
						canCheck: true,
						isChecked: this.state.bestFirst,
						onClick: () => {
							let isChecked = !this.state.bestFirst;
							this.setState({
								bestFirst: isChecked
							}, () => { this._updateCommandItems(); });
						}
					},{
						key: 'showStats',
						text: 'Show crew stats in top row',
						canCheck: true,
						isChecked: this.state.showStats,
						onClick: () => {
							this.setState({ showStats: !this.state.showStats }, () => { this._updateCommandItems(); });
						}
					}]
				}
			});

			this.props.onCommandItemsUpdate(commandItems);
		}
	}

	_reloadGauntletData() {
		loadGauntlet().then((data: GauntletDTO) => this._gauntletDataRecieved({ gauntlet: data }));
	}

	_payForNewOpponents() {
		if (!this.state.gauntlet) {
			return;
		}
		payToGetNewOpponents().then((data) => {
			if (data.gauntlet) {
				this._gauntletDataRecieved({gauntlet: data.gauntlet});
			} else if (data.message) {
				this.setState({
					lastErrorMessage: data.message
				});
			}
		});
	}

	_payToReviveCrew(crew_id: number, save: boolean) : void {
		if (!this.state.gauntlet) {
			return;
		}
		payToReviveCrew(crew_id, save).then((data) => this._gauntletDataRecieved({gauntlet:data}));
	}

	_gauntletDataRecieved(data: GauntletData, logPath : string | undefined = undefined, match : Match | undefined = undefined) {
		if (!data.gauntlet) {
			return;
		}

		if (data.gauntlet.state == 'NONE') {
			this.setState({
				gauntlet: data.gauntlet,
				lastErrorMessage: undefined,
				lastResult: undefined,
				startsIn: formatTimeSeconds(data.gauntlet.seconds_to_join),
				featuredSkill: data.gauntlet.contest_data.featured_skill,
				traits: data.gauntlet.contest_data.traits.map(function (trait:string) { return STTApi.getTraitName(trait); }.bind(this))
			});
		}
		else if (data.gauntlet.state == 'STARTED') {
			// TODO: make this a configuration option (lower value will make gauntlet refresh faster, but percentage will be less accurate)
			let simulatedRounds = 20000;
			var result = gauntletRoundOdds(data.gauntlet, simulatedRounds);
			this.setState({
				gauntlet: data.gauntlet,
				roundOdds: result
			});

			let iconPromises : Promise<void>[] = [];

			data.gauntlet.contest_data.selected_crew.forEach((crew) => {
				let avatar = STTApi.getCrewAvatarBySymbol(crew.archetype_symbol);
				const cid = crew.crew_id;
				iconPromises.push(
					STTApi.imageProvider.getCrewImageUrl(avatar!, true).then(({ id, url }) => {
						data.gauntlet.contest_data.selected_crew.forEach((crew) => {
							if (crew.crew_id === cid) {
								crew.iconUrl = url;
							}
						});
						return Promise.resolve();
					}).catch((error) => { /*console.warn(error);*/ }));
			});

			result.matches.forEach((match) => {
				let avatar = STTApi.getCrewAvatarBySymbol(match.crewOdd.archetype_symbol);
				let avatarOpp = STTApi.getCrewAvatarBySymbol(match.opponent.archetype_symbol);
				const cidOdd = match.crewOdd.crew_id;
				const cidOpp = match.opponent.crew_id;
				iconPromises.push(
					STTApi.imageProvider.getCrewImageUrl(avatar!, true).then(({ id, url }) => {
						if (this.state.roundOdds) {
							this.state.roundOdds.matches.forEach((match) => {
								if (match.crewOdd.crew_id === cidOdd) {
									match.crewOdd.iconUrl = url;
								}
							});
						}
						return Promise.resolve();
					}).catch((error) => { /*console.warn(error);*/ }));

				iconPromises.push(
					STTApi.imageProvider.getCrewImageUrl(avatarOpp!, true).then(({ id, url }) => {
						if (this.state.roundOdds) {
							this.state.roundOdds.matches.forEach((match) => {
								if (match.opponent.crew_id === cidOpp) {
									match.opponent.iconUrl = url;
								}
							});
						}
						return Promise.resolve();
					}).catch((error) => { /*console.warn(error);*/ }));
			});

			Promise.all(iconPromises).then(() => this.forceUpdate());
		}
		else if (data.gauntlet.state == 'UNSTARTED') {
			// You joined a gauntled and are waiting for opponents
		}
		else if (data.gauntlet.state == 'ENDED_WITH_REWARDS') {
			// The gauntlet ended and you got some rewards
		}
		else {
			this.setState({
				gauntlet: data.gauntlet
			});
		}

		if (data.lastResult) {
			if (data.rewards && data.rewards.loot) {
				let iconPromises: any[] = [];
				data.rewards.loot.forEach((reward) => {
					reward.iconUrl = '';
					if (reward.type === 1) { // crew
						iconPromises.push(STTApi.imageProvider.getCrewImageUrl(reward as CrewImageData, false)
							.then(found => {
								reward.iconUrl = found.url;
								this.forceUpdate();
							})
							.catch(error => {
								/*console.warn(error);*/
							})
						);
					} else {
						iconPromises.push(
							STTApi.imageProvider
								.getItemImageUrl(reward, reward.id)
								.then(found => {
									reward.iconUrl = found.url;
									this.forceUpdate();
								})
								.catch(error => {
									/*console.warn(error);*/
								})
						);
					}
				});

				//Promise.all(iconPromises).then(() => this.forceUpdate());
			}

			this.setState({
				lastResult: data.lastResult,
				lastMatch: match,
				rewards: data.rewards
			});
		}

		// #!if ENV === 'electron'
		if (!logPath && data.gauntlet) {
			logPath = Logger.hasGauntletLog(data.gauntlet.gauntlet_id);
		}
		// #!endif

		this.setState({ logPath: logPath, showSpinner: false }, () => { this._updateCommandItems(); });
	}

	render() {
		if (this.state.showSpinner) {
			return <div className="centeredVerticalAndHorizontal">
				<div className="ui massive centered text active inline loader">Loading gauntlet details...</div>
			</div>;
		}

		if (this.state.gauntlet && (this.state.gauntlet.state == 'NONE')) {
			return <GauntletSelectCrew
				gauntlet={this.state.gauntlet}
				startsIn={this.state.startsIn}
				featuredSkill={this.state.featuredSkill!}
				traits={this.state.traits}
				gauntletLoaded={this._gauntletDataRecieved}
			/>;
		}
		if (this.state.gauntlet && (this.state.gauntlet.state == 'ENDED_WITH_REWARDS')) {
			return <div>
				<h3>Gauntlet ended, your final rank was <b>{this.state.gauntlet.rank}</b>. Use game client to claim rewards.</h3>
				<p>Note: you won't see the rewards here, you'll go straight to crew selection. Claim rewards in the game client to see them!</p>
			</div>;
		}

		if (this.state.gauntlet && ((this.state.gauntlet.state == 'STARTED') && this.state.roundOdds)) {
			let playerCrew, opponentCrew, playerRoll = 0, opponentRoll = 0, playerRollMsg = [], opponentRollMsg = [];
			let playerCritPct = 0, opponentCritPct = 0;

			if (this.state.lastResult && this.state.lastMatch) {
				let crewAva = STTApi.getCrewAvatarBySymbol(this.state.lastMatch.crewOdd.archetype_symbol);
				playerCrew = crewAva ? crewAva.name : undefined;
				let oppAva = STTApi.getCrewAvatarBySymbol(this.state.lastMatch.opponent.archetype_symbol);
				opponentCrew = oppAva ? oppAva.name : undefined;

				playerRoll = this.state.lastResult.player_rolls.reduce((sum: number, value: number) => sum + value, 0);
				opponentRoll = this.state.lastResult.opponent_rolls.reduce((sum: number, value: number) => sum + value, 0);
				playerCritPct = this.state.lastResult.player_crit_rolls.reduce((sum: number, value: boolean) => sum + (value ? 1 : 0), 0) / 6;
				opponentCritPct = this.state.lastResult.opponent_crit_rolls.reduce((sum: number, value: boolean) => sum + (value ? 1 : 0), 0) / 6;
				playerCritPct = Math.floor(playerCritPct * 100);
				opponentCritPct = Math.floor(opponentCritPct * 100);

				for (let i = 0; i < 6; i++) {
					playerRollMsg.push(`${this.state.lastResult.player_rolls[i]}${this.state.lastResult.player_crit_rolls[i] ? '*' : ''}`);
					opponentRollMsg.push(`${this.state.lastResult.opponent_rolls[i]}${this.state.lastResult.opponent_crit_rolls[i] ? '*' : ''}`);
				}
			}

			let matches = this.state.roundOdds.matches;
			let sortCrit = (match:Match) => match.chance;
			if (this.state.bestFirst) {
				sortCrit = (match:Match) => (match.chance > 0) ? (match.chance + match.opponent.value / 4.5) : 0;
			}
			matches.sort((a, b) => sortCrit(b) - sortCrit(a));

			let consecutiveWins = this.state.roundOdds.consecutive_wins;

			const gaunt = this.state.gauntlet;
			const rewards = this.state.rewards;

			const containerStyleLast = {
				padding: '3px',
				backgroundColor: getTheme().palette.themeLighter,
				display: 'grid',
				gridTemplateColumns: '100px auto auto 100px',
				gridTemplateRows: '20px 150px 50px',
				gridTemplateAreas: `
					"pcrewname pcrewname ocrewname ocrewname"
					"pcrewimage stats stats ocrewimage"
					"pcrewimage chance chance ocrewimage"`};

			const stEm = { textAlign: 'center', verticalAlign: 'middle', fontSize: '1.2rem', fontWeight: 700, lineHeight: '1.2em' };
			const stNorm = { textAlign: 'center', verticalAlign: 'middle' };

			return (
				<div className='tab-panel' data-is-scrollable='true'>
					<span className='quest-mastery'>Featured skill is <img src={CONFIG.SPRITES['icon_' + this.state.gauntlet.contest_data.featured_skill].url} height={18}
					/> {CONFIG.SKILLS[this.state.gauntlet.contest_data.featured_skill]}; Featured traits are {
						this.state.gauntlet.contest_data.traits.map((trait:string) => STTApi.getTraitName(trait)).join(", ")}</span>
					<div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)' }} >
						{this.state.gauntlet.contest_data.selected_crew.map((crew) => <GauntletCrew
							showStats={this.state.showStats}
							maxwidth={this.state.windowWidth / 6}
							key={crew.crew_id}
							crew={crew}
							revive={(save) => this._payToReviveCrew(crew.crew_id, save)}
							reviveCost={gaunt.revive_cost}
							/>)}
					</div>

					{this.state.lastErrorMessage && <p>Error: '{this.state.lastErrorMessage}'</p>}

					<div className="ui compact segments" style={{ margin: '8px' }}>
						<div style={{display: 'flex', flexDirection: 'row'}}>
							<div className="ui attached statistic" style={{ marginBottom: '0em', paddingBottom:'1em', width:'300px', backgroundColor: getTheme().palette.themeLighter }}>
								<h5 className="ui top attached header" style={{ color: getTheme().palette.neutralDark, backgroundColor: getTheme().palette.themeLighter, textAlign: 'center', padding: '2px' }}>
									The gauntlet ends in {formatTimeSeconds(this.state.gauntlet.seconds_to_end)}
								</h5>
								<GauntletStat windowWidth={this.state.windowWidth} label='Crew refresh' value={formatTimeSeconds(this.state.gauntlet.seconds_to_next_crew_refresh)} />
								<GauntletStat windowWidth={this.state.windowWidth} label='Your rank' value={this.state.roundOdds.rank} />
								<GauntletStat windowWidth={this.state.windowWidth} label='Consecutive wins' value={this.state.roundOdds.consecutive_wins} />
								<GauntletStat windowWidth={this.state.windowWidth} label='Merits' value={STTApi.playerData.premium_earnable} />
								{this.state.lastResult &&
									<GauntletStat windowWidth={this.state.windowWidth} label='Last round' value={((this.state.lastResult.win === true) ? 'WON' : 'LOST')} classAdd={(this.state.lastResult.win === true) ? 'green' : 'red'}/>}
							</div>
							{this.state.lastResult && this.state.lastMatch && <div className="ui attached segment"
								style={{ display: 'flex', flexFlow: 'row nowrap', backgroundColor: getTheme().palette.themeLighterAlt }}>
								<div style={containerStyleLast} className="ui attached segment">
									<span style={{ gridArea: 'pcrewname', justifySelf: 'center' }}>Your <b>{playerCrew}</b></span>
									<div style={{ gridArea: 'pcrewimage', position: 'relative' }}>
										<img src={this.state.lastMatch.crewOdd.iconUrl} height={128} />
										<CircularLabel percent={this.state.lastMatch.crewOdd.crit_chance} />
									</div>

									<div style={{ gridArea: 'stats' }}>
										<table style={{ width: '100%' }}>
											<tbody>
												{[...Array(6).keys()].map(i =>
												{
													let stP = this.state.lastResult!.player_crit_rolls[i] ? stEm : stNorm;
													let stO = this.state.lastResult!.opponent_crit_rolls[i] ? stEm : stNorm;

													return <tr key={i}><td style={stP as any}>{this.state.lastResult!.player_rolls[i]}</td>
														<td style={stO as any}>{this.state.lastResult!.opponent_rolls[i]}</td></tr>; })
												}
												<tr><td style={ (playerRoll > opponentRoll ? stEm : stNorm) as any}>Score: {playerRoll}</td>
													<td style={ (playerRoll < opponentRoll ? stEm : stNorm) as any}>Score: {opponentRoll}</td></tr>
												<tr><td style={ stNorm as any }>Actual Crit: {playerCritPct}%</td>
													<td style={ stNorm as any }>Actual Crit: {opponentCritPct}%</td></tr>
											</tbody>
										</table>
									</div>

									<div style={{ gridArea: 'ocrewimage', position: 'relative' }}>
										<img src={this.state.lastMatch.opponent.iconUrl} height={128} />
										<CircularLabel percent={this.state.lastMatch.opponent.crit_chance} />
									</div>

									<span style={{ gridArea: 'ocrewname', justifySelf: 'center' }}><i>{this.state.lastMatch.opponent.name}</i>'s <b>{opponentCrew}</b></span>
								</div>

								<div style={{ marginLeft: '15px' }}><p>Match success chance: <b>{this.state.lastMatch.chance}%</b></p>
								<p>You got <b>{this.state.lastResult.value} points</b>.</p>
									{rewards &&
										<div>
											Rewards:
											<div>
											{rewards.loot.map((loot, index) =>
												<span key={index} style={{ color: loot.rarity ? CONFIG.RARITIES[loot.rarity].color : '#000' }}
												><img src={loot.iconUrl || ''} width='50' height='50' /><br/>{loot.quantity} {(loot.rarity == null) ? '' : CONFIG.RARITIES[loot.rarity].name} {loot.full_name}
													{index < rewards.loot.length - 1 ? ', ' : ''}</span>
											)}
											</div>
										</div>
									}
								</div>
							</div>}
						</div>
						<div className="ui two bottom attached buttons">
							<div className={'ui primary button' + ((this.state.roundOdds.matches.length > 0) ? '' : ' disabled')} onClick={this._payForNewOpponents}>
								<i className="money bill alternate outline icon"></i>
								New opponents (50 merit)
							</div>
							<div className="ui button" onClick={this._reloadGauntletData}>
								<i className="retweet icon"></i>
								Reload data
							</div>
						</div>
					</div>

					<br />

					<div style={{ display: 'grid', gridGap: '10px', margin: '8px', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
						{matches.map((match) =>
							<GauntletMatch key={match.crewOdd.archetype_symbol + match.opponent.player_id}
								match={match}
								gauntlet={gaunt}
								consecutive_wins={consecutiveWins}
								onNewData={this._gauntletDataRecieved} />
						)}
					</div>
				</div>
			);
		}
		else {
			return (<MessageBar messageBarType={MessageBarType.error} >Unknown state for this gauntlet! Check the app, perhaps it's waiting to join or already done.</MessageBar>);
		}
	}

	_exportLog() {
		if (!this.state.gauntlet) {
			return;
		}
		// #!if ENV === 'electron'
		let gid = this.state.gauntlet.gauntlet_id;
		Logger.exportGauntletLog(gid).then(csv => {
			download(`gauntlet_${gid}.csv`, csv, 'Export gauntlet log', 'Export');
		});
		// #!endif
	}
}

const GauntletSelectCrew = (props: {
	gauntlet: GauntletDTO;
	startsIn?: string;
	featuredSkill: string;
	traits?: string[];
	gauntletLoaded: (data: { gauntlet: GauntletDTO}) => void;
}) => {
	const [crewSelection, setCrewSelection] = React.useState(undefined as unknown as number[]);
	const [calculating, setCalculating] = React.useState(false);
	const [includeFrozen, setIncludeFrozen] = React.useState(false);
	// Recommendation calculation settings
	const [featuredSkillBonus, setFeaturedSkillBonus] = React.useState(10);
	const [critBonusDivider, setCritBonusDivider] = React.useState(3);

	const renderBestCrew = () => {
		if (!crewSelection) {
			return <span />;
		}

		let crewSpans: any[] = [];
		crewSelection.forEach(id => {
			let crew = STTApi.roster.find(crew => (crew.crew_id === id) || (crew.id === id));
			if (!crew) {
				return;
			}

			let crewSpan = <Persona
				key={crew.name}
				imageUrl={crew.iconUrl}
				text={crew.name}
				secondaryText={crew.short_name}
				tertiaryText={formatCrewStatsVoy(crew)}
				size={PersonaSize.large}
				presence={(crew.frozen === 0) ? PersonaPresence.online : PersonaPresence.away} />

			crewSpans.push(crewSpan);
		});

		return (<div>
			<h3>Best crew</h3>
			{calculating && <div className="ui medium centered text active inline loader">Still calculating...</div>}
			<div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap' }}>
				{crewSpans}
			</div>
		</div>);
	}

	const _calculateSelection = () => {
		if (!props.gauntlet) {
			return;
		}
		setCalculating(true);
		var result = gauntletCrewSelection(props.gauntlet, STTApi.roster, (100 + featuredSkillBonus) / 100, critBonusDivider, 5 /*preSortCount*/, includeFrozen);
		setCrewSelection(result.recommendations);
		setCalculating(false);
	}

	const _startGauntlet = () => {
		if (props.gauntlet && props.gauntlet.gauntlet_id && crewSelection) {

			let crew_ids: number[] = [];
			crewSelection.forEach(id => {
				let crew = STTApi.roster.find(crew => (crew.crew_id === id));
				if (!crew) {
					console.error(`Crew ${id} not found; are you trying to start a gauntlet with frozen crew?`);
					return;
				}

				crew_ids.push(crew.id);
			});

			if (crew_ids.length === 5) {
				enterGauntlet(props.gauntlet.gauntlet_id, crew_ids).then((data) => props.gauntletLoaded({ gauntlet: data }));
			}
		}
	}

	return (
		<div>
			<Label>Next gauntlet starts in {props.startsIn}.</Label>
			{props.featuredSkill &&
				<span className='quest-mastery'>Featured skill: <img src={CONFIG.SPRITES['icon_' + props.featuredSkill].url} height={18} /> {CONFIG.SKILLS[props.featuredSkill]}</span>
			}
			<Label>Featured traits: {props.traits && props.traits.join(', ')}</Label>

			{renderBestCrew()}

			<div className="ui grid" style={{ maxWidth: '600px' }}>
				<div className="row">
					<div className="column"><h4>Algorithm settings</h4></div>
				</div>

				<div className="two column row">
					<div className="column">
						<SpinButton value='{this.state.featuredSkillBonus}' label='Featured skill bonus:' min={0} max={100} step={1}
							onIncrement={(value) => { setFeaturedSkillBonus(+value + 1); }}
							onDecrement={(value) => { setFeaturedSkillBonus(+value - 1); }}
							onValidate={(value: string) => {
								if (isNaN(+value)) {
									setFeaturedSkillBonus(10);
									return '10';
								}

								return value;
							}}
						/>
					</div>
					<div className="column">
						The higher this number, the more bias applied towards the featured skill during crew selection
							</div>
				</div>

				<div className="two column row">
					<div className="column">
						<SpinButton value='{this.state.critBonusDivider}' label='Crit bonus divider:' min={0.1} max={100} step={0.1}
							onIncrement={(value) => { setCritBonusDivider(+value + 0.1); }}
							onDecrement={(value) => { setCritBonusDivider(+value - 0.1); }}
							onValidate={(value: string) => {
								if (isNaN(+value)) {
									setCritBonusDivider(3);
									return '3';
								}

								return value;
							}}
						/>
					</div>
					<div className="column">
						The lower this number, the more bias applied towards crew with higher crit bonus rating during selection
							</div>
				</div>

				<div className="row">
					<div className="column">
						<Checkbox checked={includeFrozen} label="Include frozen crew"
							onChange={(e, isChecked) => { setIncludeFrozen(isChecked || false ); }}
						/>
					</div>
				</div>
			</div>

			<br />

			<div style={{ display: 'grid', gridGap: '5px', width: 'fit-content', gridTemplateColumns: 'max-content max-content' }}>
				<div className={"ui primary button" + (calculating ? ' disabled' : '')} onClick={_calculateSelection}>Calculate best crew selection</div>
				<div className={"ui primary button" + (!crewSelection ? ' disabled' : '')} onClick={_startGauntlet}>Start gauntlet with recommendations</div>
			</div>
		</div>
	);
}
