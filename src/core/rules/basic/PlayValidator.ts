import { Card } from '../../domain/card/Card';
import { Play, PlayAnalyzer } from '../../domain/card/Play';
import { Player } from '../../domain/player/Player';
import { Field } from '../../domain/game/Field';
import { GameState } from '../../domain/game/GameState';

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export class PlayValidator {
  /**
   * プレイが有効かどうかを検証
   */
  isValidPlay(
    player: Player,
    cards: Card[],
    field: Field,
    gameState: GameState
  ): ValidationResult {
    // 手札にないカードが含まれていないかチェック
    const handCards = player.hand.getCards();
    const handCardIds = new Set(handCards.map(c => c.id));

    for (const card of cards) {
      if (!handCardIds.has(card.id)) {
        return { valid: false, reason: '手札にないカードが含まれています' };
      }
    }

    // カードの組み合わせが有効かチェック
    const play = PlayAnalyzer.analyze(cards);
    if (!play) {
      return { valid: false, reason: '無効なカードの組み合わせです' };
    }

    // 場が空の場合は常に出せる
    if (field.isEmpty()) {
      return { valid: true };
    }

    // 場にカードがある場合、それより強い必要がある
    const currentPlay = field.getCurrentPlay()!;
    if (!PlayAnalyzer.canFollow(currentPlay, play, gameState.isRevolution)) {
      return { valid: false, reason: '場のカードより強くありません' };
    }

    return { valid: true };
  }

  /**
   * パスが有効かどうかを検証
   */
  canPass(field: Field): ValidationResult {
    // 場が空の場合はパスできない（必ず出さなければならない）
    if (field.isEmpty()) {
      return { valid: false, reason: '場が空の時はパスできません' };
    }

    return { valid: true };
  }
}
