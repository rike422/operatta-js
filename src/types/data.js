export type selectionData = {
  anchor: number,
  head: number
};

export type rangeData = {
  anchor: number,
  head: number
};

export type clientData = {
  id: ?string,
  name: ?string,
  selection: Array<rangeData>
};

export type revisionData = {
  major: number,
  minor: number
};

export type xhrData = {
  operations: Array<any>,
  events: Array<any>,
  revision: revisionData,
  user: clientData
};
