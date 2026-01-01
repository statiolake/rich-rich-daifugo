/**
 * ActionAdapter
 *
 * Core層のCoreAction型とInfrastructure層のPlayerAction型を相互変換する。
 * これにより、Core層がNetworkProtocolの型を直接知らずに済む。
 */

import { Suit } from '../../core/domain/card/Card';
import { CoreAction } from '../../core/domain/player/CoreAction';
import { PlayerAction } from './NetworkProtocol';

/**
 * CoreActionをPlayerActionに変換
 * ホスト側でアクションをブロードキャストする際に使用
 */
export function coreActionToNetworkAction(action: CoreAction): PlayerAction {
  switch (action.type) {
    case 'CARD_SELECTION':
      return {
        type: 'CARD_SELECTION',
        cardIds: action.cardIds,
        isPass: action.isPass,
      };

    case 'RANK_SELECTION':
      return {
        type: 'RANK_SELECTION',
        rank: action.rank,
      };

    case 'SUIT_SELECTION':
      return {
        type: 'SUIT_SELECTION',
        suit: action.suit as Suit,
      };

    case 'CARD_EXCHANGE':
      return {
        type: 'CARD_EXCHANGE',
        cardIds: action.cardIds,
      };

    case 'PLAYER_SELECTION':
      return {
        type: 'PLAYER_SELECTION',
        targetPlayerId: action.targetPlayerId,
      };

    case 'PLAYER_ORDER':
      // NetworkProtocolにはPLAYER_ORDER型がないため、
      // PLAYER_SELECTIONとして最初のプレイヤーを送る（暫定実装）
      // TODO: NetworkProtocolにPLAYER_ORDER型を追加
      return {
        type: 'PLAYER_SELECTION',
        targetPlayerId: action.playerIds[0] ?? '',
      };

    case 'COUNTDOWN_VALUE':
      // NetworkProtocolにはCOUNTDOWN_VALUE型がないため、
      // RANK_SELECTIONとして値を文字列で送る（暫定実装）
      // TODO: NetworkProtocolにCOUNTDOWN_VALUE型を追加
      return {
        type: 'RANK_SELECTION',
        rank: String(action.value),
      };

    default:
      // 型安全のためのexhaustive check
      const _exhaustive: never = action;
      throw new Error(`Unknown action type: ${(_exhaustive as CoreAction).type}`);
  }
}

/**
 * PlayerActionをCoreActionに変換
 * ゲスト側でACTION_PERFORMEDメッセージを受信した際に使用
 */
export function networkActionToCoreAction(action: PlayerAction): CoreAction {
  switch (action.type) {
    case 'CARD_SELECTION':
      return {
        type: 'CARD_SELECTION',
        cardIds: action.cardIds,
        isPass: action.isPass,
      };

    case 'RANK_SELECTION':
      return {
        type: 'RANK_SELECTION',
        rank: action.rank,
      };

    case 'SUIT_SELECTION':
      return {
        type: 'SUIT_SELECTION',
        suit: action.suit,
      };

    case 'CARD_EXCHANGE':
      return {
        type: 'CARD_EXCHANGE',
        cardIds: action.cardIds,
      };

    case 'PLAYER_SELECTION':
      return {
        type: 'PLAYER_SELECTION',
        targetPlayerId: action.targetPlayerId,
      };

    default:
      // 型安全のためのexhaustive check
      const _exhaustive: never = action;
      throw new Error(`Unknown action type: ${(_exhaustive as PlayerAction).type}`);
  }
}
