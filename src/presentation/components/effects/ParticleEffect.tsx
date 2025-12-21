import { motion } from 'framer-motion';
import { useMemo } from 'react';

interface ParticleEffectProps {
  count?: number;
  color?: 'gold' | 'red' | 'blue' | 'green';
}

export const ParticleEffect: React.FC<ParticleEffectProps> = ({
  count = 20,
  color = 'gold'
}) => {
  const particles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100 - 50,
      delay: Math.random() * 0.5,
      duration: 1.5 + Math.random() * 1,
      size: 2 + Math.random() * 4
    }));
  }, [count]);

  const colorMap = {
    gold: 'bg-yellow-400',
    red: 'bg-red-400',
    blue: 'bg-blue-400',
    green: 'bg-green-400'
  };

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className={`absolute bottom-0 left-1/2 rounded-full ${colorMap[color]} opacity-70`}
          style={{ width: p.size, height: p.size, x: `${p.x}%` }}
          animate={{
            y: [0, -400],
            opacity: [0.7, 0],
            scale: [1, 0.5]
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeOut'
          }}
        />
      ))}
    </div>
  );
};
