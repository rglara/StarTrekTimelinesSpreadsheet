import STTApi from "./index";

export async function shuttleComplete(id: number): Promise<any> {
    return await STTApi.executePostRequestWithUpdates("shuttle/complete", { id });
}

export async function shuttleRedeemToken(token_id: number): Promise<any> {
    let data = await STTApi.executePostRequest("shuttle/redeem_token", { id: token_id });
    return await STTApi.applyUpdates(data);
}

export async function shuttleStart(id: number, crew_ids: number[], consumable_id: number | undefined, displayed_percent_success: number): Promise<any> {
    let data = await STTApi.executePostRequest("shuttle/start",
        {
            id: id,
            crew: crew_ids.join(','),
            consumable: consumable_id ? consumable_id : 0,
            displayed_percent_success: `${displayed_percent_success}%`
        });

    return await STTApi.applyUpdates(data);
}

function getRosterWithBonus(): any[] {
    let crew_bonuses: { [key: string]: number } = {};
    if (
        STTApi.playerData.character.events &&
        STTApi.playerData.character.events.length > 0 &&
        STTApi.playerData.character.events[0].content.content_type === 'shuttles' &&
        STTApi.playerData.character.events[0].opened
    ) {
        // In a shuttle event
        let event = STTApi.playerData.character.events[0];
        crew_bonuses = event.content.shuttles[0].crew_bonuses;
    }

    let sortedRoster: any[] = [];
    STTApi.roster.forEach((crew: any) => {
        if (crew.buyback || crew.frozen || crew.active_id) {
            return;
        }

        let bonus = 1;
        if (crew_bonuses[crew.symbol]) {
            bonus = crew_bonuses[crew.symbol];
        }

        sortedRoster.push({
            crew_id: crew.id,
            command_skill: crew.command_skill_core * bonus,
            science_skill: crew.science_skill_core * bonus,
            security_skill: crew.security_skill_core * bonus,
            engineering_skill: crew.engineering_skill_core * bonus,
            diplomacy_skill: crew.diplomacy_skill_core * bonus,
            medicine_skill: crew.medicine_skill_core * bonus,
            total: 0
        });
    });

    return sortedRoster;
}

export function getShuttleCrewChoices(adventure: any, toWin: boolean): any[] {
    let shuttle = adventure.shuttles[0];
    shuttle.challenge_rating = adventure.challenge_rating;
    shuttle.completes_in_seconds = adventure.completes_in_seconds;

    // TODO: this assumes there are at most 2 skills in each slot
    let calcSlots: any[] = [];
    shuttle.slots.forEach((slot: any) => {
        let calcSlot = {
            bestCrew: getRosterWithBonus(), // Start with a copy
            skills: [],
            type: '',
            selection: undefined
        };
        if (slot.skills.length === 1) {
            // AND or single
            calcSlot.skills = slot.skills[0].split(',');
            if (calcSlot.skills.length === 1) {
                calcSlot.type = 'SINGLE';
                calcSlot.bestCrew.forEach(c => {
                    c.total = c[calcSlot.skills[0]];
                });
            } else {
                calcSlot.type = 'AND';
                calcSlot.bestCrew.forEach(c => {
                    let a1 = c[calcSlot.skills[0]];
                    let a2 = c[calcSlot.skills[1]];
                    c.total = Math.floor(
                        Math.max(a1, a2) + Math.min(a1, a2) * STTApi.serverConfig!.config.shuttle_adventures.secondary_skill_percentage
                    );
                });
            }
        } else {
            // OR
            calcSlot.type = 'OR';
            calcSlot.skills = slot.skills;
            calcSlot.bestCrew.forEach(c => {
                c.total = Math.max(c[calcSlot.skills[0]], c[calcSlot.skills[1]]);
            });
        }

        let seen = new Set();
        if (toWin) {
            calcSlot.bestCrew = calcSlot.bestCrew.filter(c => c.total > 0);
        } else {
            calcSlot.bestCrew = calcSlot.bestCrew.filter(c => c.total <= 0);
        }
        calcSlot.bestCrew = calcSlot.bestCrew.filter(c => (seen.has(c.crew_id) ? false : seen.add(c.crew_id)));
        calcSlot.bestCrew.sort((a, b) => a.total - b.total);
        calcSlot.bestCrew = calcSlot.bestCrew.reverse();

        calcSlot.bestCrew.forEach(c => {
            c.crew = STTApi.roster.find((cr: any) => cr.id === c.crew_id);
            c.text = `${c.crew.name} (${c.total})`;
            c.value = c.crew.symbol;
            c.image = c.crew.iconUrl;
        });

        calcSlot.selection = calcSlot.bestCrew[0].value;

        // TODO: we could cache the presorted lists since more than one slot will share the same config
        calcSlots.push(calcSlot);
    });

    // No dupes across the slots (pick next)
    let seen = new Set();
    calcSlots.forEach((calcSlot: any) => {
        let curIndex = 0;
        while (seen.has(calcSlot.selection)) {
            calcSlot.selection = calcSlot.bestCrew[curIndex++].value;
        }
        seen.add(calcSlot.selection);
    });

    return calcSlots;
}

export function getShuttleState(state: number): string {
    switch (state) {
        case 0:
            return 'Opened';
        case 1:
            return 'In progress';
        case 2:
            return 'Complete';
        case 3:
            return 'Expired';
        default:
            return 'UNKNOWN';
    }
}