/**
 * ネットワーク入力コントローラー
 *
 * ゲスト側GameEngineで使用。
 * ホストから受信したACTION_PERFORMEDメッセージを待機し、
 * その内容をGameEngineに返す。
 */

import { Card } from '../domain/card/Card';
import { Player } from '../domain/player/Player';
import { PlayerController, Validator } from '../domain/player/PlayerController';
import { PlayerAction } from '../../infrastructure/network/NetworkProtocol';

// カードIDからCardオブジェクトを解決するための関数型
type CardResolver = (cardIds: string[]) => Card[];

export class NetworkInputController implements PlayerController {
  private playerId: string;
  private pendingResolvers = new Map<string, (action: PlayerAction) => void>();
  private actionQueue: PlayerAction[] = [];  // アクションキュー
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
   * resolverがまだなければキューに貯める
   */
  onActionReceived(action: PlayerAction): void {
    console.log(`[NetworkInputController:${this.playerId}] onActionReceived:`, action.type);
    console.log(`[NetworkInputController:${this.playerId}] Pending resolvers:`, Array.from(this.pendingResolvers.keys()));
    const resolver = this.pendingResolvers.get(action.type);
    if (resolver) {
      console.log(`[NetworkInputController:${this.playerId}] Found resolver, executing...`);
      resolver(action);
      this.pendingResolvers.delete(action.type);
      console.log(`[NetworkInputController:${this.playerId}] Resolver executed and removed`);
    } else {
      // resolverがまだないのでキューに貯める
      console.log(`[NetworkInputController:${this.playerId}] No resolver yet, queuing action`);
      this.actionQueue.push(action);
    }
  }

  /**
   * キューからアクションを取り出して処理を試みる
   */
  private tryProcessQueue(actionType: string): PlayerAction | null {
    const index = this.actionQueue.findIndex(a => a.type === actionType);
    if (index !== -1) {
      const action = this.actionQueue.splice(index, 1)[0];
      console.log(`[NetworkInputController:${this.playerId}] Found queued action:`, actionType);
      return action;
    }
    return null;
  }

  /**
   * 待機中のアクションがあるかどうか
   */
  hasPendingAction(): boolean {
    return this.pendingResolvers.size > 0;
  }

  /**
   * キューにアクションがあるかどうか
   */
  hasQueuedActions(): boolean {
    return this.actionQueue.length > 0;
  }

  // --- PlayerController インターフェース実装 ---

  async chooseCardsInHand(validator: Validator, prompt?: string): Promise<Card[]> {
    console.log(`[NetworkInputController:${this.playerId}] chooseCardsInHand called, waiting for CARD_SELECTION`);

    // まずキューを確認
    const queuedAction = this.tryProcessQueue('CARD_SELECTION');
    if (queuedAction && queuedAction.type === 'CARD_SELECTION') {
      console.log(`[NetworkInputController:${this.playerId}] Using queued CARD_SELECTION action`);
      if (queuedAction.isPass || queuedAction.cardIds.length === 0) {
        return [];
      } else if (this.cardResolver) {
        return this.cardResolver(queuedAction.cardIds);
      } else {
        console.error('[NetworkInputController] No card resolver set');
        return [];
      }
    }

    // キューになければresolverを設定して待機
    return new Promise((resolve) => {
      this.pendingResolvers.set('CARD_SELECTION', (action) => {
        console.log(`[NetworkInputController:${this.playerId}] CARD_SELECTION resolver triggered`);
        if (action.type === 'CARD_SELECTION') {
          if (action.isPass || action.cardIds.length === 0) {
            resolve([]);
          } else if (this.cardResolver) {
            resolve(this.cardResolver(action.cardIds));
          } else {
            console.error('[NetworkInputController] No card resolver set');
            resolve([]);
          }
        }
      });
    });
  }

  async chooseRankForQueenBomber(): Promise<string> {
    // まずキューを確認
    const queuedAction = this.tryProcessQueue('RANK_SELECTION');
    if (queuedAction && queuedAction.type === 'RANK_SELECTION') {
      return queuedAction.rank;
    }

    return new Promise((resolve) => {
      this.pendingResolvers.set('RANK_SELECTION', (action) => {
        if (action.type === 'RANK_SELECTION') {
          resolve(action.rank);
        }
      });
    });
  }

  async chooseCardsFromDiscard(discardPile: Card[], maxCount: number, prompt: string): Promise<Card[]> {
    // まずキューを確認
    const queuedAction = this.tryProcessQueue('CARD_SELECTION');
    if (queuedAction && queuedAction.type === 'CARD_SELECTION') {
      if (queuedAction.cardIds.length === 0) {
        return [];
      } else {
        const cards = queuedAction.cardIds
          .map(id => discardPile.find(c => c.id === id))
          .filter((c): c is Card => c !== undefined);
        return cards;
      }
    }

    return new Promise((resolve) => {
      this.pendingResolvers.set('CARD_SELECTION', (action) => {
        if (action.type === 'CARD_SELECTION') {
          if (action.cardIds.length === 0) {
            resolve([]);
          } else {
            // discardPileからカードを検索
            const cards = action.cardIds
              .map(id => discardPile.find(c => c.id === id))
              .filter((c): c is Card => c !== undefined);
            resolve(cards);
          }
        }
      });
    });
  }

