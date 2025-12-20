import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { Card } from '../card/Card';

export const MovingCardLayer: React.FC = () => {
  const movingCards = useGameStore(state => state.movingCards);
  const removeMovingCard = useGameStore(state => state.removeMovingCard);

  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 1000 }}>
      <AnimatePresence>
        {movingCards.map((movingCard) => (
          <motion.div
            key={movingCard.id}
            initial={{
              position: 'absolute',
              left: movingCard.fromX,
              top: movingCard.fromY,
              opacity: 1,
            }}
            animate={{
              left: movingCard.toX,
              top: movingCard.toY,
              opacity: 1,
            }}
            transition={{
              duration: 0.5,
              ease: [0.4, 0, 0.2, 1], // easeInOut
            }}
            onAnimationComplete={() => {
              removeMovingCard(movingCard.id);
            }}
          >
            <Card card={movingCard.card} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
