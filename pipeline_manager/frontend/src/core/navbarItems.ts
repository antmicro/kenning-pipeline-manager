export interface NavbarItem {
    name: string,
    stopName?: string,
    iconName: string,
    icon?: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    procedureName: string
    allowToRunInParallelWith?: [string]
}
