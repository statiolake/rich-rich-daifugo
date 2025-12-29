import { GameState } from '../../domain/game/GameState';
import { Player } from '../../domain/player/Player';
import { TriggerEffect } from './TriggerEffectAnalyzer';

/**
 * エフェクト適用時のコンテキスト
 */
export interface EffectContext {
  player?: Player;
  [key: string]: any;
}

/**
 * カットイン表示の設定
 */
export interface CutInConfig {
  getText: (gameState: GameState, context?: EffectContext) => string;
  variant: 'red' | 'blue' | 'green' | 'yellow' | 'gold';
  duration: number;
}

/**
 * エフェクト定義
 */
export interface EffectDefinition {
  apply: (gameState: GameState, context?: EffectContext) => void;
  cutIn: CutInConfig;
}

/**
 * すべてのトリガーエフェクトの定義マップ
 *
 * 各エフェクトについて:
 * - apply: ゲーム状態への適用ロジック
 * - cutIn: カットイン表示の設定
 */
export const EFFECT_DEFINITIONS: Record<TriggerEffect, EffectDefinition> = {
  '砂嵐': {
    apply: () => {
      console.log('砂嵐が発動しました！');
    },
    cutIn: {
      getText: () => '砂嵐！',
      variant: 'gold',
      duration: 250
    }
  },

  '革命': {
    apply: (gameState) => {
      gameState.isRevolution = !gameState.isRevolution;
      console.log(`革命が発生しました！ isRevolution: ${gameState.isRevolution}`);
    },
    cutIn: {
      getText: (gameState) => gameState.isRevolution ? '革命発生！' : '革命終了',
      variant: 'red',
      duration: 250
    }
  },

  '革命終了': {
    apply: (gameState) => {
      gameState.isRevolution = !gameState.isRevolution;
      console.log(`革命が発生しました！ isRevolution: ${gameState.isRevolution}`);
    },
    cutIn: {
      getText: (gameState) => gameState.isRevolution ? '革命発生！' : '革命終了',
      variant: 'red',
      duration: 250
    }
  },

  'イレブンバック': {
    apply: (gameState) => {
      gameState.isElevenBack = !gameState.isElevenBack;
      console.log(`11バックが発動しました！ isElevenBack: ${gameState.isElevenBack}`);
    },
    cutIn: {
      getText: (gameState) => gameState.isElevenBack ? '11バック発動！' : '11バック解除',
      variant: 'gold',
      duration: 250
    }
  },

  'イレブンバック解除': {
    apply: (gameState) => {
      gameState.isElevenBack = !gameState.isElevenBack;
      console.log(`11バックが発動しました！ isElevenBack: ${gameState.isElevenBack}`);
    },
    cutIn: {
      getText: (gameState) => gameState.isElevenBack ? '11バック発動！' : '11バック解除',
      variant: 'gold',
      duration: 250
    }
  },

  '4止め': {
    apply: () => {
      // 4止めの状態変更はhandlePlayで行う（エフェクト適用前）
    },
    cutIn: {
      getText: () => '4止め！',
      variant: 'green',
      duration: 250
    }
  },

  '8切り': {
    apply: (gameState) => {
      console.log('8切りが発動しました！');
      gameState.isEightCutPending = true;
    },
    cutIn: {
      getText: () => '8切り！',
      variant: 'blue',
      duration: 250
    }
  },

  '救急車': {
    apply: () => {
      console.log('救急車が発動しました！');
    },
    cutIn: {
      getText: () => '救急車！',
      variant: 'green',
      duration: 250
    }
  },

  'ろくろ首': {
    apply: () => {
      console.log('ろくろ首が発動しました！');
    },
    cutIn: {
      getText: () => 'ろくろ首！',
      variant: 'blue',
      duration: 250
    }
  },

  'エンペラー': {
    apply: (gameState) => {
      gameState.isRevolution = !gameState.isRevolution;
      console.log(`エンペラーが発動しました！ isRevolution: ${gameState.isRevolution}`);
    },
    cutIn: {
      getText: (gameState) => gameState.isRevolution ? 'エンペラー発動！' : 'エンペラー終了',
      variant: 'gold',
      duration: 250
    }
  },

  'エンペラー終了': {
    apply: (gameState) => {
      gameState.isRevolution = !gameState.isRevolution;
      console.log(`エンペラーが発動しました！ isRevolution: ${gameState.isRevolution}`);
    },
    cutIn: {
      getText: (gameState) => gameState.isRevolution ? 'エンペラー発動！' : 'エンペラー終了',
      variant: 'gold',
      duration: 250
    }
  },

  'クーデター': {
    apply: (gameState) => {
      gameState.isRevolution = !gameState.isRevolution;
      console.log(`クーデターが発動しました！ isRevolution: ${gameState.isRevolution}`);
    },
    cutIn: {
      getText: (gameState) => gameState.isRevolution ? 'クーデター発生！' : 'クーデター終了',
      variant: 'red',
      duration: 250
    }
  },

  'クーデター終了': {
    apply: (gameState) => {
      gameState.isRevolution = !gameState.isRevolution;
      console.log(`クーデターが発動しました！ isRevolution: ${gameState.isRevolution}`);
    },
    cutIn: {
      getText: (gameState) => gameState.isRevolution ? 'クーデター発生！' : 'クーデター終了',
      variant: 'red',
      duration: 250
    }
  },

  'オーメン': {
    apply: (gameState) => {
      gameState.isRevolution = !gameState.isRevolution;
      gameState.isOmenActive = true;
      console.log(`オーメンが発動しました！ isRevolution: ${gameState.isRevolution}, 以後革命なし`);
    },
    cutIn: {
      getText: () => 'オーメン発動！以後革命なし',
      variant: 'red',
      duration: 800
    }
  },

  '大革命＋即勝利': {
    apply: (gameState) => {
      gameState.isRevolution = !gameState.isRevolution;
      console.log(`大革命が発動しました！ isRevolution: ${gameState.isRevolution}`);
    },
    cutIn: {
      getText: () => '大革命発生！即勝利！',
      variant: 'gold',
      duration: 250
    }
  },

  '5スキップ': {
    apply: () => {
      console.log('5スキップが発動しました！');
    },
    cutIn: {
      getText: () => '5スキップ！',
      variant: 'green',
      duration: 250
    }
  },

  '7渡し': {
    apply: () => {
      // 7渡しは後で別途処理するため、ここではイベント発火のみ
    },
    cutIn: {
      getText: () => '7渡し！',
      variant: 'blue',
      duration: 250
    }
  },

  '10捨て': {
    apply: () => {
      // 10捨ては後で別途処理するため、ここではイベント発火のみ
    },
    cutIn: {
      getText: () => '10捨て！',
      variant: 'red',
      duration: 250
    }
  },

  'クイーンボンバー': {
    apply: () => {
      // クイーンボンバーは後で別途処理するため、ここではイベント発火のみ
    },
    cutIn: {
      getText: () => 'クイーンボンバー！',
      variant: 'red',
      duration: 250
    }
  },

  '9リバース': {
    apply: (gameState) => {
      gameState.isReversed = !gameState.isReversed;
      console.log(`9リバースが発動しました！ isReversed: ${gameState.isReversed}`);
    },
    cutIn: {
      getText: (gameState) => gameState.isReversed ? '9リバース発動！' : '9リバース解除',
      variant: 'green',
      duration: 250
    }
  },

  'スペ3返し': {
    apply: () => {
      console.log('スペ3返しが発動しました！');
    },
    cutIn: {
      getText: () => 'スペ3返し！',
      variant: 'blue',
      duration: 250
    }
  },

  'ダウンナンバー': {
    apply: () => {
      console.log('ダウンナンバーが発動しました！');
    },
    cutIn: {
      getText: () => 'ダウンナンバー！',
      variant: 'blue',
      duration: 250
    }
  },

  'ラッキーセブン': {
    apply: (gameState, context) => {
      console.log('ラッキーセブンが発動しました！');
      if (context?.player) {
        gameState.luckySeven = { playerId: context.player.id.value };
      }
    },
    cutIn: {
      getText: (_, context) => context?.player ? `${context.player.name} ラッキーセブン！` : 'ラッキーセブン！',
      variant: 'gold',
      duration: 250
    }
  },

  'マークしばり': {
    apply: (gameState, context) => {
      if (context?.suit) {
        gameState.suitLock = context.suit;
        console.log(`マークしばりが発動しました！（${context.suit}）`);
      }
    },
    cutIn: {
      getText: (_, context) => context?.suit ? `マークしばり！（${context.suit}）` : 'マークしばり！',
      variant: 'blue',
      duration: 250
    }
  },

  '数字しばり': {
    apply: (gameState) => {
      gameState.numberLock = true;
      console.log('数字しばりが発動しました！');
    },
    cutIn: {
      getText: () => '数字しばり！',
      variant: 'blue',
      duration: 250
    }
  }
};
