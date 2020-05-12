import STTApi, { CONFIG } from "./index";
import { SHUTTLE_STATE_NAMES, CrewData, BorrowedCrewDTO, PlayerShuttleDTO, SHUTTLE_STATE_OPENED } from "./DTO";

export interface CrewItem {
    crew: CrewData | BorrowedCrewDTO;
    skills: { [sk: string]: number };
    total: number;

    // These three are needed for the item to appear in a combo
    text?: string;
    content?: any;
    value?: number;
    image?: string;
}

export interface CrewChoice {
    slotIndex: number;
    item?: CrewItem;
    userSelect?: boolean;
}

export interface ShuttleSelection {
    calc: ShuttleCalc;
    chosen: CrewChoice[];
}

export interface ShuttleCalc {
    challenge_rating: number;
    shuttle: PlayerShuttleDTO;
    chance: (crew: (CrewItem | undefined)[]) => number;
    slots: ShuttleCalcSlot[];
}

export interface ShuttleCalcSlot {
    skillText: string;
    slotIndex: number;
    crewValue: (crew: CrewItem) => number;
    bestCrew: CrewItem[];
}



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
    return SHUTTLE_STATE_NAMES[state] ?? 'UNKNOWN';
}

export function getBonusedRoster(crew_bonuses: { [crew_symbol: string]: number; }): CrewItem[] {
    let rv: CrewItem[] = [];
    STTApi.roster.forEach(crew => {
        if (crew.buyback || crew.frozen > 0) {
            return;
        }

        const foundBonus = crew_bonuses[crew.symbol] ?? 1;

        let skills: { [sk: string]: number } = {};
        for (let sk in CONFIG.SKILLS) {
            skills[sk] = crew.skills[sk].core * foundBonus;
        }

        rv.push({
            crew: crew,
            skills,
            total: 0
        });
    });

    // These don't show up until you have already used them
    let brws = STTApi.playerData.character.crew_borrows ?? [];
    if (brws.length === 0) {
        // These are synchronized, but don't have "active*" fields
        brws = STTApi.borrowableCrew ?? [];
    }
    if (brws) {
        brws.forEach(crew => {
            const foundBonus = crew_bonuses[crew.symbol] ?? 1;

            let skills: { [sk: string]: number } = {};
            for (let sk in CONFIG.SKILLS) {
                // borrowed crew does not have all skills filled like CrewData does
                if (!crew.skills[sk]) {
                    skills[sk] = 0;
                }
                else {
                    skills[sk] = crew.skills[sk].core * foundBonus;
                }
            }

            rv.push({
                crew: crew,
                skills,
                total: 0
            });
        });
    }
    return rv;
}

export function cid(c: CrewData | BorrowedCrewDTO): number {
    if ((c as CrewData).crew_id) {
        return (c as CrewData).crew_id;
    }
    return c.id;
}

const LOG_CALCULATE = false;

