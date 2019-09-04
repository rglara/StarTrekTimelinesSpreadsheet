import React from 'react';
import { EventDTO } from "../../api/STTApi";
import STTApi from '../../api';
import { List } from 'semantic-ui-react';
import { renderCrewBonus } from './EventHelperPage';

export interface ShuttleEventProps {
   event: EventDTO;
}

export const ShuttleEvent = (props: ShuttleEventProps) => {
   if (!props.event ||
      !props.event.content ||
      props.event.content.content_type !== 'shuttles' ||
      !props.event.content.shuttles
   ) {
      return <span />;
   }

   let crew_bonuses = [];
   for (let cb in props.event.content.shuttles[0].crew_bonuses) {
      let avatar = STTApi.getCrewAvatarBySymbol(cb);
      if (!avatar) {
         continue;
      }

      let crew = STTApi.roster.find(c => c.symbol === avatar!.symbol);
      if (!crew) {
         continue;
      }

      let iconUrl = avatar.iconUrl;
      if (!iconUrl || iconUrl == '') {
         iconUrl = STTApi.imageProvider.getCrewCached(avatar, false);
      }
      crew_bonuses.push({
         crew,
         bonus: props.event.content.shuttles[0].crew_bonuses[cb],
         iconUrl
      });
   }

   crew_bonuses.sort((a, b) => {
      if (a.crew.frozen > b.crew.frozen) { return 1; }
      if (a.crew.frozen < b.crew.frozen) { return -1; }
      // Sort by bonus DESC then shortname ASC then name ASC
      if (a.bonus > b.bonus) { return -1; }
      if (a.bonus < b.bonus) { return 1; }
      if (a.crew.short_name > b.crew.short_name) { return 1; }
      if (a.crew.short_name < b.crew.short_name) { return -1; }
      if (a.crew.name > b.crew.name) { return 1; }
      if (a.crew.name < b.crew.name) { return -1; }
      return 0;
   });

   return <div><h2>Shuttle Event Details</h2>
      <div style={{ margin: '0' }}>
         <span>
            <div>{props.event.bonus_text}</div>
            Owned Event Bonus Crew: {!crew_bonuses.length && "None"}
            <List horizontal>{crew_bonuses.map(cb => renderCrewBonus(cb))}</List>
         </span>
      </div>
   </div>;
}
