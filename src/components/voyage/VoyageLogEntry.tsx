import React from "react";
import STTApi, { CONFIG } from "../../api";
import { List, Image, Icon } from 'semantic-ui-react';

export class VoyageLogEntry extends React.Component<any,any> {
   constructor(props:any) {
      super(props);

      this.props.log.forEach((entry: any) => {
         // TODO: some log entries have 2 crew
         if (entry.crew) {
            let rc = STTApi.roster.find(rosterCrew => rosterCrew.symbol == entry.crew[0]);
            if (rc) entry.crewIconUrl = rc.iconUrl;
         }
      });
   }

   render() {
      let listItems : any[] = [];
      this.props.log.forEach((entry: any, index:number) => {
         if (entry.crewIconUrl) {
            listItems.push(
               <List.Item key={index}>
                  <Image avatar src={entry.crewIconUrl} />
                  <List.Content>
                     <List.Header>
                        <span dangerouslySetInnerHTML={{ __html: entry.text }} />
                     </List.Header>
                     {entry.skill_check && (
                        <List.Description>
                           <span className='quest-mastery'>
                              <img src={CONFIG.SPRITES['icon_' + entry.skill_check.skill].url} height={18} />
                              {entry.skill_check.passed == true ? <Icon name='thumbs up' /> : <Icon name='thumbs down' />}
                           </span>
                        </List.Description>
                     )}
                  </List.Content>
               </List.Item>
            );
         } else {
            listItems.push(
               <List.Item key={index}>
                  <span dangerouslySetInnerHTML={{ __html: entry.text }} />
               </List.Item>
            );
         }
      });

      return <List>{listItems}</List>;
   }
}
