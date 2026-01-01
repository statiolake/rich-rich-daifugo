/**
 * ゲーム状態のシリアライズ/デシリアライズ
 *
 * GameStateをネットワーク送信可能なプレーンオブジェクトに変換し、
 * 受信側でクラスインスタンスを復元する。
 */

import { Card, Suit } from '../../core/domain/card/Card';
import { GameState, createGameState } from '../../core/domain/game/GameState';
import { Field, PlayHistory, createField, fieldAddPlay } from '../../core/domain/game/Field';
import { Player, PlayerType, createPlayer } from '../../core/domain/player/Player';
import { createHandData, handSize, handGetCards } from '../../core/domain/card/Hand';
import { createPlayerId } from '../../core/domain/player/PlayerId';
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
    id: player.id, // branded type なので直接使用可能
    name: player.name,
    type: player.type,
    handCardIds: handGetCards(player.hand).map((c) => c.id),
    handSize: handSize(player.hand),
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
  player.hand = createHandData(handCards);
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
    playerId: history.playerId, // branded type なので直接使用可能
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
  const field = createField();

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
        fieldAddPlay(field, play, createPlayerId(playData.playerId));
      }
    }
  }

  return field;
}

/**
 * GameStateからプリミティブフィールドを抽出
 * players, field, discardPile, excludedCards, blindCards, ruleSettings 以外の
 * JSON.stringify可能なフィールドをすべて抽出
 */
function extractStateFields(state: GameState): Record<string, unknown> {
  // クラスインスタンスやオブジェクト配列以外のフィールドを抽出
  const {
    players: _players,
    field: _field,
    discardPile: _discardPile,
    excludedCards: _excludedCards,
    blindCards: _blindCards,
    ruleSettings: _ruleSettings,
    ...primitiveFields
  } = state;

  return primitiveFields;
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
    for (const card of handGetCards(player.hand)) {
      if (!seenCardIds.has(card.id)) {
        allCards.push(serializeCard(card));
        seenCardIds.add(card.id);
      }
    }
  }

  // 場のカードを収集
  for (const history of state.field.history) {
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
    const targetPlayer = state.players.find((p) => p.id === targetPlayerId);
    if (targetPlayer) {
      myHandCards = handGetCards(targetPlayer.hand).map(serializeCard);
    }
  }

  return {
    players: state.players.map(serializePlayer),
    fieldHistory: state.field.history.map(serializeFieldPlay),
    allCards,
    myHandCards,
    // プリミティブフィールドを一括シリアライズ
    stateFields: extractStateFields(state),
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
      player.hand = createHandData(handCards);
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

  // stateFieldsからすべてのフィールドを復元
  const sf = data.stateFields;
  Object.assign(state, sf);

  // 特殊フィールドを上書き
  state.field = field;

  // discardPile, excludedCards, blindCardsをカードIDから復元
  if (sf.discardPile && Array.isArray(sf.discardPile)) {
    state.discardPile = (sf.discardPile as SerializedCard[]).map(c =>
      allCardsMap.get(c.id) ?? deserializeCard(c)
    );
  }
  if (sf.excludedCards && Array.isArray(sf.excludedCards)) {
    state.excludedCards = (sf.excludedCards as SerializedCard[]).map(c =>
      allCardsMap.get(c.id) ?? deserializeCard(c)
    );
  }
  if (sf.blindCards && Array.isArray(sf.blindCards)) {
    state.blindCards = (sf.blindCards as SerializedCard[]).map(c =>
      allCardsMap.get(c.id) ?? deserializeCard(c)
    );
  }

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
