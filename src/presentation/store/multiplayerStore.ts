/**
 * マルチプレイヤー状態管理ストア
 *
 * P2P接続、ロビー、プレイヤー管理を担当
 */

import { create } from 'zustand';
import {
  HostConnectionManager,
  GuestConnectionManager,
} from '../../infrastructure/network/ConnectionManager';
import {
  NetworkPlayer,
  ConnectionState,
  GuestMessage,
  HostMessage,
  PROTOCOL_VERSION,
} from '../../infrastructure/network/NetworkProtocol';

export type MultiplayerMode = 'none' | 'host' | 'guest';

interface MultiplayerStore {
  // 基本状態
  mode: MultiplayerMode;
  connectionState: ConnectionState;
  localPlayerId: string;
  localPlayerName: string;

  // プレイヤー管理
  players: NetworkPlayer[];

  // 接続マネージャー
  hostManager: HostConnectionManager | null;
  guestManager: GuestConnectionManager | null;

  // ペンディング接続（ホスト側）
  pendingConnections: Map<string, { offer: string; created: Date }>;

  // エラー状態
  error: string | null;

  // ゲスト側: ホストからのメッセージハンドラ
  hostMessageHandler: ((message: HostMessage) => void) | null;

  // Actions - 初期化
  initAsHost: (playerName: string) => void;
  initAsGuest: (playerName: string) => void;
  reset: () => void;

  // Actions - ホスト側
  createOfferForGuest: () => Promise<string>;
  acceptAnswer: (connectionId: string, answer: string) => Promise<void>;
  addCPU: (name?: string) => void;
  removeCPU: (playerId: string) => void;
  removePlayer: (playerId: string) => void;

  // Actions - ゲスト側
  acceptOffer: (offer: string) => Promise<string>;
  setHostMessageHandler: (handler: (message: HostMessage) => void) => void;
  sendToHost: (message: GuestMessage) => void;

  // Actions - 共通
  setLocalPlayerName: (name: string) => void;
  setError: (error: string | null) => void;

  // Actions - ホスト側ブロードキャスト
  broadcast: (message: HostMessage) => void;
  sendToPlayer: (playerId: string, message: HostMessage) => void;
  broadcastPlayerList: (players: NetworkPlayer[]) => void;

  // ゲーム開始可能かどうか
  canStartGame: () => boolean;
}

let cpuCounter = 0;

