/**
 * リモートプレイヤーコントローラー
 *
 * ホスト側で使用。ゲストプレイヤーの入力をネットワーク経由で待つ。
 * 各メソッドでINPUT_REQUEST送信 → INPUT_RESPONSE待機
 */

import { Card, Suit } from '../../core/domain/card/Card';
import { Player } from '../../core/domain/player/Player';
import { PlayerController, Validator } from '../../core/domain/player/PlayerController';
import {
  InputRequest,
  InputResponse,
  CardSelectionRequest,
  RankSelectionRequest,
  CardExchangeRequest,
  DEFAULT_TIMEOUT_MS,
} from './NetworkProtocol';

export interface RemotePlayerControllerOptions {
  playerId: string;
  playerName: string;
  sendRequest: (request: InputRequest) => void;
  onTimeout?: () => void;
  timeoutMs?: number;
}

/**
 * リモートプレイヤーからの入力を待つコントローラー
 */
export class RemotePlayerController implements PlayerController {
  private playerId: string;
  private playerName: string;
  private sendRequest: (request: InputRequest) => void;
  private onTimeout?: () => void;
  private timeoutMs: number;

  // 現在待機中のリクエスト
  private pendingResolver: ((response: InputResponse) => void) | null = null;
  private pendingRejecter: ((error: Error) => void) | null = null;
  private timeoutHandle: NodeJS.Timeout | null = null;

