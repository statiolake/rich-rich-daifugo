import { motion, AnimatePresence } from 'framer-motion';
import { RuleCutInData } from '../../store/cutInStore';

interface RuleCutInProps {
  cutIns: RuleCutInData[];
  onComplete?: (id: string) => void;
}

export const RuleCutIn: React.FC<RuleCutInProps> = ({ cutIns, onComplete }) => {
  const getSlideInVariants = (delay: number = 0) => ({
    initial: { x: -1000, opacity: 0, scale: 0.8, rotate: -5 },
    animate: {
      x: 0,
      opacity: 1,
      scale: 1,
      rotate: 0,
      transition: {
        type: 'spring' as const,
        stiffness: 200,
        damping: 20,
        delay: delay / 1000
      }
    },
    exit: {
      x: 1000,
      opacity: 0,
      scale: 0.8,
      rotate: 5,
      transition: { duration: 0.4, ease: [0.4, 0, 1, 1] as [number, number, number, number] }
    }
  });

  const getVariantStyles = (variant: string) => {
    const styles = {
      gold: {
        color: '#ffd700',
        glow: 'rgba(255, 215, 0, 0.7)',
        bg: 'rgba(60, 45, 0, 0.95)',
        band: 'from-yellow-700/90 via-yellow-500/95 to-yellow-700/90',
      },
      yellow: {
        color: '#ffd700',
        glow: 'rgba(255, 215, 0, 0.7)',
        bg: 'rgba(60, 45, 0, 0.95)',
        band: 'from-yellow-700/90 via-yellow-500/95 to-yellow-700/90',
      },
      red: {
        color: '#ff4040',
        glow: 'rgba(255, 64, 64, 0.7)',
        bg: 'rgba(60, 10, 10, 0.95)',
        band: 'from-red-800/90 via-red-500/95 to-red-800/90',
      },
      blue: {
        color: '#40a0ff',
        glow: 'rgba(64, 160, 255, 0.7)',
        bg: 'rgba(10, 30, 60, 0.95)',
        band: 'from-blue-800/90 via-blue-500/95 to-blue-800/90',
      },
      green: {
        color: '#40ff80',
        glow: 'rgba(64, 255, 128, 0.7)',
        bg: 'rgba(10, 50, 25, 0.95)',
        band: 'from-green-800/90 via-green-500/95 to-green-800/90',
      },
      purple: {
        color: '#c040ff',
        glow: 'rgba(192, 64, 255, 0.7)',
        bg: 'rgba(40, 10, 60, 0.95)',
        band: 'from-purple-800/90 via-purple-500/95 to-purple-800/90',
      }
    };
    return styles[variant as keyof typeof styles] || styles.gold;
  };

  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 9999 }}>
      {/* 背景 */}
      <AnimatePresence>
        {cutIns.length > 0 && (
          <motion.div
            key="background"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/40"
          />
        )}
      </AnimatePresence>

      {/* カットインコンテンツ */}
      <div className="absolute inset-0">
        <AnimatePresence>
          {cutIns.map((cutIn) => {
            const s = getVariantStyles(cutIn.variant || 'gold');
            const slideInVariants = getSlideInVariants(cutIn.delay || 0);
            const verticalPos = cutIn.verticalPosition || '50%';

            return (
              <motion.div
                key={cutIn.id}
                className="absolute w-full flex items-center justify-center"
                style={{
                  top: verticalPos,
                  transform: 'translateY(-50%)'
                }}
                initial={{ opacity: 1 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 1 }}
              >
                <motion.div
                  variants={slideInVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  onAnimationComplete={() => {
                    setTimeout(() => onComplete?.(cutIn.id), cutIn.duration || 500);
                  }}
                  className="w-full max-w-4xl"
                  style={{
                    filter: `drop-shadow(0 0 30px ${s.glow}) drop-shadow(0 0 60px ${s.glow})`,
                  }}
                >
                  <div className="relative w-full">
                    {/* 上の帯 */}
                    <div className={`h-4 bg-gradient-to-r ${s.band} transform -skew-y-2`}
                      style={{ boxShadow: `0 0 20px ${s.glow}` }}
                    />

                    {/* メインテキストエリア */}
                    <div
                      className="relative py-6 px-8 overflow-hidden"
                      style={{
                        background: s.bg,
                        borderTop: `3px solid ${s.color}`,
                        borderBottom: `3px solid ${s.color}`,
                      }}
                    >
                      {/* 内側のグロー */}
                      <div
                        className="absolute inset-0"
                        style={{ boxShadow: `inset 0 0 50px ${s.glow}` }}
                      />

                      {/* 斜めストライプ */}
                      <div
                        className="absolute inset-0 opacity-10"
                        style={{
                          backgroundImage: `repeating-linear-gradient(-45deg, transparent, transparent 8px, ${s.color} 8px, ${s.color} 9px)`,
                        }}
                      />

                      {/* スピードライン */}
                      {[...Array(8)].map((_, i) => (
                        <motion.div
                          key={i}
                          className="absolute"
                          style={{
                            top: `${10 + i * 10}%`,
                            width: '100%',
                            height: '2px',
                            background: `linear-gradient(90deg, transparent, ${s.color}50, transparent)`,
                          }}
                          initial={{ x: '100%' }}
                          animate={{ x: '-100%' }}
                          transition={{
                            duration: 0.35,
                            delay: i * 0.02,
                            ease: 'easeOut' as const,
                          }}
                        />
                      ))}

                      {/* コーナーアクセント */}
                      <div className="absolute top-2 left-3 w-5 h-5 border-l-2 border-t-2" style={{ borderColor: s.color }} />
                      <div className="absolute top-2 right-3 w-5 h-5 border-r-2 border-t-2" style={{ borderColor: s.color }} />
                      <div className="absolute bottom-2 left-3 w-5 h-5 border-l-2 border-b-2" style={{ borderColor: s.color }} />
                      <div className="absolute bottom-2 right-3 w-5 h-5 border-r-2 border-b-2" style={{ borderColor: s.color }} />

                      {/* テキスト */}
                      <motion.div
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.15, duration: 0.2 }}
                        className="relative z-10 text-center"
                      >
                        <span
                          className="text-5xl md:text-6xl font-black"
                          style={{
                            color: s.color,
                            textShadow: `
                              0 0 20px ${s.glow},
                              0 0 40px ${s.glow},
                              3px 3px 0 #000,
                              -2px -2px 0 #000,
                              2px -2px 0 #000,
                              -2px 2px 0 #000
                            `,
                          }}
                        >
                          {cutIn.text}
                        </span>
                      </motion.div>

                      {/* フラッシュ */}
                      <motion.div
                        className="absolute inset-0 bg-white pointer-events-none"
                        initial={{ opacity: 0.7 }}
                        animate={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                      />
                    </div>

                    {/* 下の帯 */}
                    <div className={`h-4 bg-gradient-to-r ${s.band} transform skew-y-2`}
                      style={{ boxShadow: `0 0 20px ${s.glow}` }}
                    />
                  </div>
                </motion.div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};
