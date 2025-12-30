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
  elevenBackDuration: number; // 強化Jバック時の残り場流れ回数（通常0、強化Jバック時は2）
  isOmenActive: boolean; // オーメン発動後、以降革命が起きない
  isSuperRevolutionActive: boolean; // 超革命発動後、以降革命が固定される
  isReligiousRevolutionActive: boolean; // 宗教革命発動後、Q最強、A最弱となる
  oddEvenRestriction: 'odd' | 'even' | null; // 偶奇縛り（宗教革命で発動）
  isEightCutPending: boolean; // 8切りが発動予定（4止めで止められる可能性がある）
  suitLock: string | null; // マークしばり（例: 'SPADE', 'HEART', 'DIAMOND', 'CLUB'）
  numberLock: boolean; // 数字しばり（階段の縛り）
  colorLock: 'red' | 'black' | null; // 色縛り（赤:ハート/ダイヤ、黒:スペード/クラブ）
  isReversed: boolean; // ターン順が逆転しているか（9リバース）
  isTwoBack: boolean; // 2バック状態（2を出すと場が流れるまで強さ逆転）
  isDamianActive: boolean; // ダミアン状態（6x3を出すと場が流れるまでパスした人は敗北）
  luckySeven: { playerId: string } | null; // ラッキーセブン（7x3を出したプレイヤー、無敗なら勝利）
  parityRestriction: 'even' | 'odd' | null; // 偶数/奇数制限（4で偶数のみ、5で奇数のみ）
  isTenFreeActive: boolean; // 10フリ状態（10を出した後、次のプレイヤーはどんなカードでも出せる）
  isDoubleDigitSealActive: boolean; // 2桁封じ状態（6を出すと場が流れるまでJ〜Kが出せなくなる）
  hotMilkRestriction: 'warm' | null; // ホットミルク制限（warm: ダイヤ/ハートのみ）
  isArthurActive: boolean; // アーサー状態（Kx3でジョーカーの強さが10〜Jの間になる）
  deathSentenceTarget: string | null; // 死の宣告対象プレイヤーID（パスすると敗北）
  endCountdownValue: number | null; // 終焉のカウントダウン残り値（パスごとに1減少、0でパスした人が敗北）
  teleforceCountdown: number | null; // テレフォースカウントダウン（7から0へ、ターン終了時に減少）
  partialLockSuits: string[] | null; // 片縛り（複数枚で一部スートが一致すると、そのスートを含む組み合わせのみ出せる）
  excludedCards: Card[]; // 強化8切りで除外されたカード（捨て札にも行かない）
  supplyAidUsed: boolean; // 物資救援使用済み
  scavengingUsed: boolean; // 拾い食い使用済み
  guillotineClockCount: number | null; // ギロチン時計カウント（n回目のパスで敗北）
  passCount: number;
  round: number;
  phase: GamePhaseType;
  ruleSettings: RuleSettings;
  previousDaifugoId: string | null; // 前ラウンドの大富豪のプレイヤーID（都落ち用）
  previousDaihinminId: string | null; // 前ラウンドの大貧民のプレイヤーID（下剋上用）
}

export function createGameState(players: Player[], ruleSettings: RuleSettings = DEFAULT_RULE_SETTINGS): GameState {
  return {
    players,
    currentPlayerIndex: 0,
    field: new Field(),
    discardPile: [],
    isRevolution: false,
    isElevenBack: false,
    elevenBackDuration: 0,
    isOmenActive: false,
    isSuperRevolutionActive: false,
    isReligiousRevolutionActive: false,
    oddEvenRestriction: null,
    isEightCutPending: false,
    suitLock: null,
    numberLock: false,
    colorLock: null,
    isReversed: false,
    isTwoBack: false,
    isDamianActive: false,
    luckySeven: null,
    parityRestriction: null,
    isTenFreeActive: false,
    isDoubleDigitSealActive: false,
    hotMilkRestriction: null,
    isArthurActive: false,
    deathSentenceTarget: null,
    endCountdownValue: null,
    teleforceCountdown: null,
    partialLockSuits: null,
    excludedCards: [],
    supplyAidUsed: false,
    scavengingUsed: false,
    guillotineClockCount: null,
    passCount: 0,
    round: 1,
    phase: GamePhaseType.SETUP,
    ruleSettings,
    previousDaifugoId: null,
    previousDaihinminId: null,
  };
}
