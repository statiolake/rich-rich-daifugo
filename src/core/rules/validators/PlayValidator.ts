import { Card, Suit } from '../../domain/card/Card';
import { Player } from '../../domain/player/Player';
import { PlayAnalyzer, Play, PlayType } from '../../domain/card/Play';
import { RuleContext } from '../context/RuleContext';

/**
 * バリデーション結果
 */
export interface ValidationResult {
  valid: boolean;
  reason?: string;
  /** 発動するエフェクト（validの場合のみ有効） */
  triggeredEffects?: string[];
}

/**
 * プレイ検証クラス（統合版）
 *
 * すべてのプレイ検証ロジックを1箇所に集約。
 * ルールの相互作用が明示的で、実行順序の依存が明確。
 *
 * 設計方針:
 * - 大富豪のルールは相互に絡み合っている（革命→強さ反転、ダウンナンバー→制約スキップ）
 * - 無理に分割すると ValidationPipeline の実行順序に暗黙的な依存が生まれる
 * - 凝集度を優先し、適切にプライベートメソッドで分割された1つの大きなクラスとする
 */
export class PlayValidator {
  /**
   * カードプレイの検証（エントリーポイント）
   *
   * 検証順序:
   * 1. 所有権チェック
   * 2. 組み合わせチェック
   * 3. ダウンナンバーチェック（早期リターン - 制約・強さをスキップ）
   * 4. マークしばりチェック
   * 5. 数字しばりチェック
   * 6. 強さチェック
   * 7. 禁止上がりチェック
   */
  validate(
    player: Player,
    cards: Card[],
    context: RuleContext
  ): ValidationResult {
    // 1. 所有権チェック
    const ownershipResult = this.validateOwnership(player, cards);
    if (!ownershipResult.valid) return ownershipResult;

    // 2. 組み合わせチェック
    const combinationResult = this.validateCombination(cards, context);
    if (!combinationResult.valid) return combinationResult;

    // 3. ダウンナンバーチェック（早期リターン）
    // ダウンナンバーなら、以降の制約・強さチェックをスキップし、禁止上がりのみチェック
    if (this.isDownNumber(cards, context)) {
      return this.validateForbiddenFinish(player, cards, context);
    }

    // 4. マークしばりチェック
    if (context.ruleSettings.suitLock && context.suitLock) {
      const suitLockResult = this.validateSuitLock(cards, context.suitLock);
      if (!suitLockResult.valid) return suitLockResult;
    }

    // 5. 数字しばりチェック
    if (context.ruleSettings.numberLock && context.numberLock) {
      const numberLockResult = this.validateNumberLock(cards, context);
      if (!numberLockResult.valid) return numberLockResult;
    }

    // 6. 偶数/奇数制限チェック
    if (context.parityRestriction) {
      const parityResult = this.validateParityRestriction(cards, context.parityRestriction);
      if (!parityResult.valid) return parityResult;
    }

    // 7. 2桁封じチェック（J〜Kが出せない）
    if (context.ruleSettings.doubleDigitSeal && context.isDoubleDigitSealActive) {
      const doubleDigitSealResult = this.validateDoubleDigitSeal(cards);
      if (!doubleDigitSealResult.valid) return doubleDigitSealResult;
    }

    // 8. ホットミルクチェック（ダイヤ/ハートのみ）
    if (context.ruleSettings.hotMilk && context.hotMilkRestriction === 'warm') {
      const hotMilkResult = this.validateHotMilk(cards);
      if (!hotMilkResult.valid) return hotMilkResult;
    }

    // 9. 片縛りチェック（一部スートが一致した時のロック）
    if (context.ruleSettings.partialLock && context.partialLockSuits) {
      const partialLockResult = this.validatePartialLock(cards, context.partialLockSuits);
      if (!partialLockResult.valid) return partialLockResult;
    }

    // 10. 強さチェック
    const strengthResult = this.validateStrength(cards, context);
    if (!strengthResult.valid) return strengthResult;

    // 11. 禁止上がりチェック
    const forbiddenResult = this.validateForbiddenFinish(player, cards, context);
    if (!forbiddenResult.valid) return forbiddenResult;

    // 12. 仇討ち禁止令チェック
    const adauchiBanResult = this.validateAdauchiBan(player, cards, context);
    if (!adauchiBanResult.valid) return adauchiBanResult;

    // 13. 治安維持法チェック（革命を起こせるかどうか）
    const securityLawResult = this.validateSecurityLaw(cards, context);
    if (!securityLawResult.valid) return securityLawResult;

    // 強さチェックの理由を保持して返す
    return strengthResult;
  }

  // ========================================
  // Private: 各検証ロジック
  // ========================================

  /**
   * 所有権チェック: プレイヤーが選択したカードを所有しているか
   */
  private validateOwnership(player: Player, cards: Card[]): ValidationResult {
    const playerCardIds = new Set(player.hand.getCards().map(c => c.id));

    for (const card of cards) {
      if (!playerCardIds.has(card.id)) {
        return {
          valid: false,
          reason: 'そのカードは手札にありません',
        };
      }
    }

    return { valid: true, reason: '' };
  }

  /**
   * 組み合わせチェック: カードの組み合わせが有効な役か
   */
  private validateCombination(cards: Card[], context: RuleContext): ValidationResult {
    // 女装ルールチェック（QとKの混合出し）
    if (context.ruleSettings.crossDressing && this.isCrossDressing(cards)) {
      return { valid: true, reason: '女装' };
    }

    // 語呂合わせ革命チェック
    const goroawaseResult = this.validateGoroawaseCombination(cards, context);
    if (goroawaseResult) {
      return goroawaseResult;
    }

    const play = PlayAnalyzer.analyze(
      cards,
      context.ruleSettings.skipStair,
      context.ruleSettings.doubleStair,
      {
        enableTunnel: context.ruleSettings.tunnel,
        enableSpadeStair: context.ruleSettings.spadeStair,
      }
    );

    if (!play) {
      return {
        valid: false,
        reason: '無効なカードの組み合わせです',
      };
    }

    // 階段ルールがOFFの場合、階段は出せない
    if (!context.ruleSettings.stairs && play.type === PlayType.STAIR) {
      return {
        valid: false,
        reason: '階段は現在使用できません',
      };
    }

    // 飛び階段ルールがOFFの場合、飛び階段は出せない
    if (!context.ruleSettings.skipStair && play.type === PlayType.SKIP_STAIR) {
      return {
        valid: false,
        reason: '飛び階段は現在使用できません',
      };
    }

    // 二列階段ルールがOFFの場合、二列階段は出せない
    if (!context.ruleSettings.doubleStair && play.type === PlayType.DOUBLE_STAIR) {
      return {
        valid: false,
        reason: '二列階段は現在使用できません',
      };
    }

    return { valid: true, reason: '' };
  }

