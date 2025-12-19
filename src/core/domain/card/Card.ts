export enum Suit {
  SPADE = 'SPADE',
  HEART = 'HEART',
  DIAMOND = 'DIAMOND',
  CLUB = 'CLUB',
  JOKER = 'JOKER',
}

export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' |
                   '9' | '10' | 'J' | 'Q' | 'K' | 'JOKER';

export interface Card {
  readonly id: string;
  readonly suit: Suit;
  readonly rank: Rank;
  readonly strength: number;
}

export class CardFactory {
  private static readonly RANK_VALUES: Record<Rank, number> = {
    '3': 1,
    '4': 2,
    '5': 3,
    '6': 4,
    '7': 5,
    '8': 6,
    '9': 7,
    '10': 8,
    'J': 9,
    'Q': 10,
    'K': 11,
    'A': 12,
    '2': 13,
    'JOKER': 14,
  };

  static create(suit: Suit, rank: Rank): Card {
    const strength = this.RANK_VALUES[rank];
    const id = suit === Suit.JOKER ? `JOKER-${Math.random()}` : `${suit}-${rank}`;

    return {
      id,
      suit,
      rank,
      strength,
    };
  }

  static createDeck(includeJokers: boolean = true): Card[] {
    const cards: Card[] = [];
    const suits: Suit[] = [Suit.SPADE, Suit.HEART, Suit.DIAMOND, Suit.CLUB];
    const ranks: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

    // 各スートのカードを作成
    for (const suit of suits) {
      for (const rank of ranks) {
        cards.push(this.create(suit, rank));
      }
    }

    // ジョーカーを追加
    if (includeJokers) {
      cards.push(this.create(Suit.JOKER, 'JOKER'));
      cards.push(this.create(Suit.JOKER, 'JOKER'));
    }

    return cards;
  }

  static compare(a: Card, b: Card, isRevolution: boolean): number {
    const aStrength = isRevolution ? -a.strength : a.strength;
    const bStrength = isRevolution ? -b.strength : b.strength;
    return aStrength - bStrength;
  }

  static getEffectiveStrength(card: Card, isRevolution: boolean): number {
    return isRevolution ? -card.strength : card.strength;
  }
}
