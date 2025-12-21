import { Card } from '../domain/card/Card';
import { Player } from '../domain/player/Player';
import { Field } from '../domain/game/Field';
import { GameState } from '../domain/game/GameState';
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
}
