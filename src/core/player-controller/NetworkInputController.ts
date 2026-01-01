/**
 * ネットワーク入力コントローラー
 *
 * ゲスト側GameEngineで使用。
 * ホストから受信したACTION_PERFORMEDメッセージを待機し、
 * その内容をGameEngineに返す。
 *
 * すべての選択は必ずキューから取り出す方式で統一。
 * データレースを避けるため、キューが空の場合は追加されるまでawaitする。
 *
 * Core層に属し、CoreAction型を使用する。
 * ネットワークプロトコル形式（PlayerAction）からの変換は呼び出し元で行う。
 */

import { Card } from '../domain/card/Card';
import { Player } from '../domain/player/Player';
import { PlayerController, Validator } from '../domain/player/PlayerController';
import { CoreAction } from '../domain/player/CoreAction';

// カードIDからCardオブジェクトを解決するための関数型
type CardResolver = (cardIds: string[]) => Card[];

// 待機中のリゾルバ（キューにアクションが追加されたときに呼ばれる）
type QueueWaiter = () => void;

export class NetworkInputController implements PlayerController {
  private playerId: string;
  private actionQueue: CoreAction[] = [];
  private queueWaiters: QueueWaiter[] = [];
  private cardResolver: CardResolver | null = null;

  constructor(playerId: string) {
    this.playerId = playerId;
  }

  /**
   * カード解決関数を設定（GameEngine初期化時に呼ばれる）
   */
  setCardResolver(resolver: CardResolver): void {
    this.cardResolver = resolver;
  }

  /**
   * ホストからACTION_PERFORMEDを受信した時に呼ばれる
   * キューに追加し、待機中のリゾルバがあれば通知する
   * 呼び出し元でPlayerAction→CoreActionへの変換を行ってから渡すこと
   */
  onActionReceived(action: CoreAction): void {
    console.log(`[NetworkInputController:${this.playerId}] onActionReceived:`, action.type);

    // キューに追加
    this.actionQueue.push(action);
    console.log(`[NetworkInputController:${this.playerId}] Action queued. Queue size: ${this.actionQueue.length}`);

    // 待機中のリゾルバがあれば通知
    if (this.queueWaiters.length > 0) {
      const waiter = this.queueWaiters.shift()!;
      console.log(`[NetworkInputController:${this.playerId}] Notifying waiter`);
      waiter();
    }
  }

  /**
   * 指定されたタイプのアクションがキューに追加されるまで待機し、取り出す
   */
  private async waitForAction(actionType: string): Promise<CoreAction> {
    console.log(`[NetworkInputController:${this.playerId}] waitForAction:`, actionType);

    // キューに該当タイプのアクションがあるか確認
    const existingIndex = this.actionQueue.findIndex(a => a.type === actionType);
    if (existingIndex !== -1) {
      const action = this.actionQueue.splice(existingIndex, 1)[0];
      console.log(`[NetworkInputController:${this.playerId}] Found in queue:`, actionType);
      return action;
    }

    // なければ追加されるまで待機
    console.log(`[NetworkInputController:${this.playerId}] Waiting for:`, actionType);

    return new Promise((resolve) => {
      const checkQueue = () => {
        const index = this.actionQueue.findIndex(a => a.type === actionType);
        if (index !== -1) {
          const action = this.actionQueue.splice(index, 1)[0];
          console.log(`[NetworkInputController:${this.playerId}] Got from queue:`, actionType);
          resolve(action);
        } else {
          // まだないので再度待機
          this.queueWaiters.push(checkQueue);
        }
      };

      this.queueWaiters.push(checkQueue);
    });
  }

  /**
   * キューにアクションがあるかどうか
   */
  hasQueuedActions(): boolean {
    return this.actionQueue.length > 0;
  }

  // --- PlayerController インターフェース実装 ---

  async chooseCardsInHand(validator: Validator, prompt?: string): Promise<Card[]> {
    console.log(`[NetworkInputController:${this.playerId}] chooseCardsInHand called`);

    const action = await this.waitForAction('CARD_SELECTION');

    if (action.type === 'CARD_SELECTION') {
      if (action.isPass || action.cardIds.length === 0) {
        return [];
      } else if (this.cardResolver) {
        return this.cardResolver(action.cardIds);
      } else {
        console.error('[NetworkInputController] No card resolver set');
        return [];
      }
    }

    return [];
  }

