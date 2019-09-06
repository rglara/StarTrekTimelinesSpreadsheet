import React from 'react';

import STTApi, { CONFIG } from '../api';
import { CrewAvatar, CrewData, CryoCollectionDTO } from '../api/STTApi';
import { ICommandBarItemProps } from 'office-ui-fabric-react/lib/CommandBar';

interface CryoCollectionsProps {
    onCommandItemsUpdate?: (items: ICommandBarItemProps[]) => void;
}

interface CryoCollectionsState {
    showComplete: boolean;
}

interface CryoCollectionProps {
    collection: CryoCollectionDTO;
}

interface CryoCollectionState {
    imageUrl?: string;
    unownedCrew: CrewAvatar[];
    ownedCrew: CrewData[];
    ownedCrewFrozen: CrewData[];
}

class CryoCollection extends React.Component<CryoCollectionProps, CryoCollectionState> {
    constructor(props: CryoCollectionProps) {
        super(props);

        if (!this.props.collection.iconUrl) {
            STTApi.imageProvider.getImageUrl(this.props.collection.image, this.props.collection).then((found) => {
                this.props.collection.iconUrl = found.url;

                this.setState({ imageUrl: found.url });
            }).catch((error) => { console.warn(error); });
        }

        let archetypes = STTApi.crewAvatars.filter((crew: CrewAvatar) =>
            (crew.traits.concat(crew.traits_hidden).filter((trait:string) =>
                this.props.collection.traits.includes(trait)).length > 0) || this.props.collection.extra_crew.includes(crew.id));
        let unowned: CrewAvatar[] = [];
        let owned: CrewData[] = [];
        let ownedFrozen: CrewData[] = [];
        let allOwnedCrew: CrewData[] = STTApi.roster.filter(crew => !crew.buyback);
        archetypes.forEach((a: CrewAvatar) => {
            let crew = allOwnedCrew.find((crew:CrewData) => crew.id === a.id);
            if (!crew) {
                unowned.push(a);
            } else if (crew.frozen > 0) {
                ownedFrozen.push(crew);
            } else {
                owned.push(crew);
            }
        });

        let byName = (a:CrewData, b:CrewData) => {
            if (a.short_name < b.short_name) return -1;
            if (a.short_name > b.short_name) return 1;
            return 0;
        };
        owned.sort(byName);
        ownedFrozen.sort(byName);
        unowned.sort((a, b) => {
            if (a.max_rarity < b.max_rarity) { return 1; }
            if (a.max_rarity > b.max_rarity) { return -1; }
            if (a.short_name < b.short_name) return -1;
            if (a.short_name > b.short_name) return 1;
            return 0;
        });

        this.state = {
            imageUrl: this.props.collection.iconUrl,
            unownedCrew: unowned,
            ownedCrew: owned,
            ownedCrewFrozen: ownedFrozen,
        };
    }

    htmlDecode(input: string) {
        input = input.replace(/<#([0-9A-F]{6})>/gi, '<span style="color:#$1">');
        input = input.replace(/<\/color>/g, '</span>');

        return {
            __html: input
        };
    }

    render() {
        const fixFileUrl = (url:string) => {
            return url.replace(/\\/g, '/');
        }

        let isDone = this.props.collection.milestone.goal === 0;
        let total = this.state.ownedCrew.length + this.state.unownedCrew.length + this.state.ownedCrewFrozen.length;
        let unowned5 = this.state.unownedCrew.filter(ca => ca.max_rarity == 5);
        let unowned4 = this.state.unownedCrew.filter(ca => ca.max_rarity == 4);
        let unowned3 = this.state.unownedCrew.filter(ca => ca.max_rarity < 4);

        return <div className="ui vertical segment" style={{
                backgroundImage: (this.state.imageUrl ? `url("${fixFileUrl(this.state.imageUrl)}")` : ''),
                backgroundPosition: 'right bottom',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '360px',
                marginTop: '20px',
                paddingRight: '360px' }} >
            <h4>{this.props.collection.name}</h4>
            <p dangerouslySetInnerHTML={this.htmlDecode(this.props.collection.description)} />
            <p>
                <span style={{ color:"#ECA50B" }}>Milestone Goal{isDone? "s Complete":""}:&nbsp;
                {this.props.collection.progress} / {isDone ? this.props.collection.progress : this.props.collection.milestone.goal} Immortalized
                </span> ({this.state.ownedCrew.length + this.state.ownedCrewFrozen.length} / {total} total)
            </p>
            <p><b>Active Crew ({this.state.ownedCrew.length}):</b> {this.state.ownedCrew.map((crew, i) =>
                    <span key={crew.id}>{crew.name} <span style={{ color: CONFIG.RARITIES[crew.max_rarity].color }}>
                        ({crew.rarity}/{crew.max_rarity})</span>{i < this.state.ownedCrew.length-1 ? ', ':''}</span>)}</p>
            {(this.state.ownedCrewFrozen.length > 0) && <p><b>Frozen ({this.state.ownedCrewFrozen.length}): </b>
                 {this.state.ownedCrewFrozen.map((crew, i) =>
                    <span key={crew.id}>{crew.name} <span style={{ color: CONFIG.RARITIES[crew.max_rarity].color }}>
                        ({crew.rarity}/{crew.max_rarity})</span>{i < this.state.ownedCrewFrozen.length - 1 ? ', ' : ''}</span>)}</p>}
            {(this.state.unownedCrew.length > 0) && <p><b>Unowned crew (
                {unowned5.length > 0 && <span style={{ color: CONFIG.RARITIES[5].color }}>{unowned5.length}x 5* </span>}
                {unowned4.length > 0 && <span style={{ color: CONFIG.RARITIES[4].color }}>{unowned4.length}x 4* </span>}
                {unowned3.length > 0 && <span>{unowned3.length}x other</span>}): </b>
                {this.state.unownedCrew.map((crew, i) => <span key={crew.id}>
                    {crew.name} <span style={{ color: CONFIG.RARITIES[crew.max_rarity].color }}>({crew.max_rarity})</span>
                    {i < this.state.unownedCrew.length - 1 ? ', ' : ''}</span>)}</p>}
        </div>;
    }
}

export class CryoCollections extends React.Component<CryoCollectionsProps, CryoCollectionsState> {
    constructor(props: CryoCollectionsProps) {
        super(props);

        this.state = {
            showComplete: false
        };
    }

    componentDidMount() {
        this._updateCommandItems();
    }

    _updateCommandItems() {
        if (this.props.onCommandItemsUpdate) {
            this.props.onCommandItemsUpdate([{
                key: 'settings',
                text: 'Settings',
                iconProps: { iconName: 'Equalizer' },
                subMenuProps: {
                    items: [{
                        key: 'showComplete',
                        text: 'Show complete collections',
                        canCheck: true,
                        isChecked: this.state.showComplete,
                        onClick: () => { this.setState({showComplete: !this.state.showComplete}, () => { this._updateCommandItems(); }); }
                    }]
                }
            }]);
        }
    }

    render() {
        let collections = STTApi.playerData.character.cryo_collections;

        if (!this.state.showComplete) {
            collections = collections.filter((c:CryoCollectionDTO) => c.milestone.goal !== 0);
        }

        return <div className='tab-panel' data-is-scrollable='true'>
            {collections.map((c: CryoCollectionDTO) => <CryoCollection key={c.id} collection={c} />)}
        </div>;
    }
}