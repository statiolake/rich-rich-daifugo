/**
 * selectionStore
 *
 * 各種選択UI（カード選択、ランク選択、プレイヤー選択など）の状態を管理する。
 * gameStore から分離された独立したZustandストア。
 */

import { create } from 'zustand';
import { Card } from '../../core/domain/card/Card';
import { Player } from '../../core/domain/player/Player';
import { Validator } from '../../core/domain/player/PlayerController';

// ゲスト用カード選択コールバック型
type GuestCardSelectionCallback = (selectedCardIds: string[], isPass: boolean) => void;

interface SelectionStore {
  // ===== 手札からのカード選択 =====
  selectedCards: Card[];
  cardSelectionCallback: ((cards: Card[]) => void) | null;
  cardSelectionValidator: Validator | null;
  cardSelectionPrompt: string | null;
  isCardSelectionEnabled: boolean;

  setCardSelectionCallback: (callback: (cards: Card[]) => void) => void;
  clearCardSelectionCallback: () => void;
  enableCardSelection: (validator: Validator, prompt?: string) => void;
  disableCardSelection: () => void;
  toggleCardSelection: (card: Card) => void;
  clearSelection: () => void;
  submitCardSelection: () => void;

  // ===== ゲスト用カード選択 =====
  guestCardSelectionCallback: GuestCardSelectionCallback | null;
  enableGuestCardSelection: (
    validCardIds: string[],
    canPass: boolean,
    callback: GuestCardSelectionCallback,
    prompt?: string
  ) => void;
  submitGuestCardSelection: (isPass?: boolean) => void;

  // ===== クイーンボンバーのランク選択 =====
  queenBomberRankCallback: ((rank: string) => void) | null;
  isQueenBomberRankSelectionEnabled: boolean;

  setQueenBomberRankCallback: (callback: (rank: string) => void) => void;
  clearQueenBomberRankCallback: () => void;
  showQueenBomberRankSelectionUI: () => void;
  hideQueenBomberRankSelectionUI: () => void;
  submitQueenBomberRank: (rank: string) => void;

  // ===== 捨て札からのカード選択 =====
  discardSelectionCallback: ((cards: Card[]) => void) | null;
  isDiscardSelectionEnabled: boolean;
  discardSelectionPile: Card[];
  discardSelectionMaxCount: number;
  discardSelectionPrompt: string | null;
  selectedDiscardCards: Card[];

  setDiscardSelectionCallback: (callback: (cards: Card[]) => void) => void;
  clearDiscardSelectionCallback: () => void;
  enableDiscardSelection: (discardPile: Card[], maxCount: number, prompt: string) => void;
  disableDiscardSelection: () => void;
  toggleDiscardCardSelection: (card: Card) => void;
  submitDiscardSelection: () => void;

  // ===== カード交換選択 =====
  exchangeSelectionCallback: ((cards: Card[]) => void) | null;
  isExchangeSelectionEnabled: boolean;
  exchangeSelectionCards: Card[];
  exchangeSelectionCount: number;
  exchangeSelectionPrompt: string | null;
  selectedExchangeCards: Card[];

  setExchangeSelectionCallback: (callback: (cards: Card[]) => void) => void;
  clearExchangeSelectionCallback: () => void;
  enableExchangeSelection: (handCards: Card[], exactCount: number, prompt: string) => void;
  disableExchangeSelection: () => void;
  toggleExchangeCardSelection: (card: Card) => void;
  submitExchangeSelection: () => void;

  // ===== プレイヤー選択（ID） =====
  playerSelectionCallback: ((playerId: string) => void) | null;
  isPlayerSelectionEnabled: boolean;
  playerSelectionIds: string[];
  playerSelectionNames: Map<string, string>;
  playerSelectionPrompt: string | null;

  setPlayerSelectionCallback: (callback: (playerId: string) => void) => void;
  clearPlayerSelectionCallback: () => void;
  enablePlayerSelection: (playerIds: string[], playerNames: Map<string, string>, prompt: string) => void;
  disablePlayerSelection: () => void;
  submitPlayerSelection: (playerId: string) => void;

