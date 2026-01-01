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
import { serializeGameState, deserializeGameState } from '../../infrastructure/network/GameStateSerializer';
import { PlayerAction, SerializedGameState, GuestMessage } from '../../infrastructure/network/NetworkProtocol';
import { useMultiplayerStore } from './multiplayerStore';
import { NetworkInputController } from '../../core/player-controller/NetworkInputController';
import { SyncPlayerController } from '../../core/player-controller/SyncPlayerController';
import { GuestPlayerController } from '../players/GuestPlayerController';
import { HumanStrategy } from '../../core/strategy/HumanStrategy';
import { RandomCPUStrategy } from '../../core/strategy/RandomCPUStrategy';
import { handSize, handGetCards, handFindAllValidPlays } from '../../core/domain/card/Hand';

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
  localPlayerId: string | null;  // このクライアントが操作するプレイヤーのID
  guestCardSelectionCallback: GuestCardSelectionCallback | null;
  // ゲスト用: 他プレイヤーのNetworkInputController（ACTION_PERFORMED受信用）
  networkControllers: Map<string, NetworkInputController>;
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
  initGuestGameEngine: (initialState: SerializedGameState, sendToHost: (message: GuestMessage) => void) => void;
  onActionPerformed: (playerId: string, action: PlayerAction) => void;
  checkStateHash: (turnNumber: number, hostHash: string) => boolean;
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
  localPlayerId: null,
  guestCardSelectionCallback: null,
  networkControllers: new Map(),
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

      // ローカルプレイヤーIDを特定（シングルプレイではHUMANプレイヤー）
      const humanPlayerId = config.players.find(p => p.type === PlayerType.HUMAN)?.id ?? null;

      config.players.forEach((pConfig) => {
        if (pConfig.type === PlayerType.HUMAN) {
          playerControllers.set(pConfig.id, new HumanPlayerController(pConfig.id));
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
          const player = engine.getState().players.find(p => p.id === pConfig.id);
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

      set({ engine, localPlayerId: humanPlayerId, error: null });

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
      isMultiplayerMode: false,
      isGuestMode: false,
      localPlayerId: null,
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
      const { mode, players, localPlayerId: mpLocalPlayerId, hostManager } = multiplayerStore;

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
        mpLocalPlayerId,
        ruleSettings
      );

      // PresentationRequester を作成
      const presentationRequester = new GamePresentationRequester(get());

      // PlayerController マップを作成
      // 注意: すべてのPlayerControllerはSyncPlayerControllerでラップされ、
      // 選択完了時にplayer:actionイベントを発行する（ゲスト同期用）
      const playerControllers = new Map<string, PlayerController>();
      const networkControllers = new Map<string, NetworkInputController>();

      // 全カードのマップを作成（カードID解決用）
      const allCardsMap = new Map<string, Card>();
      const allCards = CardFactory.createDeck(true);
      for (const card of allCards) {
        allCardsMap.set(card.id, card);
      }
      const cardResolver = (cardIds: string[]) => {
        return cardIds
          .map(id => allCardsMap.get(id))
          .filter((c): c is Card => c !== undefined);
      };

      for (const pConfig of config.players) {
        const playerId = pConfig.id;
        const networkType = pConfig.networkType;

        if (playerId === mpLocalPlayerId) {
          // ローカルプレイヤー（ホスト自身）- SyncPlayerControllerでラップ
          const humanController = new HumanPlayerController(playerId);
          playerControllers.set(playerId, new SyncPlayerController(playerId, humanController, eventBus));
        } else if (networkType === 'GUEST') {
          // リモートゲストプレイヤー - NetworkInputControllerを使用し、SyncPlayerControllerでラップ
          const networkController = new NetworkInputController(playerId);
          networkController.setCardResolver(cardResolver);
          networkControllers.set(playerId, networkController);
          playerControllers.set(playerId, new SyncPlayerController(playerId, networkController, eventBus));
        }
        // CPUはGameEngine側でnullを許容してCPUPlayerControllerを後から設定
      }

      // 通常のGameEngineを作成
      const engine = new GameEngine(config, eventBus, presentationRequester, playerControllers);

      // CPU用のコントローラーを設定（SyncPlayerControllerでラップ）
      for (const pConfig of config.players) {
        if (pConfig.networkType === 'CPU') {
          const player = engine.getState().players.find(p => p.id === pConfig.id);
          if (player) {
            const cpuController = new CPUPlayerController(
              pConfig.strategy as CPUStrategy,
              player,
              engine.getState()
            );
            playerControllers.set(
              pConfig.id,
              new SyncPlayerController(pConfig.id, cpuController, eventBus)
            );
          }
        }
      }

      // ゲストからのINPUT_RESPONSEを処理するハンドラを設定
      hostManager.setHandlers({
        onGuestMessage: (connectionId, message) => {
          console.log('[Host] Received message from guest:', message.type, connectionId);
          if (message.type === 'INPUT_RESPONSE') {
            console.log('[Host] Processing INPUT_RESPONSE:', message.response);
            const playerId = hostManager.getPlayerIdByConnectionId(connectionId);
            console.log('[Host] Player ID for connection:', playerId);
            if (playerId) {
              const controller = networkControllers.get(playerId);
              console.log('[Host] Found NetworkInputController:', !!controller);
              if (controller) {
                // INPUT_RESPONSEをPlayerActionに変換してNetworkInputControllerに渡す
                const response = message.response;
                let action: PlayerAction;
                if (response.type === 'CARD_SELECTION') {
                  action = {
                    type: 'CARD_SELECTION',
                    cardIds: response.selectedCardIds,
                    isPass: response.isPass,
                  };
                } else if (response.type === 'RANK_SELECTION') {
                  action = {
                    type: 'RANK_SELECTION',
                    rank: response.selectedRank,
                  };
                } else if (response.type === 'CARD_EXCHANGE') {
                  action = {
                    type: 'CARD_EXCHANGE',
                    cardIds: response.selectedCardIds,
                  };
                } else if (response.type === 'SUIT_SELECTION') {
                  action = {
                    type: 'SUIT_SELECTION',
                    suit: response.selectedSuit,
                  };
                } else {
                  console.log('[Host] Unknown response type');
                  return;
                }
                console.log('[Host] Dispatching action to NetworkInputController:', action);
                controller.onActionReceived(action);
                console.log('[Host] Action dispatched successfully');
              }
            }
          }
        },
        onGuestDisconnected: (_connectionId, playerId) => {
          if (playerId) {
            networkControllers.delete(playerId);
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
          const pConfig = config.players.find(c => c.id === player.id);
          if (pConfig?.networkType === 'GUEST') {
            const serialized = serializeGameState(data.gameState, player.id);
            hostManager.sendToPlayer(player.id, {
              type: 'GAME_STATE',
              state: serialized,
              targetPlayerId: player.id,
            });
          }
        }
      });

      console.log('[Host] Registering game:started event listener');
      eventBus.on('game:started', (data) => {
        console.log('[Host] game:started event handler called!');
        console.log('[Host] Multiplayer game started!', data.gameState);
        const allCards = CardFactory.createDeck(true);
        useCardPositionStore.getState().initialize(allCards);
        console.log('[Host] Setting gameState in store');
        set({ gameState: { ...data.gameState } });
        console.log('[Host] gameState set successfully');

        // 各ゲストに初期状態を送信
        console.log('[Host] Sending GAME_STARTED to guests...');
        for (const player of data.gameState.players) {
          const pConfig = config.players.find(c => c.id === player.id);
          if (pConfig?.networkType === 'GUEST') {
            console.log(`[Host] Sending GAME_STARTED to player ${player.id}`);
            const serialized = serializeGameState(data.gameState, player.id);
            hostManager.sendToPlayer(player.id, {
              type: 'GAME_STARTED',
              initialState: serialized,
            });
          }
        }
        console.log('[Host] Finished sending GAME_STARTED to guests');
      });

      eventBus.on('game:ended', () => {
        console.log('Multiplayer game ended!');
        const state = engine.getState();
        const rankings = state.players
          .filter((p) => p.finishPosition !== null)
          .sort((a, b) => (a.finishPosition ?? 99) - (b.finishPosition ?? 99))
          .map((p) => ({
            playerId: p.id,
            rank: p.finishPosition ?? 0,
          }));

        hostManager.broadcast({
          type: 'GAME_ENDED',
          finalRankings: rankings,
        });
      });

      // プレイヤーアクションイベント（ゲスト側GameEngine同期用）
      eventBus.on('player:action', (data: { playerId: string; action: PlayerAction }) => {
        // 全ゲストにアクションをブロードキャスト
        hostManager.broadcast({
          type: 'ACTION_PERFORMED',
          playerId: data.playerId,
          action: data.action,
        });
      });

      // ターン完了イベント（状態ハッシュ送信）
      eventBus.on('turn:completed', (data: { turnNumber: number; stateHash: string }) => {
        // 全ゲストに状態ハッシュを送信（整合性チェック用）
        hostManager.broadcast({
          type: 'STATE_HASH',
          turnNumber: data.turnNumber,
          hash: data.stateHash,
        });
      });

      set({
        engine,
        isMultiplayerMode: true,
        localPlayerId: mpLocalPlayerId,
        error: null,
      });

      console.log('[Host] Starting multiplayer game engine...');
      // ゲームを開始（非同期）
      engine.start().then(() => {
        console.log('[Host] Game engine started successfully');
      }).catch((error: Error) => {
        console.error('[Host] Multiplayer game error:', error);
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
    // ゲストモードに切り替える際、multiplayerStoreからlocalPlayerIdを取得
    const mpLocalPlayerId = useMultiplayerStore.getState().localPlayerId;
    set({ isGuestMode: isGuest, isMultiplayerMode: true, localPlayerId: mpLocalPlayerId });
  },

  initGuestGameEngine: (initialState: SerializedGameState, sendToHost: (message: GuestMessage) => void) => {
    try {
      const mpLocalPlayerId = useMultiplayerStore.getState().localPlayerId;
      const ruleSettings = useRuleSettingsStore.getState().settings;

      // 初期状態をデシリアライズ
      const gameState = deserializeGameState(initialState, mpLocalPlayerId);

      // プレイヤー設定を初期状態から構築
      const playerConfigs = initialState.players.map(p => ({
        id: p.id,
        name: p.name,
        type: p.id === mpLocalPlayerId ? PlayerType.HUMAN : PlayerType.CPU,
        strategy: p.id === mpLocalPlayerId ? new HumanStrategy() : new RandomCPUStrategy(),
      }));

      const config = {
        players: playerConfigs,
        ruleSettings: { ...ruleSettings },
      };

      // イベントバスとプレゼンテーションリクエスターを作成
      const eventBus = new EventBus();
      const presentationRequester = new GamePresentationRequester(get());

      // NetworkInputControllerを作成（自分以外のプレイヤー用）
      const networkControllers = new Map<string, NetworkInputController>();

      // 全カードのマップを作成（カードID解決用）
      const allCardsMap = new Map<string, Card>();
      for (const cardData of initialState.allCards) {
        allCardsMap.set(cardData.id, {
          id: cardData.id,
          suit: cardData.suit,
          rank: cardData.rank,
          strength: cardData.strength,
        });
      }
      if (initialState.myHandCards) {
        for (const cardData of initialState.myHandCards) {
          allCardsMap.set(cardData.id, {
            id: cardData.id,
            suit: cardData.suit,
            rank: cardData.rank,
            strength: cardData.strength,
          });
        }
      }

      const cardResolver = (cardIds: string[]) => {
        return cardIds
          .map(id => allCardsMap.get(id))
          .filter((c): c is Card => c !== undefined);
      };

      // PlayerControllerを作成
      const playerControllers = new Map<string, PlayerController>();
      for (const pConfig of playerConfigs) {
        if (pConfig.id === mpLocalPlayerId) {
          // 自分はGuestPlayerController（選択完了時にホストに送信）
          playerControllers.set(pConfig.id, new GuestPlayerController(pConfig.id, sendToHost));
        } else {
          // 他プレイヤーはNetworkInputController（ACTION_PERFORMED待機）
          const networkController = new NetworkInputController(pConfig.id);
          networkController.setCardResolver(cardResolver);
          networkControllers.set(pConfig.id, networkController);
          playerControllers.set(pConfig.id, networkController);
        }
      }

      // GameEngineを作成
      const engine = new GameEngine(config, eventBus, presentationRequester, playerControllers);

      // 初期状態を設定（SetupPhaseをスキップ）
      engine.setInitialState(gameState);

      // 状態変更を監視
      eventBus.on('state:updated', (data: { gameState: GameState }) => {
        set({ gameState: { ...data.gameState } });
        useCardPositionStore.getState().syncWithGameState(data.gameState);
      });

      console.log('[Guest] Setting store state with gameState');
      set({
        engine,
        networkControllers,
        isMultiplayerMode: true,
        isGuestMode: true,
        localPlayerId: mpLocalPlayerId,
        gameState: { ...gameState },
        error: null,
      });
      console.log('[Guest] Store state set, gameState is now:', !!get().gameState);

      // カードポジションストアを同期
      const allCards = CardFactory.createDeck(true);
      useCardPositionStore.getState().initialize(allCards);
      useCardPositionStore.getState().syncWithGameState(gameState);

      console.log('[Guest] GameEngine initialized, starting game loop...');

      // ゲームループ開始（非同期）- PlayPhaseから開始
      engine.startFromPlayPhase().catch((error: Error) => {
        console.error('[Guest] Game error:', error);
        set({ error: error.message });
      });

    } catch (error) {
      console.error('[Guest] Failed to initialize GameEngine:', error);
      set({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  },

  onActionPerformed: (playerId: string, action: PlayerAction) => {
    const { networkControllers } = get();
    const controller = networkControllers.get(playerId);
    if (controller) {
      console.log(`[Guest] Received action from ${playerId}:`, action);
      controller.onActionReceived(action);
    } else {
      console.warn(`[Guest] No NetworkInputController for player ${playerId}`);
    }
  },

  checkStateHash: (turnNumber: number, hostHash: string) => {
    const { gameState } = get();
    if (!gameState) return true; // 状態がない場合はスキップ

    // ゲスト側で同じハッシュを計算
    const data = {
      currentPlayerIndex: gameState.currentPlayerIndex,
      handSizes: gameState.players.map(p => handSize(p.hand)),
      fieldCardCount: gameState.field.history.length,
      isRevolution: gameState.isRevolution,
      passCount: gameState.passCount,
    };
    const localHash = btoa(JSON.stringify(data)).slice(0, 16);

    if (localHash !== hostHash) {
      console.warn(`[Guest] State hash mismatch at turn ${turnNumber}!`);
      console.warn(`[Guest] Local: ${localHash}, Host: ${hostHash}`);
      return false;
    }

    console.log(`[Guest] State hash verified at turn ${turnNumber}`);
    return true;
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
    const { gameState, engine, cardSelectionValidator, isGuestMode, isMultiplayerMode, localPlayerId } = get();
    if (!gameState) return [];

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer || currentPlayer.type !== PlayerType.HUMAN) {
      return [];
    }

    // マルチプレイモードでは、ローカルプレイヤーの手番でのみ有効な組み合わせを計算
    if (isMultiplayerMode && localPlayerId && currentPlayer.id !== localPlayerId) {
      return [];
    }

    // カード選択が有効でvalidatorがある場合（ゲストモード含む）
    // isCardSelectionEnabled もチェックして、選択が無効な時は計算しない
    const isCardSelectionEnabled = get().isCardSelectionEnabled;
    if (cardSelectionValidator && isCardSelectionEnabled) {
      const handCards = handGetCards(currentPlayer.hand);
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

    // ゲストモードでengineがない場合は空配列
    if (!engine && isGuestMode) {
      return [];
    }

    if (!engine) return [];

    // 通常の場合は既存のロジックを使用
    // 重要: engine.getState()から最新の状態を取得する
    // Zustandの状態はReactの再レンダリングタイミングで遅れる可能性があるため
    const ruleEngine = engine.getRuleEngine();
    const latestState = engine.getState();
    const latestPlayer = latestState.players[latestState.currentPlayerIndex];

    if (!latestPlayer || latestPlayer.type !== PlayerType.HUMAN) {
      return [];
    }

    return handFindAllValidPlays(latestPlayer.hand, 
      latestPlayer,
      latestState.field,
      latestState,
      ruleEngine
    );
  },

  getRuleEngine: () => {
    const { engine, isGuestMode } = get();
    if (!engine) {
      // ゲストモードの場合はengineがないので、
      // RuleEngineを直接作成（ゲストはvalidation不要だが型互換のため）
      if (isGuestMode) {
        return new RuleEngine();
      }
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
