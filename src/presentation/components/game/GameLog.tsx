import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, GameLogEntry } from '../../store/gameStore';
import { Suit } from '../../../core/domain/card/Card';

export const GameLog: React.FC = () => {
  const gameLogs = useGameStore(state => state.gameLogs);

  // Show only last 8 logs
  const visibleLogs = gameLogs.slice(-8);

  const getSuitSymbol = (suit: string): string => {
    switch (suit) {
      case Suit.SPADE: return '♠';
      case Suit.HEART: return '♥';
      case Suit.DIAMOND: return '♦';
      case Suit.CLUB: return '♣';
      default: return '';
    }
  };

  const getSuitColor = (suit: string): string => {
    return suit === Suit.HEART || suit === Suit.DIAMOND ? 'text-red-400' : 'text-white';
  };

  const getTypeColor = (type: GameLogEntry['type']): string => {
    switch (type) {
      case 'play': return 'text-yellow-300';
      case 'pass': return 'text-gray-400';
      case 'effect': return 'text-purple-300';
      case 'system': return 'text-blue-300';
      case 'finish': return 'text-green-300';
      default: return 'text-white';
    }
  };

  const getTypeIcon = (type: GameLogEntry['type']): string => {
    switch (type) {
      case 'play': return '>';
      case 'pass': return '-';
      case 'effect': return '*';
      case 'system': return '!';
      case 'finish': return '#';
      default: return '>';
    }
  };

  const formatCards = (cards: GameLogEntry['cards']): React.ReactNode => {
    if (!cards || cards.length === 0) return null;

    return (
      <span className="inline-flex items-center gap-0.5 ml-1">
        {cards.map((card, idx) => (
          <span key={idx} className={`font-bold ${getSuitColor(card.suit)}`}>
            {card.rank}{getSuitSymbol(card.suit)}
          </span>
        ))}
      </span>
    );
  };

  if (visibleLogs.length === 0) return null;

  return (
    <div className="absolute top-4 right-4 z-20 pointer-events-none">
      <div className="flex flex-col items-end gap-1 max-w-sm">
        <AnimatePresence mode="popLayout">
          {visibleLogs.map((log, index) => {
            const opacity = 0.4 + (index / visibleLogs.length) * 0.6;

            return (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: 50, scale: 0.8 }}
                animate={{ opacity, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 50, scale: 0.8 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10"
                style={{
                  boxShadow: log.type === 'effect' ? '0 0 10px rgba(168, 85, 247, 0.3)' : undefined,
                }}
              >
                {/* Type icon */}
                <span className={`font-mono text-xs ${getTypeColor(log.type)}`}>
                  {getTypeIcon(log.type)}
                </span>

                {/* Player name */}
                {log.playerName && (
                  <span className="font-bold text-white text-sm">
                    {log.playerName}
                  </span>
                )}

                {/* Message */}
                <span className={`text-sm ${getTypeColor(log.type)}`}>
                  {log.message}
                </span>

                {/* Cards */}
                {formatCards(log.cards)}

                {/* Effect name badge */}
                {log.effectName && (
                  <span className="px-1.5 py-0.5 text-xs font-bold bg-purple-500/30 text-purple-200 rounded border border-purple-400/30">
                    {log.effectName}
                  </span>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};
