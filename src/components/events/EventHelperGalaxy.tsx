import React from 'react';

import { Button, Item, Image, List, Accordion, Icon, AccordionTitleProps } from 'semantic-ui-react';

import { ItemDisplay } from '../ItemDisplay';

import STTApi, { CONFIG, RarityStars } from '../../api';
import { EventDTO, EventGatherPoolAdventureDTO, EVENT_TYPES, ItemArchetypeDTO, ItemData, CrewData, ItemArchetypeDemandDTO } from '../../api/DTO';
import { EventCrewBonusTable } from './EventHelperPage';
import ReactTable, { Column, SortingRule } from 'react-table';
import { getMissionCostDetails, MissionCostDetails } from '../../api/EquipmentTools';

interface ItemDemand {
   equipment: ItemArchetypeDTO;
   bestCrewChance: number;
   calcSlot: any;
   craftCost: number;
   have: number;
   itemDemands: {
      rd: ItemArchetypeDemandDTO;
      item?: ItemData;
   }[];
}

interface BonusCrew {
   crew: CrewData;
   crew_id: number;
   skills: { [sk:string]:number };
   total: number;
   chance: number;
   text?: string;
   value?: string;
   image?: string;
}

interface CalcSlot {
   bestCrew: BonusCrew[];
   skills: string[];
   type?: string;
}

interface FarmListItem {
   archetype: ItemArchetypeDTO;
   item?: ItemData;
   uses: string;
   sources: (MissionCostDetails & { chance: number; quotient: number; title: string })[]
}

function parseAdventure(adventure: EventGatherPoolAdventureDTO, crew_bonuses: { [crew_symbol: string]: number }): ItemDemand[] {
   function calcChance(skillValue: number) {
      const cc = STTApi.serverConfig!.config.craft_config;
      let midpointOffset = skillValue / STTApi.serverConfig!.config.craft_config.specialist_challenge_rating;

      let val = Math.floor(
         100 /
         (1 +
            Math.exp(
               -STTApi.serverConfig!.config.craft_config.specialist_chance_formula.steepness *
               (midpointOffset - STTApi.serverConfig!.config.craft_config.specialist_chance_formula.midpoint)
            ))
      );

      return Math.min(val / 100, STTApi.serverConfig!.config.craft_config.specialist_maximum_success_chance);
   };

   let demands: ItemDemand[] = [];
   adventure.demands.forEach((demand) => {
      let e = STTApi.itemArchetypeCache.archetypes.find(equipment => equipment.id === demand.archetype_id);
      if (!e || !e.recipe || !e.recipe.jackpot) {
         return;
      }

      let skills = e.recipe.jackpot.skills;

      let calcSlot: CalcSlot = {
         bestCrew: getRosterWithBonuses(crew_bonuses),
         skills: []
      };

      if (skills.length === 1) {
         // AND or single
         calcSlot.skills = skills[0].split(',');
         if (calcSlot.skills.length === 1) {
            calcSlot.type = 'SINGLE';
            calcSlot.bestCrew.forEach((c) => {
               c.total = c.skills[calcSlot.skills[0]];
            });
         } else {
            calcSlot.type = 'AND';
            calcSlot.bestCrew.forEach((c) => {
               c.total = Math.floor((c.skills[calcSlot.skills[0]] + c.skills[calcSlot.skills[1]]) / 2);
            });
         }
      } else {
         // OR
         calcSlot.type = 'OR';
         calcSlot.skills = skills;
         calcSlot.bestCrew.forEach((c) => {
            c.total = Math.max(c.skills[calcSlot.skills[0]], c.skills[calcSlot.skills[1]]);
         });
      }

      let seen = new Set<number>();
      calcSlot.bestCrew = calcSlot.bestCrew.filter((c) => c.total > 0).filter((c) => (seen.has(c.crew_id) ? false : seen.add(c.crew_id)));

      calcSlot.bestCrew.forEach(c => c.chance = calcChance(c.total));
      if (e.recipe.jackpot.trait_bonuses) {
         for (let trait in e.recipe.jackpot.trait_bonuses) {
            let tv = e.recipe.jackpot.trait_bonuses[trait];
            calcSlot.bestCrew.forEach(c => {
               if (c.crew.rawTraits.includes(trait)) {
                  c.chance += tv;
               }
            });
         }
      }

      calcSlot.bestCrew.sort((a, b) => a.chance - b.chance);
      calcSlot.bestCrew = calcSlot.bestCrew.reverse();

      let bestCrewChance = calcSlot.bestCrew[0].chance;

      calcSlot.bestCrew.forEach((c) => {
         c.text = `${c.crew.name} (${c.total})`;
         c.value = c.crew.symbol;
         c.image = c.crew.iconUrl;
      });

      bestCrewChance = Math.floor(Math.min(bestCrewChance, 1) * 100);

      let itemDemands: { rd: ItemArchetypeDemandDTO, item?: ItemData }[] = [];
      for (let rd of e.recipe.demands) {
         let item = STTApi.items.find(item => item.archetype_id === rd.archetype_id);
         itemDemands.push({
            rd,
            item
         });
      }

      let have = STTApi.items.find(item => item.archetype_id === e!.id);

      let craftCost = 0;
      if (e.type === 3) {
         craftCost = STTApi.serverConfig!.config.craft_config.cost_by_rarity_for_component[e.rarity].amount;
      } else if (e.type === 2) {
         craftCost = STTApi.serverConfig!.config.craft_config.cost_by_rarity_for_equipment[e.rarity].amount;
      } else {
         console.warn('Equipment of unknown type', e);
      }

      demands.push({
         equipment: e,
         bestCrewChance,
         calcSlot,
         craftCost,
         have: have ? have.quantity : 0,
         itemDemands
      });
   });

   return demands;
}

