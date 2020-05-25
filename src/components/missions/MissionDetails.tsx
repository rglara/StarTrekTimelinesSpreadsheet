import React from 'react';

import { IDropdownOption } from 'office-ui-fabric-react/lib/Dropdown';
import { Image } from 'office-ui-fabric-react/lib/Image';
import { Persona, PersonaSize, PersonaPresence } from 'office-ui-fabric-react/lib/Persona';
import { getTheme } from '@uifabric/styling';

import STTApi, { CONFIG, calculateQuestRecommendations, IQuestRecommendations } from '../../api';
import { MissionDisplay } from '../../utils/canvasutils';
import { MissionQuestChallengeDTO } from '../../api/DTO';

interface MissionDetailsProps {
	questId?: IDropdownOption;
}

interface MissionDetailsState extends IQuestRecommendations {
	selectedChallenge?: number;
}

export class MissionDetails extends React.Component<MissionDetailsProps, MissionDetailsState> {
	missionDisplay: MissionDisplay | undefined;

	constructor(props: MissionDetailsProps) {
		super(props);

		this.loadMissionDetails = this.loadMissionDetails.bind(this);
		this.loadMissionDetailsInternal = this.loadMissionDetailsInternal.bind(this);
		this.updateGraph = this.updateGraph.bind(this);

		if (!this.props.questId) {
			this.state = {
				mission: undefined,
				bestCrewPaths: undefined,
				allFinished: false,
				selectedChallenge: undefined,
			};
		}
		else {
			this.state = this.loadMissionDetailsInternal(this.props.questId.data.questId);
		}
	}

	componentDidUpdate(_prevProps: MissionDetailsProps, prevState: MissionDetailsState) {
		if (this.state.mission !== prevState.mission) {
			this.updateGraph();
		}
	}

	loadMissionDetails(questId: number) {
		this.setState(this.loadMissionDetailsInternal(questId));
	}

	loadMissionDetailsInternal(questId: number): IQuestRecommendations {
		return calculateQuestRecommendations(questId, false);
	}

	updateGraph() {
		if (!this.refs.canvasMission)
			return;

		let mission = this.state.mission;
		if (mission) {
			let maxX = 1;
			let maxY = 1;
			mission.challenges.forEach(challenge => {
				maxX = Math.max(challenge.grid_x, maxX);
				maxY = Math.max(challenge.grid_y, maxY);
			});

			maxX++; maxY++;

			if (this.missionDisplay) {
				this.missionDisplay.reset(maxX, maxY);
			} else {
				this.missionDisplay = new MissionDisplay(
					this.refs.canvasMission, maxX, maxY,
					(id: number) => this.setState({ selectedChallenge: id })
				);
			}

			let nodes = [];
			let edges = [];
			mission.challenges.forEach(challenge => {
				let color = getTheme().palette.themeDark;
				if (challenge.critical) {
					if (!challenge.critical.claimed) {
						color = 'red';
					}
				}

				nodes.push({ id: challenge.id, label: '(' + challenge.id + ') ' + challenge.name, level: challenge.grid_x, image: CONFIG.SPRITES['icon_' + challenge.skill].url, shape: 'image', font: { color: color } });
				if (challenge.children) {
					challenge.children.forEach(child => {
						edges.push({ from: challenge.id, to: child });
					});
				}

				if (this.missionDisplay) {
					this.missionDisplay.addNode(challenge.grid_x, challenge.grid_y, challenge.skill, challenge.critical && !challenge.critical.claimed, challenge.children, challenge.id, challenge.name);
				}
			});
		}
	}

	renderChallengeDetails() {
		let challenge: MissionQuestChallengeDTO | undefined;
		let mission = this.state.mission;
		if (mission) {
			mission.challenges.forEach(item => {
				if (item.id == this.state.selectedChallenge) {
					challenge = item;
				}
			});
		}

		if (!challenge) {
			return <span />;
		}

		var traitBonuses: JSX.Element[] = [];
		challenge.trait_bonuses.map((traitBonus) => {
			traitBonuses.push(<span key={traitBonus.trait}>{STTApi.getTraitName(traitBonus.trait)}</span>);
		});

		var lockTraits: JSX.Element[] = [];
		challenge.locks.map((lock) => {
			if (lock.trait) {
				lockTraits.push(<span key={lock.trait}>{STTApi.getTraitName(lock.trait)}</span>);
			}
			else {
				const foundItem = mission!.challenges.find(item => item.id == lock.success_on_node_id);
				lockTraits.push(<span key={lock.success_on_node_id}>Success on {foundItem ? foundItem.name : '[Unknown]'}</span>);
			}
		});

		let critical = <span />;
		if (challenge.critical) {
			if (!challenge.critical.claimed) {
				critical = <p>Critical reward: {challenge.critical.reward[0].full_name}</p>;
			}
		}

		let recommendations = STTApi.missionSuccess.find(missionSuccess => (missionSuccess.quest.id == mission!.id) && (missionSuccess.challenge.id == challenge!.id));
		let crewSuccess: JSX.Element[] = [];
		if (recommendations) {
			recommendations.crew.forEach(item => {
				crewSuccess.push(<Persona
					key={item.crew.name}
					imageUrl={item.crew.iconUrl}
					text={item.crew.name}
					secondaryText={item.success.toFixed(2) + '%'}
					showSecondaryText={true}
					size={PersonaSize.small}
					presence={(item.success >= 99.9) ? PersonaPresence.online : ((item.success > 50) ? PersonaPresence.away : PersonaPresence.busy)} />);
			});
		}

		return (<div>
			<h4>{challenge.name}</h4>
			<span className='quest-mastery'>
				Skill: <Image src={CONFIG.SPRITES['icon_' + challenge.skill].url} height={18} /> {CONFIG.SKILLS[challenge.skill]}
			</span>
			<p>Trait bonuses: {(traitBonuses.length > 0) ? traitBonuses.reduce(
				(prev, curr) => prev === undefined ? curr : <>{prev}, {curr}</>) : 'none'}</p>
			<p>Locks: {(lockTraits.length > 0) ? lockTraits.reduce(
				(prev, curr) => prev === undefined ? curr : <>{prev}, {curr}</>) : 'none'}</p>
			{critical}
			<div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap' }}>
				{crewSuccess}
			</div>
			{(recommendations === undefined || recommendations.crew.length === 0) && <span style={{ color: 'red' }}>You have no crew capable of completing this node!</span>}
		</div>);
	}