  /**
   * 女装判定（QとKの混合出し）
   * 条件: Q と K が同じ枚数ずつ含まれている（合計2N枚）
   */
  private isCrossDressing(cards: Card[]): boolean {
    if (cards.length < 2 || cards.length % 2 !== 0) return false;

    const queens = cards.filter(c => c.rank === 'Q');
    const kings = cards.filter(c => c.rank === 'K');

    // QとKが同じ枚数で、それ以外のカードがないこと
    return queens.length > 0 && queens.length === kings.length && queens.length + kings.length === cards.length;
  }

  /**
   * ダウンナンバー判定
   * 同じスートで強さが1つ下かどうか
   */
  private isDownNumber(cards: Card[], context: RuleContext): boolean {
    if (!context.ruleSettings.downNumber) return false;
    if (context.field.isEmpty()) return false;
    if (cards.length !== 1) return false;

    const fieldPlay = context.field.getCurrentPlay();
    if (!fieldPlay || fieldPlay.type !== PlayType.SINGLE) return false;

    const playCard = cards[0];
    const fieldCard = fieldPlay.cards[0];

    return (
      playCard.suit === fieldCard.suit &&
      playCard.strength === fieldCard.strength - 1
    );
  }

  /**
   * マークしばりチェック
   */
  private validateSuitLock(cards: Card[], lockedSuit: string): ValidationResult {
    const allSameSuit = cards.every(card => card.suit === lockedSuit);
    if (!allSameSuit) {
      return {
        valid: false,
        reason: `マークしばりが発動中です（${lockedSuit}のみ）`,
      };
    }
    return { valid: true, reason: '' };
  }

  /**
   * 数字しばりチェック
   * 階段系のプレイタイプ（STAIR, SKIP_STAIR, DOUBLE_STAIR, TUNNEL, SPADE_STAIR）を許可
   */
  private validateNumberLock(cards: Card[], context: RuleContext): ValidationResult {
    const play = PlayAnalyzer.analyze(
      cards,
      context.ruleSettings.skipStair,
      context.ruleSettings.doubleStair,
      {
        enableTunnel: context.ruleSettings.tunnel,
        enableSpadeStair: context.ruleSettings.spadeStair,
      }
    );
    const stairTypes = [PlayType.STAIR, PlayType.SKIP_STAIR, PlayType.DOUBLE_STAIR, PlayType.TUNNEL, PlayType.SPADE_STAIR];
    if (!play || !stairTypes.includes(play.type)) {
      return {
        valid: false,
        reason: '数字しばりが発動中です（階段のみ）',
      };
    }
    return { valid: true, reason: '' };
  }

  /**
   * 偶数/奇数制限チェック
   * 偶数制限: 偶数のみ（4, 6, 8, 10, Q）
   * 奇数制限: 奇数のみ（3, 5, 7, 9, J, K, A）
   * 2とJokerは特殊扱いで常に出せる
   */
  private validateParityRestriction(cards: Card[], restriction: 'even' | 'odd'): ValidationResult {
    // 偶数ランク: 4, 6, 8, 10, Q
    const evenRanks = ['4', '6', '8', '10', 'Q'];
    // 奇数ランク: 3, 5, 7, 9, J, K, A
    const oddRanks = ['3', '5', '7', '9', 'J', 'K', 'A'];
    // 特殊ランク（常に出せる）: 2, JOKER
    const specialRanks = ['2', 'JOKER'];

    const allowedRanks = restriction === 'even' ? evenRanks : oddRanks;
    const restrictionName = restriction === 'even' ? '偶数制限' : '奇数制限';

    for (const card of cards) {
      // 特殊カードは常に許可
      if (specialRanks.includes(card.rank)) continue;
      // 許可されたランクかチェック
      if (!allowedRanks.includes(card.rank)) {
        return {
          valid: false,
          reason: `${restrictionName}が発動中です（${restriction === 'even' ? '偶数' : '奇数'}のみ）`,
        };
      }
    }
    return { valid: true, reason: '' };
  }

  /**
   * 2桁封じチェック
   * J(11), Q(12), K(13) が出せなくなる
   * Aと2は出せる（Aは14、2は15として扱われるが2桁ではない）
   */
  private validateDoubleDigitSeal(cards: Card[]): ValidationResult {
    // 2桁封じ対象ランク: J, Q, K（11〜13）
    const sealedRanks = ['J', 'Q', 'K'];

    for (const card of cards) {
      if (sealedRanks.includes(card.rank)) {
        return {
          valid: false,
          reason: '2桁封じが発動中です（J〜Kは出せません）',
        };
      }
    }
    return { valid: true, reason: '' };
  }

  /**
   * ホットミルクチェック
   * ダイヤ（DIAMOND）とハート（HEART）のみ出せる
   * Jokerは許可
   */
  private validateHotMilk(cards: Card[]): ValidationResult {
    // 許可されるスート: DIAMOND, HEART（赤色）
    const warmSuits = [Suit.DIAMOND, Suit.HEART];

    for (const card of cards) {
      // Jokerは常に許可
      if (card.rank === 'JOKER') continue;
      // ダイヤかハートかチェック
      if (!warmSuits.includes(card.suit)) {
        return {
          valid: false,
          reason: 'ホットミルクが発動中です（ダイヤ/ハートのみ）',
        };
      }
    }
    return { valid: true, reason: '' };
  }

