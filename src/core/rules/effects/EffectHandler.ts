import { GameState } from '../../domain/game/GameState';
import { TriggerEffect } from './TriggerEffectAnalyzer';
import { EFFECT_DEFINITIONS, EffectContext } from './EffectDefinitions';
import { GameEventEmitter } from '../events/GameEventEmitter';

/**
 * エフェクトハンドラー
 *
 * トリガーエフェクトの適用とイベント発火を統一的に処理する。
 * すべてのエフェクトは EFFECT_DEFINITIONS から定義を取得し、
 * 統一的な 'effect:triggered' イベントを発火する。
 */
export class EffectHandler {
  constructor(private eventBus?: GameEventEmitter) {}

  /**
   * エフェクトを適用し、対応するイベントを発火する
   *
   * @param effect トリガーエフェクトの種類
   * @param gameState ゲーム状態
   * @param context エフェクト適用時のコンテキスト（プレイヤー情報など）
   */
  apply(effect: TriggerEffect, gameState: GameState, context?: EffectContext): void {
    const definition = EFFECT_DEFINITIONS[effect];
    if (!definition) {
      console.warn(`Unknown effect: ${effect}`);
      return;
    }

    // エフェクトをゲーム状態に適用
    definition.apply(gameState, context);

    // 統一形式でイベントを発火
    this.eventBus?.emit('effect:triggered', {
      effect,
      cutIn: {
        text: definition.cutIn.getText(gameState, context),
        variant: definition.cutIn.variant,
        duration: definition.cutIn.duration
      }
    });
  }
}
