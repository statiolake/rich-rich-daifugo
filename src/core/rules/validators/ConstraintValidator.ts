import { Card } from '../../domain/card/Card';
import { Player } from '../../domain/player/Player';
import { RuleContext } from '../context/RuleContext';
import { ValidationResult } from './BasicValidator';
import { PlayAnalyzer, PlayType } from '../../domain/card/Play';

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

    // 数字しばりチェック
    if (context.ruleSettings.numberLock && context.numberLock) {
      // 階段（連番）でなければならない
      const play = PlayAnalyzer.analyze(cards);
      if (!play || play.type !== PlayType.STAIR) {
        return {
          valid: false,
          reason: '数字しばりが発動中です（階段のみ）'
        };
      }
    }

    return { valid: true };
  }
}
