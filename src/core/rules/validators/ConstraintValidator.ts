import { Card } from '../../domain/card/Card';
import { Player } from '../../domain/player/Player';
import { RuleContext } from '../context/RuleContext';
import { ValidationResult } from './BasicValidator';

/**
 * 制約バリデーター
 * 場の制約（縛りなど）を検証する
 */
export class ConstraintValidator {
  validate(
    player: Player,
    cards: Card[],
    context: RuleContext
  ): ValidationResult {
    // マークしばりチェック
    if (context.ruleSettings.suitLock && context.suitLock) {
      // すべてのカードが同じマークでなければならない
      const allSameSuit = cards.every(card => card.suit === context.suitLock);
      if (!allSameSuit) {
        return {
          valid: false,
          reason: `マークしばりが発動中です（${context.suitLock}のみ）`
        };
      }
    }

    return { valid: true };
  }
}
