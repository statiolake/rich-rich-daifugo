import { Card } from '../../domain/card/Card';
import { Player } from '../../domain/player/Player';
import { PlayAnalyzer, Play, PlayType } from '../../domain/card/Play';
import { RuleContext } from '../context/RuleContext';
import { ValidationResult } from './BasicValidator';

/**
 * 強さバリデーター
 * 場にカードがある場合、それより強い手である必要がある
 */
export class StrengthValidator {
  /**
   * プレイが場のカードより強いかどうかを検証
   */
  validate(
    player: Player,
    cards: Card[],
    context: RuleContext
  ): ValidationResult {
    // 場が空ならどんなカードでも出せる
    if (context.field.isEmpty()) {
      return { valid: true, reason: '' };
    }

    const currentPlay = PlayAnalyzer.analyze(cards);
    if (!currentPlay) {
      // 組み合わせが無効な場合（すでに BasicValidator でチェックされている）
      return { valid: true, reason: '' };
    }

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

    // ダウンナンバーチェック: 同じマークで1つ下の数字を出せる（ルールがONの場合のみ）
    if (context.ruleSettings.downNumber &&
        fieldPlay.type === PlayType.SINGLE &&
        currentPlay.type === PlayType.SINGLE &&
        cards.length === 1 && fieldPlay.cards.length === 1) {
      const fieldCard = fieldPlay.cards[0];
      const playCard = cards[0];

      // 同じマークで、強さが1つ下の場合は許可
      if (playCard.suit === fieldCard.suit && playCard.strength === fieldCard.strength - 1) {
        return { valid: true, reason: 'ダウンナンバー' };
      }
    }

    // XORロジック: 革命と11バックのどちらか一方だけがtrueなら強さ判定が反転
    // - 通常モード (revolution: false, elevenBack: false) → shouldReverse: false
    // - 11バックのみ (revolution: false, elevenBack: true) → shouldReverse: true
    // - 革命のみ (revolution: true, elevenBack: false) → shouldReverse: true
    // - 革命+11バック (revolution: true, elevenBack: true) → shouldReverse: false
    const shouldReverse = context.isRevolution !== context.isElevenBack;

    // PlayAnalyzer.canFollow で強さをチェック
    if (!PlayAnalyzer.canFollow(fieldPlay, currentPlay, shouldReverse)) {
      return {
        valid: false,
        reason: '場のカードより強くありません',
      };
    }

    return { valid: true, reason: '' };
  }

  /**
   * 砂嵐（3のスリーカード）かどうかを判定
   */
  private isSandstorm(play: Play): boolean {
    return play.type === PlayType.TRIPLE && play.cards.every((card: Card) => card.rank === '3');
  }

  /**
   * スペードの3（単一カード）かどうかを判定
   */
  private isSpadeThree(play: Play): boolean {
    return play.type === PlayType.SINGLE &&
           play.cards.length === 1 &&
           play.cards[0].rank === '3' &&
           play.cards[0].suit === 'SPADE';
  }

  /**
   * Joker（単一カード）かどうかを判定
   */
  private isJoker(play: Play): boolean {
    return play.type === PlayType.SINGLE &&
           play.cards.length === 1 &&
           play.cards[0].rank === 'JOKER';
  }
}
