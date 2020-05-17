import React from "react";
import STTApi, { CONFIG } from "../../api";
import { Image, Icon } from 'semantic-ui-react';

export class VoyageLogEntry extends React.Component<any,any> {
   constructor(props:any) {
      super(props);

      this.props.log.forEach((entry: any) => {
         if (entry.crew) {
            entry.crewIconUrls = entry.crew.map((ec: any) =>
               STTApi.roster.find(rosterCrew => rosterCrew.symbol == ec))
                  .map((rc: any) => rc ? rc.iconUrl ?? '' : '');
         }
      });
   }

   render() {
      const listItems : any[] = [];
      this.props.log.forEach((entry: any, index: number) => {
         const images = [];
         if (entry.crewIconUrls) {
            for(let j = 0; j < entry.crewIconUrls.length; j += 1) {
               images.push(
                  <Image avatar className='mini' src={entry.crewIconUrls[j]} key={`${index}-${j}`} />
               );
            }
         }
         let textClass = 'vle-text';
         if (entry.skill_check && (index + 1) === this.props.log.length) {
            textClass = `${textClass} ui header ${entry.skill_check.passed ? 'green' : 'red'}`
            images.push(
               <span key={`skill-${index}`}>
                  <img className={this.props.spriteClass} src={CONFIG.SPRITES['icon_' + entry.skill_check.skill].url} height={32} />
                  &nbsp;
                  {entry.skill_check.passed == true ? <Icon name='thumbs up' /> : <Icon name='thumbs down' />}
               </span>
            );
         }
         listItems.push(
            <div className='voyage-log-entry' key={index}>
               <div className='vle-images'>{images}</div>
               <div className={textClass}>
                  <span dangerouslySetInnerHTML={{ __html: entry.text }} />
               </div>
            </div>
         );
      });

      return <div className='voyage-log'>{listItems}</div>;
   }
}
