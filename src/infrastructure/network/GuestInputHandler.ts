/**
 * ゲスト側入力ハンドラー
 *
 * ゲスト側で使用。ホストからのINPUT_REQUESTを受信し、
 * HumanPlayerControllerと同様のUIを表示してINPUT_RESPONSEを送信する。
 */

import {
  InputRequest,
  InputResponse,
  CardSelectionResponse,
  RankSelectionResponse,
  CardExchangeResponse,
  GuestMessage,
} from './NetworkProtocol';

export interface GuestInputHandlerOptions {
  sendResponse: (message: GuestMessage) => void;
  // UI表示用コールバック
  onCardSelectionRequest?: (request: InputRequest) => void;
  onRankSelectionRequest?: (request: InputRequest) => void;
  onExchangeRequest?: (request: InputRequest) => void;
}

/**
 * ゲスト側の入力リクエストを処理するハンドラー
 */
export class GuestInputHandler {
  private sendResponse: (message: GuestMessage) => void;
  private onCardSelectionRequest?: (request: InputRequest) => void;
  private onRankSelectionRequest?: (request: InputRequest) => void;
  private onExchangeRequest?: (request: InputRequest) => void;

  // 現在のリクエスト
  private currentRequest: InputRequest | null = null;
  private timeoutHandle: NodeJS.Timeout | null = null;

  constructor(options: GuestInputHandlerOptions) {
    this.sendResponse = options.sendResponse;
    this.onCardSelectionRequest = options.onCardSelectionRequest;
    this.onRankSelectionRequest = options.onRankSelectionRequest;
    this.onExchangeRequest = options.onExchangeRequest;
  }

  /**
   * ホストからの入力リクエストを処理
   */
  handleRequest(request: InputRequest): void {
    this.currentRequest = request;
    this.clearTimeout();

    // タイムアウト設定
    this.timeoutHandle = setTimeout(() => {
      this.handleTimeout();
    }, request.timeoutMs);

    // リクエストタイプに応じてUIを表示
    switch (request.type) {
      case 'CARD_SELECTION':
        this.onCardSelectionRequest?.(request);
        break;
      case 'RANK_SELECTION':
        this.onRankSelectionRequest?.(request);
        break;
      case 'SUIT_SELECTION':
        // TODO: スート選択UI
        break;
      case 'CARD_EXCHANGE':
        this.onExchangeRequest?.(request);
        break;
    }
  }

  /**
   * カード選択完了を送信
   */
  submitCardSelection(selectedCardIds: string[], isPass: boolean = false): void {
    if (!this.currentRequest || this.currentRequest.type !== 'CARD_SELECTION') {
      console.warn('[GuestInputHandler] No pending card selection request');
      return;
    }

    this.clearTimeout();

    const response: CardSelectionResponse = {
      type: 'CARD_SELECTION',
      selectedCardIds,
      isPass,
    };

    this.sendResponse({
      type: 'INPUT_RESPONSE',
      response,
    });

    this.currentRequest = null;
  }

  /**
   * ランク選択完了を送信
   */
  submitRankSelection(selectedRank: string): void {
    if (!this.currentRequest || this.currentRequest.type !== 'RANK_SELECTION') {
      console.warn('[GuestInputHandler] No pending rank selection request');
      return;
    }

    this.clearTimeout();

    const response: RankSelectionResponse = {
      type: 'RANK_SELECTION',
      selectedRank,
    };

    this.sendResponse({
      type: 'INPUT_RESPONSE',
      response,
    });

    this.currentRequest = null;
  }

  /**
   * カード交換完了を送信
   */
  submitCardExchange(selectedCardIds: string[]): void {
    if (!this.currentRequest || this.currentRequest.type !== 'CARD_EXCHANGE') {
      console.warn('[GuestInputHandler] No pending exchange request');
      return;
    }

    this.clearTimeout();

    const response: CardExchangeResponse = {
      type: 'CARD_EXCHANGE',
      selectedCardIds,
    };

    this.sendResponse({
      type: 'INPUT_RESPONSE',
      response,
    });

    this.currentRequest = null;
  }

  /**
   * パスを送信
   */
  submitPass(): void {
    this.submitCardSelection([], true);
  }

  /**
   * タイムアウト時の処理
   */
  private handleTimeout(): void {
    if (!this.currentRequest) return;

    console.log('[GuestInputHandler] Request timed out, sending default response');

    switch (this.currentRequest.type) {
      case 'CARD_SELECTION':
        // タイムアウト時は自動パス
        this.submitCardSelection([], true);
        break;
      case 'RANK_SELECTION':
        // タイムアウト時はデフォルトのランク
        this.submitRankSelection('3');
        break;
      case 'SUIT_SELECTION':
        // TODO
        break;
      case 'CARD_EXCHANGE':
        // タイムアウト時は空の交換
        this.submitCardExchange([]);
        break;
    }
  }

  private clearTimeout(): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
  }

  /**
   * 現在のリクエストを取得
   */
  getCurrentRequest(): InputRequest | null {
    return this.currentRequest;
  }

  /**
   * リクエスト待機中かどうか
   */
  isPending(): boolean {
    return this.currentRequest !== null;
  }

  /**
   * ハンドラーを破棄
   */
  dispose(): void {
    this.clearTimeout();
    this.currentRequest = null;
  }
}
