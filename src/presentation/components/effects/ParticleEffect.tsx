import { motion } from 'framer-motion';
import { useMemo } from 'react';

interface ParticleEffectProps {
  count?: number;
  color?: 'gold' | 'red' | 'blue' | 'green' | 'yellow';
}

export const ParticleEffect: React.FC<ParticleEffectProps> = ({
  count = 100,
  color = 'gold'
}) => {
  const particles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100, // 0% to 100% の範囲（画面全体）
      initialY: Math.random() * 200, // 0 to 200 の範囲（カットインの下端より下から開始）
      duration: 0.8 + Math.random() * 2.5, // 0.8秒〜3.3秒の幅
      size: 2 + Math.random() * 6   // サイズのバリエーションも増加
    }));
  }, [count]);

  const colorMap = {
    gold: 'bg-yellow-400',
    yellow: 'bg-yellow-400',
    red: 'bg-red-400',
    blue: 'bg-blue-400',
    green: 'bg-green-400'
  };

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className={`absolute bottom-0 left-0 rounded-full ${colorMap[color]} opacity-70`}
          style={{ width: p.size, height: p.size, left: `${p.x}%` }}
          animate={{
            y: [p.initialY, p.initialY - 400],
            opacity: [0.7, 0],
            scale: [1, 0.5]
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            ease: 'easeOut'
          }}
        />
      ))}
    </div>
  );
};
