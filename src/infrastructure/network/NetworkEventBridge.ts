/**
 * NetworkEventBridge
 *
 * EventBus のイベントをネットワークメッセージに変換してブロードキャストする。
 * ホスト側でゲスト同期のために使用される。
 */

import { EventBus } from '../../application/services/EventBus';
import { GameState } from '../../core/domain/game/GameState';
import { GameEngine } from '../../core/game/GameEngine';
import { CoreAction } from '../../core/domain/player/CoreAction';
import { HostConnectionManager } from './ConnectionManager';
import { serializeGameState } from './GameStateSerializer';
import { coreActionToNetworkAction } from './ActionAdapter';

/**
 * ゲストプレイヤー情報
 */
export interface GuestPlayerInfo {
  playerId: string;
  networkType: string;
}

/**
 * NetworkEventBridge
 *
 * ホスト側で EventBus のイベントをリッスンし、
 * ゲストにネットワークメッセージとして送信する。
 */
export class NetworkEventBridge {
  constructor(
    private eventBus: EventBus,
    private hostManager: HostConnectionManager,
    private guestPlayers: GuestPlayerInfo[]
  ) {}

  /**
   * イベントリスナーをセットアップ
   */
  setup(engine: GameEngine): void {
    this.setupStateUpdatedListener();
    this.setupGameStartedListener();
    this.setupGameEndedListener(engine);
    this.setupPlayerActionListener();
    this.setupTurnCompletedListener();
  }

  /**
   * state:updated イベントをリッスンしてゲストに状態を送信
   */
  private setupStateUpdatedListener(): void {
    this.eventBus.on('state:updated', (data: { gameState: GameState }) => {
      // 各ゲストに個別に状態を送信（手札情報はそれぞれ自分のものだけ見える）
      for (const guestPlayer of this.guestPlayers) {
        const serialized = serializeGameState(data.gameState, guestPlayer.playerId);
        this.hostManager.sendToPlayer(guestPlayer.playerId, {
          type: 'GAME_STATE',
          state: serialized,
          targetPlayerId: guestPlayer.playerId,
        });
      }
    });
  }

  /**
   * game:started イベントをリッスンしてゲストに初期状態を送信
   */
  private setupGameStartedListener(): void {
    this.eventBus.on('game:started', (data: { gameState: GameState }) => {
      console.log('[NetworkEventBridge] Sending GAME_STARTED to guests...');
      for (const guestPlayer of this.guestPlayers) {
        console.log(`[NetworkEventBridge] Sending GAME_STARTED to player ${guestPlayer.playerId}`);
        const serialized = serializeGameState(data.gameState, guestPlayer.playerId);
        this.hostManager.sendToPlayer(guestPlayer.playerId, {
          type: 'GAME_STARTED',
          initialState: serialized,
        });
      }
      console.log('[NetworkEventBridge] Finished sending GAME_STARTED to guests');
    });
  }

  /**
   * game:ended イベントをリッスンしてゲストに終了メッセージを送信
   */
  private setupGameEndedListener(engine: GameEngine): void {
    this.eventBus.on('game:ended', () => {
      console.log('[NetworkEventBridge] Multiplayer game ended!');
      const state = engine.getState();
      const rankings = state.players
        .filter((p) => p.finishPosition !== null)
        .sort((a, b) => (a.finishPosition ?? 99) - (b.finishPosition ?? 99))
        .map((p) => ({
          playerId: p.id,
          rank: p.finishPosition ?? 0,
        }));

      this.hostManager.broadcast({
        type: 'GAME_ENDED',
        finalRankings: rankings,
      });
    });
  }

  /**
   * player:action イベントをリッスンしてゲストにアクションをブロードキャスト
   */
  private setupPlayerActionListener(): void {
    this.eventBus.on('player:action', (data: { playerId: string; action: CoreAction }) => {
      // CoreAction -> PlayerAction変換してブロードキャスト
      const networkAction = coreActionToNetworkAction(data.action);
      this.hostManager.broadcast({
        type: 'ACTION_PERFORMED',
        playerId: data.playerId,
        action: networkAction,
      });
    });
  }

  /**
   * turn:completed イベントをリッスンして状態ハッシュをブロードキャスト
   */
  private setupTurnCompletedListener(): void {
    this.eventBus.on('turn:completed', (data: { turnNumber: number; stateHash: string }) => {
      // 全ゲストに状態ハッシュを送信（整合性チェック用）
      this.hostManager.broadcast({
        type: 'STATE_HASH',
        turnNumber: data.turnNumber,
        hash: data.stateHash,
      });
    });
  }
}