function getRosterWithBonuses(crew_bonuses: { [crew_symbol: string]: number }): BonusCrew[] {
   // TODO: share some of this code with Shuttles
   let sortedRoster: BonusCrew[] = [];
   STTApi.roster.forEach(crew => {
      if (crew.buyback) { // || crew.frozen > 0 || crew.active_id) {
         return;
      }

      let bonus = 1;
      if (crew_bonuses[crew.symbol]) {
         bonus = crew_bonuses[crew.symbol];
      }

      let skills: { [sk: string]: number } = {};
      for (let sk in CONFIG.SKILLS) {
         skills[sk] = crew.skills[sk].core * bonus;
      }

      sortedRoster.push({
         crew,
         crew_id: crew.id,
         skills,
         total: 0,
         chance: 0
      });
   });

   return sortedRoster;
}


const GalaxyAdventureDemand = (props: {
   onUpdate: () => void;
   demand: ItemDemand;
}) => {
   let demand = props.demand;
   let canCraft = false;//!demand.itemDemands.some((id: any) => !id.item);

   const crew = demand.calcSlot.bestCrew[0].crew;

   return (
      <Item>
         <Item.Image size='tiny' src={demand.equipment.iconUrl} />
         <Item.Content>
            <Item.Header>
               {demand.equipment.name} (have {demand.have})
            </Item.Header>
            <Item.Description>
               <div>
                  Best crew: <img src={crew.iconUrl} width='25' height='25' />&nbsp;
                  {crew.name}&nbsp;({demand.bestCrewChance}%)
                  {crew.frozen > 0 && <span> Frozen!</span>}
                  {crew.active_id && <span> Active!</span>}
               </div>
               <div>
                  {demand.itemDemands.map((id, index, all) =>
                     <div key={index} ><ItemDisplay src={id.item!.iconUrl!} style={{display: 'inline'}}
                        size={50} maxRarity={id.item!.rarity} rarity={id.item!.rarity} />{id.rd.count}x {id.item ? id.item.name : 'NEED'} (have {id.item ? id.item.quantity : 0}){
                           index === all.length-1 ? '' : ', '
                        }</div>)
                  }
               </div>
            </Item.Description>
            {/* <Item.Extra>
               <Button
                  floated='right'
                  disabled={!canCraft}
                  content={`Craft (${demand.craftCost} credits)`}
               />
            </Item.Extra> */}
         </Item.Content>
      </Item>
   );
}

