import React from 'react';
import ReactTable, { SortingRule, Column } from 'react-table';

import { ItemDisplay } from './ItemDisplay';
import { RarityStars } from './RarityStars';
import STTApi, { CONFIG } from '../api';
import { PotentialRewardDTO, RewardDTO, ItemDTO, ItemArchetypeDTO } from '../api/STTApi';
import { ReplicatorDialog } from './ReplicatorDialog';

export interface ItemListProps {
	data: ItemDTO[];
	filterText?: string;
}

export interface ItemListState {
	columns: Column<ItemDTO>[];
	items: ItemDTO[];
	sorted: SortingRule[];
	//FIXME: can't open the same item twice, so need to add and handle onClose for the dialog
	replicatorTarget?: ItemArchetypeDTO;
	//const[replicatorTarget, setReplicatorTarget] = React.useState(undefined as ItemArchetypeDTO | undefined);
}

export class ItemList extends React.Component<ItemListProps, ItemListState> {
	constructor(props: ItemListProps) {
		super(props);

		let rewardItemIds = new Map<string, Set<number>>();
		const scanRewards = (name: string, potential_rewards: (PotentialRewardDTO | RewardDTO)[]) => {
			potential_rewards.forEach(reward => {
				if ((reward as PotentialRewardDTO).potential_rewards) {
					scanRewards(name, (reward as PotentialRewardDTO).potential_rewards);
				} else if (reward.type === 2) {
					rewardItemIds.get(name)!.add((reward as RewardDTO).id);
				}
			});
		};

		STTApi.playerData.character.factions.forEach(f => {
			rewardItemIds.set(f.name, new Set());
			scanRewards(f.name, f.shuttle_mission_rewards);
		});

		//FIXME: this should be done on init, not here on list render
		this.props.data.forEach(item => {
			let val = STTApi.getEquipmentManager().getCadetableItems().get(item.archetype_id);
			item.cadetable = '';
			item.factions = '';
			if (val) {
				val.forEach(v => {
					let name = v.mission.episode_title;
					let mastery = v.masteryLevel;

					let questName = v.quest.action;
					let questIndex = null;
					v.mission.quests.forEach((q,i) => {
						if (q.id === v.quest.id)
							questIndex = i + 1;
					});

					if (item.cadetable)
						item.cadetable += ' | ';
					item.cadetable += name + ' : ' + questIndex + ' : ' + questName + ' : ' + CONFIG.MASTERY_LEVELS[mastery].name;
				});
			}

			let iter = rewardItemIds.entries();
			for (let n = iter.next(); !n.done; n = iter.next()) {
				let e = n.value;
				if (e[1].has(item.archetype_id)) {
					if (item.factions)
						item.factions += ' | ';
					item.factions += e[0] + " ";
				}
				n = iter.next();
			}
		});


		this.state = {
			items: this.props.data,
			sorted: [{ id: 'name', desc: false }, { id: 'rarity', desc: false }],
			columns: [
				{
					id: 'icon',
					Header: '',
					minWidth: 50,
					maxWidth: 50,
					resizable: false,
					accessor: 'name',
					Cell: (cell) => {
						let item = cell.original;
						let found = STTApi.itemArchetypeCache.archetypes.find(arch => arch.id === item.archetype_id);
						if (!found) {
							// For some reason not all items are in the archetype cache, so jam in the needed properties from
							// the existing item
							found = {
								...item,
								id: item.archetype_id
							};
						}
						return <ItemDisplay src={item.iconUrl} size={50} maxRarity={item.rarity} rarity={item.rarity}
							onClick={() => this.setState({ replicatorTarget: found })} />;
					}
				},
				{
					id: 'name',
					Header: 'Name',
					minWidth: 130,
					maxWidth: 180,
					resizable: true,
					accessor: 'name',
					Cell: (cell) => {
						let item = cell.original;
						return (
							<a href={'https://stt.wiki/wiki/' + item.name.split(' ').join('_')} target='_blank'>
								{item.name}
							</a>
						);
					}
				},
				{
					id: 'rarity',
					Header: 'Rarity',
					accessor: 'rarity',
					minWidth: 80,
					maxWidth: 80,
					resizable: false,
					Cell: (cell) => {
						let item = cell.original;
						return <RarityStars min={1} max={item.rarity} value={item.rarity ? item.rarity : null} />;
					}
				},
				{
					id: 'quantity',
					Header: 'Quantity',
					minWidth: 50,
					maxWidth: 80,
					resizable: true,
					accessor: 'quantity'
				},
				{
					id: 'type',
					Header: 'Type',
					minWidth: 70,
					maxWidth: 120,
					resizable: true,
					accessor: 'typeName',
					Cell: (cell) => {
						let item = cell.original;

						let typeName = CONFIG.REWARDS_ITEM_TYPE[item.type];
						if (typeName) {
							return typeName;
						}

						// fall-through case
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
				},
				{
					id: 'image',
					Header: 'Image',
					minWidth: 250,
					maxWidth: 550,
					resizable: true,
					accessor: 'icon.file'
				},
				{
					id: 'details',
					Header: 'Details',
					minWidth: 150,
					maxWidth: 150,
					resizable: true,
					accessor: 'flavor'
				},
				{
					id: 'cadet',
					Header: 'Cadet Details',
					minWidth: 250,
					maxWidth: 450,
					resizable: true,
					accessor: 'cadetable'
				},
				{
					id: 'faction',
					Header: 'Faction Details',
					minWidth: 250,
					maxWidth: 450,
					resizable: true,
					accessor: 'factions'
				}
			]
		};
	}

	render() {
		let { columns, items, sorted } = this.state;
		if (this.props.filterText) {
			items = items.filter(i => this._filterItem(i, this.props.filterText!.toLowerCase()))
		}

		const MAX_PAGE_SIZE = 30;

		return (
			<div className='data-grid' data-is-scrollable='true'>
				<ReactTable
					data={items}
					columns={columns}
					defaultPageSize={items.length <= MAX_PAGE_SIZE ? items.length : MAX_PAGE_SIZE}
					pageSize={items.length <= MAX_PAGE_SIZE ? items.length : MAX_PAGE_SIZE}
					sorted={sorted}
					onSortedChange={sorted => this.setState({ sorted })}
					showPagination={items.length > MAX_PAGE_SIZE}
					showPageSizeOptions={false}
					className='-striped -highlight'
					style={items.length > MAX_PAGE_SIZE ? { height: 'calc(100vh - 88px)' } : {}}
				/>

				<ReplicatorDialog targetArchetype={this.state.replicatorTarget}
					onReplicate={() => this.setState({ replicatorTarget: undefined })}
					onClose={() => this.setState({ replicatorTarget: undefined })} />
			</div>
		);
	}

	_filterItem(item: ItemDTO, searchString: string): boolean {
		return searchString.split(' ').every(text => {
			// search the name first
			if (item.name.toLowerCase().indexOf(text) > -1) {
				return true;
			}

			// now search the traits
			if (item.symbol && item.symbol.toLowerCase().indexOf(text) > -1) {
				return true;
			}

			// now search the raw traits
			if (item.flavor && item.flavor.toLowerCase().indexOf(text) > -1) {
				return true;
			}

			if (item.icon && item.icon.file && item.icon.file.toLowerCase().indexOf(text) > -1) {
				return true;
			}

			if (item.cadetable && item.cadetable.toLowerCase().indexOf(text) > -1) {
				return true;
			}

			if (item.factions && item.factions.toLowerCase().indexOf(text) > -1) {
				return true;
			}

			return false;
		});
	}

	// filter(newValue: string): void {
	// 	this.setState({
	// 		items: newValue ? this.props.data.filter(i => this._filterItem(i, newValue.toLowerCase())) : this.props.data
	// 	});
	// }
}
