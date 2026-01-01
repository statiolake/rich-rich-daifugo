import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { useSelectionStore } from '../../store/selectionStore';
import { GamePhaseType } from '../../../core/domain/game/GameState';
import { useMemo, useState } from 'react';
import { useWindowResize } from '../../hooks/useWindowResize';
import { CardFactory, Suit, Rank, Card } from '../../../core/domain/card/Card';

export const HumanControl: React.FC = () => {
  // gameStoreからゲーム関連の状態を取得
  const gameState = useGameStore(state => state.gameState);
  const error = useGameStore(state => state.error);
  const clearError = useGameStore(state => state.clearError);
  const localPlayerId = useGameStore(state => state.localPlayerId);
  const getValidCombinations = useGameStore(state => state.getValidCombinations);

  // selectionStoreから選択関連の状態を取得
  const selectedCards = useSelectionStore(state => state.selectedCards);
  const submitCardSelection = useSelectionStore(state => state.submitCardSelection);
  const submitQueenBomberRank = useSelectionStore(state => state.submitQueenBomberRank);
  const isCardSelectionEnabled = useSelectionStore(state => state.isCardSelectionEnabled);
  const isQueenBomberRankSelectionEnabled = useSelectionStore(state => state.isQueenBomberRankSelectionEnabled);
  const cardSelectionValidator = useSelectionStore(state => state.cardSelectionValidator);
  const cardSelectionPrompt = useSelectionStore(state => state.cardSelectionPrompt);

  // Discard selection state from selectionStore
  const isDiscardSelectionEnabled = useSelectionStore(state => state.isDiscardSelectionEnabled);
  const discardSelectionPile = useSelectionStore(state => state.discardSelectionPile);
  const discardSelectionMaxCount = useSelectionStore(state => state.discardSelectionMaxCount);
  const discardSelectionPrompt = useSelectionStore(state => state.discardSelectionPrompt);
  const selectedDiscardCards = useSelectionStore(state => state.selectedDiscardCards);
  const toggleDiscardCardSelection = useSelectionStore(state => state.toggleDiscardCardSelection);
  const submitDiscardSelection = useSelectionStore(state => state.submitDiscardSelection);

  const [screenHeight, setScreenHeight] = useState(window.innerHeight);

  useWindowResize(() => {
    setScreenHeight(window.innerHeight);
  }, 200);

  const validCombinations = useMemo(() => getValidCombinations(), [getValidCombinations, gameState, gameState?.field.history.length, cardSelectionValidator]);

  if (!gameState || gameState.phase === GamePhaseType.RESULT) return null;

  const isGameInitializing = gameState.phase === GamePhaseType.SETUP;

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];

  // ローカルプレイヤーを取得（localPlayerIdで判定）
  const localPlayer = gameState.players.find(p => p.id === localPlayerId);

  if (!localPlayer || localPlayer.isFinished) {
    return null;
  }

  const isPendingCardSelection = isCardSelectionEnabled;
  const isPendingRankSelection = isQueenBomberRankSelectionEnabled;
  const isPendingDiscardSelection = isDiscardSelectionEnabled;

  const validationResult = isPendingCardSelection
    ? (cardSelectionValidator ? cardSelectionValidator.validate(selectedCards) : { valid: false })
    : { valid: false };
  const canPlaySelected = validationResult.valid;

  const triggerEffects = validationResult.triggeredEffects || [];

  const needsSelection = isPendingCardSelection || isPendingRankSelection || isPendingDiscardSelection;

  return (
    <>
      {/* Selection overlay */}
      {needsSelection && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 backdrop-blur-sm bg-black/40 z-65 pointer-events-none"
        />
      )}

      <div
        className="absolute left-0 right-0 p-6 pointer-events-none"
        style={{
          top: `${screenHeight - 280}px`,
          zIndex: needsSelection ? 70 : 60
        }}
      >
        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="mb-4 mx-auto max-w-md pointer-events-auto"
            >
              <div className="bg-gradient-to-r from-red-600 to-red-500 text-white px-6 py-3 rounded-xl shadow-lg border border-red-400/30 flex items-center justify-between backdrop-blur-md"
                style={{ boxShadow: '0 0 20px rgba(239, 68, 68, 0.4)' }}
              >
                <span className="font-medium">{error}</span>
                <button
                  onClick={clearError}
                  className="ml-4 w-8 h-8 flex items-center justify-center hover:bg-white/20 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Control Buttons */}
        <AnimatePresence mode="wait">
          {isPendingDiscardSelection ? (
            <motion.div
              key="discard-selection"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="flex flex-col items-center gap-4 pointer-events-auto"
            >
              {/* Prompt */}
              <div className="game-panel px-6 py-3">
                <span className="text-green-300 font-bold flex items-center gap-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                  </svg>
                  {discardSelectionPrompt || `捨て札から${discardSelectionMaxCount}枚まで選んでください`}
                </span>
              </div>

              {/* Discard Pile Cards */}
              <div className="flex flex-wrap justify-center gap-2 max-w-4xl px-4 max-h-48 overflow-y-auto custom-scrollbar">
                {discardSelectionPile.map((card) => {
                  const isSelected = selectedDiscardCards.some(c => c.id === card.id);
                  const suitColor = card.suit === Suit.HEART || card.suit === Suit.DIAMOND ? 'text-red-500' : 'text-gray-900';
                  const suitSymbol = card.suit === Suit.SPADE ? '♠' : card.suit === Suit.HEART ? '♥' : card.suit === Suit.DIAMOND ? '♦' : '♣';

                  return (
                    <motion.button
                      key={card.id}
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => toggleDiscardCardSelection(card)}
                      className={`
                        w-12 h-16 rounded-lg font-bold transition-all duration-200
                        flex flex-col items-center justify-center bg-white
                        ${isSelected
                          ? 'ring-2 ring-green-400 border-2 border-green-400'
                          : 'border-2 border-gray-300 hover:border-green-400/50'
                        }
                      `}
                      style={{
                        boxShadow: isSelected
                          ? '0 0 15px rgba(74, 222, 128, 0.5), 0 4px 10px rgba(0, 0, 0, 0.2)'
                          : '0 2px 8px rgba(0, 0, 0, 0.2)'
                      }}
                    >
                      <span className={`text-sm ${suitColor}`}>{card.rank}</span>
                      <span className={`text-lg ${suitColor}`}>{suitSymbol}</span>
                    </motion.button>
                  );
                })}
              </div>

              {/* Selection count */}
              <div className="text-white/70 text-sm">
                {selectedDiscardCards.length} / {discardSelectionMaxCount} 枚選択中
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={submitDiscardSelection}
                  className="game-btn-success"
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {selectedDiscardCards.length > 0 ? `${selectedDiscardCards.length}枚回収` : 'スキップ'}
                  </span>
                </motion.button>
              </div>
            </motion.div>
          ) : isPendingRankSelection ? (
            <motion.div
              key="rank-selection"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="flex flex-col items-center gap-4 pointer-events-auto"
            >
              {/* Prompt */}
              <div className="game-panel px-6 py-3">
                <span className="text-yellow-300 font-bold flex items-center gap-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  クイーンボンバー：捨てるランクを選んでください
                </span>
              </div>

              {/* Rank Buttons */}
              <div className="flex flex-wrap justify-center gap-2 max-w-full px-4">
                {(['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as Rank[]).map((rank) => {
                  const card = CardFactory.create(Suit.SPADE, rank);
                  const isSelected = selectedCards.length > 0 && selectedCards[0].rank === rank;

                  return (
                    <motion.button
                      key={rank}
                      whileHover={{ scale: 1.1, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        useSelectionStore.setState({ selectedCards: [card] });
                      }}
                      className={`
                        w-14 h-16 rounded-xl font-bold transition-all duration-200
                        flex flex-col items-center justify-center
                        ${isSelected
                          ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-black border-2 border-yellow-300'
                          : 'bg-gradient-to-br from-gray-700 to-gray-800 text-white border-2 border-gray-600 hover:border-yellow-500/50'
                        }
                      `}
                      style={{
                        boxShadow: isSelected
                          ? '0 0 20px rgba(255, 215, 0, 0.5), 0 4px 15px rgba(0, 0, 0, 0.3)'
                          : '0 4px 10px rgba(0, 0, 0, 0.3)'
                      }}
                    >
                      <span className="text-xl">{rank}</span>
                      <span className="text-xs opacity-60">?</span>
                    </motion.button>
                  );
                })}
              </div>

              {/* Confirm Button */}
              {selectedCards.length === 1 && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    const rank = selectedCards[0].rank;
                    submitQueenBomberRank(rank);
                  }}
                  className="game-btn-success"
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    決定
                  </span>
                </motion.button>
              )}
            </motion.div>
          ) : isPendingCardSelection ? (
            (() => {
              const passValidationResult = cardSelectionValidator ? cardSelectionValidator.validate([]) : { valid: false };
              const isPassValid = passValidationResult.valid;
              const isPassSelected = selectedCards.length === 0;
              const isOnlyPassValid = isPassValid && validCombinations.length === 0;
              const isCurrentSelectionValid = isPassSelected ? isPassValid : canPlaySelected;
              const buttonText = isPassSelected ? 'パス' : '決定';
              const invalidReason = !isCurrentSelectionValid
                ? (isPassSelected
                  ? (passValidationResult.reason || 'パスできません')
                  : (validationResult.reason || '選択されたカードの組み合わせは無効です'))
                : '';

              return (
                <motion.div
                  key="card-selection"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  className="flex flex-col items-center gap-4 pointer-events-auto"
                >
                  {/* Prompt */}
                  {cardSelectionPrompt && (
                    <div className="game-panel px-6 py-3">
                      <span className="text-yellow-300 font-bold flex items-center gap-2">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        {cardSelectionPrompt}
                      </span>
                    </div>
                  )}

                  {/* Action Button with Effect Preview */}
                  <div className="relative inline-block">
                    {/* Effect Preview / Error Message */}
                    <AnimatePresence>
                      {selectedCards.length > 0 && (isCurrentSelectionValid ? (
                        (triggerEffects.length > 0 || validationResult.reason) && (
                          <div className="absolute bottom-full left-1/2 mb-3 w-screen max-w-4xl" style={{ transform: 'translateX(-50%)' }}>
                            <motion.div
                              initial={{ opacity: 0, y: 10, scale: 0.9 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 10, scale: 0.9 }}
                              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                              className="flex flex-col gap-2 items-center px-4"
                            >
                              {/* Valid Reason (Green) */}
                              {validationResult.reason && (
                                <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white px-4 py-2 rounded-lg font-bold shadow-lg text-sm border border-emerald-400/30"
                                  style={{ boxShadow: '0 0 15px rgba(16, 185, 129, 0.4)' }}
                                >
                                  {validationResult.reason}
                                </div>
                              )}
                              {/* Triggered Effects (Gold badges) */}
                              {triggerEffects.length > 0 && (
                                <div className="flex flex-wrap gap-2 justify-center max-w-full">
                                  {triggerEffects.map((effect: string, index: number) => (
                                    <motion.div
                                      key={index}
                                      initial={{ opacity: 0, scale: 0.8 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      transition={{ delay: index * 0.05 }}
                                      className="bg-gradient-to-r from-yellow-500 to-amber-500 text-black px-4 py-2 rounded-lg font-bold shadow-lg text-sm border border-yellow-300/50"
                                      style={{ boxShadow: '0 0 15px rgba(255, 215, 0, 0.4)' }}
                                    >
                                      {effect}
                                    </motion.div>
                                  ))}
                                </div>
                              )}
                            </motion.div>
                          </div>
                        )
                      ) : (
                        invalidReason && (
                          <div className="absolute bottom-full left-1/2 mb-3" style={{ transform: 'translateX(-50%)' }}>
                            <motion.div
                              initial={{ opacity: 0, y: 10, scale: 0.9 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 10, scale: 0.9 }}
                              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                              className="bg-gradient-to-r from-red-600 to-red-500 text-white px-4 py-2 rounded-lg font-bold shadow-lg text-sm border border-red-400/30 whitespace-nowrap"
                              style={{ boxShadow: '0 0 15px rgba(239, 68, 68, 0.4)' }}
                            >
                              {invalidReason}
                            </motion.div>
                          </div>
                        )
                      ))}
                    </AnimatePresence>

                    <motion.button
                      whileHover={isCurrentSelectionValid ? { scale: 1.05 } : {}}
                      whileTap={isCurrentSelectionValid ? { scale: 0.95 } : {}}
                      onClick={isCurrentSelectionValid ? () => {
                        // GuestPlayerControllerはHumanPlayerControllerを継承しており、
                        // cardSelectionCallbackを使用するため、常にsubmitCardSelectionを使用
                        submitCardSelection();
                      } : undefined}
                      disabled={!isCurrentSelectionValid}
                      className={`
                        ${isCurrentSelectionValid
                          ? isOnlyPassValid
                            ? 'game-btn-danger animate-pulse'
                            : isPassSelected
                            ? 'game-btn-secondary'
                            : 'game-btn-success'
                          : 'game-btn opacity-50 cursor-not-allowed'
                        }
                      `}
                    >
                      <span className="flex items-center gap-2">
                        {isPassSelected ? (
                          <>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                            </svg>
                            パス
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            決定
                          </>
                        )}
                      </span>
                    </motion.button>
                  </div>
                </motion.div>
              );
            })()
          ) : (
            <motion.div
              key="waiting"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="text-center pointer-events-auto"
            >
              <div className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-black/40 backdrop-blur-sm border border-white/10">
                <div className="flex gap-1">
                  <motion.div
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}
                    className="w-2 h-2 rounded-full bg-yellow-400"
                  />
                  <motion.div
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
                    className="w-2 h-2 rounded-full bg-yellow-400"
                  />
                  <motion.div
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
                    className="w-2 h-2 rounded-full bg-yellow-400"
                  />
                </div>
                <span className="text-white/70">
                  {isGameInitializing ? '準備中...' : `${currentPlayer.name} のターン`}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};
