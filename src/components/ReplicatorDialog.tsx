import React from 'react';
import ReactTable from 'react-table';
import { Dialog, DialogType, DialogFooter } from 'office-ui-fabric-react/lib/Dialog';
import { PrimaryButton, DefaultButton } from 'office-ui-fabric-react/lib/Button';
import { Dropdown } from 'office-ui-fabric-react/lib/Dropdown';
import { ProgressIndicator } from 'office-ui-fabric-react/lib/ProgressIndicator';

import { ItemDisplay } from './ItemDisplay';
import UserStore from './Styles';

import STTApi from '../api';
import { CONFIG, replicatorCurrencyCost, replicatorFuelCost, canReplicate, replicatorFuelValue, canUseAsFuel, replicate } from '../api';
import { ItemDTO, ItemArchetypeDTO } from '../api/DTO';

type FuelTankItem = {
	name: string;
	iconUrl?: string;
	quantity: number;
	id: number;
	type: number;
	rarity: number;
	item: ItemDTO;
};

export const ReplicatorDialog = (props:{
	targetArchetype?: ItemArchetypeDTO;
}) => {
	const [showDialog, setShowDialog] = React.useState(false);
	const [fuelconfig, setFuelConfig] = React.useState('extraSchematics');
	const [fuellist, setFuelList] = React.useState([] as ItemDTO[]);
	const [fueltank, setFuelTank] = React.useState([] as FuelTankItem[]);
	const [fuelTankValue, setFuelTankValue] = React.useState(0);
	const [fuelCost, setFuelCost] = React.useState(1000);
	const [canBeReplicated, setCanBeReplicated] = React.useState(false);
	const [currencyCost, setCurrencyCost] = React.useState(undefined as number | undefined);
	const [targetArchetype, setTargetArchetype] = React.useState(undefined as ItemArchetypeDTO | undefined);

	// Call when props change
	React.useEffect(() => {
		show();
	}, [props.targetArchetype]);

	function show() {
		if (!props.targetArchetype) {
			return;
		}
		let currencyCost = replicatorCurrencyCost(props.targetArchetype.id, props.targetArchetype.rarity);
		let fuelCost = replicatorFuelCost(props.targetArchetype.type, props.targetArchetype.rarity);
		let canBeReplicated = canReplicate(props.targetArchetype.id);

		setShowDialog(true);
		setCurrencyCost(currencyCost);
		setFuelCost(fuelCost);
		setCanBeReplicated(canBeReplicated);
		setTargetArchetype(props.targetArchetype);

		reloadItems(fuelconfig);
	}

	function closeDialog() {
		setShowDialog(false);
		setFuelTankValue(0);
		setFuelTank([]);
		setTargetArchetype(undefined);
	}

	function reloadItems(fuelConfig: string) {
		if (fuelConfig === 'extraSchematics') {
			let playerSchematics = STTApi.playerData.character.items.filter(item => item.type === 8);

			let fuellist : ItemDTO[] = [];
			STTApi.ships.forEach(ship => {
				if (ship.level === ship.max_level) {
					const schematic = STTApi.shipSchematics.find(schematic => schematic.ship.archetype_id === ship.archetype_id);
					if (schematic) {
						const playerSchematic = playerSchematics.find(playerSchematic => playerSchematic.archetype_id === schematic.id);

						if (playerSchematic) {
							fuellist.push(playerSchematic);
						}
					}
				}
			});

			setFuelList(fuellist);
		} else if (fuelConfig === 'extraItems') {
			let equipmentAlreadyOnCrew = new Set();
			STTApi.roster.forEach(crew => {
				if (crew.buyback) {
					return;
				}

				// Comment this line if we want to be more aggressive (with potentially more false positives for in-progress crew)
				if (crew.level < 100) {
					return;
				}

				let lastEquipmentLevel = crew.level;
				for (let equipment of crew.equipment_slots) {
					if (!equipment.have) {
						lastEquipmentLevel = equipment.level;
					}
				}

				let feCrew = STTApi.allcrew.find(c => c.symbol === crew.symbol);
				if (feCrew) {
					feCrew.equipment_slots.forEach(equipment => {
						if (equipment.level < lastEquipmentLevel) {
							equipmentAlreadyOnCrew.add(equipment.archetype);
						}
					});
				}
			});

			let fuellist = STTApi.playerData.character.items.filter(
				item => equipmentAlreadyOnCrew.has(item.archetype_id) && item.quantity === 1 && item.rarity > 1
			);
			setFuelList(fuellist);
		} else if (fuelConfig === 'everything') {
			let fuellist = STTApi.playerData.character.items;
			setFuelList(fuellist);
		} else {
			setFuelList([]);
		}
	}

	function removeFromTank(fuel: FuelTankItem) {
		let currentTank = fueltank;
		currentTank.splice(currentTank.indexOf(fuel), 1);

		let fuelValue = fuelTankValue - replicatorFuelValue(fuel.type, fuel.rarity) * fuel.quantity;

		setFuelTank(currentTank);
		setFuelTankValue(fuelValue);
	}

	// Add the item to the tank and return the remaining needed fuel cost
	function tankAdd(item: ItemDTO, amount: string | number | undefined) : {remainingCost:number; added:number;} {
		let neededFuelCost = fuelCost - fuelTankValue;

		if (neededFuelCost <= 0 || !canUseAsFuel(item.id)) {
			return {remainingCost:neededFuelCost, added:0};
		}

		if (amount === undefined) {
			amount = item.quantity;
		}
		if (typeof amount === 'string') {
			amount = parseInt(amount, 10);

			// unparseable or blank, use max available
			if (Number.isNaN(amount)) {
				amount = item.quantity;
			}
		}

		if (amount <= 0 || item.quantity <= 0) {
			return { remainingCost: neededFuelCost, added: 0 };
		}

		let currentTank = fueltank;
		let fuelValue = replicatorFuelValue(item.type, item.rarity);
		let neededQuantity = Math.ceil(neededFuelCost / fuelValue);

		if (amount > neededQuantity) {
			currentTank.push({
				name: item.name,
				iconUrl: item.iconUrl,
				quantity: neededQuantity,
				// Not for display
				id: item.id,
				type: item.type,
				rarity: item.rarity,
				item
			});

			// Calculate value
			let tankTotal = 0;
			for (let fuel of currentTank) {
				tankTotal += replicatorFuelValue(fuel.type, fuel.rarity) * fuel.quantity;
			}

			setFuelTank(currentTank);
			setFuelTankValue(tankTotal);

			return { remainingCost: 0, added: neededQuantity };
		}

		// Add all of it
		currentTank.push({
			name: item.name,
			iconUrl: item.iconUrl,
			quantity: item.quantity,
			// Not for display
			id: item.id,
			type: item.type,
			rarity: item.rarity,
			item
		});

		// Calculate value
		let tankTotal = 0;
		for (let fuel of currentTank) {
			tankTotal += replicatorFuelValue(fuel.type, fuel.rarity) * fuel.quantity;
		}

		setFuelTank(currentTank);
		setFuelTankValue(tankTotal);

		return {
			remainingCost: neededFuelCost - (fuelValue * item.quantity),
			added: item.quantity
		}
	}

	function autoFill() {
		for (let item of fuellist) {
			let {remainingCost, added } = tankAdd(item, undefined);
			if (remainingCost == 0) {
				break;
			}
		}

		// let neededFuelCost = fuelCost - fuelTankValue;
		// let currentTank = fueltank;

		// if (neededFuelCost <= 0) {
		// 	return;
		// }

		// for (let item of fuellist) {
		// 	if (neededFuelCost <= 0) {
		// 		break;
		// 	}

		// 	if (canUseAsFuel(item.id)) {
		// 		let fuelValue = replicatorFuelValue(item.type, item.rarity);

		// 		let neededQuantity = Math.ceil(neededFuelCost / fuelValue);

		// 		if (item.quantity > neededQuantity) {
		// 			currentTank.push({
		// 				name: item.name,
		// 				iconUrl: item.iconUrl,
		// 				quantity: neededQuantity,
		// 				// Not for display
		// 				id: item.id,
		// 				type: item.type,
		// 				rarity: item.rarity
		// 			});

		// 			break;
		// 		} else {
		// 			// Add all of it, and keep going through the list
		// 			currentTank.push({
		// 				name: item.name,
		// 				iconUrl: item.iconUrl,
		// 				quantity: item.quantity,
		// 				// Not for display
		// 				id: item.id,
		// 				type: item.type,
		// 				rarity: item.rarity
		// 			});

		// 			neededFuelCost -= fuelValue * item.quantity;
		// 		}
		// 	}
		// }

		// // Calculate value
		// let fuelValue = 0;
		// for (let fuel of currentTank) {
		// 	fuelValue += replicatorFuelValue(fuel.type, fuel.rarity) * fuel.quantity;
		// }

		// setFuelTank(currentTank);
		// setFuelTankValue(fuelValue);
	}

	if (!showDialog) {
		return <span />;
	}

	let currentTheme = UserStore.get('theme');

	return <Dialog
		hidden={!showDialog}
		onDismiss={closeDialog}
		dialogContentProps={{
			type: DialogType.normal,
			title: `Replicate one ${CONFIG.RARITIES[targetArchetype!.rarity].name} ${targetArchetype!.name}`
		}}
		modalProps={{
			containerClassName: 'replicatordialogMainOverride',
			isBlocking: true
		}}>
		<div
			style={{
				minWidth: '800px',
				color: currentTheme.semanticColors.bodyText,
				backgroundColor: currentTheme.semanticColors.bodyBackground
			}}>
			{!canBeReplicated && (
				<p>
					<b>This item cannot be replicated!</b>
				</p>
			)}
			<div style={{ color: 'red' }}>
				The actual replicator functionality is not implemented yet. Feel free to browse the tables on the left for inspiration though.
			</div>

			<div
				style={{
					display: 'grid',
					gridTemplateColumns: '9fr 7fr',
					gridGap: '6px',
					gridTemplateAreas: `'fuelconfig fueltank' 'fuellist fueltank' 'fuellist details'`
				}}>
				<div style={{ gridArea: 'fuelconfig', display: 'grid', gridTemplateColumns: '2fr 1fr' }}>
					<Dropdown
						selectedKey={fuelconfig}
						onChange={(evt, item) => {
							setFuelConfig(item!.key as string);
							reloadItems(item!.key as string);
						}}
						placeHolder='What kind of items?'
						options={[
							{ key: 'extraSchematics', text: 'Unneeded ship schematics' },
							{ key: 'extraItems', text: 'Potentially unneeded items' },
							{ key: 'everything', text: 'All items' }
						]}
					/>
					<DefaultButton onClick={() => autoFill()} text='Auto fill >' />
				</div>
				<div style={{ gridArea: 'fuellist' }}>
					<ReactTable
						data={fuellist}
						columns={[
							{
								id: 'icon',
								Header: '',
								minWidth: 50,
								maxWidth: 50,
								resizable: false,
								sortable: false,
								accessor: 'name',
								Cell: p => <ItemDisplay src={p.original.iconUrl} size={50} maxRarity={p.original.rarity} rarity={p.original.rarity} />
							},
							{
								id: 'name',
								Header: 'Name',
								minWidth: 90,
								maxWidth: 180,
								resizable: true,
								accessor: 'name'
							},
							{
								id: 'quantity',
								Header: 'Quantity',
								minWidth: 80,
								maxWidth: 80,
								resizable: true,
								Cell: row => {
									let quant = row.original.quantity;
									let found = fueltank.find(item => item.id === row.original.id);
									if (found) {
										return found.quantity + ' / ' + quant;
									}
									return quant;
								}
							},
							{
								id: 'burncount',
								Header: 'Use as fuel',
								minWidth: 120,
								maxWidth: 140,
								sortable: false,
								resizable: true,
								Cell: row => {
									let ref = React.createRef<HTMLInputElement>();
									return <div className='ui action input' style={{ width: '100px' }}>
										<input type='text' placeholder='Count...' ref={ref} />
										<button className='ui icon button' onClick={() => tankAdd(row.original, ref.current!.value)}>
											<i className='angle double right icon' />
										</button>
									</div>;
								}
							}
						]}
						showPageSizeOptions={false}
						defaultPageSize={fuellist.length <= 50 ? fuellist.length : 50}
						pageSize={fuellist.length <= 50 ? fuellist.length : 50}
						showPagination={fuellist.length > 50}
						className='-striped -highlight'
						style={{ height: '300px' }}
					/>
				</div>
				<div style={{ gridArea: 'fueltank' }}>
					<ReactTable
						data={fueltank}
						defaultPageSize={fueltank.length <= 50 ? fueltank.length : 50}
						pageSize={fueltank.length <= 50 ? fueltank.length : 50}
						columns={[
							{
								id: 'icon',
								Header: '',
								minWidth: 50,
								maxWidth: 50,
								resizable: false,
								sortable: false,
								accessor: 'name',
								Cell: p => <ItemDisplay src={p.original.iconUrl} size={50} maxRarity={p.original.rarity} rarity={p.original.rarity} />
							},
							{
								id: 'name',
								Header: 'Name',
								minWidth: 90,
								maxWidth: 180,
								resizable: true,
								accessor: 'name'
							},
							{
								id: 'quantity',
								Header: 'Burn quantity',
								minWidth: 40,
								maxWidth: 60,
								resizable: true,
								accessor: 'quantity'
							},
							{
								id: 'remove',
								Header: 'Remove',
								minWidth: 50,
								maxWidth: 50,
								sortable: false,
								resizable: true,
								Cell: row => (
									<button className='ui icon button' onClick={() => removeFromTank(row.original)}>
										<i className='icon close' />
									</button>
								)
							}
						]}
						showPagination={false}
						showPageSizeOptions={false}
						className='-striped -highlight'
						style={{ height: '280px' }}
					/>
					<ProgressIndicator
						description={`Fuel: ${fuelTankValue} of ${fuelCost}`}
						percentComplete={(fuelTankValue * 100) / fuelCost}
					/>
				</div>
				<div style={{ gridArea: 'details' }}>
					<p>Cost: {currencyCost} credits</p>
				</div>
			</div>
		</div>

		<DialogFooter>
			<PrimaryButton
				onClick={closeDialog}
				text='Replicate'
				disabled={canBeReplicated && fuelTankValue < fuelCost}
			/>
			<DefaultButton onClick={closeDialog} text='Cancel' />
		</DialogFooter>
	</Dialog>
}
