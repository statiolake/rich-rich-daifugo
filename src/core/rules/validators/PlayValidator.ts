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
      const numberLockResult = this.validateNumberLock(cards);
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

    // 9. 強さチェック
    const strengthResult = this.validateStrength(cards, context);
    if (!strengthResult.valid) return strengthResult;

    // 8. 禁止上がりチェック
    return this.validateForbiddenFinish(player, cards, context);
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

    const play = PlayAnalyzer.analyze(cards);

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
   */
  private validateNumberLock(cards: Card[]): ValidationResult {
    const play = PlayAnalyzer.analyze(cards);
    if (!play || play.type !== PlayType.STAIR) {
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

    // 女装の場合は特別な強さチェック
    if (context.ruleSettings.crossDressing && this.isCrossDressing(cards)) {
      return this.validateCrossDressingStrength(cards, context);
    }

    const currentPlay = PlayAnalyzer.analyze(cards)!;
    const fieldPlay = context.field.getCurrentPlay()!;

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
}
