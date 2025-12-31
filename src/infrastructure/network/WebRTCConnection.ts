/**
 * WebRTC接続のラッパークラス
 *
 * RTCPeerConnectionとDataChannelを管理し、
 * SDP/ICE候補のBase64エンコード/デコードを行う
 */

import {
  NetworkMessage,
  serializeMessage,
  deserializeMessage,
  ConnectionState,
  PROTOCOL_VERSION,
} from './NetworkProtocol';

// ICE候補収集完了を待つためのタイムアウト（ミリ秒）
const ICE_GATHERING_TIMEOUT = 5000;

export interface ConnectionEventHandlers {
  onMessage?: (message: NetworkMessage) => void;
  onStateChange?: (state: ConnectionState) => void;
  onError?: (error: Error) => void;
}

/**
 * シグナリングデータ（手動コピペ用）
 */
export interface SignalingData {
  sdp: RTCSessionDescriptionInit;
  candidates: RTCIceCandidateInit[];
  version: string;
}

/**
 * WebRTC P2P接続を管理するクラス
 */
export class WebRTCConnection {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private iceCandidates: RTCIceCandidateInit[] = [];
  private state: ConnectionState = 'disconnected';
  private handlers: ConnectionEventHandlers = {};
  private readonly connectionId: string;

  constructor(connectionId: string = crypto.randomUUID()) {
    this.connectionId = connectionId;
  }

  /**
   * 接続IDを取得
   */
  getId(): string {
    return this.connectionId;
  }

