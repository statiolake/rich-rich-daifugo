import { motion, AnimatePresence } from 'framer-motion';
import { ParticleEffect } from './ParticleEffect';
import { RuleCutInData } from '../../store/gameStore';

interface RuleCutInProps {
  cutIns: RuleCutInData[];
  onComplete?: (id: string) => void;
}

export const RuleCutIn: React.FC<RuleCutInProps> = ({ cutIns, onComplete }) => {
  const slideInVariants = {
    initial: { x: -1000, opacity: 0, scale: 0.8, rotate: -5 },
    animate: {
      x: 0,
      opacity: 1,
      scale: 1,
      rotate: 0,
      transition: { type: 'spring' as const, stiffness: 200, damping: 20 }
    },
    exit: {
      x: 1000,
      opacity: 0,
      scale: 0.8,
      rotate: 5,
      transition: { duration: 0.4, ease: [0.4, 0, 1, 1] as [number, number, number, number] }
    }
  };

  const getVariantStyles = (variant: string) => {
    const styles = {
      gold: {
        text: 'text-yellow-400',
        border: 'border-yellow-600',
        glow: 'drop-shadow-[0_0_30px_rgba(251,191,36,0.9)]',
        band: 'bg-gradient-to-r from-yellow-600/80 via-yellow-500/90 to-yellow-600/80'
      },
      red: {
        text: 'text-red-400',
        border: 'border-red-600',
        glow: 'drop-shadow-[0_0_30px_rgba(239,68,68,0.9)]',
        band: 'bg-gradient-to-r from-red-600/80 via-red-500/90 to-red-600/80'
      },
      blue: {
        text: 'text-blue-400',
        border: 'border-blue-600',
        glow: 'drop-shadow-[0_0_30px_rgba(59,130,246,0.9)]',
        band: 'bg-gradient-to-r from-blue-600/80 via-blue-500/90 to-blue-600/80'
      },
      green: {
        text: 'text-green-400',
        border: 'border-green-600',
        glow: 'drop-shadow-[0_0_30px_rgba(34,197,94,0.9)]',
        band: 'bg-gradient-to-r from-green-600/80 via-green-500/90 to-green-600/80'
      }
    };
    return styles[variant as keyof typeof styles] || styles.gold;
  };

  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 9999 }}>
      <AnimatePresence mode="wait">
        {cutIns.map((cutIn) => {
          const variantStyles = getVariantStyles(cutIn.variant || 'gold');

          return (
            <motion.div
              key={cutIn.id}
              variants={slideInVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              onAnimationComplete={() => {
                setTimeout(() => onComplete?.(cutIn.id), cutIn.duration || 1000);
              }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

              <div className="relative w-full max-w-4xl">
                {/* 上の帯 */}
                <div className={`h-4 ${variantStyles.band} transform -skew-y-2 shadow-lg`} />

                {/* メインテキストエリア */}
                <div className={`relative bg-blue-900/80 backdrop-blur-md py-8 px-12 border-y-4 border-double ${variantStyles.border}`}>
                  <ParticleEffect count={100} color={cutIn.variant || 'gold'} />

                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.3 }}
                    className={`text-6xl font-bold text-center italic ${variantStyles.text} ${variantStyles.glow}`}
                    style={{
                      fontFamily: "'Noto Serif JP', serif",
                      textShadow: '0 0 20px currentColor, 0 0 40px currentColor',
                      WebkitTextStroke: '2px rgba(0,0,0,0.3)',
                    }}
                  >
                    {cutIn.text}
                  </motion.div>
                </div>

                {/* 下の帯 */}
                <div className={`h-4 ${variantStyles.band} transform skew-y-2 shadow-lg`} />
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
