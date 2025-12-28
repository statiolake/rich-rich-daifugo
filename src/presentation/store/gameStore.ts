import { create } from 'zustand';
import { GameEngine } from '../../core/game/GameEngine';
import { GameConfigFactory } from '../../core/game/GameConfigFactory';
import { GameState } from '../../core/domain/game/GameState';
import { Card, CardFactory } from '../../core/domain/card/Card';
import { PlayerType } from '../../core/domain/player/Player';
import { EventBus } from '../../application/services/EventBus';
import { RuleEngine } from '../../core/rules/base/RuleEngine';
import { useCardPositionStore } from './cardPositionStore';
import { useRuleSettingsStore } from './ruleSettingsStore';
import { GamePresentationRequester } from '../presentation/GamePresentationRequester';
import { HumanPlayerController } from '../players/HumanPlayerController';
import { CPUPlayerController } from '../players/CPUPlayerController';
import { PlayerController, Validator } from '../../core/domain/player/PlayerController';
import { CPUStrategy } from '../../core/strategy/PlayerStrategy';

interface MovingCard {
  card: Card;
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

export interface RuleCutInData {
  id: string;
  text: string;
  variant?: 'gold' | 'red' | 'blue' | 'green' | 'yellow';
  duration?: number;
  delay?: number;
  verticalPosition?: string;
}

interface GameStore {
  engine: GameEngine | null;
  gameState: GameState | null;
  selectedCards: Card[];
  error: string | null;
  movingCards: MovingCard[];
  cutInQueue: RuleCutInData[];
  activeCutIns: RuleCutInData[];
  cutInResolve: (() => void) | null;

  // Promise-based callbacks for HumanPlayerController
  cardSelectionCallback: ((cards: Card[]) => void) | null;
  queenBomberRankCallback: ((rank: string) => void) | null;
  cardSelectionValidator: Validator | null;
  cardSelectionPrompt: string | null;
  isCardSelectionEnabled: boolean;
  isQueenBomberRankSelectionEnabled: boolean;

  // Actions
  startGame: (playerName?: string) => void;
  toggleCardSelection: (card: Card) => void;
  clearSelection: () => void;
  clearError: () => void;
  addMovingCard: (card: Card, fromX: number, fromY: number, toX: number, toY: number) => void;
  removeMovingCard: (id: string) => void;
  clearMovingCards: () => void;
  reset: () => void;
  enqueueCutIn: (cutIn: RuleCutInData) => Promise<void>;
  removeCutIn: (id: string) => void;
  processQueue: () => void;
  waitForCutIn: () => Promise<void>;

  // Callback methods for HumanPlayerController
  setCardSelectionCallback: (callback: (cards: Card[]) => void) => void;
  clearCardSelectionCallback: () => void;
  enableCardSelection: (validator: Validator, prompt?: string) => void;
  disableCardSelection: () => void;
  submitCardSelection: () => void;
  setQueenBomberRankCallback: (callback: (rank: string) => void) => void;
  clearQueenBomberRankCallback: () => void;
  showQueenBomberRankSelectionUI: () => void;
  hideQueenBomberRankSelectionUI: () => void;
  submitQueenBomberRank: (rank: string) => void;

