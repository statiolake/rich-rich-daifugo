import { Play, PlayType } from '../../domain/card/Play';
import { GameState } from '../../domain/game/GameState';
import { Suit } from '../../domain/card/Card';

/**
 * トリガーエフェクトの種類
 */
export type TriggerEffect =
  | '砂嵐'
  | '33返し'
  | '暗殺'
  | '革命'
  | '革命終了'
  | '階段革命'
  | '階段革命終了'
  | 'イレブンバック'
  | 'イレブンバック解除'
  | '4止め'
  | '8切り'
  | '5切り'
  | '6切り'
  | '7切り'
  | '救急車'
  | 'ろくろ首'
  | 'エンペラー'
  | 'エンペラー終了'
  | 'クーデター'
  | 'クーデター終了'
  | 'オーメン'
  | '大革命＋即勝利'
  | 'ジョーカー革命'
  | 'ジョーカー革命終了'
  | '5スキップ'
  | 'フリーメイソン'
  | '10飛び'
  | '7渡し'
  | '7付け'
  | '10捨て'
  | 'クイーンボンバー'
  | '9リバース'
  | 'Qリバース'
  | 'Kリバース'
  | 'スペ3返し'
  | 'スペ2返し'
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
  | 'キングの行進'
  | '2バック'
  | 'ゾンビ'
  | 'サタン'
  | '栗拾い'
  | '銀河鉄道999'
  | '黒7'
  | '9クイック'
  | '9戻し'
  | '強化Jバック'
  | 'ダミアン'
  | '5ピック'
  | '弱見せ'
  | '強見せ'
  | '暴君'
  | 'ジョーカー返し'
  | '7カウンター'
  | '偶数制限'
  | '奇数制限'
  | '10フリ'
  | '死者蘇生'
  | 'ジャンヌダルク'
  | 'ブラッディメアリ'
  | 'キング牧師'
  | 'Re:KING'
  | 'DEATH'
  | 'シーフ'
  | '2桁封じ'
  | 'ホットミルク'
  | 'ジョーカー請求'
  | 'Qラブ'
  | 'A税収'
  | 'ネロ'
  | '王の特権'
  | '5色縛り'
  | '威厳'
  | 'アーサー'
  | '赤い5'
  | '名誉革命'
  | '産業革命'
  | '死の宣告'
  | '闇市';

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

    // 33返し判定（3x3がジョーカー1枚を切れる）
    if (ruleSettings.tripleThreeReturn && this.triggersTripleThreeReturn(play, gameState)) {
      effects.push('33返し');
    }

    // 暗殺判定（2に対して3を出す、革命中は逆）
    if (ruleSettings.assassination && this.triggersAssassination(play, gameState)) {
      effects.push('暗殺');
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

        // ジョーカー革命（ジョーカー2枚同時で革命）
        const isJokerRevolution = ruleSettings.jokerRevolution && this.triggersJokerRevolution(play);
        if (isJokerRevolution) {
          effects.push(gameState.isRevolution ? 'ジョーカー革命終了' : 'ジョーカー革命');
        }
      }
    }

    // イレブンバック判定（Jが含まれている）
    if (this.triggersElevenBack(play)) {
      effects.push(gameState.isElevenBack ? 'イレブンバック解除' : 'イレブンバック');
    }

    // 強化Jバック判定（Jx3で11バックが2回場が流れるまで持続）
    if (ruleSettings.enhancedJBack && this.triggersEnhancedJBack(play)) {
      effects.push('強化Jバック');
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

    // 5切り判定（革命中に5を出すと場が流れる）
    if (ruleSettings.fiveCut && this.triggersFiveCut(play, gameState)) {
      effects.push('5切り');
    }

    // 6切り判定（革命中に6を出すと場が流れる）
    if (ruleSettings.sixCut && this.triggersSixCut(play, gameState)) {
      effects.push('6切り');
    }

    // 7切り判定（革命中に7を出すと場が流れる）
    if (ruleSettings.sevenCut && this.triggersSevenCut(play, gameState)) {
      effects.push('7切り');
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

    // フリーメイソン判定（6を1枚出すと次のプレイヤーをスキップ）
    if (ruleSettings.freemason && this.triggersFreemason(play)) {
      effects.push('フリーメイソン');
    }

    // 10飛び判定
    if (ruleSettings.tenSkip && this.triggersTenSkip(play)) {
      effects.push('10飛び');
    }

    // 7渡し判定
    if (ruleSettings.sevenPass && this.triggersSevenPass(play)) {
      effects.push('7渡し');
    }

    // 7付け判定
    if (ruleSettings.sevenAttach && this.triggersSevenAttach(play)) {
      effects.push('7付け');
    }

    // 9戻し判定（9を出すと枚数分のカードを直前のプレイヤーに渡す）
    if (ruleSettings.nineReturn && this.triggersNineReturn(play)) {
      effects.push('9戻し');
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

    // 9クイック判定（9を出すと続けてもう1回出せる）
    if (ruleSettings.nineQuick && this.triggersNineQuick(play)) {
      effects.push('9クイック');
    }

    // Qリバース判定
    if (ruleSettings.queenReverse && this.triggersQueenReverse(play)) {
      effects.push('Qリバース');
    }

    // Kリバース判定
    if (ruleSettings.kingReverse && this.triggersKingReverse(play)) {
      effects.push('Kリバース');
    }

    // スペ3返し判定
    if (ruleSettings.spadeThreeReturn && this.triggersSpadeThreeReturn(play, gameState)) {
      effects.push('スペ3返し');
    }

    // スペ2返し判定（革命中ジョーカーに対してスペード2で流せる）
    if (ruleSettings.spadeTwoReturn && this.triggersSpadeTwoReturn(play, gameState)) {
      effects.push('スペ2返し');
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

    // 2バック判定（2を出すと場が流れるまで強さ逆転）
    if (ruleSettings.twoBack && this.triggersTwoBack(play)) {
      effects.push('2バック');
    }

    // ゾンビ判定（3x3で捨て札から任意カードを次のプレイヤーに渡す）
    if (ruleSettings.zombie && this.triggersZombie(play, gameState)) {
      effects.push('ゾンビ');
    }

    // サタン判定（6x3で捨て札から任意カード1枚を回収）
    if (ruleSettings.satan && this.triggersSatan(play)) {
      effects.push('サタン');
    }

    // ダミアン判定（6x3で場が流れるまでパスした人は敗北）
    if (ruleSettings.damian && this.triggersDamian(play)) {
      effects.push('ダミアン');
    }

    // 栗拾い判定（9を出すと枚数分だけ捨て札から回収）
    if (ruleSettings.chestnutPicking && this.triggersChestnutPicking(play)) {
      effects.push('栗拾い');
    }

    // 銀河鉄道999判定（9x3で手札2枚を捨て、捨て札から2枚引く）
    if (ruleSettings.galaxyExpress999 && this.triggersGalaxyExpress999(play)) {
      effects.push('銀河鉄道999');
    }

    // 黒7判定（スペード7またはクラブ7を出すと、枚数分だけ捨て山からランダムにカードを引く）
    if (ruleSettings.blackSeven && this.triggersBlackSeven(play, gameState)) {
      effects.push('黒7');
    }

    // 5ピック判定（5を出すと枚数分だけ好きなプレイヤーの手札を見れる）
    if (ruleSettings.fivePick && this.triggersFivePick(play)) {
      effects.push('5ピック');
    }

    // 弱見せ判定（9を出すと次のプレイヤーの最弱カードを公開）
    if (ruleSettings.weakShow && this.triggersWeakShow(play)) {
      effects.push('弱見せ');
    }

    // 強見せ判定（6を出すと次のプレイヤーの最強カードを公開）
    if (ruleSettings.strongShow && this.triggersStrongShow(play)) {
      effects.push('強見せ');
    }

    // 暴君判定（2を出すと自分以外の全員が捨て札からランダムに1枚引く）
    if (ruleSettings.tyrant && this.triggersTyrant(play, gameState)) {
      effects.push('暴君');
    }

    // ジョーカー返し判定（ジョーカー1枚に対してもう1枚のジョーカーを重ねて出せる）
    if (ruleSettings.jokerReturn && this.triggersJokerReturn(play, gameState)) {
      effects.push('ジョーカー返し');
    }

    // 7カウンター判定（8切り発生時にスペード7を出すと8切りをキャンセル）
    if (ruleSettings.sevenCounter && this.triggersSevenCounter(play, gameState)) {
      effects.push('7カウンター');
    }

    // 偶数制限判定（4を出すと場が流れるまで偶数のみ出せる）
    if (ruleSettings.evenRestriction && this.triggersEvenRestriction(play)) {
      effects.push('偶数制限');
    }

    // 奇数制限判定（5を出すと場が流れるまで奇数のみ出せる）
    if (ruleSettings.oddRestriction && this.triggersOddRestriction(play)) {
      effects.push('奇数制限');
    }

    // 10フリ判定（10を出した後、次のプレイヤーはどんなカードでも出せる）
    if (ruleSettings.tenFree && this.triggersTenFree(play)) {
      effects.push('10フリ');
    }

    // 死者蘇生判定（4を出すと、直前に出されたカードを枚数分手札に加える）
    if (ruleSettings.resurrection && this.triggersResurrection(play, gameState)) {
      effects.push('死者蘇生');
    }

    // ジャンヌダルク判定（Qx3で次のプレイヤーが手札から最強カード2枚を捨てる）
    if (ruleSettings.jeanneDArc && this.triggersJeanneDArc(play)) {
      effects.push('ジャンヌダルク');
    }

    // ブラッディメアリ判定（Qx3で全員が手札から最強カード2枚を捨てる）
    if (ruleSettings.bloodyMary && this.triggersBloodyMary(play)) {
      effects.push('ブラッディメアリ');
    }

    // キング牧師判定（Kを出すと全員が右隣に任意カード1枚を渡す）
    if (ruleSettings.kingPastor && this.triggersKingPastor(play)) {
      effects.push('キング牧師');
    }

    // Re:KING判定（Kを出すと全員が捨て札からK枚数分ランダムに引く）
    if (ruleSettings.reKing && this.triggersReKing(play, gameState)) {
      effects.push('Re:KING');
    }

    // DEATH判定（4x3で全員が最強カードを捨てる）
    if (ruleSettings.death && this.triggersDeath(play)) {
      effects.push('DEATH');
    }

    // シーフ判定（4x3で次のプレイヤーから最強カードを奪う）
    if (ruleSettings.thief && this.triggersThief(play)) {
      effects.push('シーフ');
    }

    // 2桁封じ判定（6を出すと場が流れるまでJ〜Kが出せなくなる）
    if (ruleSettings.doubleDigitSeal && this.triggersDoubleDigitSeal(play)) {
      effects.push('2桁封じ');
    }

    // ホットミルク判定（3の上に9を出すとダイヤ/ハートのみ出せる）
    if (ruleSettings.hotMilk && this.triggersHotMilk(play, gameState)) {
      effects.push('ホットミルク');
    }

    // ジョーカー請求判定（4を出した時、次のプレイヤーがジョーカーを持っていれば発動）
    if (ruleSettings.jokerSeize && this.triggersJokerSeize(play, gameState)) {
      effects.push('ジョーカー請求');
    }

    // Qラブ判定（Q（階段以外）を出すと、枚数分だけ捨て札から回収＋連続ターン）
    if (ruleSettings.queenLove && this.triggersQueenLove(play, gameState)) {
      effects.push('Qラブ');
    }

    // A税収判定（子がAを出した時、直前のカードを手札に加え、次のプレイヤーをスキップ）
    if (ruleSettings.aceTax && this.triggersAceTax(play, gameState)) {
      effects.push('A税収');
    }

    // ネロ判定（Kx3で各対戦相手から最強カードを1枚ずつ奪う）
    if (ruleSettings.nero && this.triggersNero(play)) {
      effects.push('ネロ');
    }

    // 王の特権判定（Kx3で左隣のプレイヤーと手札を全交換する）
    if (ruleSettings.kingsPrivilege && this.triggersKingsPrivilege(play)) {
      effects.push('王の特権');
    }

    // 5色縛り判定（5を1枚出すとその色で縛り発動）
    if (ruleSettings.fiveColorLock && this.triggersFiveColorLock(play, gameState)) {
      effects.push('5色縛り');
    }

    // 威厳判定（J-Q-Kの階段で場が流れる）
    if (ruleSettings.dignity && this.triggersDignity(play)) {
      effects.push('威厳');
    }

    // アーサー判定（Kx3でジョーカーが10〜Jの間の強さになる）
    if (ruleSettings.arthur && this.triggersArthur(play)) {
      effects.push('アーサー');
    }

    // 赤い5判定（♥5/♦5を1枚出すと指名者と手札をシャッフルして同数に再配布）
    if (ruleSettings.redFive && this.triggersRedFive(play)) {
      effects.push('赤い5');
    }

    // 名誉革命判定（4x4で革命せず、大富豪を大貧民に転落）
    if (ruleSettings.gloriousRevolution && this.triggersGloriousRevolution(play)) {
      effects.push('名誉革命');
    }

    // 産業革命判定（3x4で全員の手札を見て1人1枚ずつ回収）
    if (ruleSettings.industrialRevolution && this.triggersIndustrialRevolution(play)) {
      effects.push('産業革命');
    }

    // 死の宣告判定（4x4で指名者は以降パスすると敗北）
    if (ruleSettings.deathSentence && this.triggersDeathSentence(play)) {
      effects.push('死の宣告');
    }

    // 闇市判定（Ax3で指名者と任意2枚⇔最強2枚を交換）
    if (ruleSettings.blackMarket && this.triggersBlackMarket(play)) {
      effects.push('闇市');
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

  private triggersFreemason(play: Play): boolean {
    // 6を含むプレイで発動
    return play.cards.some(card => card.rank === '6');
  }

  private triggersTenSkip(play: Play): boolean {
    return play.cards.some(card => card.rank === '10');
  }

  private triggersNineReverse(play: Play): boolean {
    return play.cards.some(card => card.rank === '9');
  }

  private triggersNineQuick(play: Play): boolean {
    return play.cards.some(card => card.rank === '9');
  }

  private triggersSevenPass(play: Play): boolean {
    return play.cards.some(card => card.rank === '7');
  }

  private triggersSevenAttach(play: Play): boolean {
    return play.cards.some(card => card.rank === '7');
  }

  private triggersNineReturn(play: Play): boolean {
    return play.cards.some(card => card.rank === '9');
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

  // ========== 新規追加のトリガー判定メソッド ==========

  /**
   * 33返し判定（3x3がジョーカー1枚を切れる）
   * 砂嵐とは別に、場にジョーカー1枚がある場合のみ発動
   */
  private triggersTripleThreeReturn(play: Play, gameState: GameState): boolean {
    // 3x3でなければ発動しない
    if (play.type !== PlayType.TRIPLE || !play.cards.every(card => card.rank === '3')) {
      return false;
    }
    // 場にジョーカー1枚がある場合のみ発動
    if (gameState.field.isEmpty()) return false;
    const fieldPlayHistory = gameState.field.getLastPlay();
    if (!fieldPlayHistory) return false;
    return fieldPlayHistory.play.type === PlayType.SINGLE &&
           fieldPlayHistory.play.cards[0].rank === 'JOKER';
  }

  /**
   * 暗殺判定（2に対して3を出す、革命中は逆）
   * 通常時: 2に対して3を出すと場を流せる
   * 革命中: 3に対して2を出すと場を流せる
   */
  private triggersAssassination(play: Play, gameState: GameState): boolean {
    if (play.type !== PlayType.SINGLE) return false;
    if (gameState.field.isEmpty()) return false;

    const fieldPlayHistory = gameState.field.getLastPlay();
    if (!fieldPlayHistory || fieldPlayHistory.play.type !== PlayType.SINGLE) return false;

    const playRank = play.cards[0].rank;
    const fieldRank = fieldPlayHistory.play.cards[0].rank;

    // 通常時: 2に対して3を出す
    // 革命中: 3に対して2を出す
    if (gameState.isRevolution) {
      return fieldRank === '3' && playRank === '2';
    } else {
      return fieldRank === '2' && playRank === '3';
    }
  }

  /**
   * ジョーカー革命判定（ジョーカー2枚同時で革命）
   */
  private triggersJokerRevolution(play: Play): boolean {
    return play.type === PlayType.PAIR &&
           play.cards.every(card => card.rank === 'JOKER');
  }

  /**
   * 5切り判定（革命中に5を出すと場が流れる）
   */
  private triggersFiveCut(play: Play, gameState: GameState): boolean {
    if (!gameState.isRevolution) return false;
    return play.cards.some(card => card.rank === '5');
  }

  /**
   * 6切り判定（革命中に6を出すと場が流れる）
   */
  private triggersSixCut(play: Play, gameState: GameState): boolean {
    if (!gameState.isRevolution) return false;
    return play.cards.some(card => card.rank === '6');
  }

  /**
   * 7切り判定（革命中に7を出すと場が流れる）
   */
  private triggersSevenCut(play: Play, gameState: GameState): boolean {
    if (!gameState.isRevolution) return false;
    return play.cards.some(card => card.rank === '7');
  }

  /**
   * Qリバース判定（Qを出すと席順が逆転）
   */
  private triggersQueenReverse(play: Play): boolean {
    return play.cards.some(card => card.rank === 'Q');
  }

  /**
   * Kリバース判定（Kを出すと席順が逆転）
   */
  private triggersKingReverse(play: Play): boolean {
    return play.cards.some(card => card.rank === 'K');
  }

  /**
   * スペ2返し判定（革命中ジョーカーに対してスペード2で流せる）
   */
  private triggersSpadeTwoReturn(play: Play, gameState: GameState): boolean {
    // 革命中でなければ発動しない
    if (!gameState.isRevolution) return false;
    // スペードの2でなければ発動しない
    if (play.type !== PlayType.SINGLE) return false;
    if (play.cards[0].suit !== Suit.SPADE || play.cards[0].rank !== '2') return false;
    // 場にジョーカーがある場合のみ発動
    if (gameState.field.isEmpty()) return false;
    const fieldPlayHistory = gameState.field.getLastPlay();
    if (!fieldPlayHistory) return false;
    return fieldPlayHistory.play.cards.some(card => card.rank === 'JOKER');
  }

  /**
   * 2バック判定（2を出すと場が流れるまで強さ逆転）
   */
  private triggersTwoBack(play: Play): boolean {
    return play.cards.some(card => card.rank === '2');
  }

  /**
   * ゾンビ判定（3x3で捨て札から任意カードを次のプレイヤーに渡す）
   */
  private triggersZombie(play: Play, gameState: GameState): boolean {
    // 3x3でなければ発動しない
    if (play.type !== PlayType.TRIPLE || !play.cards.every(card => card.rank === '3')) {
      return false;
    }
    // 捨て札がある場合のみ発動
    return gameState.discardPile && gameState.discardPile.length > 0;
  }

  /**
   * サタン判定（6x3で捨て札から任意カード1枚を回収）
   */
  private triggersSatan(play: Play): boolean {
    return play.type === PlayType.TRIPLE && play.cards.every(card => card.rank === '6');
  }

  /**
   * ダミアン判定（6x3で場が流れるまでパスした人は敗北）
   */
  private triggersDamian(play: Play): boolean {
    return play.type === PlayType.TRIPLE && play.cards.every(card => card.rank === '6');
  }

  /**
   * 栗拾い判定（9を出すと枚数分だけ捨て札から回収）
   */
  private triggersChestnutPicking(play: Play): boolean {
    return play.cards.some(card => card.rank === '9');
  }

  /**
   * 銀河鉄道999判定（9x3で手札2枚を捨て、捨て札から2枚引く）
   */
  private triggersGalaxyExpress999(play: Play): boolean {
    return play.type === PlayType.TRIPLE && play.cards.every(card => card.rank === '9');
  }

  /**
   * 黒7判定（スペード7またはクラブ7を出すと、枚数分だけ捨て山からランダムにカードを引く）
   */
  private triggersBlackSeven(play: Play, gameState: GameState): boolean {
    // スペード7またはクラブ7が含まれているか確認
    const hasBlackSeven = play.cards.some(
      card => card.rank === '7' && (card.suit === Suit.SPADE || card.suit === Suit.CLUB)
    );
    // 捨て札がある場合のみ発動
    const hasDiscardPile = gameState.discardPile && gameState.discardPile.length > 0;
    return hasBlackSeven && hasDiscardPile;
  }

  /**
   * 強化Jバック判定（Jx3で11バックが2回場が流れるまで持続）
   */
  private triggersEnhancedJBack(play: Play): boolean {
    return play.type === PlayType.TRIPLE && play.cards.every(card => card.rank === 'J');
  }

  /**
   * 5ピック判定（5を出すと枚数分だけ好きなプレイヤーの手札を見れる）
   */
  private triggersFivePick(play: Play): boolean {
    return play.cards.some(card => card.rank === '5');
  }

  /**
   * 弱見せ判定（9を出すと次のプレイヤーの最弱カードを公開）
   */
  private triggersWeakShow(play: Play): boolean {
    return play.cards.some(card => card.rank === '9');
  }

  /**
   * 強見せ判定（6を出すと次のプレイヤーの最強カードを公開）
   */
  private triggersStrongShow(play: Play): boolean {
    return play.cards.some(card => card.rank === '6');
  }

  /**
   * 暴君判定（2を出すと自分以外の全員が捨て札からランダムに1枚引く）
   */
  private triggersTyrant(play: Play, gameState: GameState): boolean {
    // 2を含むプレイで発動
    const hasTwo = play.cards.some(card => card.rank === '2');
    // 捨て札がある場合のみ発動
    const hasDiscardPile = gameState.discardPile && gameState.discardPile.length > 0;
    return hasTwo && hasDiscardPile;
  }

  /**
   * ジョーカー返し判定（ジョーカー1枚に対してもう1枚のジョーカーを重ねて出せる）
   * 場にジョーカー1枚があり、ジョーカー1枚を出す場合に発動
   */
  private triggersJokerReturn(play: Play, gameState: GameState): boolean {
    // 場が空なら発動しない
    if (gameState.field.isEmpty()) return false;

    // 場にジョーカー1枚があるか確認
    const fieldPlayHistory = gameState.field.getLastPlay();
    if (!fieldPlayHistory) return false;
    if (fieldPlayHistory.play.type !== PlayType.SINGLE) return false;
    if (fieldPlayHistory.play.cards[0].rank !== 'JOKER') return false;

    // プレイがジョーカー1枚か確認
    if (play.type !== PlayType.SINGLE) return false;
    if (play.cards[0].rank !== 'JOKER') return false;

    return true;
  }

  /**
   * 7カウンター判定（8切り発生時にスペード7を出すと8切りをキャンセル）
   */
  private triggersSevenCounter(play: Play, gameState: GameState): boolean {
    // 8切りが発動予定でなければ発動しない
    if (!gameState.isEightCutPending) return false;
    // スペード7が含まれているか確認
    return play.cards.some(card => card.rank === '7' && card.suit === Suit.SPADE);
  }

  /**
   * 偶数制限判定（4を出すと場が流れるまで偶数のみ出せる）
   */
  private triggersEvenRestriction(play: Play): boolean {
    return play.cards.some(card => card.rank === '4');
  }

  /**
   * 奇数制限判定（5を出すと場が流れるまで奇数のみ出せる）
   */
  private triggersOddRestriction(play: Play): boolean {
    return play.cards.some(card => card.rank === '5');
  }

  /**
   * 10フリ判定（10を出した後、次のプレイヤーはどんなカードでも出せる）
   */
  private triggersTenFree(play: Play): boolean {
    return play.cards.some(card => card.rank === '10');
  }

  /**
   * 死者蘇生判定（4を出すと、直前に出されたカードを枚数分手札に加える）
   * 場に直前のプレイがある場合のみ発動
   */
  private triggersResurrection(play: Play, gameState: GameState): boolean {
    // 4を含むプレイでなければ発動しない
    if (!play.cards.some(card => card.rank === '4')) {
      return false;
    }
    // 場に直前のプレイがある場合のみ発動
    if (gameState.field.isEmpty()) return false;
    const fieldPlayHistory = gameState.field.getLastPlay();
    return fieldPlayHistory !== null;
  }

  /**
   * ジャンヌダルク判定（Qx3で次のプレイヤーが手札から最強カード2枚を捨てる）
   */
  private triggersJeanneDArc(play: Play): boolean {
    return play.type === PlayType.TRIPLE && play.cards.every(card => card.rank === 'Q');
  }

  /**
   * ブラッディメアリ判定（Qx3で全員が手札から最強カード2枚を捨てる）
   */
  private triggersBloodyMary(play: Play): boolean {
    return play.type === PlayType.TRIPLE && play.cards.every(card => card.rank === 'Q');
  }

  /**
   * キング牧師判定（Kを出すと全員が右隣に任意カード1枚を渡す）
   */
  private triggersKingPastor(play: Play): boolean {
    return play.cards.some(card => card.rank === 'K');
  }

  /**
   * Re:KING判定（Kを出すと全員が捨て札からK枚数分ランダムに引く）
   * 捨て札がある場合のみ発動
   */
  private triggersReKing(play: Play, gameState: GameState): boolean {
    const hasKing = play.cards.some(card => card.rank === 'K');
    const hasDiscardPile = gameState.discardPile && gameState.discardPile.length > 0;
    return hasKing && hasDiscardPile;
  }

  /**
   * DEATH判定（4x3で全員が最強カードを捨てる）
   */
  private triggersDeath(play: Play): boolean {
    return play.type === PlayType.TRIPLE && play.cards.every(card => card.rank === '4');
  }

  /**
   * シーフ判定（4x3で次のプレイヤーから最強カードを奪う）
   */
  private triggersThief(play: Play): boolean {
    return play.type === PlayType.TRIPLE && play.cards.every(card => card.rank === '4');
  }

  /**
   * 2桁封じ判定（6を出すと場が流れるまでJ〜Kが出せなくなる）
   */
  private triggersDoubleDigitSeal(play: Play): boolean {
    return play.cards.some(card => card.rank === '6');
  }

  /**
   * ホットミルク判定（3の上に9を出すとダイヤ/ハートのみ出せる）
   */
  private triggersHotMilk(play: Play, gameState: GameState): boolean {
    // 9を含むプレイで発動
    if (!play.cards.some(card => card.rank === '9')) return false;
    // 場に3がある場合のみ発動
    if (gameState.field.isEmpty()) return false;
    const fieldPlayHistory = gameState.field.getLastPlay();
    if (!fieldPlayHistory) return false;
    return fieldPlayHistory.play.cards.some(card => card.rank === '3');
  }

  /**
   * ジョーカー請求判定（4を出した時、次のプレイヤーがジョーカーを持っていれば発動）
   * 注意: 次のプレイヤーがジョーカーを持っているかの判定はPlayPhase側で行う
   * ここでは4を出したかどうかのみ判定
   */
  private triggersJokerSeize(play: Play, _gameState: GameState): boolean {
    return play.cards.some(card => card.rank === '4');
  }

  /**
   * Qラブ判定（Q（階段以外）を出すと、枚数分だけ捨て札から回収＋連続ターン）
   * 階段で出した場合は発動しない
   */
  private triggersQueenLove(play: Play, _gameState: GameState): boolean {
    // 階段の場合は発動しない
    if (play.type === PlayType.STAIR) return false;
    // Qを含んでいなければ発動しない
    if (!play.cards.some(card => card.rank === 'Q')) return false;
    // 連続ターンは常に発動するので、Qを含むかのみ判定
    return true;
  }

  /**
   * A税収判定（子がAを出した時、直前のカードを手札に加え、次のプレイヤーをスキップ）
   * 条件:
   * 1. 場が空でない（子の出し = 親が出したカードに対して出している）
   * 2. Aを含むプレイ
   */
  private triggersAceTax(play: Play, gameState: GameState): boolean {
    // 場が空でない（子の出し）
    if (gameState.field.isEmpty()) return false;
    // Aを含むプレイ
    return play.cards.some(card => card.rank === 'A');
  }

  /**
   * ネロ判定（Kx3で各対戦相手から最強カードを1枚ずつ奪う）
   */
  private triggersNero(play: Play): boolean {
    return play.type === PlayType.TRIPLE && play.cards.every(card => card.rank === 'K');
  }

  /**
   * 王の特権判定（Kx3で左隣のプレイヤーと手札を全交換する）
   */
  private triggersKingsPrivilege(play: Play): boolean {
    return play.type === PlayType.TRIPLE && play.cards.every(card => card.rank === 'K');
  }

  /**
   * 5色縛り判定（5を1枚出すとその色で縛り発動）
   * 既に色縛りが発動している場合は発動しない
   */
  private triggersFiveColorLock(play: Play, gameState: GameState): boolean {
    // 既に色縛りが発動している場合は発動しない
    if (gameState.colorLock) return false;
    // ジョーカー以外のカードを取得
    const nonJokers = play.cards.filter(c => c.rank !== 'JOKER');
    // 5を1枚だけ出した場合のみ発動
    if (nonJokers.length !== 1) return false;
    return nonJokers[0].rank === '5';
  }

  /**
   * 威厳判定（J-Q-Kの階段で場が流れる）
   * 階段で、J/Q/Kがすべて含まれている場合に発動
   */
  private triggersDignity(play: Play): boolean {
    // 階段でなければ発動しない
    if (play.type !== PlayType.STAIR) return false;
    // ジョーカー以外のカードのランクを取得
    const ranks = play.cards.filter(c => c.rank !== 'JOKER').map(c => c.rank);
    // J, Q, K がすべて含まれていること
    return ranks.includes('J') && ranks.includes('Q') && ranks.includes('K');
  }

  /**
   * アーサー判定（Kx3でジョーカーが10〜Jの間の強さになる）
   */
  private triggersArthur(play: Play): boolean {
    return play.type === PlayType.TRIPLE && play.cards.every(card => card.rank === 'K');
  }

  /**
   * 赤い5判定（♥5/♦5を1枚出すと指名者と手札をシャッフルして同数に再配布）
   * 条件: SINGLEでハートまたはダイヤの5
   */
  private triggersRedFive(play: Play): boolean {
    if (play.type !== PlayType.SINGLE) return false;
    const card = play.cards[0];
    return card.rank === '5' && (card.suit === Suit.HEART || card.suit === Suit.DIAMOND);
  }

  /**
   * 名誉革命判定（4x4で革命せず、大富豪を大貧民に転落）
   * 条件: QUADで全て4
   */
  private triggersGloriousRevolution(play: Play): boolean {
    return play.type === PlayType.QUAD && play.cards.every(card => card.rank === '4');
  }

  /**
   * 闇市判定（Ax3で指名者と任意2枚⇔最強2枚を交換）
   * 条件: TRIPLEで全てA
   */
  private triggersBlackMarket(play: Play): boolean {
    return play.type === PlayType.TRIPLE && play.cards.every(card => card.rank === 'A');
  }

  /**
   * 産業革命判定（3x4で全員の手札を見て1人1枚ずつ回収）
   * 条件: QUADで全て3
   */
  private triggersIndustrialRevolution(play: Play): boolean {
    return play.type === PlayType.QUAD && play.cards.every(card => card.rank === '3');
  }

  /**
   * 死の宣告判定（4x4で指名者は以降パスすると敗北）
   * 条件: QUADで全て4
   */
  private triggersDeathSentence(play: Play): boolean {
    return play.type === PlayType.QUAD && play.cards.every(card => card.rank === '4');
  }
}
