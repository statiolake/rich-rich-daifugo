import { PlayerType } from '../domain/player/Player';
import { PlayerStrategy } from '../strategy/PlayerStrategy';
import { RuleSettings, DEFAULT_RULE_SETTINGS } from '../domain/game/RuleSettings';

export interface PlayerConfig {
  id: string;
  name: string;
  type: PlayerType;
  strategy: PlayerStrategy;
  /** マルチプレイ時: このクライアントのプレイヤーかどうか */
  isLocal?: boolean;
  /** マルチプレイ時: ネットワーク上のプレイヤータイプ */
  networkType?: 'HOST' | 'GUEST' | 'CPU';
}

export interface GameConfig {
  players: PlayerConfig[];
  ruleSettings: RuleSettings;
}

export function createDefaultConfig(): GameConfig {
  return {
    players: [],
    ruleSettings: { ...DEFAULT_RULE_SETTINGS },
  };
}
