import React from 'react';
import Moment from 'moment';
import { Button, Icon, Popup } from 'semantic-ui-react';
import ReactTable, { SortingRule } from 'react-table';

import STTApi, { CONFIG, RarityStars, formatTimeSeconds, CollapsibleSection, download, CrewSkills } from '../../api';
import { loadVoyage, recallVoyage, resolveDilemma } from './VoyageTools';
import { estimateVoyageRemaining, CalcRemainingOptions } from './voyageCalc';
import { VoyageLogEntry } from './VoyageLogEntry';
import { VoyageNarrativeDTO, VoyageDTO, CrewData, RewardDTO } from '../../api/DTO';
import { CrewImageData } from '../images/ImageProvider';

type VoyageExportData = {
   id: number;
   skills: any;
   skillAggregates: any[];
   stats: {
      skillChecks: {
         times: number[];
         average: number;
      };
      rewards: {
         times: number[];
         average: number;
      };
   };
   narrative: VoyageNarrativeDTO[],
}

type IndexedNarrative = {
   [index: number]: VoyageNarrativeDTO[]
};
type SkillChecks = {
   [skill: string]: { att: number; passed: number; }
};

export const VoyageLog = (props:{}) => {
   const [voyage, setVoyage] = React.useState(undefined as VoyageDTO | undefined);
   const [showSpinner, setShowSpinner] = React.useState(true);
   const [includeFlavor, setIncludeFlavor] = React.useState(false);
   // By default, sort the voyage rewards table by type and rarity to show crew first
   const [sorted, setSorted] = React.useState([{ id: 'type', desc: false }, { id: 'rarity', desc: true }] as SortingRule[]);
   const [shipName, setShipName] = React.useState(undefined as string | undefined);
   const [estimatedMinutesLeft, setEstimatedMinutesLeft] = React.useState(undefined as number | undefined);
   //const [estimatedMinutesLeftRefill, setEstimatedMinutesLeftRefill] = React.useState(undefined as number | undefined);
   const [nativeEstimate, setNativeEstimate] = React.useState(undefined as boolean | undefined);
   const [voyageRewards, setVoyageRewards] = React.useState(undefined as RewardDTO[] | undefined);
   const [voyageExport, setVoyageExport] = React.useState(undefined as VoyageExportData | undefined);
   const [indexedNarrative, setIndexedNarrative] = React.useState(undefined as IndexedNarrative | undefined);
   const [skillChecks, setSkillChecks] = React.useState(undefined as SkillChecks | undefined);

   const reloadVoyageState = async () => {
      let voyage : VoyageDTO = STTApi.playerData.character.voyage[0];
      if (voyage && voyage.id) {
         let voyageNarrative = await loadVoyage(voyage.id, false);
         let voyageExport: VoyageExportData = {
            id: voyage.id,
            skills: voyage.skills,
            skillAggregates: [],
            stats: {
               skillChecks: {
                  times: [],
                  average: 0
               },
               rewards: {
                  times: [],
                  average: 0,
               },
            },
            narrative: voyageNarrative,
         };

         //<Checkbox checked={this.state.includeFlavor} label="Include flavor entries" onChange={(e, isChecked) => { this.setState({ includeFlavor: isChecked }); }} />
         if (!includeFlavor) {
            // Remove the "flavor" entries (useless text)
            voyageNarrative = voyageNarrative.filter(e => e.encounter_type !== 'flavor');
         }

         // compute skill check counts
         let skillChecks : SkillChecks = voyageNarrative.reduce((r, a) => {
            if (a.skill_check && a.skill_check.skill && a.encounter_type === "hazard") {
               if (!r[a.skill_check.skill])
                  r[a.skill_check.skill] = { att: 0, passed: 0 };
               r[a.skill_check.skill].att++;
               if (a.skill_check.passed)
                  r[a.skill_check.skill].passed++;
               voyageExport.stats.skillChecks.times.push(a.event_time);
            }
            return r;
         }, Object.create(null) as SkillChecks);

         Object.keys(CONFIG.SKILLS).forEach(sk => {
            if (!skillChecks[sk]) {
               skillChecks[sk] = { att: 0, passed: 0 };
            }
         });

         voyageNarrative.filter(e => e.encounter_type === "reward").forEach(v => {
            voyageExport.stats.rewards.times.push(v.event_time);
         });

         // at index "index", need to subtract "gap" from all times >=
         let timeGaps : { gap: number; index: number; }[] = [];

         voyageNarrative.forEach((e, i:number, ee) => {
            if (i > 1 && ee[i - 1].encounter_type === "dilemma" && e.encounter_type !== "dilemma") {
               let timelost = e.event_time - ee[i - 1].event_time;
               timeGaps.push({ gap: timelost, index: e.index })
               // find the next
            }
         });

         if (voyageExport.stats.skillChecks.times.length > 1) {
            voyageExport.stats.skillChecks.average = voyageExport.stats.skillChecks.times
               .map((v, i:number, vv) => i == 0 ? 0 : v - vv[i - 1])
               .reduce((a, b) => a + b)
               / voyageExport.stats.skillChecks.times.length;
         }
         if (voyageExport.stats.rewards.times.length > 1) {
            voyageExport.stats.rewards.average = voyageExport.stats.rewards.times
               .map((v, i:number, vv) => i == 0 ? 0 : v - vv[i - 1])
               .reduce((a, b) => a + b)
               / voyageExport.stats.rewards.times.length;
         }

         let attemptCount = Object.keys(skillChecks).map(k => skillChecks[k]).map(v => v.att).reduce((p, c) => p + c);
         Object.keys(skillChecks).forEach(k => {
            let agg = voyage.skill_aggregates[k];
            voyageExport.skillAggregates.push({
               skill: k,
               core: agg.core,
               min: agg.range_min,
               max: agg.range_max,
               // Compute and export the "voyage skill" values displayed in the UI
               score: agg.core + (agg.range_min + agg.range_max) / 2,
               attempts: skillChecks[k].att,
               passed: skillChecks[k].passed,
               passedPercent: skillChecks[k].passed / skillChecks[k].att,
               attemptsPercent: skillChecks[k].att / attemptCount
            });
         });

         // Group by index
         let indexedNarrative: IndexedNarrative = voyageNarrative.reduce((r, a) => {
            r[a.index] = r[a.index] || [];
            r[a.index].push(a);
            return r;
         }, Object.create(null) as IndexedNarrative);

         //Note: pending_rewards is not updated unless a full player data refresh occurs, so
         //      pull rewards out of the narrative instead of this structure
         let voyageRewards: RewardDTO[] = [];//voyage.pending_rewards.loot;

         voyageNarrative.filter(n => n.rewards && n.rewards.loot)
            .map(n => n.rewards!.loot)
            .reduce((all, loot) => {
               loot.forEach(r => {
                  let found = all.find(item => item.id === r.id);
                  if (found) {
                     found.quantity += r.quantity;
                  }
                  else {
                     all.push({...r});
                  }
               });
               return all;
            }, voyageRewards);
         let iconPromises : any[] = [];
         voyageRewards.forEach((reward) => {
            reward.iconUrl = '';
            if (reward.type === 1) { // crew
               iconPromises.push(STTApi.imageProvider.getCrewImageUrl(reward as CrewImageData, false)
                     .then(found => {
                        reward.iconUrl = found.url;
                     })
                     .catch(error => {
                        /*console.warn(error);*/
                     })
               );
            } else {
               iconPromises.push(
                  STTApi.imageProvider
                     .getItemImageUrl(reward, reward.id)
                     .then(found => {
                        reward.iconUrl = found.url;
                     })
                     .catch(error => {
                        /*console.warn(error);*/
                     })
               );
            }
         });

         await Promise.all(iconPromises);

         let ship_name = voyage.ship_name;
         if (!ship_name) {
            let ship = STTApi.ships.find((ship) => ship.id === voyage.ship_id);
            ship_name = ship ? ship.name : '-BUGBUG-';
         }

         setShowSpinner(false);
         setShipName(ship_name);
         setVoyage(voyage);
         setEstimatedMinutesLeft(voyage.hp / 21);
         //setEstimatedMinutesLeftRefill(voyage.hp / 21);
         setIndexedNarrative(indexedNarrative);
         setSkillChecks(skillChecks);
         setNativeEstimate(false);
         setVoyageRewards(voyageRewards);
         setVoyageExport(voyageExport);

         // Avoid estimating if voyage is not ongoing
         if (voyage.state !== 'recalled' && voyage.state !== 'failed') {
            betterEstimate(voyage);
         }
      }
   }

   const betterEstimate = async (voyage: VoyageDTO) => {
      if (!voyage) {
         return;
      }
      const assignedCrew : number[] = voyage.crew_slots.map((slot) => slot.crew.id);
      const assignedRoster : CrewData[] = STTApi.roster.filter(crew => assignedCrew.includes(crew.crew_id || crew.id));

      //TODO: need to do any validation here to prevent the native code from crashing
      if (assignedRoster.length == 0) {
         console.log('Unable to estimate; roster is empty');
         return;
      }

      let options : CalcRemainingOptions = {
         // first three not needed for estimate calculation
         searchDepth: 0,
         extendsTarget: 0,
         shipAM: 0,
         skillPrimaryMultiplier: 3.5,
         skillSecondaryMultiplier: 2.5,
         skillMatchingMultiplier: 1.1,
         traitScoreBoost: 200,
         voyage_description: STTApi.playerData.character.voyage_descriptions[0],
         roster: assignedRoster,
         // Estimate-specific parameters
         voyage_duration: voyage.voyage_duration,
         remainingAntiMatter: voyage.hp,
         assignedCrew
      };

      estimateVoyageRemaining(options, (estimate) => {
         setEstimatedMinutesLeft(estimate);
         setNativeEstimate(true);

         if (!voyage || !voyage.max_hp){
            return;
         }

         //TODO: to estimte including a single refill
         // options.remainingAntiMatter += voyage.max_hp;
         // estimateVoyageRemaining(options, (estimate: any) => {
         //    setEstimatedMinutesLeftRefill(estimate);
         //    setNativeEstimate(true);
         // });
      });
   }

   const recall = async () => {
      await recallVoyage(STTApi.playerData.character.voyage[0].id);
      reloadVoyageState();
   }

   React.useEffect(() => {
      reloadVoyageState();
   }, []);

   if (showSpinner) {
      return (
         <div className='centeredVerticalAndHorizontal'>
            <div className='ui massive centered text active inline loader'>Loading voyage details...</div>
         </div>
      );
   }

   if (!voyage || !voyage.crew_slots) {
      return <div/>;
   }

   const defaultButton = (props: any) => (
      <Button {...props} style={{ width: '100%' }}>
         {props.children}
      </Button>
   );

   const rewardTableColumns = getColumns();
   let voy = voyage;

   return <div style={{ userSelect: 'initial' }}>
         <h3>Voyage on the {shipName}</h3>
         <VoyageState
            voyage={voyage}
            estimatedMinutesLeft={estimatedMinutesLeft}
            nativeEstimate={nativeEstimate}
            recall={recall} />
         <VoyageDilemma voyage={voyage} reload={reloadVoyageState} />
         <p>
            Antimatter remaining: {voy.hp} / {voy.max_hp}.
         </p>
         <table style={{ borderSpacing: '0' }}>
            <tbody>
               <tr>
                  <td>
                     <section>
                        <h4>Full crew complement and skill aggregates</h4>
                        <ul>
                           {
                           // map by voyage description slots because they are sorted
                           STTApi.playerData.character.voyage_descriptions[0].crew_slots.map((dslot) => {
                              const slot = voyage.crew_slots.find(s => s.symbol === dslot.symbol)!;
                              const crew = STTApi.roster.find(c => c.crew_id === slot.crew.id)!;
                              return (
                                 <li key={slot.symbol}>
                                    <span className='quest-mastery'>
                                       <img src={CONFIG.SPRITES['icon_' + slot.skill].url} height={18} /> &nbsp;
                                       {slot.name} &nbsp;{' '}
                                       <Popup flowing
                                          trigger={<span className='quest-mastery'>
                                             <img src={crew.iconUrl} height={20} />{' '}
                                             &nbsp; {crew.name}
                                          </span>}
                                          content={<CrewSkills crew={crew} useIcon={true} asVoyScore={true} addVoyTotal={true} />}
                                       />
                                    </span>
                                 </li>
                              );
                           })}
                        </ul>
                     </section>
                  </td>
                  <td>
                     <ul>
                        {Object.keys(voy.skill_aggregates).map(k => voy.skill_aggregates[k]).map(skill => {
                           let isPri = skill.skill == voy.skills.primary_skill;
                           let isSec = skill.skill == voy.skills.secondary_skill;
                           return (
                              <li key={skill.skill}>
                                 <span className='quest-mastery'>
                                    <img src={CONFIG.SPRITES['icon_' + skill.skill].url} height={18} /> &nbsp; {skill.core} ({skill.range_min}-
                                    {skill.range_max})&nbsp;[{skill.core + (skill.range_min + skill.range_max) / 2}]&nbsp;
                                    {isPri ? ' (Pri) ' : ''}
                                    {isSec ? ' (Sec) ' : ''}
                                    &nbsp;
                                    <Popup
                                       trigger={<span style={isPri ? { color: CONFIG.RARITIES[5].color } : isSec ? { color: CONFIG.RARITIES[1].color } : {}}><Icon name='thumbs up' /></span>}
                                       content="Skill checks passed"
                                    /> {skillChecks && skillChecks![skill.skill].passed + '/' + skillChecks![skill.skill].att}
                                 </span>
                              </li>
                           );
                        })}
                     </ul>
                  </td>
               </tr>
            </tbody>
         </table>

         {voyageRewards && <span>
            <h3>{'Pending rewards (' + voyageRewards.length + ')'}</h3>
            <div style={{ maxWidth: '750px'}}>
               <ReactTable
                  data={voyageRewards}
                  columns={rewardTableColumns}
                  sorted={sorted}
                  onSortedChange={sorted => setSorted(sorted)}
                  className='-striped -highlight'
                  defaultPageSize={10}
                  pageSize={10}
                  showPagination={voyageRewards.length > 10}
                  showPageSizeOptions={false}
                  NextComponent={defaultButton}
                  PreviousComponent={defaultButton}
               />
            </div>
            <br />
            </span>
         }
         {indexedNarrative &&
            <CollapsibleSection title={"Complete Captain's Log (" + Object.keys(indexedNarrative).length + ')'}>
            {Object.keys(indexedNarrative).map(key => {
               let v = indexedNarrative[+key];
               return <VoyageLogEntry key={key} log={v} />;
            })}
            </CollapsibleSection>
         }
         <button className='ui mini button blue'
            onClick={() => download('narrative.' + voy.id + '.json',
               JSON.stringify(voyageExport),
               'Export voyage narrative JSON',
               'Export',
               false)}>
            Export Narrative JSON
         </button>

         <br />
      </div>;

   function getColumns() {
      return [
         {
            id: 'icon',
            Header: '',
            minWidth: 30,
            maxWidth: 30,
            resizable: false,
            accessor: (row: any) => row.full_name,
            Cell: (p: any) => <img src={p.original.iconUrl} height={25} />
         },
         {
            id: 'quantity',
            Header: 'Quantity',
            minWidth: 50,
            maxWidth: 70,
            resizable: false,
            accessor: (row: any) => row.quantity
         },
         {
            id: 'name',
            Header: 'Name',
            minWidth: 150,
            maxWidth: 250,
            resizable: true,
            accessor: (row: any) => row.full_name,
            Cell: (p: any) => {
               let item = p.original;
               return (
                  <a href={'https://stt.wiki/wiki/' + item.full_name.split(' ').join('_')} target='_blank'>
                     {item.full_name}
                  </a>
               );
            }
         },
         {
            id: 'rarity',
            Header: 'Rarity',
            accessor: (c: any) => {
               if (c.type > 2) {
                  return -1;
               }
               return c.rarity;
            },
            minWidth: 75,
            maxWidth: 75,
            resizable: false,
            Cell: (p: any) => {
               let item = p.original;
               // 3 is for honor, credits, crons
               if (item.type > 2) {
                  return <span />;
               }

               return (
                  <span key={item.id}>
                     <RarityStars max={item.rarity ? item.rarity : 1} value={item.rarity ? item.rarity : null} colored={true} />
                  </span>
               );
            }
         },
         {
            id: 'type',
            Header: 'Type',
            minWidth: 100,
            resizable: true,
            accessor: (row: any) => {
               if (row.item_type) {
                  return row.type + '.' + row.item_type;
               }
               return row.type;
            },
            Cell: (p: any) => {
               let item = p.original;

               if (item.type === 1) {
                  // For crew, check if it's useful or not
                  let have = STTApi.roster.filter(crew => crew.symbol === item.symbol);
                  if (have.length > 0) {
                     if (have.some(c => c.frozen > 0)) {
                        return <span>Duplicate of frozen crew (airlock-able)</span>;
                     }
                     if (have.some(c => c.max_rarity === c.rarity)) {
                        return <span>Duplicate of fully-fused crew (airlock-able)</span>;
                     }

                     return <span style={{ fontWeight: 'bold' }}>NEW STAR FOR CREW!</span>;
                  }
                  return <span style={{ fontWeight: 'bold' }}>NEW CREW!</span>;
               }

               let typeName = CONFIG.REWARDS_ITEM_TYPE[item.item_type];
               if (typeName) {
                  return typeName;
               }
               typeName = CONFIG.REWARDS_TYPE[item.type];
               if (typeName) {
                  return typeName;
               }

               // fall-through case for items
               typeName = item.icon.file.replace('/items', '').split('/')[1];
               if (typeName) {
                  return typeName;
               }

               // show something so we know to fix these
               if (item.item_type) {
                  return item.type + '.' + item.item_type;
               }
               return item.type;
            }
         }];
   }
}