  async chooseCardsForExchange(handCards: Card[], exactCount: number, prompt: string): Promise<Card[]> {
    // まずキューを確認
    const queuedAction = this.tryProcessQueue('CARD_EXCHANGE');
    if (queuedAction && queuedAction.type === 'CARD_EXCHANGE') {
      const cards = queuedAction.cardIds
        .map(id => handCards.find(c => c.id === id))
        .filter((c): c is Card => c !== undefined);
      return cards;
    }

    return new Promise((resolve) => {
      this.pendingResolvers.set('CARD_EXCHANGE', (action) => {
        if (action.type === 'CARD_EXCHANGE') {
          // handCardsからカードを検索
          const cards = action.cardIds
            .map(id => handCards.find(c => c.id === id))
            .filter((c): c is Card => c !== undefined);
          resolve(cards);
        }
      });
    });
  }

  async choosePlayerForBlackMarket(
    playerIds: string[],
    playerNames: Map<string, string>,
    prompt: string
  ): Promise<string> {
    // まずキューを確認
    const queuedAction = this.tryProcessQueue('PLAYER_SELECTION');
    if (queuedAction && queuedAction.type === 'PLAYER_SELECTION') {
      return queuedAction.targetPlayerId;
    }

    return new Promise((resolve) => {
      this.pendingResolvers.set('PLAYER_SELECTION', (action) => {
        if (action.type === 'PLAYER_SELECTION') {
          resolve(action.targetPlayerId);
        }
      });
    });
  }

  async chooseCardsFromOpponentHand(cards: Card[], maxCount: number, prompt: string): Promise<Card[]> {
    // まずキューを確認
    const queuedAction = this.tryProcessQueue('CARD_SELECTION');
    if (queuedAction && queuedAction.type === 'CARD_SELECTION') {
      if (queuedAction.cardIds.length === 0) {
        return [];
      } else {
        const selectedCards = queuedAction.cardIds
          .map(id => cards.find(c => c.id === id))
          .filter((c): c is Card => c !== undefined);
        return selectedCards;
      }
    }

    return new Promise((resolve) => {
      this.pendingResolvers.set('CARD_SELECTION', (action) => {
        if (action.type === 'CARD_SELECTION') {
          if (action.cardIds.length === 0) {
            resolve([]);
          } else {
            // cardsからカードを検索
            const selectedCards = action.cardIds
              .map(id => cards.find(c => c.id === id))
              .filter((c): c is Card => c !== undefined);
            resolve(selectedCards);
          }
        }
      });
    });
  }

  async choosePlayer(players: Player[], prompt: string): Promise<Player | null> {
    // まずキューを確認
    const queuedAction = this.tryProcessQueue('PLAYER_SELECTION');
    if (queuedAction && queuedAction.type === 'PLAYER_SELECTION') {
      return players.find(p => p.id.value === queuedAction.targetPlayerId) || null;
    }

    return new Promise((resolve) => {
      this.pendingResolvers.set('PLAYER_SELECTION', (action) => {
        if (action.type === 'PLAYER_SELECTION') {
          const player = players.find(p => p.id.value === action.targetPlayerId) || null;
          resolve(player);
        }
      });
    });
  }

  async chooseCardRank(prompt: string): Promise<string> {
    // まずキューを確認
    const queuedAction = this.tryProcessQueue('RANK_SELECTION');
    if (queuedAction && queuedAction.type === 'RANK_SELECTION') {
      return queuedAction.rank;
    }

    return new Promise((resolve) => {
      this.pendingResolvers.set('RANK_SELECTION', (action) => {
        if (action.type === 'RANK_SELECTION') {
          resolve(action.rank);
        }
      });
    });
  }

  async choosePlayerOrder(players: Player[], prompt: string): Promise<Player[] | null> {
    // 9シャッフルはACTION_PERFORMEDで配列として送信される
    // 今回は簡略化のため、そのまま元の順序を返す（将来的に対応）
    return new Promise((resolve) => {
      // TODO: PLAYER_ORDER型のアクションを追加する必要がある
      resolve(players);
    });
  }

  async chooseCountdownValue(min: number, max: number): Promise<number> {
    // 終焉のカウントダウン用
    // 今回は簡略化のため、最小値を返す（将来的に対応）
    return new Promise((resolve) => {
      // TODO: COUNTDOWN_VALUE型のアクションを追加する必要がある
      resolve(min);
    });
  }
}
