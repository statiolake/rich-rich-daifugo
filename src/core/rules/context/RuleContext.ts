import { Field } from '../../domain/game/Field';
import { RuleSettings } from '../../domain/game/RuleSettings';

/**
 * ルールコンテキスト
 * バリデーション時に必要な状態をすべて保持する
 */
export interface RuleContext {
  // ゲーム状態
  isRevolution: boolean;
  isElevenBack: boolean;
  isTwoBack: boolean; // 2バック状態（2を出すと場が流れるまで強さ逆転）
  isTenFreeActive: boolean; // 10フリ状態（10を出した後、次のプレイヤーはどんなカードでも出せる）
  isArthurActive: boolean; // アーサー状態（Kx3でジョーカーの強さが10〜Jの間になる）
  isReligiousRevolutionActive: boolean; // 宗教革命状態（Q最強、A最弱）
  oddEvenRestriction: 'odd' | 'even' | null; // 偶奇縛り（宗教革命で発動）

  // 場の状態
  field: Field;

  // 縛り状態
  suitLock: string | null; // マークしばり
  numberLock: boolean; // 数字しばり
  parityRestriction: 'even' | 'odd' | null; // 偶数/奇数制限
  isDoubleDigitSealActive: boolean; // 2桁封じ状態（J〜Kが出せなくなる）
  hotMilkRestriction: 'warm' | null; // ホットミルク制限（warm: ダイヤ/ハートのみ）
  partialLockSuits: string[] | null; // 片縛り（複数枚で一部スートが一致した時のロックスート）

  // ルール設定
  ruleSettings: RuleSettings;
}
