import { PlayerController, Validator } from '../../core/domain/player/PlayerController';
import { Card } from '../../core/domain/card/Card';
import { Player } from '../../core/domain/player/Player';
import { GameState } from '../../core/domain/game/GameState';
import { CPUStrategy } from '../../core/strategy/PlayerStrategy';
import { fieldIsEmpty } from '../../core/domain/game/Field';
import { handGetCards } from '../../core/domain/card/Hand';

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
    // CPU思考時間をシミュレート
    await new Promise(resolve => setTimeout(resolve, 200));

    const handCards = handGetCards(this.player.hand);

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

      if (!fieldIsEmpty(this.gameState.field) && Math.random() < 0.5) {
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
    // CPU思考時間をシミュレート
    await new Promise(resolve => setTimeout(resolve, 200));

    const ranks = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
    return ranks[Math.floor(Math.random() * ranks.length)];
  }

  async chooseCardsFromDiscard(discardPile: Card[], maxCount: number, _prompt: string): Promise<Card[]> {
    // CPU思考時間をシミュレート
    await new Promise(resolve => setTimeout(resolve, 200));

    // CPUは強いカードを優先して回収（シンプルな戦略）
    const sortedCards = [...discardPile].sort((a, b) => b.strength - a.strength);
    const count = Math.min(maxCount, sortedCards.length);
    return sortedCards.slice(0, count);
  }

  async chooseCardsForExchange(handCards: Card[], exactCount: number, _prompt: string): Promise<Card[]> {
    // CPU思考時間をシミュレート
    await new Promise(resolve => setTimeout(resolve, 200));

    // CPUは弱いカードを渡す（強いカードを手元に残す）
    const sortedCards = [...handCards].sort((a, b) => a.strength - b.strength);
    return sortedCards.slice(0, exactCount);
  }

  async choosePlayerForBlackMarket(
    playerIds: string[],
    _playerNames: Map<string, string>,
    _prompt: string
  ): Promise<string> {
    // CPU思考時間をシミュレート
    await new Promise(resolve => setTimeout(resolve, 200));

    // CPUはランダムにプレイヤーを選択
    return playerIds[Math.floor(Math.random() * playerIds.length)];
  }

  async chooseCardsFromOpponentHand(cards: Card[], _maxCount: number, _prompt: string): Promise<Card[]> {
    // CPU思考時間をシミュレート
    await new Promise(resolve => setTimeout(resolve, 200));

    // CPUは強いカードを優先して奪う（シンプルな戦略）
    const sortedCards = [...cards].sort((a, b) => b.strength - a.strength);
    return sortedCards.length > 0 ? [sortedCards[0]] : [];
  }

  async choosePlayer(players: Player[], _prompt: string): Promise<Player | null> {
    // CPU思考時間をシミュレート
    await new Promise(resolve => setTimeout(resolve, 200));

    // CPUはランダムにプレイヤーを選択
    if (players.length === 0) return null;
    return players[Math.floor(Math.random() * players.length)];
  }

  async chooseCardRank(_prompt: string): Promise<string> {
    // CPU思考時間をシミュレート
    await new Promise(resolve => setTimeout(resolve, 200));

    // CPUはランダムにランクを選択
    const ranks = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2', 'JOKER'];
    return ranks[Math.floor(Math.random() * ranks.length)];
  }

  async choosePlayerOrder(players: Player[], _prompt: string): Promise<Player[] | null> {
    // CPU思考時間をシミュレート
    await new Promise(resolve => setTimeout(resolve, 200));

    // CPUはランダムに順序をシャッフル
    const shuffled = [...players];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  async chooseCountdownValue(min: number, max: number): Promise<number> {
    // CPU思考時間をシミュレート
    await new Promise(resolve => setTimeout(resolve, 200));

    // CPUはランダムに値を選択
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
