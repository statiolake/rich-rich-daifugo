import { create } from 'zustand';
import { GameEngine } from '../../core/game/GameEngine';
import { GameConfigFactory, MultiplayerPlayerInfo } from '../../core/game/GameConfigFactory';
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
import { RemotePlayerController } from '../../infrastructure/network/RemotePlayerController';
import { serializeGameState } from '../../infrastructure/network/GameStateSerializer';
import { useMultiplayerStore } from './multiplayerStore';

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
  onComplete?: () => void; // カットイン完了時のコールバック
}

// Game log entry type
export interface GameLogEntry {
  id: string;
  timestamp: number;
  type: 'play' | 'pass' | 'effect' | 'system' | 'finish';
  playerName?: string;
  message: string;
  cards?: Card[];
  effectNames?: string[]; // 発動したエフェクト名の配列
}

// ゲスト用カード選択コールバック型
type GuestCardSelectionCallback = (selectedCardIds: string[], isPass: boolean) => void;

interface GameStore {
  engine: GameEngine | null;
  isMultiplayerMode: boolean;
  isGuestMode: boolean;
  guestCardSelectionCallback: GuestCardSelectionCallback | null;
  gameState: GameState | null;
  selectedCards: Card[];
  error: string | null;
  movingCards: MovingCard[];
  cutInQueue: RuleCutInData[];
  activeCutIns: RuleCutInData[];
  cutInResolve: (() => void) | null;

  // Game log
  gameLogs: GameLogEntry[];
  addGameLog: (entry: Omit<GameLogEntry, 'id' | 'timestamp'>) => void;
  clearGameLogs: () => void;

  // Promise-based callbacks for HumanPlayerController
  cardSelectionCallback: ((cards: Card[]) => void) | null;
  queenBomberRankCallback: ((rank: string) => void) | null;
  discardSelectionCallback: ((cards: Card[]) => void) | null;
  exchangeSelectionCallback: ((cards: Card[]) => void) | null;
  cardSelectionValidator: Validator | null;
  cardSelectionPrompt: string | null;
  isCardSelectionEnabled: boolean;
  isQueenBomberRankSelectionEnabled: boolean;
  isDiscardSelectionEnabled: boolean;
  isExchangeSelectionEnabled: boolean;
  discardSelectionPile: Card[];
  discardSelectionMaxCount: number;
  discardSelectionPrompt: string | null;
  selectedDiscardCards: Card[];
  exchangeSelectionCards: Card[];
  exchangeSelectionCount: number;
  exchangeSelectionPrompt: string | null;
  selectedExchangeCards: Card[];
  playerSelectionCallback: ((playerId: string) => void) | null;
  isPlayerSelectionEnabled: boolean;
  playerSelectionIds: string[];
  playerSelectionNames: Map<string, string>;
  playerSelectionPrompt: string | null;
  opponentHandSelectionCallback: ((cards: Card[]) => void) | null;
  isOpponentHandSelectionEnabled: boolean;
  opponentHandSelectionCards: Card[];
  opponentHandSelectionMaxCount: number;
  opponentHandSelectionPrompt: string | null;
  selectedOpponentHandCards: Card[];
  playerObjectSelectionCallback: ((player: import('../../core/domain/player/Player').Player | null) => void) | null;
  isPlayerObjectSelectionEnabled: boolean;
  playerObjectSelectionPlayers: import('../../core/domain/player/Player').Player[];
  playerObjectSelectionPrompt: string | null;

  // Actions
  startGame: (options?: { playerName?: string; autoCPU?: boolean }) => void;
  startMultiplayerGame: () => void;
  updateGameStateFromHost: (state: GameState) => void;
  setGuestMode: (isGuest: boolean) => void;
  enableGuestCardSelection: (validCardIds: string[], canPass: boolean, callback: GuestCardSelectionCallback, prompt?: string) => void;
  submitGuestCardSelection: (isPass?: boolean) => void;
  continueGame: () => void;
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
  setDiscardSelectionCallback: (callback: (cards: Card[]) => void) => void;
  clearDiscardSelectionCallback: () => void;
  enableDiscardSelection: (discardPile: Card[], maxCount: number, prompt: string) => void;
  disableDiscardSelection: () => void;
  toggleDiscardCardSelection: (card: Card) => void;
  submitDiscardSelection: () => void;
  setExchangeSelectionCallback: (callback: (cards: Card[]) => void) => void;
  clearExchangeSelectionCallback: () => void;
  enableExchangeSelection: (handCards: Card[], exactCount: number, prompt: string) => void;
  disableExchangeSelection: () => void;
  toggleExchangeCardSelection: (card: Card) => void;
  submitExchangeSelection: () => void;

