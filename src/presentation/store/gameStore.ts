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
import { useRuleSettingsStore } from './ruleSettingsStore';

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
  submitCardSelection: (playerId: string, cards: Card[]) => void; // カード選択を送信
  submitRankSelection: (playerId: string, rank: string) => void; // ランク選択を送信

  // Computed values
  getValidCombinations: () => Card[][];
  getRuleEngine: () => RuleEngine;
  getHumanStrategy: () => HumanStrategy | null;
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

      // ルール設定を取得
      const ruleSettings = useRuleSettingsStore.getState().settings;

      // GameConfigFactory を使用してゲーム設定を生成
      const config = GameConfigFactory.createStandardGame(4, 1, playerName, ruleSettings);

      const engine = new GameEngine(config, eventBus);

      // イベントリスナーを設定
      eventBus.on('state:updated', (data) => {
        set({ gameState: { ...data.gameState } });

        // CardPositionStoreを同期
        useCardPositionStore.getState().syncWithGameState(data.gameState);

        // CPUのターンなら自動実行（少し遅延を入れてUIを見やすくする）
        const currentPlayer = data.gameState.players[data.gameState.currentPlayerIndex];
        if (currentPlayer && !currentPlayer.isFinished && currentPlayer.type !== PlayerType.HUMAN) {
          setTimeout(() => {
            get().executeCPUTurn();
          }, 800); // 0.8秒の遅延でCPUの思考を演出
        }
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

      // 統一エフェクトイベントリスナー
      // すべてのトリガーエフェクトを統一的に処理
      eventBus.on('effect:triggered', (data: {
        effect: string;
        cutIn: { text: string; variant: 'red' | 'blue' | 'green' | 'yellow' | 'gold'; duration: number };
      }) => {
        get().enqueueCutIn({
          id: `${data.effect.toLowerCase().replace(/\s+/g, '')}-${Date.now()}`,
          text: data.cutIn.text,
          variant: data.cutIn.variant,
          duration: data.cutIn.duration
        });
      });

      // マークしばりイベントリスナー（特殊：effect以外のイベント）
      eventBus.on('suitLock:triggered', (data: { suit: string }) => {
        get().enqueueCutIn({
          id: `suitlock-${Date.now()}`,
          text: `マークしばり！（${data.suit}）`,
          variant: 'blue',
          duration: 500
        });
      });

      // 数字しばりイベントリスナー（特殊：effect以外のイベント）
      eventBus.on('numberLock:triggered', () => {
        get().enqueueCutIn({
          id: `numberlock-${Date.now()}`,
          text: '数字しばり！',
          variant: 'blue',
          duration: 500
        });
      });

      // 7渡しイベントリスナー（特殊：effectとは別のタイミングで発火）
      eventBus.on('sevenPass:triggered', (data: { fromPlayer: string; toPlayer: string }) => {
        get().enqueueCutIn({
          id: `sevenpass-${Date.now()}`,
          text: '7渡し！',
          variant: 'blue',
          duration: 500
        });
      });

      // 10捨てイベントリスナー（特殊：effectとは別のタイミングで発火）
      eventBus.on('tenDiscard:triggered', (data: { player: string }) => {
        get().enqueueCutIn({
          id: `tendiscard-${Date.now()}`,
          text: '10捨て！',
          variant: 'red',
          duration: 500
        });
      });

      // クイーンボンバーイベントリスナー（特殊：effectとは別のタイミングで発火）
      eventBus.on('queenBomber:triggered', () => {
        get().enqueueCutIn({
          id: `queenbomber-${Date.now()}`,
          text: 'クイーンボンバー！',
          variant: 'red',
          duration: 500
        });
      });

      // ラッキーセブン勝利イベントリスナー
      eventBus.on('luckySeven:victory', (data: { playerName: string }) => {
        get().enqueueCutIn({
          id: `luckysevenvictory-${Date.now()}`,
          text: `${data.playerName} ラッキーセブン勝利！`,
          variant: 'gold',
          duration: 1000
        });
      });

      set({ engine, error: null });

      // ゲームを初期化（同期的）
      engine.initialize();

      // 初期状態を設定
      set({ gameState: { ...engine.getState() } });
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

    try {
      // GameEngine.executePlay() を呼び出す（同期的）
      engine.executePlay(currentPlayer.id.value, cardsToPlay);

      // 成功したらエラーをクリアして選択解除
      set({ error: null, selectedCards: [] });
    } catch (error) {
      // エラーが発生した場合はエラーメッセージを表示
      set({ error: (error as Error).message });
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

    try {
      // GameEngine.executePass() を呼び出す（同期的）
      engine.executePass(currentPlayer.id.value);

      // 成功したらエラーをクリアして選択解除
      set({ error: null, selectedCards: [] });
    } catch (error) {
      // エラーが発生した場合はエラーメッセージを表示
      set({ error: (error as Error).message });
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

  submitCardSelection: (playerId: string, cards: Card[]) => {
    const { engine } = get();
    if (!engine) {
      console.error('Game engine not initialized');
      return;
    }

    try {
      engine.handleCardSelection(playerId, cards);
      set({ selectedCards: [] }); // 選択をクリア
    } catch (error) {
      console.error('Card selection error:', error);
      set({ error: error instanceof Error ? error.message : 'カード選択に失敗しました' });
    }
  },

  submitRankSelection: (playerId: string, rank: string) => {
    const { engine } = get();
    if (!engine) {
      console.error('Game engine not initialized');
      return;
    }

    try {
      engine.handleRankSelection(playerId, rank);
      set({ selectedCards: [] }); // 選択をクリア
    } catch (error) {
      console.error('Rank selection error:', error);
      set({ error: error instanceof Error ? error.message : 'ランク選択に失敗しました' });
    }
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
        const position = `${spacing * (index + 1)}%`;
        console.log(`Cut-in ${index + 1}/${total}: vertical position = ${position}`);
        return position;
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
    console.log(`[removeCutIn] Removing cut-in: ${id}`);
    set((state) => ({
      activeCutIns: state.activeCutIns.filter(c => c.id !== id)
    }));

    // 全てのカットインが消えたらresolveして次を処理
    const { activeCutIns, cutInResolve } = get();
    console.log(`[removeCutIn] Remaining activeCutIns: ${activeCutIns.length}`);
    if (activeCutIns.length === 0) {
      console.log('[removeCutIn] All cut-ins removed, processing queue...');
      if (cutInResolve) {
        cutInResolve();
      }
      set({ cutInResolve: null });
      get().processQueue();
    }
  },

  waitForCutIn: async () => {
    const { activeCutIns, cutInQueue } = get();
    // 表示中のカットインもキューも空なら即座に戻る
    if (activeCutIns.length === 0 && cutInQueue.length === 0) return;

    console.log('[waitForCutIn] Waiting for cut-ins to complete...');

    return new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        const { activeCutIns: current, cutInQueue: queue } = get();
        // 表示中のカットインとキューの両方が空になるまで待つ
        if (current.length === 0 && queue.length === 0) {
          console.log('[waitForCutIn] All cut-ins completed!');
          clearInterval(checkInterval);
          resolve();
        } else {
          console.log(`[waitForCutIn] Still waiting... activeCutIns: ${current.length}, queue: ${queue.length}`);
        }
      }, 100);
    });
  },

  /**
   * CPUのターンを実行する
   * CPUStrategy を使って判断し、executePlay または executePass を呼び出す
   */
  executeCPUTurn: () => {
    const { engine } = get();
    if (!engine) return;

    const gameState = engine.getState();
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];

    // CPUプレイヤーでない場合は何もしない
    if (currentPlayer.type === PlayerType.HUMAN) {
      return;
    }

    if (currentPlayer.isFinished) {
      return;
    }

    // CPU戦略を取得
    const strategy = engine.getStrategyMap().get(currentPlayer.id.value);
    if (!strategy) {
      console.error(`Strategy not found for CPU player ${currentPlayer.id.value}`);
      return;
    }

    // 戦略に基づいて行動決定（同期的）
    const decision = strategy.decidePlay(currentPlayer, gameState.field, gameState);

    try {
      if (decision.type === 'PLAY' && decision.cards) {
        engine.executePlay(currentPlayer.id.value, decision.cards);
      } else {
        engine.executePass(currentPlayer.id.value);
      }
    } catch (error) {
      // 無効なプレイの場合はパス
      console.error(`CPU play failed, passing instead:`, error);
      try {
        engine.executePass(currentPlayer.id.value);
      } catch (passError) {
        console.error(`CPU pass also failed:`, passError);
      }
    }
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
    });
  },
}));