  /**
   * 片縛りチェック
   * 出されたカードが片縛りスートのいずれかを含むか確認
   */
  private validatePartialLock(cards: Card[], lockedSuits: string[]): ValidationResult {
    // ジョーカー以外のカードのスートを取得
    const cardSuits = cards
      .filter(card => card.rank !== 'JOKER')
      .map(card => card.suit);

    // いずれかの片縛りスートを含んでいるかチェック
    const hasLockedSuit = cardSuits.some(suit => lockedSuits.includes(suit));

    if (!hasLockedSuit) {
      return {
        valid: false,
        reason: `片縛りが発動中です（${lockedSuits.join('または')}を含む必要があります）`,
      };
    }
    return { valid: true, reason: '' };
  }

  /**
   * 強さチェック
   */
  private validateStrength(cards: Card[], context: RuleContext): ValidationResult {
    // 場が空ならどんなカードでも出せる
    if (context.field.isEmpty()) {
      return { valid: true, reason: '' };
    }

    // 10フリ状態ならどんなカードでも出せる（強さ制限なし）
    if (context.ruleSettings.tenFree && context.isTenFreeActive) {
      return { valid: true, reason: '10フリ' };
    }

    // 切り札/ドラチェック: 切り札のランクは最強（場にある他のカードに勝つ）
    if (context.ruleSettings.trump && context.trumpRank) {
      const trumpResult = this.validateTrumpStrength(cards, context);
      if (trumpResult !== null) {
        return trumpResult;
      }
    }

    // 融合革命チェック（場札＋手札で4枚以上で革命）
    if (context.ruleSettings.fusionRevolution && this.isFusionRevolution(cards, context)) {
      return { valid: true, reason: '融合革命' };
    }

    // 追革チェック（場のペアと同数字ペアを重ねると革命）
    if (context.ruleSettings.tsuiKaku && this.isTsuiKaku(cards, context)) {
      return { valid: true, reason: '追革' };
    }

    // 女装の場合は特別な強さチェック
    if (context.ruleSettings.crossDressing && this.isCrossDressing(cards)) {
      return this.validateCrossDressingStrength(cards, context);
    }

    const currentPlay = PlayAnalyzer.analyze(
      cards,
      context.ruleSettings.skipStair,
      context.ruleSettings.doubleStair,
      {
        enableTunnel: context.ruleSettings.tunnel,
        enableSpadeStair: context.ruleSettings.spadeStair,
      }
    );
    const fieldPlay = context.field.getCurrentPlay();

    // currentPlay または fieldPlay が null の場合はエラー
    // isEmpty チェックを通過しているはずだが、同期ずれ等の防御
    if (!currentPlay || !fieldPlay) {
      console.error('[PlayValidator] Unexpected null: currentPlay=', !!currentPlay, 'fieldPlay=', !!fieldPlay);
      return { valid: false, reason: '内部エラー: プレイの解析に失敗しました' };
    }

    // 砂嵐チェック: 3のスリーカードは何にでも勝つ（ルールがONの場合のみ）
    if (context.ruleSettings.sandstorm) {
      const isSandstorm = this.isSandstorm(currentPlay);
      if (isSandstorm) {
        // タイプが同じか確認（スリーカードにはスリーカードで対抗）
        if (fieldPlay.type !== currentPlay.type) {
          return {
            valid: false,
            reason: '場のカードと同じタイプの組み合わせを出してください',
          };
        }
        return { valid: true, reason: '砂嵐' };
      }

      // 場に砂嵐がある場合、3のスリーカード以外は出せない
      if (this.isSandstorm(fieldPlay)) {
        return {
          valid: false,
          reason: '砂嵐には3のスリーカードでしか対抗できません',
        };
      }
    }

    // スぺ3返しチェック: スペードの3がJokerに勝つ（ルールがONの場合のみ）
    if (context.ruleSettings.spadeThreeReturn && this.isSpadeThree(currentPlay) && this.isJoker(fieldPlay)) {
      return { valid: true, reason: 'スぺ3返し' };
    }

    // スペ階チェック: ♠2→Joker→♠3の最強階段（どの階段にも勝つ）
    if (context.ruleSettings.spadeStair && currentPlay.type === PlayType.SPADE_STAIR) {
      // 場が3枚の階段系なら出せる
      const stairTypes = [PlayType.STAIR, PlayType.SKIP_STAIR, PlayType.TUNNEL, PlayType.SPADE_STAIR];
      if (stairTypes.includes(fieldPlay.type) && fieldPlay.cards.length === 3) {
        return { valid: true, reason: 'スペ階' };
      }
      return {
        valid: false,
        reason: '場のカードと同じタイプの組み合わせを出してください',
      };
    }

    // 場にスペ階がある場合、スペ階以外は出せない
    if (fieldPlay.type === PlayType.SPADE_STAIR) {
      if (currentPlay.type !== PlayType.SPADE_STAIR) {
        return {
          valid: false,
          reason: 'スペ階には対抗できません',
        };
      }
    }

    // トンネルチェック: A→2→3の最弱階段（どの階段にも負ける）
    if (context.ruleSettings.tunnel && currentPlay.type === PlayType.TUNNEL) {
      // 場が3枚の階段系なら負ける（トンネルは最弱なので他の階段には出せない）
      const stairTypes = [PlayType.STAIR, PlayType.SKIP_STAIR, PlayType.SPADE_STAIR];
      if (stairTypes.includes(fieldPlay.type) && fieldPlay.cards.length === 3) {
        return {
          valid: false,
          reason: 'トンネルは最弱の階段です',
        };
      }
      // 場がトンネルの場合は、他のトンネルには勝てない
      if (fieldPlay.type === PlayType.TUNNEL) {
        return {
          valid: false,
          reason: 'トンネルは最弱の階段です',
        };
      }
      // それ以外の場合（場が空や階段以外の場合）は出せる
      return { valid: true, reason: 'トンネル' };
    }

    // 場がトンネルの場合、どの3枚階段でも勝てる
    if (fieldPlay.type === PlayType.TUNNEL) {
      const stairTypes = [PlayType.STAIR, PlayType.SKIP_STAIR, PlayType.SPADE_STAIR];
      if (stairTypes.includes(currentPlay.type) && currentPlay.cards.length === 3) {
        return { valid: true, reason: '' };
      }
    }

    // 強さ反転ロジック: 革命、11バック、2バックが奇数個trueなら反転
    // XOR演算を連鎖させて、trueの数が奇数かどうかを判定
    const shouldReverse = context.isRevolution !== context.isElevenBack !== context.isTwoBack;

    // ダブルキング効果: Kx2がK以下の任意のペアとして出せる
    if (context.ruleSettings.doubleKing && this.isDoubleKing(currentPlay)) {
      const doubleKingResult = this.validateDoubleKing(fieldPlay, shouldReverse);
      if (doubleKingResult !== null) {
        return doubleKingResult;
      }
    }

    // アーサー効果: ジョーカーの強さが10〜Jの間になる（強さ8.5）
    // ジョーカーを含むプレイの場合、強さを調整してからチェック
    if (context.ruleSettings.arthur && context.isArthurActive) {
      const arthurResult = this.validateStrengthWithArthur(fieldPlay, currentPlay, shouldReverse);
      if (arthurResult !== null) {
        return arthurResult;
      }
    }

    // レッドセブン/ブラックセブン効果のチェック
    const sevenPowerResult = this.validateStrengthWithSevenPower(fieldPlay, currentPlay, shouldReverse, context);
    if (sevenPowerResult !== null) {
      return sevenPowerResult;
    }

    // PlayAnalyzer.canFollow で強さをチェック
    if (!PlayAnalyzer.canFollow(fieldPlay, currentPlay, shouldReverse)) {
      return {
        valid: false,
        reason: '場のカードより強くありません',
      };
    }

    // 階段で出せる場合は理由を明示（ローカルルールとして扱う）
    if (currentPlay.type === PlayType.STAIR) {
      return { valid: true, reason: '階段' };
    }

    // 飛び階段で出せる場合は理由を明示
    if (currentPlay.type === PlayType.SKIP_STAIR) {
      return { valid: true, reason: `飛び階段（公差${currentPlay.skipStairDiff}）` };
    }

    // 二列階段で出せる場合は理由を明示
    if (currentPlay.type === PlayType.DOUBLE_STAIR) {
      return { valid: true, reason: '二列階段' };
    }

    // トンネルで出せる場合は理由を明示
    if (currentPlay.type === PlayType.TUNNEL) {
      return { valid: true, reason: 'トンネル' };
    }

    // スペ階で出せる場合は理由を明示
    if (currentPlay.type === PlayType.SPADE_STAIR) {
      return { valid: true, reason: 'スペ階' };
    }

    // エンペラーで出せる場合は理由を明示（ローカルルールとして扱う）
    if (currentPlay.type === PlayType.EMPEROR) {
      return { valid: true, reason: 'エンペラー' };
    }

    return { valid: true, reason: '' };
  }

