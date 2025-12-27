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
  | 'ラッキーセブン';

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

    // 革命判定（4枚以上の同じ数字、またはルール設定による5枚以上の階段）
    // オーメンが有効な場合は革命が発動しない
    if (play.triggersRevolution && !gameState.isOmenActive) {
      effects.push(gameState.isRevolution ? '革命終了' : '革命');
    }

    // イレブンバック判定（Jが含まれている）
    if (this.triggersElevenBack(play)) {
      effects.push(gameState.isElevenBack ? 'イレブンバック解除' : 'イレブンバック');
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

    // 大革命判定（2x4で革命 + 即勝利）
    if (ruleSettings.greatRevolution && this.triggersGreatRevolution(play) && !gameState.isOmenActive) {
      effects.push('大革命＋即勝利');
    }

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
}
