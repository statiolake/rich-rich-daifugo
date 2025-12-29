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

  '階段革命': {
    apply: (gameState) => {
      gameState.isRevolution = !gameState.isRevolution;
      console.log(`階段革命が発生しました！ isRevolution: ${gameState.isRevolution}`);
    },
    cutIn: {
      getText: (gameState) => gameState.isRevolution ? '階段革命！' : '階段革命終了',
      variant: 'red',
      duration: 250
    }
  },

  '階段革命終了': {
    apply: (gameState) => {
      gameState.isRevolution = !gameState.isRevolution;
      console.log(`階段革命が発生しました！ isRevolution: ${gameState.isRevolution}`);
    },
    cutIn: {
      getText: (gameState) => gameState.isRevolution ? '階段革命！' : '階段革命終了',
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

  '10飛び': {
    apply: () => {
      console.log('10飛びが発動しました！');
    },
    cutIn: {
      getText: () => '10飛び！',
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

  '7付け': {
    apply: () => {
      // 7付けは後で別途処理するため、ここではイベント発火のみ
    },
    cutIn: {
      getText: () => '7付け！',
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
  },

  '激縛り': {
    apply: (gameState, context) => {
      if (context?.suit) {
        gameState.suitLock = context.suit;
      }
      gameState.numberLock = true;
      console.log(`激縛りが発動しました！（${context?.suit || ''}＋連番）`);
    },
    cutIn: {
      getText: (_, context) => context?.suit ? `激縛り！（${context.suit}＋連番）` : '激縛り！',
      variant: 'red',
      duration: 300
    }
  },

  'Q解き': {
    apply: (gameState) => {
      gameState.suitLock = null;
      gameState.numberLock = false;
      console.log('Q解きが発動しました！縛りが解除されました');
    },
    cutIn: {
      getText: () => 'Q解き！縛り解除',
      variant: 'gold',
      duration: 300
    }
  },

  '6戻し': {
    apply: (gameState) => {
      gameState.isElevenBack = false;
      console.log('6戻しが発動しました！11バックが解除されました');
    },
    cutIn: {
      getText: () => '6戻し！11バック解除',
      variant: 'green',
      duration: 300
    }
  },

  'ナナサン革命': {
    apply: (gameState) => {
      gameState.isRevolution = !gameState.isRevolution;
      console.log(`ナナサン革命が発生しました！ isRevolution: ${gameState.isRevolution}`);
    },
    cutIn: {
      getText: (gameState) => gameState.isRevolution ? 'ナナサン革命！' : 'ナナサン革命終了',
      variant: 'red',
      duration: 250
    }
  },

  'ナナサン革命終了': {
    apply: (gameState) => {
      gameState.isRevolution = !gameState.isRevolution;
      console.log(`ナナサン革命が発生しました！ isRevolution: ${gameState.isRevolution}`);
    },
    cutIn: {
      getText: (gameState) => gameState.isRevolution ? 'ナナサン革命！' : 'ナナサン革命終了',
      variant: 'red',
      duration: 250
    }
  },

  '色縛り': {
    apply: (gameState, context) => {
      if (context?.color) {
        gameState.colorLock = context.color;
        console.log(`色縛りが発動しました！（${context.color === 'red' ? '赤' : '黒'}）`);
      }
    },
    cutIn: {
      getText: (_, context) => context?.color ? `色縛り！（${context.color === 'red' ? '赤' : '黒'}）` : '色縛り！',
      variant: 'blue',
      duration: 250
    }
  },

  'キングの行進': {
    apply: () => {
      // キングの行進は後で別途処理するため、ここではイベント発火のみ
      console.log('キングの行進が発動しました！');
    },
    cutIn: {
      getText: (_, context) => context?.kingCount ? `キングの行進！（${context.kingCount}枚回収）` : 'キングの行進！',
      variant: 'gold',
      duration: 300
    }
  },

  '33返し': {
    apply: () => {
      console.log('33返しが発動しました！');
    },
    cutIn: {
      getText: () => '33返し！',
      variant: 'gold',
      duration: 250
    }
  },

  '暗殺': {
    apply: () => {
      console.log('暗殺が発動しました！');
    },
    cutIn: {
      getText: () => '暗殺！',
      variant: 'red',
      duration: 250
    }
  },

  '5切り': {
    apply: (gameState) => {
      console.log('5切りが発動しました！');
      gameState.isEightCutPending = true;
    },
    cutIn: {
      getText: () => '5切り！',
      variant: 'blue',
      duration: 250
    }
  },

  '6切り': {
    apply: (gameState) => {
      console.log('6切りが発動しました！');
      gameState.isEightCutPending = true;
    },
    cutIn: {
      getText: () => '6切り！',
      variant: 'blue',
      duration: 250
    }
  },

  '7切り': {
    apply: (gameState) => {
      console.log('7切りが発動しました！');
      gameState.isEightCutPending = true;
    },
    cutIn: {
      getText: () => '7切り！',
      variant: 'blue',
      duration: 250
    }
  },

  'ジョーカー革命': {
    apply: (gameState) => {
      gameState.isRevolution = !gameState.isRevolution;
      console.log(`ジョーカー革命が発生しました！ isRevolution: ${gameState.isRevolution}`);
    },
    cutIn: {
      getText: (gameState) => gameState.isRevolution ? 'ジョーカー革命！' : 'ジョーカー革命終了',
      variant: 'gold',
      duration: 250
    }
  },

  'ジョーカー革命終了': {
    apply: (gameState) => {
      gameState.isRevolution = !gameState.isRevolution;
      console.log(`ジョーカー革命が発生しました！ isRevolution: ${gameState.isRevolution}`);
    },
    cutIn: {
      getText: (gameState) => gameState.isRevolution ? 'ジョーカー革命！' : 'ジョーカー革命終了',
      variant: 'gold',
      duration: 250
    }
  },

  'Qリバース': {
    apply: (gameState) => {
      gameState.isReversed = !gameState.isReversed;
      console.log(`Qリバースが発動しました！ isReversed: ${gameState.isReversed}`);
    },
    cutIn: {
      getText: (gameState) => gameState.isReversed ? 'Qリバース発動！' : 'Qリバース解除',
      variant: 'green',
      duration: 250
    }
  },

  'Kリバース': {
    apply: (gameState) => {
      gameState.isReversed = !gameState.isReversed;
      console.log(`Kリバースが発動しました！ isReversed: ${gameState.isReversed}`);
    },
    cutIn: {
      getText: (gameState) => gameState.isReversed ? 'Kリバース発動！' : 'Kリバース解除',
      variant: 'green',
      duration: 250
    }
  },

  'スペ2返し': {
    apply: () => {
      console.log('スペ2返しが発動しました！');
    },
    cutIn: {
      getText: () => 'スペ2返し！',
      variant: 'blue',
      duration: 250
    }
  },

  '2バック': {
    apply: (gameState) => {
      gameState.isTwoBack = !gameState.isTwoBack;
      console.log(`2バックが発動しました！ isTwoBack: ${gameState.isTwoBack}`);
    },
    cutIn: {
      getText: (gameState) => gameState.isTwoBack ? '2バック発動！' : '2バック解除',
      variant: 'blue',
      duration: 250
    }
  },

  'ゾンビ': {
    apply: () => {
      // ゾンビは後で別途処理するため、ここではイベント発火のみ
      console.log('ゾンビが発動しました！');
    },
    cutIn: {
      getText: () => 'ゾンビ！',
      variant: 'green',
      duration: 250
    }
  },

  'サタン': {
    apply: () => {
      // サタンは後で別途処理するため、ここではイベント発火のみ
      console.log('サタンが発動しました！');
    },
    cutIn: {
      getText: () => 'サタン！',
      variant: 'red',
      duration: 250
    }
  },

  '栗拾い': {
    apply: () => {
      // 栗拾いは後で別途処理するため、ここではイベント発火のみ
      console.log('栗拾いが発動しました！');
    },
    cutIn: {
      getText: (_, context) => context?.nineCount ? `栗拾い！（${context.nineCount}枚回収）` : '栗拾い！',
      variant: 'green',
      duration: 250
    }
  },

  '銀河鉄道999': {
    apply: () => {
      // 銀河鉄道999は後で別途処理するため、ここではイベント発火のみ
      console.log('銀河鉄道999が発動しました！');
    },
    cutIn: {
      getText: () => '銀河鉄道999！',
      variant: 'gold',
      duration: 300
    }
  },

  '黒7': {
    apply: () => {
      // 黒7は後で別途処理するため、ここではイベント発火のみ
      console.log('黒7が発動しました！');
    },
    cutIn: {
      getText: (_, context) => context?.blackSevenCount ? `黒7！（${context.blackSevenCount}枚回収）` : '黒7！',
      variant: 'blue',
      duration: 250
    }
  },

  '9クイック': {
    apply: () => {
      // 9クイックは後で別途処理するため、ここではイベント発火のみ
      console.log('9クイックが発動しました！');
    },
    cutIn: {
      getText: () => '9クイック！',
      variant: 'green',
      duration: 250
    }
  },

  '9戻し': {
    apply: () => {
      // 9戻しは後で別途処理するため、ここではイベント発火のみ
      console.log('9戻しが発動しました！');
    },
    cutIn: {
      getText: (_, context) => context?.nineCount ? `9戻し！（${context.nineCount}枚）` : '9戻し！',
      variant: 'blue',
      duration: 250
    }
  },

  '強化Jバック': {
    apply: (gameState) => {
      gameState.isElevenBack = true;
      gameState.elevenBackDuration = 2;
      console.log('強化Jバックが発動しました！11バックが2回場が流れるまで持続');
    },
    cutIn: {
      getText: () => '強化Jバック！（2回持続）',
      variant: 'gold',
      duration: 300
    }
  },

  'フリーメイソン': {
    apply: () => {
      console.log('フリーメイソンが発動しました！');
    },
    cutIn: {
      getText: () => 'フリーメイソン！',
      variant: 'green',
      duration: 250
    }
  },

  'ダミアン': {
    apply: (gameState) => {
      gameState.isDamianActive = true;
      console.log('ダミアンが発動しました！パスした人は敗北します');
    },
    cutIn: {
      getText: () => 'ダミアン！パスしたら敗北',
      variant: 'red',
      duration: 300
    }
  }
};