  /**
   * 禁止上がりチェック
   * J, 2, 8, Joker で上がることはできない
   */
  private validateForbiddenFinish(
    player: Player,
    cards: Card[],
    context: RuleContext
  ): ValidationResult {
    if (!context.ruleSettings.forbiddenFinish) {
      return { valid: true, reason: '' };
    }

    // これらのカードをプレイした後に手札が空になるかチェック
    const remainingCards = player.hand.size() - cards.length;
    if (remainingCards !== 0) {
      return { valid: true, reason: '' };
    }

    // 禁止カード: J, 2, 8, Joker
    const forbiddenRanks = ['J', '2', '8', 'JOKER'];
    const hasForbiddenCard = cards.some(card => forbiddenRanks.includes(card.rank));

    if (hasForbiddenCard) {
      return {
        valid: false,
        reason: 'J, 2, 8, Jokerでは上がることができません',
      };
    }

    return { valid: true, reason: '' };
  }

  // ========================================
  // Private: ヘルパーメソッド
  // ========================================

  /**
   * 砂嵐（3のスリーカード）かどうかを判定
   */
  private isSandstorm(play: Play): boolean {
    return play.type === PlayType.TRIPLE && play.cards.every(card => card.rank === '3');
  }

  /**
   * スペードの3（単一カード）かどうかを判定
   */
  private isSpadeThree(play: Play): boolean {
    return (
      play.type === PlayType.SINGLE &&
      play.cards.length === 1 &&
      play.cards[0].rank === '3' &&
      play.cards[0].suit === Suit.SPADE
    );
  }

  /**
   * Joker（単一カード）かどうかを判定
   */
  private isJoker(play: Play): boolean {
    return (
      play.type === PlayType.SINGLE &&
      play.cards.length === 1 &&
      play.cards[0].rank === 'JOKER'
    );
  }

  /**
   * アーサー効果を考慮した強さチェック
   * ジョーカーの強さが10〜Jの間（強さ8.5）になる
   * @returns ValidationResult | null（nullの場合は通常の強さチェックを続行）
   */
  private validateStrengthWithArthur(
    fieldPlay: Play,
    currentPlay: Play,
    shouldReverse: boolean
  ): ValidationResult | null {
    // ジョーカーを含むプレイかどうかをチェック
    const fieldHasJoker = fieldPlay.cards.some(c => c.rank === 'JOKER');
    const currentHasJoker = currentPlay.cards.some(c => c.rank === 'JOKER');

    // どちらにもジョーカーがない場合は通常の処理
    if (!fieldHasJoker && !currentHasJoker) {
      return null;
    }

    // タイプが異なる場合は出せない
    if (fieldPlay.type !== currentPlay.type) {
      return {
        valid: false,
        reason: '場のカードと同じタイプの組み合わせを出してください',
      };
    }

    // 強さを計算（ジョーカーは8.5として扱う = 10と11の間）
    const ARTHUR_JOKER_STRENGTH = 8.5;
    const fieldStrength = fieldHasJoker ? ARTHUR_JOKER_STRENGTH : fieldPlay.strength;
    const currentStrength = currentHasJoker ? ARTHUR_JOKER_STRENGTH : currentPlay.strength;

    // 革命などで強さが反転している場合
    const effectiveFieldStrength = shouldReverse ? -fieldStrength : fieldStrength;
    const effectiveCurrentStrength = shouldReverse ? -currentStrength : currentStrength;

    if (effectiveCurrentStrength > effectiveFieldStrength) {
      return { valid: true, reason: 'アーサー' };
    } else {
      return {
        valid: false,
        reason: 'アーサー効果によりジョーカーの強さが10〜Jの間です',
      };
    }
  }

