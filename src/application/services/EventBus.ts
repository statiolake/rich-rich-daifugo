import { GameEventEmitter } from '../../core/domain/events/GameEventEmitter';

type EventHandler<T = any> = (data: T) => void;

export class EventBus implements GameEventEmitter {
  private listeners: Map<string, EventHandler[]> = new Map();

  /**
   * イベントリスナーを登録
   */
  on<T = any>(event: string, handler: EventHandler<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    this.listeners.get(event)!.push(handler);

    // リスナー解除関数を返す
    return () => this.off(event, handler);
  }

  /**
   * イベントリスナーを解除
   */
  off<T = any>(event: string, handler: EventHandler<T>): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;

    const index = handlers.indexOf(handler);
    if (index !== -1) {
      handlers.splice(index, 1);
    }
  }

  /**
   * イベントを発火
   */
  emit<T = any>(event: string, data: T): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;

    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    });
  }

  /**
   * すべてのリスナーをクリア
   */
  clear(): void {
    this.listeners.clear();
  }

  /**
   * 特定のイベントのリスナーをすべてクリア
   */
  clearEvent(event: string): void {
    this.listeners.delete(event);
  }
}

// イベント型定義
export interface GameEvents {
  'game:started': { gameState: any };
  'game:ended': { gameState: any };
  'phase:changed': { from: string; to: string; gameState: any };
  'player:played': { playerId: string; cards: any[] };
  'player:passed': { playerId: string };
  'player:finished': { playerId: string; position: number };
  'field:cleared': {};
  'revolution:triggered': { isRevolution: boolean };
  'state:updated': { gameState: any };
}
