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

    // ダウンナンバーチェック（同じマークで1つ下の数字を出せる）
    if (context.ruleSettings.downNumber && !context.field.isEmpty()) {
      const fieldPlay = context.field.getCurrentPlay();
      if (fieldPlay && fieldPlay.type === PlayType.SINGLE && cards.length === 1) {
        const fieldCard = fieldPlay.cards[0];
        const playCard = cards[0];

        // 同じマークで、強さが1つ下（strength - 1）の場合は許可
        if (playCard.suit === fieldCard.suit && playCard.strength === fieldCard.strength - 1) {
          // ダウンナンバー成立 - 強さチェックをスキップするためのフラグを返す
          // 注: これは特殊なケースなので、StrengthValidatorで別途処理が必要
          return { valid: true };
        }
      }
    }

    return { valid: true };
  }
}
