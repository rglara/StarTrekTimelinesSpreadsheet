import React from 'react';
import STTApi from '../../api';
import { VoyageCrew } from './VoyageCrew';
import { VoyageLog } from './VoyageLog';
import { ICommandBarItemProps } from 'office-ui-fabric-react/lib/CommandBar';

export interface VoyagePageProps {
   onCommandItemsUpdate?: (items: ICommandBarItemProps[]) => void;
}

export const VoyagePage = (props: VoyagePageProps) => {
   const [, updateState] = React.useState();
   const forceUpdate = React.useCallback(() => updateState({}), []);
   const [showCalcAnyway, setShowCalcAnyway] = React.useState(false);

   React.useEffect(() => _updateCommandItems(), [showCalcAnyway]);

   function _onRefreshNeeded() {
      forceUpdate();
   }

   function _updateCommandItems() {
      if (props.onCommandItemsUpdate) {
         const activeVoyage = STTApi.playerData.character.voyage.length > 0;

         if (activeVoyage) {
            props.onCommandItemsUpdate([
               {
                  key: 'exportExcel',
                  name: showCalcAnyway ? 'Switch to log' : 'Switch to recommendations',
                  iconProps: { iconName: 'Switch' },
                  onClick: () => {
                     setShowCalcAnyway(!showCalcAnyway);
                     //_updateCommandItems();
                  }
               }
            ]);
         } else {
            props.onCommandItemsUpdate([]);
         }
      }
   }

   const activeVoyage = STTApi.playerData.character.voyage.length > 0;

   return (
      <div className='tab-panel' data-is-scrollable='true'>
         {(!activeVoyage || showCalcAnyway) && <VoyageCrew onRefreshNeeded={() => _onRefreshNeeded()} />}
         {activeVoyage && !showCalcAnyway && <VoyageLog />}
      </div>
   );
}
