import React from 'react';
import { Header } from 'semantic-ui-react';
import STTApi, { CONFIG } from '../api';

export class ItemDisplay extends React.Component {
    render() {
        let borderWidth = Math.ceil(this.props.size / 34);
        let starSize = Math.floor(this.props.size / 6);
        let bottomStar = Math.floor(this.props.size / 23);
        let borderRadius = Math.floor(this.props.size / 7);
        let borderColor = CONFIG.RARITIES[this.props.maxRarity].color;

        let rarity = [];
        if (!this.props.hideRarity) {
            for (let i = 0; i < this.props.rarity; i++) {
                rarity.push(<img key={i} src={CONFIG.SPRITES['star_reward'].url} style={{ width: starSize + 'px' }} />);
            }
            for (let i = this.props.rarity; i < this.props.maxRarity; i++) {
                rarity.push(<img key={i} src={CONFIG.SPRITES['star_reward_inactive'].url} style={{ width: starSize + 'px' }} />);
            }
        }

        let count = 0;
        if (this.props.itemId) {
            let have = STTApi.playerData.character.items.find(item => item.archetype_id === this.props.itemId);
            if (have && have.quantity > 0) {
                count = have.quantity;
            }
        }

        let divStyle = this.props.style || {};
        divStyle.position = 'relative';
        divStyle.width = this.props.size + 'px';
        divStyle.height = this.props.size + 'px';

        return <div style={divStyle}>
            <img src={this.props.src}
                 style={{ borderStyle: 'solid',
                          borderRadius: borderRadius + 'px',
                          borderWidth: borderWidth + 'px',
                          borderColor: borderColor,
                          width: (this.props.size - 2 * borderWidth) + 'px',
                          height: (this.props.size - 2 * borderWidth) + 'px' }} />
            {!this.props.hideRarity &&
                <div style={{ position: 'absolute',
                              width: this.props.size + 'px',
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
            {this.props.sources &&
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

                    }}>{this.props.sources}</Header>}
        </div>;
    }
}