import { Card } from '../../domain/card/Card';
import { Player } from '../../domain/player/Player';
import { Field } from '../../domain/game/Field';
import { GameState } from '../../domain/game/GameState';
import { ValidationPipeline } from '../pipeline/ValidationPipeline';
import { RuleContext } from '../context/RuleContext';
import { ValidationResult } from '../validators/BasicValidator';
import { DEFAULT_RULE_SETTINGS } from '../../domain/game/RuleSettings';
import { TriggerEffectAnalyzer } from '../effects/TriggerEffectAnalyzer';
import { PlayAnalyzer } from '../../domain/card/Play';

/**
 * ルールエンジン
 * ValidationPipeline を使用してバリデーションを行う
 */
export class RuleEngine {
  private pipeline: ValidationPipeline;
  private effectAnalyzer: TriggerEffectAnalyzer;

  constructor() {
    this.pipeline = new ValidationPipeline();
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
    const validationResult = this.pipeline.validate(player, cards, context);

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
    // RuleContext を生成（isRevolution, isElevenBack は不要）
    const context: RuleContext = {
      isRevolution: false, // パスには関係ない
      isElevenBack: false, // パスには関係ない
      field: field,
      suitLock: null, // パスには関係ない
      numberLock: false, // パスには関係ない
      ruleSettings: DEFAULT_RULE_SETTINGS, // パスには関係ないがデフォルトを設定
    };

    return this.pipeline.canPass(context);
  }
}
