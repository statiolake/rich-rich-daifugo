import { GameState } from '../../domain/game/GameState';
import { Play, PlayType } from '../../domain/card/Play';
import { GameEventEmitter } from '../../domain/events/GameEventEmitter';

/**
 * 制約チェッカー
 *
 * マークしばり（suit lock）と数字しばり（number lock）の判定と適用を担当する。
 * これらの制約はプレイ後に自動的にチェックされ、条件を満たせば発動する。
 */
export class ConstraintChecker {
  constructor(private eventBus?: GameEventEmitter) {}

  /**
   * マークしばりのチェックと設定
   * 同じマークが2回連続で出されたら縛りが発動する
   */
  updateSuitLock(gameState: GameState, play: Play): void {
    // ルールが無効の場合はスキップ
    if (!gameState.ruleSettings.suitLock) {
      return;
    }

    const history = gameState.field.getHistory();
    if (history.length >= 2) {
      const prevPlayHistory = history[history.length - 2];
      const currentPlayHistory = history[history.length - 1];

      // 両方のプレイがすべて同じマークか確認
      const prevSuit = prevPlayHistory.play.cards.length > 0 ? prevPlayHistory.play.cards[0].suit : null;
      const currentSuit = currentPlayHistory.play.cards.length > 0 ? currentPlayHistory.play.cards[0].suit : null;

      const prevAllSameSuit = prevPlayHistory.play.cards.every(c => c.suit === prevSuit);
      const currentAllSameSuit = currentPlayHistory.play.cards.every(c => c.suit === currentSuit);

      // 連続で同じマークが出されたら縛り発動
      if (prevAllSameSuit && currentAllSameSuit && prevSuit === currentSuit && prevSuit && !gameState.suitLock) {
        gameState.suitLock = prevSuit;
        console.log(`マークしばりが発動しました！（${prevSuit}）`);

        // イベント発火
        this.eventBus?.emit('suitLock:triggered', { suit: prevSuit });
      }
    }
  }

  /**
   * 数字しばりのチェックと設定
   * 階段が2回連続で出されたら縛りが発動する
   */
  updateNumberLock(gameState: GameState, play: Play): void {
    // ルールが無効の場合はスキップ
    if (!gameState.ruleSettings.numberLock) {
      return;
    }

    const history = gameState.field.getHistory();
    if (history.length >= 2) {
      const prevPlayHistory = history[history.length - 2];
      const currentPlayHistory = history[history.length - 1];

      // 両方のプレイが階段か確認
      const prevIsStair = prevPlayHistory.play.type === PlayType.STAIR;
      const currentIsStair = currentPlayHistory.play.type === PlayType.STAIR;

      // 連続で階段が出されたら数字しばり発動
      if (prevIsStair && currentIsStair && !gameState.numberLock) {
        gameState.numberLock = true;
        console.log('数字しばりが発動しました！');

        // イベント発火
        this.eventBus?.emit('numberLock:triggered', {});
      }
    }
  }
}
