import React from 'react';

import { Accordion, Button, Segment, Header } from 'semantic-ui-react';
import { getTheme } from '@uifabric/styling';

import { ItemDisplay } from './ItemDisplay';

import STTApi, { CONFIG, refreshAllFactions, loadFactionStore } from '../api';
import { FactionDTO, PotentialRewardDTO, RewardDTO, ItemArchetypeDTO, FactionStoreItemDTO } from '../api/DTO';
import { CrewImageData } from './images/ImageProvider';

interface StoreItemProps {
	storeItem: FactionStoreItemDTO;
	onBuy: () => void;
}

const StoreItem = (props: StoreItemProps) => {
	let archetypes = STTApi.itemArchetypeCache.archetypes
	let equipment = archetypes.find(e => e.id === props.storeItem.offer.game_item.id);
	let sources = undefined;
	if (equipment) {
		let isMission = equipment.item_sources.filter(e => e.type === 0).length > 0;
		let isShipBattle = equipment.item_sources.filter(e => e.type === 2).length > 0;
		// obviously it is faction obtainable since this is a faction item
		//let isFaction = equipment.item_sources.filter(e => e.type === 1).length > 0;
		//TODO: figure out cadet mission availability
		if (!isMission && !isShipBattle) {
			sources = '*'
		}
	}

	let curr : any = CONFIG.CURRENCIES[props.storeItem.offer.cost.currency];
	let locked = props.storeItem.locked || props.storeItem.offer.purchase_avail === 0;

	let iconUrl;
	if (props.storeItem.offer.game_item.type === 1) {
		iconUrl = STTApi.imageProvider.getCrewCached(props.storeItem.offer.game_item as CrewImageData, false);
	} else {
		iconUrl = STTApi.imageProvider.getCached(props.storeItem.offer.game_item);
	}

	return (
		<div style={{ textAlign: 'center' }}>
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

interface FactionDisplayProps {
	faction: FactionDTO;
}

const FactionDisplay = (props:FactionDisplayProps) => {
	const [reputationIconUrl, setReputationIconUrl] = React.useState('');
	const [showSpinner, setShowSpinner] = React.useState(true);

	//TODO: this could be partially looked up from STTApi.items instead of recursively scanned here (but only for inventory items, not for those not in inventory)
	let rewardItemIds = new Set();
	const scanRewards = (potential_rewards?: (PotentialRewardDTO | RewardDTO)[]) => {
		if (!potential_rewards)
			return;
		potential_rewards.forEach((reward: any) => {
			if (reward.potential_rewards) {
				scanRewards(reward.potential_rewards);
			} else if (reward.type === 2) {
				rewardItemIds.add(reward.id);
			}
		});
	};

	scanRewards(props.faction.shuttle_mission_rewards);

	let equipment : ItemArchetypeDTO[] = [];
	rewardItemIds.forEach(itemId => {
		let eq = STTApi.itemArchetypeCache.archetypes.find(equipment => equipment.id === itemId);
		if (eq) {
			equipment.push(eq);
		}
	});

	STTApi.imageProvider
		.getImageUrl(props.faction.reputation_item_icon.file, props.faction.id)
		.then(found => {
			if (found.url)
				setReputationIconUrl(found.url);
		})
		.catch(error => {
			console.warn(error);
		});

	refreshStore();

	function refreshStore() {
		loadFactionStore(props.faction).then(() => {
			setShowSpinner(false);
		});
	}

	function buyItem(storeItem: FactionStoreItemDTO) : void {
		let id = storeItem.symbol + ':';
		if (storeItem.offer.game_item.hash_key) {
			id += storeItem.offer.game_item.hash_key;
		}

		setShowSpinner(true);

		STTApi.executePostRequestWithUpdates('commerce/buy_direct_offer', { id, layout: props.faction.shop_layout, e: 0 }).then(
			buyData => refreshStore()
		);
	}

	function renderStoreItems() {
		if (showSpinner) {
			return (
				<div className='centeredVerticalAndHorizontal'>
					<div className='ui centered text active inline loader'>Loading {props.faction.name} faction store...</div>
				</div>
			);
		}

		return (
			<div
				style={{ display: 'grid', padding: '10px', gridTemplateColumns: 'repeat(6, 1fr)', gridTemplateRows: 'auto auto', gridGap: '8px' }}>
				{props.faction.storeItems && props.faction.storeItems.map((storeItem, idx) => (
					<StoreItem key={idx} storeItem={storeItem} onBuy={() => buyItem(storeItem)} />
				))}
			</div>
		);
	}

	function _getReputationName(reputation: number) {
		for (let repBucket of STTApi.platformConfig!.config.faction_config.reputation_buckets) {
			// top bucket has null upper bound
			if (repBucket.upper_bound === undefined || repBucket.upper_bound == null || reputation < repBucket.upper_bound) {
				return repBucket.name;
			}
		}

		return 'Unknown';
	}

	let token = STTApi.items.find(item => item.archetype_id === props.faction.shuttle_token_id);
	let tokens = token ? token.quantity : 0;

	return (
		<div style={{ paddingBottom: '10px' }}>
			<div style={{ display: 'grid', gridTemplateColumns: 'min-content auto', gridTemplateAreas: `'icon description'`, gridGap: '10px' }}>
				<div style={{ gridArea: 'icon' }}>
					<img src={reputationIconUrl} height={90} />
				</div>
				<div style={{ gridArea: 'description' }}>
					<h4>{props.faction.name}</h4>
					<p>
						Reputation: {_getReputationName(props.faction.reputation)} ({props.faction.completed_shuttle_adventures}{' '}
						completed shuttle adventures)
					</p>
					<h4>Transmissions: {tokens}</h4>
				</div>
			</div>
			<Accordion
				defaultActiveIndex={-1}
				panels={[
					{
						key: '1',
						title: 'Potential shuttle rewards',
						content: {
							content: equipment.map((item, idx) => (
								<span style={{ display: 'contents' }} key={idx}>
									<ItemDisplay
										style={{ display: 'inline-block' }}
										src={item.iconUrl ? item.iconUrl : ''}
										size={24}
										maxRarity={item.rarity}
										rarity={item.rarity}
									/>{' '}
									{item.name}
								</span>
							))
						}
					}
				]}
			/>
			<h5>Store</h5>
			{renderStoreItems()}
		</div>
	);
}

export const FactionDetails = () => {
	const [showSpinner, setShowSpinner] = React.useState(true);

	refreshAllFactions().then(() => {
		setShowSpinner(false);
	});

	if (showSpinner) {
		return (
			<div className='centeredVerticalAndHorizontal'>
				<div className='ui massive centered text active inline loader'>Loading factions...</div>
			</div>
		);
	}

	return (
		<div className='tab-panel' data-is-scrollable='true'>
			{STTApi.playerData.character.factions.map(faction => (
				<FactionDisplay key={faction.name} faction={faction} />
			))}
		</div>
	);
}