  // ===== 相手の手札からのカード選択 =====
  opponentHandSelectionCallback: ((cards: Card[]) => void) | null;
  isOpponentHandSelectionEnabled: boolean;
  opponentHandSelectionCards: Card[];
  opponentHandSelectionMaxCount: number;
  opponentHandSelectionPrompt: string | null;
  selectedOpponentHandCards: Card[];

  setOpponentHandSelectionCallback: (callback: (cards: Card[]) => void) => void;
  clearOpponentHandSelectionCallback: () => void;
  enableOpponentHandSelection: (cards: Card[], maxCount: number, prompt: string) => void;
  disableOpponentHandSelection: () => void;
  toggleOpponentHandCardSelection: (card: Card) => void;
  submitOpponentHandSelection: () => void;

  // ===== プレイヤーオブジェクト選択 =====
  playerObjectSelectionCallback: ((player: Player | null) => void) | null;
  isPlayerObjectSelectionEnabled: boolean;
  playerObjectSelectionPlayers: Player[];
  playerObjectSelectionPrompt: string | null;

  setPlayerObjectSelectionCallback: (callback: (player: Player | null) => void) => void;
  clearPlayerObjectSelectionCallback: () => void;
  enablePlayerObjectSelection: (players: Player[], prompt: string) => void;
  disablePlayerObjectSelection: () => void;
  submitPlayerObjectSelection: (player: Player | null) => void;
}

