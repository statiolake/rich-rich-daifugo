import { Card, CardFactory } from './Card';
import { Play, PlayAnalyzer } from './Play';
import type { Field } from '../game/Field';
import type { GameState } from '../game/GameState';
import type { Player } from '../player/Player';

/**
 * ルールエンジンのインターフェース（循環依存回避のため）
 */
export interface IValidationEngine {
  validate(player: Player, cards: Card[], field: Field, gameState: GameState): { valid: boolean; reason?: string };
}

export class Hand {
  private cards: Card[];

  constructor(cards: Card[]) {
    this.cards = [...cards];
  }

  getCards(): readonly Card[] {
    return this.cards;
  }

  remove(cardsToRemove: Card[]): void {
    const idsToRemove = new Set(cardsToRemove.map(c => c.id));
    this.cards = this.cards.filter(c => !idsToRemove.has(c.id));
  }

  add(cardsToAdd: Card[]): void {
    this.cards.push(...cardsToAdd);
  }

  sort(isRevolution: boolean): void {
    this.cards.sort((a, b) => CardFactory.compare(a, b, isRevolution));
  }

  size(): number {
    return this.cards.length;
  }

  isEmpty(): boolean {
    return this.cards.length === 0;
  }

  /**
   * 現在の場の状態に対して、出せるカードの組み合わせをすべて返す
   */
  findPlayableCombinations(field: Field, isRevolution: boolean): Play[] {
    const playable: Play[] = [];
    const cards = this.getCards();

    // 場が空の場合、すべての有効な組み合わせを返す
    if (field.isEmpty()) {
      // 1枚出し
      for (const card of cards) {
        const play = PlayAnalyzer.analyze([card]);
        if (play) {
          playable.push(play);
        }
      }

      // ペア・スリーカード・フォーカードを探す
      playable.push(...this.findSameRankCombinations(cards));

      // 階段を探す（簡略版：3〜5枚の階段のみ）
      playable.push(...this.findStairCombinations(cards));

      return playable;
    }

    // 場にカードがある場合、それより強い組み合わせを探す
    const currentPlay = field.getCurrentPlay()!;

    // 同じタイプの組み合わせを探す
    if (currentPlay.type === 'SINGLE') {
      for (const card of cards) {
        const play = PlayAnalyzer.analyze([card]);
        if (play && PlayAnalyzer.canFollow(currentPlay, play, isRevolution)) {
          playable.push(play);
        }
      }
    } else if (currentPlay.type === 'PAIR' || currentPlay.type === 'TRIPLE' || currentPlay.type === 'QUAD') {
      const combinations = this.findSameRankCombinations(cards);
      for (const play of combinations) {
        if (play.type === currentPlay.type && PlayAnalyzer.canFollow(currentPlay, play, isRevolution)) {
          playable.push(play);
        }
      }
    } else if (currentPlay.type === 'STAIR') {
      const stairs = this.findStairCombinations(cards);
      for (const play of stairs) {
        if (
          play.cards.length === currentPlay.cards.length &&
          PlayAnalyzer.canFollow(currentPlay, play, isRevolution)
        ) {
          playable.push(play);
        }
      }
    }

    return playable;
  }

  /**
   * 同じランクのカードの組み合わせ（ペア・スリーカード・フォーカード）を探す
   */
  private findSameRankCombinations(cards: readonly Card[]): Play[] {
    const playable: Play[] = [];
    const rankMap = new Map<string, Card[]>();

    // ランクごとにグループ化
    for (const card of cards) {
      if (card.rank === 'JOKER') continue; // ジョーカーは別処理
      const existing = rankMap.get(card.rank) || [];
      existing.push(card);
      rankMap.set(card.rank, existing);
    }

    // 各ランクについて、2枚以上あれば組み合わせを生成
    for (const [, sameRankCards] of rankMap) {
      if (sameRankCards.length >= 2) {
        const pair = PlayAnalyzer.analyze([sameRankCards[0], sameRankCards[1]]);
        if (pair) playable.push(pair);
      }
      if (sameRankCards.length >= 3) {
        const triple = PlayAnalyzer.analyze([sameRankCards[0], sameRankCards[1], sameRankCards[2]]);
        if (triple) playable.push(triple);
      }
      if (sameRankCards.length >= 4) {
        const quad = PlayAnalyzer.analyze([sameRankCards[0], sameRankCards[1], sameRankCards[2], sameRankCards[3]]);
        if (quad) playable.push(quad);
      }
    }

    return playable;
  }

  /**
   * 階段の組み合わせを探す（3〜5枚）
   */
  private findStairCombinations(cards: readonly Card[]): Play[] {
    const playable: Play[] = [];
    const nonJokers = cards.filter(c => c.rank !== 'JOKER');

    // 強さでソート
    const sorted = [...nonJokers].sort((a, b) => a.strength - b.strength);

    // 3枚以上の連続を探す
    for (let start = 0; start < sorted.length; start++) {
      for (let length = 3; length <= Math.min(5, sorted.length - start); length++) {
        const subset = sorted.slice(start, start + length);
        const play = PlayAnalyzer.analyze(subset);
        if (play && play.type === 'STAIR') {
          playable.push(play);
        }
      }
    }

    return playable;
  }

  /**
   * ビット全探索ですべての有効な手を列挙
   * ヒューリスティックを使わず、RuleEngine で純粋に検証する
   * @param player プレイヤー
   * @param field 場の状態
   * @param gameState ゲーム状態
   * @param ruleEngine ルールエンジン
   * @returns 有効なカードの組み合わせ
   */
  findAllValidPlays(
    player: Player,
    field: Field,
    gameState: GameState,
    ruleEngine: IValidationEngine
  ): Card[][] {
    const cards = this.getCards();
    const validPlays: Card[][] = [];

    // ビット全探索: 1 から (1 << cards.length) - 1 まで
    for (let pattern = 1; pattern < (1 << cards.length); pattern++) {
      // パターンに対応する部分集合を取得
      const subset: Card[] = [];
      for (let i = 0; i < cards.length; i++) {
        if (pattern & (1 << i)) {
          subset.push(cards[i]);
        }
      }

      // RuleEngine で検証
      const validation = ruleEngine.validate(player, subset, field, gameState);
      if (validation.valid) {
        validPlays.push(subset);
      }
    }

    return validPlays;
  }

  /**
   * 禁止上がりルールによってプレイできないカードのIDを取得
   *
   * このメソッドは、禁止上がりルール（J, 2, 8, Jokerで上がれない）に違反する
   * カードのIDセットを返す。プレゼンテーション層で禁止カードを視覚的に示すために使用する。
   *
   * @param player プレイヤー
   * @param field 場の状態
   * @param gameState ゲーム状態
   * @param ruleEngine ルールエンジン
   * @returns 禁止上がりに該当するカードのIDセット
   */
  getForbiddenFinishCardIds(
    player: Player,
    field: Field,
    gameState: GameState,
    ruleEngine: IValidationEngine
  ): Set<string> {
    const forbidden = new Set<string>();
    const cards = this.getCards();

    // 各カードについて、それを出すと禁止上がりに該当するかチェック
    for (const card of cards) {
      const validation = ruleEngine.validate(player, [card], field, gameState);
      if (!validation.valid && validation.reason?.includes('上がることができません')) {
        forbidden.add(card.id);
      }
    }

    return forbidden;
  }
}
