import 'react-table/react-table.css';

import React from 'react';
import { Image, ImageFit } from 'office-ui-fabric-react/lib/Image';
import { Label } from 'office-ui-fabric-react/lib/Label';
import { Icon } from 'office-ui-fabric-react/lib/Icon';
import { IconButton, DefaultButton } from 'office-ui-fabric-react/lib/Button';
import { HoverCard } from 'office-ui-fabric-react/lib/HoverCard';
import { TooltipHost } from 'office-ui-fabric-react/lib/Tooltip';
import { Checkbox } from 'office-ui-fabric-react/lib/Checkbox';

import ReactTable, { SortingRule, Column } from 'react-table';
import { isMobile } from 'react-device-detect';

import { SkillCell } from './SkillCell';
import { ActiveCrewDialog } from './ActiveCrewDialog';
import { ItemDisplay } from '../ItemDisplay';

import STTApi, { CONFIG, RarityStars } from '../../api';
import { CrewData, ItemArchetypeDTO } from '../../api/STTApi';

export interface CrewShipListProps {
	data: CrewData[];
	sortColumn?: string;
	selectedIds?: Set<number>;
	filterText?: string;
}

interface CrewShipListState {
	items: CrewData[];
	selection: Set<number>;
	sorted: SortingRule[];
	active: {
		activeId?: number;
		name?: string;
	}
}

export class CrewShipList extends React.Component<CrewShipListProps, CrewShipListState> {

	// static defaultProps = {
	// 	sortColumn: 'max_rarity',
	// };

	constructor(props:CrewShipListProps) {
		super(props);

		this.state = {
			items: props.data,
			sorted: [{ id: props.sortColumn || 'max_rarity', desc: false }],
			selection: props.selectedIds ? props.selectedIds : new Set(),
			active: { }
		};

		this._showActiveDialog = this._showActiveDialog.bind(this);
		this._onRenderExpandedCard = this._onRenderExpandedCard.bind(this);
		this._onRenderCompactCard = this._onRenderCompactCard.bind(this);
	}

	componentWillReceiveProps(nextProps:CrewShipListProps) {
		if (nextProps.data !== this.state.items) {
			this.setState({ items: nextProps.data });
		}

		if (nextProps.selectedIds !== this.state.selection) {
			this.setState({ selection: nextProps.selectedIds ? nextProps.selectedIds : new Set() });
		}
	}

	_onRenderCompactCard(item:CrewData) {
		return <div className="ui items">
			<div className="item">
				<img src={item.iconBodyUrl} height={180} />
				<div className="content" style={{ padding: '12px' }}>
					<div className="header">{item.name}</div>
					<div className="meta">{item.flavor}</div>
					<div className="description">Traits: {item.traits.replace(new RegExp(',', 'g'), ', ')}</div>
					<span style={{ fontSize: '0.8rem' }}>id: {item.id}, symbol:{item.symbol}</span>
				</div>
			</div>
		</div>;
	}

	_onRenderExpandedCard(item:CrewData) {
		let equipment : {e?: ItemArchetypeDTO, have?: boolean }[] = [];
		item.equipment_slots.forEach(es => {
			equipment.push(
				{
					e: STTApi.itemArchetypeCache.archetypes.find(equipment => equipment.id === es.archetype),
					have: es.have
				}
			);
		});

		let eqTable;
		if (equipment && equipment.length > 0) {
			eqTable = (<div>
				<h4 className="ui header">Equipment</h4>
				<table><tbody>
					<tr>
						{
							equipment.map((eq, ix) => {
								if (eq.e) {
									return (<td key={eq.e.name + ix}>
										<ItemDisplay src={eq.e.iconUrl || ''} size={100} maxRarity={eq.e.rarity} rarity={eq.e.rarity} />
										<span style={{ fontSize: '0.8rem', color: eq.have ? "" : "red" }}>{eq.e.name}</span>
									</td>);
								}
								else {
									return <td></td>;
								}
							})
						}
					</tr></tbody>
				</table>
			</div>);
		}

		return (
			<div style={{ padding: '10px' }}>
				{eqTable}
				{ item.action && item.ship_battle && <span>
				<h4 className="ui header">Ship abilitiy '{item.action.name}'</h4>
				<Label>Accuracy +{item.ship_battle.accuracy}  Crit Bonus +{item.ship_battle.crit_bonus}  {item.ship_battle.crit_chance && <span>Crit Rating +{item.ship_battle.crit_chance}  </span>}Evasion +{item.ship_battle.evasion}</Label>
				<Label>Increase {CONFIG.CREW_SHIP_BATTLE_BONUS_TYPE[item.action.bonus_type]} by {item.action.bonus_amount}</Label>
				{item.action.penalty && <Label>Decrease {CONFIG.CREW_SHIP_BATTLE_BONUS_TYPE[item.action.penalty.type]} by {item.action.penalty.amount}</Label>}

				{item.action.ability && <Label>Ability: {CONFIG.CREW_SHIP_BATTLE_ABILITY_TYPE[item.action.ability.type].replace('%VAL%', ''+ item.action.ability.amount)} {(item.action.ability.condition > 0) && <span>Trigger: {CONFIG.CREW_SHIP_BATTLE_TRIGGER[item.action.ability.condition]}</span>}</Label>}
				<Label>Duration: {item.action.duration}s  Cooldown: {item.action.cooldown}s  Initial Cooldown: {item.action.initial_cooldown}s  </Label>
				{item.action.limit && <Label>Limit: {item.action.limit} uses per battle</Label>}

				{this.renderChargePhases(item.action.charge_phases)}
				</span>}
			</div>
		);
	}

