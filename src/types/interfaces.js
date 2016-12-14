export interface Operation {
  compose (other: this): this
  equals (other: this): boolean
  toString(): string
}

