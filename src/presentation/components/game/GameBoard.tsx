import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { useMultiplayerStore } from '../../store/multiplayerStore';
import { PlayerArea } from '../player/PlayerArea';
import { HumanControl } from '../player/HumanControl';
import { UnifiedCardLayer } from './UnifiedCardLayer';
import { TurnArrows } from './TurnArrows';
import { GameStatusPanel } from './GameStatusPanel';
import { GameLog } from './GameLog';
import { GamePhaseType } from '../../../core/domain/game/GameState';
import { getRankName, PlayerRank } from '../../../core/domain/player/PlayerRank';
import { RuleCutIn } from '../effects/RuleCutIn';
import { RuleSettingsPanel } from '../settings/RuleSettingsPanel';
import { MultiplayerFlow } from '../multiplayer/MultiplayerFlow';

const PLAYER_NAME_STORAGE_KEY = 'daifugo_player_name';

export const GameBoard: React.FC = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [autoCPU, setAutoCPU] = useState(false);
  const [playerName, setPlayerName] = useState(() => {
    // 初期値をlocalStorageから読み込む
    try {
      return localStorage.getItem(PLAYER_NAME_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [isMultiplayerMode, setIsMultiplayerMode] = useState(false);

  // プレイヤー名が変更されたらlocalStorageに保存
  useEffect(() => {
    try {
      localStorage.setItem(PLAYER_NAME_STORAGE_KEY, playerName);
    } catch {
      // localStorageが使えない環境では無視
    }
  }, [playerName]);
  const gameState = useGameStore(state => state.gameState);
  const startGame = useGameStore(state => state.startGame);
  const startMultiplayerGame = useGameStore(state => state.startMultiplayerGame);
  const continueGame = useGameStore(state => state.continueGame);
  const reset = useGameStore(state => state.reset);
  const activeCutIns = useGameStore(state => state.activeCutIns);
  const removeCutIn = useGameStore(state => state.removeCutIn);
  const localPlayerId = useGameStore(state => state.localPlayerId);
  const multiplayerMode = useMultiplayerStore(state => state.mode);

  // マルチプレイモード
  // デバッグログ
  console.log('[GameBoard] Render - isMultiplayerMode:', isMultiplayerMode, 'gameState:', !!gameState, 'multiplayerMode:', multiplayerMode);
  if (isMultiplayerMode && !gameState) {
    return (
      <MultiplayerFlow
        initialPlayerName={playerName}
        onStartGame={() => {
          // マルチプレイゲーム開始（ホストの場合のみ実行される）
          // ゲストの場合は initGuestGameEngine で既にgameStateが設定されているのでここは呼ばれない
          console.log('[GameBoard] onStartGame called, multiplayerMode:', multiplayerMode);
          if (multiplayerMode === 'host') {
            console.log('[GameBoard] Calling startMultiplayerGame');
            startMultiplayerGame();
          }
          // ゲストの場合は gameState が設定済みなので自動的にゲーム画面に遷移する
        }}
        onCancel={() => setIsMultiplayerMode(false)}
      />
    );
  }

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
              {/* Player Name Input */}
              <div className="flex flex-col items-center gap-2">
                <label className="text-sm text-white/70 font-medium">
                  プレイヤー名
                </label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="あなた"
                  maxLength={12}
                  className="
                    w-64 px-4 py-2 rounded-lg
                    bg-white/10 backdrop-blur-sm
                    border border-white/20
                    text-white text-center font-orbitron font-bold
                    placeholder:text-white/40
                    focus:outline-none focus:border-yellow-400/50 focus:ring-2 focus:ring-yellow-400/30
                    transition-all duration-200
                  "
                  style={{
                    textShadow: playerName ? '0 0 8px rgba(255,255,255,0.3)' : undefined,
                  }}
                />
              </div>

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
                onClick={() => startGame({ playerName: playerName.trim() || 'あなた', autoCPU })}
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

              {/* Multiplayer Button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsMultiplayerMode(true)}
                className="game-btn-secondary min-w-[280px]"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  マルチプレイ
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
  // ローカルプレイヤーを基準に他のプレイヤーを配置
  const localPlayerIndex = gameState.players.findIndex(p => p.id === localPlayerId);
  const calculatePosition = (index: number, total: number): { x: number; y: number } => {
    const positions = [
      { x: 50, y: 85 },  // Bottom (ローカルプレイヤー)
      { x: 10, y: 50 },  // Left
      { x: 50, y: 15 },  // Top
      { x: 90, y: 50 },  // Right
    ];
    // ローカルプレイヤーからの相対位置を計算
    const relativeIndex = (index - localPlayerIndex + total) % total;
    return positions[relativeIndex] || { x: 50, y: 50 };
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
      {/* Game Status Panel */}
      <GameStatusPanel gameState={gameState} />

      {/* Game Log (Kill-feed style) */}
      <GameLog />

      {/* Turn Direction Arrows */}
      <TurnArrows
        currentPlayerIndex={gameState.currentPlayerIndex}
        playerCount={gameState.players.length}
        isReversed={gameState.isReversed}
      />

      {/* Player Areas */}
      {gameState.players.map((player, index) => (
        <PlayerArea
          key={player.id}
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
                          key={player.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          className={`game-card flex items-center justify-between ${
                            isFirst ? 'border-yellow-500/50 animate-pulse-glow' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`w-8 h-8 rounded-full flex items-center justify-center font-orbitron font-bold ${
                                isFirst
                                  ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-black'
                                  : isLast
                                  ? 'bg-gradient-to-br from-gray-600 to-gray-800 text-gray-400'
                                  : 'bg-gradient-to-br from-gray-500 to-gray-700 text-white'
                              }`}
                              style={{
                                boxShadow: isFirst ? '0 0 12px rgba(250,204,21,0.6)' : undefined,
                              }}
                            >
                              {idx + 1}
                            </span>
                            <span
                              className={`font-orbitron font-bold ${isFirst ? 'text-yellow-300' : 'text-white'}`}
                              style={{
                                textShadow: isFirst ? '0 0 8px rgba(250,204,21,0.5)' : undefined,
                              }}
                            >
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
                <div className="flex flex-col gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => continueGame()}
                    className="game-btn-primary w-full"
                  >
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      次のラウンドへ
                      <span className="text-sm opacity-75">(Round {gameState.round + 1})</span>
                    </span>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => reset()}
                    className="game-btn-secondary w-full"
                  >
                    タイトルに戻る
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
