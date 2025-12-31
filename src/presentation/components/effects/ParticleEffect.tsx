import { motion } from 'framer-motion';
import { useMemo } from 'react';

interface ParticleEffectProps {
  count?: number;
  color?: 'gold' | 'red' | 'blue' | 'green' | 'yellow' | 'purple';
}

export const ParticleEffect: React.FC<ParticleEffectProps> = ({
  count = 50,
  color = 'gold'
}) => {
  const particles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      initialY: Math.random() * 100,
      duration: 1 + Math.random() * 2,
      size: 2 + Math.random() * 4,
      delay: Math.random() * 1,
    }));
  }, [count]);

  const colorMap = {
    gold: 'bg-yellow-400',
    yellow: 'bg-yellow-400',
    red: 'bg-red-400',
    blue: 'bg-blue-400',
    green: 'bg-green-400',
    purple: 'bg-purple-400',
  };

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className={`absolute rounded-full ${colorMap[color]} opacity-60`}
          style={{
            width: p.size,
            height: p.size,
            left: `${p.x}%`,
            bottom: 0,
          }}
          animate={{
            y: [p.initialY, p.initialY - 200],
            opacity: [0.6, 0],
            scale: [1, 0.5],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  );
};
