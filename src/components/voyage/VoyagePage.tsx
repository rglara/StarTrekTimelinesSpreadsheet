import React from 'react';
import STTApi from '../../api';
import { VoyageCrew } from './VoyageCrew';
import { VoyageLog } from './VoyageLog';

export class VoyagePage extends React.Component<any,any> {
   constructor(props:any) {
      super(props);

      this.state = {
         showCalcAnyway: false
      };
   }

   _onRefreshNeeded() {
      this.forceUpdate();
   }

   componentDidMount() {
      this._updateCommandItems();
   }

   _updateCommandItems() {
      if (this.props.onCommandItemsUpdate) {
         const activeVoyage = STTApi.playerData.character.voyage.length > 0;

         if (activeVoyage) {
            this.props.onCommandItemsUpdate([
               {
                  key: 'exportExcel',
                  name: this.state.showCalcAnyway ? 'Switch to log' : 'Switch to recommendations',
                  iconProps: { iconName: 'Switch' },
                  onClick: () => {
                     this.setState({ showCalcAnyway: !this.state.showCalcAnyway }, () => {
                        this._updateCommandItems();
                     });
                  }
               }
            ]);
         } else {
            this.props.onCommandItemsUpdate([]);
         }
      }
   }

   render() {
      const activeVoyage = STTApi.playerData.character.voyage.length > 0;

      return (
         <div className='tab-panel' data-is-scrollable='true'>
            {(!activeVoyage || this.state.showCalcAnyway) && <VoyageCrew onRefreshNeeded={() => this._onRefreshNeeded()} />}
            {activeVoyage && !this.state.showCalcAnyway && <VoyageLog />}
         </div>
      );
   }
}
