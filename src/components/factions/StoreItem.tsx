import React from 'react';

import { Button, Segment, Header } from 'semantic-ui-react';
import { getTheme } from '@uifabric/styling';

import STTApi, { CONFIG } from '../../api';
import { FactionStoreItemDTO } from '../../api/DTO';
import { ItemDisplay } from '../../utils/ItemDisplay';
import { CrewImageData } from '../images/ImageProvider';

interface StoreItemProps {
	storeItem: FactionStoreItemDTO;
	onBuy: () => void;
}

export const StoreItem = (props: StoreItemProps) => {
	let archetypes = STTApi.itemArchetypeCache.archetypes;
	let equipment = archetypes.find(e => e.id === props.storeItem.offer.game_item.id);
	let sources = undefined;
	if (equipment) {
		let isMission = equipment.item_sources.filter(e => e.type === 0).length > 0;
		let isShipBattle = equipment.item_sources.filter(e => e.type === 2).length > 0;
		// obviously it is faction obtainable since this is a faction item
		//let isFaction = equipment.item_sources.filter(e => e.type === 1).length > 0;
		//TODO: figure out cadet mission availability
		if (!isMission && !isShipBattle) {
			sources = '*';
		}
	}

	let curr = CONFIG.CURRENCIES[props.storeItem.offer.cost.currency];
	let locked = props.storeItem.locked || props.storeItem.offer.purchase_avail === 0;

	let iconUrl;
	if (props.storeItem.offer.game_item.type === 1) {
		iconUrl = STTApi.imageProvider.getCrewCached(props.storeItem.offer.game_item as CrewImageData, false);
	} else {
		iconUrl = STTApi.imageProvider.getCached(props.storeItem.offer.game_item);
	}

	return (
		<div className='faction-store-item'>
			<Header as='h5' attached='top' style={{ color: getTheme().palette.neutralDark, backgroundColor: getTheme().palette.themeLighter }}>
				{props.storeItem.offer.game_item.name}
			</Header>
			<Segment attached style={{ backgroundColor: getTheme().palette.themeLighter }}>
				<ItemDisplay
					style={{ marginLeft: 'auto', marginRight: 'auto' }}
					src={iconUrl}
					size={80}
					maxRarity={props.storeItem.offer.game_item.rarity}
					rarity={props.storeItem.offer.game_item.rarity}
					itemId={props.storeItem.offer.game_item.id}
					sources={sources}
				/>
			</Segment>
			<Button attached='bottom' primary disabled={locked} onClick={() => props.onBuy()}>
				<span style={{ display: 'inline-block' }}>
					<img src={CONFIG.SPRITES[curr.icon].url} height={16} />
				</span>
				{props.storeItem.offer.cost.amount} {curr.name}
			</Button>
		</div>
	);
}
