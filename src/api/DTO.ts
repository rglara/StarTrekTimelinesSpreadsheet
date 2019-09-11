/**
 * This file lists the data transfer objects used to communicate with the STT server.
 */

export interface CrewAvatar {
   id: number;
   symbol: string;
   name: string;
   short_name: string;
   max_rarity: number;
   traits: string[];
   traits_hidden: string[];
   skills: string[];
   default_avatar: boolean;
   full_body: ImageDataDTO;
   icon: ImageDataDTO;
   portrait: ImageDataDTO;

   hide_from_cryo: boolean;

   // These properties are added by the app
   iconUrl?: string;
}

export interface ImageDataDTO {
   file: string;
}

export interface SkillDTO {
   core: number;
   range_min: number;
   range_max: number;
}
export interface SkillData {
   core: number;
   min: number;
   max: number;
   voy?: number;
}

export interface CrewActionDTO {
   ability?: {
      amount: number;
      condition: number;
      type: number;
   };
   bonus_amount: number;
   bonus_type: number;
   charge_phases?: { charge_time: number; ability_amount: number; }[];
   cooldown: number;
   crew: number;
   duration: number;
   icon: ImageDataDTO;
   initial_cooldown: number;
   limit?: number;
   name: string;
   special: boolean;
   symbol: string;
}

export interface CrewDTO {
   action: CrewActionDTO;
   active_id: any;
   active_index: number;
   active_status: number;
   archetype_id: number;
   base_skills: { [sk: string]: SkillDTO; };
   cap_achiever: {
      date: number;
      name: string;
   };

   cross_fuse_targets: any;
   default_avatar: boolean;
   equipment: number[][];
   equipment_rank: number;
   equipment_slots: {
      level: number;
      archetype: number;
   }[];
   expires_in: any;
   favorite: boolean;
   flavor: string;
   full_body: ImageDataDTO;
   icon: ImageDataDTO;
   id: number;
   in_buy_back_state: boolean;
   level: number;
   max_equipment_rank: number;
   max_level: number;
   max_rarity: number;
   max_xp: number;
   name: string;
   passive_id: any;
   passive_index: number;
   passive_status: number;
   portrait: ImageDataDTO;
   rarity: number;
   ship_battle: {
      accuracy: number;
      crit_bonus: number;
      crit_chance: number;
      evasion: number;
   };
   short_name: string;
   skills: { [sk: string]: SkillDTO; };
   symbol: string;
   traits: string[];
   traits_hidden: string[];
   voice_over: any;
   xp: number;
   xp_for_current_level: number;
   xp_for_next_level: number;

   // These properties are added by the app
   //TODO: where is this needed?
   /** @deprecated */
   archetypes?: any;
}

export interface CrewData {

   full_body: ImageDataDTO;
   id: number;
   crew_id?: number;
   active_id?: number;
   level: number;
   max_level?: number;
   max_rarity: number;
   name: string;
   portrait: ImageDataDTO;
   rarity: number;
   short_name: string;
   skills: { [sk: string]: SkillData; };
   //TODO: deprecate these raw fields and use the indexed 'skills' structure
   command_skill: SkillData;
   diplomacy_skill: SkillData;
   engineering_skill: SkillData;
   medicine_skill: SkillData;
   science_skill: SkillData;
   security_skill: SkillData;
   command_skill_core?: number;
   diplomacy_skill_core?: number;
   engineering_skill_core?: number;
   medicine_skill_core?: number;
   science_skill_core?: number;
   security_skill_core?: number;
   command_skill_voy?: number;
   diplomacy_skill_voy?: number;
   engineering_skill_voy?: number;
   medicine_skill_voy?: number;
   science_skill_voy?: number;
   security_skill_voy?: number;

   symbol: string;
   traits: string;
   rawTraits: string[];

   isExternal: boolean;
   frozen: number;
   buyback: boolean;

   iconUrl?: string;
   iconBodyUrl?: string;
   expires_in?: number;
   favorite?: boolean;
   usage_value?: number;
   voyage_score?: number;
   gauntlet_score?: number;

