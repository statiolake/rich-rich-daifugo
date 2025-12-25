import { create } from 'zustand';
import { Card } from '../../core/domain/card/Card';
import { GameState } from '../../core/domain/game/GameState';
import { PlayerType } from '../../core/domain/player/Player';
import {
  calculateHumanHandPosition,
  calculateCPUHandPosition,
  calculateFieldPosition,
} from '../utils/cardPositionCalculator';

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

    // 1. 手札のカードを更新
    gameState.players.forEach((player, playerIndex) => {
      player.hand.getCards().forEach((card, cardIndex) => {
        const pos = updated.get(card.id);
        if (!pos) return;

        // 位置計算
        const isHuman = player.type === PlayerType.HUMAN;
        const targetPos = isHuman
          ? calculateHumanHandPosition(cardIndex, player.hand.size())
          : calculateCPUHandPosition(
              playerIndex,
              cardIndex,
              gameState.players.length
            );

        // 位置が変化した場合、またはlocation/ownerIdが変化した場合に更新
        const positionChanged = pos.x !== targetPos.x || pos.y !== targetPos.y;
        const locationChanged =
          pos.location !== 'hand' || pos.ownerId !== player.id.value;

        if (locationChanged || positionChanged) {
          updated.set(card.id, {
            ...pos,
            x: targetPos.x,
            y: targetPos.y,
            location: 'hand',
            ownerId: player.id.value,
            isFaceUp: isHuman,
            opacity: 1,
            // カードが場から戻ってきた場合は長めに、位置調整の場合は短めに
            transitionDuration: locationChanged ? 500 : 200,
            zIndex: 100 + cardIndex,
          });
        }
      });
    });

    // 2. 場のカードを更新
    gameState.field.getHistory().forEach((playHistory, playIndex) => {
      const totalCardsInPlay = playHistory.play.cards.length;
      playHistory.play.cards.forEach((card, cardIndex) => {
        const pos = updated.get(card.id);
        if (!pos) return;

        const targetPos = calculateFieldPosition(playIndex, cardIndex, totalCardsInPlay);

        if (pos.location !== 'field') {
          updated.set(card.id, {
            ...pos,
            x: targetPos.x,
            y: targetPos.y,
            rotation: targetPos.rotation,
            location: 'field',
            isFaceUp: true,
            opacity: 1,
            transitionDuration: 400,
            zIndex: 200 + playIndex * 10 + cardIndex,
          });
        }
      });
    });

    // 3. 場が流れた場合（historyが空）
    if (gameState.field.getHistory().length === 0) {
      updated.forEach((pos, cardId) => {
        if (pos.location === 'field') {
          // 捨て札へ（画面外にフェードアウト）
          updated.set(cardId, {
            ...pos,
            opacity: 0,
            scale: 0.8,
            location: 'discarded',
            transitionDuration: 500,
          });
        }
      });
    }

    // 4. 手札にも場にも属さないカードを捨て札に（10捨て、クイーンボンバーなど）
    // 手札と場のカードIDのセットを作成
    const inPlayCardIds = new Set<string>();
    gameState.players.forEach(player => {
      player.hand.getCards().forEach(card => inPlayCardIds.add(card.id));
    });
    gameState.field.getHistory().forEach(playHistory => {
      playHistory.play.cards.forEach(card => inPlayCardIds.add(card.id));
    });

    // 手札にも場にも属さず、location が 'hand' または 'field' のカードを捨て札に
    updated.forEach((pos, cardId) => {
      if (!inPlayCardIds.has(cardId) && (pos.location === 'hand' || pos.location === 'field')) {
        updated.set(cardId, {
          ...pos,
          opacity: 0,
          scale: 0.8,
          location: 'discarded',
          transitionDuration: 500,
        });
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
