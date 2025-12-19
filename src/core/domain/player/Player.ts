import { Hand } from '../card/Hand';
import { PlayerId } from './PlayerId';
import { PlayerRank } from './PlayerRank';

export enum PlayerType {
  HUMAN = 'HUMAN',
  CPU = 'CPU',
}

export interface Player {
  readonly id: PlayerId;
  readonly name: string;
  readonly type: PlayerType;
  rank: PlayerRank | null;
  hand: Hand;
  isFinished: boolean;
  finishPosition: number | null;
}

export function createPlayer(
  id: string,
  name: string,
  type: PlayerType
): Player {
  return {
    id: new PlayerId(id),
    name,
    type,
    rank: null,
    hand: new Hand([]),
    isFinished: false,
    finishPosition: null,
  };
}
