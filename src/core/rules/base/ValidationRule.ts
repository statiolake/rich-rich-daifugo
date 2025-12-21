import { Card } from '../../domain/card/Card';
import { Player } from '../../domain/player/Player';
import { Field } from '../../domain/game/Field';
import { GameState } from '../../domain/game/GameState';

/**
 * バリデーションの状態
 * 優先度: PASS < FORBIDDEN < FORCE_ALLOW
 */
export enum ValidationStatus {
  /** 通過：このルールは判定を行わない */
  PASS = 'PASS',
  /** 禁止：このルールによりプレイが禁止される */
  FORBIDDEN = 'FORBIDDEN',
  /** 強制許可：このルールにより常に許可される（非常に強い、特殊ルール用） */
  FORCE_ALLOW = 'FORCE_ALLOW',
}

export interface RuleValidationResult {
  status: ValidationStatus;
  reason?: string;
}

/**
 * プレイバリデーションルールのインターフェース
 */
export interface ValidationRule {
  /**
   * ルールの名前（デバッグ用）
   */
  readonly name: string;

  /**
   * プレイが有効かどうかを検証
   */
  validate(
    player: Player,
    cards: Card[],
    field: Field,
    gameState: GameState
  ): RuleValidationResult;
}
