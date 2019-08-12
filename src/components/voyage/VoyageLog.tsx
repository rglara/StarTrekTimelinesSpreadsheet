import React from 'react';
import Moment from 'moment';
import { Button, Icon, Popup } from 'semantic-ui-react';
import ReactTable from 'react-table';

import STTApi, { CONFIG, RarityStars, formatTimeSeconds, CollapsibleSection, download } from '../../api';
import { loadVoyage, recallVoyage, resolveDilemma } from './VoyageTools';
import { estimateVoyageRemaining, CalcRemainingOptions } from './voyageCalc';
import { VoyageLogEntry } from './VoyageLogEntry';
import { VoyageNarrativeDTO, VoyageDTO, CrewData } from '../../api/STTApi';

interface VoyageExportData {
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

interface VoyageLogProps {

}
interface VoyageLogState {
   includeFlavor: boolean;
   showSpinner: boolean,
   rewardTableColumns: any[],
   sorted: { id: string, desc: boolean }[];
   ship_name?: string;
   ship_id?: number;
   created_at?: string;
   voyage_duration?: number;
   seconds_since_last_dilemma?: number;
   seconds_between_dilemmas?: number;
   skill_aggregates?: any;
   crew_slots?: any[];
   voyage?: VoyageDTO;
   indexedNarrative?: { [index:number] : VoyageNarrativeDTO[] };
   skillChecks?: any;
   estimatedMinutesLeft?: number;
   estimatedMinutesLeftRefill?: number;
   nativeEstimate?: boolean;
   voyageRewards?: any[];
   voyageExport?: VoyageExportData;
}

export class VoyageLog extends React.Component<VoyageLogProps, VoyageLogState> {
   constructor(props: VoyageLogProps) {
      super(props);

      let _columns = [
         {
            id: 'icon',
            Header: '',
            minWidth: 30,
            maxWidth: 30,
            resizable: false,
            accessor: (row:any) => row.full_name,
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
         }
      ];

      this.state = {
         showSpinner: true,
         includeFlavor: false,
         rewardTableColumns: _columns,
         // By default, sort the voyage rewards table by type and rarity to show crew first
         sorted: [{ id: 'type', desc: false }, { id: 'rarity', desc: true }]
      };

      this.reloadVoyageState();
   }

   componentDidMount() {
      // Every 5 minutes refresh
      // TODO: this should be configurable
      const refreshInterval = 5 * 60;
      // this.intervalLogRefresh = setInterval(() => this.reloadVoyageState(), refreshInterval * 1000);
   }

   componentWillUnmount() {
      // clearInterval(this.intervalLogRefresh);
   }

