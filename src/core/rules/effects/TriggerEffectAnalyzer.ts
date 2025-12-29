import { Play, PlayType } from '../../domain/card/Play';
import { GameState } from '../../domain/game/GameState';
import { Suit } from '../../domain/card/Card';

/**
 * トリガーエフェクトの種類
 */
export type TriggerEffect =
  | '砂嵐'
  | '革命'
  | '革命終了'
  | '階段革命'
  | '階段革命終了'
  | 'イレブンバック'
  | 'イレブンバック解除'
  | '4止め'
  | '8切り'
  | '救急車'
  | 'ろくろ首'
  | 'エンペラー'
  | 'エンペラー終了'
  | 'クーデター'
  | 'クーデター終了'
  | 'オーメン'
  | '大革命＋即勝利'
  | '5スキップ'
  | '7渡し'
  | '10捨て'
  | 'クイーンボンバー'
  | '9リバース'
  | 'スペ3返し'
  | 'ダウンナンバー'
  | 'ラッキーセブン'
  | 'マークしばり'
  | '数字しばり'
  | '激縛り'
  | 'Q解き'
  | '6戻し'
  | 'ナナサン革命'
  | 'ナナサン革命終了'
  | '色縛り'
  | 'キングの行進';

/**
 * トリガーエフェクトアナライザー
 * カードのプレイによって発動するエフェクトを判定する
 *
 * 設計方針：
 * - すべてのエフェクト発動条件のロジックをここに集約
 * - エフェクトの「検出」と「適用」を分離
 * - テスト可能な純粋関数として実装
 */
