/**
 * ゲーム状態のシリアライズ/デシリアライズ
 *
 * GameStateをネットワーク送信可能なプレーンオブジェクトに変換し、
 * 受信側でクラスインスタンスを復元する。
 */

import { Card, Suit } from '../../core/domain/card/Card';
import { GameState, GamePhaseType, createGameState } from '../../core/domain/game/GameState';
import { Field, PlayHistory } from '../../core/domain/game/Field';
import { Player, PlayerType, createPlayer } from '../../core/domain/player/Player';
import { Hand } from '../../core/domain/card/Hand';
import { PlayerId } from '../../core/domain/player/PlayerId';
import { PlayerRank } from '../../core/domain/player/PlayerRank';
import { Play, PlayAnalyzer, PlayType } from '../../core/domain/card/Play';
import {
  SerializedGameState,
  SerializedPlayer,
  SerializedCard,
  SerializedFieldPlay,
} from './NetworkProtocol';

/**
 * カードをシリアライズ
 */
export function serializeCard(card: Card): SerializedCard {
  return {
    id: card.id,
    suit: card.suit,
    rank: card.rank,
    strength: card.strength,
  };
}

/**
 * カードをデシリアライズ
 */
export function deserializeCard(data: SerializedCard): Card {
  return {
    id: data.id,
    suit: data.suit,
    rank: data.rank,
    strength: data.strength,
  };
}

/**
 * プレイヤーをシリアライズ
 */
export function serializePlayer(player: Player): SerializedPlayer {
  return {
    id: player.id.value,
    name: player.name,
    type: player.type,
    handCardIds: player.hand.getCards().map((c) => c.id),
    handSize: player.hand.size(),
    rank: player.rank,
    isFinished: player.isFinished,
    finishPosition: player.finishPosition,
  };
}

/**
 * プレイヤーをデシリアライズ
 * @param data シリアライズされたプレイヤーデータ
 * @param allCards すべてのカード（手札復元用）
 */
export function deserializePlayer(
  data: SerializedPlayer,
  allCards: Map<string, Card>
): Player {
  // 手札を復元
  const handCards = data.handCardIds
    .map((id) => allCards.get(id))
    .filter((c): c is Card => c !== undefined);

  const player = createPlayer(data.id, data.name, data.type as PlayerType);
  player.hand = new Hand(handCards);
  player.rank = data.rank as PlayerRank | null;
  player.isFinished = data.isFinished;
  player.finishPosition = data.finishPosition;

  return player;
}

/**
 * 場のプレイをシリアライズ
 */
export function serializeFieldPlay(history: PlayHistory): SerializedFieldPlay {
  return {
    playerId: history.playerId.value,
    cardIds: history.play.cards.map((c) => c.id),
    isPass: history.play.cards.length === 0,
  };
}

/**
 * Fieldをデシリアライズ
 */
export function deserializeField(
  historyData: SerializedFieldPlay[],
  allCards: Map<string, Card>
): Field {
  const field = new Field();

  for (const playData of historyData) {
    if (playData.isPass) {
      // パスの場合はスキップ（Fieldにはカードプレイのみ記録される）
      continue;
    }

    // カードプレイの場合
    const cards = playData.cardIds
      .map((id) => allCards.get(id))
      .filter((c): c is Card => c !== undefined);

    if (cards.length > 0) {
      const play = PlayAnalyzer.analyze(cards);
      if (play) {
        field.addPlay(play, new PlayerId(playData.playerId));
      }
    }
  }

  return field;
}

/**
 * GameStateをシリアライズ
 * @param state ゲーム状態
 * @param targetPlayerId 宛先プレイヤーID（このプレイヤーには手札詳細を含める）
 */
