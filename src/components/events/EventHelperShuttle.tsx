import React from 'react';
import { EventDTO, EVENT_TYPES } from "../../api/DTO";
import { Label } from 'semantic-ui-react';
import { EventCrewBonusTable } from './EventHelperPage';

export const ShuttleEvent = (props: {
   event: EventDTO;
   onTabSwitch?: (newTab: string) => void;
}) => {
   if (!props.event ||
      !props.event.content ||
      props.event.content.content_type !== EVENT_TYPES.SHUTTLES ||
      !props.event.content.shuttles
   ) {
      return <span />;
   }
   let eventVP = props.event.content.shuttles![0].shuttle_mission_rewards.find(r => r.type === 11);
   let eventShuttleVP = eventVP ? eventVP.quantity : 0

   return <div><h2>Shuttle Event Details</h2>
      <div style={{ margin: '0' }}>
         <span>
            {props.onTabSwitch &&
               <span>Click to see shuttle details: <Label as='a'
                  onClick={() => props.onTabSwitch && props.onTabSwitch('Shuttles')}>Shuttle Details</Label></span>
            }
            <h4>Next shuttle VP: {eventShuttleVP ?? ''}</h4>
            <div>{props.event.bonus_text}</div>
            <EventCrewBonusTable bonuses={props.event.content.shuttles[0].crew_bonuses} />
         </span>
      </div>
   </div>;
}