   ship_battle?: any;
   action?: any;
   flavor?: string;
   equipment_slots: {
      archetype: number;
      level: number;
      symbol?: any;
      have?: boolean;
   }[];

   archetypes?: any[];
}

export interface GauntletDTO {
   bracket_id: string;
   consecutive_wins: number;
   contest_data: {
      featured_skill: string;
      primary_skill: string;
      secondary_skill: string;
      traits: string[];
      selected_crew: GauntletCrewDTO[];

      contest_rewards: any[];
      ranked_rewards: any[];
      crit_chance_per_trait: number;
   };

   gauntlet_id: number;
   jackpot_crew: string;
   opponents: GauntletOpponentDTO[];

   rank: number;
   score: number;
   seconds_to_end: number;
   seconds_to_join?: number; // only if gauntlet has not started
   seconds_to_next_crew_refresh: number;
   seconds_to_next_opponent_refresh: number;
   state: string;
   refresh_cost: { currency: number; amount: number };
   revive_and_save_cost: { currency: number; amount: number };
   revive_cost: { currency: number; amount: number };
}

export interface GauntletCrewDTO {
   archetype_symbol: string;
   crew_id: number;
   crit_chance: number;
   debuff: number;
   disabled: boolean;
   level: number;
   max_rarity: number;
   rarity: any; // huh? came in as boolean
   selected: boolean;
   skills: { min: number; max: number; skill: string }[];

   /** @deprecated Added by app, but unused? */
   iconUrl?: any;
}

export interface GauntletOpponentDTO {
   crew_contest_data: { crew: GauntletCrewDTO[]; };
   icon: ImageDataDTO;
   level: number;
   name: string;
   player_id: number;
   rank: number;
   value: number;
}

export interface GauntletContestDTO {
   player_rolls: number[];
   player_crit_rolls: boolean[];
   opponent_rolls: number[];
   opponent_crit_rolls: boolean[];
   opponent_score: number;
   opponent_value: number;
   value: number;
   win: boolean;
   action: string;
   loot_box_rarity: number;
}

export interface GauntletContestLootDTO {
   flavor: string;
   full_name: string;
   icon: ImageDataDTO;
   id: number;
   instance: { bucket: string; id: number; };
   name: string;
   quantity: number;
   rarity: number;
   symbol: string;
   type: number;
}

export interface VoyageUpdateDTO {
   hp: number;
   id: number;
   seconds_since_last_dilemma: number;
   state: string;
   time_to_next_event: number;
   voyage_duration: number;
}

export const VOYAGE_ENCOUNTER_TYPES: string[] = ['flavor', 'reward', 'reward_found', 'hazard', 'hp_change', 'dilemma'];
export interface VoyageNarrativeDTO {
   index: number;
   text: string;
   encounter_type: string; // one of VOYAGE_ENCOUNTER_TYPES
   event_time: number
   crew?: string[];
   skill_check?: { skill: string; passed: boolean; };
   rewards?: { loot: RewardDTO[] };
}

export interface RewardDTO {
   action?: CrewActionDTO;
   bonuses?: { [key: number]: number };
   flavor: string;
   full_body?: ImageDataDTO;
   full_name: string;
   hash_key?: string;
   icon: ImageDataDTO;
   id: number;
   item_type?: number; // defined if type == 2
   name: string;
   portrait?: ImageDataDTO;
   quantity: number;
   rarity: number;
   skills?: { [skill: string]: SkillDTO; };
   symbol: string;
   traits?: string[];
   type: number;
}

export interface VoyagePendingLootDTO {
   flavor: string;
   full_name: string;
   icon: ImageDataDTO;
   id: number;
   item_type?: number;
   name: string;
   quantity: number;
   rarity: number;
   symbol: string;
   type: number;
   action?: CrewActionDTO;
   full_body?: ImageDataDTO;
   portrait?: ImageDataDTO;
   skills?: { [skill: string]: SkillDTO; };
   traits?: string[];

   //TODO: added by the app?
   iconUrl?: string;
}

