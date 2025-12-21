import { Card } from '../../domain/card/Card';
import { Player } from '../../domain/player/Player';
import { RuleContext } from '../context/RuleContext';
import { BasicValidator, ValidationResult } from '../validators/BasicValidator';
import { StrengthValidator } from '../validators/StrengthValidator';

/**
 * 検証パイプライン
 * 各検証ステップを順序付けて実行する
 */
export class ValidationPipeline {
  private basicValidator: BasicValidator;
  private strengthValidator: StrengthValidator;

  constructor() {
    this.basicValidator = new BasicValidator();
    this.strengthValidator = new StrengthValidator();
  }

  /**
   * すべての検証ステップを実行
   *
   * 検証順序：
   * 1. 基本検証（所有権、組み合わせ）
   * 2. 強さ判定（革命を考慮）
   */
  validate(
    player: Player,
    cards: Card[],
    context: RuleContext
  ): ValidationResult {
    // ステップ1: 基本検証
    const basicResult = this.basicValidator.validate(player, cards, context);
    if (!basicResult.valid) {
      return basicResult;
    }

    // ステップ2: 強さ判定
    return this.strengthValidator.validate(player, cards, context);
  }

  /**
   * パスが有効かどうかを検証
   */
  canPass(context: RuleContext): ValidationResult {
    // 場が空の場合はパスできない
    if (context.field.isEmpty()) {
      return { valid: false, reason: '場が空の時はパスできません' };
    }

    return { valid: true };
  }
}
