import { ValidationRule, ValidationStatus, RuleValidationResult } from '../base/ValidationRule';
import { Card } from '../../domain/card/Card';
import { Player } from '../../domain/player/Player';
import { Field } from '../../domain/game/Field';
import { GameState } from '../../domain/game/GameState';

/**
 * 手札所有権チェック：選択したカードがプレイヤーの手札に存在するか
 */
export class HandOwnershipRule implements ValidationRule {
  readonly name = 'HandOwnershipRule';

  validate(player: Player, cards: Card[], field: Field, gameState: GameState): RuleValidationResult {
    const handCardIds = new Set(player.hand.getCards().map(c => c.id));

    for (const card of cards) {
      if (!handCardIds.has(card.id)) {
        return {
          status: ValidationStatus.FORBIDDEN,
          reason: '手札にないカードが含まれています',
        };
      }
    }

    return { status: ValidationStatus.PASS };
  }
}
