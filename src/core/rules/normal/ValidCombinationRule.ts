import { ValidationRule, ValidationStatus, RuleValidationResult } from '../base/ValidationRule';
import { Card } from '../../domain/card/Card';
import { Player } from '../../domain/player/Player';
import { Field } from '../../domain/game/Field';
import { GameState } from '../../domain/game/GameState';
import { PlayAnalyzer } from '../../domain/card/Play';

/**
 * 有効な組み合わせチェック：カードの組み合わせが有効な役か（ペア、階段など）
 */
export class ValidCombinationRule implements ValidationRule {
  readonly name = 'ValidCombinationRule';

  validate(player: Player, cards: Card[], field: Field, gameState: GameState): RuleValidationResult {
    const play = PlayAnalyzer.analyze(cards);

    if (!play) {
      return {
        status: ValidationStatus.FORBIDDEN,
        reason: '無効なカードの組み合わせです',
      };
    }

    return { status: ValidationStatus.PASS };
  }
}
