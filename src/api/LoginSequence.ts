import STTApi from "./index";
import CONFIG from "./CONFIG";
import { buildCrewData, buildCrewDataAllFromDatacore } from '../components/crew/CrewTools';
import { matchShips } from './ShipTools';
import { loadMissionData } from './MissionTools';
import { loadFullTree, fixupAllCrewIds, getMissionCostDetails } from './EquipmentTools';
import { refreshAllFactions, loadFactionStore } from '../components/factions/FactionTools';
import { calculateMissionCrewSuccess, calculateMinimalComplementAsync } from './MissionCrewSuccess';
import { CrewData, ItemData, PotentialRewardDTO, RewardDTO } from "./DTO";

export async function loginSequence(onProgress: (description: string, subDesc?: string) => void) {
    let mainResources = [
        {
            loader: STTApi.loadCrewArchetypes.bind(STTApi),
            description: 'crew information'
        },
        {
            loader: STTApi.loadServerConfig.bind(STTApi),
            description: 'server configuration'
        },
        {
            loader: STTApi.loadPlatformConfig.bind(STTApi),
            description: 'platform configuration'
        },
        {
            loader: STTApi.loadShipSchematics.bind(STTApi),
            description: 'ship information'
        },
        {
            loader: STTApi.loadDatacore.bind(STTApi),
            description: 'datacore'
        },
        {
            loader: STTApi.loadEventBorrowableCrew.bind(STTApi),
            description: 'borrowable crew'
        },
        {
            loader: STTApi.loadPlayerData.bind(STTApi),
            description: 'player data'
        }
    ];

    let fleetResources = [
        {
            loader: STTApi.loadFleetMemberInfo.bind(STTApi),
            description: 'fleet members'
        },
        {
            loader: STTApi.loadFleetData.bind(STTApi),
            description: 'fleet data'
        },
        {
            loader: STTApi.loadStarbaseData.bind(STTApi),
            description: 'starbase data'
        }
    ];


    onProgress('Loading Main Resources...');
    let mainPromises: Array<Promise<void>> = mainResources.map(res => {
        console.log(` - Processing ${res.description}`);
        return res.loader();
    });
    await Promise.all(mainPromises);

    if (STTApi.playerData.fleet && STTApi.playerData.fleet.id != 0) {
        onProgress('Loading Fleet Resources...');
        let fleetPromises: Array<Promise<void>> = fleetResources.map(res => {
            console.log(` - Processing ${res.description}`);
            return res.loader(STTApi.playerData.fleet.id);
        });
        await Promise.all(fleetPromises);
    }

    onProgress('Loading Missions and Quests...');
    // Filter out missions in a bad state
    STTApi.playerData.character.accepted_missions = STTApi.playerData.character.accepted_missions
        .filter(mission => mission.main_story);
    let ms = [...STTApi.playerData.character.cadet_schedule.missions,
              ...STTApi.playerData.character.accepted_missions];
    let missions = await loadMissionData(ms, STTApi.playerData.character.dispute_histories);
    STTApi.missions = missions;

    onProgress('Analyzing Crew...');
    STTApi.roster = await buildCrewData(STTApi.playerData.character);

    onProgress('Calculating Mission Success', 'Stats for Crew...');
    STTApi.missionSuccess = calculateMissionCrewSuccess();
    calculateMinimalComplementAsync();

    const updateProgress = async (label: string, key: string, promise: Promise<void>) => {
        if (!key) {
            onProgress(label);
        } else {
            onProgress(label, `(${key})`);
        }
        await promise.catch((error: any) => { /*console.warn(error);*/ });
    };

    onProgress('Loading Crew Images...');
    for (let rosterCrew of STTApi.roster) {
        if (rosterCrew.iconUrl === '') {
            rosterCrew.iconUrl = STTApi.imageProvider.getCrewCached(rosterCrew, false);
            if (rosterCrew.iconUrl === '') {
                await updateProgress('Loading Crew Images...', rosterCrew.name,
                    STTApi.imageProvider.getCrewImageUrl(rosterCrew, false)
                        .then(found => { rosterCrew.iconUrl = found.url; }));
            }
        }

        if (rosterCrew.iconBodyUrl === '') {
            rosterCrew.iconBodyUrl = STTApi.imageProvider.getCrewCached(rosterCrew, true);
            if (rosterCrew.iconBodyUrl === '') {
                await updateProgress('Loading Crew Images...', rosterCrew.name,
                    STTApi.imageProvider.getCrewImageUrl(rosterCrew, true)
                        .then(found => { rosterCrew.iconBodyUrl = found.url; }));
            }
        }
    }

    // Also load the avatars for crew not in the roster
    for (let avatar of STTApi.crewAvatars) {
        avatar.iconUrl = STTApi.imageProvider.getCrewCached(avatar, false);
        if (avatar.iconUrl === '') {
            await updateProgress('Loading Crew Images...', avatar.name,
                STTApi.imageProvider.getCrewImageUrl(avatar, false)
                    .then(found => { avatar.iconUrl = found.url; }));
        }
    }

    onProgress('Loading Ships...');
    STTApi.ships = await matchShips(STTApi.playerData.character.ships);

    onProgress('Loading Faction Rewards...');
    await refreshAllFactions();
    let rewardItemIds = new Map<string, Set<number>>();
    const scanRewards = (name: string, potential_rewards?: (PotentialRewardDTO | RewardDTO)[]) => {
        if (!potential_rewards)
            return;
        potential_rewards.forEach(reward => {
            if ((reward as PotentialRewardDTO).potential_rewards) {
                scanRewards(name, (reward as PotentialRewardDTO).potential_rewards);
            } else if (reward.type === 2) {
                rewardItemIds.get(name)!.add((reward as RewardDTO).id);
            }
        });
    };
    STTApi.playerData.character.factions.forEach(f => {
        rewardItemIds.set(f.name, new Set());
        scanRewards(f.name, f.shuttle_mission_rewards);
    });

    onProgress('Loading Inventory Images...');
    STTApi.items = [];
    for (const itemDTO of STTApi.playerData.character.items) {
        try {
            let item : ItemData = {
                ...itemDTO,
                factions: [],
                iconUrl: STTApi.imageProvider.getCached(itemDTO),
                //typeName = itemDTO.icon.file.replace("/items", "").split("/")[1];
                //symbol2 = itemDTO.icon.file.replace("/items", "").split("/")[2];
                sources: []
            };
            STTApi.items.push(item);

            //NOTE: this used to overwrite the DTO's symbol; is it needed?
            //itemDTO.symbol = itemDTO.icon.file.replace("/items", "").split("/")[2];

            if (item.iconUrl === '') {
                await updateProgress('Loading Item Images...', item.name,
                    STTApi.imageProvider.getItemImageUrl(item, item.id)
                        .then(found => { item.iconUrl = found.url || ''; }));
            }

            item.cadetable = '';
            const cadetSources = STTApi.getEquipmentManager().getCadetableItems().get(item.archetype_id);
            if (cadetSources) {
                cadetSources.forEach(v => {
                    let name = v.mission.episode_title;
                    let mastery = v.masteryLevel;

                    let questName = v.quest.action;
                    let questIndex = null;
                    v.mission.quests.forEach((q, i) => {
                        if (q.id === v.quest.id)
                            questIndex = i + 1;
                    });

                    if (item.cadetable)
                        item.cadetable += ' | ';
                    item.cadetable += name + ' : ' + questIndex + ' : ' + questName + ' : ' + CONFIG.MASTERY_LEVELS[mastery].name;

                    // const costDetails = getMissionCostDetails(v.quest.id, mastery);
                    item.sources.push({
                        chance: 0,
                        quotient: 0,
                        title: name + ' #' + questIndex + ' ' + CONFIG.MASTERY_LEVELS[mastery].name + ' (' + questName + ')',
                            // + '[' + entry.chance_grade + '/5 @ ' +
                            // costDetails.cost + ' Chrons (q=' + (Math.round(entry.energy_quotient * 100) / 100) + ')]',
                        type: 'cadet',
                        mission: v.mission,
                        quest: v.quest,
                    });
                });
            }

            let iter = rewardItemIds.entries();
            for (let n = iter.next(); !n.done; n = iter.next()) {
                let e = n.value;
                if (e[1].has(item.archetype_id)) {
                    item.factions.push(e[0]);
                }
                n = iter.next();
            }

            const archetype = STTApi.itemArchetypeCache.archetypes.find(a => a.id === item.archetype_id);
            if (archetype) {
                const missions = archetype.item_sources.filter(e => e.type === 0 || e.type === 1 || e.type === 2);
                const sources = missions.map((entry, idx) => {
                    const chance = entry.chance_grade / 5;
                    const quotient = entry.energy_quotient;
                    if (entry.type == 1) {
                        return {
                            chance,
                            quotient: 0,
                            title: entry.name,
                            type: 'faction'
                        };
                    }
                    const costDetails = getMissionCostDetails(entry.id, entry.mastery);
                    let title = '';
                    if (costDetails.mission && costDetails.quest && costDetails.cost && costDetails.questMastery) {
                        const qoff = costDetails.mission.quests.indexOf(costDetails.quest) + 1;
                        const missionTitle = costDetails.mission.description.length > costDetails.mission.episode_title.length ?
                            costDetails.mission.episode_title : costDetails.mission.description;
                        title = missionTitle + ' #' + qoff + ' '+CONFIG.MASTERY_LEVELS[costDetails.questMastery.id].name+' (' + costDetails.quest.name + ')[' + entry.chance_grade + '/5 @ ' + costDetails.cost + ' Chrons (q=' + (Math.round(entry.energy_quotient * 100) / 100) + ')]';
                    }
                    return {
                        ...costDetails,
                        chance,
                        quotient,
                        title,
                        type: entry.type === 0 ? 'dispute' : 'ship'
                    };
                });
                const filtered = sources.filter(s => s.title !== '');
                filtered.forEach(src => item.sources.push(src));
            }
            //console.log('Item: ' + item.name + ' rarity:' + item.rarity + ' sym:' + item.symbol + ' aid:' + item.archetype_id + ' iid:' + item.id
            // + (' srcs:' + item.sources.map((src, idx, all) => src.title +'-' + src.type + (idx === all.length - 1 ? '' : ', '))));
        }
        catch (e) {
            console.error(e);
        }
    }

    onProgress('Loading Faction and Faction Store Images...');
    for (let faction of STTApi.playerData.character.factions) {
        await updateProgress('', '', loadFactionStore(faction));
    }

    onProgress('Compiling Crew Data...');
    try {
        STTApi.allcrew = buildCrewDataAllFromDatacore(STTApi.datacore ?? []);
    }
    catch (e) {
        console.error(e);
        STTApi.allcrew = [];
    }

    // Also load the avatars for crew not in the roster
    onProgress('Loading Supplemental Crew...');
    for (let crew of STTApi.allcrew) {
        crew.iconUrl = STTApi.imageProvider.getCrewCached(crew, false);
        if (crew.iconUrl === '') {
            await updateProgress('Loading Supplemental Crew...', crew.name,
                STTApi.imageProvider.getCrewImageUrl(crew, false)
                    .then(found => { crew.iconUrl = found.url; }));
        }
    }

    onProgress('Loading Equipment...');
    if (STTApi.inWebMode) {
        // In web mode we already augmented the itemarchetypes with whatever we had cached, just try to fix stuff up here
        fixupAllCrewIds();
    } else {
        await loadFullTree(onProgress, false);
    }

    // We no longer need to keep these around
    STTApi.allcrew.forEach((crew: CrewData) => {
        crew.archetypes = [];
    });

    onProgress('Loading Equipment Images...');
    for (let equipment of STTApi.itemArchetypeCache.archetypes) {
        equipment.iconUrl = STTApi.imageProvider.getCached(equipment);
        if (equipment.iconUrl === '') {
            await updateProgress('Loading Equipment Images...', equipment.name,
                STTApi.imageProvider.getItemImageUrl(equipment, equipment.id)
                    .then(found => { equipment.iconUrl = found.url; }));
        }
    }

    onProgress('Loading Sprites...');
    for (let sprite in CONFIG.SPRITES) {
        CONFIG.SPRITES[sprite].url = STTApi.imageProvider.getSpriteCached(CONFIG.SPRITES[sprite].asset, sprite);
        if (CONFIG.SPRITES[sprite].url === '') {
            await updateProgress('', sprite,
                STTApi.imageProvider.getSprite(CONFIG.SPRITES[sprite].asset, sprite, sprite)
                    .then(found => { CONFIG.SPRITES[found.id].url = found.url; }));
        }
    }
}
