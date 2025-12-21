import { Card } from '../../domain/card/Card';
import { Player } from '../../domain/player/Player';
import { PlayAnalyzer } from '../../domain/card/Play';
import { RuleContext } from '../context/RuleContext';
import { ValidationResult } from './BasicValidator';

/**
 * 強さバリデーター
 * 場にカードがある場合、それより強い手である必要がある
 */
export class StrengthValidator {
  /**
   * プレイが場のカードより強いかどうかを検証
   */
  validate(
    player: Player,
    cards: Card[],
    context: RuleContext
  ): ValidationResult {
    // 場が空ならどんなカードでも出せる
    if (context.field.isEmpty()) {
      return { valid: true };
    }

    const currentPlay = PlayAnalyzer.analyze(cards);
    if (!currentPlay) {
      // 組み合わせが無効な場合（すでに BasicValidator でチェックされている）
      return { valid: true };
    }

    const fieldPlay = context.field.getCurrentPlay()!;

    // PlayAnalyzer.canFollow で強さをチェック
    // isRevolution を渡して、革命時の強さ判定を行う
    if (!PlayAnalyzer.canFollow(fieldPlay, currentPlay, context.isRevolution)) {
      return {
        valid: false,
        reason: '場のカードより強くありません',
      };
    }

    return { valid: true };
  }
}
