import { selectionData, clientData } from 'types/data'

export type onAck = () => void;
export type onClientLeft = (clientId: string) => void;
export type onSetName = (clientId: string, name: string) => void;
export type onOperation = (operation: Array<any>) => void;
export type onSelection = (clientId: string, selection: selectionData) => void;
export type onReconnect = () => void;
export type onClient = (clients: {[key: string]: clientData}) => void;
