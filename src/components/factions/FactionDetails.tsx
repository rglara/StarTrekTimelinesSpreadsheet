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

	return (
		<div className='tab-panel' data-is-scrollable='true'>
			{STTApi.playerData.character.factions.map(faction => (
				<FactionDisplay key={faction.name} faction={faction} />
			))}
		</div>
	);
}