export interface VoyageDTO {
   completed_at: any; // was null; probably a string
   created_at: string;
   crew_slots: {
      crew: CrewDTO;
      name: string;
      skill: string;
      symbol: string;
      trait: string;
   }[];
   description: string; // seems to be unused
   dilemma?: any;
   first_leave: boolean;
   granted_rewards: any; // was null
   hp: number;
   icon: string;
   id: number;
   log_index: number;
   max_hp: number;
   name: string; // seems to be unused
   pending_rewards: { loot: VoyagePendingLootDTO[] };
   recalled_at: string;
   recall_time_left?: number;
   seconds_between_dilemmas: number;
   seconds_since_last_dilemma: number;
   seed: number;
   ship_id: number;
   ship_name: string;
   ship_trait: string;
   skill_aggregates: { [sk: string]: { skill: string; core: number; range_min: number; range_max: number; } };
   skills: { primary_skill: string; secondary_skill: string; };
   speedup_cost?: { currency: number; amount: number; };
   state: string;
   time_to_next_event: number;
   voyage_duration: number;
}

export interface VoyageDescriptionDTO {
   crew_slots: {
      name: string;
      skill: string;
      symbol: string;
      trait: string;
   }[];
   description: string;
   icon: string; // unused?
   id: number; // unused?
   name: string; // unused?
   potential_rewards: any[];
   ship_trait: string;
   skills: { primary_skill: string; secondary_skill: string; };
   symbol: string; // unused?
}

export interface PlayerDTO {
   character: PlayerCharacterDTO;
   chats: any;
   commerce: any;
   community_links: any;
   currency_exchanges: any;
   dbid: number;
   display_name: string;
   entitlements: any;
   environment: any;
   fleet: any;
   fleet_invite: any;
   honor: number;
   id: number;
   lang: string;
   locale: string;
   mailbox: any;
   money: number;
   motd: any;
   npe_complete: boolean;
   premium_earnable: number;
   premium_purchasable: number;
   replicator_limit: number;
   replicator_uses_today: number;
   shuttle_rental_tokens: number;
   squad: { id: number; rank: string; };
   timezone: string;
   vip_level: number;
   vip_points: number;
}

export interface PlayerCharacterDTO {
   accepted_missions: any[];
   active_conflict: any; // null
   boost_windows: any[];
   cadet_schedule: any;
   cadet_tickets: any;
   can_purchase_crew_limit_increase: boolean;
   can_purchase_shuttle_bay: boolean;
   crew: CrewDTO[];
   crew_avatar: any;
   crew_borrows: any[];
   crew_collection_buffs: any[];
   crew_limit: number;
   crew_limit_increase_per_purchase: number;
   crew_shares: any[];
   cryo_collections: CryoCollectionDTO[];
   current_ship_id: number;
   daily_activities: any[];
   daily_rewards_state: any;
   destination: any;
   display_name: string;
   dispute_histories: any[];
   disputes: any[];
   event_tickets: any;
   events: EventDTO[];
   factions: FactionDTO[];
   fleet_activities: any[];
   freestanding_quests: any[];
   gauntlets?: GauntletDTO[]; // Does not come with initial fetch, but gauntlet update is within character
   honor_reward_by_rarity: number[];
   id: number;
   item_limit: number;
   items: ItemDTO[];
   level: number;
   location: { place: string; setup: string; system: string; x: number; y: number; };
   location_channel_prefix: string;
   max_level: number;
   navmap: any;
   next_crew_limit_increase_cost: { currency: number; amount: number; };
   next_daily_activity_reset: number;
   next_fleet_activity_reset: number;
   next_shuttle_bay_cost: any;
   next_starbase_donation_reset: number;
   open_packs: any[];
   pvp_divisions: any[];
   pvp_tickets: any;
   pvp_timer: any;
   replay_energy_max: number;
   replay_energy_overflow: number;
   replay_energy_rate: number;
   reroll_descriptions: any[];
   scan_speedups_today: number;
   seasons: any;
   seconds_from_last_boost_claim: number;
   seconds_from_replay_energy_basis: number;
   seconds_to_scan_cooldown: number;
   ships: ShipDTO[];
   shuttle_adventures: PlayerShuttleAdventureDTO[];
   shuttle_bayse: number;
   starbase_buffs: any[];
   stimpack: any; // null
   stored_immortals: { id: number; quantity: number; }[];
   tng_the_game_level: number;
   tutorials: any[];
   using_default_name: boolean;
   video_ad_chroniton_boost_reward: any;
   voyage: VoyageDTO[];
   voyage_descriptions: VoyageDescriptionDTO[];
   voyage_summaries: any;
   xp: number;
   xp_for_current_level: number;
   xp_for_next_level: number;
}