   async reloadVoyageState() {
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
         if (!this.state.includeFlavor) {
            // Remove the "flavor" entries (useless text)
            voyageNarrative = voyageNarrative.filter(e => e.encounter_type !== 'flavor');
         }

         // compute skill check counts
         let skillChecks : {[k:string] : number[] } = voyageNarrative.reduce((r, a) => {
            if (a.skill_check && a.skill_check.skill && a.encounter_type === "hazard") {
               if (!r[a.skill_check.skill])
                  r[a.skill_check.skill] = [0, 0];
               r[a.skill_check.skill][0]++;
               if (a.skill_check.passed)
                  r[a.skill_check.skill][1]++;
               voyageExport.stats.skillChecks.times.push(a.event_time);
            }
            return r;
         }, Object.create(null));

         Object.keys(CONFIG.SKILLS).forEach(sk => {
            if (!skillChecks[sk]) {
               skillChecks[sk] = [0, 0];
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

         let attemptCount = Object.keys(skillChecks).map(k => skillChecks[k]).map(v => v[0]).reduce((p, c) => p + c);
         Object.keys(skillChecks).forEach(k => {
            let agg = voyage.skill_aggregates[k];
            voyageExport.skillAggregates.push({
               skill: k,
               core: agg.core,
               min: agg.range_min,
               max: agg.range_max,
               // Compute and export the "voyage skill" values displayed in the UI
               score: agg.core + (agg.range_min + agg.range_max) / 2,
               attempts: skillChecks[k][0],
               passed: skillChecks[k][1],
               passedPercent: skillChecks[k][1] / skillChecks[k][0],
               attemptsPercent: skillChecks[k][0] / attemptCount
            });
         });

         // Group by index
         let indexedNarrative = voyageNarrative.reduce((r, a) => {
            r[a.index] = r[a.index] || [];
            r[a.index].push(a);
            return r;
         }, Object.create(null));

         let voyageRewards = voyage.pending_rewards.loot;
         let iconPromises : any[] = [];
         voyageRewards.forEach((reward) => {
            reward.iconUrl = '';
            //TODO: why did this case come up?
            // if (reward.icon.atlas_info) {
            //    // This is not fool-proof, but covers currently known sprites
            //    reward.iconUrl = CONFIG.SPRITES[reward.icon.file].url;
            // } else {
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
            // }
         });

         await Promise.all(iconPromises);

         let ship_name = voyage.ship_name;
         if (!ship_name) {
            let ship = STTApi.ships.find((ship) => ship.id === voyage.ship_id);
            ship_name = ship ? ship.name : '-BUGBUG-';
         }

         this.setState({
            showSpinner: false,
            ship_name: ship_name,
            ship_id: voyage.ship_id,
            created_at: voyage.created_at,
            voyage_duration: voyage.voyage_duration,
            seconds_since_last_dilemma: voyage.seconds_since_last_dilemma,
            seconds_between_dilemmas: voyage.seconds_between_dilemmas,
            skill_aggregates: voyage.skill_aggregates,
            crew_slots: voyage.crew_slots,
            voyage: voyage,
            indexedNarrative: indexedNarrative,
            skillChecks: skillChecks,
            estimatedMinutesLeft: voyage.hp / 21,
            estimatedMinutesLeftRefill: voyage.hp / 21,
            nativeEstimate: false,
            voyageRewards: voyageRewards,
            voyageExport: voyageExport
         });

         // Avoid estimating if voyage is not ongoing
         if (voyage.state !== 'recalled' && voyage.state !== 'failed') {
            this._betterEstimate();
         }
      }
   }

   renderVoyageState() {
      if (!this.state.voyage) {
         return <div/>;
      }
      if (this.state.voyage.state === 'recalled') {
         return (
            <p>
               Voyage has lasted for {formatTimeSeconds(this.state.voyage_duration)} and it's currently returning (
               {formatTimeSeconds(this.state.voyage.recall_time_left)} left).
            </p>
         );
      } else if (this.state.voyage.state === 'failed') {
         return (
            <p>
               Voyage has run out of antimatter after {formatTimeSeconds(this.state.voyage_duration)} and it's waiting to be abandoned or
               replenished.
            </p>
         );
      } else {
         if (this.state.seconds_between_dilemmas === undefined ||
             this.state.seconds_since_last_dilemma === undefined ||
             this.state.estimatedMinutesLeft === undefined) {
            return <div/>;
         }
         const getDilemmaChance = (estimatedMinutesLeft: number) => {
            let minEstimate = (estimatedMinutesLeft * 0.75 - 1) * 60;
            let maxEstimate = estimatedMinutesLeft * 60;

            if (this.state.seconds_between_dilemmas === undefined || this.state.seconds_since_last_dilemma === undefined ) {
               return '0';
            }

            let chanceDilemma = (100 * (this.state.seconds_between_dilemmas - this.state.seconds_since_last_dilemma - minEstimate))
               / (maxEstimate - minEstimate);

            return (100 - Math.min(Math.max(chanceDilemma, 0), 100)).toFixed();
         };

         return (
            <div>
               <p>
                  Voyage has been ongoing for <b>{formatTimeSeconds(this.state.voyage_duration)}</b> (new dilemma in
                  {' '}{formatTimeSeconds(this.state.seconds_between_dilemmas - this.state.seconds_since_last_dilemma)}
                  {' '}at {Moment().add(this.state.seconds_between_dilemmas - this.state.seconds_since_last_dilemma, 's').format('h:mma')}).
               </p>

               <div className='ui blue label'>
                  Estimated time left: <b>{formatTimeSeconds(this.state.estimatedMinutesLeft * 60)}</b>
                  {' '}at {Moment().add(this.state.estimatedMinutesLeft, 'm').format('h:mma')}
                  {' '}{!this.state.nativeEstimate && <i className='spinner loading icon' />}
               </div>

               <button className='ui mini button' onClick={() => this._recall()}>
                  <i className='icon undo' />
                  Recall now
               </button>

               <p>There is an estimated {getDilemmaChance(this.state.estimatedMinutesLeft)}% chance for the voyage to reach next dilemma.</p>
            </div>
         );
      }
   }

   async _betterEstimate() {
      if (!this.state.voyage) {
         return;
      }
      const assignedCrew : number[] = this.state.voyage.crew_slots.map((slot) => slot.crew.id);
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
         voyage_duration: this.state.voyage.voyage_duration,
         remainingAntiMatter: this.state.voyage.hp,
         assignedCrew
      };

      estimateVoyageRemaining(options, (estimate:any) => {
         this.setState({ estimatedMinutesLeft: estimate });

         if (!this.state.voyage || !this.state.voyage.max_hp){
            return;
         }

         options.remainingAntiMatter += this.state.voyage.max_hp;
         estimateVoyageRemaining(options, (estimate: any) => {
            this.setState({ estimatedMinutesLeftRefill: estimate, nativeEstimate: true });
         });
      });
   }

