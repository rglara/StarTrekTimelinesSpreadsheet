import React from 'react';
import { SearchBox } from 'office-ui-fabric-react/lib/SearchBox';

import { CrewList } from './CrewList';

import { exportExcel } from '../../utils/excelExporter';
import { exportCsv } from '../../utils/csvExporter';

import STTApi, { download } from '../../api';
import { CrewData } from '../../api/STTApi';
import { ICommandBarItemProps } from 'office-ui-fabric-react/lib/CommandBar';

export interface CrewPageProps {
    onCommandItemsUpdate?: (items: ICommandBarItemProps[]) => void;
}

export const CrewPage = (props: CrewPageProps) => {
    const [filterText, setFilterText] = React.useState('');
    const [showEveryone, setShowEveryone] = React.useState(false);
    const [showBuyback, setShowBuyback] = React.useState(false);
    const [showCanTrain, setShowCanTrain] = React.useState(false);
    const [groupRarity, setGroupRarity] = React.useState(false);
    const [compactMode, setCompactMode] = React.useState(true);
    const [crewData, setCrewData] = React.useState(loadCrewData(false,false,false));

    React.useEffect(() => {
        _updateCommandItems();
    }, [showEveryone, showBuyback, showCanTrain, groupRarity, compactMode]);

    function loadCrewData(showEveryone: boolean, showBuyback: boolean, showCanTrain: boolean) : CrewData[] {
        let crewData = STTApi.roster;
        if (showEveryone) {
            const isFFFE = (crew:CrewData) => (crew.frozen > 0) || ((crew.rarity === crew.max_rarity) && (crew.level === 100));
            const notOwned = (crew: CrewData) => {
                let rc = STTApi.roster.find((rosterCrew) => !rosterCrew.buyback && (rosterCrew.symbol === crew.symbol));

                return !(rc) || !isFFFE(rc);
            }

            // Let's combine allcrew with roster such that FFFE crew shows up only once
            crewData = crewData.concat(STTApi.allcrew.filter(crew => notOwned(crew)));
        }

        if (!showBuyback) {
            crewData = crewData.filter(crew => !crew.buyback);
        }

        if (showCanTrain) {
            crewData = crewData.filter(crew => crew.level !== crew.max_level);
        }

        return crewData;
    }

    function _updateCommandItems() {
        if (props.onCommandItemsUpdate) {
            props.onCommandItemsUpdate([
                {
                    key: 'export',
                    text: 'Export',
                    iconProps: { iconName: 'Download' },
                    subMenuProps: {
                        items: [
                            {
                                key: 'exportExcel',
                                name: 'Export Excel...',
                                iconProps: { iconName: 'ExcelLogo' },
                                onClick: async () => {
                                    let data = await exportExcel(STTApi.playerData.character.items);
                                    download('My Crew.xlsx', data, 'Export Star Trek Timelines crew roster', 'Export');
                                }
                            },
                            {
                                key: 'exportCsv',
                                name: 'Export CSV...',
                                iconProps: { iconName: 'ExcelDocument' },
                                onClick: () => {
                                    let csv = exportCsv();
                                    download('My Crew.csv', csv, 'Export Star Trek Timelines crew roster', 'Export');
                                }
                            }]
                        }
                },
                {
                    key: 'settings',
                    text: 'Settings',
                    iconProps: { iconName: 'Equalizer' },
                    subMenuProps: {
                        items: [{
                            key: 'groupRarity',
                            text: 'Group by rarity',
                            canCheck: true,
                            isChecked: groupRarity,
                            onClick: () => {
                                let isChecked = !groupRarity;
                                setGroupRarity(isChecked);
                            }
                        },
                        {
                            key: 'showBuyback',
                            text: 'Show buyback (dismissed) crew',
                            canCheck: true,
                            isChecked: showBuyback,
                            onClick: () => {
                                let isChecked = !showBuyback;
                                setCrewData(loadCrewData(showEveryone, isChecked, showCanTrain));
                                setShowBuyback(isChecked);
                            }
                        },
                          {
                            key: 'showCanTrain',
                            text: 'Show crew that can receive training',
                            canCheck: true,
                            isChecked: showCanTrain,
                            onClick: () => {
                              let isChecked = !showCanTrain;
                              setCrewData(loadCrewData(showEveryone, showBuyback, isChecked));
                              setShowCanTrain(isChecked);
                            }
                          },
                        {
                            key: 'compactMode',
                            text: 'Compact mode',
                            canCheck: true,
                            isChecked: compactMode,
                            onClick: () => {
                                let isChecked = !compactMode;
                                setCompactMode(isChecked);
                            }
                        },
                        {
                            key: 'showEveryone',
                            text: '(EXPERIMENTAL) Show stats for all crew',
                            canCheck: true,
                            isChecked: showEveryone,
                            onClick: () => {
                                let isChecked = !showEveryone;
                                setCrewData(loadCrewData(isChecked, showBuyback, showCanTrain));
                                setShowEveryone(isChecked);
                            }
                        }]
                    }
                }
            ]);
        }
    }

    return <div>
        <SearchBox placeholder='Search by name or trait...'
            onChange={(newValue) => setFilterText(newValue)}
            onSearch={(newValue) => setFilterText(newValue)}
        />
        <CrewList data={crewData}
            groupRarity={groupRarity}
            showBuyback={showBuyback}
            compactMode={compactMode}
            filterText={filterText} />
    </div>;
}
