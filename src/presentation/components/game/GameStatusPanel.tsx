import { motion, AnimatePresence } from 'framer-motion';
import { GameState } from '../../../core/domain/game/GameState';

interface GameStatusPanelProps {
  gameState: GameState;
}

interface StatusBadge {
  label: string;
  icon: string;
  color: 'red' | 'blue' | 'yellow' | 'purple' | 'green' | 'orange' | 'pink';
}

export const GameStatusPanel: React.FC<GameStatusPanelProps> = ({ gameState }) => {
  // 恒久的な状態（ラウンド中ずっと継続）
  const getPermanentStatuses = (): StatusBadge[] => {
    const statuses: StatusBadge[] = [];

    if (gameState.isRevolution) {
      statuses.push({ label: '革命', icon: '⚔️', color: 'red' });
    }

    if (gameState.isOmenActive) {
      statuses.push({ label: 'オーメン', icon: '👁', color: 'purple' });
    }

    if (gameState.isSuperRevolutionActive) {
      statuses.push({ label: '超革命', icon: '💥', color: 'red' });
    }

    if (gameState.isReligiousRevolutionActive) {
      statuses.push({ label: '宗教革命', icon: '✝️', color: 'purple' });
    }

    if (gameState.isNuclearBombActive) {
      statuses.push({ label: '核爆弾', icon: '☢️', color: 'orange' });
    }

    if (gameState.luckySeven) {
      statuses.push({ label: 'ラッキー7', icon: '🍀', color: 'green' });
    }

    return statuses;
  };

  // ターン中のみの状態（場が流れるとリセット）
  const getTemporaryStatuses = (): StatusBadge[] => {
    const statuses: StatusBadge[] = [];

    if (gameState.isElevenBack) {
      const duration = gameState.elevenBackDuration > 0 ? ` (${gameState.elevenBackDuration})` : '';
      statuses.push({ label: `Jバック${duration}`, icon: '🔄', color: 'blue' });
    }

    if (gameState.isTwoBack) {
      statuses.push({ label: '2バック', icon: '↩️', color: 'blue' });
    }

    if (gameState.isReversed) {
      statuses.push({ label: 'リバース', icon: '🔀', color: 'yellow' });
    }

    if (gameState.suitLock) {
      const suitName = getSuitName(gameState.suitLock);
      statuses.push({ label: `${suitName}縛り`, icon: getSuitIcon(gameState.suitLock), color: 'yellow' });
    }

    if (gameState.numberLock) {
      statuses.push({ label: '数字縛り', icon: '🔢', color: 'yellow' });
    }

    if (gameState.colorLock) {
      const colorName = gameState.colorLock === 'red' ? '赤' : '黒';
      statuses.push({ label: `${colorName}縛り`, icon: gameState.colorLock === 'red' ? '🔴' : '⚫', color: 'yellow' });
    }

    if (gameState.partialLockSuits && gameState.partialLockSuits.length > 0) {
      statuses.push({ label: '片縛り', icon: '📌', color: 'yellow' });
    }

    if (gameState.parityRestriction) {
      const name = gameState.parityRestriction === 'even' ? '偶数' : '奇数';
      statuses.push({ label: `${name}縛り`, icon: '#️⃣', color: 'yellow' });
    }

    if (gameState.isDamianActive) {
      statuses.push({ label: 'ダミアン', icon: '😈', color: 'red' });
    }

    if (gameState.isTenFreeActive) {
      statuses.push({ label: '10フリー', icon: '🆓', color: 'green' });
    }

    if (gameState.isDoubleDigitSealActive) {
      statuses.push({ label: '2桁封じ', icon: '🚫', color: 'orange' });
    }

    if (gameState.isArthurActive) {
      statuses.push({ label: 'アーサー', icon: '👑', color: 'purple' });
    }

    if (gameState.hotMilkRestriction) {
      statuses.push({ label: 'ホットミルク', icon: '🥛', color: 'pink' });
    }

    if (gameState.deathSentenceTarget) {
      statuses.push({ label: '死の宣告', icon: '💀', color: 'red' });
    }

    if (gameState.endCountdownValue !== null) {
      statuses.push({ label: `終焉(${gameState.endCountdownValue})`, icon: '⏰', color: 'red' });
    }

    if (gameState.teleforceCountdown !== null) {
      statuses.push({ label: `テレフォース(${gameState.teleforceCountdown})`, icon: '📡', color: 'purple' });
    }

    if (gameState.guillotineClockCount !== null) {
      statuses.push({ label: `ギロチン(${gameState.guillotineClockCount})`, icon: '🔪', color: 'red' });
    }

    return statuses;
  };

  const getSuitName = (suit: string): string => {
    switch (suit) {
      case 'SPADE': return 'スペード';
      case 'HEART': return 'ハート';
      case 'DIAMOND': return 'ダイヤ';
      case 'CLUB': return 'クラブ';
      default: return suit;
    }
  };

  const getSuitIcon = (suit: string): string => {
    switch (suit) {
      case 'SPADE': return '♠️';
      case 'HEART': return '♥️';
      case 'DIAMOND': return '♦️';
      case 'CLUB': return '♣️';
      default: return '🃏';
    }
  };

  const getColorClass = (color: StatusBadge['color']): string => {
    switch (color) {
      case 'red': return 'bg-red-500/30 border-red-400/50 text-red-300';
      case 'blue': return 'bg-blue-500/30 border-blue-400/50 text-blue-300';
      case 'yellow': return 'bg-yellow-500/30 border-yellow-400/50 text-yellow-300';
      case 'purple': return 'bg-purple-500/30 border-purple-400/50 text-purple-300';
      case 'green': return 'bg-green-500/30 border-green-400/50 text-green-300';
      case 'orange': return 'bg-orange-500/30 border-orange-400/50 text-orange-300';
      case 'pink': return 'bg-pink-500/30 border-pink-400/50 text-pink-300';
      default: return 'bg-gray-500/30 border-gray-400/50 text-gray-300';
    }
  };

  const permanentStatuses = getPermanentStatuses();
  const temporaryStatuses = getTemporaryStatuses();
  const hasStatuses = permanentStatuses.length > 0 || temporaryStatuses.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="absolute top-4 left-4 z-20"
    >
      <div className="game-panel">
        <div className="px-4 py-3">
          {/* Round Info */}
          <div className="flex items-center gap-3 mb-2">
            <div className="status-indicator status-indicator-active" />
            <span className="text-white/60 text-sm">ラウンド</span>
            <span className="text-white font-bold text-lg">{gameState.round}</span>
          </div>
          <div className="text-white/50 text-xs uppercase tracking-wider mb-3">
            {gameState.phase}
          </div>

          {/* Status Badges */}
          <AnimatePresence mode="popLayout">
            {hasStatuses && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                {/* Permanent Statuses */}
                {permanentStatuses.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-white/40 text-xs uppercase tracking-wider flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      恒久
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {permanentStatuses.map((status, index) => (
                        <motion.div
                          key={status.label}
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.8, opacity: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className={`px-2 py-1 rounded-lg border text-xs font-bold flex items-center gap-1 ${getColorClass(status.color)}`}
                        >
                          <span>{status.icon}</span>
                          <span>{status.label}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Temporary Statuses */}
                {temporaryStatuses.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-white/40 text-xs uppercase tracking-wider flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-yellow-500" />
                      ターン中
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {temporaryStatuses.map((status, index) => (
                        <motion.div
                          key={status.label}
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.8, opacity: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className={`px-2 py-1 rounded-lg border text-xs font-bold flex items-center gap-1 ${getColorClass(status.color)}`}
                        >
                          <span>{status.icon}</span>
                          <span>{status.label}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};