const VoyageState = (props: {
   voyage?: VoyageDTO;
   estimatedMinutesLeft?: number;
   nativeEstimate?: boolean;
   recall: () => void;
}) => {
   if (!props.voyage) {
      return <div />;
   }
   if (props.voyage.state === 'recalled') {
      return (
         <p>
            Voyage has lasted for {formatTimeSeconds(props.voyage.voyage_duration)} and it's currently returning (
               {formatTimeSeconds(props.voyage.recall_time_left)} left).
            </p>
      );
   } else if (props.voyage.state === 'failed') {
      return (
         <p>
            Voyage has run out of antimatter after {formatTimeSeconds(props.voyage.voyage_duration)} and it's waiting to be abandoned or
            replenished.
            </p>
      );
   } else {
      if (props.voyage.seconds_between_dilemmas === undefined ||
         props.voyage.seconds_since_last_dilemma === undefined ||
         props.estimatedMinutesLeft === undefined) {
         return <div />;
      }
      const getDilemmaChance = (estimatedMinutesLeft: number) => {
         let minEstimate = (estimatedMinutesLeft * 0.75 - 1) * 60;
         let maxEstimate = estimatedMinutesLeft * 60;

         if (props.voyage!.seconds_between_dilemmas === undefined || props.voyage!.seconds_since_last_dilemma === undefined) {
            return '0';
         }

         let chanceDilemma = (100 * (props.voyage!.seconds_between_dilemmas - props.voyage!.seconds_since_last_dilemma - minEstimate))
            / (maxEstimate - minEstimate);

         return (100 - Math.min(Math.max(chanceDilemma, 0), 100)).toFixed();
      };

      return (
         <div>
            <p>
               Voyage has been ongoing for <b>{formatTimeSeconds(props.voyage.voyage_duration)}</b> (new dilemma in
                  {' '}{formatTimeSeconds(props.voyage.seconds_between_dilemmas - props.voyage.seconds_since_last_dilemma)}
               {' '}at {Moment().add(props.voyage.seconds_between_dilemmas - props.voyage.seconds_since_last_dilemma, 's').format('h:mma')}).
               </p>

            <div className='ui blue label'>
               Estimated time left: <b>{formatTimeSeconds(props.estimatedMinutesLeft * 60)}</b>
               {' '}at {Moment().add(props.estimatedMinutesLeft, 'm').format('h:mma')}
               {' '}{!props.nativeEstimate && <i className='spinner loading icon' />}
            </div>

            <button className='ui mini button' onClick={() => props.recall()}>
               <i className='icon undo' />
               Recall now
               </button>

            <p>There is an estimated {getDilemmaChance(props.estimatedMinutesLeft)}% chance for the voyage to reach next dilemma.</p>
         </div>
      );
   }
}

