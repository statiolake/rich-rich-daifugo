/**
 * ゲスト用プレイヤーコントローラー
 *
 * HumanPlayerControllerを継承し、選択完了時にホストへ送信する。
 * ゲスト側GameEngineで自分自身のプレイヤー用に使用。
 */

import { Validator } from '../../core/domain/player/PlayerController';
import { Card } from '../../core/domain/card/Card';
import { Player } from '../../core/domain/player/Player';
import { GuestMessage } from '../../infrastructure/network/NetworkProtocol';
import { HumanPlayerController } from './HumanPlayerController';

export class GuestPlayerController extends HumanPlayerController {
  private sendToHost: (message: GuestMessage) => void;

  constructor(
    playerId: string,
    sendToHost: (message: GuestMessage) => void
  ) {
    super(playerId);
    this.sendToHost = sendToHost;
  }

  async chooseCardsInHand(validator: Validator, prompt?: string): Promise<Card[]> {
    console.log('[GuestPlayerController] chooseCardsInHand called');
    // 通常のUI選択を実行
    const selectedCards = await super.chooseCardsInHand(validator, prompt);
    console.log('[GuestPlayerController] User selected cards:', selectedCards.map(c => c.id));

    // 選択結果をホストに送信
    console.log('[GuestPlayerController] Sending INPUT_RESPONSE to host');
    this.sendToHost({
      type: 'INPUT_RESPONSE',
      response: {
        type: 'CARD_SELECTION',
        selectedCardIds: selectedCards.map(c => c.id),
        isPass: selectedCards.length === 0,
      }
    });
    console.log('[GuestPlayerController] INPUT_RESPONSE sent');

    return selectedCards;
  }

  async chooseRankForQueenBomber(): Promise<string> {
    const rank = await super.chooseRankForQueenBomber();

    this.sendToHost({
      type: 'INPUT_RESPONSE',
      response: {
        type: 'RANK_SELECTION',
        selectedRank: rank,
      }
    });

    return rank;
  }

  async chooseCardsFromDiscard(discardPile: Card[], maxCount: number, prompt: string): Promise<Card[]> {
    const selectedCards = await super.chooseCardsFromDiscard(discardPile, maxCount, prompt);

    this.sendToHost({
      type: 'INPUT_RESPONSE',
      response: {
        type: 'CARD_SELECTION',
        selectedCardIds: selectedCards.map(c => c.id),
        isPass: selectedCards.length === 0,
      }
    });

    return selectedCards;
  }

  async chooseCardsForExchange(handCards: Card[], exactCount: number, prompt: string): Promise<Card[]> {
    const selectedCards = await super.chooseCardsForExchange(handCards, exactCount, prompt);

    this.sendToHost({
      type: 'INPUT_RESPONSE',
      response: {
        type: 'CARD_EXCHANGE',
        selectedCardIds: selectedCards.map(c => c.id),
      }
    });

    return selectedCards;
  }

  async choosePlayerForBlackMarket(
    playerIds: string[],
    playerNames: Map<string, string>,
    prompt: string
  ): Promise<string> {
    const selectedPlayerId = await super.choosePlayerForBlackMarket(playerIds, playerNames, prompt);

    this.sendToHost({
      type: 'INPUT_RESPONSE',
      response: {
        type: 'CARD_SELECTION', // TODO: PLAYER_SELECTIONレスポンス型を追加
        selectedCardIds: [],
        isPass: false,
      }
    });

    return selectedPlayerId;
  }

  async chooseCardsFromOpponentHand(cards: Card[], maxCount: number, prompt: string): Promise<Card[]> {
    const selectedCards = await super.chooseCardsFromOpponentHand(cards, maxCount, prompt);

    this.sendToHost({
      type: 'INPUT_RESPONSE',
      response: {
        type: 'CARD_SELECTION',
        selectedCardIds: selectedCards.map(c => c.id),
        isPass: selectedCards.length === 0,
      }
    });

    return selectedCards;
  }

  async choosePlayer(players: Player[], prompt: string): Promise<Player | null> {
    const selectedPlayer = await super.choosePlayer(players, prompt);

    // ホストに送信（選択キャンセルの場合は空文字列）
    // TODO: PLAYER_SELECTIONレスポンス型を追加
    this.sendToHost({
      type: 'INPUT_RESPONSE',
      response: {
        type: 'CARD_SELECTION',
        selectedCardIds: [],
        isPass: selectedPlayer === null,
      }
    });

    return selectedPlayer;
  }

  async chooseCardRank(prompt: string): Promise<string> {
    const rank = await super.chooseCardRank(prompt);

    this.sendToHost({
      type: 'INPUT_RESPONSE',
      response: {
        type: 'RANK_SELECTION',
        selectedRank: rank,
      }
    });

    return rank;
  }

  // choosePlayerOrderとchooseCountdownValueは
  // 現状では暫定実装なので、オーバーライドは不要
}