export const useSelectionStore = create<SelectionStore>((set, get) => ({
  // ===== 手札からのカード選択 =====
  selectedCards: [],
  cardSelectionCallback: null,
  cardSelectionValidator: null,
  cardSelectionPrompt: null,
  isCardSelectionEnabled: false,

  setCardSelectionCallback: (callback) => {
    set({ cardSelectionCallback: callback });
  },

  clearCardSelectionCallback: () => {
    set({ cardSelectionCallback: null });
  },

  enableCardSelection: (validator, prompt) => {
    set({
      cardSelectionValidator: validator,
      cardSelectionPrompt: prompt || null,
      isCardSelectionEnabled: true,
      selectedCards: [],
    });
  },

  disableCardSelection: () => {
    set({
      isCardSelectionEnabled: false,
      cardSelectionValidator: null,
      cardSelectionPrompt: null,
      selectedCards: [],
    });
  },

  toggleCardSelection: (card) => {
    const { selectedCards } = get();
    const isSelected = selectedCards.some((c) => c.id === card.id);

    if (isSelected) {
      set({ selectedCards: selectedCards.filter((c) => c.id !== card.id) });
    } else {
      set({ selectedCards: [...selectedCards, card] });
    }
  },

  clearSelection: () => {
    set({ selectedCards: [] });
  },

  submitCardSelection: () => {
    const { selectedCards, cardSelectionCallback } = get();
    if (cardSelectionCallback) {
      cardSelectionCallback(selectedCards);
    }
  },

  // ===== ゲスト用カード選択 =====
  guestCardSelectionCallback: null,

  enableGuestCardSelection: (validCardIds, canPass, callback, prompt) => {
    // 基本的なカード選択を有効化（validatorは簡易版）
    set({
      guestCardSelectionCallback: callback,
      cardSelectionPrompt: prompt || null,
      isCardSelectionEnabled: true,
      selectedCards: [],
      // ゲスト用のvalidatorは後でgameStoreから設定される想定
    });
  },

  submitGuestCardSelection: (isPass = false) => {
    const { selectedCards, guestCardSelectionCallback } = get();
    if (guestCardSelectionCallback) {
      guestCardSelectionCallback(
        selectedCards.map((c) => c.id),
        isPass
      );
    }
  },

  // ===== クイーンボンバーのランク選択 =====
  queenBomberRankCallback: null,
  isQueenBomberRankSelectionEnabled: false,

  setQueenBomberRankCallback: (callback) => {
    set({ queenBomberRankCallback: callback });
  },

  clearQueenBomberRankCallback: () => {
    set({ queenBomberRankCallback: null });
  },

  showQueenBomberRankSelectionUI: () => {
    set({ isQueenBomberRankSelectionEnabled: true });
  },

  hideQueenBomberRankSelectionUI: () => {
    set({ isQueenBomberRankSelectionEnabled: false });
  },

  submitQueenBomberRank: (rank) => {
    const { queenBomberRankCallback } = get();
    if (queenBomberRankCallback) {
      queenBomberRankCallback(rank);
    }
  },

  // ===== 捨て札からのカード選択 =====
  discardSelectionCallback: null,
  isDiscardSelectionEnabled: false,
  discardSelectionPile: [],
  discardSelectionMaxCount: 0,
  discardSelectionPrompt: null,
  selectedDiscardCards: [],

  setDiscardSelectionCallback: (callback) => {
    set({ discardSelectionCallback: callback });
  },

  clearDiscardSelectionCallback: () => {
    set({ discardSelectionCallback: null });
  },

  enableDiscardSelection: (discardPile, maxCount, prompt) => {
    set({
      isDiscardSelectionEnabled: true,
      discardSelectionPile: discardPile,
      discardSelectionMaxCount: maxCount,
      discardSelectionPrompt: prompt,
      selectedDiscardCards: [],
    });
  },

  disableDiscardSelection: () => {
    set({
      isDiscardSelectionEnabled: false,
      discardSelectionPile: [],
      discardSelectionMaxCount: 0,
      discardSelectionPrompt: null,
      selectedDiscardCards: [],
    });
  },

  toggleDiscardCardSelection: (card) => {
    const { selectedDiscardCards, discardSelectionMaxCount } = get();
    const isSelected = selectedDiscardCards.some((c) => c.id === card.id);

    if (isSelected) {
      set({ selectedDiscardCards: selectedDiscardCards.filter((c) => c.id !== card.id) });
    } else {
      if (selectedDiscardCards.length < discardSelectionMaxCount) {
        set({ selectedDiscardCards: [...selectedDiscardCards, card] });
      }
    }
  },

  submitDiscardSelection: () => {
    const { selectedDiscardCards, discardSelectionCallback } = get();
    if (discardSelectionCallback) {
      discardSelectionCallback(selectedDiscardCards);
    }
  },

  // ===== カード交換選択 =====
  exchangeSelectionCallback: null,
  isExchangeSelectionEnabled: false,
  exchangeSelectionCards: [],
  exchangeSelectionCount: 0,
  exchangeSelectionPrompt: null,
  selectedExchangeCards: [],

  setExchangeSelectionCallback: (callback) => {
    set({ exchangeSelectionCallback: callback });
  },

  clearExchangeSelectionCallback: () => {
    set({ exchangeSelectionCallback: null });
  },

  enableExchangeSelection: (handCards, exactCount, prompt) => {
    set({
      isExchangeSelectionEnabled: true,
      exchangeSelectionCards: handCards,
      exchangeSelectionCount: exactCount,
      exchangeSelectionPrompt: prompt,
      selectedExchangeCards: [],
    });
  },

  disableExchangeSelection: () => {
    set({
      isExchangeSelectionEnabled: false,
      exchangeSelectionCards: [],
      exchangeSelectionCount: 0,
      exchangeSelectionPrompt: null,
      selectedExchangeCards: [],
    });
  },

  toggleExchangeCardSelection: (card) => {
    const { selectedExchangeCards, exchangeSelectionCount } = get();
    const isSelected = selectedExchangeCards.some((c) => c.id === card.id);

    if (isSelected) {
      set({ selectedExchangeCards: selectedExchangeCards.filter((c) => c.id !== card.id) });
    } else {
      if (selectedExchangeCards.length < exchangeSelectionCount) {
        set({ selectedExchangeCards: [...selectedExchangeCards, card] });
      }
    }
  },

  submitExchangeSelection: () => {
    const { selectedExchangeCards, exchangeSelectionCallback, exchangeSelectionCount } = get();
    if (exchangeSelectionCallback && selectedExchangeCards.length === exchangeSelectionCount) {
      exchangeSelectionCallback(selectedExchangeCards);
    }
  },

  // ===== プレイヤー選択（ID） =====
  playerSelectionCallback: null,
  isPlayerSelectionEnabled: false,
  playerSelectionIds: [],
  playerSelectionNames: new Map(),
  playerSelectionPrompt: null,

  setPlayerSelectionCallback: (callback) => {
    set({ playerSelectionCallback: callback });
  },

  clearPlayerSelectionCallback: () => {
    set({ playerSelectionCallback: null });
  },

  enablePlayerSelection: (playerIds, playerNames, prompt) => {
    set({
      isPlayerSelectionEnabled: true,
      playerSelectionIds: playerIds,
      playerSelectionNames: playerNames,
      playerSelectionPrompt: prompt,
    });
  },

  disablePlayerSelection: () => {
    set({
      isPlayerSelectionEnabled: false,
      playerSelectionIds: [],
      playerSelectionNames: new Map(),
      playerSelectionPrompt: null,
    });
  },

  submitPlayerSelection: (playerId) => {
    const { playerSelectionCallback } = get();
    if (playerSelectionCallback) {
      playerSelectionCallback(playerId);
    }
  },

  // ===== 相手の手札からのカード選択 =====
  opponentHandSelectionCallback: null,
  isOpponentHandSelectionEnabled: false,
  opponentHandSelectionCards: [],
  opponentHandSelectionMaxCount: 0,
  opponentHandSelectionPrompt: null,
  selectedOpponentHandCards: [],

  setOpponentHandSelectionCallback: (callback) => {
    set({ opponentHandSelectionCallback: callback });
  },

  clearOpponentHandSelectionCallback: () => {
    set({ opponentHandSelectionCallback: null });
  },

  enableOpponentHandSelection: (cards, maxCount, prompt) => {
    set({
      isOpponentHandSelectionEnabled: true,
      opponentHandSelectionCards: cards,
      opponentHandSelectionMaxCount: maxCount,
      opponentHandSelectionPrompt: prompt,
      selectedOpponentHandCards: [],
    });
  },

  disableOpponentHandSelection: () => {
    set({
      isOpponentHandSelectionEnabled: false,
      opponentHandSelectionCards: [],
      opponentHandSelectionMaxCount: 0,
      opponentHandSelectionPrompt: null,
      selectedOpponentHandCards: [],
    });
  },

  toggleOpponentHandCardSelection: (card) => {
    const { selectedOpponentHandCards, opponentHandSelectionMaxCount } = get();
    const isSelected = selectedOpponentHandCards.some((c) => c.id === card.id);

    if (isSelected) {
      set({ selectedOpponentHandCards: selectedOpponentHandCards.filter((c) => c.id !== card.id) });
    } else {
      if (selectedOpponentHandCards.length < opponentHandSelectionMaxCount) {
        set({ selectedOpponentHandCards: [...selectedOpponentHandCards, card] });
      }
    }
  },

  submitOpponentHandSelection: () => {
    const { selectedOpponentHandCards, opponentHandSelectionCallback } = get();
    if (opponentHandSelectionCallback) {
      opponentHandSelectionCallback(selectedOpponentHandCards);
    }
  },

  // ===== プレイヤーオブジェクト選択 =====
  playerObjectSelectionCallback: null,
  isPlayerObjectSelectionEnabled: false,
  playerObjectSelectionPlayers: [],
  playerObjectSelectionPrompt: null,

  setPlayerObjectSelectionCallback: (callback) => {
    set({ playerObjectSelectionCallback: callback });
  },

  clearPlayerObjectSelectionCallback: () => {
    set({ playerObjectSelectionCallback: null });
  },

  enablePlayerObjectSelection: (players, prompt) => {
    set({
      isPlayerObjectSelectionEnabled: true,
      playerObjectSelectionPlayers: players,
      playerObjectSelectionPrompt: prompt,
    });
  },

  disablePlayerObjectSelection: () => {
    set({
      isPlayerObjectSelectionEnabled: false,
      playerObjectSelectionPlayers: [],
      playerObjectSelectionPrompt: null,
    });
  },

  submitPlayerObjectSelection: (player) => {
    const { playerObjectSelectionCallback } = get();
    if (playerObjectSelectionCallback) {
      playerObjectSelectionCallback(player);
    }
  },
}));
