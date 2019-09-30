import React from 'react';
import { Dialog, DialogType, DialogFooter } from 'office-ui-fabric-react/lib/Dialog';
import { PrimaryButton, DefaultButton } from 'office-ui-fabric-react/lib/Button';
import UserStore from './Styles';

import STTApi from '../api';
import { CONFIG, NumberPicker, getChronitonCount } from '../api';
import { MissionQuestDTO, MissionQuestMasteryLevelDTO } from '../api/DTO';

export class WarpDialogProps {
    onWarped: () => void;
}

class WarpDialogState {
    showDialog: boolean;
    iconUrl?: string;
    warpCount: number;
    quest?: MissionQuestDTO;
    mastery?: MissionQuestMasteryLevelDTO;
    mastery_level?: number;
}

//NOTE: this is used as a React.useRef<WarpDialog> and therefore can't be converted to a function component
export class WarpDialog extends React.Component<WarpDialogProps, WarpDialogState> {
    constructor(props: WarpDialogProps) {
        super(props);

        this.state = {
            showDialog: false,
            iconUrl: '',
            warpCount: 1,
            quest: undefined,
        };

        this._closeDialog = this._closeDialog.bind(this);
        this.show = this.show.bind(this);
    }

    show(id: number, mastery_level: number) {
        for (let mission of STTApi.missions) {
            let quest = mission.quests.find(q => q.id === id);
            if (quest) {
                let mastery = quest.mastery_levels[mastery_level];

                STTApi.imageProvider.getImageUrl(quest.timeline_icon.file, quest).then((found) => {
                    this.setState({ iconUrl: found.url});
                }).catch((error) => { console.warn(error); });

                this.setState({
                    showDialog: true,
                    quest,
                    mastery,
                    mastery_level
                });

                break;
            }
        }
    }

    _closeDialog() {
        this.setState({
            showDialog: false,
            iconUrl: '',
            warpCount: 1,
            quest: undefined
        });
    }

    async _warp(warpCount: number) {
        while (warpCount > 10) {
            let ephemerals = await STTApi.warpQuest(this.state.quest!.id, this.state.mastery_level!, 10);
            // TODO: show rewards to the user somehow
            console.log(ephemerals);

            warpCount -= 10;
        }

        if (warpCount > 0) {
            let ephemerals = await STTApi.warpQuest(this.state.quest!.id, this.state.mastery_level!, warpCount);
            // TODO: show rewards to the user somehow
            console.log(ephemerals);
        }

        this._closeDialog();

        if (this.props.onWarped) {
            this.props.onWarped();
        }
    }

    render() {
        if (!this.state.showDialog || !this.state.quest) {
            return <span />;
        }

        let chronAvailable = getChronitonCount();
        let cost = this.state.mastery!.energy_cost;
        if (STTApi.playerData.character.stimpack) {
            cost *= 1 - (STTApi.playerData.character.stimpack.energy_discount / 100);
            cost = Math.ceil(cost);
        }
        let chronNeeded = cost * this.state.warpCount;

        let currentTheme = UserStore.get('theme');

        return <Dialog
            hidden={!this.state.showDialog}
            onDismiss={this._closeDialog}
            dialogContentProps={{
                type: DialogType.normal,
                title: `Warp mission '${this.state.quest.name}' on ${CONFIG.MASTERY_LEVELS[this.state.mastery_level!].name}`
            }}
            modalProps={{
                containerClassName: 'warpdialogMainOverride',
                isBlocking: true
            }}
        >
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gridTemplateAreas: `'image description' 'image chronitons' 'image warpcount'`, color: currentTheme.semanticColors.bodyText, backgroundColor: currentTheme.semanticColors.bodyBackground }}>
                <div style={{ gridArea: 'image' }}><img src={this.state.iconUrl} width={200} height={200} style={{objectFit: 'contain'}} /></div>
                <div style={{ gridArea: 'description' }}>
                    <p>{this.state.quest.description}</p>
                    {this.state.mastery!.locked && <p>This mission is locked; you can't warp it until you complete this mastery level in the game</p>}
                    <p><b>NOTE:</b> This feature is experimental; let me know how it worked for you.</p>
                </div>
                <div style={{ gridArea: 'chronitons' }}>
                    <p>Chronitons needed: {chronNeeded} / {chronAvailable}</p>
                </div>
                <div style={{ gridArea: 'warpcount' }}>
                    <NumberPicker value={this.state.warpCount} compact label={'Warp count:'} min={1} max={100} step={1} onChange={({value}) => { this.setState({ warpCount: value }); }} />
                </div>
            </div>

            <DialogFooter>
                <PrimaryButton onClick={() => this._warp(10)} text='Warp 10' disabled={((cost * 10) > chronAvailable) || this.state.mastery!.locked} />
                <PrimaryButton onClick={() => this._warp(this.state.warpCount)} text={`Warp ${this.state.warpCount}`} disabled={(chronNeeded > chronAvailable) || this.state.mastery!.locked} />
                <DefaultButton onClick={() => this._closeDialog()} text='Cancel' />
            </DialogFooter>
        </Dialog>;
    }
}