  /**
   * ダブルキング（Kx2）かどうかを判定
   */
  private isDoubleKing(play: Play): boolean {
    return play.type === PlayType.PAIR && play.cards.every(card => card.rank === 'K');
  }

  /**
   * ダブルキング効果の検証
   * Kx2がK以下の任意のペアとして出せる
   * K=11なので、強さ11以下のペアに対して出せる
   * @returns ValidationResult | null（nullの場合は通常の処理を続行）
   */
  private validateDoubleKing(fieldPlay: Play, shouldReverse: boolean): ValidationResult | null {
    // 場がペアでない場合は通常の処理
    if (fieldPlay.type !== PlayType.PAIR) {
      return null;
    }

    // K以下の強さを持つペア（強さ11以下）に対して出せる
    // 通常時: 場の強さ <= 11 (K) なら出せる
    // 革命時: 場の強さ >= K (11) なら出せる（弱いほど強い）
    const KING_STRENGTH = 11;
    const fieldStrength = fieldPlay.strength;

    if (shouldReverse) {
      // 革命時: K以下の強さ = 強さ11以上（弱いカードが強いので、強さが大きいほど弱い）
      // 革命時にダブルキングが出せるのは、場のカードがKより強い（=強さがK以上）の場合
      if (fieldStrength >= KING_STRENGTH) {
        return { valid: true, reason: 'ダブルキング' };
      }
    } else {
      // 通常時: K以下の強さ = 強さ11以下
      if (fieldStrength <= KING_STRENGTH) {
        return { valid: true, reason: 'ダブルキング' };
      }
    }

    return {
      valid: false,
      reason: 'ダブルキングはK以下のペアにしか出せません',
    };
  }

  /**
   * 女装（QとKの混合出し）の強さチェック
   * QとKのペアとして扱い、Qの強さで判定
   */
  private validateCrossDressingStrength(cards: Card[], context: RuleContext): ValidationResult {
    // 場が空なら出せる
    if (context.field.isEmpty()) {
      return { valid: true, reason: '女装' };
    }

    const fieldPlay = context.field.getCurrentPlay()!;

    // 場のプレイタイプに応じてチェック
    // 女装は Q と K の混合なので、ペア(2枚)、トリプル相当(4枚=Q2+K2)、クアッド相当(6枚=Q3+K3)など
    const halfCount = cards.length / 2;

    // 場のカード枚数が女装の「半数」と一致するかチェック（ペア相当なら場も2枚）
    if (fieldPlay.cards.length !== halfCount) {
      return {
        valid: false,
        reason: '場のカードと枚数が合いません',
      };
    }

    // 強さ反転ロジック
    const shouldReverse = context.isRevolution !== context.isElevenBack !== context.isTwoBack;

    // 女装の強さはQの強さ（10）として扱う
    const QUEEN_STRENGTH = 10;
    const fieldStrength = fieldPlay.strength;

    if (shouldReverse) {
      // 革命時: 弱いほど強い
      if (QUEEN_STRENGTH < fieldStrength) {
        return { valid: true, reason: '女装' };
      }
    } else {
      // 通常時: 強いほど強い
      if (QUEEN_STRENGTH > fieldStrength) {
        return { valid: true, reason: '女装' };
      }
    }

    return {
      valid: false,
      reason: '場のカードより強くありません',
    };
  }

  /**
   * レッドセブン/ブラックセブン効果を考慮した強さチェック
   * - レッドセブン（通常時）: ♥7/♦7が2より強くジョーカーより弱くなる（強さ13.5）
   * - ブラックセブン（革命中）: ♠7/♣7が3より強くジョーカーより弱くなる（強さ13.5）
   * @returns ValidationResult | null（nullの場合は通常の強さチェックを続行）
   */
  private validateStrengthWithSevenPower(
    fieldPlay: Play,
    currentPlay: Play,
    shouldReverse: boolean,
    context: RuleContext
  ): ValidationResult | null {
    // レッドセブン/ブラックセブンのどちらかが有効かチェック
    const redSevenEnabled = context.ruleSettings.redSevenPower;
    const blackSevenEnabled = context.ruleSettings.blackSevenPower;

    if (!redSevenEnabled && !blackSevenEnabled) {
      return null;
    }

    // 特殊7カードを持っているかチェック
    const currentHasSpecialSeven = this.hasSpecialSeven(currentPlay, shouldReverse, redSevenEnabled, blackSevenEnabled);
    const fieldHasSpecialSeven = this.hasSpecialSeven(fieldPlay, shouldReverse, redSevenEnabled, blackSevenEnabled);

    // どちらにも特殊7がない場合は通常の処理
    if (!currentHasSpecialSeven && !fieldHasSpecialSeven) {
      return null;
    }

    // タイプが異なる場合は出せない
    if (fieldPlay.type !== currentPlay.type) {
      return {
        valid: false,
        reason: '場のカードと同じタイプの組み合わせを出してください',
      };
    }

    // 階段の場合、枚数が同じでなければならない
    if (fieldPlay.type === PlayType.STAIR && currentPlay.type === PlayType.STAIR) {
      if (fieldPlay.cards.length !== currentPlay.cards.length) {
        return {
          valid: false,
          reason: '場のカードと枚数が合いません',
        };
      }
    }

    // 特殊7の強さ（2より強く、ジョーカーより弱い = 13.5）
    // 特殊7は革命の影響を受けず、常に高い強さを持つ
    const SPECIAL_SEVEN_STRENGTH = 13.5;

    // 強さを計算
    // 特殊7は革命の影響を受けないので、常にSPECIAL_SEVEN_STRENGTHを使用
    // 通常カードは革命時に反転する
    let effectiveFieldStrength: number;
    let effectiveCurrentStrength: number;

    if (fieldHasSpecialSeven) {
      // フィールドが特殊7の場合、革命の影響を受けない
      effectiveFieldStrength = SPECIAL_SEVEN_STRENGTH;
    } else {
      effectiveFieldStrength = shouldReverse ? -fieldPlay.strength : fieldPlay.strength;
    }

    if (currentHasSpecialSeven) {
      // 現在のプレイが特殊7の場合、革命の影響を受けない
      effectiveCurrentStrength = SPECIAL_SEVEN_STRENGTH;
    } else {
      effectiveCurrentStrength = shouldReverse ? -currentPlay.strength : currentPlay.strength;
    }

    if (effectiveCurrentStrength > effectiveFieldStrength) {
      if (currentHasSpecialSeven) {
        const reason = this.getSpecialSevenReason(currentPlay, shouldReverse, redSevenEnabled, blackSevenEnabled);
        return { valid: true, reason };
      }
      return { valid: true, reason: '' };
    } else {
      return {
        valid: false,
        reason: '場のカードより強くありません',
      };
    }
  }

