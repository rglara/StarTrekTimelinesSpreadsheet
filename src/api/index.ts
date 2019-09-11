export { STTApiClass } from "./STTApi";
export { mergeDeep } from './ObjectMerge';
export { loginSequence } from './LoginSequence';
export { loadFullTree } from './EquipmentTools';
export { loadVoyage } from '../components/voyage/VoyageTools';
export { RarityStars } from '../components/RarityStars'
export { CollapsibleSection } from '../components/CollapsibleSection'
export { NumberPicker } from '../components/NumberPicker'
export { download } from '../utils/pal';
export { ImageCache, IFoundResult } from '../components/images/ImageProvider';
export { ImageProvider } from '../components/images/ImageProvider';
export { WikiImageProvider, ImageProviderChain } from '../components/images/WikiImageTools';
export { AssetImageProvider } from '../components/images/AssetImageProvider';
export { ServerImageProvider } from '../components/images/ServerImageProvider';
export { FileImageCache } from '../components/images/FileImageCache';
export { formatCrewStats } from './CrewTools';
export { bonusCrewForCurrentEvent } from './EventTools';
export { calculateQuestRecommendations } from './MissionCrewSuccess';
export { formatTimeSeconds } from './MiscTools';
export { refreshAllFactions, loadFactionStore } from './FactionTools';
export { replicatorCurrencyCost, replicatorFuelCost, canReplicate, replicatorFuelValue, canUseAsFuel, replicate } from './ReplicatorTools';
import CONFIG from "./CONFIG";
export { CONFIG }

import { STTApiClass } from "./STTApi";
let STTApi = new STTApiClass();
export default STTApi;

export function getChronitonCount(): number {
   let chronCount: number = STTApi.playerData.character.replay_energy_overflow;
   if (STTApi.playerData.character.seconds_from_replay_energy_basis === -1) {
      chronCount += STTApi.playerData.character.replay_energy_max;
   } else {
      chronCount += Math.min(Math.floor(STTApi.playerData.character.seconds_from_replay_energy_basis / STTApi.playerData.character.replay_energy_rate), STTApi.playerData.character.replay_energy_max);
   }

   return chronCount;
}