export class TriggerEffectAnalyzer {
  /**
   * プレイによって発動するすべてのエフェクトを分析
   */
  analyze(play: Play, gameState: GameState): TriggerEffect[] {
    const effects: TriggerEffect[] = [];
    const ruleSettings = gameState.ruleSettings;

    // 砂嵐判定（3x3が何にでも勝つ）
    if (ruleSettings.sandstorm && this.triggersSandstorm(play)) {
      effects.push('砂嵐');
    }

    // 革命判定 - 大革命が優先、通常革命・階段革命はその次
    if (!gameState.isOmenActive) {
      const isGreatRevolution = ruleSettings.greatRevolution && this.triggersGreatRevolution(play);

      if (isGreatRevolution) {
        effects.push('大革命＋即勝利');
      } else {
        // 4枚同数の革命
        const isQuadRevolution = this.triggersQuadRevolution(play);
        if (isQuadRevolution) {
          effects.push(gameState.isRevolution ? '革命終了' : '革命');
        }

        // 階段革命（4枚以上の階段）
        const isStairRevolution = ruleSettings.stairRevolution && this.triggersStairRevolution(play);
        if (isStairRevolution) {
          effects.push(gameState.isRevolution ? '階段革命終了' : '階段革命');
        }

        // ナナサン革命（7x3で革命）
        const isNanasanRevolution = ruleSettings.nanasanRevolution && this.triggersNanasanRevolution(play);
        if (isNanasanRevolution) {
          effects.push(gameState.isRevolution ? 'ナナサン革命終了' : 'ナナサン革命');
        }
      }
    }

    // イレブンバック判定（Jが含まれている）
    if (this.triggersElevenBack(play)) {
      effects.push(gameState.isElevenBack ? 'イレブンバック解除' : 'イレブンバック');
    }

    // 6戻し判定（11バック中に6を出すと解除）
    if (ruleSettings.sixReturn && this.triggersSixReturn(play, gameState)) {
      effects.push('6戻し');
    }

    // 4止め判定（8切りを止める）
    if (ruleSettings.fourStop && this.triggersFourStop(play) && gameState.isEightCutPending) {
      effects.push('4止め');
    }

    // 8切り判定（場をクリアする）
    if (ruleSettings.eightCut && this.triggersEightCut(play)) {
      effects.push('8切り');
    }

    // 救急車判定（9x2で場をクリア）
    if (ruleSettings.ambulance && this.triggersAmbulance(play)) {
      effects.push('救急車');
    }

    // ろくろ首判定（6x2で場をクリア）
    if (ruleSettings.rokurokubi && this.triggersRokurokubi(play)) {
      effects.push('ろくろ首');
    }

    // エンペラー判定（4種マーク連番で革命）
    if (ruleSettings.emperor && this.triggersEmperor(play)) {
      effects.push(gameState.isRevolution ? 'エンペラー終了' : 'エンペラー');
    }

    // クーデター判定（9x3で革命）
    if (ruleSettings.coup && this.triggersCoup(play)) {
      effects.push(gameState.isRevolution ? 'クーデター終了' : 'クーデター');
    }

    // オーメン判定（6x3で革命 + 以後革命なし）
    if (ruleSettings.omen && this.triggersOmen(play) && !gameState.isOmenActive) {
      effects.push('オーメン');
    }

    // 大革命判定は上記の革命判定ロジックに統合されています

    // 5スキップ判定
    if (ruleSettings.fiveSkip && this.triggersFiveSkip(play)) {
      effects.push('5スキップ');
    }

    // 7渡し判定
    if (ruleSettings.sevenPass && this.triggersSevenPass(play)) {
      effects.push('7渡し');
    }

    // 10捨て判定
    if (ruleSettings.tenDiscard && this.triggersTenDiscard(play)) {
      effects.push('10捨て');
    }

    // クイーンボンバー判定
    if (ruleSettings.queenBomber && this.triggersQueenBomber(play)) {
      effects.push('クイーンボンバー');
    }

    // 9リバース判定
    if (ruleSettings.nineReverse && this.triggersNineReverse(play)) {
      effects.push('9リバース');
    }

    // スペ3返し判定
    if (ruleSettings.spadeThreeReturn && this.triggersSpadeThreeReturn(play, gameState)) {
      effects.push('スペ3返し');
    }

    // ダウンナンバー判定
    if (ruleSettings.downNumber && this.triggersDownNumber(play, gameState)) {
      effects.push('ダウンナンバー');
    }

    // ラッキーセブン判定
    if (ruleSettings.luckySeven && this.triggersLuckySeven(play)) {
      effects.push('ラッキーセブン');
    }

    // Q解き判定（縛り中にQを出すと解除）
    if (ruleSettings.queenRelease && this.triggersQueenRelease(play, gameState)) {
      effects.push('Q解き');
    }

    // キングの行進判定（Kを出すと枚数分捨て札から回収）
    if (ruleSettings.kingsMarch && this.triggersKingsMarch(play, gameState)) {
      effects.push('キングの行進');
    }

    // 縛り判定
    const triggeredSuitLock = ruleSettings.suitLock && this.triggersSuitLock(play, gameState);
    const triggeredNumberLock = ruleSettings.numberLock && this.triggersNumberLock(play, gameState);
    const triggeredColorLock = ruleSettings.colorLock && this.triggersColorLock(play, gameState);

    // 激縛り判定（マーク縛りと数字縛りが同時に発動する）
    if (ruleSettings.strictLock && triggeredSuitLock && triggeredNumberLock) {
      effects.push('激縛り');
    } else {
      // マークしばり判定（同じマークが2回連続で出されると発動）
      if (triggeredSuitLock) {
        effects.push('マークしばり');
      }

      // 数字しばり判定（階段が2回連続で出されると発動）
      if (triggeredNumberLock) {
        effects.push('数字しばり');
      }
    }

    // 色縛り判定（同じ色が2回連続で出されると発動）
    if (triggeredColorLock) {
      effects.push('色縛り');
    }

    return effects;
  }

  // ========== 個別のトリガー判定メソッド ==========

  private triggersSandstorm(play: Play): boolean {
    return play.type === PlayType.TRIPLE && play.cards.every(card => card.rank === '3');
  }

  private triggersElevenBack(play: Play): boolean {
    return play.cards.some(card => card.rank === 'J');
  }

  private triggersEightCut(play: Play): boolean {
    return play.cards.some(card => card.rank === '8');
  }

  private triggersAmbulance(play: Play): boolean {
    return play.type === PlayType.PAIR && play.cards.every(card => card.rank === '9');
  }

