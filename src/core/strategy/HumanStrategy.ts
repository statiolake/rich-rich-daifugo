import { Card, Rank } from '../domain/card/Card';
import { Player } from '../domain/player/Player';
import { FieldClass as Field } from '../domain/game/Field';
import { GameState } from '../domain/game/GameState';
import { PlayerStrategy, PlayDecision, CardValidator, CardSelectionContext } from './PlayerStrategy';

export class HumanStrategy implements PlayerStrategy {
  private pendingPlayDecision: {
    resolve: (decision: PlayDecision) => void;
  } | null = null;

  private pendingExchangeDecision: {
    resolve: (cards: Card[]) => void;
  } | null = null;

  private pendingCardSelection: {
    resolve: (cards: Card[]) => void;
    validator: CardValidator;
    context?: CardSelectionContext;
  } | null = null;

  private pendingRankSelection: {
    resolve: (rank: Rank) => void;
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

  async selectCards(
    player: Player,
    validator: CardValidator,
    context?: CardSelectionContext
  ): Promise<Card[]> {
    // UIからの入力を待つ
    return new Promise<Card[]>((resolve) => {
      this.pendingCardSelection = { resolve, validator, context };
    });
  }

  async selectRank(
    player: Player
  ): Promise<Rank> {
    // UIからのランク選択を待つ
    return new Promise<Rank>((resolve) => {
      this.pendingRankSelection = { resolve };
    });
  }

  /**
   * UIから呼ばれる：カード選択を提出
   */
  submitCardSelection(cards: Card[]): void {
    if (this.pendingCardSelection) {
      const validation = this.pendingCardSelection.validator(cards);
      if (validation.valid) {
        this.pendingCardSelection.resolve(cards);
        // 即座にnullにリセット（選択画面から抜ける）
        this.pendingCardSelection = null;
      }
      // validationに失敗した場合は何もしない（UIでエラー表示）
    }
  }

  /**
   * UIから呼ばれる：ランク選択を提出
   */
  submitRankSelection(rank: Rank): void {
    if (this.pendingRankSelection) {
      this.pendingRankSelection.resolve(rank);
      this.pendingRankSelection = null;
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

  isPendingCardSelection(): boolean {
    return this.pendingCardSelection !== null;
  }

  isPendingRankSelection(): boolean {
    return this.pendingRankSelection !== null;
  }

  /**
   * 現在のvalidatorを取得（UIでのハイライトに使用）
   */
  getCurrentValidator(): CardValidator | null {
    return this.pendingCardSelection?.validator || null;
  }

  /**
   * 現在のカード選択コンテキストを取得（UIでの表示に使用）
   */
  getCurrentContext(): CardSelectionContext | null {
    return this.pendingCardSelection?.context || null;
  }
}
