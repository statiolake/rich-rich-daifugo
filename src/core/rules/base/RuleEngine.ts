import { Card } from '../../domain/card/Card';
import { Player } from '../../domain/player/Player';
import { Field } from '../../domain/game/Field';
import { GameState } from '../../domain/game/GameState';
import { RuleContext } from '../context/RuleContext';
import { PlayValidator, ValidationResult } from '../validators/PlayValidator';
import { DEFAULT_RULE_SETTINGS } from '../../domain/game/RuleSettings';
import { TriggerEffectAnalyzer } from '../effects/TriggerEffectAnalyzer';
import { PlayAnalyzer } from '../../domain/card/Play';

// Re-export ValidationResult for external use
export type { ValidationResult };

/**
 * ルールエンジン
 * PlayValidator を使用してバリデーションを行う
 */
export class RuleEngine {
  private validator: PlayValidator;
  private effectAnalyzer: TriggerEffectAnalyzer;

  constructor() {
    this.validator = new PlayValidator();
    this.effectAnalyzer = new TriggerEffectAnalyzer();
  }

  /**
   * プレイの有効性を判定
   * 空配列を渡すとパスの有効性を判定する
   */
  validate(
    player: Player,
    cards: Card[],
    field: Field,
    gameState: GameState
  ): ValidationResult {
    // 空配列 = パス
    if (cards.length === 0) {
      if (field.isEmpty()) {
        return { valid: false, reason: '場が空の時はパスできません' };
      }
      return { valid: true };
    }

    // RuleContext を生成
    const context: RuleContext = {
      isRevolution: gameState.isRevolution,
      isElevenBack: gameState.isElevenBack,
      isTwoBack: gameState.isTwoBack,
      isTenFreeActive: gameState.isTenFreeActive,
      isArthurActive: gameState.isArthurActive,
      isReligiousRevolutionActive: gameState.isReligiousRevolutionActive,
      oddEvenRestriction: gameState.oddEvenRestriction,
      field: field,
      suitLock: gameState.suitLock,
      numberLock: gameState.numberLock,
      parityRestriction: gameState.parityRestriction,
      isDoubleDigitSealActive: gameState.isDoubleDigitSealActive,
      hotMilkRestriction: gameState.hotMilkRestriction,
      partialLockSuits: gameState.partialLockSuits,
      ruleSettings: gameState.ruleSettings,
    };

    // バリデーション実行
    const result = this.validator.validate(player, cards, context);

    // valid な場合、発動するエフェクトを分析
    if (result.valid) {
      const play = PlayAnalyzer.analyze(cards);
      if (play) {
        const effects = this.effectAnalyzer.analyze(play, gameState);
        if (effects.length > 0) {
          result.triggeredEffects = effects;
        }
      }
    }

    return result;
  }
}
