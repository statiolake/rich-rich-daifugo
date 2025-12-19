import { create } from 'zustand';
import { GameEngine } from '../../core/game/GameEngine';
import { GameConfig, PlayerConfig } from '../../core/game/GameConfig';
import { GameState } from '../../core/domain/game/GameState';
import { Card } from '../../core/domain/card/Card';
import { PlayerType } from '../../core/domain/player/Player';
import { EventBus } from '../../application/services/EventBus';
import { HumanStrategy } from '../../core/strategy/HumanStrategy';
import { RandomCPUStrategy } from '../../core/strategy/RandomCPUStrategy';

interface GameStore {
  engine: GameEngine | null;
  gameState: GameState | null;
  selectedCards: Card[];
  error: string | null;

  // Actions
  startGame: (playerName?: string) => void;
  playCards: (cards: Card[]) => void;
  pass: () => void;
  toggleCardSelection: (card: Card) => void;
  clearSelection: () => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  engine: null,
  gameState: null,
  selectedCards: [],
  error: null,

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
      });

      eventBus.on('game:started', (data) => {
        console.log('Game started!');
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

    const currentPlayer = engine.getState().players[
      engine.getState().currentPlayerIndex
    ];

    // 現在のプレイヤーが人間の場合のみ
    if (currentPlayer.type !== PlayerType.HUMAN) {
      console.warn('Current player is not human');
      return;
    }

    // HumanStrategyに通知
    const strategy = engine.getStrategyMap().get(currentPlayer.id.value);
    if (strategy instanceof HumanStrategy) {
      strategy.submitPlay(cards.length > 0 ? cards : selectedCards);
      set({ selectedCards: [] });
    }
  },

  pass: () => {
    const { engine } = get();
    if (!engine) return;

    const currentPlayer = engine.getState().players[
      engine.getState().currentPlayerIndex
    ];

    // 現在のプレイヤーが人間の場合のみ
    if (currentPlayer.type !== PlayerType.HUMAN) {
      console.warn('Current player is not human');
      return;
    }

    // HumanStrategyに通知
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
    });
  },
}));
