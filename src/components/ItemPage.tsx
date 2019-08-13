import React from 'react';
import { SearchBox } from 'office-ui-fabric-react/lib/SearchBox';
import { exportItemsCsv } from '../utils/csvExporter';
import { download } from '../utils/pal';
import STTApi from '../api';
import { ItemList } from './ItemList';

export interface ItemPageProps {
    onCommandItemsUpdate?: (items: any[]) => void;
}

interface ItemPageState {
    filterText: string;
}

export class ItemPage extends React.Component<ItemPageProps, ItemPageState> {

	constructor(props: ItemPageProps) {
        super(props);
        this.state = { filterText: '' };
    }

    componentDidMount() {
        if (this.props.onCommandItemsUpdate) {
            this.props.onCommandItemsUpdate([
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
    }

	render() {
		return <div>
            <SearchBox placeholder='Search by name or description...'
                onChange={(newValue) => this.setState({filterText : newValue})}
                onSearch={(newValue) => this.setState({ filterText: newValue })}
            />
            <ItemList data={STTApi.playerData.character.items} filterText={this.state.filterText} />
        </div>;
	}
}