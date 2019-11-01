import React from 'react';
import { Header } from 'semantic-ui-react';
import STTApi, { CONFIG } from '../api';
import { ItemDTO } from '../api/DTO';

export interface ItemDisplayProps {
    size: number;
    hideRarity?: boolean;
    rarity: number;
    maxRarity: number;
    itemId?: number;
    item?: ItemDTO;
    style?: any;
    src: string;
    sources?: any; // JSX element
    onClick?: () => void;
    onDoubleClick?: () => void;
}

export const ItemDisplay = (props: ItemDisplayProps) => {
    let borderWidth = Math.ceil(props.size / 34);
    let starSize = Math.floor(props.size / 6);
    let bottomStar = Math.floor(props.size / 23);
    let borderRadius = Math.floor(props.size / 7);
    let borderColor = CONFIG.RARITIES[props.maxRarity].color;

    let rarity = [];
    if (!props.hideRarity) {
        for (let i = 0; i < props.rarity; i++) {
            rarity.push(<img key={i} src={CONFIG.SPRITES['star_reward'].url} style={{ width: starSize + 'px' }} />);
        }
        for (let i = props.rarity; i < props.maxRarity; i++) {
            rarity.push(<img key={i} src={CONFIG.SPRITES['star_reward_inactive'].url} style={{ width: starSize + 'px' }} />);
        }
    }

    let count = 0;
    if (props.itemId || props.item) {
        let have = props.item;
        if (!have && props.itemId) {
            have = STTApi.playerData.character.items.find(item => item.archetype_id === props.itemId);
        }
        if (have && have.quantity > 0) {
            count = have.quantity;
        }
    }

    let divStyle = props.style || {};
    divStyle.position = 'relative';
    divStyle.width = props.size + 'px';
    divStyle.height = props.size + 'px';

    return <div style={divStyle} onDoubleClick={props.onDoubleClick} onClick={props.onClick} >
        <img src={props.src}
                style={{ borderStyle: 'solid',
                        borderRadius: borderRadius + 'px',
                        borderWidth: borderWidth + 'px',
                        borderColor: borderColor,
                        width: (props.size - 2 * borderWidth) + 'px',
                        height: (props.size - 2 * borderWidth) + 'px' }} />
        {!props.hideRarity &&
            <div style={{ position: 'absolute',
                            width: props.size + 'px',
                            bottom: bottomStar + 'px',
                            left: '50%',
                            transform: 'translate(-50%, 0)',
                            textAlign: 'center'
            }}>{rarity}</div>}
        {count > 0 &&
            <Header as='h4'
                style={{ position: 'absolute',
                    top: borderWidth + 'px',
                    right: 2 * borderWidth + 'px',
                    backgroundColor: 'white',
                    borderColor: 'black',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    margin: 0
        }}>{count}</Header>}
        {props.sources &&
            <Header as='h4'
                style={{
                    position: 'absolute',
                    top: borderWidth + 'px',
                    left: 2 * borderWidth + 'px',
                    backgroundColor: 'white',
                    borderColor: 'black',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    margin: 0

                }}>{props.sources}</Header>}
    </div>;
}
