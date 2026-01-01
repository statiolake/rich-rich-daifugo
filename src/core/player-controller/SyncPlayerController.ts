/**
 * 同期PlayerControllerラッパー
 *
 * PlayerControllerのすべてのメソッド呼び出しをラップし、
 * 呼び出し完了後にplayer:actionイベントを発行する。
 * これにより、マルチプレイヤーゲームでホスト側の全選択がゲストに同期される。
 */

import { Card } from '../domain/card/Card';
import { Player } from '../domain/player/Player';
import { PlayerController, Validator } from '../domain/player/PlayerController';
import { GameEventEmitter } from '../domain/events/GameEventEmitter';

export class SyncPlayerController implements PlayerController {
  constructor(
    private playerId: string,
    private delegate: PlayerController,
    private eventBus: GameEventEmitter
  ) {}

  async chooseCardsInHand(validator: Validator, prompt?: string): Promise<Card[]> {
    const selectedCards = await this.delegate.chooseCardsInHand(validator, prompt);

    this.eventBus.emit('player:action', {
      playerId: this.playerId,
      action: {
        type: 'CARD_SELECTION',
        cardIds: selectedCards.map(c => c.id),
        isPass: selectedCards.length === 0,
      },
    });

    return selectedCards;
  }

  async chooseRankForQueenBomber(): Promise<string> {
    const rank = await this.delegate.chooseRankForQueenBomber();

    this.eventBus.emit('player:action', {
      playerId: this.playerId,
      action: { type: 'RANK_SELECTION', rank },
    });

    return rank;
  }

  async chooseCardsFromDiscard(discardPile: Card[], maxCount: number, prompt: string): Promise<Card[]> {
    const selectedCards = await this.delegate.chooseCardsFromDiscard(discardPile, maxCount, prompt);

    this.eventBus.emit('player:action', {
      playerId: this.playerId,
      action: {
        type: 'CARD_SELECTION',
        cardIds: selectedCards.map(c => c.id),
        isPass: selectedCards.length === 0,
      },
    });

    return selectedCards;
  }

  async chooseCardsForExchange(handCards: Card[], exactCount: number, prompt: string): Promise<Card[]> {
    const selectedCards = await this.delegate.chooseCardsForExchange(handCards, exactCount, prompt);

    this.eventBus.emit('player:action', {
      playerId: this.playerId,
      action: {
        type: 'CARD_EXCHANGE',
        cardIds: selectedCards.map(c => c.id),
      },
    });

    return selectedCards;
  }

  async choosePlayerForBlackMarket(
    playerIds: string[],
    playerNames: Map<string, string>,
    prompt: string
  ): Promise<string> {
    const targetPlayerId = await this.delegate.choosePlayerForBlackMarket(playerIds, playerNames, prompt);

    this.eventBus.emit('player:action', {
      playerId: this.playerId,
      action: {
        type: 'PLAYER_SELECTION',
        targetPlayerId,
      },
    });

    return targetPlayerId;
  }

  async chooseCardsFromOpponentHand(cards: Card[], maxCount: number, prompt: string): Promise<Card[]> {
    const selectedCards = await this.delegate.chooseCardsFromOpponentHand(cards, maxCount, prompt);

    this.eventBus.emit('player:action', {
      playerId: this.playerId,
      action: {
        type: 'CARD_SELECTION',
        cardIds: selectedCards.map(c => c.id),
        isPass: selectedCards.length === 0,
      },
    });

    return selectedCards;
  }

  async choosePlayer(players: Player[], prompt: string): Promise<Player | null> {
    const selectedPlayer = await this.delegate.choosePlayer(players, prompt);

    this.eventBus.emit('player:action', {
      playerId: this.playerId,
      action: {
        type: 'PLAYER_SELECTION',
        targetPlayerId: selectedPlayer?.id.value ?? '',
      },
    });

    return selectedPlayer;
  }

  async chooseCardRank(prompt: string): Promise<string> {
    const rank = await this.delegate.chooseCardRank(prompt);

    this.eventBus.emit('player:action', {
      playerId: this.playerId,
      action: { type: 'RANK_SELECTION', rank },
    });

    return rank;
  }

  async choosePlayerOrder(players: Player[], prompt: string): Promise<Player[] | null> {
    const orderedPlayers = await this.delegate.choosePlayerOrder(players, prompt);

    // TODO: PLAYER_ORDER型のアクションを追加する必要がある
    // 現在は同期なし

    return orderedPlayers;
  }

  async chooseCountdownValue(min: number, max: number): Promise<number> {
    const value = await this.delegate.chooseCountdownValue(min, max);

    // TODO: COUNTDOWN_VALUE型のアクションを追加する必要がある
    // 現在は同期なし

    return value;
  }
}