  constructor(options: RemotePlayerControllerOptions) {
    this.playerId = options.playerId;
    this.playerName = options.playerName;
    this.sendRequest = options.sendRequest;
    this.onTimeout = options.onTimeout;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /**
   * レスポンスを受信したときに呼ぶ
   */
  receiveResponse(response: InputResponse): void {
    if (this.pendingResolver) {
      this.clearTimeout();
      this.pendingResolver(response);
      this.pendingResolver = null;
      this.pendingRejecter = null;
    }
  }

  /**
   * 入力リクエストを送信してレスポンスを待つ
   */
  private async waitForResponse<T extends InputResponse>(
    request: InputRequest
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      this.pendingResolver = resolve as (response: InputResponse) => void;
      this.pendingRejecter = reject;

      // タイムアウト設定
      this.timeoutHandle = setTimeout(() => {
        if (this.pendingRejecter) {
          this.pendingRejecter(new Error('Input timeout'));
          this.pendingResolver = null;
          this.pendingRejecter = null;
          this.onTimeout?.();
        }
      }, this.timeoutMs);

      // リクエスト送信
      this.sendRequest(request);
    });
  }

  private clearTimeout(): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
  }

  /**
   * 手札からカードを選択
   */
  async chooseCardsInHand(validator: Validator, prompt?: string): Promise<Card[]> {
    // TODO: validatorを直接送れないので、有効なカードIDリストを計算して送る
    // 現時点では空配列（バリデーション情報なし）で送信
    const request: CardSelectionRequest = {
      type: 'CARD_SELECTION',
      playerId: this.playerId,
      validCardIds: [], // ホスト側でバリデーション
      canPass: true,
      timeoutMs: this.timeoutMs,
    };

    try {
      const response = await this.waitForResponse<InputResponse>(request);
      if (response.type === 'CARD_SELECTION') {
        if (response.isPass) {
          return [];
        }
        // カードIDからカードオブジェクトを復元
        // 注: 実際のカードオブジェクトはホスト側のGameStateから取得する必要がある
        // ここではIDのみを持つ仮のカードオブジェクトを返す
        return response.selectedCardIds.map((id) => this.createPlaceholderCard(id));
      }
      return [];
    } catch {
      // タイムアウト時は自動パス
      return [];
    }
  }

  /**
   * クイーンボンバー用のランクを選択
   */
  async chooseRankForQueenBomber(): Promise<string> {
    const availableRanks = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];

    const request: RankSelectionRequest = {
      type: 'RANK_SELECTION',
      playerId: this.playerId,
      availableRanks,
      timeoutMs: this.timeoutMs,
    };

    try {
      const response = await this.waitForResponse<InputResponse>(request);
      if (response.type === 'RANK_SELECTION') {
        return response.selectedRank;
      }
      return '3'; // デフォルト
    } catch {
      return '3'; // タイムアウト時はデフォルト
    }
  }

  /**
   * 捨て札からカードを選択
   */
  async chooseCardsFromDiscard(
    discardPile: Card[],
    maxCount: number,
    prompt: string
  ): Promise<Card[]> {
    const request: CardSelectionRequest = {
      type: 'CARD_SELECTION',
      playerId: this.playerId,
      validCardIds: discardPile.map((c) => c.id),
      canPass: true,
      timeoutMs: this.timeoutMs,
    };

    try {
      const response = await this.waitForResponse<InputResponse>(request);
      if (response.type === 'CARD_SELECTION') {
        // 選択されたカードを返す
        return discardPile.filter((c) =>
          response.selectedCardIds.includes(c.id)
        ).slice(0, maxCount);
      }
      return [];
    } catch {
      return [];
    }
  }

  /**
   * 交換フェーズ用のカード選択
   */
  async chooseCardsForExchange(
    handCards: Card[],
    exactCount: number,
    prompt: string
  ): Promise<Card[]> {
    const request: CardExchangeRequest = {
      type: 'CARD_EXCHANGE',
      playerId: this.playerId,
      requiredCount: exactCount,
      timeoutMs: this.timeoutMs,
    };

    try {
      const response = await this.waitForResponse<InputResponse>(request);
      if (response.type === 'CARD_EXCHANGE') {
        // 選択されたカードを返す
        return handCards.filter((c) =>
          response.selectedCardIds.includes(c.id)
        );
      }
      // タイムアウト or 不正な応答: 手札から強制選択
      return handCards.slice(0, exactCount);
    } catch {
      return handCards.slice(0, exactCount);
    }
  }

  /**
   * 闇市用のプレイヤー選択
   */
  async choosePlayerForBlackMarket(
    playerIds: string[],
    playerNames: Map<string, string>,
    prompt: string
  ): Promise<string> {
    // 簡易実装: 最初のプレイヤーを返す
    // TODO: プレイヤー選択用のリクエストタイプを追加
    return playerIds[0];
  }

  /**
   * 対戦相手の手札からカードを選択
   */
  async chooseCardsFromOpponentHand(
    cards: Card[],
    maxCount: number,
    prompt: string
  ): Promise<Card[]> {
    const request: CardSelectionRequest = {
      type: 'CARD_SELECTION',
      playerId: this.playerId,
      validCardIds: cards.map((c) => c.id),
      canPass: true,
      timeoutMs: this.timeoutMs,
    };

    try {
      const response = await this.waitForResponse<InputResponse>(request);
      if (response.type === 'CARD_SELECTION') {
        return cards.filter((c) =>
          response.selectedCardIds.includes(c.id)
        ).slice(0, maxCount);
      }
      return [];
    } catch {
      return [];
    }
  }

  /**
   * プレイヤーを選択
   */
  async choosePlayer(players: Player[], prompt: string): Promise<Player | null> {
    // 簡易実装: 最初のプレイヤーを返す
    // TODO: プレイヤー選択用のリクエストタイプを追加
    return players[0] ?? null;
  }

  /**
   * カードのランクを選択
   */
  async chooseCardRank(prompt: string): Promise<string> {
    const request: RankSelectionRequest = {
      type: 'RANK_SELECTION',
      playerId: this.playerId,
      availableRanks: ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2', 'JOKER'],
      timeoutMs: this.timeoutMs,
    };

    try {
      const response = await this.waitForResponse<InputResponse>(request);
      if (response.type === 'RANK_SELECTION') {
        return response.selectedRank;
      }
      return '3';
    } catch {
      return '3';
    }
  }

  /**
   * プレイヤーの順序を選択
   */
  async choosePlayerOrder(
    players: Player[],
    prompt: string
  ): Promise<Player[] | null> {
    // 簡易実装: 現在の順序をそのまま返す
    // TODO: 順序選択用のリクエストタイプを追加
    return players;
  }

  /**
   * カウントダウン値を選択
   */
  async chooseCountdownValue(min: number, max: number): Promise<number> {
    // 簡易実装: 最大値を返す
    // TODO: 数値選択用のリクエストタイプを追加
    return max;
  }

  /**
   * プレースホルダーカードを作成
   * ホスト側で実際のカードオブジェクトに置き換える必要がある
   */
  private createPlaceholderCard(id: string): Card {
    return {
      id,
      suit: Suit.SPADE,
      rank: '3', // プレースホルダーとして最低ランクを使用
      strength: 0,
    };
  }

  /**
   * コントローラーを破棄
   */
  dispose(): void {
    this.clearTimeout();
    if (this.pendingRejecter) {
      this.pendingRejecter(new Error('Controller disposed'));
      this.pendingResolver = null;
      this.pendingRejecter = null;
    }
  }
}
