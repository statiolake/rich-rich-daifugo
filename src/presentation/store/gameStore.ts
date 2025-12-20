import { create } from 'zustand';
import { GameEngine } from '../../core/game/GameEngine';
import { GameConfig, PlayerConfig } from '../../core/game/GameConfig';
import { GameState } from '../../core/domain/game/GameState';
import { Card, CardFactory } from '../../core/domain/card/Card';
import { PlayerType } from '../../core/domain/player/Player';
import { EventBus } from '../../application/services/EventBus';
import { HumanStrategy } from '../../core/strategy/HumanStrategy';
import { RandomCPUStrategy } from '../../core/strategy/RandomCPUStrategy';
import { PlayValidator } from '../../core/rules/basic/PlayValidator';
import { useCardPositionStore } from './cardPositionStore';

interface MovingCard {
  card: Card;
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

interface GameStore {
  engine: GameEngine | null;
  gameState: GameState | null;
  selectedCards: Card[];
  error: string | null;
  movingCards: MovingCard[];

  // Actions
  startGame: (playerName?: string) => void;
  playCards: (cards: Card[]) => void;
  pass: () => void;
  toggleCardSelection: (card: Card) => void;
  clearSelection: () => void;
  clearError: () => void;
  addMovingCard: (card: Card, fromX: number, fromY: number, toX: number, toY: number) => void;
  removeMovingCard: (id: string) => void;
  clearMovingCards: () => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  engine: null,
  gameState: null,
  selectedCards: [],
  error: null,
  movingCards: [],

  startGame: (playerName = 'あなた') => {
    try {
      const eventBus = new EventBus();

      // プレイヤー設定を作成（人間1人 + CPU3人）
      const humanStrategy = new HumanStrategy();

      const playerConfigs: PlayerConfig[] = [
        {
          id: 'player-0',
          name: playerName,
          type: PlayerType.HUMAN,
          strategy: humanStrategy,
        },
        {
          id: 'player-1',
          name: 'CPU 1',
          type: PlayerType.CPU,
          strategy: new RandomCPUStrategy(),
        },
        {
          id: 'player-2',
          name: 'CPU 2',
          type: PlayerType.CPU,
          strategy: new RandomCPUStrategy(),
        },
        {
          id: 'player-3',
          name: 'CPU 3',
          type: PlayerType.CPU,
          strategy: new RandomCPUStrategy(),
        },
      ];

      const config: GameConfig = {
        players: playerConfigs,
      };

      const engine = new GameEngine(config, eventBus);

      // イベントリスナーを設定
      eventBus.on('state:updated', (data) => {
        set({ gameState: { ...data.gameState } });

        // CardPositionStoreを同期
        useCardPositionStore.getState().syncWithGameState(data.gameState);
      });

      eventBus.on('game:started', (data) => {
        console.log('Game started!');

        // CardPositionStoreを初期化
        const allCards = CardFactory.createDeck(true);
        useCardPositionStore.getState().initialize(allCards);
      });

      eventBus.on('game:ended', (data) => {
        console.log('Game ended!');
      });

      set({ engine, error: null });

      // ゲームを開始
      engine.start().catch(error => {
        console.error('Game error:', error);
        set({ error: error.message });
      });
    } catch (error) {
      console.error('Failed to start game:', error);
      set({ error: (error as Error).message });
    }
  },

  playCards: (cards) => {
    const { engine, selectedCards } = get();
    if (!engine) return;

    const gameState = engine.getState();
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];

    // 現在のプレイヤーが人間の場合のみ
    if (currentPlayer.type !== PlayerType.HUMAN) {
      console.warn('Current player is not human');
      return;
    }

    // 出すカードを決定（引数があればそれを使用、なければ選択中のカードを使用）
    const cardsToPlay = cards.length > 0 ? cards : selectedCards;

    if (cardsToPlay.length === 0) {
      set({ error: 'カードを選択してください' });
      return;
    }

    // PlayValidatorで検証
    const validator = new PlayValidator();
    const validation = validator.isValidPlay(
      currentPlayer,
      cardsToPlay,
      gameState.field,
      gameState
    );

    if (!validation.valid) {
      // 無効な手の場合はエラーメッセージを表示
      set({ error: validation.reason || '無効な手です' });
      return;
    }

    // 有効な手の場合、エラーをクリアしてHumanStrategyに通知
    set({ error: null });
    const strategy = engine.getStrategyMap().get(currentPlayer.id.value);
    if (strategy instanceof HumanStrategy) {
      strategy.submitPlay(cardsToPlay);
      set({ selectedCards: [] });
    }
  },

  pass: () => {
    const { engine } = get();
    if (!engine) return;

    const gameState = engine.getState();
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];

    // 現在のプレイヤーが人間の場合のみ
    if (currentPlayer.type !== PlayerType.HUMAN) {
      console.warn('Current player is not human');
      return;
    }

    // パスできるか検証
    const validator = new PlayValidator();
    const canPassResult = validator.canPass(gameState.field);

    if (!canPassResult.valid) {
      set({ error: canPassResult.reason || 'パスできません' });
      return;
    }

    // パス可能な場合、エラーをクリアしてHumanStrategyに通知
    set({ error: null });
    const strategy = engine.getStrategyMap().get(currentPlayer.id.value);
    if (strategy instanceof HumanStrategy) {
      strategy.submitPass();
      set({ selectedCards: [] });
    }
  },

  toggleCardSelection: (card) => {
    set((state) => {
      const isSelected = state.selectedCards.some(c => c.id === card.id);

      if (isSelected) {
        return {
          selectedCards: state.selectedCards.filter(c => c.id !== card.id),
        };
      } else {
        return {
          selectedCards: [...state.selectedCards, card],
        };
      }
    });
  },

  clearSelection: () => set({ selectedCards: [] }),

  clearError: () => set({ error: null }),

  addMovingCard: (card, fromX, fromY, toX, toY) => {
    const movingCard: MovingCard = {
      card,
      id: `moving-${card.id}`,
      fromX,
      fromY,
      toX,
      toY,
    };
    set((state) => ({
      movingCards: [...state.movingCards, movingCard],
    }));
  },

  removeMovingCard: (id) => {
    set((state) => ({
      movingCards: state.movingCards.filter(mc => mc.id !== id),
    }));
  },

  clearMovingCards: () => set({ movingCards: [] }),

  reset: () => {
    const { engine } = get();
    if (engine) {
      engine.stop();
    }
    set({
      engine: null,
      gameState: null,
      selectedCards: [],
      error: null,
      movingCards: [],
    });
  },
}));
