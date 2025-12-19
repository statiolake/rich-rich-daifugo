export class PlayerId {
  constructor(public readonly value: string) {}

  equals(other: PlayerId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