	renderChargePhases(charge_phases: any) {
		if (!charge_phases) {
			return <span />;
		} else {
			let phases :any[] = [];
			charge_phases.forEach((cp:any, idx:number) => {
				let phaseDescription = `Charge time: ${cp.charge_time}s`;

				if (cp.ability_amount) {
					phaseDescription += `  Ability amount: ${cp.ability_amount}`;
				}

				if (cp.bonus_amount) {
					phaseDescription += `  Bonus amount: ${cp.bonus_amount}`;
				}

				if (cp.duration) {
					phaseDescription += `  Duration: ${cp.duration}s`;
				}

				if (cp.cooldown) {
					phaseDescription += `  Cooldown: ${cp.cooldown}s`;
				}

				phases.push(<Label key={idx}>{phaseDescription}</Label>);
			});

			return (<div>
				<h4 className="ui header">Charge phases</h4>
				<div>
					{phases}
				</div>
			</div>);
		}
	}

	render() {
		let { items, sorted } = this.state;

		let columns = this._getColumns();

		if (this.props.filterText) {
			items = items.filter(i => this._filterCrew(i, this.props.filterText!.toLowerCase()))
		}

		return (
			<div className={'data-grid'} data-is-scrollable='true'>
				<ReactTable
					data={items}
					columns={columns}
					defaultPageSize={(items.length <= 50) ? items.length : 50}
					pageSize={(items.length <= 50) ? items.length : 50}
					sorted={sorted}
					onSortedChange={sorted => this.setState({ sorted })}
					showPagination={(items.length > 50)}
					showPageSizeOptions={false}
					className="-striped -highlight"
					style={((items.length > 50)) ? { height: 'calc(100vh - 88px)' } : {}}
					getTrProps={(s:any, r:any) => {
						return {
							style: {
								opacity: (r && r.original && r.original.isExternal) ? "0.5" : "inherit"
							}
						};
					}}
					getTdProps={(s: any, r: any) => {
						return { style: { padding: "2px 3px" } };
					}}
				/>
				<ActiveCrewDialog activeId={this.state.active.activeId} name={this.state.active.name} />
			</div>
		);
	}

