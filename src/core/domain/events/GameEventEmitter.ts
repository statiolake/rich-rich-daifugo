/**
 * ゲームイベント発行インターフェース
 *
 * GameEngineがイベント通知の詳細実装に依存しないようにするための抽象化
 * EventBusなど任意のイベント通知機構を実装できる
 */
export interface GameEventEmitter {
  emit<T = any>(event: string, data: T): void;
}
