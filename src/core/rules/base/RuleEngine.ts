import { Card } from '../../domain/card/Card';
import { Player } from '../../domain/player/Player';
import { Field } from '../../domain/game/Field';
import { GameState } from '../../domain/game/GameState';
import { RuleContext } from '../context/RuleContext';
import { PlayValidator, ValidationResult } from '../validators/PlayValidator';
import { DEFAULT_RULE_SETTINGS } from '../../domain/game/RuleSettings';
import { TriggerEffectAnalyzer } from '../effects/TriggerEffectAnalyzer';
import { PlayAnalyzer } from '../../domain/card/Play';

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
   */
  validate(
    player: Player,
    cards: Card[],
    field: Field,
    gameState: GameState
  ): ValidationResult {
    // RuleContext を生成
    const context: RuleContext = {
      isRevolution: gameState.isRevolution,
      isElevenBack: gameState.isElevenBack,
      field: field,
      suitLock: gameState.suitLock,
      numberLock: gameState.numberLock,
      ruleSettings: gameState.ruleSettings,
    };

    // バリデーション実行
    const validationResult = this.validator.validate(player, cards, context);

    // 有効なプレイの場合のみ、トリガーエフェクトを分析
    if (validationResult.valid && cards.length > 0) {
      const play = PlayAnalyzer.analyze(cards);
      if (play) {
        const triggerEffects = this.effectAnalyzer.analyze(play, gameState);
        return {
          ...validationResult,
          triggerEffects: triggerEffects.length > 0 ? triggerEffects : undefined,
        };
      }
    }

    return validationResult;
  }

  /**
   * パスが有効かどうかを検証
   */
  canPass(field: Field): ValidationResult {
    // 場が空の場合はパスできない
    if (field.isEmpty()) {
      return { valid: false, reason: '場が空の時はパスできません' };
    }

    return { valid: true, reason: '' };
  }
}
