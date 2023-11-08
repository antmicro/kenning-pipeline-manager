export interface NavbarItem {
    name: string,
    iconName: string,
    icon?: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    procedureName: string
}

export const defaultNavbarItems: NavbarItem[] = [
    {
        name: 'Run',
        iconName: 'Run',
        procedureName: 'dataflow_run',
    },
    {
        name: 'Validate',
        iconName: 'Validate',
        procedureName: 'dataflow_validate',
    },
    {
        name: 'Stop',
        iconName: 'StopDataflow',
        procedureName: 'dataflow_stop',
    },
];