  private triggersRokurokubi(play: Play): boolean {
    return play.type === PlayType.PAIR && play.cards.every(card => card.rank === '6');
  }

  private triggersEmperor(play: Play): boolean {
    return play.type === PlayType.EMPEROR;
  }

  private triggersCoup(play: Play): boolean {
    return play.type === PlayType.TRIPLE && play.cards.every(card => card.rank === '9');
  }

  private triggersOmen(play: Play): boolean {
    return play.type === PlayType.TRIPLE && play.cards.every(card => card.rank === '6');
  }

  private triggersGreatRevolution(play: Play): boolean {
    return play.type === PlayType.QUAD && play.cards.every(card => card.rank === '2');
  }

  private triggersQuadRevolution(play: Play): boolean {
    // 4枚の同じ数字（QUAD）
    return play.type === PlayType.QUAD;
  }

  private triggersStairRevolution(play: Play): boolean {
    // 4枚以上の階段（STAIR）
    return play.type === PlayType.STAIR && play.cards.length >= 4;
  }

  private triggersNanasanRevolution(play: Play): boolean {
    // 7を3枚出すと革命
    return play.type === PlayType.TRIPLE && play.cards.every(card => card.rank === '7');
  }

  private triggersFourStop(play: Play): boolean {
    return play.type === PlayType.PAIR && play.cards.every(card => card.rank === '4');
  }

  private triggersFiveSkip(play: Play): boolean {
    return play.cards.some(card => card.rank === '5');
  }

  private triggersNineReverse(play: Play): boolean {
    return play.cards.some(card => card.rank === '9');
  }

  private triggersSevenPass(play: Play): boolean {
    return play.cards.some(card => card.rank === '7');
  }

  private triggersTenDiscard(play: Play): boolean {
    return play.cards.some(card => card.rank === '10');
  }

  private triggersQueenBomber(play: Play): boolean {
    return play.cards.some(card => card.rank === 'Q');
  }

  private triggersQueenRelease(play: Play, gameState: GameState): boolean {
    // 縛り中でなければ発動しない
    if (!gameState.suitLock && !gameState.numberLock) return false;
    // Qを含んでいれば発動
    return play.cards.some(card => card.rank === 'Q');
  }

  private triggersSixReturn(play: Play, gameState: GameState): boolean {
    // 11バック中でなければ発動しない
    if (!gameState.isElevenBack) return false;
    // 6を含んでいれば発動
    return play.cards.some(card => card.rank === '6');
  }

  private triggersSpadeThreeReturn(play: Play, gameState: GameState): boolean {
    if (play.type !== PlayType.SINGLE) return false;
    if (play.cards[0].suit !== Suit.SPADE || play.cards[0].rank !== '3') return false;

    if (gameState.field.isEmpty()) return false;
    const fieldPlayHistory = gameState.field.getLastPlay();
    if (!fieldPlayHistory) return false;

    return fieldPlayHistory.play.cards.some(card => card.rank === 'JOKER');
  }

  private triggersDownNumber(play: Play, gameState: GameState): boolean {
    if (play.type !== PlayType.SINGLE) return false;
    if (gameState.field.isEmpty()) return false;

    const fieldPlayHistory = gameState.field.getLastPlay();
    if (!fieldPlayHistory || fieldPlayHistory.play.type !== PlayType.SINGLE) return false;

    const playCard = play.cards[0];
    const fieldCard = fieldPlayHistory.play.cards[0];

    return playCard.suit === fieldCard.suit && playCard.strength === fieldCard.strength - 1;
  }

  private triggersLuckySeven(play: Play): boolean {
    return play.type === PlayType.TRIPLE && play.cards.every(card => card.rank === '7');
  }

  private triggersKingsMarch(play: Play, gameState: GameState): boolean {
    // Kを含んでいて、捨て札がある場合に発動
    const hasKing = play.cards.some(card => card.rank === 'K');
    const hasDiscardPile = gameState.discardPile && gameState.discardPile.length > 0;
    return hasKing && hasDiscardPile;
  }

