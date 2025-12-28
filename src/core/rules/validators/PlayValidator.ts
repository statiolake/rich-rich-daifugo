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

    // 6. 強さチェック
    const strengthResult = this.validateStrength(cards, context);
    if (!strengthResult.valid) return strengthResult;

    // 7. 禁止上がりチェック
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
   * 強さチェック
   */
  private validateStrength(cards: Card[], context: RuleContext): ValidationResult {
    // 場が空ならどんなカードでも出せる
    if (context.field.isEmpty()) {
      return { valid: true, reason: '' };
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

    // XORロジック: 革命と11バックのどちらか一方だけがtrueなら強さ判定が反転
    const shouldReverse = context.isRevolution !== context.isElevenBack;

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
}
