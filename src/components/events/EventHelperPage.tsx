import React from 'react';

import { Image, ImageFit } from 'office-ui-fabric-react/lib/Image';
import ReactTable, { Column, SortingRule } from 'react-table';
import STTApi, { formatTimeSeconds, CONFIG, RarityStars, getCrewDetailsLink } from '../../api';
import { EventDTO, CrewData } from "../../api/DTO";
import { GalaxyEvent } from './EventHelperGalaxy';
import { ShuttleEvent } from './EventHelperShuttle';
import { SkirmishEvent } from './EventHelperSkirmish';
import { ExpeditionEvent } from './EventHelperExpedition';
import { isMobile } from 'react-device-detect';
import { Icon } from 'office-ui-fabric-react/lib/Icon';
import { TooltipHost } from 'office-ui-fabric-react/lib/Tooltip';
import { SearchBox } from 'office-ui-fabric-react/lib/SearchBox';
import { SkillCell } from '../crew/SkillCell';

export const EventHelperPage = (props: {
   onTabSwitch?: (newTab: string) => void;
}) => {
   const [eventImageUrl, setEventImageUrl] = React.useState<string | undefined>();

   let currEvent : EventDTO | undefined = undefined;
   if (
      STTApi.playerData.character.events &&
      STTApi.playerData.character.events.length > 0 &&
      STTApi.playerData.character.events[0].content
   ) {
      currEvent = STTApi.playerData.character.events[0];
      let url : string | undefined = undefined;

      if (currEvent.opened && currEvent.opened_phase !== undefined) {
         url = currEvent.phases[currEvent.opened_phase].splash_image.file;
      }
      else if (currEvent.phases && currEvent.phases.length > 0) {
         url = currEvent.phases[0].splash_image.file;
      }
      if (url) {
         STTApi.imageProvider.getImageUrl(url, currEvent.id)
            .then(found => setEventImageUrl(found.url))
            .catch(error => {
               console.warn(error);
            });
      }
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
         <h2>{currEvent.name}</h2>
         { eventImageUrl &&
            <Image height='200px' src={eventImageUrl} />
         }
         <p>{currEvent.description}</p>

         <GalaxyEvent event={currEvent} />
         <ShuttleEvent event={currEvent} onTabSwitch={props.onTabSwitch} />
         <SkirmishEvent event={currEvent} onTabSwitch={props.onTabSwitch} />
         <ExpeditionEvent event={currEvent} onTabSwitch={props.onTabSwitch} />
      </div>
   );
}

