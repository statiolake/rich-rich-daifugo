import { ValidationRule, ValidationStatus, RuleValidationResult } from '../base/ValidationRule';
import { Card } from '../../domain/card/Card';
import { Player } from '../../domain/player/Player';
import { Field } from '../../domain/game/Field';
import { GameState } from '../../domain/game/GameState';
import { PlayAnalyzer } from '../../domain/card/Play';

/**
 * 強さチェック：場にカードがある場合、それより強い手である必要がある
 */
export class StrongerPlayRule implements ValidationRule {
  readonly name = 'StrongerPlayRule';

  validate(player: Player, cards: Card[], field: Field, gameState: GameState): RuleValidationResult {
    // 場が空ならこのルールはスキップ
    if (field.isEmpty()) {
      return { status: ValidationStatus.PASS };
    }

    const currentPlay = PlayAnalyzer.analyze(cards);
    if (!currentPlay) {
      // 組み合わせが無効な場合はスキップ（別のルールで弾かれる）
      return { status: ValidationStatus.PASS };
    }

    const fieldPlay = field.getCurrentPlay()!;

    if (!PlayAnalyzer.canFollow(fieldPlay, currentPlay, gameState.isRevolution)) {
      return {
        status: ValidationStatus.FORBIDDEN,
        reason: '場のカードより強くありません',
      };
    }

    return { status: ValidationStatus.PASS };
  }
}
