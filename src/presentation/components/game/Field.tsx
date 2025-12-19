import { motion, AnimatePresence } from 'framer-motion';
import { Field as FieldType } from '../../../core/domain/game/Field';
import { Card } from '../card/Card';

interface FieldProps {
  field: FieldType;
}

export const Field: React.FC<FieldProps> = ({ field }) => {
  const currentPlay = field.getCurrentPlay();

  return (
    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
      <AnimatePresence mode="wait">
        {!currentPlay ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 0.5, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.3 }}
          >
            <div className="text-white text-2xl opacity-50">場が空です</div>
          </motion.div>
        ) : (
          <motion.div
            key={`play-${currentPlay.cards.map(c => c.id).join('-')}`}
            initial={{ opacity: 0, y: -50, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.8 }}
            transition={{
              type: 'spring',
              stiffness: 200,
              damping: 20,
              duration: 0.4
            }}
            className="flex flex-col items-center gap-4"
          >
            <motion.div
              className="text-white text-sm opacity-75"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.75 }}
              transition={{ delay: 0.2 }}
            >
              場のカード
            </motion.div>
            <div className="flex gap-2">
              {currentPlay.cards.map((card, index) => (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, y: -20, rotateY: 90 }}
                  animate={{ opacity: 1, y: 0, rotateY: 0 }}
                  transition={{
                    delay: index * 0.1,
                    type: 'spring',
                    stiffness: 200,
                    damping: 15
                  }}
                >
                  <Card card={card} />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