  /**
   * プレイが特殊7を含むかどうかを判定
   * - レッドセブン（通常時）: ♥7/♦7
   * - ブラックセブン（革命中）: ♠7/♣7
   */
  private hasSpecialSeven(
    play: Play,
    shouldReverse: boolean,
    redSevenEnabled: boolean,
    blackSevenEnabled: boolean
  ): boolean {
    // 単体出しの場合のみ特殊7の効果が適用される
    if (play.type !== PlayType.SINGLE) {
      return false;
    }

    const card = play.cards[0];
    if (card.rank !== '7') {
      return false;
    }

    // 通常時（shouldReverse = false）でレッドセブンが有効: ♥7/♦7が特殊
    if (!shouldReverse && redSevenEnabled) {
      if (card.suit === Suit.HEART || card.suit === Suit.DIAMOND) {
        return true;
      }
    }

    // 革命時（shouldReverse = true）でブラックセブンが有効: ♠7/♣7が特殊
    if (shouldReverse && blackSevenEnabled) {
      if (card.suit === Suit.SPADE || card.suit === Suit.CLUB) {
        return true;
      }
    }

    return false;
  }

  /**
   * 特殊7の効果発動理由を取得
   */
  private getSpecialSevenReason(
    play: Play,
    shouldReverse: boolean,
    redSevenEnabled: boolean,
    blackSevenEnabled: boolean
  ): string {
    const card = play.cards[0];
    if (card.rank !== '7') {
      return '';
    }

    if (!shouldReverse && redSevenEnabled) {
      if (card.suit === Suit.HEART || card.suit === Suit.DIAMOND) {
        return 'レッドセブン';
      }
    }

    if (shouldReverse && blackSevenEnabled) {
      if (card.suit === Suit.SPADE || card.suit === Suit.CLUB) {
        return 'ブラックセブン';
      }
    }

    return '';
  }

  /**
   * 仇討ち禁止令チェック
   * 都落ちさせた相手を都落ちさせる形で上がることはできない
   *
   * 発動条件:
   * - 仇討ち禁止令ルールがON
   * - このプレイで手札が空になる（上がり）
   * - 前回の大富豪（都落ち対象）が自分を都落ちさせた人である
   */
  private validateAdauchiBan(
    player: Player,
    cards: Card[],
    context: RuleContext
  ): ValidationResult {
    if (!context.ruleSettings.adauchiBan) {
      return { valid: true, reason: '' };
    }

    // このプレイで上がりになるかチェック
    const remainingCards = player.hand.size() - cards.length;
    if (remainingCards !== 0) {
      return { valid: true, reason: '' };
    }

    // 都落ちさせた人がいて、かつ前回の大富豪が都落ちさせた人ならNG
    // miyakoOchiAttackerId: 自分を都落ちさせたプレイヤーID
    // previousDaifugoId: 今回都落ちになる可能性があるプレイヤーID
    if (
      context.miyakoOchiAttackerId &&
      context.previousDaifugoId &&
      context.miyakoOchiAttackerId === context.previousDaifugoId
    ) {
      return {
        valid: false,
        reason: '仇討ち禁止令：都落ちさせた相手を都落ちさせて上がることはできません',
      };
    }

    return { valid: true, reason: '' };
  }

  /**
   * 治安維持法チェック
   * 都落ちしたプレイヤーは革命を起こせない
   *
   * 発動条件:
   * - 治安維持法ルールがON
   * - プレイヤーが都落ちした（前回の大富豪だが今回1位でない）
   * - 革命が起きるプレイ（4枚同数、階段革命など）
   */
  private validateSecurityLaw(
    cards: Card[],
    context: RuleContext
  ): ValidationResult {
    if (!context.ruleSettings.securityLaw) {
      return { valid: true, reason: '' };
    }

    // プレイヤーが都落ちしていなければチェック不要
    if (!context.isPlayerCityFallen) {
      return { valid: true, reason: '' };
    }

    // 革命が起きるかどうかをチェック
    const play = PlayAnalyzer.analyze(
      cards,
      context.ruleSettings.skipStair,
      context.ruleSettings.doubleStair,
      {
        enableTunnel: context.ruleSettings.tunnel,
        enableSpadeStair: context.ruleSettings.spadeStair,
      }
    );

    if (!play) {
      return { valid: true, reason: '' };
    }

    // 革命が起きるプレイかどうかを判定
    const triggersRevolution = this.wouldTriggerRevolution(play, context);

    if (triggersRevolution) {
      return {
        valid: false,
        reason: '治安維持法：都落ちしたプレイヤーは革命を起こせません',
      };
    }

    return { valid: true, reason: '' };
  }