const VoyageDilemma = (props: {
   voyage?: VoyageDTO;
   reload: () => void;
}) => {
   async function chooseDilemma(voyageId: any, dilemmaId: any, index: any) {
      if (index < 0) {
         return;
      }
      await resolveDilemma(voyageId, dilemmaId, index);

      // Remove the dilemma that was just resolved
      STTApi.playerData.character.voyage[0].dilemma = undefined;

      props.reload();
   }

   if (!props.voyage) {
      return <div />;
   }
   let voy = props.voyage;

   if (voy.dilemma && voy.dilemma.id) {
      return (
         <div>
            <h3 key={0} className='ui top attached header'>
               Dilemma - <span dangerouslySetInnerHTML={{ __html: voy.dilemma.title }} />
            </h3>
            ,
               <div key={1} className='ui center aligned inverted attached segment'>
               <div>
                  <span dangerouslySetInnerHTML={{ __html: voy.dilemma.intro }} />
               </div>
               <div className='ui middle aligned selection list inverted'>
                  {voy.dilemma.resolutions.map((resolution: any, index: number) => {
                     if (resolution.locked) {
                        return (
                           <div className='item' key={index}>
                              <div className='content'>
                                 <div className='header'>
                                    LOCKED - <span dangerouslySetInnerHTML={{ __html: resolution.option }} />
                                 </div>
                              </div>
                           </div>
                        );
                     } else {
                        return (
                           <div
                              className='item'
                              key={index}
                              onClick={() => chooseDilemma(voy.id, voy.dilemma!.id, index)}>
                              <img src={CONFIG.SPRITES['icon_' + resolution.skill].url} height={18} />
                              <div className='content'>
                                 <div className='header'>
                                    <span dangerouslySetInnerHTML={{ __html: resolution.option }} />
                                 </div>
                              </div>
                           </div>
                        );
                     }
                  })}
               </div>
            </div>
         </div>
      );
   } else {
      return <span />;
   }
}