export interface PlayerShuttleAdventureDTO {
   challenge_rating: number;
   completes_in_seconds: number;
   faction_id: number;
   id: number;
   name: string;
   shuttles: PlayerShuttleDTO[];
   symbol: string;
   token_archetype_id: any; // null
   x: number;
   y: number;
}

export interface PlayerShuttleDTO {
   description: string;
   expires_in: number;
   faction_id: number
   id: number;
   is_rental: boolean;
   name: string;
   rewards: ShuttleRewardDTO[];
   slots: {
      level: any;
      required_trait: any;
      skills: string[];
      trait_bonuses: any;
   }[];
   state: number;
}

export interface FactionDTO {
   completed_shuttle_adventures: number;
   discovered: any; // number/bool
   event_winner_rewards: any[];
   home_system: string;
   icon: ImageDataDTO;
   id: number;
   name: string;
   representative_full_body: ImageDataDTO;
   representative_icon: ImageDataDTO;
   reputation: number;
   reputation_icon: ImageDataDTO;
   reputation_item_icon: ImageDataDTO;
   shop_layout: string;
   shuttle_mission_rewards: (PotentialRewardDTO | RewardDTO)[];
   shuttle_token_id: number;
   shuttle_token_preview_item: any;

   //HACK: added by app
   iconUrl?: string;
   storeItems?: FactionStoreItemDTO[];
}

export interface FactionStoreItemDTO {
   cost: { amount: number; currency: string; };
   count: number;
   info: string;
   lock_prereq: any;
   locked: boolean;
   offer: {
      cost: { amount: number; currency: string; };
      currency_bundle: string;
      game_item: RewardDTO;
      obtain: any;
      purchase_avail: number;
      purchase_limit: number;
   };
   symbol: string;
   type: string;
}

export interface ShipDTO {
   accuracy: number;
   actions: any[];
   antimatter: number;
   archetype_id: number;
   attack: number;
   attacks_per_second: number;
   battle_stations: any[];
   crit_bonus: number;
   crit_chance: number;
   evasion: number;
   flavor: string;
   hull: number;
   icon: ImageDataDTO;
   id: number;
   level: number;
   max_level: number;
   model: string;
   name: string;
   rarity: number;
   schematic_gain_cost_next_level: number;
   schematic_icon: ImageDataDTO;
   schematic_id: number;
   shield_regen: number;
   shields: number;
   symbol: string;
   traits: string[];
   traits_hidden: string;

   //Added by app
   traitNames?: string;
   iconUrl?: string;
}

export interface ShipSchematicDTO {
   cost: number;
   icon: ImageDataDTO;
   id: number;
   rarity: number;

   //HACK: using fields of ship DTO, but some fields are not provided by the schematic version
   ship: ShipDTO;
   // {
   // 	accuracy: number;
   // 	actions: any[];
   // 	antimatter: number;
   // 	archetype_id: number;
   // 	attack: number;
   // 	attacks_per_second: number;
   // 	crit_bonus: number;
   // 	crit_chance: number;
   // 	evasion: number;
   // 	flavor: string;
   // 	hull: number;
   // 	icon: ImageDataDTO;
   // 	max_level: number;
   // 	name: string;
   // 	rarity: number;
   // 	shield_regen: number;
   // 	shields: number;
   // 	symbol: string;
   // 	traits: string[];
   // 	traits_hidden: string;
   // };
}

export interface ItemArchetypeDTO {
   bonuses?: { [key: number]: number };
   flavor: string;
   icon: ImageDataDTO;
   id: number;
   //TODO: type details
   item_sources: any[];
   name: string;
   rarity: number;
   //TODO: type details
   recipe: any;
   short_name?: string;
   symbol: string;
   type: number;

