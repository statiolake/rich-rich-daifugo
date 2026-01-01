/**
 * GameOrchestrator
 *
 * ゲーム初期化のオーケストレーションを担当する。
 * gameStore.ts から初期化ロジックを抽出し、責務を分離する。
 */

import { GameEngine } from '../../core/game/GameEngine';
import { GameConfigFactory, MultiplayerPlayerInfo } from '../../core/game/GameConfigFactory';
import { GameState } from '../../core/domain/game/GameState';
import { Card, CardFactory } from '../../core/domain/card/Card';
import { Player, PlayerType } from '../../core/domain/player/Player';
import { PlayerController } from '../../core/domain/player/PlayerController';
import { RuleSettings } from '../../core/domain/game/RuleSettings';
import { PresentationRequester } from '../../core/domain/presentation/PresentationRequester';
import { EventBus } from './EventBus';
import { HumanPlayerController } from '../../presentation/players/HumanPlayerController';
import { CPUPlayerController } from '../../presentation/players/CPUPlayerController';
import { GuestPlayerController } from '../../presentation/players/GuestPlayerController';
import { NetworkInputController } from '../../core/player-controller/NetworkInputController';
import { SyncPlayerController } from '../../core/player-controller/SyncPlayerController';
import { CPUStrategy } from '../../core/strategy/PlayerStrategy';
import { HumanStrategy } from '../../core/strategy/HumanStrategy';
import { RandomCPUStrategy } from '../../core/strategy/RandomCPUStrategy';
import { HostConnectionManager } from '../../infrastructure/network/ConnectionManager';
import { GuestMessage, SerializedGameState, PlayerAction } from '../../infrastructure/network/NetworkProtocol';
import { serializeGameState, deserializeGameState } from '../../infrastructure/network/GameStateSerializer';
import { CoreAction } from '../../core/domain/player/CoreAction';
import { networkActionToCoreAction, coreActionToNetworkAction } from '../../infrastructure/network/ActionAdapter';

/**
 * ゲーム開始設定
 */
export interface SinglePlayerGameOptions {
  playerName?: string;
  autoCPU?: boolean;
}

/**
 * ゲーム状態変更コールバック
 */
export interface GameStateCallbacks {
  onStateUpdated: (gameState: GameState) => void;
  onGameStarted: (gameState: GameState) => void;
  onGameEnded: (gameState: GameState) => void;
  onError: (error: Error) => void;
}

/**
 * マルチプレイヤー設定
 */
export interface MultiplayerConfig {
  players: MultiplayerPlayerInfo[];
  localPlayerId: string;
  hostManager: HostConnectionManager;
}

/**
 * ゲスト初期化設定
 */
export interface GuestGameConfig {
  initialState: SerializedGameState;
  localPlayerId: string;
  sendToHost: (message: GuestMessage) => void;
}

/**
 * オーケストレーション結果
 */
export interface OrchestratorResult {
  engine: GameEngine;
  localPlayerId: string | null;
  networkControllers?: Map<string, NetworkInputController>;
}

/**
 * GameOrchestrator
 *
 * ゲームの初期化とセットアップを担当する。
 * - シングルプレイヤーゲームの初期化
 * - マルチプレイヤーゲーム（ホスト側）の初期化
 * - ゲスト側ゲームエンジンの初期化
 */
export class GameOrchestrator {
  constructor(
    private ruleSettings: RuleSettings,
    private presentationRequester: PresentationRequester,
    private callbacks: GameStateCallbacks
  ) {}

