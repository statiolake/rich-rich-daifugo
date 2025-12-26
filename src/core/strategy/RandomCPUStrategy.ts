import { Card, CardFactory, Suit, Rank } from '../domain/card/Card';
import { Player } from '../domain/player/Player';
import { Field } from '../domain/game/Field';
import { GameState } from '../domain/game/GameState';
import { PlayerStrategy, PlayDecision, CardValidator, CardSelectionContext } from './PlayerStrategy';
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

  async selectCards(
    player: Player,
    validator: CardValidator,
    context?: CardSelectionContext
  ): Promise<Card[]> {
    // 少し待機してからCPUが選択したように見せる
    await new Promise(resolve => setTimeout(resolve, 500));

    const handCards = player.hand.getCards();

    // validatorを満たすカードの組み合わせを探す
    // 1枚選択から試す
    for (let i = 0; i < handCards.length; i++) {
      const cards = [handCards[i]];
      if (validator(cards).valid) {
        return cards;
      }
    }

    // 見つからない場合は空配列を返す（スキップ）
    return [];
  }

  async selectRank(
    player: Player
  ): Promise<Rank> {
    // 少し待機してからCPUが選択したように見せる
    await new Promise(resolve => setTimeout(resolve, 500));

    // ランダムにランクを選ぶ
    const ranks: Rank[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
    const randomRank = ranks[Math.floor(Math.random() * ranks.length)];
    console.log(`${player.name}がクイーンボンバーで${randomRank}を指定しました`);
    return randomRank;
  }
}
