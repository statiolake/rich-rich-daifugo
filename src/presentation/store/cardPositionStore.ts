import { create } from 'zustand';
import { Card } from '../../core/domain/card/Card';
import { GameState } from '../../core/domain/game/GameState';
import {
  calculateHumanHandPosition,
  calculateCPUHandPosition,
  calculateFieldPosition,
} from '../utils/cardPositionCalculator';
import { useGameStore } from './gameStore';
import { handGetCards, handSize } from '../../core/domain/card/Hand';

// カード位置の状態
export interface CardPosition {
  cardId: string;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  opacity: number;
  zIndex: number;
  location: 'deck' | 'hand' | 'field' | 'discarded';
  ownerId?: string; // 手札の場合、プレイヤーID
  isFaceUp: boolean;
  transitionDuration: number; // アニメーション時間（ms）
}

interface CardPositionStore {
  cards: Map<string, CardPosition>;

  initialize: (allCards: Card[]) => void;
  syncWithGameState: (gameState: GameState) => void;
  updateCardPosition: (cardId: string, updates: Partial<CardPosition>) => void;
}

export const useCardPositionStore = create<CardPositionStore>((set, get) => ({
  cards: new Map(),

  initialize: (allCards) => {
    const cards = new Map<string, CardPosition>();
    const deckPos = { x: 50, y: 50 }; // 画面左上

    allCards.forEach((card, index) => {
      cards.set(card.id, {
        cardId: card.id,
        x: deckPos.x,
        y: deckPos.y,
        rotation: 0,
        scale: 1,
        opacity: 0, // 初期は非表示
        zIndex: index,
        location: 'deck',
        isFaceUp: false,
        transitionDuration: 0,
      });
    });

    set({ cards });
  },

  syncWithGameState: (gameState) => {
    const { cards } = get();
    const updated = new Map(cards);

    // ローカルプレイヤーIDをgameStoreから取得（シングル/マルチ共通）
    const localPlayerId = useGameStore.getState().localPlayerId;

    // 手札と場のカードIDのセットを作成
    const handCardIds = new Set<string>();
    const fieldCardIds = new Set<string>();
    const cardToHandInfo = new Map<string, { playerIndex: number; playerId: string; cardIndex: number; isLocalPlayer: boolean }>();
    const cardToFieldInfo = new Map<string, { playIndex: number; cardIndex: number; totalCards: number }>();

    // 1. 手札のカードを収集
    gameState.players.forEach((player, playerIndex) => {
      handGetCards(player.hand).forEach((card, cardIndex) => {
        handCardIds.add(card.id);
        cardToHandInfo.set(card.id, {
          playerIndex,
          playerId: player.id,
          cardIndex,
          isLocalPlayer: player.id === localPlayerId,
        });
      });
    });

    // 2. 場のカードを収集
    gameState.field.history.forEach((playHistory, playIndex) => {
      const totalCardsInPlay = playHistory.play.cards.length;
      playHistory.play.cards.forEach((card, cardIndex) => {
        fieldCardIds.add(card.id);
        cardToFieldInfo.set(card.id, {
          playIndex,
          cardIndex,
          totalCards: totalCardsInPlay,
        });
      });
    });

    // 3. すべてのカードを総なめして位置を決定
    updated.forEach((pos, cardId) => {
      if (handCardIds.has(cardId)) {
        // 手札にあるカード
        const info = cardToHandInfo.get(cardId)!;

        // ローカルプレイヤーの手札は画面下に、他のプレイヤーは上部に配置
        // マルチプレイの場合、ローカルプレイヤー以外のプレイヤーインデックスを計算
        const localPlayerIndex = gameState.players.findIndex(p => p.id === localPlayerId);
        const adjustedPlayerIndex = info.isLocalPlayer
          ? 0  // ローカルプレイヤーは常に画面下（インデックス0相当）
          : info.playerIndex < localPlayerIndex
            ? info.playerIndex + 1  // ローカルより前のプレイヤーは+1
            : info.playerIndex;  // ローカルより後のプレイヤーはそのまま

        const targetPos = info.isLocalPlayer
          ? calculateHumanHandPosition(info.cardIndex, handSize(gameState.players[info.playerIndex].hand))
          : calculateCPUHandPosition(adjustedPlayerIndex, info.cardIndex, gameState.players.length);

        const locationChanged = pos.location !== 'hand' || pos.ownerId !== info.playerId;
        const positionChanged = pos.x !== targetPos.x || pos.y !== targetPos.y;

        if (locationChanged || positionChanged) {
          updated.set(cardId, {
            ...pos,
            x: targetPos.x,
            y: targetPos.y,
            location: 'hand',
            ownerId: info.playerId,
            isFaceUp: info.isLocalPlayer,  // ローカルプレイヤーの手札のみ表向き
            opacity: 1,
            scale: 1,
            transitionDuration: locationChanged ? 500 : 200,
            zIndex: 100 + info.cardIndex,
          });
        }
      } else if (fieldCardIds.has(cardId)) {
        // 場にあるカード
        const info = cardToFieldInfo.get(cardId)!;
        const targetPos = calculateFieldPosition(info.playIndex, info.cardIndex, info.totalCards);

        const locationChanged = pos.location !== 'field';
        const positionChanged = pos.x !== targetPos.x || pos.y !== targetPos.y;

        if (locationChanged || positionChanged) {
          updated.set(cardId, {
            ...pos,
            x: targetPos.x,
            y: targetPos.y,
            rotation: targetPos.rotation,
            location: 'field',
            isFaceUp: true,
            opacity: 1,
            scale: 1,
            transitionDuration: locationChanged ? 400 : 200,
            zIndex: 200 + info.playIndex * 10 + info.cardIndex,
          });
        }
      } else {
        // 手札にも場にもないカード = 捨て札
        if (pos.location !== 'discarded') {
          updated.set(cardId, {
            ...pos,
            opacity: 0,
            scale: 0.8,
            location: 'discarded',
            transitionDuration: 500,
          });
        }
      }
    });

    set({ cards: updated });
  },

  updateCardPosition: (cardId, updates) => {
    const { cards } = get();
    const current = cards.get(cardId);
    if (current) {
      const updated = new Map(cards);
      updated.set(cardId, { ...current, ...updates });
      set({ cards: updated });
    }
  },
}));