export const EventCrewBonusTable = (props: {
   bonuses: { [crew_symbol: string]: number; };
   onlyBonusCrew?: boolean;
   hideBonus?: boolean;
}) => {
   const [sorted, setSorted] = React.useState([{ id: 'bonus', desc: true }] as SortingRule[]);
   const [filterText, setFilterText] = React.useState('');

   let columns = getColumns();

   let items: CrewData[] = []; // array of CrewData with additional 'bonus' field
   for (let cb in props.bonuses) {
      let avatar = STTApi.getCrewAvatarBySymbol(cb);
      if (!avatar) {
         continue;
      }

      let crews = STTApi.roster.filter(c => c.symbol === avatar!.symbol);
      if (!crews.length) {
         continue;
      }

      let bonusValue = props.bonuses[cb];
      let iconUrl = avatar.iconUrl;
      if (!iconUrl || iconUrl == '') {
         iconUrl = STTApi.imageProvider.getCrewCached(avatar, false);
      }

      crews.forEach(crew => {
         // override skills and skill data shallow copies and incorporate bonuses directly
         let skills = { ...crew.skills };
         for (let sk in CONFIG.SKILLS) {
            skills[sk] = {
               core: skills[sk].core * bonusValue,
               min: 0,
               max: 0,
               voy: 0
            };
         }
         let bonusCrew = {
            ...crew,
            // additional properties not in CrewData
            bonus: bonusValue,
            skills
         };

         items.push(bonusCrew);
      });
   }

   let bonusCrewCount = items.length;

   if (!props.onlyBonusCrew) {
      let allCrew = STTApi.roster.filter(c => !c.buyback);
      allCrew.forEach(owned => {
         let found = items.find(c => c.id === owned.id);
         if (!found) {
            items.push(owned);
         }
      });
   }

   if (filterText) {
      items = items.filter(i => filterCrew(i, filterText!.toLowerCase()))
   }

   function getColumns(showBuyBack?: boolean) {
      let _columns: Column<CrewData>[] = [];
      let compactMode = true;

      _columns.push({
         id: 'icon',
         Header: '',
         minWidth: compactMode ? 28 : 60,
         maxWidth: compactMode ? 28 : 60,
         resizable: false,
         accessor: 'name',
         Cell: (cell) => {
            if (cell && cell.original) {
               return <Image src={cell.original.iconUrl} width={compactMode ? 22 : 50} height={compactMode ? 22 : 50} imageFit={ImageFit.contain} shouldStartVisible={true} />;
            } else {
               return <span />;
            }
         },
      });

      if (!isMobile) {
         _columns.push({
            id: 'short_name',
            Header: 'Name',
            minWidth: 90,
            maxWidth: 110,
            resizable: true,
            accessor: 'short_name',
            Cell: (cell) => {
               if (cell && cell.original) {
                  return <a href={getCrewDetailsLink(cell.original)} target='_blank'>{cell.original.short_name}</a>;
               } else {
                  return <span />;
               }
            },
         });
      }

      _columns.push({
            id: 'name',
            Header: 'Full name',
            minWidth: 110,
            maxWidth: 190,
            resizable: true,
            accessor: 'name',
         },
         {
            id: 'level',
            Header: 'Level',
            minWidth: 40,
            maxWidth: 45,
            resizable: false,
            accessor: 'level',
            style: { 'textAlign': 'center' }
         },
         {
            id: 'rarity',
            Header: 'Rarity',
            // Sort all by max fusion level, then fractional part by current fusion level
            accessor: (obj) => obj.max_rarity + (obj.rarity / obj.max_rarity),
            minWidth: 75,
            maxWidth: 85,
            resizable: false,
            Cell: (cell) => {
               if (cell && cell.original) {
                  return <RarityStars min={1} max={cell.original.max_rarity} value={cell.original.rarity ? cell.original.rarity : null} />;
               } else {
                  return <span />;
               }
            },
         });

      if (!isMobile) {
         _columns.push({
            id: 'favorite',
            Header: () => <Icon iconName='FavoriteStar' />,
            minWidth: 30,
            maxWidth: 30,
            style: { paddingLeft: 0, paddingRight: 0, textAlign: 'center' },
            resizable: false,
            accessor: 'favorite',
            Cell: (cell) => {
               if (cell && cell.original && cell.value) {
                  return <Icon iconName='FavoriteStar' />;
               } else {
                  return <span />;
               }
            },
         });
      }

      let colsCore: Column<CrewData>[] = [];
      for (let sk in CONFIG.SKILLS_SHORT) {
         let head = CONFIG.SKILLS_SHORT[sk];
         colsCore.push({
            id: sk,
            Header: head,
            minWidth: 50,
            maxWidth: 70,
            resizable: true,
            accessor: (crew) => crew.skills[sk].core,
            Cell: (cell) => cell.original ? <SkillCell skill={cell.original.skills[sk]} compactMode={compactMode} /> : <span />,
         });
      }
      colsCore.sort((a, b) => (a.Header as string).localeCompare(b.Header as string));

      _columns.push(
         {
            id: 'frozen',
            Header: () => <Icon iconName='Snowflake' />,
            minWidth: 30,
            maxWidth: 30,
            style: { paddingLeft: 0, paddingRight: 0, textAlign: 'center' },
            resizable: false,
            accessor: 'frozen',
            Cell: (cell: any) => {
               if (cell && cell.value && cell.original) {
                  return <TooltipHost content={`You have ${(cell.value === 1) ? 'one copy' : `${cell.value} copies`} of ${cell.original.short_name} frozen (cryo-d)`} calloutProps={{ gapSpace: 0 }}>
                     {cell.value > 1 ? cell.value : ''}<Icon iconName='Snowflake' />
                  </TooltipHost>;
               } else {
                  return <span />;
               }
            },
         });
      if (!props.hideBonus) {
         _columns.push({
            id: 'bonus',
            Header: 'Bonus',
            minWidth: 50,
            maxWidth: 70,
            resizable: true,
            accessor: 'bonus',
            style: { 'textAlign': 'center' },
            Cell: cell => <span>{cell.value ? cell.value + 'x' : ''}</span>
         });
      }
      _columns.push(
         {
            id: 'active_id',
            Header: () => <Icon iconName='Balloons' />,
            minWidth: 30,
            maxWidth: 30,
            style: { paddingLeft: 0, paddingRight: 0, textAlign: 'center' },
            resizable: false,
            accessor: 'active_id',
            Cell: (cell) => {
               if (cell && cell.original && cell.original.active_id) {
                  let isShuttle = false;
                  STTApi.playerData.character.shuttle_adventures.forEach((shuttle) => {
                     if (shuttle.shuttles[0].id === cell.original.active_id) {
                        isShuttle = true;
                     }
                  });
                  return isShuttle ? 'S' : 'V';
               } else {
                  return <span />;
               }
            },
         },
         ...colsCore,
         {
            id: 'traits',
            Header: 'Traits',
            minWidth: 140,
            resizable: true,
            accessor: 'traits',
            Cell: (cell) => cell.original ? <div style={compactMode ? { overflow: 'hidden', textOverflow: 'ellipsis', height: '22px' } : { whiteSpace: 'normal', height: '50px' }}>{cell.original.traits.replace(/,/g, ', ')}</div> : <span />,
         });

      return _columns;
   }

   function filterCrew(crew: CrewData, searchString: string) {
      return searchString.split(';').some(segment => {
         if (segment.trim().length == 0) return false;
         return segment.split(' ').every(text => {
            if (text.trim().length == 0) return false;
            // search the name first
            if (crew.name.toLowerCase().indexOf(text) > -1) {
               return true;
            }

            // now search the traits
            if (crew.traits.toLowerCase().indexOf(text) > -1) {
               return true;
            }

            // now search the raw traits
            if (crew.rawTraits.find(trait => trait.toLowerCase().indexOf(text) > -1)) {
               return true;
            }

            if ((crew as any).bonus) {
               return ((crew as any).bonus == text);
            }

            return false;
         });
      });
   }

   return (<span>
      Owned Event Bonus Crew: {bonusCrewCount}
      <SearchBox placeholder='Search by name or trait...'
         onChange={(ev, newValue) => setFilterText(newValue ?? '')}
         onSearch={(newValue) => setFilterText(newValue)}
      />
      <div className='data-grid' data-is-scrollable='true'>
         <ReactTable
            data={items}
            columns={columns}
            defaultPageSize={(items.length <= 50) ? items.length : 50}
            pageSize={(items.length <= 50) ? items.length : 50}
            sorted={sorted}
            onSortedChange={sorted => setSorted(sorted)}
            showPagination={(items.length > 50)}
            showPageSizeOptions={false}
            className="-striped -highlight"
            style={(items.length > 50) ? { height: 'calc(100vh - 200px)' } : {}}
            getTrProps={(s: any, r: any) => {
               return {
                  style: {
                     opacity: (r && r.original && r.original.isExternal) ? "0.5" : "inherit"
                  }
               };
            }}
            getTdProps={(s: any, r: any) => {
               return { style: { padding: "2px 3px" } };
            }}
         />
      </div>
   </span>
   );
};
