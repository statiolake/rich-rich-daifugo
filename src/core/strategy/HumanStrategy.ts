import { Card } from '../domain/card/Card';
import { Player } from '../domain/player/Player';
import { Field } from '../domain/game/Field';
import { GameState } from '../domain/game/GameState';
import { PlayerStrategy, PlayDecision } from './PlayerStrategy';

export class HumanStrategy implements PlayerStrategy {
  private pendingPlayDecision: {
    resolve: (decision: PlayDecision) => void;
  } | null = null;

  private pendingExchangeDecision: {
    resolve: (cards: Card[]) => void;
  } | null = null;

  async decidePlay(
    player: Player,
    field: Field,
    gameState: GameState
  ): Promise<PlayDecision> {
    // UIからの入力を待つ
    return new Promise<PlayDecision>((resolve) => {
      this.pendingPlayDecision = { resolve };
    });
  }

  /**
   * UIから呼ばれる：カードを出す
   */
  submitPlay(cards: Card[]): void {
    if (this.pendingPlayDecision) {
      this.pendingPlayDecision.resolve({ type: 'PLAY', cards });
      this.pendingPlayDecision = null;
    }
  }

  /**
   * UIから呼ばれる：パスする
   */
  submitPass(): void {
    if (this.pendingPlayDecision) {
      this.pendingPlayDecision.resolve({ type: 'PASS' });
      this.pendingPlayDecision = null;
    }
  }

  async decideExchangeCards(player: Player, count: number): Promise<Card[]> {
    // UIからの入力を待つ
    return new Promise<Card[]>((resolve) => {
      this.pendingExchangeDecision = { resolve };
    });
  }

  /**
   * UIから呼ばれる：交換するカードを提出
   */
  submitExchangeCards(cards: Card[]): void {
    if (this.pendingExchangeDecision) {
      this.pendingExchangeDecision.resolve(cards);
      this.pendingExchangeDecision = null;
    }
  }

  /**
   * 現在入力待ちかどうか
   */
  isPendingPlay(): boolean {
    return this.pendingPlayDecision !== null;
  }

  isPendingExchange(): boolean {
    return this.pendingExchangeDecision !== null;
  }
}
