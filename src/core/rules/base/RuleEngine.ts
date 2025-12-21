import { Card } from '../../domain/card/Card';
import { Player } from '../../domain/player/Player';
import { Field } from '../../domain/game/Field';
import { GameState } from '../../domain/game/GameState';
import { ValidationPipeline } from '../pipeline/ValidationPipeline';
import { RuleContext } from '../context/RuleContext';
import { ValidationResult } from '../validators/BasicValidator';

/**
 * ルールエンジン
 * ValidationPipeline を使用してバリデーションを行う
 */
export class RuleEngine {
  private pipeline: ValidationPipeline;

  constructor() {
    this.pipeline = new ValidationPipeline();
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
    };

    return this.pipeline.validate(player, cards, context);
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
    };

    return this.pipeline.canPass(context);
  }
}
