import { HandData, createHandData } from '../card/Hand';
import { PlayerId, createPlayerId } from './PlayerId';
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
  hand: HandData;
  isFinished: boolean;
  finishPosition: number | null;
}

export function createPlayer(
  id: string,
  name: string,
  type: PlayerType
): Player {
  return {
    id: createPlayerId(id),
    name,
    type,
    rank: null,
    hand: createHandData(),
    isFinished: false,
    finishPosition: null,
  };
}