   //HACK: added by the app
   iconUrl?: string;
}

export interface ItemDTO {
   archetype_id: number;
   expires_in: any;
   flavor: string;
   icon: ImageDataDTO;
   id: number;
   name: string;
   quantity: number;
   rarity: number;
   symbol: string;
   type: number;

   //HACK: added by app
   iconUrl?: string;
   //typeName?: string;
   cadetable?: string;
   factions?: string;
}

export interface CryoCollectionDTO {
   claimable_milestone_index: number;
   description: string;
   extra_crew: number[];
   id: number;
   image: string;
   milestone: { rewards: any[]; goal: number; buffs: any[]; };
   name: string;
   progress: number;
   traits: string[];
   type_id: number;

   //HACK: added by the app
   iconUrl?: string;
}

export interface PlatformConfigDTO {
   crew_exp_trainings: any[];
   faction_config: {
      reputation_buckets: {
         name: string;
         upper_bound?: number;
         status: string;
      }[];
   };
   honorable_citations: any[];
   id: number;
   platform: any;
   replicator_config: {
      currency_costs: { amount: number; currency: number; }[];
      fuel_blacklist: number[];
      fuel_costs: { item_type: number; rarity: number; fuel: number; }[];
      fuel_values: { item_type: number; rarity: number; fuel: number; }[];
      target_blacklist: number[];
   };
   ship_trait_names: { [trait: string]: string };
   trait_names: { [trait: string]: string };
   vip: any;
}

export interface ServerConfigDTO {
   asset_bundle_version: string;
   asset_force_cache_clean: any; // number/bool? came as 0
   asset_server: string;
   conflict: { tired_crew_coefficient: number; untrained_skill_coefficient: number; };
   craft_config: {
      cost_by_rarity_for_component: { currency: number; amount: number; }[];
      cost_by_rarity_for_equipment: { currency: number; amount: number; }[];
      recipe_tree: {
         digest: string;
         recipes: {
            id: number;
            recipe: {
               archetype_id: number;
               count: number;
            }[];
         }[];
      };
      specialist_challenge_rating: number;
      specialist_chance_formula: any;
      specialist_failure_bonus: number;
      specialist_maximum_success_chance: number;
   };
   crew_config: { fusion_cost_by_rarity: any[] };
   custom_event_batch_batch_limit: number;
   custom_event_batch_delay_period: number;
   default_galaxy_map_position: number[];
   default_galaxy_map_zoom: number;
   features_unlock_config: any;
   flag_for_voyage_death: number;
   fusion_costs: any;
   hazard_countdown_max: number;
   hazard_countdown_min: number;
   id: number;
   min_fleet_hours_for_activity: number;
   minimal_crew_count: number;
   performance_profile: any;
   platform: any;
   pvp: any;
   scans: any;
   server_environment: any;
   ship: any;
   shuttle_adventures: {
      secondary_skill_percentage: number;
      //unlisted: shuttle_speedup_formula_v2_dil_cost_1 through _5
      //unlisted: shuttle_speedup_formula_v2_time_1 through _5
      sigmoid_midpoint: number;
      sigmoid_steepness: number;
      speedup_formula_coefficient_1: number;
      speedup_formula_coefficient_2: number;
      speedup_formula_coefficient_3: number;
      speedup_seconds_per_currency_unit: number;
   };
   stats_config: any;
   tokens: { id: number; symbol: string; faction_id: number; }[];
   voyage_dying_indicator: number;
   voyages_matched_crew_trait_bonus: number;
   voyages_matched_ship_trait_bonus: number;
   voyages_seconds_per_narrative_event: number;
}

export interface MissionDTO {
   description: string;
   episode_title: string;
   id: number;
   quests: MissionQuestDTO[];
   stars_earned: number;
   total_stars: number;
}

