import { Card } from '../../domain/card/Card';
import { Player } from '../../domain/player/Player';
import { PlayAnalyzer } from '../../domain/card/Play';
import { RuleContext } from '../context/RuleContext';

/**
 * バリデーション結果
 */
export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * 基本バリデーター
 * 所有権チェックと組み合わせチェックを行う
 */
export class BasicValidator {
  /**
   * プレイが基本的に有効かどうかを検証
   * 1. プレイヤーがそのカードを所有しているか
   * 2. カードの組み合わせが有効か（ペア、階段など）
   */
  validate(
    player: Player,
    cards: Card[],
    context: RuleContext
  ): ValidationResult {
    // 所有権チェック
    const ownershipResult = this.validateOwnership(player, cards);
    if (!ownershipResult.valid) {
      return ownershipResult;
    }

    // 組み合わせチェック
    return this.validateCombination(cards);
  }

  /**
   * 所有権チェック：プレイヤーが選択したカードを所有しているか
   */
  private validateOwnership(player: Player, cards: Card[]): ValidationResult {
    const playerCardIds = new Set(player.hand.getCards().map(c => c.id));

    for (const card of cards) {
      if (!playerCardIds.has(card.id)) {
        return {
          valid: false,
          reason: 'そのカードは手札にありません',
        };
      }
    }

    return { valid: true };
  }

  /**
   * 組み合わせチェック：カードの組み合わせが有効な役か
   */
  private validateCombination(cards: Card[]): ValidationResult {
    const play = PlayAnalyzer.analyze(cards);

    if (!play) {
      return {
        valid: false,
        reason: '無効なカードの組み合わせです',
      };
    }

    return { valid: true };
  }
}