	htmlDecode(input: string) {
		let output = input.replace(/<#([0-9A-F]{6})>/gi, '<span style="color:#$1">');
		output = output.replace(/<\/color>/g, '</span>');

		return { __html: output };
	}

	render() {
		if (!this.state.mission) {
			return <span />;
		}

		var crewSelectionLog;
		if (this.state.bestCrewPaths?.length == 0) {
			if (this.state.allFinished) {
				crewSelectionLog = <span>You already completed all nodes on this mission. Congrats!</span>;
			} else {
				crewSelectionLog = <span style={{ color: 'red' }}>There is no crew selection capable of completing this mission. Get more crew!</span>;
			}
		}
		else {
			crewSelectionLog = [];
			this.state.bestCrewPaths?.forEach((crewpath, indexcrewpath) => {
				let crewSuccess: JSX.Element[] = [];
				crewpath.crew.forEach((crewpathcrew, index) => {
					crewSuccess.push(<Persona
						key={crewpathcrew.crew.name + index}
						imageUrl={crewpathcrew.crew.iconUrl}
						text={`(${crewpath.path[index]}) ${crewpathcrew.crew.name}${(crewpathcrew.crew.frozen > 0) ? ' - FROZEN' : ''}`}
						size={PersonaSize.extraExtraSmall}
						presence={PersonaPresence.none} />);
				});

				crewSelectionLog.push(
					<div key={indexcrewpath} style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap' }}>
						<span>{(crewpath.success).toFixed(2)}% guaranteed success:</span>
						{crewSuccess}
					</div>
				);
			});
		}

		return (
			<div className='mission-info'>
				<div className='mission-details'>
					<h3>{this.state.mission.name}</h3>
					<p>{this.state.mission.description}</p>
					<div className='mission-matrix'>
						<div></div>
						<div className='mm-data'><Image src={CONFIG.MASTERY_LEVELS[0].url()} height={24} /></div>
						<div className='mm-data'><Image src={CONFIG.MASTERY_LEVELS[1].url()} height={24} /></div>
						<div className='mm-data'><Image src={CONFIG.MASTERY_LEVELS[2].url()} height={24} /></div>
						<div className='mm-label'>Mastery Required:</div>
						<div className='mm-data'>{(this.state.mission.difficulty_by_mastery) && this.state.mission.difficulty_by_mastery[0]}</div>
						<div className='mm-data'>{(this.state.mission.difficulty_by_mastery) && this.state.mission.difficulty_by_mastery[1]}</div>
						<div className='mm-data'>{(this.state.mission.difficulty_by_mastery) && this.state.mission.difficulty_by_mastery[2]}</div>
						<div className='mm-label'>Trait Bonuses:</div>
						<div className='mm-data'>{(this.state.mission.trait_bonuses) && this.state.mission.trait_bonuses[0]}</div>
						<div className='mm-data'>{(this.state.mission.trait_bonuses) && this.state.mission.trait_bonuses[1]}</div>
						<div className='mm-data'>{(this.state.mission.trait_bonuses) && this.state.mission.trait_bonuses[2]}</div>
						<div className='mm-label'>Completed:</div>
						<div className='mm-data'>{this.state.mission.mastery_levels[0].progress.goal_progress} / {this.state.mission.mastery_levels[0].progress.goals}</div>
						<div className='mm-data'>{this.state.mission.mastery_levels[1].progress.goal_progress} / {this.state.mission.mastery_levels[1].progress.goals}</div>
						<div className='mm-data'>{this.state.mission.mastery_levels[2].progress.goal_progress} / {this.state.mission.mastery_levels[2].progress.goals}</div>
						<div className='mm-divider'><hr/></div>
						<div className='mm-label'>Critical Threshold:</div>
						<div className='mm-note'>{this.state.mission.critical_threshold ? this.state.mission.critical_threshold : 'none'}</div>
						{this.state.mission.cadet && (<div className='mm-label'>Cadet Requirements:</div>)}
						{this.state.mission.cadet && (<div className='mm-note'>
							<span dangerouslySetInnerHTML={this.htmlDecode(this.state.mission!.crew_requirement!.description)} />
						</div>)}
					</div>
				</div>
				<div className='mission-graph'>
					<canvas
						ref='canvasMission'
						width={1000}
						height={450}
						style={{ width: '100%', height: 'auto' }}
					/>
				</div>
				<div className='mission-calc'>
					{crewSelectionLog}
					{(this.state.selectedChallenge != undefined) && this.renderChallengeDetails()}
				</div>
			</div>
		);
	}
}
