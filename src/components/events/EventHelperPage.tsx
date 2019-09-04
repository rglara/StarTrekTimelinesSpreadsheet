import React from 'react';

import STTApi, { formatTimeSeconds, CONFIG, RarityStars } from '../../api';
import { EventDTO } from '../../api/STTApi';
import { GalaxyEvent } from './EventHelperGalaxy';
import { ShuttleEvent } from './EventHelperShuttle';
import { Image, Popup, List } from 'semantic-ui-react';

export function renderCrewBonus(cb: any) {
   return <Popup flowing key={cb.crew.symbol}
      trigger={
         <List.Item >
            <Image src={cb.iconUrl} width="25" height="25" />
            <List.Content>
               <List.Header>{cb.crew.name}</List.Header>
               <RarityStars min={1} max={cb.crew.max_rarity} value={cb.crew.rarity ? cb.crew.rarity : null} />
               {cb.crew.level < 100 && <div>Level {cb.crew.level}</div>}
               {cb.crew.frozen > 0 && <div>Frozen</div>}
               Bonus level {cb.bonus}x
            </List.Content>
         </List.Item>
      }
      content={<span key={cb.crew.id}>
         Base: {Object.keys(cb.crew.skills).map(s => {
            return (<span key={s}><img src={CONFIG.SPRITES['icon_' + s].url} height={18} />
               {cb.crew.skills[s].core} ({cb.crew.skills[s].min}-{cb.crew.skills[s].max})
               </span>);
         })}
         <br />
         Bonus ({cb.bonus}x): {Object.keys(cb.crew.skills).map(s => {
            return (<span key={s}><img src={CONFIG.SPRITES['icon_' + s].url} height={18} />
               {cb.crew.skills[s].core * cb.bonus} </span>);
         })}
      </span>}
   />
}

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

   let hasStarted = currEvent.seconds_to_start <= 0;
   let hasEnded = currEvent.seconds_to_end <= 0;
   let msg = '';
   if (hasEnded) {
      msg = ' has ended and has rewards to collect in-game';
   } else if (hasStarted) {
      msg = ' has started and ends in ' + formatTimeSeconds(currEvent.seconds_to_end);
   } else {
      msg = ' starts in ' + formatTimeSeconds(currEvent.seconds_to_start);
   }

   return (
      <div className='tab-panel' data-is-scrollable='true'>
         <h2>Event {msg}</h2>
         <GalaxyEvent event={currEvent} />
         <ShuttleEvent event={currEvent} />
      </div>
   );
}