const GalaxyAdventure = (props: {
   adventure: EventGatherPoolAdventureDTO;
   crew_bonuses: { [crew_symbol: string]: number };
}) => {
   let adventure_name = '';
   let adventure_demands : ItemDemand[] = [];

   const [, updateState] = React.useState();
   const forceUpdate = React.useCallback(() => updateState({}), []);

   if (!props.adventure.golden_octopus) {
      adventure_name = props.adventure.name;
      adventure_demands = parseAdventure(props.adventure, props.crew_bonuses);
   }

   // function _completeAdventure() {
   //    let activeEvent = STTApi.playerData.character.events[0];

   //    let pool = activeEvent.content.gather_pools[0].id;
   //    let event_instance_id = activeEvent.instance_id;
   //    let phase = activeEvent.opened_phase;
   //    let adventure = activeEvent.content.gather_pools[0].adventures[0].id;

   //    STTApi.executePostRequestWithUpdates('gather/complete', {
   //       event_instance_id: 134,
   //       phase: 0,
   //       pool: 142,
   //       adventure: 807
   //    });
   // }

   if (props.adventure.golden_octopus) {
      return <p>VP adventure TODO</p>;
   }

   return (
      <div style={{ padding: '10px' }}>
         <h4>{adventure_name}</h4>
         <Item.Group style={{display: 'inline-flex'}}>
            {adventure_demands.map(demand => (
               <GalaxyAdventureDemand
                  key={demand.equipment.name}
                  demand={demand}
                  onUpdate={() => forceUpdate()}
               />
            ))}
         </Item.Group>
      </div>
   );
}

