import { Card } from '../../domain/card/Card';
import { Player } from '../../domain/player/Player';
import { PlayAnalyzer } from '../../domain/card/Play';
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
      return { valid: true };
    }

    const currentPlay = PlayAnalyzer.analyze(cards);
    if (!currentPlay) {
      // 組み合わせが無効な場合（すでに BasicValidator でチェックされている）
      return { valid: true };
    }

    const fieldPlay = context.field.getCurrentPlay()!;

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

    return { valid: true };
  }
}
