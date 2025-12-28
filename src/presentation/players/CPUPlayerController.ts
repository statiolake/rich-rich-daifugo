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

  async chooseCardsInHand(validator: Validator): Promise<Card[]> {
    // CPU思考時間をシミュレート
    await new Promise(resolve => setTimeout(resolve, 500));

    // 通常プレイかどうかチェック（validator が空配列を許可するかで判定）
    const canPass = validator.validate([]);

    if (canPass) {
      // 通常プレイ: CPUStrategy を使用
      const decision = await this.strategy.decidePlay(
        this.player,
        this.gameState.field,
        this.gameState
      );

      if (decision.type === 'PLAY' && decision.cards) {
        return decision.cards;
      }

      return []; // パス
    }

    // 特殊ルール用のカード選択: validator で有効なカードを列挙してランダム選択
    const handCards = this.player.hand.getCards();

    // すべての可能な組み合わせを試す（1枚選択の場合）
    const validCards = handCards.filter(c => validator.validate([c]));
    if (validCards.length > 0) {
      return [validCards[Math.floor(Math.random() * validCards.length)]];
    }

    // 複数枚選択の場合（クイーンボンバー）: 指定ランクのカードをすべて選択
    // validator が手札のすべてのカードを許可するかチェック
    const cardsByRank = new Map<string, Card[]>();
    for (const card of handCards) {
      if (!cardsByRank.has(card.rank)) {
        cardsByRank.set(card.rank, []);
      }
      cardsByRank.get(card.rank)!.push(card);
    }

    // 各ランクのカードグループをチェック
    for (const cards of cardsByRank.values()) {
      if (validator.validate(cards)) {
        return cards;
      }
    }

    return [];
  }

  async chooseRankForQueenBomber(): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 300));

    const ranks = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
    return ranks[Math.floor(Math.random() * ranks.length)];
  }
}
