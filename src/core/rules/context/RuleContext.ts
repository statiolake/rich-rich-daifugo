import { Field } from '../../domain/game/Field';

/**
 * ルールコンテキスト
 * バリデーション時に必要な状態をすべて保持する
 */
export interface RuleContext {
  // ゲーム状態
  isRevolution: boolean;

  // 場の状態
  field: Field;
}