// Compute "best" crew for the available shuttles
// Uses a basic simulated annealing metaheuristic approach:
//   select first unused for each slot (decent good selection)
//   permutate slightly
//   keep better result; keep worse result if it passes a threshhold (to jump to another local maximum)
export const computeCrew = async (bonusedRoster: CrewItem[], shuttleCalcs: ShuttleCalc[], userChoices: ShuttleSelection[]): Promise<ShuttleSelection[]> => {
    // Initial configuration
    let current = selectRandom(undefined);
    let next: ShuttleSelection[] = [];
    let iteration = 0;
    let alpha = 0.999;
    let temperature = 400.0;
    let epsilon = 0.001;
    let currentNrg = nrgToMax(current);
    // Not necessary, but keeps from blowing up indefinitely if the math goes wrong
    const maxIter = 100000;

    //console.log("Initial energy: " + currentNrg);

    //while the temperature did not reach epsilon
    while (temperature > epsilon && iteration < maxIter) {
        iteration++;
        //print every 400 iterations
        // if (iteration % 400 == 0) {
        // 	console.log(currentNrg);
        // }

        next = selectRandom(current);
        let nextNrg = nrgToMax(next);
        if (nextNrg == currentNrg) {
            continue;
        }
        if (nextNrg > currentNrg) {
            if (LOG_CALCULATE) {
                console.log("Better energy: " + nextNrg + " > " + currentNrg);
            }
            current = next;
            currentNrg = nextNrg;
        }
        else {
            const proba = Math.random();
            //if the new nrg is worse accept
            //it but with a probability level
            //if the probability is less than
            //E to the power -delta/temperature.
            //otherwise the old value is kept
            const delta = nextNrg - currentNrg;
            const threshold = Math.exp(delta / temperature);
            if (proba < threshold) {
                if (LOG_CALCULATE) {
                    console.log("Override better energy: " + nextNrg + " < " + currentNrg + " @ " + proba + " " + threshold);
                }
                current = next;
                currentNrg = nextNrg;
            }
        }
        //cooling process on every iteration
        temperature *= alpha;
    }

    //if (LOG_CALCULATE) {
    console.log("Best energy: " + currentNrg + " iters:" + iteration);
    //}
    return current;

    // Energy function for annealing.
    // Sums the percent chance for shuttles to succeed, then subtracts a factor of the std dev to even them
    function nrgToMax(sels: ShuttleSelection[]): number {
        let chances = sels.map(sel => {
            const chosenItems = sel.chosen.map(ch => ch.item);
            return sel.calc.chance(chosenItems);
        });

        const n = chances.length;
        const sum = chances.reduce((a, b) => a + b);
        const mean = sum / n;
        const stddev = Math.sqrt(chances.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n);

        // even the chances by subtracting a factor of the stddev
        return sum - (stddev / 3);
    }

    function selectRandom(selsCurrent?: ShuttleSelection[]): ShuttleSelection[] {
        let sels: ShuttleSelection[] = [];
        const every = 5;
        let counter = 0;

        let usedCrew: Set<number> = new Set<number>();

        // First, mark active (on shuttles or voyages) and user-selected crew as "used"
        bonusedRoster.filter(c => c.crew.active_id).forEach(ac => usedCrew.add(cid(ac.crew)));
        shuttleCalcs.forEach(calc => {
            let userChosen = userChoices.find(uc => uc.calc.shuttle.id === calc.shuttle.id)?.chosen ?? [];
            userChosen.forEach(uc => {
                const c = uc.item;
                if (c) {
                    let crid = cid(c.crew)
                    if (crid) {
                        usedCrew.add(crid);
                    }
                }
            });
        });

        function shuffle(array: any[]) {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
        }
        let calcs = shuttleCalcs.slice();
        shuffle(calcs);

        calcs.forEach((calc, ci) => {
            let chosen: CrewChoice[] = [];
            let userChosen = userChoices.find(uc => uc.calc.shuttle.id === calc.shuttle.id)?.chosen ?? [];
            calc.slots.forEach((scs, si) => {
                let userChoice = userChosen.find(uc => uc.slotIndex === si);
                if (calc.shuttle.state !== SHUTTLE_STATE_OPENED) {
                    // Ignore used crew and find them in the roster
                    let item = bonusedRoster.filter(c => c.crew.active_id === calc.shuttle.id && c.crew.active_index === si).shift();
                    chosen.push({
                        slotIndex: si,
                        item
                    });
                }
                else if (userChoice?.item) {
                    chosen.push(userChoice);
                }
                else {
                    let item: CrewItem | undefined = undefined;

                    // Get best unused if no current provided or n-1 of every n choices
                    //if (!selsCurrent || ((counter++ % every) != 0)) {
                    if (!selsCurrent) {
                        // Grab the first unused crew by score
                        item = scs.bestCrew.filter(c => !usedCrew.has(cid(c.crew))).shift();
                        //console.log("selecting first option " + ci + "," + si)
                    }
                    else {
                        const options = scs.bestCrew.filter(c => !usedCrew.has(cid(c.crew)));
                        // Weight the random selection toward the front of the list
                        for (let i = 0; i < options.length; ++i) {
                            const r = Math.random();
                            // Select if the random value is below the curve in the higher probability range
                            const gap = .6; // 60% chance of select starting with first index
                            const pass = r < gap;
                            if (pass) {
                                item = options[i];
                                break;
                            }
                            //console.log("skipped option " + i + " " + r + " " + ci + "," + si)
                        }
                        //console.log("selecting random option " + ci + "," + si)
                        // Grab random selection of crew
                    }
                    if (item) {
                        usedCrew.add(cid(item.crew))
                    }

                    chosen.push({
                        slotIndex: si,
                        item
                    });
                }
            });

            sels.push({
                calc,
                chosen
            });
        })

        return sels;
    }
}
