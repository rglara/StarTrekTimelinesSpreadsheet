import { CrewData, ItemData, ItemArchetypeDTO, RewardDTO } from './DTO'

// TODO: A configurable UI option?
const USE_WIKI: boolean = false;

export function getCrewDetailsLink(crew: CrewData): string {
    if (USE_WIKI) {
        return 'https://stt.wiki/wiki/' + crew.name.split(' ').join('_');
    } else {
        return 'https://datacore.app/crew/' + crew.symbol;
    }
}

function isReward(item: ItemData | ItemArchetypeDTO | RewardDTO): item is RewardDTO {
    return (item as RewardDTO).full_name !== undefined;
}

export function getItemDetailsLink(item: ItemData | ItemArchetypeDTO | RewardDTO): string {
    if (USE_WIKI) {
        if (isReward(item)) {
            return 'https://stt.wiki/wiki/' + item.full_name.split(' ').join('_');
        } else {
            return 'https://stt.wiki/wiki/' + item.name.split(' ').join('_');
        }
    } else {
        return 'https://datacore.app/item_info?symbol=' + item.symbol;
    }
}