  // Player selection methods
  setPlayerSelectionCallback: (callback: (playerId: string) => void) => void;
  clearPlayerSelectionCallback: () => void;
  enablePlayerSelection: (playerIds: string[], playerNames: Map<string, string>, prompt: string) => void;
  disablePlayerSelection: () => void;
  submitPlayerSelection: (playerId: string) => void;

  // Opponent hand selection methods
  setOpponentHandSelectionCallback: (callback: (cards: Card[]) => void) => void;
  clearOpponentHandSelectionCallback: () => void;
  enableOpponentHandSelection: (cards: Card[], maxCount: number, prompt: string) => void;
  disableOpponentHandSelection: () => void;
  toggleOpponentHandCardSelection: (card: Card) => void;
  submitOpponentHandSelection: () => void;

  // Player object selection methods
  setPlayerObjectSelectionCallback: (callback: (player: import('../../core/domain/player/Player').Player | null) => void) => void;
  clearPlayerObjectSelectionCallback: () => void;
  enablePlayerObjectSelection: (players: import('../../core/domain/player/Player').Player[], prompt: string) => void;
  disablePlayerObjectSelection: () => void;
  submitPlayerObjectSelection: (player: import('../../core/domain/player/Player').Player | null) => void;

  // Computed values
  getValidCombinations: () => Card[][];
  getRuleEngine: () => RuleEngine;
}

