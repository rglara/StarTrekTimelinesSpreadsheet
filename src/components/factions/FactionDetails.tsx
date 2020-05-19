import React from 'react';

import STTApi, { refreshAllFactions } from '../../api';

import { FactionDisplay } from './FactionDisplay';

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

	const stringId = (id: number) => `faction${id}`;

	const refs = STTApi.playerData.character.factions.reduce((acc: any, faction) => {
		acc[stringId(faction.id)] = React.createRef();
		return acc;
	}, {} as React.RefObject<HTMLSpanElement>[]);

	const handleClick = (id: number) => refs[stringId(id)].current.scrollIntoView({
			behavior: 'smooth',
			block: 'start',
		}
	);

	const galleryItems: JSX.Element[] = [];
	const detailItems: JSX.Element[] = [];
	STTApi.playerData.character.factions.forEach(faction => {
		galleryItems.push(
			<div key={faction.id} onClick={() => handleClick(faction.id)}>{faction.name}</div>
		);
		detailItems.push(
			<span ref={refs[stringId(faction.id)]} key={faction.name}>
				<FactionDisplay faction={faction} />
			</span>
		);
	});

	return (
		<div className='tab-panel' data-is-scrollable='true'>
			<div className='faction-gallery'>
				{galleryItems}
			</div>
			{detailItems}
		</div>
	);
}
