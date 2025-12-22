import { create } from 'zustand';
import { GameEngine } from '../../core/game/GameEngine';
import { GameConfig } from '../../core/game/GameConfig';
import { GameConfigFactory } from '../../core/game/GameConfigFactory';
import { GameState } from '../../core/domain/game/GameState';
import { Card, CardFactory } from '../../core/domain/card/Card';
import { PlayerType } from '../../core/domain/player/Player';
import { LocalPlayerService } from '../../core/domain/player/LocalPlayerService';
import { EventBus } from '../../application/services/EventBus';
import { HumanStrategy } from '../../core/strategy/HumanStrategy';
import { RuleEngine } from '../../core/rules/base/RuleEngine';
import { useCardPositionStore } from './cardPositionStore';

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
  variant?: 'gold' | 'red' | 'blue' | 'green';
  duration?: number;
  delay?: number; // アニメーション開始の遅延（ms）
  verticalPosition?: string; // 縦位置（%）
}

interface GameStore {
  engine: GameEngine | null;
  gameState: GameState | null;
  selectedCards: Card[];
  error: string | null;
  movingCards: MovingCard[];
  cutInQueue: RuleCutInData[];
  activeCutIns: RuleCutInData[]; // 複数のカットインを同時表示
  cutInResolve: (() => void) | null;

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
  enqueueCutIn: (cutIn: RuleCutInData) => Promise<void>;
  removeCutIn: (id: string) => void;
  processQueue: () => void;
  waitForCutIn: () => Promise<void>;

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

  startGame: (playerName = 'あなた') => {
    try {
      const eventBus = new EventBus();

      // GameConfigFactory を使用してゲーム設定を生成
      const config = GameConfigFactory.createStandardGame(4, 1, playerName);

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

      // 11バックイベントリスナー
      eventBus.on('elevenBack:triggered', (data) => {
        get().enqueueCutIn({
          id: `elevenback-${Date.now()}`,
          text: data.isElevenBack ? '11バック発動！' : '11バック解除',
          variant: 'gold',
          duration: 500
        });
      });

      // 革命イベントリスナー
      eventBus.on('revolution:triggered', (data) => {
        get().enqueueCutIn({
          id: `revolution-${Date.now()}`,
          text: data.isRevolution ? '革命発生！' : '革命終了',
          variant: 'red',
          duration: 500
        });
      });

      // カットイン待機関数を注入
      engine.setWaitForCutIn(get().waitForCutIn);

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

    // RuleEngine で検証
    const ruleEngine = engine.getRuleEngine();
    const validation = ruleEngine.validate(
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

    // パスできるか RuleEngine で検証
    const ruleEngine = engine.getRuleEngine();
    const canPassResult = ruleEngine.canPass(gameState.field);

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

  getValidCombinations: () => {
    const { gameState, engine } = get();
    if (!gameState || !engine) return [];

    const humanPlayer = LocalPlayerService.findLocalPlayer(gameState);
    if (!humanPlayer) return [];

    const ruleEngine = engine.getRuleEngine();

    // Hand.findAllValidPlays() を使用してビット全探索で有効な組み合わせを取得
    return humanPlayer.hand.findAllValidPlays(
      humanPlayer,
      gameState.field,
      gameState,
      ruleEngine
    );
  },

  getRuleEngine: () => {
    const { engine } = get();
    if (!engine) {
      throw new Error('Game engine not initialized');
    }
    return engine.getRuleEngine();
  },

  enqueueCutIn: (cutIn) => {
    return new Promise<void>((resolve) => {
      set((state) => ({
        cutInQueue: [...state.cutInQueue, { ...cutIn, resolve }]
      }));
      // 次のイベントループでprocessQueueを実行（複数のenqueueCutInが同期的に呼ばれた場合にバッチ処理できるようにする）
      setTimeout(() => get().processQueue(), 0);
    });
  },

  processQueue: () => {
    const { cutInQueue, activeCutIns } = get();

    // アクティブなカットインがない場合、キューから取り出して表示
    if (activeCutIns.length === 0 && cutInQueue.length > 0) {
      // 連続したカットインを全て取り出す（最大4つまで）
      const batchSize = Math.min(cutInQueue.length, 4);
      const batch = cutInQueue.slice(0, batchSize);
      const rest = cutInQueue.slice(batchSize);

      // 縦位置を計算する関数
      const calculateVerticalPosition = (index: number, total: number): string => {
        if (total === 1) {
          return '50%'; // 中央
        }
        const spacing = 100 / (total + 1);
        return `${spacing * (index + 1)}%`;
      };

      // 各カットインに遅延と縦位置を設定（100msずつずらす）
      const cutInsWithDelay = batch.map((cutIn, index) => ({
        ...cutIn,
        delay: index * 100,
        verticalPosition: calculateVerticalPosition(index, batchSize)
      }));

      set({
        activeCutIns: cutInsWithDelay,
        cutInQueue: rest,
        cutInResolve: (batch[0] as any).resolve || null
      });
    }
  },

  removeCutIn: (id) => {
    set((state) => ({
      activeCutIns: state.activeCutIns.filter(c => c.id !== id)
    }));

    // 全てのカットインが消えたらresolveして次を処理
    const { activeCutIns, cutInResolve } = get();
    if (activeCutIns.length === 0) {
      if (cutInResolve) {
        cutInResolve();
      }
      set({ cutInResolve: null });
      get().processQueue();
    }
  },

  waitForCutIn: async () => {
    const { activeCutIns } = get();
    if (activeCutIns.length === 0) return;

    return new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        const { activeCutIns: current } = get();
        if (current.length === 0) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  },

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
      cutInQueue: [],
      activeCutIns: [],
      cutInResolve: null,
    });
  },
}));