export const useGameStore = create<GameStore>((set, get) => ({
  engine: null,
  isMultiplayerMode: false,
  isGuestMode: false,
  guestCardSelectionCallback: null,
  gameState: null,
  selectedCards: [],
  error: null,
  movingCards: [],
  cutInQueue: [],
  activeCutIns: [],
  cutInResolve: null,

  // Game log
  gameLogs: [],
  addGameLog: (entry) => {
    const newEntry: GameLogEntry = {
      ...entry,
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    set((state) => ({
      gameLogs: [...state.gameLogs.slice(-49), newEntry], // Keep last 50 logs
    }));
  },
  clearGameLogs: () => set({ gameLogs: [] }),

  cardSelectionCallback: null,
  queenBomberRankCallback: null,
  discardSelectionCallback: null,
  exchangeSelectionCallback: null,
  cardSelectionValidator: null,
  cardSelectionPrompt: null,
  isCardSelectionEnabled: false,
  isQueenBomberRankSelectionEnabled: false,
  isDiscardSelectionEnabled: false,
  isExchangeSelectionEnabled: false,
  discardSelectionPile: [],
  discardSelectionMaxCount: 0,
  discardSelectionPrompt: null,
  selectedDiscardCards: [],
  exchangeSelectionCards: [],
  exchangeSelectionCount: 0,
  exchangeSelectionPrompt: null,
  selectedExchangeCards: [],
  playerSelectionCallback: null,
  isPlayerSelectionEnabled: false,
  playerSelectionIds: [],
  playerSelectionNames: new Map(),
  playerSelectionPrompt: null,
  opponentHandSelectionCallback: null,
  isOpponentHandSelectionEnabled: false,
  opponentHandSelectionCards: [],
  opponentHandSelectionMaxCount: 0,
  opponentHandSelectionPrompt: null,
  selectedOpponentHandCards: [],
  playerObjectSelectionCallback: null,
  isPlayerObjectSelectionEnabled: false,
  playerObjectSelectionPlayers: [],
  playerObjectSelectionPrompt: null,

  startGame: (options = {}) => {
    const { playerName = 'あなた', autoCPU = false } = options;
    try {
      const eventBus = new EventBus();

      // ルール設定を取得
      const ruleSettings = useRuleSettingsStore.getState().settings;

      // GameConfigFactory を使用してゲーム設定を生成
      // autoCPUがtrueなら人間プレイヤー0人（全員CPU）
      const humanPlayerCount = autoCPU ? 0 : 1;
      const config = GameConfigFactory.createStandardGame(4, humanPlayerCount, playerName, ruleSettings);

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
      discardSelectionCallback: null,
      exchangeSelectionCallback: null,
      cardSelectionValidator: null,
      cardSelectionPrompt: null,
      isCardSelectionEnabled: false,
      isQueenBomberRankSelectionEnabled: false,
      isDiscardSelectionEnabled: false,
      isExchangeSelectionEnabled: false,
      discardSelectionPile: [],
      discardSelectionMaxCount: 0,
      discardSelectionPrompt: null,
      selectedDiscardCards: [],
      exchangeSelectionCards: [],
      exchangeSelectionCount: 0,
      exchangeSelectionPrompt: null,
      selectedExchangeCards: [],
    });
  },

  continueGame: () => {
    const { engine } = get();
    if (!engine) {
      console.error('Engine not initialized');
      return;
    }

    // ゲームログをクリア
    get().clearGameLogs();

    // 次のラウンドを開始（非同期）
    engine.startNextRound().catch((error: Error) => {
      console.error('Game error:', error);
      set({ error: error.message });
    });
  },

  startMultiplayerGame: () => {
    try {
      const multiplayerStore = useMultiplayerStore.getState();
      const { mode, players, localPlayerId, hostManager } = multiplayerStore;

      if (mode !== 'host') {
        console.error('Only host can start multiplayer game');
        return;
      }

      if (!hostManager) {
        console.error('Host manager not initialized');
        return;
      }

      if (players.length < 2) {
        set({ error: 'プレイヤーが2人以上必要です' });
        return;
      }

      const eventBus = new EventBus();
      const ruleSettings = useRuleSettingsStore.getState().settings;

      // NetworkPlayer を MultiplayerPlayerInfo に変換
      const playerInfos: MultiplayerPlayerInfo[] = players.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
      }));

      // マルチプレイ用のGameConfigを作成
      const config = GameConfigFactory.createMultiplayerGame(
        playerInfos,
        localPlayerId,
        ruleSettings
      );

      // PresentationRequester を作成
      const presentationRequester = new GamePresentationRequester(get());

      // PlayerController マップを作成
      const playerControllers = new Map<string, PlayerController>();
      const remoteControllers = new Map<string, RemotePlayerController>();

      for (const pConfig of config.players) {
        const playerId = pConfig.id;
        const networkType = pConfig.networkType;

        if (playerId === localPlayerId) {
          // ローカルプレイヤー（ホスト自身）
          playerControllers.set(playerId, new HumanPlayerController(get(), playerId));
        } else if (networkType === 'GUEST') {
          // リモートゲストプレイヤー
          const remoteController = new RemotePlayerController({
            playerId,
            playerName: pConfig.name,
            sendRequest: (request) => {
              hostManager.sendToPlayer(playerId, {
                type: 'INPUT_REQUEST',
                request,
              });
            },
            onTimeout: () => {
              console.log(`[startMultiplayerGame] Player ${playerId} timed out`);
            },
          });
          playerControllers.set(playerId, remoteController);
          remoteControllers.set(playerId, remoteController);
        }
        // CPUはGameEngine側でnullを許容してCPUPlayerControllerを後から設定
      }

      // 通常のGameEngineを作成
      const engine = new GameEngine(config, eventBus, presentationRequester, playerControllers);

      // CPU用のコントローラーを設定
      for (const pConfig of config.players) {
        if (pConfig.networkType === 'CPU') {
          const player = engine.getState().players.find(p => p.id.value === pConfig.id);
          if (player) {
            playerControllers.set(
              pConfig.id,
              new CPUPlayerController(
                pConfig.strategy as CPUStrategy,
                player,
                engine.getState()
              )
            );
          }
        }
      }

      // ゲストからのINPUT_RESPONSEを処理するハンドラを設定
      hostManager.setHandlers({
        onGuestMessage: (connectionId, message) => {
          if (message.type === 'INPUT_RESPONSE') {
            const playerId = hostManager.getPlayerIdByConnectionId(connectionId);
            if (playerId) {
              const controller = remoteControllers.get(playerId);
              if (controller) {
                controller.receiveResponse(message.response);
              }
            }
          }
        },
        onGuestDisconnected: (_connectionId, playerId) => {
          if (playerId) {
            const controller = remoteControllers.get(playerId);
            if (controller) {
              controller.dispose();
              remoteControllers.delete(playerId);
            }
            // 他のプレイヤーに通知
            hostManager.broadcast({
              type: 'PLAYER_DISCONNECTED',
              playerId,
              replacedWithCPU: true,
            });
          }
        },
      });

      // イベントリスナーを設定
      eventBus.on('state:updated', (data) => {
        set({ gameState: { ...data.gameState } });
        useCardPositionStore.getState().syncWithGameState(data.gameState);

        // 各ゲストに個別に状態を送信（手札情報はそれぞれ自分のものだけ見える）
        for (const player of data.gameState.players) {
          const pConfig = config.players.find(c => c.id === player.id.value);
          if (pConfig?.networkType === 'GUEST') {
            const serialized = serializeGameState(data.gameState, player.id.value);
            hostManager.sendToPlayer(player.id.value, {
              type: 'GAME_STATE',
              state: serialized,
              targetPlayerId: player.id.value,
            });
          }
        }
      });

      eventBus.on('game:started', (data) => {
        console.log('Multiplayer game started!');
        const allCards = CardFactory.createDeck(true);
        useCardPositionStore.getState().initialize(allCards);
        set({ gameState: { ...data.gameState } });

        // 各ゲストに初期状態を送信
        for (const player of data.gameState.players) {
          const pConfig = config.players.find(c => c.id === player.id.value);
          if (pConfig?.networkType === 'GUEST') {
            const serialized = serializeGameState(data.gameState, player.id.value);
            hostManager.sendToPlayer(player.id.value, {
              type: 'GAME_STARTED',
              initialState: serialized,
            });
          }
        }
      });

      eventBus.on('game:ended', () => {
        console.log('Multiplayer game ended!');
        const state = engine.getState();
        const rankings = state.players
          .filter((p) => p.finishPosition !== null)
          .sort((a, b) => (a.finishPosition ?? 99) - (b.finishPosition ?? 99))
          .map((p) => ({
            playerId: p.id.value,
            rank: p.finishPosition ?? 0,
          }));

        hostManager.broadcast({
          type: 'GAME_ENDED',
          finalRankings: rankings,
        });
      });

      set({
        engine,
        isMultiplayerMode: true,
        error: null,
      });

      // ゲームを開始（非同期）
      engine.start().catch((error: Error) => {
        console.error('Multiplayer game error:', error);
        set({ error: error.message });
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  },

  updateGameStateFromHost: (state: GameState) => {
    // ゲスト側でホストから受信した状態を反映
    set({ gameState: { ...state } });
    useCardPositionStore.getState().syncWithGameState(state);
  },

  setGuestMode: (isGuest: boolean) => {
    set({ isGuestMode: isGuest, isMultiplayerMode: true });
  },

  enableGuestCardSelection: (validCardIds, canPass, callback, prompt) => {
    // validatorとしてvalidCardIdsに含まれるカードのみ許可
    const validator: Validator = {
      validate: (cards: Card[]) => {
        if (cards.length === 0) {
          return { valid: canPass, reason: canPass ? undefined : 'パスできません' };
        }
        const allValid = cards.every(c => validCardIds.includes(c.id));
        return { valid: allValid, reason: allValid ? undefined : '選択できないカードが含まれています' };
      }
    };
    set({
      guestCardSelectionCallback: callback,
      cardSelectionValidator: validator,
      cardSelectionPrompt: prompt || 'カードを選択してください',
      isCardSelectionEnabled: true,
      selectedCards: [],
    });
  },

  submitGuestCardSelection: (isPass = false) => {
    const { selectedCards, guestCardSelectionCallback } = get();
    if (guestCardSelectionCallback) {
      const cardIds = selectedCards.map(c => c.id);
      guestCardSelectionCallback(cardIds, isPass);
    }
    // UIを無効化
    set({
      isCardSelectionEnabled: false,
      cardSelectionValidator: null,
      cardSelectionPrompt: null,
      selectedCards: [],
      guestCardSelectionCallback: null,
    });
  },

  enqueueCutIn: async (cutIn) => {
    return new Promise<void>((resolve) => {
      const cutInWithCallback: RuleCutInData = {
        ...cutIn,
        onComplete: resolve,
      };
      set(state => ({ cutInQueue: [...state.cutInQueue, cutInWithCallback] }));
      // 次のイベントループでprocessQueueを呼ぶことで、
      // 同時に追加されたカットインが全部キューに入ってからバッチ処理される
      setTimeout(() => get().processQueue(), 0);
    });
  },

  removeCutIn: (id) => {
    // カットインを削除する前に onComplete コールバックを取得
    const { activeCutIns } = get();
    const removedCutIn = activeCutIns.find(c => c.id === id);

    set(state => ({ activeCutIns: state.activeCutIns.filter(c => c.id !== id) }));

    // カットインが削除されたら onComplete を呼び出す
    if (removedCutIn?.onComplete) {
      removedCutIn.onComplete();
    }

    const { activeCutIns: remainingCutIns, cutInResolve, cutInQueue } = get();
    if (remainingCutIns.length === 0) {
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

    // 最大3つ同時表示
    const batchSize = Math.min(cutInQueue.length, 3);
    const batch = cutInQueue.slice(0, batchSize);
    const rest = cutInQueue.slice(batchSize);

    const calculateVerticalPosition = (index: number, total: number): string => {
      if (total === 1) return '50%';
      const spacing = 100 / (total + 1);
      return `${spacing * (index + 1)}%`;
    };

    // 50msディレイで順次表示
    const cutInsWithDelay = batch.map((cutIn, index) => ({
      ...cutIn,
      delay: index * 50,
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
      selectedDiscardCards: []
    });
  },

  disableDiscardSelection: () => {
    set({
      isDiscardSelectionEnabled: false,
      discardSelectionPile: [],
      discardSelectionMaxCount: 0,
      discardSelectionPrompt: null,
      selectedDiscardCards: []
    });
  },

  toggleDiscardCardSelection: (card) => {
    const { selectedDiscardCards, discardSelectionMaxCount } = get();
    const isSelected = selectedDiscardCards.some(c => c.id === card.id);

    if (isSelected) {
      set({ selectedDiscardCards: selectedDiscardCards.filter(c => c.id !== card.id) });
    } else {
      // 最大枚数を超えない場合のみ追加
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
      selectedExchangeCards: []
    });
  },

  disableExchangeSelection: () => {
    set({
      isExchangeSelectionEnabled: false,
      exchangeSelectionCards: [],
      exchangeSelectionCount: 0,
      exchangeSelectionPrompt: null,
      selectedExchangeCards: []
    });
  },

  toggleExchangeCardSelection: (card) => {
    const { selectedExchangeCards, exchangeSelectionCount } = get();
    const isSelected = selectedExchangeCards.some(c => c.id === card.id);

    if (isSelected) {
      set({ selectedExchangeCards: selectedExchangeCards.filter(c => c.id !== card.id) });
    } else {
      // 指定枚数を超えない場合のみ追加
      if (selectedExchangeCards.length < exchangeSelectionCount) {
        set({ selectedExchangeCards: [...selectedExchangeCards, card] });
      }
    }
  },

  submitExchangeSelection: () => {
    const { selectedExchangeCards, exchangeSelectionCallback, exchangeSelectionCount } = get();
    // 指定枚数を満たしている場合のみ送信
    if (exchangeSelectionCallback && selectedExchangeCards.length === exchangeSelectionCount) {
      exchangeSelectionCallback(selectedExchangeCards);
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

        if (cardSelectionValidator.validate(combo).valid) {
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

  // Player selection methods
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

  // Opponent hand selection methods
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
    const isSelected = selectedOpponentHandCards.some(c => c.id === card.id);

    if (isSelected) {
      set({ selectedOpponentHandCards: selectedOpponentHandCards.filter(c => c.id !== card.id) });
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

  // Player object selection methods
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