export const GalaxyEvent = (props: {
   event: EventDTO;
}) => {
   let [activeIndex, setActiveIndex] = React.useState(-1);

   let crew_bonuses = [];
   let eventEquip = [];
   let farmList: FarmListItem[] = [];
   let currEvent: EventDTO = props.event;

   if (!props.event ||
      !props.event.content ||
      props.event.content.content_type !== EVENT_TYPES.GATHER ||
      !props.event.content.gather_pools
   ) {
      return <span />;
   }

   for (let cb in currEvent.content.crew_bonuses!) {
      let avatar = STTApi.getCrewAvatarBySymbol(cb);
      if (!avatar) {
         continue;
      }

      crew_bonuses.push({
         avatar,
         bonus: currEvent.content.crew_bonuses![cb],
         iconUrl: STTApi.imageProvider.getCrewCached(avatar, false)
      });
   }

   for (let e of STTApi.itemArchetypeCache.archetypes) {
      if (e.recipe && e.recipe.jackpot && e.recipe.jackpot.trait_bonuses) {
         let itemDemands = [];
         for (let rd of e.recipe.demands) {
            let item = STTApi.items.find(item => item.archetype_id === rd.archetype_id);
            let arc = STTApi.itemArchetypeCache.archetypes.find(a => a.id === rd.archetype_id);

            itemDemands.push({
               rd,
               item,
               item_name: item ? item.name : arc ? arc.name : '',
               item_quantity: item ? item.quantity : 0
            });
         }

         let have = STTApi.items.find(item => item.archetype_id === e.id);

         eventEquip.push({
            equip: e,
            have,
            itemDemands
         });
      }
   }

   let farmingList = new Map<number,string>();
   eventEquip.forEach(e =>
      e.itemDemands.forEach(id => {
         if (farmingList.has(id.rd.archetype_id)) {
            farmingList.set(id.rd.archetype_id, farmingList.get(id.rd.archetype_id)! + ',' + id.rd.count + 'x');
         } else {
            farmingList.set(id.rd.archetype_id, '' + id.rd.count + 'x');
         }
      })
   );

   farmingList.forEach((v, k) => {
      let archetype = STTApi.itemArchetypeCache.archetypes.find(a => a.id === k)!;

      const item = STTApi.items.find(item => item.archetype_id === k)!;
      farmList.push({
         archetype,
         item,
         uses: v,
         sources: item.sources
      });
   });

   // TODO: compare with future galaxy events
   let toSave = farmList.map(fl => ({ equipment_id: fl.archetype.id, equipment_symbol: fl.archetype.symbol, uses: fl.uses }));
   //console.log(toSave);

   // this.state = { event: currEvent, crew_bonuses, activeIndex: -1, eventEquip, farmList };
   // } else {
   // 	this.state = { event: undefined };

   function _handleClick(titleProps: AccordionTitleProps) {
      const { index } = titleProps;
      //const { activeIndex } = this.state;
      const newIndex = activeIndex === index ? -1 : index as number;

      //this.setState({ activeIndex: newIndex });
      setActiveIndex(newIndex);
   }

   let adventures = currEvent.content.gather_pools.length > 0 ? currEvent.content.gather_pools[0].adventures : undefined;

   // const { activeIndex, farmList, eventEquip } = this.state;
   return (
      <div>
         <h3>Galaxy event: {currEvent.name}</h3>

         <Accordion>
            <Accordion.Title active={activeIndex === 2} index={2} onClick={(e, titleProps) => _handleClick(titleProps)}>
               <Icon name='dropdown' />
               Crew bonuses
            </Accordion.Title>
            <Accordion.Content active={activeIndex === 2}>
               <List horizontal>
                  {crew_bonuses.map(cb => (
                     <List.Item key={cb.avatar.symbol}>
                        <Image avatar src={cb.iconUrl} />
                        <List.Content>
                           <List.Header>{cb.avatar.name}</List.Header>
                           Bonus level {cb.bonus}x
                        </List.Content>
                     </List.Item>
                  ))}
               </List>
            </Accordion.Content>
            <Accordion.Title active={activeIndex === 3} index={3} onClick={(e, titleProps) => _handleClick(titleProps)}>
               <Icon name='dropdown' />
               Owned Crew Bonus Table
            </Accordion.Title>
            <Accordion.Content active={activeIndex === 3}>
               <EventCrewBonusTable bonuses={currEvent.content.crew_bonuses!} />
            </Accordion.Content>
            <Accordion.Title active={activeIndex === 1} index={1} onClick={(e, titleProps) => _handleClick(titleProps)}>
               <Icon name='dropdown' />
               Event equipment requirements {eventEquip.length == 0 && '(Pending event start)'}
            </Accordion.Title>
            <Accordion.Content active={activeIndex === 1}>
               {eventEquip.map(e => (
                  <div key={e.equip.id}>
                     <h3>
                        {e.equip.name}
                     </h3>
                     <div>{e.itemDemands.map(id => `${id.item_name} x ${id.rd.count} (have ${id.item_quantity})`).join(', ')}</div>
                  </div>
               ))}
            </Accordion.Content>
            <Accordion.Title active={activeIndex === 0} index={0} onClick={(e, titleProps) => _handleClick(titleProps)}>
               <Icon name='dropdown' />
               Farming list for Galaxy event {farmList.length == 0 && '(Pending event start)'}
            </Accordion.Title>
            <Accordion.Content active={activeIndex === 0}>
               <FarmList farmList={farmList} />
            </Accordion.Content>
            <Accordion.Title active={activeIndex === 4} index={4} onClick={(e, titleProps) => _handleClick(titleProps)}>
               <Icon name='dropdown' />
               Active adventures in the pool
            </Accordion.Title>
            <Accordion.Content active={activeIndex === 4}>
               {adventures && adventures.filter(ad => !ad.golden_octopus).map((adventure) => (
                  <GalaxyAdventure key={adventure.name} adventure={adventure} crew_bonuses={currEvent!.content.crew_bonuses!} />
               ))}
               {adventures && adventures.filter(ad => ad.golden_octopus).map((adventure) => (
                  <GalaxyAdventure key={adventure.name} adventure={adventure} crew_bonuses={currEvent!.content.crew_bonuses!} />
               ))}
            </Accordion.Content>
         </Accordion>
      </div>
   );
}