  /**
   * 現在の接続状態を取得
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * イベントハンドラを設定
   */
  setHandlers(handlers: ConnectionEventHandlers): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  /**
   * 接続状態を更新
   */
  private setState(newState: ConnectionState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.handlers.onStateChange?.(newState);
    }
  }

  /**
   * RTCPeerConnectionを初期化
   */
  private initPeerConnection(): RTCPeerConnection {
    // STUN/TURNサーバーの設定（公開STUNサーバーを使用）
    const config: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ],
    };

    const pc = new RTCPeerConnection(config);

    // ICE候補が見つかったらリストに追加
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.iceCandidates.push(event.candidate.toJSON());
      }
    };

    // 接続状態の変化を監視
    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state: ${pc.connectionState}`);
      switch (pc.connectionState) {
        case 'connected':
          this.setState('connected');
          break;
        case 'disconnected':
        case 'failed':
        case 'closed':
          this.setState('disconnected');
          break;
      }
    };

    // ICE接続状態の変化を監視
    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE state: ${pc.iceConnectionState}`);
    };

    return pc;
  }

  /**
   * DataChannelを設定
   */
  private setupDataChannel(channel: RTCDataChannel): void {
    this.dataChannel = channel;

    channel.onopen = () => {
      console.log(`[WebRTC] DataChannel opened`);
      this.setState('connected');
    };

    channel.onclose = () => {
      console.log(`[WebRTC] DataChannel closed`);
      this.setState('disconnected');
    };

    channel.onerror = (event) => {
      console.error(`[WebRTC] DataChannel error:`, event);
      this.handlers.onError?.(new Error('DataChannel error'));
    };

    channel.onmessage = (event) => {
      try {
        const message = deserializeMessage(event.data);
        this.handlers.onMessage?.(message);
      } catch (error) {
        console.error(`[WebRTC] Failed to parse message:`, error);
      }
    };
  }

  /**
   * ICE候補収集が完了するまで待つ
   */
  private waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        console.log(`[WebRTC] ICE gathering timeout, proceeding with collected candidates`);
        resolve();
      }, ICE_GATHERING_TIMEOUT);

      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete') {
          clearTimeout(timeout);
          resolve();
        }
      };
    });
  }

  /**
   * オファーを生成（ホスト側）
   *
   * @returns Base64エンコードされたシグナリングデータ
   */
  async createOffer(): Promise<string> {
    this.setState('connecting');
    this.iceCandidates = [];

    try {
      this.peerConnection = this.initPeerConnection();

      // DataChannelを作成（ホスト側）
      const channel = this.peerConnection.createDataChannel('game', {
        ordered: true,
      });
      this.setupDataChannel(channel);

      // オファーを作成
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      // ICE候補収集を待つ
      await this.waitForIceGathering(this.peerConnection);

      this.setState('waiting_for_answer');

      // シグナリングデータをBase64エンコード
      const signalingData: SignalingData = {
        sdp: this.peerConnection.localDescription!.toJSON(),
        candidates: this.iceCandidates,
        version: PROTOCOL_VERSION,
      };

      return btoa(JSON.stringify(signalingData));
    } catch (error) {
      this.setState('disconnected');
      throw error;
    }
  }

  /**
   * オファーを受け入れてアンサーを生成（ゲスト側）
   *
   * @param offerBase64 Base64エンコードされたオファー
   * @returns Base64エンコードされたアンサー
   */
  async acceptOffer(offerBase64: string): Promise<string> {
    this.setState('connecting');
    this.iceCandidates = [];

    try {
      // オファーをデコード
      const signalingData: SignalingData = JSON.parse(atob(offerBase64));

      // バージョンチェック
      if (signalingData.version !== PROTOCOL_VERSION) {
        console.warn(`[WebRTC] Protocol version mismatch: ${signalingData.version} vs ${PROTOCOL_VERSION}`);
      }

      this.peerConnection = this.initPeerConnection();

      // DataChannelの受信設定（ゲスト側）
      this.peerConnection.ondatachannel = (event) => {
        this.setupDataChannel(event.channel);
      };

      // リモートのSDPを設定
      await this.peerConnection.setRemoteDescription(signalingData.sdp);

      // ICE候補を追加
      for (const candidate of signalingData.candidates) {
        await this.peerConnection.addIceCandidate(candidate);
      }

      // アンサーを作成
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      // ICE候補収集を待つ
      await this.waitForIceGathering(this.peerConnection);

      // アンサーデータをBase64エンコード
      const answerData: SignalingData = {
        sdp: this.peerConnection.localDescription!.toJSON(),
        candidates: this.iceCandidates,
        version: PROTOCOL_VERSION,
      };

      return btoa(JSON.stringify(answerData));
    } catch (error) {
      this.setState('disconnected');
      throw error;
    }
  }

  /**
   * アンサーを受け入れて接続完了（ホスト側）
   *
   * @param answerBase64 Base64エンコードされたアンサー
   */
  async acceptAnswer(answerBase64: string): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('No pending offer');
    }

    try {
      // アンサーをデコード
      const signalingData: SignalingData = JSON.parse(atob(answerBase64));

      // リモートのSDPを設定
      await this.peerConnection.setRemoteDescription(signalingData.sdp);

      // ICE候補を追加
      for (const candidate of signalingData.candidates) {
        await this.peerConnection.addIceCandidate(candidate);
      }

      // 接続完了を待つ（DataChannelのonopenで状態が変わる）
    } catch (error) {
      this.setState('disconnected');
      throw error;
    }
  }

  /**
   * メッセージを送信
   */
  send(message: NetworkMessage): void {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      console.warn(`[WebRTC] Cannot send message: DataChannel not open`);
      return;
    }

    try {
      const data = serializeMessage(message);
      this.dataChannel.send(data);
    } catch (error) {
      console.error(`[WebRTC] Failed to send message:`, error);
      this.handlers.onError?.(error as Error);
    }
  }

  /**
   * 接続を閉じる
   */
  close(): void {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.iceCandidates = [];
    this.setState('disconnected');
  }

  /**
   * 接続が有効かどうか
   */
  isConnected(): boolean {
    return this.state === 'connected' && this.dataChannel?.readyState === 'open';
  }
}