export interface MissionQuestDTO {
   action: string;
   cadet: boolean;
   challenges: {
      children: number[];
      critical: {
         claimed: boolean;
         reward: RewardDTO[];
         standard_loot: PotentialRewardDTO[];
         threshold: number;
      };
      difficulty: number;
      difficulty_by_mastery: number[];
      grid_x: number;
      grid_y: number;
      id: number;
      image: ImageDataDTO;
      locks: any[];
      name: string;
      skill: string;
      trait_bonuses: { trait: string; bonuses: number[] }[];
   }[];
   crew_requirement: {
      description: string;
      max_stars: number;
      min_stars: number;
      traits: string[];
   };
   description: string;
   id: number;
   locked: boolean;
   mastery_levels: {
      energy_cost: number;
      id: number;
      jackpots: any[];
      locked: boolean;
      progress: { goal_progress: number; goals: number; };
      rewards: (PotentialRewardDTO | RewardDTO)[]; // first item is PotentialRewardDTO with type=0, second is RewardDTO
   }[];
   material_bundle: string;
   name: string;
   place: string;
   quest_type: string;
   star_background: boolean;
   symbol: string;
   timeline_action: ImageDataDTO;
   unlock_text: any;
}

export interface PotentialRewardDTO {
   icon: ImageDataDTO;
   potential_rewards: RewardDTO[];
   quantity: number;
   rarity: number;
   type: number; // =0
}

export interface EventDTO {
   bonus_text: string;
   bonus_victory_points?: number;
   content: {
      content_type: string; // "gather" | "shuttles" | "skirmish" | ?

      // Galaxy/gather events
      craft_bonus: number;
      crew_bonuses?: {
         [crew_symbol: string]: number;
      };
      gather_pools: EventGatherPoolDTO[];
      refresh_cost: { amount: number; currency: number; };
      supports_boosts: boolean;

      // skirmish events
      bonus_crew?: {
         [crew_symbol: string]: number;
      };

      // faction events
      shuttles?: EventShuttleDTO[];

      // expedetion events
      special_crew?: string[];
   };
   description: string;
   featured_crew: {
      action: CrewActionDTO;
      flavor: string;
      full_body: ImageDataDTO;
      full_name: string;
      icon: ImageDataDTO;
      id: number;
      name: string;
      portrait: ImageDataDTO;
      quantity: number;
      rarity: number;
      skills: { [sk: string]: SkillDTO; };
      symbol: string;
      traits: string[];
      type: number;
   }[];
   id: number;
   instance_id: number;
   last_threshold_points?: number;
   name: string;
   next_threshold_points?: number;
   next_threshold_rewards?: any[];
   opened?: boolean;
   opened_phase?: number;
   phases: {
      goals: any[];
      id: number;
      seconds_to_end: number;
      splash_image: ImageDataDTO;
   }[];
   ranked_brackets: any[];
   rewards_teaser: string;
   rules: string;
   seconds_to_end: number;
   seconds_to_start: number;
   shop_layout: string;
   squadron_ranked_brackets: any[];
   status: number;
   threshold_rewards: any[];
   unclaimed_threshold_rewards?: any[];
   victory_points?: number;
}

export interface EventShuttleDTO {
   allow_borrow: boolean;
   crew_bonuses: { [crew_symbol: string]: number; };
   shuttle_mission_rewards: ShuttleRewardDTO[];
   token: number;
}

export interface ShuttleRewardDTO {
   flavor?: string;
   icon: ImageDataDTO;
   id?: number;
   name?: string;
   potential_rewards?: any[];
   quantity: number;
   rarity?: number;
   symbol?: string;
   type: number; // == 0 (rewards), 11 (VP), 12 (faction rep)
}

export interface EventGatherPoolAdventureDTO {
   demands: { archetype_id: number; count: number; }[];
   description: string;
   golden_octopus: boolean;
   id: number;
   name: string;
}

export interface EventGatherPoolDTO {
   adventures: EventGatherPoolAdventureDTO[];
   goal_index: number;
   golden_octopus_rewards: {
      faction_id: number;
      flavor: string;
      icon: ImageDataDTO;
      name: string;
      quantity: number;
      symbol: string;
      type: number;
   }[];
   id: number;
   rewards: any[];
}