  /**
   * シングルプレイヤーゲームを開始する
   */
  startSinglePlayerGame(options: SinglePlayerGameOptions = {}): OrchestratorResult {
    const { playerName = 'あなた', autoCPU = false } = options;

    const eventBus = new EventBus();
    const humanPlayerCount = autoCPU ? 0 : 1;
    const config = GameConfigFactory.createStandardGame(4, humanPlayerCount, playerName, this.ruleSettings);

    // PlayerController マップを作成
    const playerControllers = new Map<string, PlayerController>();
    const humanPlayerId = config.players.find(p => p.type === PlayerType.HUMAN)?.id ?? null;

    config.players.forEach((pConfig) => {
      if (pConfig.type === PlayerType.HUMAN) {
        playerControllers.set(pConfig.id, new HumanPlayerController(pConfig.id));
      } else {
        // CPU用のコントローラーは後で設定（gameStateが必要）
        playerControllers.set(pConfig.id, null as any);
      }
    });

    // GameEngine を作成
    const engine = new GameEngine(config, eventBus, this.presentationRequester, playerControllers);

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
              engine.getState()
            )
          );
        }
      }
    });

    // イベントリスナーを設定
    this.setupEventListeners(eventBus, engine);

    // ゲームを開始（非同期）
    engine.start().catch((error) => {
      console.error('Game error:', error);
      this.callbacks.onError(error);
    });

    return { engine, localPlayerId: humanPlayerId };
  }

  /**
   * マルチプレイヤーゲーム（ホスト側）を開始する
   */
  startHostGame(multiplayerConfig: MultiplayerConfig): OrchestratorResult {
    const { players, localPlayerId, hostManager } = multiplayerConfig;

    const eventBus = new EventBus();
    const config = GameConfigFactory.createMultiplayerGame(players, localPlayerId, this.ruleSettings);

    // PlayerController マップを作成
    const playerControllers = new Map<string, PlayerController>();
    const networkControllers = new Map<string, NetworkInputController>();

    // カードリゾルバーを作成
    const cardResolver = this.createCardResolver();

    for (const pConfig of config.players) {
      const playerId = pConfig.id;
      const networkType = pConfig.networkType;

      if (playerId === localPlayerId) {
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

    // GameEngineを作成
    const engine = new GameEngine(config, eventBus, this.presentationRequester, playerControllers);

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
    this.setupHostMessageHandler(hostManager, networkControllers);

    // イベントリスナーを設定
    this.setupHostEventListeners(eventBus, engine, config, hostManager);

    // ゲームを開始（非同期）
    console.log('[Host] Starting multiplayer game engine...');
    engine.start().then(() => {
      console.log('[Host] Game engine started successfully');
    }).catch((error: Error) => {
      console.error('[Host] Multiplayer game error:', error);
      this.callbacks.onError(error);
    });

    return { engine, localPlayerId, networkControllers };
  }

  /**
   * ゲスト側ゲームエンジンを初期化する
   */
  initGuestGame(guestConfig: GuestGameConfig): OrchestratorResult {
    const { initialState, localPlayerId, sendToHost } = guestConfig;

    // 初期状態をデシリアライズ
    const gameState = deserializeGameState(initialState, localPlayerId);

    // プレイヤー設定を初期状態から構築
    const playerConfigs = initialState.players.map(p => ({
      id: p.id,
      name: p.name,
      type: p.id === localPlayerId ? PlayerType.HUMAN : PlayerType.CPU,
      strategy: p.id === localPlayerId ? new HumanStrategy() : new RandomCPUStrategy(),
    }));

    const config = {
      players: playerConfigs,
      ruleSettings: { ...this.ruleSettings },
    };

    const eventBus = new EventBus();

    // カードリゾルバーを作成
    const cardResolver = this.createGuestCardResolver(initialState);

    // NetworkInputControllerを作成（自分以外のプレイヤー用）
    const networkControllers = new Map<string, NetworkInputController>();
    const playerControllers = new Map<string, PlayerController>();

    for (const pConfig of playerConfigs) {
      if (pConfig.id === localPlayerId) {
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
    const engine = new GameEngine(config, eventBus, this.presentationRequester, playerControllers);

    // 初期状態を設定（SetupPhaseをスキップ）
    engine.setInitialState(gameState);

    // 状態変更を監視
    eventBus.on('state:updated', (data: { gameState: GameState }) => {
      this.callbacks.onStateUpdated(data.gameState);
    });

    // ゲームループ開始（非同期）- PlayPhaseから開始
    console.log('[Guest] GameEngine initialized, starting game loop...');
    engine.startFromPlayPhase().catch((error: Error) => {
      console.error('[Guest] Game error:', error);
      this.callbacks.onError(error);
    });

    return { engine, localPlayerId, networkControllers };
  }

  /**
   * イベントリスナーを設定（シングルプレイヤー用）
   */
  private setupEventListeners(eventBus: EventBus, engine: GameEngine): void {
    eventBus.on('state:updated', (data) => {
      this.callbacks.onStateUpdated(data.gameState);
    });

    eventBus.on('game:started', (data) => {
      console.log('Game started!');
      this.callbacks.onGameStarted(data.gameState);
    });

    eventBus.on('game:ended', (data) => {
      console.log('Game ended!');
      this.callbacks.onGameEnded(data.gameState);
    });
  }

  /**
   * ホスト用イベントリスナーを設定
   */
  private setupHostEventListeners(
    eventBus: EventBus,
    engine: GameEngine,
    config: ReturnType<typeof GameConfigFactory.createMultiplayerGame>,
    hostManager: HostConnectionManager
  ): void {
    eventBus.on('state:updated', (data) => {
      this.callbacks.onStateUpdated(data.gameState);

      // 各ゲストに個別に状態を送信
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
      this.callbacks.onGameStarted(data.gameState);

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
    eventBus.on('player:action', (data: { playerId: string; action: CoreAction }) => {
      // CoreAction -> PlayerAction変換してブロードキャスト
      const networkAction = coreActionToNetworkAction(data.action);
      hostManager.broadcast({
        type: 'ACTION_PERFORMED',
        playerId: data.playerId,
        action: networkAction,
      });
    });

    // ターン完了イベント（状態ハッシュ送信）
    eventBus.on('turn:completed', (data: { turnNumber: number; stateHash: string }) => {
      hostManager.broadcast({
        type: 'STATE_HASH',
        turnNumber: data.turnNumber,
        hash: data.stateHash,
      });
    });
  }

  /**
   * ホスト用メッセージハンドラを設定
   */
  private setupHostMessageHandler(
    hostManager: HostConnectionManager,
    networkControllers: Map<string, NetworkInputController>
  ): void {
    hostManager.setHandlers({
      onGuestMessage: (connectionId: string, message: GuestMessage) => {
        console.log('[Host] Received message from guest:', message.type, connectionId);
        if (message.type === 'INPUT_RESPONSE') {
          console.log('[Host] Processing INPUT_RESPONSE:', message.response);
          const playerId = hostManager.getPlayerIdByConnectionId(connectionId);
          console.log('[Host] Player ID for connection:', playerId);
          if (playerId) {
            const controller = networkControllers.get(playerId);
            console.log('[Host] Found NetworkInputController:', !!controller);
            if (controller) {
              // INPUT_RESPONSEをPlayerActionに変換し、CoreActionに変換してNetworkInputControllerに渡す
              const response = message.response;
              let networkAction: PlayerAction;
              if (response.type === 'CARD_SELECTION') {
                networkAction = {
                  type: 'CARD_SELECTION',
                  cardIds: response.selectedCardIds,
                  isPass: response.isPass,
                };
              } else if (response.type === 'RANK_SELECTION') {
                networkAction = {
                  type: 'RANK_SELECTION',
                  rank: response.selectedRank,
                };
              } else if (response.type === 'CARD_EXCHANGE') {
                networkAction = {
                  type: 'CARD_EXCHANGE',
                  cardIds: response.selectedCardIds,
                };
              } else if (response.type === 'SUIT_SELECTION') {
                networkAction = {
                  type: 'SUIT_SELECTION',
                  suit: response.selectedSuit,
                };
              } else {
                console.log('[Host] Unknown response type');
                return;
              }
              // PlayerAction -> CoreAction変換
              const coreAction = networkActionToCoreAction(networkAction);
              console.log('[Host] Dispatching action to NetworkInputController:', coreAction);
              controller.onActionReceived(coreAction);
              console.log('[Host] Action dispatched successfully');
            }
          }
        }
      },
      onGuestDisconnected: (_connectionId: string, playerId: string | null) => {
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
  }

  /**
   * カードリゾルバーを作成（ホスト用）
   */
  private createCardResolver(): (cardIds: string[]) => Card[] {
    const allCardsMap = new Map<string, Card>();
    const allCards = CardFactory.createDeck(true);
    for (const card of allCards) {
      allCardsMap.set(card.id, card);
    }
    return (cardIds: string[]) => {
      return cardIds
        .map(id => allCardsMap.get(id))
        .filter((c): c is Card => c !== undefined);
    };
  }

  /**
   * カードリゾルバーを作成（ゲスト用）
   */
  private createGuestCardResolver(initialState: SerializedGameState): (cardIds: string[]) => Card[] {
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
    return (cardIds: string[]) => {
      return cardIds
        .map(id => allCardsMap.get(id))
        .filter((c): c is Card => c !== undefined);
    };
  }
}
