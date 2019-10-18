import React from 'react';
import STTApi from '../../api';
import { VoyageCrewSelect } from './VoyageCrewSelect';
import { VoyageLog } from './VoyageLog';
import { ICommandBarItemProps } from 'office-ui-fabric-react/lib/CommandBar';

export interface VoyagePageProps {
   onCommandItemsUpdate?: (items: ICommandBarItemProps[]) => void;
}

export const VoyagePage = (props: VoyagePageProps) => {
   const [, updateState] = React.useState();
   const forceUpdate = React.useCallback(() => {
      updateState({});
      updateCommandItems(); // when a voyage starts, command items need to update to show toggle
   }, []);
   const [showCalcAnyway, setShowCalcAnyway] = React.useState(false);

   React.useEffect(() => updateCommandItems(), [showCalcAnyway]);

   function updateCommandItems() {
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
         {(!activeVoyage || showCalcAnyway) && <VoyageCrewSelect onRefreshNeeded={() => forceUpdate()} />}
         {activeVoyage && !showCalcAnyway && <VoyageLog />}
      </div>
   );
}