const FarmList = (props: {
   farmList: FarmListItem[]
}) => {
   const [sorted, setSorted] = React.useState([{ id: 'quantity', desc: false }] as SortingRule[]);
   const MAX_PAGE_SIZE = 20;
   let columns = buildColumns();

   return <div className='data-grid' data-is-scrollable='true'>
         <ReactTable
            data={props.farmList}
            columns={columns}
            defaultPageSize={props.farmList.length <= MAX_PAGE_SIZE ? props.farmList.length : MAX_PAGE_SIZE}
            pageSize={props.farmList.length <= MAX_PAGE_SIZE ? props.farmList.length : MAX_PAGE_SIZE}
            sorted={sorted}
            onSortedChange={sorted => setSorted(sorted)}
            showPagination={props.farmList.length > MAX_PAGE_SIZE}
            showPageSizeOptions={false}
            className='-striped -highlight'
            style={props.farmList.length > MAX_PAGE_SIZE ? { height: 'calc(80vh - 88px)' } : {}}
         />
      </div>;

   function buildColumns() {
      let cols: Column<FarmListItem>[] = [
         {
            id: 'icon',
            Header: '',
            minWidth: 50,
            maxWidth: 50,
            resizable: false,
            sortable: false,
            accessor: (fli) => fli.archetype.name,
            Cell: (cell) => {
               let item : FarmListItem = cell.original;
               return <ItemDisplay src={item.archetype.iconUrl!} size={30} maxRarity={item.archetype.rarity} rarity={item.archetype.rarity}
               // onClick={() => this.setState({ replicatorTarget: found })}
               />;
            }
         },
         {
            id: 'name',
            Header: 'Name',
            minWidth: 130,
            maxWidth: 180,
            resizable: true,
            accessor: (fli) => fli.archetype.name,
            Cell: (cell) => {
               let item: FarmListItem = cell.original;
               return (
                  <a href={'https://stt.wiki/wiki/' + item.archetype.name.split(' ').join('_')} target='_blank'>
                     {item.archetype.name}
                  </a>
               );
            }
         },
         {
            id: 'rarity',
            Header: 'Rarity',
            accessor: (fli) => fli.archetype.rarity,
            minWidth: 80,
            maxWidth: 80,
            resizable: false,
            Cell: (cell) => {
               let item: FarmListItem = cell.original;
               return <RarityStars min={1} max={item.archetype.rarity} value={item.archetype.rarity} />;
            }
         },
         {
            id: 'quantity',
            Header: 'Have',
            minWidth: 50,
            maxWidth: 80,
            resizable: true,
            accessor: (fli:FarmListItem) => fli.item ? fli.item.quantity : 0,
         },
         {
            id: 'uses',
            Header: 'Uses',
            minWidth: 50,
            maxWidth: 50,
            resizable: true,
            accessor: 'uses',
         },
         {
            id: 'cost',
            Header: 'Farming Cost',
            minWidth: 50,
            maxWidth: 50,
            resizable: true,
            accessor: (fli) => fli.sources.length == 0 ? 0 : fli.sources.sort((a,b) => b.quotient - a.quotient)[0].quotient,
         },
         {
            id: 'sources',
            Header: 'Sources',
            minWidth: 400,
            maxWidth: 1000,
            resizable: true,
            sortable: false,
            Cell: (cell) => {
               let item: FarmListItem = cell.original;
               if (item.sources.length == 0) return '';
               return item.sources.sort((a,b) => b.quotient - a.quotient)
                  .map((src, idx, all) => src.title + (idx === all.length-1 ? '' : ', '));
            }
         }
      ];
      return cols;
   }
}
