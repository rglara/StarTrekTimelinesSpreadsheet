import React from 'react';
import { SearchBox } from 'office-ui-fabric-react/lib/SearchBox';
import { exportItemsCsv } from '../utils/csvExporter';
import { download } from '../utils/pal';
import STTApi from '../api';
import { ItemList } from './ItemList';
import { ICommandBarItemProps } from 'office-ui-fabric-react/lib/CommandBar';

export interface ItemPageProps {
    onCommandItemsUpdate?: (items: ICommandBarItemProps[]) => void;
}

export const ItemPage = (props: ItemPageProps) => {
    const [filterText, setFilterText] = React.useState('');

    React.useEffect(() => {
        if (props.onCommandItemsUpdate) {
            props.onCommandItemsUpdate([
                {
                    key: 'exportCsv',
                    name: 'Export CSV...',
                    iconProps: { iconName: 'ExcelDocument' },
                    onClick: () => {
                        let csv = exportItemsCsv();
                        download('My Items.csv', csv, 'Export Star Trek Timelines item inventory', 'Export');
                    }
                }
            ]);
        }
    }, []);

    return <div>
        <SearchBox placeholder='Search by name or description...'
            onChange={(ev, newValue) => setFilterText(newValue || '')}
            onSearch={(newValue) => setFilterText(newValue)}
        />
        <ItemList data={STTApi.playerData.character.items} filterText={filterText} />
    </div>;
}
