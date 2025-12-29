import { PlayerController, Validator } from '../../core/domain/player/PlayerController';
import { Card } from '../../core/domain/card/Card';
import { Player } from '../../core/domain/player/Player';
import { GameState } from '../../core/domain/game/GameState';
import { CPUStrategy } from '../../core/strategy/PlayerStrategy';

/**
 * CPU プレイヤー用のコントローラー
 * CPUStrategy を使用してカード選択を行う
 */
export class CPUPlayerController implements PlayerController {
  constructor(
    private strategy: CPUStrategy,
    private player: Player,
    private gameState: GameState
  ) {}

  async chooseCardsInHand(validator: Validator, _prompt?: string): Promise<Card[]> {
    const handCards = this.player.hand.getCards();

    // ビット全探索で validator を満たすすべての組み合わせを列挙
    const validCombinations: Card[][] = [];
    const n = handCards.length;

    for (let mask = 0; mask < (1 << n); mask++) {
      const combo: Card[] = [];
      for (let i = 0; i < n; i++) {
        if (mask & (1 << i)) {
          combo.push(handCards[i]);
        }
      }

      if (validator.validate(combo).valid) {
        validCombinations.push(combo);
      }
    }

    // 有効な手がない場合（通常はありえないが念のため）
    if (validCombinations.length === 0) {
      return [];
    }

    // 通常プレイかどうかチェック（空配列が有効かどうか）
    const canPass = validator.validate([]).valid;

    if (canPass) {
      // 通常プレイ: パス以外の手がある場合、50%の確率でパス
      const nonPassCombos = validCombinations.filter(c => c.length > 0);

      if (nonPassCombos.length === 0) {
        return []; // パスしかできない
      }

      if (!this.gameState.field.isEmpty() && Math.random() < 0.5) {
        return []; // パス
      }

      // ランダムに選択
      return nonPassCombos[Math.floor(Math.random() * nonPassCombos.length)];
    }

    // 特殊ルール用のカード選択: 有効な組み合わせからランダムに選択
    const nonEmptyCombos = validCombinations.filter(c => c.length > 0);
    if (nonEmptyCombos.length > 0) {
      return nonEmptyCombos[Math.floor(Math.random() * nonEmptyCombos.length)];
    }

    return [];
  }

  async chooseRankForQueenBomber(): Promise<string> {
    const ranks = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
    return ranks[Math.floor(Math.random() * ranks.length)];
  }

  async chooseCardsFromDiscard(discardPile: Card[], maxCount: number, _prompt: string): Promise<Card[]> {
    // CPUは強いカードを優先して回収（シンプルな戦略）
    const sortedCards = [...discardPile].sort((a, b) => b.strength - a.strength);
    const count = Math.min(maxCount, sortedCards.length);
    return sortedCards.slice(0, count);
  }
}
