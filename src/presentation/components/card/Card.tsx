import { motion } from 'framer-motion';
import { Card as CardType, Suit } from '../../../core/domain/card/Card';

interface CardProps {
  card: CardType;
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
  isFaceUp?: boolean;
}

export const Card: React.FC<CardProps> = ({ card, isSelected, onClick, className = '', isFaceUp = true }) => {
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

  // 裏向きの場合
  if (!isFaceUp) {
    return (
      <motion.div
        className={`
          relative w-16 h-24 rounded-lg border-2 shadow-lg
          bg-gradient-to-br from-blue-600 to-blue-800
          ${isSelected ? 'ring-4 ring-yellow-400' : ''}
          ${onClick ? 'cursor-pointer hover:shadow-xl' : ''}
          ${className}
        `}
        onClick={onClick}
        initial={{ scale: 1, y: 0 }}
        animate={{
          scale: isSelected ? 1.1 : 1,
          y: isSelected ? -16 : 0
        }}
        whileHover={onClick ? { scale: isSelected ? 1.1 : 1.05 } : {}}
        whileTap={onClick ? { scale: isSelected ? 1.05 : 0.95 } : {}}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        layout
      />
    );
  }

  // 表向きの場合
  return (
    <motion.div
      className={`
        relative w-16 h-24 rounded-lg border-2 shadow-lg cursor-pointer
        bg-white
        ${isSelected ? 'ring-4 ring-yellow-400' : ''}
        ${onClick ? 'hover:shadow-xl' : ''}
        ${className}
      `}
      onClick={onClick}
      initial={{ scale: 1, y: 0 }}
      animate={{
        scale: isSelected ? 1.1 : 1,
        y: isSelected ? -16 : 0
      }}
      whileHover={onClick ? { scale: isSelected ? 1.1 : 1.05 } : {}}
      whileTap={onClick ? { scale: isSelected ? 1.05 : 0.95 } : {}}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      layout
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 py-2">
        <span className={`text-lg font-bold ${getSuitColor(card.suit)}`}>
          {card.rank}
        </span>

        <div className={`text-3xl ${getSuitColor(card.suit)} flex-grow flex items-center`}>
          {getSuitSymbol(card.suit)}
        </div>

        <span className={`text-lg font-bold ${getSuitColor(card.suit)}`}>
          {card.rank}
        </span>
      </div>
    </motion.div>
  );
};