   async _recall() {
      await recallVoyage(STTApi.playerData.character.voyage[0].id);
      this.reloadVoyageState();
   }

   async _chooseDilemma(voyageId: any, dilemmaId: any, index: any) {
      if (index < 0) {
         return;
      }
      await resolveDilemma(voyageId, dilemmaId, index);

      // Remove the dilemma that was just resolved
      STTApi.playerData.character.voyage[0].dilemma = null;

      this.reloadVoyageState();
   }

   renderDilemma() {
      if (!this.state.voyage) {
         return <div/>;
      }
      let voy = this.state.voyage;

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
                     {voy.dilemma.resolutions.map((resolution: any, index:number) => {
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
                                 onClick={() => this._chooseDilemma(voy.id, voy.dilemma.id, index)}>
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

   renderCrewSkills(crew: any) {
      return <span key={crew.id}>
         <RarityStars max={crew.max_rarity} value={crew.rarity} asSpan={true} colored={true} />
         &nbsp;
         {Object.keys(crew.skills).map(s => {
            return (<span key={s}><img src={CONFIG.SPRITES['icon_' + s].url} height={18} />
               {crew.skills[s].core} ({crew.skills[s].range_min}-{crew.skills[s].range_max})
            </span>);
         })}
      </span>
   }

   render() {
      if (this.state.showSpinner) {
         return (
            <div className='centeredVerticalAndHorizontal'>
               <div className='ui massive centered text active inline loader'>Loading voyage details...</div>
            </div>
         );
      }

      const defaultButton = (props: any) => (
         <Button {...props} style={{ width: '100%' }}>
            {props.children}
         </Button>
      );

      if (!this.state.voyage || !this.state.crew_slots) {
         return <div/>;
      }

      let voy = this.state.voyage;

      return (
         <div style={{ userSelect: 'initial' }}>
            <h3>Voyage on the {this.state.ship_name}</h3>
            {this.renderVoyageState()}
            {this.renderDilemma()}
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
                              {this.state.crew_slots.map((slot:any) => {
                                 let img = STTApi.roster.find(rosterCrew => rosterCrew.id == slot.crew.archetype_id);
                                 return (
                                    <li key={slot.symbol}>
                                       <span className='quest-mastery'>
                                          <img src={CONFIG.SPRITES['icon_' + slot.skill].url} height={18} /> &nbsp;
                                          {slot.name} &nbsp;{' '}
                                          <Popup flowing
                                             trigger={<span className='quest-mastery'>
                                                <img src={img ? img.iconUrl : ''} height={20} />{' '}
                                                &nbsp; {slot.crew.name}
                                             </span>}
                                             content={this.renderCrewSkills(slot.crew)}
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
                                       /> {this.state.skillChecks[skill.skill][1]}/{this.state.skillChecks[skill.skill][0]}
                                    </span>
                                 </li>
                              );
                           })}
                        </ul>
                     </td>
                  </tr>
               </tbody>
            </table>

            {this.state.voyageRewards && <span>
               <h3>{'Pending rewards (' + this.state.voyageRewards.length + ')'}</h3>
               <div className='voyage-rewards-grid'>
                  <ReactTable
                     data={this.state.voyageRewards}
                     columns={this.state.rewardTableColumns}
                     sorted={this.state.sorted}
                     onSortedChange={sorted => this.setState({ sorted })}
                     className='-striped -highlight'
                     defaultPageSize={10}
                     pageSize={10}
                     showPagination={this.state.voyageRewards.length > 10}
                     showPageSizeOptions={false}
                     NextComponent={defaultButton}
                     PreviousComponent={defaultButton}
                  />
               </div>
               <br />
               </span>
            }
            {this.state.indexedNarrative &&
               <CollapsibleSection title={"Complete Captain's Log (" + Object.keys(this.state.indexedNarrative).length + ')'}>
               {Object.keys(this.state.indexedNarrative).map(key => {
                  let v = this.state.indexedNarrative![+key];
                  return <VoyageLogEntry key={key} log={v} />;
               })}
               </CollapsibleSection>
            }
            <button className='ui mini button blue'
               onClick={() => download('narrative.' + voy.id + '.json',
                  JSON.stringify(this.state.voyageExport),
                  'Export voyage narrative JSON',
                  'Export',
                  false)}>
               Export Narrative JSON
            </button>

            <br />
         </div>
      );
   }
}
