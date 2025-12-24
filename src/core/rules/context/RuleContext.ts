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

  // 場の状態
  field: Field;

  // ルール設定
  ruleSettings: RuleSettings;
}
