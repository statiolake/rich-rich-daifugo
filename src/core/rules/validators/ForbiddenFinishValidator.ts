import { Card } from '../../domain/card/Card';
import { Player } from '../../domain/player/Player';
import { RuleContext } from '../context/RuleContext';
import { ValidationResult } from './BasicValidator';

/**
 * 禁止上がりバリデーター
 * J, 2, 8, Joker で上がることができない
 */
export class ForbiddenFinishValidator {
  validate(
    player: Player,
    cards: Card[],
    context: RuleContext
  ): ValidationResult {
    // 禁止上がりルールが無効な場合はチェックしない
    if (!context.ruleSettings.forbiddenFinish) {
      return { valid: true };
    }

    // これらのカードをプレイした後に手札が空になるかチェック
    const remainingCards = player.hand.size() - cards.length;
    if (remainingCards !== 0) {
      // 上がらない場合はチェック不要
      return { valid: true };
    }

    // 禁止カード: J, 2, 8, Joker
    const forbiddenRanks = ['J', '2', '8', 'JOKER'];
    const hasForbiddenCard = cards.some(card => forbiddenRanks.includes(card.rank));

    if (hasForbiddenCard) {
      return {
        valid: false,
        reason: 'J, 2, 8, Jokerでは上がることができません'
      };
    }

    return { valid: true };
  }
}
