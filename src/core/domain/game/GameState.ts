import { Player } from '../player/Player';
import { Field } from './Field';

export enum GamePhaseType {
  SETUP = 'SETUP',
  EXCHANGE = 'EXCHANGE',
  PLAY = 'PLAY',
  RESULT = 'RESULT',
}

export interface GameState {
  players: Player[];
  currentPlayerIndex: number;
  field: Field;
  isRevolution: boolean;
  isElevenBack: boolean;
  passCount: number;
  round: number;
  phase: GamePhaseType;
}

export function createGameState(players: Player[]): GameState {
  return {
    players,
    currentPlayerIndex: 0,
    field: new Field(),
    isRevolution: false,
    isElevenBack: false,
    passCount: 0,
    round: 1,
    phase: GamePhaseType.SETUP,
  };
}
