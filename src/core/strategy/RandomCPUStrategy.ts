import { Card } from '../domain/card/Card';
import { Player } from '../domain/player/Player';
import { Field } from '../domain/game/Field';
import { GameState } from '../domain/game/GameState';
import { PlayerStrategy, PlayDecision } from './PlayerStrategy';

export class RandomCPUStrategy implements PlayerStrategy {
  async decidePlay(
    player: Player,
    field: Field,
    gameState: GameState
  ): Promise<PlayDecision> {
    // 出せるカードの組み合わせを取得
    const playable = player.hand.findPlayableCombinations(field, gameState.isRevolution);

    // 出せるカードがない場合はパス
    if (playable.length === 0) {
      return { type: 'PASS' };
    }

    // 場にカードがある場合、50%の確率でパス
    if (!field.isEmpty() && Math.random() < 0.5) {
      return { type: 'PASS' };
    }

    // ランダムに選択
    const chosen = playable[Math.floor(Math.random() * playable.length)];
    return { type: 'PLAY', cards: chosen.cards };
  }

  async decideExchangeCards(player: Player, count: number): Promise<Card[]> {
    // 手札の最初のN枚を返す（シンプルな実装）
    const cards = player.hand.getCards();
    return cards.slice(0, count) as Card[];
  }
}
