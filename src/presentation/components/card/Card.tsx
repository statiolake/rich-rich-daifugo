import { Card as CardType, Suit } from '../../../core/domain/card/Card';

interface CardProps {
  card: CardType;
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ card, isSelected, onClick, className = '' }) => {
  const getSuitSymbol = (suit: Suit): string => {
    switch (suit) {
      case Suit.SPADE: return '♠';
      case Suit.HEART: return '♥';
      case Suit.DIAMOND: return '♦';
      case Suit.CLUB: return '♣';
      case Suit.JOKER: return '🃏';
      default: return '';
    }
  };

  const getSuitColor = (suit: Suit): string => {
    switch (suit) {
      case Suit.HEART:
      case Suit.DIAMOND:
        return 'text-red-600';
      case Suit.SPADE:
      case Suit.CLUB:
        return 'text-gray-900';
      case Suit.JOKER:
        return 'text-purple-600';
      default:
        return 'text-gray-900';
    }
  };

  return (
    <div
      className={`
        relative w-16 h-24 rounded-lg border-2 shadow-lg cursor-pointer
        bg-white transition-all duration-200
        ${isSelected ? 'ring-4 ring-yellow-400 -translate-y-4 scale-110' : 'hover:scale-105'}
        ${onClick ? 'hover:shadow-xl' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-between p-2">
        <span className={`text-lg font-bold ${getSuitColor(card.suit)}`}>
          {card.rank}
        </span>

        <div className={`text-3xl ${getSuitColor(card.suit)}`}>
          {getSuitSymbol(card.suit)}
        </div>

        <span className={`text-lg font-bold ${getSuitColor(card.suit)}`}>
          {card.rank}
        </span>
      </div>
    </div>
  );
};
