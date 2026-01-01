/**
 * P2P通信プロトコル定義
 *
 * ホスト-ゲストモデル:
 * - ホスト: GameEngineを実行し、ゲームロジックを管理
 * - ゲスト: 状態を受信して表示、入力時のみアクション送信
 */

import { Suit, Rank } from '../../core/domain/card/Card';

// ============================================
// プレイヤー関連
// ============================================

export type NetworkPlayerType = 'HOST' | 'GUEST' | 'CPU';

export interface NetworkPlayer {
  id: string;
  name: string;
  type: NetworkPlayerType;
  isConnected: boolean;
}

// ============================================
// 入力リクエスト/レスポンス
// ============================================

/**
 * カード選択リクエスト
 */
export interface CardSelectionRequest {
  type: 'CARD_SELECTION';
  playerId: string;
  validCardIds: string[]; // 選択可能なカードのID
  canPass: boolean;
  timeoutMs: number;
}

/**
 * ランク選択リクエスト（クイーンボンバーなど）
 */
export interface RankSelectionRequest {
  type: 'RANK_SELECTION';
  playerId: string;
  availableRanks: string[];
  timeoutMs: number;
}

/**
 * スート選択リクエスト
 */
export interface SuitSelectionRequest {
  type: 'SUIT_SELECTION';
  playerId: string;
  availableSuits: Suit[];
  timeoutMs: number;
}

/**
 * カード交換リクエスト（大富豪→大貧民）
 */
export interface CardExchangeRequest {
  type: 'CARD_EXCHANGE';
  playerId: string;
  requiredCount: number;
  timeoutMs: number;
}

export type InputRequest =
  | CardSelectionRequest
  | RankSelectionRequest
  | SuitSelectionRequest
  | CardExchangeRequest;

/**
 * カード選択レスポンス
 */
export interface CardSelectionResponse {
  type: 'CARD_SELECTION';
  selectedCardIds: string[];
  isPass: boolean;
}

/**
 * ランク選択レスポンス
 */
export interface RankSelectionResponse {
  type: 'RANK_SELECTION';
  selectedRank: string;
}

/**
 * スート選択レスポンス
 */
export interface SuitSelectionResponse {
  type: 'SUIT_SELECTION';
  selectedSuit: Suit;
}

/**
 * カード交換レスポンス
 */
export interface CardExchangeResponse {
  type: 'CARD_EXCHANGE';
  selectedCardIds: string[];
}

export type InputResponse =
  | CardSelectionResponse
  | RankSelectionResponse
  | SuitSelectionResponse
  | CardExchangeResponse;

// ============================================
// プレイヤーアクション（ゲスト側GameEngine同期用）
// ============================================

/**
 * プレイヤーが実行したアクション
 * ホストがゲストに配信し、ゲスト側GameEngineを同期する
 */
export type PlayerAction =
  | { type: 'CARD_SELECTION'; cardIds: string[]; isPass: boolean }
  | { type: 'RANK_SELECTION'; rank: string }
  | { type: 'SUIT_SELECTION'; suit: Suit }
  | { type: 'CARD_EXCHANGE'; cardIds: string[] }
  | { type: 'PLAYER_SELECTION'; targetPlayerId: string };

// ============================================
// シリアライズされたゲーム状態
// ============================================

export interface SerializedCard {
  id: string;
  suit: Suit;
  rank: Rank;
  strength: number;
}

export interface SerializedPlayer {
  id: string;
  name: string;
  type: 'HUMAN' | 'CPU';
  handCardIds: string[]; // 手札のカードID（内容は自分のみ見える）
  handSize: number; // 手札枚数（全員に見える）
  rank: string | null;
  isFinished: boolean;
  finishPosition: number | null;
}

export interface SerializedFieldPlay {
  playerId: string;
  cardIds: string[];
  isPass: boolean;
}

export interface SerializedGameState {
  round: number;
  phase: string;
  currentPlayerIndex: number;
  players: SerializedPlayer[];
  fieldHistory: SerializedFieldPlay[];
  isRevolution: boolean;
  isReversed: boolean;
  isElevenBack: boolean;
  isTwoBack: boolean;
  suitLock: string | null;
  numberLock: boolean;
  colorLock: 'red' | 'black' | null;
  // すべてのカード情報（共有）
  allCards: SerializedCard[];
  // 自分の手札の詳細（ゲスト向け）
  myHandCards?: SerializedCard[];
}

