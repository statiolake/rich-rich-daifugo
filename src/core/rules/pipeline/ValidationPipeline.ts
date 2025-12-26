import { Card } from '../../domain/card/Card';
import { Player } from '../../domain/player/Player';
import { RuleContext } from '../context/RuleContext';
import { BasicValidator, ValidationResult } from '../validators/BasicValidator';
import { ConstraintValidator } from '../validators/ConstraintValidator';
import { StrengthValidator } from '../validators/StrengthValidator';
import { ForbiddenFinishValidator } from '../validators/ForbiddenFinishValidator';

/**
 * 検証パイプライン
 * 各検証ステップを順序付けて実行する
 */
export class ValidationPipeline {
  private basicValidator: BasicValidator;
  private constraintValidator: ConstraintValidator;
  private strengthValidator: StrengthValidator;
  private forbiddenFinishValidator: ForbiddenFinishValidator;

  constructor() {
    this.basicValidator = new BasicValidator();
    this.constraintValidator = new ConstraintValidator();
    this.strengthValidator = new StrengthValidator();
    this.forbiddenFinishValidator = new ForbiddenFinishValidator();
  }

  /**
   * すべての検証ステップを実行
   *
   * 検証順序：
   * 1. 基本検証（所有権、組み合わせ）
   * 2. 制約検証（縛りなど）
   * 3. 強さ判定（革命を考慮）
   * 4. 禁止上がり（J, 2, 8, Joker で上がれない）
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

    // ステップ2: 制約検証
    const constraintResult = this.constraintValidator.validate(player, cards, context);
    if (!constraintResult.valid) {
      return constraintResult;
    }

    // ステップ3: 強さ判定
    const strengthResult = this.strengthValidator.validate(player, cards, context);
    if (!strengthResult.valid) {
      return strengthResult;
    }

    // ステップ4: 禁止上がり
    return this.forbiddenFinishValidator.validate(player, cards, context);
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