  async chooseRankForQueenBomber(): Promise<string> {
    console.log(`[NetworkInputController:${this.playerId}] chooseRankForQueenBomber called`);

    const action = await this.waitForAction('RANK_SELECTION');

    if (action.type === 'RANK_SELECTION') {
      return action.rank;
    }

    return '3'; // デフォルト
  }

  async chooseCardsFromDiscard(discardPile: Card[], maxCount: number, prompt: string): Promise<Card[]> {
    console.log(`[NetworkInputController:${this.playerId}] chooseCardsFromDiscard called`);

    const action = await this.waitForAction('CARD_SELECTION');

    if (action.type === 'CARD_SELECTION') {
      if (action.cardIds.length === 0) {
        return [];
      } else {
        return action.cardIds
          .map(id => discardPile.find(c => c.id === id))
          .filter((c): c is Card => c !== undefined);
      }
    }

    return [];
  }

  async chooseCardsForExchange(handCards: Card[], exactCount: number, prompt: string): Promise<Card[]> {
    console.log(`[NetworkInputController:${this.playerId}] chooseCardsForExchange called`);

    const action = await this.waitForAction('CARD_EXCHANGE');

    if (action.type === 'CARD_EXCHANGE') {
      return action.cardIds
        .map(id => handCards.find(c => c.id === id))
        .filter((c): c is Card => c !== undefined);
    }

    return [];
  }

  async choosePlayerForBlackMarket(
    playerIds: string[],
    playerNames: Map<string, string>,
    prompt: string
  ): Promise<string> {
    console.log(`[NetworkInputController:${this.playerId}] choosePlayerForBlackMarket called`);

    const action = await this.waitForAction('PLAYER_SELECTION');

    if (action.type === 'PLAYER_SELECTION') {
      return action.targetPlayerId;
    }

    return playerIds[0] || ''; // デフォルト
  }

  async chooseCardsFromOpponentHand(cards: Card[], maxCount: number, prompt: string): Promise<Card[]> {
    console.log(`[NetworkInputController:${this.playerId}] chooseCardsFromOpponentHand called`);

    const action = await this.waitForAction('CARD_SELECTION');

    if (action.type === 'CARD_SELECTION') {
      if (action.cardIds.length === 0) {
        return [];
      } else {
        return action.cardIds
          .map(id => cards.find(c => c.id === id))
          .filter((c): c is Card => c !== undefined);
      }
    }

    return [];
  }

  async choosePlayer(players: Player[], prompt: string): Promise<Player | null> {
    console.log(`[NetworkInputController:${this.playerId}] choosePlayer called`);

    const action = await this.waitForAction('PLAYER_SELECTION');

    if (action.type === 'PLAYER_SELECTION') {
      return players.find(p => p.id === action.targetPlayerId) || null;
    }

    return null;
  }

  async chooseCardRank(prompt: string): Promise<string> {
    console.log(`[NetworkInputController:${this.playerId}] chooseCardRank called`);

    const action = await this.waitForAction('RANK_SELECTION');

    if (action.type === 'RANK_SELECTION') {
      return action.rank;
    }

    return '3'; // デフォルト
  }

  async choosePlayerOrder(players: Player[], prompt: string): Promise<Player[] | null> {
    console.log(`[NetworkInputController:${this.playerId}] choosePlayerOrder called`);

    const action = await this.waitForAction('PLAYER_ORDER');

    if (action.type === 'PLAYER_ORDER') {
      // playerIdsの順序に従ってplayersを並び替え
      const orderedPlayers: Player[] = [];
      for (const playerId of action.playerIds) {
        const player = players.find(p => p.id === playerId);
        if (player) {
          orderedPlayers.push(player);
        }
      }
      return orderedPlayers.length > 0 ? orderedPlayers : null;
    }

    return null;
  }

  async chooseCountdownValue(min: number, max: number): Promise<number> {
    console.log(`[NetworkInputController:${this.playerId}] chooseCountdownValue called`);

    const action = await this.waitForAction('COUNTDOWN_VALUE');

    if (action.type === 'COUNTDOWN_VALUE') {
      // min/max範囲内に収める
      return Math.max(min, Math.min(max, action.value));
    }

    return min; // デフォルト
  }
}
