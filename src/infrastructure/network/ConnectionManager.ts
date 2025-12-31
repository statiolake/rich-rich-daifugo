/**
 * 複数のWebRTC接続を管理するマネージャー
 *
 * ホスト側：複数のゲストとの接続を管理
 * ゲスト側：ホストとの単一接続を管理
 */

import { WebRTCConnection, ConnectionEventHandlers } from './WebRTCConnection';
import {
  NetworkMessage,
  HostMessage,
  GuestMessage,
  NetworkPlayer,
  ConnectionState,
} from './NetworkProtocol';

export interface ConnectionInfo {
  connection: WebRTCConnection;
  playerId: string | null; // JOIN後に設定
  playerName: string | null;
  state: ConnectionState;
}

export interface ConnectionManagerEventHandlers {
  onGuestConnected?: (connectionId: string) => void;
  onGuestDisconnected?: (connectionId: string, playerId: string | null) => void;
  onGuestMessage?: (connectionId: string, message: GuestMessage) => void;
  onHostMessage?: (message: HostMessage) => void;
  onHostDisconnected?: () => void;
  onStateChange?: (state: ConnectionState) => void;
}

/**
 * ホスト側の接続マネージャー
 */
export class HostConnectionManager {
  private connections: Map<string, ConnectionInfo> = new Map();
  private handlers: ConnectionManagerEventHandlers = {};

  /**
   * イベントハンドラを設定
   */
  setHandlers(handlers: ConnectionManagerEventHandlers): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  /**
   * 新しいゲスト接続用のオファーを生成
   */
  async createOfferForGuest(): Promise<{ connectionId: string; offer: string }> {
    const connection = new WebRTCConnection();
    const connectionId = connection.getId();

    const connectionHandlers: ConnectionEventHandlers = {
      onMessage: (message) => {
        this.handlers.onGuestMessage?.(connectionId, message as GuestMessage);
      },
      onStateChange: (state) => {
        const info = this.connections.get(connectionId);
        if (info) {
          info.state = state;
          if (state === 'connected') {
            this.handlers.onGuestConnected?.(connectionId);
          } else if (state === 'disconnected') {
            this.handlers.onGuestDisconnected?.(connectionId, info.playerId);
            this.connections.delete(connectionId);
          }
        }
      },
      onError: (error) => {
        console.error(`[HostConnectionManager] Connection ${connectionId} error:`, error);
      },
    };

    connection.setHandlers(connectionHandlers);

    this.connections.set(connectionId, {
      connection,
      playerId: null,
      playerName: null,
      state: 'connecting',
    });

    const offer = await connection.createOffer();
    return { connectionId, offer };
  }

  /**
   * ゲストからのアンサーを受け入れ
   */
  async acceptAnswer(connectionId: string, answer: string): Promise<void> {
    const info = this.connections.get(connectionId);
    if (!info) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    await info.connection.acceptAnswer(answer);
  }

  /**
   * ゲストにプレイヤーIDを割り当て
   */
  assignPlayerId(connectionId: string, playerId: string, playerName: string): void {
    const info = this.connections.get(connectionId);
    if (info) {
      info.playerId = playerId;
      info.playerName = playerName;
    }
  }

  /**
   * 特定のゲストにメッセージを送信
   */
  sendToGuest(connectionId: string, message: HostMessage): void {
    const info = this.connections.get(connectionId);
    if (info && info.connection.isConnected()) {
      info.connection.send(message);
    }
  }

  /**
   * 特定のプレイヤーにメッセージを送信
   */
  sendToPlayer(playerId: string, message: HostMessage): void {
    for (const [, info] of this.connections) {
      if (info.playerId === playerId && info.connection.isConnected()) {
        info.connection.send(message);
        return;
      }
    }
  }

  /**
   * すべての接続中ゲストにメッセージをブロードキャスト
   */
  broadcast(message: HostMessage): void {
    for (const [, info] of this.connections) {
      if (info.connection.isConnected()) {
        info.connection.send(message);
      }
    }
  }

  /**
   * 接続情報からプレイヤーIDを取得
   */
  getPlayerIdByConnectionId(connectionId: string): string | null {
    return this.connections.get(connectionId)?.playerId ?? null;
  }

  /**
   * プレイヤーIDから接続IDを取得
   */
  getConnectionIdByPlayerId(playerId: string): string | null {
    for (const [connectionId, info] of this.connections) {
      if (info.playerId === playerId) {
        return connectionId;
      }
    }
    return null;
  }

  /**
   * 接続中のゲスト一覧を取得
   */
  getConnectedGuests(): NetworkPlayer[] {
    const guests: NetworkPlayer[] = [];
    for (const [, info] of this.connections) {
      if (info.connection.isConnected() && info.playerId && info.playerName) {
        guests.push({
          id: info.playerId,
          name: info.playerName,
          type: 'GUEST',
          isConnected: true,
        });
      }
    }
    return guests;
  }

  /**
   * 特定のゲスト接続を切断
   */
  disconnectGuest(connectionId: string): void {
    const info = this.connections.get(connectionId);
    if (info) {
      info.connection.close();
      this.connections.delete(connectionId);
    }
  }

  /**
   * すべての接続を閉じる
   */
  closeAll(): void {
    for (const [, info] of this.connections) {
      info.connection.close();
    }
    this.connections.clear();
  }

  /**
   * 接続数を取得
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * 接続中のゲスト数を取得
   */
  getConnectedCount(): number {
    let count = 0;
    for (const [, info] of this.connections) {
      if (info.connection.isConnected()) {
        count++;
      }
    }
    return count;
  }
}

/**
 * ゲスト側の接続マネージャー
 */
export class GuestConnectionManager {
  private connection: WebRTCConnection | null = null;
  private handlers: ConnectionManagerEventHandlers = {};
  private state: ConnectionState = 'disconnected';

  /**
   * イベントハンドラを設定
   */
  setHandlers(handlers: ConnectionManagerEventHandlers): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  /**
   * 現在の接続状態を取得
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * ホストのオファーを受け入れてアンサーを生成
   */
  async acceptOfferFromHost(offer: string): Promise<string> {
    this.connection = new WebRTCConnection();

    const connectionHandlers: ConnectionEventHandlers = {
      onMessage: (message) => {
        this.handlers.onHostMessage?.(message as HostMessage);
      },
      onStateChange: (state) => {
        this.state = state;
        this.handlers.onStateChange?.(state);
        if (state === 'disconnected') {
          this.handlers.onHostDisconnected?.();
        }
      },
      onError: (error) => {
        console.error(`[GuestConnectionManager] Connection error:`, error);
      },
    };

    this.connection.setHandlers(connectionHandlers);

    const answer = await this.connection.acceptOffer(offer);
    return answer;
  }

  /**
   * ホストにメッセージを送信
   */
  sendToHost(message: GuestMessage): void {
    if (this.connection && this.connection.isConnected()) {
      this.connection.send(message);
    }
  }

  /**
   * 接続が有効かどうか
   */
  isConnected(): boolean {
    return this.connection?.isConnected() ?? false;
  }

  /**
   * 接続を閉じる
   */
  close(): void {
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }
    this.state = 'disconnected';
  }
}
