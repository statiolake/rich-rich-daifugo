import { motion, AnimatePresence } from 'framer-motion';
import { Field as FieldType } from '../../../core/domain/game/Field';
import { Card } from '../card/Card';
import { useEffect, useRef, useState } from 'react';

interface FieldProps {
  field: FieldType;
}

interface PlayHistoryWithKey {
  playHistory: any;
  key: string;
}

export const Field: React.FC<FieldProps> = ({ field }) => {
  const history = field.getHistory();
  const [displayedPlays, setDisplayedPlays] = useState<PlayHistoryWithKey[]>([]);
  const prevHistoryLengthRef = useRef(0);

  useEffect(() => {
    const currentHistoryLength = history.length;

    // 新しいプレイが追加された
    if (currentHistoryLength > prevHistoryLengthRef.current) {
      const newPlays = history.slice(prevHistoryLengthRef.current).map(playHistory => ({
        playHistory,
        key: `${playHistory.playerId.value}-${playHistory.timestamp}`,
      }));
      setDisplayedPlays(prev => [...prev, ...newPlays]);
    }
    // 場が流れた（historyが空になった）
    else if (currentHistoryLength === 0 && prevHistoryLengthRef.current > 0) {
      // displayedPlaysをクリアして、AnimatePresenceでexitアニメーションさせる
      setDisplayedPlays([]);
    }

    prevHistoryLengthRef.current = currentHistoryLength;
  }, [field, history.length]);

  return (
    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
      <div className="flex flex-col items-center gap-4">
        <div className="text-white text-sm opacity-75">場のカード</div>

        <div className="relative min-h-[100px] min-w-[200px] flex items-center justify-center">
          <AnimatePresence mode="popLayout">
            {displayedPlays.length === 0 && (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <div className="text-white text-xl opacity-50 whitespace-nowrap">場が空です</div>
              </motion.div>
            )}

            {displayedPlays.map((item, playIndex) => {
              const { playHistory, key } = item;
              const rotation = (playIndex % 3 - 1) * 2; // -2, 0, 2 degrees rotation
              const isLatest = playIndex === displayedPlays.length - 1;

              // 外側に向かうベクトルを計算
              const exitDirection = playIndex % 4;
              const exitX = exitDirection === 0 ? -300 : exitDirection === 1 ? 300 : exitDirection === 2 ? 0 : 0;
              const exitY = exitDirection === 0 ? -200 : exitDirection === 1 ? -200 : exitDirection === 2 ? -300 : 300;

              return (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, x: 0, y: 200, scale: 0.95, rotateZ: 0 }}
                  animate={{ opacity: 1, x: 0, y: 0, scale: 1, rotateZ: rotation }}
                  exit={{
                    opacity: 0,
                    x: exitX,
                    y: exitY,
                    rotateZ: rotation + (playIndex % 2 === 0 ? 15 : -15),
                    transition: {
                      duration: 0.5,
                      ease: [0.4, 0, 1, 1] // easeIn for acceleration outward
                    }
                  }}
                  transition={{
                    duration: 0.4,
                    ease: [0, 0, 0.2, 1]
                  }}
                  className="flex gap-2"
                  style={{
                    position: playIndex === 0 ? 'relative' : 'absolute',
                    top: playIndex === 0 ? 0 : -playIndex * 3,
                    left: playIndex === 0 ? 0 : playIndex * 2,
                    zIndex: playIndex + 1,
                    filter: isLatest ? 'none' : 'brightness(0.8)',
                  }}
                >
                {playHistory.play.cards.map((card: any, cardIndex: number) => (
                  <motion.div
                    key={card.id}
                    initial={{ opacity: 0, y: 200, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{
                      delay: cardIndex * 0.04,
                      duration: 0.4,
                      ease: [0, 0, 0.2, 1]
                    }}
                  >
                    <Card card={card} />
                  </motion.div>
                ))}
              </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
