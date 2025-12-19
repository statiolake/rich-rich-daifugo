import { PlayerType } from '../domain/player/Player';
import { PlayerStrategy } from '../strategy/PlayerStrategy';

export interface PlayerConfig {
  id: string;
  name: string;
  type: PlayerType;
  strategy: PlayerStrategy;
}

export interface GameConfig {
  players: PlayerConfig[];
}

export function createDefaultConfig(): GameConfig {
  return {
    players: [],
  };
}