export const useMultiplayerStore = create<MultiplayerStore>((set, get) => ({
  // 初期状態
  mode: 'none',
  connectionState: 'disconnected',
  localPlayerId: '',
  localPlayerName: 'Player',
  players: [],
  hostManager: null,
  guestManager: null,
  pendingConnections: new Map(),
  error: null,
  hostMessageHandler: null,

  // ホストとして初期化
  initAsHost: (playerName: string) => {
    const hostManager = new HostConnectionManager();
    const localPlayerId = crypto.randomUUID();

    // ゲストからのメッセージハンドラを設定
    hostManager.setHandlers({
      onGuestConnected: (connectionId) => {
        console.log(`[MultiplayerStore] Guest connected: ${connectionId}`);
        // 接続完了を待つ（JOINメッセージで実際にプレイヤーが追加される）
      },
      onGuestDisconnected: (connectionId, playerId) => {
        console.log(`[MultiplayerStore] Guest disconnected: ${connectionId}, ${playerId}`);
        if (playerId) {
          // プレイヤーをCPUに置き換え
          const { players } = get();
          const updatedPlayers = players.map((p) =>
            p.id === playerId
              ? { ...p, type: 'CPU' as const, isConnected: false }
              : p
          );
          set({ players: updatedPlayers });

          // 他のゲストに通知
          get().broadcast({
            type: 'PLAYER_DISCONNECTED',
            playerId,
            replacedWithCPU: true,
          });
        }
      },
      onGuestMessage: (connectionId, message) => {
        console.log(`[MultiplayerStore] Guest message:`, message);
        if (message.type === 'JOIN') {
          const { players, hostManager } = get();

          // 新しいプレイヤーを追加
          const newPlayerId = crypto.randomUUID();
          const newPlayer: NetworkPlayer = {
            id: newPlayerId,
            name: message.playerName,
            type: 'GUEST',
            isConnected: true,
          };

          hostManager?.assignPlayerId(connectionId, newPlayerId, message.playerName);

          const updatedPlayers = [...players, newPlayer];
          set({ players: updatedPlayers });

          // プレイヤーリストを全員に送信
          get().broadcastPlayerList(updatedPlayers);
        }
      },
    });

    // ホスト自身をプレイヤーリストに追加
    const hostPlayer: NetworkPlayer = {
      id: localPlayerId,
      name: playerName,
      type: 'HOST',
      isConnected: true,
    };

    set({
      mode: 'host',
      connectionState: 'connected',
      localPlayerId,
      localPlayerName: playerName,
      players: [hostPlayer],
      hostManager,
      guestManager: null,
      pendingConnections: new Map(),
      error: null,
    });
  },

  // ゲストとして初期化
  initAsGuest: (playerName: string) => {
    const guestManager = new GuestConnectionManager();
    const localPlayerId = crypto.randomUUID();

    guestManager.setHandlers({
      onHostMessage: (message) => {
        const { hostMessageHandler } = get();
        if (message.type === 'PLAYER_LIST') {
          set({ players: message.players });
          // ホストから通知された自分のプレイヤーIDを保存
          if (message.yourPlayerId) {
            set({ localPlayerId: message.yourPlayerId });
          }
        }
        hostMessageHandler?.(message);
      },
      onHostDisconnected: () => {
        console.log(`[MultiplayerStore] Host disconnected`);
        set({
          connectionState: 'disconnected',
          error: 'ホストとの接続が切断されました',
        });
      },
      onStateChange: (state) => {
        set({ connectionState: state });
        // 接続完了時にJOINメッセージを送信
        if (state === 'connected') {
          const { guestManager: gm, localPlayerName: name } = get();
          if (gm) {
            console.log('[MultiplayerStore] Sending JOIN message');
            gm.sendToHost({
              type: 'JOIN',
              playerName: name,
              version: PROTOCOL_VERSION,
            });
          }
        }
      },
    });

    set({
      mode: 'guest',
      connectionState: 'disconnected',
      localPlayerId,
      localPlayerName: playerName,
      players: [],
      hostManager: null,
      guestManager,
      pendingConnections: new Map(),
      error: null,
    });
  },

  // 状態リセット
  reset: () => {
    const { hostManager, guestManager } = get();
    hostManager?.closeAll();
    guestManager?.close();

    set({
      mode: 'none',
      connectionState: 'disconnected',
      localPlayerId: '',
      localPlayerName: 'Player',
      players: [],
      hostManager: null,
      guestManager: null,
      pendingConnections: new Map(),
      error: null,
      hostMessageHandler: null,
    });
  },

  // ホスト: ゲスト用オファー生成
  createOfferForGuest: async () => {
    const { hostManager, pendingConnections } = get();
    if (!hostManager) {
      throw new Error('Not in host mode');
    }

    const { connectionId, offer } = await hostManager.createOfferForGuest();

    const updatedPending = new Map(pendingConnections);
    updatedPending.set(connectionId, { offer, created: new Date() });
    set({ pendingConnections: updatedPending });

    return offer;
  },

  // ホスト: アンサー受け入れ
  acceptAnswer: async (connectionId: string, answer: string) => {
    const { hostManager, pendingConnections } = get();
    if (!hostManager) {
      throw new Error('Not in host mode');
    }

    // ペンディング接続からconnectionIdを探す
    // 現在は最新のペンディング接続を使用
    const pendingEntries = Array.from(pendingConnections.entries());
    if (pendingEntries.length === 0) {
      throw new Error('No pending connections');
    }

    const [latestConnectionId] = pendingEntries[pendingEntries.length - 1];
    await hostManager.acceptAnswer(latestConnectionId, answer);

    // ペンディングから削除
    const updatedPending = new Map(pendingConnections);
    updatedPending.delete(latestConnectionId);
    set({ pendingConnections: updatedPending });
  },

  // ホスト: CPU追加
  addCPU: (name?: string) => {
    const { players } = get();

    if (players.length >= 4) {
      set({ error: 'プレイヤーは最大4人までです' });
      return;
    }

    cpuCounter++;
    const cpuPlayer: NetworkPlayer = {
      id: `cpu-${cpuCounter}`,
      name: name || `CPU ${cpuCounter}`,
      type: 'CPU',
      isConnected: true,
    };

    const updatedPlayers = [...players, cpuPlayer];
    set({ players: updatedPlayers, error: null });

    // 全員にプレイヤーリストを送信
    get().broadcastPlayerList(updatedPlayers);
  },

  // ホスト: CPU削除
  removeCPU: (playerId: string) => {
    const { players } = get();
    const player = players.find((p) => p.id === playerId);

    if (!player || player.type !== 'CPU') {
      return;
    }

    const updatedPlayers = players.filter((p) => p.id !== playerId);
    set({ players: updatedPlayers });

    // 全員にプレイヤーリストを送信
    get().broadcastPlayerList(updatedPlayers);
  },

  // ホスト: プレイヤー削除（切断）
  removePlayer: (playerId: string) => {
    const { players, hostManager } = get();
    const player = players.find((p) => p.id === playerId);

    if (!player) return;

    // ゲストの場合は接続を切断
    if (player.type === 'GUEST' && hostManager) {
      const connectionId = hostManager.getConnectionIdByPlayerId(playerId);
      if (connectionId) {
        hostManager.disconnectGuest(connectionId);
      }
    }

    const updatedPlayers = players.filter((p) => p.id !== playerId);
    set({ players: updatedPlayers });

    // 全員にプレイヤーリストを送信
    get().broadcastPlayerList(updatedPlayers);
  },

  // ゲスト: オファー受け入れ
  acceptOffer: async (offer: string) => {
    const { guestManager, localPlayerName } = get();
    if (!guestManager) {
      throw new Error('Not in guest mode');
    }

    set({ connectionState: 'connecting' });

    const answer = await guestManager.acceptOfferFromHost(offer);
    // JOINメッセージはonStateChangeで'connected'になったときに送信される

    return answer;
  },

  // ゲスト: ホストメッセージハンドラ設定
  setHostMessageHandler: (handler) => {
    set({ hostMessageHandler: handler });
  },

  // ゲスト: ホストにメッセージ送信
  sendToHost: (message) => {
    const { guestManager } = get();
    guestManager?.sendToHost(message);
  },

  // プレイヤー名変更
  setLocalPlayerName: (name: string) => {
    set({ localPlayerName: name });

    // プレイヤーリストも更新
    const { mode, players, localPlayerId } = get();
    if (mode === 'host') {
      const updatedPlayers = players.map((p) =>
        p.id === localPlayerId ? { ...p, name } : p
      );
      set({ players: updatedPlayers });

      // 全員にプレイヤーリストを送信
      get().broadcastPlayerList(updatedPlayers);
    }
  },

  // エラー設定
  setError: (error) => {
    set({ error });
  },

  // 全員にブロードキャスト
  broadcast: (message) => {
    const { hostManager } = get();
    hostManager?.broadcast(message);
  },

  // 特定プレイヤーに送信
  sendToPlayer: (playerId, message) => {
    const { hostManager } = get();
    hostManager?.sendToPlayer(playerId, message);
  },

  // プレイヤーリストを全ゲストに送信（各ゲストに自分のIDを通知）
  broadcastPlayerList: (players: NetworkPlayer[]) => {
    const hostId = get().localPlayerId;
    players.forEach((player) => {
      if (player.type === 'GUEST') {
        get().sendToPlayer(player.id, {
          type: 'PLAYER_LIST',
          players,
          hostId,
          yourPlayerId: player.id,
        });
      }
    });
  },

  // ゲーム開始可能判定
  canStartGame: () => {
    const { mode, players } = get();
    if (mode !== 'host') return false;

    // 2人以上のプレイヤーが必要
    return players.length >= 2;
  },
}));