	_getColumns() {
		let _columns : Column<CrewData>[] = [];

		_columns.push({
			id: 'icon',
			Header: '',
			minWidth: 28,
			maxWidth: 28,
			resizable: false,
			accessor: 'name',
			Cell: (cell) => {
				if (cell && cell.original) {
					return <Image src={cell.original.iconUrl} width={22} height={22} imageFit={ImageFit.contain} shouldStartVisible={true} />;
				} else {
					return <span />;
				}
			},
			Aggregated: (row) => <span />
		});

		if (!isMobile) {
			_columns.push({
				id: 'short_name',
				Header: 'Name',
				minWidth: 90,
				maxWidth: 110,
				resizable: true,
				accessor: 'short_name',
				Cell: (cell) => {
					if (cell && cell.original) {
						return <a href={'https://stt.wiki/wiki/' + cell.original.name.split(' ').join('_')} target='_blank'>{cell.original.short_name}</a>;
					} else {
						return <span />;
					}
				},
				Aggregated: (row) => <span />
			});
		}

		_columns.push({
				id: 'name',
				Header: 'Full name',
				minWidth: 110,
				maxWidth: 190,
				resizable: true,
				accessor: 'name',
			Cell: (cell) => {
					if (cell && cell.original) {
						return <HoverCard id="nameHoverCard"
							expandingCardProps={{
								compactCardHeight: 180,
								expandedCardHeight: 420,
								renderData: cell.original,
								onRenderExpandedCard: this._onRenderExpandedCard,
								onRenderCompactCard: this._onRenderCompactCard,
								styles: { root: { width: '520px' } }
							}}
							instantOpenOnClick={true}>
							<span>{cell.original.name}</span>
						</HoverCard>;
					} else {
						return <span />;
					}
				},
				Aggregated: (row) => <span />
			},
			{
				id: 'level',
				Header: 'Level',
				minWidth: 40,
				maxWidth: 45,
				resizable: false,
				accessor: 'level',
				aggregate: (vals) => vals.reduce((a:any, b:any) => a + b, 0) / vals.length,
				Aggregated: (row) => <span>{Math.floor(row.value)}</span>
			},
			{
				id: 'rarity',
				Header: 'Rarity',
				// Sort all by max fusion level, then fractional part by current fusion level
				accessor: (obj) => obj.max_rarity + (obj.rarity / obj.max_rarity),
				minWidth: 75,
				maxWidth: 85,
				resizable: false,
				Cell: (cell) => {
					if (cell && cell.original) {
						return <RarityStars min={1} max={cell.original.max_rarity} value={cell.original.rarity ? cell.original.rarity : null} />;
					} else {
						return <span />;
					}
				},
				Aggregated: (row) => <span />
			});

		if (!isMobile) {
			_columns.push({
				id: 'favorite',
				Header: () => <Icon iconName='FavoriteStar' />,
				minWidth: 30,
				maxWidth: 30,
				style: { paddingLeft: 0, paddingRight: 0, textAlign: 'center' },
				resizable: false,
				accessor: 'favorite',
				Cell: (cell) => {
					if (cell && cell.original && cell.value) {
						return <TooltipHost content={`You marked ${cell.original.short_name} as favorite in the game`} calloutProps={{ gapSpace: 0 }}>
							<Icon iconName='FavoriteStar' />
						</TooltipHost>;
					} else {
						return <span />;
					}
				},
				Aggregated: (row) => <span />
			},
			{
				id: 'frozen',
				Header: () => <Icon iconName='Snowflake' />,
				minWidth: 30,
				maxWidth: 30,
				style: { paddingLeft: 0, paddingRight: 0, textAlign: 'center' },
				resizable: false,
				accessor: 'frozen',
				Cell: (cell: any) => {
					if (cell && cell.value && cell.original) {
						return <TooltipHost content={`You have ${(cell.value === 1) ? 'one copy' : `${cell.value} copies`} of ${cell.original.short_name} frozen (cryo-d)`} calloutProps={{ gapSpace: 0 }}>
							{cell.value > 1 ? cell.value : ''}<Icon iconName='Snowflake' />
						</TooltipHost>;
					} else {
						return <span />;
					}
				},
				aggregate: (vals) => vals.map((v:any) => v ? 1 : 0).reduce((a:any, b:any) => a + b, 0),
				Aggregated: (row) => <span>{Math.floor(row.value)}</span>
			});
		}

		// Compute an average aggregate, only including nonzero values
		let aggAvg = (vals: any) => {
			let nonzeros = vals.reduce((a: any, b: any) => a + ((b || 0) > 0 ? 1 : 0), 0);
			return vals.reduce((a: any, b: any) => (a || 0) + (b || 0), 0) / nonzeros;
		}

		_columns.push({
				id: 'traits',
				Header: 'Traits',
				minWidth: 140,
				resizable: true,
				accessor: 'traits',
				Cell: (cell) => <div style={ { overflow: 'hidden', textOverflow: 'ellipsis', height: '22px' } }>{cell.original.traits.replace(/,/g, ', ')}</div>,
			});

		return _columns;
	}

	_filterCrew(crew:CrewData, searchString:string) {
		return searchString.split(';').some(segment => {
			if (segment.trim().length == 0) return false;
			return segment.split(' ').every(text => {
				if (text.trim().length == 0) return false;
				// search the name first
				if (crew.name.toLowerCase().indexOf(text) > -1) {
					return true;
				}

				// now search the traits
				if (crew.traits.toLowerCase().indexOf(text) > -1) {
					return true;
				}

				// now search the raw traits
				if (crew.rawTraits.find(trait => trait.toLowerCase().indexOf(text) > -1)) {
					return true;
				}

				return false;
			});
		});
	}

	_showActiveDialog(activeId:any, name:string) {
		this.setState({active: { activeId, name}});
	}
}