  /**
   * マークしばりが発動するかチェック
   * このプレイを出すと、前回と同じマークが2回連続になるか
   *
   * 注意: この関数は field.addPlay() の前に呼ばれる。
   * 今回のプレイは play 引数で渡され、前回のプレイは history[length - 1] で取得する。
   */
  private triggersSuitLock(play: Play, gameState: GameState): boolean {
    // 既に縛りが発動している場合は発動しない
    if (gameState.suitLock) return false;

    // 場に1枚以上の履歴が必要（前回のプレイ）
    const history = gameState.field.getHistory();
    if (history.length === 0) return false;

    // 前回のプレイ
    const prevPlayHistory = history[history.length - 1];

    // 前回のプレイがすべて同じマークか確認
    const prevSuit = prevPlayHistory.play.cards.length > 0 ? prevPlayHistory.play.cards[0].suit : null;
    if (!prevSuit) return false;
    const prevAllSameSuit = prevPlayHistory.play.cards.every(c => c.suit === prevSuit);
    if (!prevAllSameSuit) return false;

    // 今回のプレイがすべて同じマークか確認
    const currentSuit = play.cards.length > 0 ? play.cards[0].suit : null;
    if (!currentSuit) return false;
    const currentAllSameSuit = play.cards.every(c => c.suit === currentSuit);
    if (!currentAllSameSuit) return false;

    // 同じマークならマークしばり発動
    return prevSuit === currentSuit;
  }

  /**
   * 数字しばりが発動するかチェック
   * このプレイを出すと、前回と今回で階段が2回連続になるか
   *
   * 注意: この関数は field.addPlay() の前に呼ばれる。
   * 今回のプレイは play 引数で渡され、前回のプレイは history[length - 1] で取得する。
   */
  private triggersNumberLock(play: Play, gameState: GameState): boolean {
    // 既に縛りが発動している場合は発動しない
    if (gameState.numberLock) return false;

    // 場に1枚以上の履歴が必要（前回のプレイ）
    const history = gameState.field.getHistory();
    if (history.length === 0) return false;

    // 前回のプレイ
    const prevPlayHistory = history[history.length - 1];

    // 前回のプレイが階段か確認
    const prevIsStair = prevPlayHistory.play.type === PlayType.STAIR;
    if (!prevIsStair) return false;

    // 今回のプレイが階段か確認
    const currentIsStair = play.type === PlayType.STAIR;

    return currentIsStair;
  }

  /**
   * スートから色を取得
   */
  private getSuitColor(suit: Suit): 'red' | 'black' | null {
    if (suit === Suit.HEART || suit === Suit.DIAMOND) return 'red';
    if (suit === Suit.SPADE || suit === Suit.CLUB) return 'black';
    return null;
  }

  /**
   * 色縛りが発動するかチェック
   * このプレイを出すと、前回と同じ色が2回連続になるか
   *
   * 注意: この関数は field.addPlay() の前に呼ばれる。
   * 今回のプレイは play 引数で渡され、前回のプレイは history[length - 1] で取得する。
   */
  private triggersColorLock(play: Play, gameState: GameState): boolean {
    // 既に色縛りが発動している場合は発動しない
    if (gameState.colorLock) return false;

    // 場に1枚以上の履歴が必要（前回のプレイ）
    const history = gameState.field.getHistory();
    if (history.length === 0) return false;

    // 前回のプレイ
    const prevPlayHistory = history[history.length - 1];

    // 前回のプレイがすべて同じ色か確認
    const prevColor = prevPlayHistory.play.cards.length > 0 ? this.getSuitColor(prevPlayHistory.play.cards[0].suit) : null;
    if (!prevColor) return false;
    const prevAllSameColor = prevPlayHistory.play.cards.every(c => this.getSuitColor(c.suit) === prevColor);
    if (!prevAllSameColor) return false;

    // 今回のプレイがすべて同じ色か確認
    const currentColor = play.cards.length > 0 ? this.getSuitColor(play.cards[0].suit) : null;
    if (!currentColor) return false;
    const currentAllSameColor = play.cards.every(c => this.getSuitColor(c.suit) === currentColor);
    if (!currentAllSameColor) return false;

    // 同じ色なら色縛り発動
    return prevColor === currentColor;
  }
}