  // Computed values
  getValidCombinations: () => Card[][];
  getRuleEngine: () => RuleEngine;
}

export const useGameStore = create<GameStore>((set, get) => ({
  engine: null,
  gameState: null,
  selectedCards: [],
  error: null,
  movingCards: [],
  cutInQueue: [],
  activeCutIns: [],
  cutInResolve: null,
  cardSelectionCallback: null,
  queenBomberRankCallback: null,
  cardSelectionValidator: null,
  cardSelectionPrompt: null,
  isCardSelectionEnabled: false,
  isQueenBomberRankSelectionEnabled: false,

  startGame: (playerName = 'あなた') => {
    try {
      const eventBus = new EventBus();

      // ルール設定を取得
      const ruleSettings = useRuleSettingsStore.getState().settings;

      // GameConfigFactory を使用してゲーム設定を生成
      const config = GameConfigFactory.createStandardGame(4, 1, playerName, ruleSettings);

      // PresentationRequester を作成
      const presentationRequester = new GamePresentationRequester(get());

      // PlayerController マップを作成
      const playerControllers = new Map<string, PlayerController>();

      config.players.forEach((pConfig) => {
        if (pConfig.type === PlayerType.HUMAN) {
          playerControllers.set(pConfig.id, new HumanPlayerController(get(), pConfig.id));
        } else {
          // CPU用のコントローラーは一時的にnull（gameStateが必要）
          playerControllers.set(pConfig.id, null as any);
        }
      });

      // GameEngine を作成
      const engine = new GameEngine(config, eventBus, presentationRequester, playerControllers);

      // CPU用のコントローラーを作成（gameStateが利用可能になったので）
      config.players.forEach((pConfig) => {
        if (pConfig.type !== PlayerType.HUMAN) {
          const player = engine.getState().players.find(p => p.id.value === pConfig.id);
          if (player) {
            playerControllers.set(
              pConfig.id,
              new CPUPlayerController(
                pConfig.strategy as CPUStrategy,
                player,
                engine.getState() as any
              )
            );
          }
        }
      });

      // イベントリスナーを設定
      eventBus.on('state:updated', (data) => {
        set({ gameState: { ...data.gameState } });
        useCardPositionStore.getState().syncWithGameState(data.gameState);
      });

      eventBus.on('game:started', (data) => {
        console.log('Game started!');
        const allCards = CardFactory.createDeck(true);
        useCardPositionStore.getState().initialize(allCards);
        set({ gameState: { ...data.gameState } });
      });

      eventBus.on('game:ended', (data) => {
        console.log('Game ended!');
      });

      set({ engine, error: null });

      // ゲームを開始（非同期）
      engine.start().catch((error) => {
        console.error('Game error:', error);
        set({ error: error.message });
      });
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  toggleCardSelection: (card) => {
    const { selectedCards } = get();
    const isSelected = selectedCards.some(c => c.id === card.id);

    if (isSelected) {
      set({ selectedCards: selectedCards.filter(c => c.id !== card.id) });
    } else {
      set({ selectedCards: [...selectedCards, card] });
    }
  },

  clearSelection: () => {
    set({ selectedCards: [] });
  },

  clearError: () => {
    set({ error: null });
  },

  addMovingCard: (card, fromX, fromY, toX, toY) => {
    const movingCard: MovingCard = {
      card,
      id: `${card.id}-${Date.now()}`,
      fromX,
      fromY,
      toX,
      toY
    };
    set(state => ({ movingCards: [...state.movingCards, movingCard] }));
  },

  removeMovingCard: (id) => {
    set(state => ({ movingCards: state.movingCards.filter(m => m.id !== id) }));
  },

  clearMovingCards: () => {
    set({ movingCards: [] });
  },

  reset: () => {
    set({
      engine: null,
      gameState: null,
      selectedCards: [],
      error: null,
      movingCards: [],
      cutInQueue: [],
      activeCutIns: [],
      cutInResolve: null,
      cardSelectionCallback: null,
      queenBomberRankCallback: null,
      cardSelectionValidator: null,
      cardSelectionPrompt: null,
      isCardSelectionEnabled: false,
      isQueenBomberRankSelectionEnabled: false,
    });
  },

  enqueueCutIn: async (cutIn) => {
    set(state => ({ cutInQueue: [...state.cutInQueue, cutIn] }));
    get().processQueue();
  },

  removeCutIn: (id) => {
    set(state => ({ activeCutIns: state.activeCutIns.filter(c => c.id !== id) }));

    const { activeCutIns, cutInResolve, cutInQueue } = get();
    if (activeCutIns.length === 0) {
      if (cutInResolve) {
        cutInResolve();
        set({ cutInResolve: null });
      }
      if (cutInQueue.length > 0) {
        get().processQueue();
      }
    }
  },

  processQueue: () => {
    const { cutInQueue, activeCutIns } = get();

    if (cutInQueue.length === 0 || activeCutIns.length > 0) {
      return;
    }

    const batchSize = Math.min(cutInQueue.length, 4);
    const batch = cutInQueue.slice(0, batchSize);
    const rest = cutInQueue.slice(batchSize);

    const calculateVerticalPosition = (index: number, total: number): string => {
      if (total === 1) return '50%';
      const spacing = 100 / (total + 1);
      return `${spacing * (index + 1)}%`;
    };

    const cutInsWithDelay = batch.map((cutIn, index) => ({
      ...cutIn,
      delay: index * 100,
      verticalPosition: calculateVerticalPosition(index, batchSize)
    }));

    set({ activeCutIns: cutInsWithDelay, cutInQueue: rest });
  },

  waitForCutIn: async () => {
    const { cutInQueue, activeCutIns } = get();

    if (cutInQueue.length === 0 && activeCutIns.length === 0) {
      return;
    }

    return new Promise<void>((resolve) => {
      set({ cutInResolve: resolve });
    });
  },

  // Callback methods for HumanPlayerController
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
      selectedCards: []
    });
  },

  disableCardSelection: () => {
    set({
      isCardSelectionEnabled: false,
      cardSelectionValidator: null,
      cardSelectionPrompt: null,
      selectedCards: []
    });
  },

  submitCardSelection: () => {
    const { selectedCards, cardSelectionCallback } = get();
    if (cardSelectionCallback) {
      cardSelectionCallback(selectedCards);
    }
  },

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

  getValidCombinations: () => {
    const { gameState, engine, cardSelectionValidator } = get();
    if (!gameState || !engine) return [];

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer || currentPlayer.type !== PlayerType.HUMAN) {
      return [];
    }

    // カード選択が有効でvalidatorがある場合
    if (cardSelectionValidator) {
      const handCards = currentPlayer.hand.getCards();
      const combinations: Card[][] = [];

      // すべての可能な組み合わせを試す（ビット全探索）
      const n = handCards.length;
      for (let mask = 1; mask < (1 << n); mask++) {
        const combo: Card[] = [];
        for (let i = 0; i < n; i++) {
          if (mask & (1 << i)) {
            combo.push(handCards[i]);
          }
        }

        if (cardSelectionValidator.validate(combo)) {
          combinations.push(combo);
        }
      }

      return combinations;
    }

    // 通常の場合は既存のロジックを使用
    const ruleEngine = engine.getRuleEngine();
    return currentPlayer.hand.findAllValidPlays(
      currentPlayer,
      gameState.field,
      gameState,
      ruleEngine
    );
  },

  getRuleEngine: () => {
    const { engine } = get();
    if (!engine) {
      throw new Error('Engine not initialized');
    }
    return engine.getRuleEngine();
  },
}));