  /**
   * このプレイが革命を起こすかどうかを判定
   */
  private wouldTriggerRevolution(play: Play, context: RuleContext): boolean {
    // 4枚同数（QUAD）は革命
    if (play.type === PlayType.QUAD) {
      return true;
    }

    // 4枚以上の階段で階段革命
    if (context.ruleSettings.stairRevolution && play.type === PlayType.STAIR && play.cards.length >= 4) {
      return true;
    }

    // 7x3でナナサン革命
    if (context.ruleSettings.nanasanRevolution && play.type === PlayType.TRIPLE && play.cards.every(c => c.rank === '7')) {
      return true;
    }

    // 9x3でクーデター
    if (context.ruleSettings.coup && play.type === PlayType.TRIPLE && play.cards.every(c => c.rank === '9')) {
      return true;
    }

    // 6x3でオーメン
    if (context.ruleSettings.omen && play.type === PlayType.TRIPLE && play.cards.every(c => c.rank === '6')) {
      return true;
    }

    // ジョーカー2枚でジョーカー革命
    if (context.ruleSettings.jokerRevolution && play.type === PlayType.PAIR && play.cards.every(c => c.rank === 'JOKER')) {
      return true;
    }

    // エンペラー
    if (context.ruleSettings.emperor && play.type === PlayType.EMPEROR) {
      return true;
    }

    // 飛び連番革命（4枚以上の飛び階段）
    if (context.ruleSettings.skipStairRevolution && play.type === PlayType.SKIP_STAIR && play.cards.length >= 4) {
      return true;
    }

    // 超革命（5枚以上）
    if (context.ruleSettings.superRevolution && play.cards.length >= 5) {
      return true;
    }

    // 語呂合わせ革命のチェック
    if (context.ruleSettings.southernCross && this.isSouthernCross(play.cards)) {
      return true;
    }
    if (context.ruleSettings.yoroshikuRevolution && this.isYoroshikuRevolution(play.cards)) {
      return true;
    }
    if (context.ruleSettings.shininasaiRevolution && this.isShininasaiRevolution(play.cards)) {
      return true;
    }

    return false;
  }

  // ========================================
  // Private: 語呂合わせ革命の組み合わせチェック
  // ========================================

  /**
   * 語呂合わせ革命の組み合わせチェック
   * @returns ValidationResult | null（nullの場合は通常の組み合わせチェックを続行）
   */
  private validateGoroawaseCombination(cards: Card[], context: RuleContext): ValidationResult | null {
    // サザンクロス（3,3,9,6）
    if (context.ruleSettings.southernCross && this.isSouthernCross(cards)) {
      return { valid: true, reason: 'サザンクロス' };
    }

    // 平安京流し（同スート7,9,4）
    if (context.ruleSettings.heiankyoFlow && this.isHeiankyoFlow(cards)) {
      return { valid: true, reason: '平安京流し' };
    }

    // サイクロン（同スート3,A,9,6）
    if (context.ruleSettings.cyclone && this.isCyclone(cards)) {
      return { valid: true, reason: 'サイクロン' };
    }

    // 粉々革命（同色5×2枚、7×2枚）
    if (context.ruleSettings.konagonaRevolution && this.isKonagonaRevolution(cards)) {
      return { valid: true, reason: '粉々革命' };
    }

    // 世露死苦革命（4,6,4,9）
    if (context.ruleSettings.yoroshikuRevolution && this.isYoroshikuRevolution(cards)) {
      return { valid: true, reason: '世露死苦革命' };
    }

    // 死になさい革命（♠4,2,7,3,A）
    if (context.ruleSettings.shininasaiRevolution && this.isShininasaiRevolution(cards)) {
      return { valid: true, reason: '死になさい革命' };
    }

    return null;
  }

  /**
   * サザンクロス判定（3,3,9,6を同時出しで革命）- 南十字星「3396」
   * 条件: 4枚で、3が2枚、9が1枚、6が1枚
   */
  private isSouthernCross(cards: Card[]): boolean {
    if (cards.length !== 4) return false;

    const ranks = cards.filter(c => c.rank !== 'JOKER').map(c => c.rank);
    const threes = ranks.filter(r => r === '3').length;
    const nines = ranks.filter(r => r === '9').length;
    const sixes = ranks.filter(r => r === '6').length;

    return threes === 2 && nines === 1 && sixes === 1;
  }

  /**
   * 平安京流し判定（同スート7,9,4を出すといつでも出せて場が流れる）- 「794」年
   * 条件: 3枚で、同スートの7,9,4
   */
  private isHeiankyoFlow(cards: Card[]): boolean {
    if (cards.length !== 3) return false;

    const nonJokers = cards.filter(c => c.rank !== 'JOKER');
    if (nonJokers.length !== 3) return false;

    const suit = nonJokers[0].suit;
    if (!nonJokers.every(c => c.suit === suit)) return false;

    const ranks = nonJokers.map(c => c.rank);
    return ranks.includes('7') && ranks.includes('9') && ranks.includes('4');
  }

  /**
   * サイクロン判定（同スート3,A,9,6を出すと全員の手札を混ぜて再配布）- 「3196」
   * 条件: 4枚で、同スートの3,A,9,6
   */
  private isCyclone(cards: Card[]): boolean {
    if (cards.length !== 4) return false;

    const nonJokers = cards.filter(c => c.rank !== 'JOKER');
    if (nonJokers.length !== 4) return false;

    const suit = nonJokers[0].suit;
    if (!nonJokers.every(c => c.suit === suit)) return false;

    const ranks = nonJokers.map(c => c.rank);
    return ranks.includes('3') && ranks.includes('A') && ranks.includes('9') && ranks.includes('6');
  }

  /**
   * 粉々革命判定（同色5×2枚、7×2枚を出すと出した人が大富豪）- 「5757」
   * 条件: 4枚で、同色の5が2枚、7が2枚
   */
  private isKonagonaRevolution(cards: Card[]): boolean {
    if (cards.length !== 4) return false;

    const nonJokers = cards.filter(c => c.rank !== 'JOKER');
    if (nonJokers.length !== 4) return false;

    const color = this.getSuitColor(nonJokers[0].suit);
    if (!color) return false;
    if (!nonJokers.every(c => this.getSuitColor(c.suit) === color)) return false;

    const fives = nonJokers.filter(c => c.rank === '5').length;
    const sevens = nonJokers.filter(c => c.rank === '7').length;

    return fives === 2 && sevens === 2;
  }

  /**
   * 世露死苦革命判定（4,6,4,9を出すと革命）- 「4649」
   * 条件: 4枚で、4が2枚、6が1枚、9が1枚
   */
  private isYoroshikuRevolution(cards: Card[]): boolean {
    if (cards.length !== 4) return false;

    const ranks = cards.filter(c => c.rank !== 'JOKER').map(c => c.rank);
    if (ranks.length !== 4) return false;

    const fours = ranks.filter(r => r === '4').length;
    const sixes = ranks.filter(r => r === '6').length;
    const nines = ranks.filter(r => r === '9').length;

    return fours === 2 && sixes === 1 && nines === 1;
  }

