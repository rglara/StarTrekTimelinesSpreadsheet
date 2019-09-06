import React from 'react';
import ReactTable, { Column, SortingRule } from 'react-table';
import { isMobile } from 'react-device-detect';
import { Image, ImageFit } from 'office-ui-fabric-react/lib/Image';
import { Icon } from 'office-ui-fabric-react/lib/Icon';
import { TooltipHost } from 'office-ui-fabric-react/lib/Tooltip';
import { SearchBox } from 'office-ui-fabric-react/lib/SearchBox';

import { EventDTO, CrewData } from "../../api/STTApi";
import STTApi, { RarityStars } from '../../api';
import { SkillCell } from '../crew/SkillCell';

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

   const [sorted, setSorted] = React.useState([{ id: 'name', desc: false }] as SortingRule[]);
   const [filterText, setFilterText] = React.useState('');

   let crew_bonuses = [];
   let items : CrewData[] = [];
   for (let cb in props.event.content.shuttles[0].crew_bonuses) {
      let avatar = STTApi.getCrewAvatarBySymbol(cb);
      if (!avatar) {
         continue;
      }

      let crew = STTApi.roster.find(c => c.symbol === avatar!.symbol);
      if (!crew) {
         continue;
      }

      let bonusValue = props.event.content.shuttles[0].crew_bonuses[cb];

      let bonusCrew = {
         ...crew,
         bonus: bonusValue + 'x',
         // override skills and skill data shallow copies and incorporate bonuses directly
         command_skill: {...crew.command_skill, core: crew.command_skill.core * bonusValue },
         diplomacy_skill: { ...crew.diplomacy_skill, core: crew.diplomacy_skill.core * bonusValue },
         security_skill: { ...crew.security_skill, core: crew.security_skill.core * bonusValue },
         medicine_skill: { ...crew.medicine_skill, core: crew.medicine_skill.core * bonusValue },
         engineering_skill: { ...crew.engineering_skill, core: crew.engineering_skill.core * bonusValue },
         science_skill: { ...crew.science_skill, core: crew.science_skill.core * bonusValue },
      };

      let iconUrl = avatar.iconUrl;
      if (!iconUrl || iconUrl == '') {
         iconUrl = STTApi.imageProvider.getCrewCached(avatar, false);
      }
      crew_bonuses.push({
         crew,
         bonus: bonusValue,
         iconUrl
      });
      items.push(bonusCrew);
   }

   let allCrew = STTApi.roster.filter(c => !c.buyback);
   allCrew.forEach(owned => {
      let found = items.find(c => c.id === owned.id);
      if (!found) {
         items.push(owned);
      }
   });

   function renderCrewBonusTable() {

      let columns = getColumns();

      if (filterText) {
         items = items.filter(i => filterCrew(i, filterText!.toLowerCase()))
      }

      return (<span>
         <SearchBox placeholder='Search by name or trait...'
            onChange={(newValue) => setFilterText(newValue)}
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
               style={(items.length > 50) ? { height: 'calc(100vh - 230px)' } : {}}
               getTrProps={(s: any, r: any) => {
                  return {
                     style: {
                        opacity: (r && r.original && r.original.isExternal) ? "0.5" : "inherit"
                     }
                  };
               }}
               getTdProps={(s: any, r: any) => {
                  return { style: { padding: "2px 3px" }};
               }}
               />
         </div>
      </span>
      );
   }

   function getColumns(showBuyBack ?: boolean) {
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
                  return <a href={'https://stt.wiki/wiki/' + cell.original.name.split(' ').join('_')} target='_blank'>{cell.original.short_name}</a>;
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
         },
         {
            id: 'bonus',
            Header: 'Bonus',
            minWidth: 50,
            maxWidth: 70,
            resizable: true,
            accessor: 'bonus',
            style: {'textAlign': 'center'}
         },
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
         {
            id: 'command_skill',
            Header: 'COM',
            minWidth: 50,
            maxWidth: 70,
            resizable: true,
            accessor: (crew) => crew.command_skill.core,
            Cell: (cell) => cell.original ? <SkillCell skill={cell.original.command_skill} compactMode={compactMode} /> : <span />,
         },
         {
            id: 'diplomacy_skill',
            Header: 'DIP',
            minWidth: 50,
            maxWidth: 70,
            resizable: true,
            accessor: (crew) => crew.diplomacy_skill.core,
            Cell: (cell) => cell.original ? <SkillCell skill={cell.original.diplomacy_skill} compactMode={compactMode} /> : <span />,
         },
         {
            id: 'engineering_skill',
            Header: 'ENG',
            minWidth: 50,
            maxWidth: 70,
            resizable: true,
            accessor: (crew) => crew.engineering_skill.core,
            Cell: (cell) => cell.original ? <SkillCell skill={cell.original.engineering_skill} compactMode={compactMode} /> : <span />,
         },
         {
            id: 'medicine_skill',
            Header: 'MED',
            minWidth: 50,
            maxWidth: 70,
            resizable: true,
            accessor: (crew) => crew.medicine_skill.core,
            Cell: (cell) => cell.original ? <SkillCell skill={cell.original.medicine_skill} compactMode={compactMode} /> : <span />,
         },
         {
            id: 'science_skill',
            Header: 'SCI',
            minWidth: 50,
            maxWidth: 70,
            resizable: true,
            accessor: (crew) => crew.science_skill.core,
            Cell: (cell) => cell.original ? <SkillCell skill={cell.original.science_skill} compactMode={compactMode} /> : <span />,
         },
         {
            id: 'security_skill',
            Header: 'SEC',
            minWidth: 50,
            maxWidth: 70,
            resizable: true,
            accessor: (crew) => crew.security_skill.core,
            Cell: (cell) => cell.original ? <SkillCell skill={cell.original.security_skill} compactMode={compactMode} /> : <span />,
         },
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

   return <div><h2>Shuttle Event Details</h2>
      <div style={{ margin: '0' }}>
         <span>
            <div>{props.event.bonus_text}</div>
            Owned Event Bonus Crew: {crew_bonuses.length}
            { renderCrewBonusTable() }
         </span>
      </div>
   </div>;
}
