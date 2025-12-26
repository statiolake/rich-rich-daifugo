import { Card, CardFactory } from './Card';

export enum PlayType {
  SINGLE = 'SINGLE',
  PAIR = 'PAIR',
  TRIPLE = 'TRIPLE',
  QUAD = 'QUAD',
  STAIR = 'STAIR',
}

export interface Play {
  readonly cards: Card[];
  readonly type: PlayType;
  readonly strength: number;
  readonly triggersRevolution: boolean;
}

export class PlayAnalyzer {
  /**
   * カードの組み合わせを分析してPlayオブジェクトを生成
   * 無効な組み合わせの場合はnullを返す
   */
  static analyze(cards: Card[]): Play | null {
    if (cards.length === 0) {
      return null;
    }

    // 1枚出し
    if (cards.length === 1) {
      return {
        cards,
        type: PlayType.SINGLE,
        strength: cards[0].strength,
        triggersRevolution: false,
      };
    }

    // 2枚出し（ペア）
    if (cards.length === 2) {
      if (this.isPair(cards)) {
        return {
          cards,
          type: PlayType.PAIR,
          strength: cards[0].strength,
          triggersRevolution: false,
        };
      }
      return null;
    }

    // 3枚出し（スリーカード）
    if (cards.length === 3) {
      if (this.isTriple(cards)) {
        return {
          cards,
          type: PlayType.TRIPLE,
          strength: cards[0].strength,
          triggersRevolution: false,
        };
      }
      // 階段チェック（3枚以上の連続した数字）
      if (this.isStair(cards)) {
        return {
          cards,
          type: PlayType.STAIR,
          strength: Math.max(...cards.map(c => c.strength)),
          triggersRevolution: false,
        };
      }
      return null;
    }

    // 4枚出し（フォーカード、革命）
    if (cards.length === 4) {
      if (this.isQuad(cards)) {
        return {
          cards,
          type: PlayType.QUAD,
          strength: cards[0].strength,
          triggersRevolution: true, // 4枚出しは革命
        };
      }
      // 階段チェック
      if (this.isStair(cards)) {
        return {
          cards,
          type: PlayType.STAIR,
          strength: Math.max(...cards.map(c => c.strength)),
          triggersRevolution: false,
        };
      }
      return null;
    }

    // 5枚以上は階段のみ
    if (cards.length >= 5) {
      if (this.isStair(cards)) {
        return {
          cards,
          type: PlayType.STAIR,
          strength: Math.max(...cards.map(c => c.strength)),
          triggersRevolution: true, // 5枚以上の階段は革命
        };
      }
      return null;
    }

    return null;
  }

  /**
   * 前のプレイに対して、現在のプレイが出せるかどうかを判定
   */
  static canFollow(previous: Play, current: Play, isRevolution: boolean): boolean {
    // タイプが異なる場合は出せない（階段は階段、ペアはペアのみ）
    if (previous.type !== current.type) {
      return false;
    }

    // 階段の場合、枚数が同じでなければならない
    if (previous.type === PlayType.STAIR && current.type === PlayType.STAIR) {
      if (previous.cards.length !== current.cards.length) {
        return false;
      }
    }

    // 革命時は強さの判定が逆になる
    const prevStrength = CardFactory.getEffectiveStrength(
      { ...previous.cards[0], strength: previous.strength } as Card,
      isRevolution
    );
    const currStrength = CardFactory.getEffectiveStrength(
      { ...current.cards[0], strength: current.strength } as Card,
      isRevolution
    );

    return currStrength > prevStrength;
  }

  /**
   * ペア（2枚の同じランク）かどうかを判定
   */
  private static isPair(cards: Card[]): boolean {
    if (cards.length !== 2) return false;
    // ジョーカーは別扱い
    const nonJokers = cards.filter(c => c.rank !== 'JOKER');
    if (nonJokers.length === 0) return false;
    if (nonJokers.length === 1) return true; // ジョーカー1枚+通常カード1枚
    return nonJokers[0].rank === nonJokers[1].rank;
  }

  /**
   * スリーカード（3枚の同じランク）かどうかを判定
   */
  private static isTriple(cards: Card[]): boolean {
    if (cards.length !== 3) return false;
    const nonJokers = cards.filter(c => c.rank !== 'JOKER');
    if (nonJokers.length === 0) return false;
    const firstRank = nonJokers[0].rank;
    return nonJokers.every(c => c.rank === firstRank);
  }

  /**
   * フォーカード（4枚の同じランク）かどうかを判定
   */
  private static isQuad(cards: Card[]): boolean {
    if (cards.length !== 4) return false;
    const nonJokers = cards.filter(c => c.rank !== 'JOKER');
    if (nonJokers.length === 0) return false;
    const firstRank = nonJokers[0].rank;
    return nonJokers.every(c => c.rank === firstRank);
  }

  /**
   * 階段（同じマークの連続した数字）かどうかを判定
   * 最低3枚以上
   */
  static isStair(cards: Card[]): boolean {
    if (cards.length < 3) return false;

    // ジョーカーは階段では使えない（シンプルなルール）
    if (cards.some(c => c.rank === 'JOKER')) {
      return false;
    }

    // 同じマークかチェック
    const suits = new Set(cards.map(c => c.suit));
    if (suits.size !== 1) {
      return false;
    }

    // 強さでソート
    const sorted = [...cards].sort((a, b) => a.strength - b.strength);

    // 連続しているかチェック
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].strength !== sorted[i - 1].strength + 1) {
        return false;
      }
    }

    return true;
  }
}