  /**
   * 死になさい革命判定（♠4,2,7,3,Aを出すと革命＋指名者を大貧民に）- 「42731」
   * 条件: 5枚で、すべてスペードの4,2,7,3,A
   */
  private isShininasaiRevolution(cards: Card[]): boolean {
    if (cards.length !== 5) return false;

    const nonJokers = cards.filter(c => c.rank !== 'JOKER');
    if (nonJokers.length !== 5) return false;

    if (!nonJokers.every(c => c.suit === Suit.SPADE)) return false;

    const ranks = nonJokers.map(c => c.rank);
    return ranks.includes('4') && ranks.includes('2') && ranks.includes('7') && ranks.includes('3') && ranks.includes('A');
  }

  /**
   * スートから色を取得
   */
  private getSuitColor(suit: Suit): 'red' | 'black' | null {
    if (suit === Suit.HEART || suit === Suit.DIAMOND) return 'red';
    if (suit === Suit.SPADE || suit === Suit.CLUB) return 'black';
    return null;
  }

  // ========================================
  // Private: 融合革命・追革の検証
  // ========================================

  /**
   * 融合革命判定（場札＋手札で4枚以上で革命）
   * 条件:
   * - 場に同ランクのカードがある
   * - 出すカードが場のカードと同じランク
   * - 場のカード + 出すカード >= 4枚
   */
  private isFusionRevolution(cards: Card[], context: RuleContext): boolean {
    // 場が空なら発動しない
    if (context.field.isEmpty()) return false;

    // 場のカードを取得
    const fieldPlay = context.field.getCurrentPlay();
    if (!fieldPlay) return false;

    // 場のカードが単一ランクでなければ発動しない（ペア、トリプル、クアッド）
    const fieldRanks = new Set(fieldPlay.cards.filter(c => c.rank !== 'JOKER').map(c => c.rank));
    if (fieldRanks.size !== 1) return false;

    const fieldRank = [...fieldRanks][0];

    // 出すカードが同じランクかチェック
    const playRanks = new Set(cards.filter(c => c.rank !== 'JOKER').map(c => c.rank));
    if (playRanks.size !== 1) return false;

    const playRank = [...playRanks][0];
    if (fieldRank !== playRank) return false;

    // 合計枚数が4枚以上で革命
    const totalCards = fieldPlay.cards.length + cards.length;
    return totalCards >= 4;
  }

  /**
   * 追革判定（場のペアと同数字ペアを重ねると革命）
   * 条件:
   * - 場にペア（2枚）がある
   * - 出すカードもペア（2枚）で、同じランク
   * - 合計4枚で革命が発生
   */
  private isTsuiKaku(cards: Card[], context: RuleContext): boolean {
    // 場が空なら発動しない
    if (context.field.isEmpty()) return false;

    // 場のカードを取得
    const fieldPlay = context.field.getCurrentPlay();
    if (!fieldPlay) return false;

    // 場がペア（2枚）でなければ発動しない
    if (fieldPlay.type !== PlayType.PAIR) return false;

    // 出すカードを分析
    const currentPlay = PlayAnalyzer.analyze(
      cards,
      context.ruleSettings.skipStair,
      context.ruleSettings.doubleStair,
      {
        enableTunnel: context.ruleSettings.tunnel,
        enableSpadeStair: context.ruleSettings.spadeStair,
      }
    );
    if (!currentPlay) return false;

    // 出すカードもペア（2枚）でなければ発動しない
    if (currentPlay.type !== PlayType.PAIR) return false;

    // 場のカードのランクを取得（ジョーカー以外）
    const fieldRanks = fieldPlay.cards.filter(c => c.rank !== 'JOKER').map(c => c.rank);
    if (fieldRanks.length === 0) return false;
    const fieldRank = fieldRanks[0];

    // 出すカードのランクを取得（ジョーカー以外）
    const playRanks = cards.filter(c => c.rank !== 'JOKER').map(c => c.rank);
    if (playRanks.length === 0) return false;
    const playRank = playRanks[0];

    // 同じランクなら追革発動
    return fieldRank === playRank;
  }

  // ========================================
  // Private: 切り札/ドラ強さチェック
  // ========================================

  /**
   * 切り札/ドラの強さチェック
   * 切り札のランクは最強（ジョーカーと同等）で、場にある他のカードに必ず勝つ
   * @returns ValidationResult | null（nullの場合は通常の強さチェックを続行）
   */
  private validateTrumpStrength(cards: Card[], context: RuleContext): ValidationResult | null {
    if (!context.trumpRank) return null;

    const fieldPlay = context.field.getCurrentPlay();
    if (!fieldPlay) return null;

    // 出すカードに切り札ランクが含まれているか
    const hasTrumpCard = cards.some(c => c.rank === context.trumpRank);

    // 場のカードに切り札ランクが含まれているか
    const fieldHasTrumpCard = fieldPlay.cards.some(c => c.rank === context.trumpRank);

    // 両方に切り札がある場合は、通常のルールに従う（同等なので枚数や他の条件で判定）
    if (hasTrumpCard && fieldHasTrumpCard) {
      return null; // 通常の強さチェックを続行
    }

    // 自分が切り札を持っている場合は勝つ（場のカードの種類が同じなら）
    if (hasTrumpCard) {
      const currentPlay = PlayAnalyzer.analyze(
        cards,
        context.ruleSettings.skipStair,
        context.ruleSettings.doubleStair,
        {
          enableTunnel: context.ruleSettings.tunnel,
          enableSpadeStair: context.ruleSettings.spadeStair,
        }
      );

      if (currentPlay && currentPlay.type === fieldPlay.type) {
        // タイプが同じなら切り札で勝利
        return { valid: true, reason: `切り札（${context.trumpRank}）` };
      }

      // タイプが異なる場合は出せない
      return {
        valid: false,
        reason: '場のカードと同じタイプの組み合わせを出してください',
      };
    }

    // 場に切り札がある場合、切り札を持っていなければ通常のカードでは勝てない
    if (fieldHasTrumpCard) {
      return {
        valid: false,
        reason: `場には切り札（${context.trumpRank}）があります`,
      };
    }

    // どちらにも切り札がない場合は通常の強さチェックを続行
    return null;
  }
}
