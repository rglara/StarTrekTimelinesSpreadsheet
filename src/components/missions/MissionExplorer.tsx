import React from 'react';

import { ICommandBarItemProps } from 'office-ui-fabric-react/lib/CommandBar';
import { Dropdown, DropdownMenuItemType, IDropdownOption } from 'office-ui-fabric-react/lib/Dropdown';

import STTApi from '../../api';

import { MissionDetails } from './MissionDetails';
import { ItemGroup } from 'semantic-ui-react';

interface MissionExplorerProps {
	onCommandItemsUpdate?: (items: ICommandBarItemProps[]) => void;
}

interface MissionExplorerState {
	dataAvailable: boolean;
	selectedItem?: MissionOptions;
	onlyIncomplete: boolean;
	options: MissionOptions[];
}

interface MissionOptions {
	key: string;
	text: string;
	data?: {
		mission: string;
		questId: number;
	};
	itemType?: number;
}

export class MissionExplorer extends React.Component<MissionExplorerProps, MissionExplorerState> {
	missionDetailsRef: React.RefObject<MissionDetails>;

	constructor(props: MissionExplorerProps) {
		super(props);

		this.loadOptions = this.loadOptions.bind(this);
		this.missionDetailsRef = React.createRef<MissionDetails>();

		this.state = {
			dataAvailable: true,
			selectedItem: undefined,
			onlyIncomplete: false,
			options: this.loadOptions(false)
		};
	}

	componentDidMount() {
		this._updateCommandItems();
	}

	_updateCommandItems() {
		if (this.props.onCommandItemsUpdate) {
			this.props.onCommandItemsUpdate([{
				key: 'settings',
				text: 'Settings',
				iconProps: { iconName: 'Equalizer' },
				subMenuProps: {
					items: [{
						key: 'onlyIncomplete',
						text: 'Show only unfinished missions',
						canCheck: true,
						isChecked: this.state.onlyIncomplete,
						onClick: () => {
							let isChecked = !this.state.onlyIncomplete;
							this.setState({
								options: this.loadOptions(isChecked),
								onlyIncomplete: isChecked
							}, () => { this._updateCommandItems(); });
						}
					}]
				}
			}]);
		}
	}

	loadOptions(onlyIncomplete: boolean) : MissionOptions[] {
		let options: MissionOptions[] = [];
		STTApi.missions.forEach((mission) => {
			if (mission.quests.length == 0) return;
			if (onlyIncomplete && (mission.stars_earned == mission.total_stars)) return;

			var missionLabel = (mission.quests[0].cadet ? 'CADET - ' : '') + mission.episode_title;
			missionLabel += ' (' + mission.stars_earned + ' / ' + mission.total_stars + ')';

			options.push({ key: mission.episode_title + mission.id, text: missionLabel, itemType: DropdownMenuItemType.Header });
			var any = false;
			mission.quests.forEach((quest) => {
				if (quest.quest_type == 'ConflictQuest') {
					if (onlyIncomplete) {
						let goals = quest.mastery_levels[0].progress.goals + quest.mastery_levels[1].progress.goals + quest.mastery_levels[2].progress.goals;
						let goal_progress = quest.mastery_levels[0].progress.goal_progress + quest.mastery_levels[1].progress.goal_progress + quest.mastery_levels[2].progress.goal_progress;
						if (goals == goal_progress) return;
					}

					options.push({ key: quest.name + quest.id, text: quest.name, data: { mission: mission.episode_title, questId: quest.id } });
					any = true;
				}
			});

			if (!any) {
				options.pop();
			}
		});

		return options;
	}

	_onRenderTitle(options?: IDropdownOption[]): JSX.Element {
		if (options && options.length > 1) {
			let option = options[0];
			return (<div>
				<span><b>{option.data.mission} : </b></span>
				<span>{option.text}</span>
			</div>);
		}
		return (<div></div>);
	}

	render() {
		if (this.state.dataAvailable)
			return (
				<div className='tab-panel' data-is-scrollable='true'>
					<p><b>Note: </b>These calculations only search crew necessary for completing the missions with the epic mastery.</p>
					<Dropdown
						selectedKey={this.state.selectedItem && this.state.selectedItem.key}
						onChange={(evt, item) => {
							this.setState({ selectedItem: item as MissionOptions });
							if (this.missionDetailsRef.current && item && item.data) {
								this.missionDetailsRef.current.loadMissionDetails(item.data.questId);
							}
						}}
						onRenderTitle={this._onRenderTitle}
						placeholder='Select a mission'
						options={this.state.options}
					/>
					<MissionDetails questId={this.state.selectedItem} ref={this.missionDetailsRef} />
				</div>
			);
		else {
			return <div className="centeredVerticalAndHorizontal">
				<div className="ui huge centered text active inline loader">Loading mission and quest data...</div>
			</div>;
		}
	}
}
