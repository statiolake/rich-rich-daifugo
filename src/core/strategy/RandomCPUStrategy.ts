import { Card, CardFactory, Suit } from '../domain/card/Card';
import { Player } from '../domain/player/Player';
import { Field } from '../domain/game/Field';
import { GameState, CardSelectionRequest } from '../domain/game/GameState';
import { PlayerStrategy, PlayDecision } from './PlayerStrategy';
import type { IValidationEngine } from '../domain/card/Hand';

export class RandomCPUStrategy implements PlayerStrategy {
  private ruleEngine: IValidationEngine | null = null;

  setRuleEngine(ruleEngine: IValidationEngine): void {
    this.ruleEngine = ruleEngine;
  }

  async decidePlay(
    player: Player,
    field: Field,
    gameState: GameState
  ): Promise<PlayDecision> {
    // 出せるカードの組み合わせを取得
    let playableCards: Card[][];
    if (this.ruleEngine) {
      playableCards = player.hand.findAllValidPlays(player, field, gameState, this.ruleEngine);
    } else {
      const playablePlays = player.hand.findPlayableCombinations(field, gameState.isRevolution);
      playableCards = playablePlays.map(play => play.cards);
    }

    // 出せるカードがない場合はパス
    if (playableCards.length === 0) {
      return { type: 'PASS' };
    }

    // 場にカードがある場合、50%の確率でパス
    if (!field.isEmpty() && Math.random() < 0.5) {
      return { type: 'PASS' };
    }

    // ランダムに選択
    const chosen = playableCards[Math.floor(Math.random() * playableCards.length)];
    return { type: 'PLAY', cards: chosen };
  }

  async decideExchangeCards(player: Player, count: number): Promise<Card[]> {
    // 手札の最初のN枚を返す（シンプルな実装）
    const cards = player.hand.getCards();
    return cards.slice(0, count) as Card[];
  }

  async decideCardSelection(
    player: Player,
    request: CardSelectionRequest,
    gameState: GameState
  ): Promise<Card[]> {
    // 少し待機してからCPUが選択したように見せる
    await new Promise(resolve => setTimeout(resolve, 500));

    let selectedCards: Card[] = [];

    switch (request.reason) {
      case 'queenBomberSelect':
        // クイーンボンバー選択：ランダムにランクを選ぶ
        const ranks = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
        const randomRank = ranks[Math.floor(Math.random() * ranks.length)];
        selectedCards = [CardFactory.create(Suit.SPADE, randomRank as any)];
        console.log(`${player.name}がクイーンボンバーで${randomRank}を指定しました`);
        break;

      case 'sevenPass':
        // 7渡し：ランダムに1枚選ぶ
        const cards = player.hand.getCards();
        if (cards.length > 0) {
          selectedCards = [cards[Math.floor(Math.random() * cards.length)]];
        }
        break;

      case 'tenDiscard':
        // 10捨て：ランダムに1枚選ぶ
        const cardsToDiscard = player.hand.getCards();
        if (cardsToDiscard.length > 0) {
          selectedCards = [cardsToDiscard[Math.floor(Math.random() * cardsToDiscard.length)]];
        }
        break;

      case 'queenBomber':
        // クイーンボンバー：指定されたカードを探す
        const specifiedCard = request.specifiedCard;
        if (specifiedCard) {
          const matchingCard = player.hand.getCards().find(
            c => c.rank === specifiedCard.rank && c.suit === specifiedCard.suit
          );
          if (matchingCard) {
            selectedCards = [matchingCard];
          }
          // 手札にない場合は空配列のまま（スキップ）
        }
        break;
    }

    return selectedCards;
  }
}