export function serializeGameState(
  state: GameState,
  targetPlayerId?: string
): SerializedGameState {
  // すべてのカードを収集
  const allCards: SerializedCard[] = [];
  const seenCardIds = new Set<string>();

  // プレイヤーの手札からカードを収集
  for (const player of state.players) {
    for (const card of player.hand.getCards()) {
      if (!seenCardIds.has(card.id)) {
        allCards.push(serializeCard(card));
        seenCardIds.add(card.id);
      }
    }
  }

  // 場のカードを収集
  for (const history of state.field.getHistory()) {
    for (const card of history.play.cards) {
      if (!seenCardIds.has(card.id)) {
        allCards.push(serializeCard(card));
        seenCardIds.add(card.id);
      }
    }
  }

  // 捨て札のカードを収集
  for (const card of state.discardPile) {
    if (!seenCardIds.has(card.id)) {
      allCards.push(serializeCard(card));
      seenCardIds.add(card.id);
    }
  }

  // 除外カードを収集
  for (const card of state.excludedCards) {
    if (!seenCardIds.has(card.id)) {
      allCards.push(serializeCard(card));
      seenCardIds.add(card.id);
    }
  }

  // ブラインドカードを収集
  for (const card of state.blindCards) {
    if (!seenCardIds.has(card.id)) {
      allCards.push(serializeCard(card));
      seenCardIds.add(card.id);
    }
  }

  // 対象プレイヤーの手札詳細
  let myHandCards: SerializedCard[] | undefined;
  if (targetPlayerId) {
    const targetPlayer = state.players.find((p) => p.id.value === targetPlayerId);
    if (targetPlayer) {
      myHandCards = targetPlayer.hand.getCards().map(serializeCard);
    }
  }

  return {
    round: state.round,
    phase: state.phase,
    currentPlayerIndex: state.currentPlayerIndex,
    players: state.players.map(serializePlayer),
    fieldHistory: state.field.getHistory().map(serializeFieldPlay),
    isRevolution: state.isRevolution,
    isReversed: state.isReversed,
    isElevenBack: state.isElevenBack,
    isTwoBack: state.isTwoBack,
    suitLock: state.suitLock,
    numberLock: state.numberLock,
    colorLock: state.colorLock,
    allCards,
    myHandCards,
  };
}

/**
 * GameStateをデシリアライズ
 * @param data シリアライズされたゲーム状態
 * @param localPlayerId ローカルプレイヤーのID（手札詳細の適用先）
 */
export function deserializeGameState(
  data: SerializedGameState,
  localPlayerId?: string
): GameState {
  // カードマップを構築
  const allCardsMap = new Map<string, Card>();
  for (const cardData of data.allCards) {
    allCardsMap.set(cardData.id, deserializeCard(cardData));
  }

  // 自分の手札があれば追加
  if (data.myHandCards) {
    for (const cardData of data.myHandCards) {
      allCardsMap.set(cardData.id, deserializeCard(cardData));
    }
  }

  // プレイヤーを復元
  const players: Player[] = data.players.map((playerData) => {
    // ローカルプレイヤーの場合、詳細な手札情報を使用
    if (localPlayerId && playerData.id === localPlayerId && data.myHandCards) {
      const handCards = data.myHandCards.map(deserializeCard);
      const player = createPlayer(playerData.id, playerData.name, playerData.type as PlayerType);
      player.hand = new Hand(handCards);
      player.rank = playerData.rank as PlayerRank | null;
      player.isFinished = playerData.isFinished;
      player.finishPosition = playerData.finishPosition;
      return player;
    }
    return deserializePlayer(playerData, allCardsMap);
  });

  // Fieldを復元
  const field = deserializeField(data.fieldHistory, allCardsMap);

  // GameStateを構築
  const state = createGameState(players);

  // 各フィールドを設定
  state.round = data.round;
  state.phase = data.phase as GamePhaseType;
  state.currentPlayerIndex = data.currentPlayerIndex;
  state.field = field;
  state.isRevolution = data.isRevolution;
  state.isReversed = data.isReversed;
  state.isElevenBack = data.isElevenBack;
  state.isTwoBack = data.isTwoBack;
  state.suitLock = data.suitLock;
  state.numberLock = data.numberLock;
  state.colorLock = data.colorLock;

  return state;
}

/**
 * ゲーム状態をJSON文字列にシリアライズ
 */
export function stringifyGameState(
  state: GameState,
  targetPlayerId?: string
): string {
  return JSON.stringify(serializeGameState(state, targetPlayerId));
}

/**
 * JSON文字列からゲーム状態をデシリアライズ
 */
export function parseGameState(
  json: string,
  localPlayerId?: string
): GameState {
  const data = JSON.parse(json) as SerializedGameState;
  return deserializeGameState(data, localPlayerId);
}
