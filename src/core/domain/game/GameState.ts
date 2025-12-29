import { Player } from '../player/Player';
import { Field } from './Field';
import { Card } from '../card/Card';
import { RuleSettings, DEFAULT_RULE_SETTINGS } from './RuleSettings';

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
  discardPile: Card[]; // 捨て札（場が流れたカードを蓄積）
  isRevolution: boolean;
  isElevenBack: boolean;
  isOmenActive: boolean; // オーメン発動後、以降革命が起きない
  isEightCutPending: boolean; // 8切りが発動予定（4止めで止められる可能性がある）
  suitLock: string | null; // マークしばり（例: 'SPADE', 'HEART', 'DIAMOND', 'CLUB'）
  numberLock: boolean; // 数字しばり（階段の縛り）
  colorLock: 'red' | 'black' | null; // 色縛り（赤:ハート/ダイヤ、黒:スペード/クラブ）
  isReversed: boolean; // ターン順が逆転しているか（9リバース）
  isTwoBack: boolean; // 2バック状態（2を出すと場が流れるまで強さ逆転）
  luckySeven: { playerId: string } | null; // ラッキーセブン（7x3を出したプレイヤー、無敗なら勝利）
  passCount: number;
  round: number;
  phase: GamePhaseType;
  ruleSettings: RuleSettings;
}

export function createGameState(players: Player[], ruleSettings: RuleSettings = DEFAULT_RULE_SETTINGS): GameState {
  return {
    players,
    currentPlayerIndex: 0,
    field: new Field(),
    discardPile: [],
    isRevolution: false,
    isElevenBack: false,
    isOmenActive: false,
    isEightCutPending: false,
    suitLock: null,
    numberLock: false,
    colorLock: null,
    isReversed: false,
    isTwoBack: false,
    luckySeven: null,
    passCount: 0,
    round: 1,
    phase: GamePhaseType.SETUP,
    ruleSettings,
  };
}
