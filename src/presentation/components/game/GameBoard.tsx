import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { PlayerArea } from '../player/PlayerArea';
import { HumanControl } from '../player/HumanControl';
import { UnifiedCardLayer } from './UnifiedCardLayer';
import { TurnArrows } from './TurnArrows';
import { GamePhaseType } from '../../../core/domain/game/GameState';
import { getRankName, PlayerRank } from '../../../core/domain/player/PlayerRank';
import { RuleCutIn } from '../effects/RuleCutIn';
import { RuleSettingsPanel } from '../settings/RuleSettingsPanel';

export const GameBoard: React.FC = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [autoCPU, setAutoCPU] = useState(false);
  const gameState = useGameStore(state => state.gameState);
  const startGame = useGameStore(state => state.startGame);
  const reset = useGameStore(state => state.reset);
  const activeCutIns = useGameStore(state => state.activeCutIns);
  const removeCutIn = useGameStore(state => state.removeCutIn);

  if (!gameState) {
    return (
      <>
        <div className="w-full h-screen game-board-bg flex items-center justify-center relative overflow-hidden">
          {/* Background decorations */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Corner decorations */}
            <div className="absolute top-0 left-0 w-64 h-64 bg-gradient-to-br from-yellow-500/10 to-transparent rounded-br-full" />
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-gradient-to-tl from-yellow-500/10 to-transparent rounded-tl-full" />
            {/* Floating card shapes */}
            <motion.div
              animate={{ y: [-10, 10, -10], rotate: [0, 5, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-20 right-20 w-16 h-24 bg-white/5 rounded-lg border border-white/10"
            />
            <motion.div
              animate={{ y: [10, -10, 10], rotate: [0, -5, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="absolute bottom-32 left-20 w-12 h-18 bg-white/5 rounded-lg border border-white/10"
            />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-center relative z-10"
          >
            {/* Title */}
            <motion.h1
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-7xl font-black title-text mb-4"
            >
              大富豪
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="subtitle-text text-xl mb-12"
            >
              RICH RICH DAIFUGO
            </motion.p>

            {/* Menu */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="flex flex-col gap-5 items-center"
            >
              {/* CPU Toggle */}
              <label className="flex items-center gap-4 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={autoCPU}
                    onChange={(e) => setAutoCPU(e.target.checked)}
                    className="game-toggle appearance-none"
                  />
                </div>
                <span className="text-lg text-white/80 group-hover:text-white transition-colors">
                  全員CPUで観戦する
                </span>
              </label>

              {/* Start Button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => startGame({ autoCPU })}
                className="game-btn-primary min-w-[280px]"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  ゲーム開始
                </span>
              </motion.button>

              {/* Settings Button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsSettingsOpen(true)}
                className="game-btn-secondary min-w-[280px]"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  ルールスイッチ
                </span>
              </motion.button>
            </motion.div>
          </motion.div>
        </div>

        {/* Rule Settings Panel */}
        <RuleSettingsPanel
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
      </>
    );
  }

  // Game result overlay
  const isGameResult = gameState.phase === GamePhaseType.RESULT;

  // Player positions (4-player circular layout)
  const calculatePosition = (index: number, total: number): { x: number; y: number } => {
    const positions = [
      { x: 50, y: 85 },  // Bottom (Human)
      { x: 10, y: 50 },  // Left
      { x: 50, y: 15 },  // Top
      { x: 90, y: 50 },  // Right
    ];
    return positions[index] || { x: 50, y: 50 };
  };

  const getRankBadgeClass = (rank: PlayerRank | null): string => {
    switch (rank) {
      case PlayerRank.DAIFUGO: return 'rank-badge rank-badge-daifugo';
      case PlayerRank.FUGO: return 'rank-badge rank-badge-fugo';
      case PlayerRank.HEIMIN: return 'rank-badge rank-badge-heimin';
      case PlayerRank.HINMIN: return 'rank-badge rank-badge-hinmin';
      case PlayerRank.DAIHINMIN: return 'rank-badge rank-badge-daihinmin';
      default: return 'rank-badge rank-badge-heimin';
    }
  };

  return (
    <div className="relative w-full h-screen game-board-bg overflow-hidden">
      {/* Game Info Panel */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="absolute top-4 left-4 z-20"
      >
        <div className="game-panel">
          <div className="px-4 py-3">
            <div className="flex items-center gap-3 mb-2">
              <div className="status-indicator status-indicator-active" />
              <span className="text-white/60 text-sm">ラウンド</span>
              <span className="text-white font-bold text-lg">{gameState.round}</span>
            </div>
            <div className="text-white/50 text-xs uppercase tracking-wider">
              {gameState.phase}
            </div>
            {gameState.isRevolution && (
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="mt-2 px-3 py-1 bg-red-500/30 border border-red-400/50 rounded-lg"
              >
                <span className="text-red-300 font-bold text-sm flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
                  </svg>
                  革命中！
                </span>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Turn Direction Arrows */}
      <TurnArrows
        currentPlayerIndex={gameState.currentPlayerIndex}
        playerCount={gameState.players.length}
        isReversed={gameState.isReversed}
      />

      {/* Player Areas */}
      {gameState.players.map((player, index) => (
        <PlayerArea
          key={player.id.value}
          player={player}
          position={calculatePosition(index, gameState.players.length)}
          isCurrent={index === gameState.currentPlayerIndex}
        />
      ))}

      {/* Human Player Controls */}
      <HumanControl />

      {/* Unified Card Layer (all 54 cards) */}
      <UnifiedCardLayer />

      {/* Cut-in Effects */}
      <RuleCutIn
        cutIns={activeCutIns}
        onComplete={removeCutIn}
      />

      {/* Game Result Overlay */}
      <AnimatePresence>
        {isGameResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100]"
          >
            <motion.div
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 50 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="game-panel w-full max-w-lg mx-4"
            >
              <div className="game-panel-header text-center">
                <h1 className="title-text text-4xl">ゲーム結果</h1>
              </div>
              <div className="p-6">
                <div className="space-y-3 mb-8">
                  {gameState.players
                    .filter(p => p.rank !== null)
                    .sort((a, b) => {
                      if (a.finishPosition === null || b.finishPosition === null) return 0;
                      return a.finishPosition - b.finishPosition;
                    })
                    .map((player, idx) => {
                      const isFirst = idx === 0;
                      const isLast = idx === gameState.players.filter(p => p.rank !== null).length - 1;

                      return (
                        <motion.div
                          key={player.id.value}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          className={`game-card flex items-center justify-between ${
                            isFirst ? 'border-yellow-500/50 animate-pulse-glow' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                              isFirst
                                ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-black'
                                : isLast
                                ? 'bg-gradient-to-br from-gray-600 to-gray-800 text-gray-400'
                                : 'bg-gradient-to-br from-gray-500 to-gray-700 text-white'
                            }`}>
                              {idx + 1}
                            </span>
                            <span className={`font-bold ${isFirst ? 'text-yellow-300' : 'text-white'}`}>
                              {player.name}
                            </span>
                          </div>
                          <span className={getRankBadgeClass(player.rank)}>
                            {player.rank ? getRankName(player.rank) : ''}
                          </span>
                        </motion.div>
                      );
                    })}
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => reset()}
                  className="game-btn-primary w-full"
                >
                  タイトルに戻る
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
