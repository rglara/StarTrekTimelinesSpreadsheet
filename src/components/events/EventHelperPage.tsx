import React from 'react';

import STTApi from '../../api';
import { EventDTO } from '../../api/STTApi';
import { GalaxyEvent } from './EventHelperGalaxy';

export const EventHelperPage = () => {
   let currEvent : EventDTO | undefined = undefined;
   if (
      STTApi.playerData.character.events &&
      STTApi.playerData.character.events.length > 0 &&
      STTApi.playerData.character.events[0].content
   ) {
      currEvent = STTApi.playerData.character.events[0];
   }

   if (!currEvent) {
      return <div className='tab-panel' data-is-scrollable='true'>
         <h2>There is no current event in progress or waiting to begin.</h2>
      </div>
   }

   return (
      <div className='tab-panel' data-is-scrollable='true'>
         <GalaxyEvent event={currEvent} />
      </div>
   );
}