// ============================================
// ホスト → ゲスト メッセージ
// ============================================

export interface PlayerListMessage {
  type: 'PLAYER_LIST';
  players: NetworkPlayer[];
  hostId: string;
  yourPlayerId?: string; // ゲストに自分のプレイヤーIDを通知
}

export interface GameStateMessage {
  type: 'GAME_STATE';
  state: SerializedGameState;
  targetPlayerId: string; // このメッセージの宛先プレイヤーID
}

export interface InputRequestMessage {
  type: 'INPUT_REQUEST';
  request: InputRequest;
}

export interface GameStartedMessage {
  type: 'GAME_STARTED';
  initialState: SerializedGameState;
}

export interface GameEndedMessage {
  type: 'GAME_ENDED';
  finalRankings: { playerId: string; rank: number }[];
}

export interface PlayerDisconnectedMessage {
  type: 'PLAYER_DISCONNECTED';
  playerId: string;
  replacedWithCPU: boolean;
}

export interface ErrorMessage {
  type: 'ERROR';
  code: string;
  message: string;
}

export interface PingMessage {
  type: 'PING';
  timestamp: number;
}

/**
 * プレイヤーがアクションを実行したことを通知
 * ゲスト側GameEngineを同期するために使用
 */
export interface ActionPerformedMessage {
  type: 'ACTION_PERFORMED';
  playerId: string;
  action: PlayerAction;
}

/**
 * 状態整合性チェック用ハッシュ
 * ホストが定期的に送信し、ゲストが不一致を検知したら完全同期をリクエスト
 */
export interface StateHashMessage {
  type: 'STATE_HASH';
  turnNumber: number;  // 現在のターン番号
  hash: string;        // 状態のハッシュ（簡易チェック用）
}

export type HostMessage =
  | PlayerListMessage
  | GameStateMessage
  | InputRequestMessage
  | GameStartedMessage
  | GameEndedMessage
  | PlayerDisconnectedMessage
  | ErrorMessage
  | PingMessage
  | ActionPerformedMessage
  | StateHashMessage;

// ============================================
// ゲスト → ホスト メッセージ
// ============================================

export interface JoinMessage {
  type: 'JOIN';
  playerName: string;
  version: string; // プロトコルバージョン
}

export interface InputResponseMessage {
  type: 'INPUT_RESPONSE';
  response: InputResponse;
}

export interface LeaveMessage {
  type: 'LEAVE';
  reason?: string;
}

export interface PongMessage {
  type: 'PONG';
  timestamp: number;
}

/**
 * 状態同期リクエスト
 * ゲストが状態の不整合を検知した場合にホストに送信
 */
export interface SyncRequestMessage {
  type: 'SYNC_REQUEST';
  reason: 'hash_mismatch' | 'timeout' | 'manual';
}

export type GuestMessage =
  | JoinMessage
  | InputResponseMessage
  | LeaveMessage
  | PongMessage
  | SyncRequestMessage;

// ============================================
// 共通メッセージ（双方向）
// ============================================

export type NetworkMessage = HostMessage | GuestMessage;

// ============================================
// 接続状態
// ============================================

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'waiting_for_answer'
  | 'connected';

// ============================================
// 定数
// ============================================

export const PROTOCOL_VERSION = '1.0.0';
export const DEFAULT_TIMEOUT_MS = 30000; // 30秒
export const PING_INTERVAL_MS = 5000; // 5秒
export const CONNECTION_TIMEOUT_MS = 60000; // 1分

// ============================================
// ユーティリティ
// ============================================

/**
 * メッセージをJSON文字列にシリアライズ
 */
export function serializeMessage(message: NetworkMessage): string {
  return JSON.stringify(message);
}

/**
 * JSON文字列からメッセージをデシリアライズ
 */
export function deserializeMessage(data: string): NetworkMessage {
  return JSON.parse(data) as NetworkMessage;
}
