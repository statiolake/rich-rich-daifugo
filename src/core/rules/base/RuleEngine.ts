import { Card } from '../../domain/card/Card';
import { Player } from '../../domain/player/Player';
import { Field } from '../../domain/game/Field';
import { GameState } from '../../domain/game/GameState';
import { ValidationRule, ValidationStatus, RuleValidationResult } from './ValidationRule';

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * 複数のルールを組み合わせてバリデーションを行うエンジン
 */
export class RuleEngine {
  constructor(private rules: ValidationRule[]) {}

  /**
   * すべてのルールを評価してプレイの有効性を判定
   * 優先度: PASS < FORBIDDEN < FORCE_ALLOW
   * 最終的に FORBIDDEN なら禁止、PASS または FORCE_ALLOW なら許可
   */
  validate(
    player: Player,
    cards: Card[],
    field: Field,
    gameState: GameState
  ): ValidationResult {
    let finalStatus = ValidationStatus.PASS;
    let finalReason: string | undefined;

    for (const rule of this.rules) {
      const result = rule.validate(player, cards, field, gameState);

      // 優先度に基づいて上書き
      if (result.status === ValidationStatus.FORCE_ALLOW) {
        finalStatus = ValidationStatus.FORCE_ALLOW;
        finalReason = result.reason;
      } else if (result.status === ValidationStatus.FORBIDDEN && finalStatus !== ValidationStatus.FORCE_ALLOW) {
        finalStatus = ValidationStatus.FORBIDDEN;
        finalReason = result.reason;
      }
    }

    return {
      valid: finalStatus !== ValidationStatus.FORBIDDEN,
      reason: finalReason,
    };
  }

  /**
   * パスが有効かどうかを検証
   */
  canPass(field: Field): ValidationResult {
    // 場が空の場合はパスできない
    if (field.isEmpty()) {
      return { valid: false, reason: '場が空の時はパスできません' };
    }

    return { valid: true };
  }
}
