import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { GamePhaseType } from '../../../core/domain/game/GameState';
import { LocalPlayerService } from '../../../core/domain/player/LocalPlayerService';
import { useMemo, useState } from 'react';
import { useWindowResize } from '../../hooks/useWindowResize';
import { CardFactory, Suit, Rank } from '../../../core/domain/card/Card';

export const HumanControl: React.FC = () => {
  const gameState = useGameStore(state => state.gameState);
  const selectedCards = useGameStore(state => state.selectedCards);
  const error = useGameStore(state => state.error);
  const clearError = useGameStore(state => state.clearError);
  const submitCardSelection = useGameStore(state => state.submitCardSelection);
  const submitQueenBomberRank = useGameStore(state => state.submitQueenBomberRank);

  // ウィンドウ高さを state で管理（リサイズ対応）
  const [screenHeight, setScreenHeight] = useState(window.innerHeight);

  // ウィンドウリサイズを監視
  useWindowResize(() => {
    setScreenHeight(window.innerHeight);
  }, 200);

  // 有効な手をストアから取得
  const getValidCombinations = useGameStore(state => state.getValidCombinations);
  const cardSelectionValidatorForMemo = useGameStore(state => state.cardSelectionValidator);

  // 特殊ルール選択が必要かを新しいアーキテクチャから取得（フックはすべて早期リターンの前に呼び出す）
  const isCardSelectionEnabled = useGameStore(state => state.isCardSelectionEnabled);
  const isQueenBomberRankSelectionEnabled = useGameStore(state => state.isQueenBomberRankSelectionEnabled);
  const cardSelectionValidator = useGameStore(state => state.cardSelectionValidator);
  const cardSelectionPrompt = useGameStore(state => state.cardSelectionPrompt);

  const validCombinations = useMemo(() => getValidCombinations(), [getValidCombinations, gameState, gameState?.field.getHistory().length, cardSelectionValidatorForMemo]);

  // すべてのフックを呼び出した後に早期リターンチェック
  // RESULT フェーズでは何も表示しない
  if (!gameState || gameState.phase === GamePhaseType.RESULT) return null;

  // SETUP フェーズ（ゲーム初期化中）は準備中を表示
  const isGameInitializing = gameState.phase === GamePhaseType.SETUP;

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const humanPlayer = LocalPlayerService.findLocalPlayer(gameState);

  // 人間プレイヤーが存在しない、または既に上がっている場合は表示しない
  if (!humanPlayer || humanPlayer.isFinished) {
    return null;
  }

  const isPendingCardSelection = isCardSelectionEnabled;
  const isPendingRankSelection = isQueenBomberRankSelectionEnabled;

  // カード選択リクエスト時はcardSelectionValidatorを使用
  // cardSelectionValidatorがない場合（未初期化など）は無効
  // validatorがtriggeredEffectsを返すかどうかで効果プレビューの表示が決まる
  const validationResult = isPendingCardSelection
    ? (cardSelectionValidator ? cardSelectionValidator.validate(selectedCards) : { valid: false })
    : { valid: false };
  const canPlaySelected = validationResult.valid;

  // 発動するエフェクトを取得（validatorが返す場合のみ表示される）
  const triggerEffects = validationResult.triggeredEffects || [];

  const needsSelection = isPendingCardSelection || isPendingRankSelection;

  return (
    <>
      {/* カード選択時のblurオーバーレイ */}
      {needsSelection && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/30 z-65 pointer-events-none" />
      )}

      <div
        className="absolute left-0 right-0 p-6 bg-gradient-to-b from-black/70 via-black/50 to-transparent pointer-events-none"
        style={{
          top: `${screenHeight - 280}px`,
          zIndex: needsSelection ? 70 : 60
        }}
      >
        {/* エラーメッセージ */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="mb-4 mx-auto max-w-md pointer-events-auto"
            >
              <div className="bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center justify-between">
                <span>{error}</span>
                <button
                  onClick={clearError}
                  className="ml-4 text-white hover:text-gray-200 text-xl font-bold"
                >
                  ×
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 手札は UnifiedCardLayer で表示される */}

        {/* 操作ボタン */}
        <AnimatePresence mode="wait">
          {isPendingRankSelection ? (
            <motion.div
              key="rank-selection"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="flex flex-col items-center gap-4 pointer-events-auto"
            >
            {/* 説明テキスト */}
            <div className="text-white text-lg font-bold bg-blue-600 px-6 py-3 rounded-lg">
              クイーンボンバー：捨てるランクを選んでください
            </div>

            {/* 全ランクのボタンを表示 */}
            <div className="flex flex-wrap justify-center gap-2 max-w-full px-4">
              {(['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as Rank[]).map((rank) => {
                // 仮のカード（スートは?を表現するためSPADEを使用）
                const card = CardFactory.create(Suit.SPADE, rank);
                const isSelected = selectedCards.length > 0 && selectedCards[0].rank === rank;

                return (
                  <button
                    key={rank}
                    onClick={() => {
                      // 他のカードを選択解除してから選択
                      useGameStore.setState({ selectedCards: [card] });
                    }}
                    className={`
                      px-4 py-3 text-lg font-bold rounded-lg shadow-lg transition-all cursor-pointer
                      ${isSelected
                        ? 'bg-yellow-500 text-black ring-4 ring-yellow-300 z-10'
                        : 'bg-white text-gray-800 hover:bg-gray-200'
                      }
                    `}
                  >
                    <div className="flex flex-col items-center">
                      <div className="text-xl">{rank}</div>
                      <div className="text-xs text-gray-500">?</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* ランク選択の確定ボタン */}
            {selectedCards.length === 1 && (
              <button
                onClick={() => {
                  const rank = selectedCards[0].rank;
                  submitQueenBomberRank(rank);
                }}
                className="px-8 py-4 text-xl font-bold rounded-lg shadow-lg transition-all bg-green-500 hover:bg-green-600 text-white cursor-pointer"
              >
                決定
              </button>
            )}
          </motion.div>
        ) : isPendingCardSelection ? (
            (() => {
              // パスが有効かチェック
              const passValidationResult = cardSelectionValidator ? cardSelectionValidator.validate([]) : { valid: false };
              const isPassValid = passValidationResult.valid;
              // 選択なし = パス
              const isPassSelected = selectedCards.length === 0;
              // パスしか有効な手がないかチェック
              const isOnlyPassValid = isPassValid && validCombinations.length === 0;
              // 現在の選択が有効か
              const isCurrentSelectionValid = isPassSelected ? isPassValid : canPlaySelected;
              // ボタンの文言
              const buttonText = isPassSelected ? 'パス' : '決定';
              // invalidな理由を取得（validationResultから取得）
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
                  {/* 説明テキスト：リード文がある場合のみ表示 */}
                  {cardSelectionPrompt && (
                    <div className="text-white text-lg font-bold bg-blue-600 px-6 py-3 rounded-lg">
                      {cardSelectionPrompt}
                    </div>
                  )}

                  {/* 決定/パスボタン */}
                  <div className="relative inline-block">
                    {/* 効果プレビューまたはinvalid時の理由表示 */}
                    <AnimatePresence>
                      {selectedCards.length > 0 && (isCurrentSelectionValid ? (
                        // 有効な選択の場合：効果プレビューと出せる理由を表示
                        (triggerEffects.length > 0 || validationResult.reason) && (
                          <div className="absolute bottom-full left-1/2 mb-3 w-screen max-w-4xl" style={{ transform: 'translateX(-50%)' }}>
                            <motion.div
                              initial={{ opacity: 0, y: 10, scale: 0.9 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 10, scale: 0.9 }}
                              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                              className="flex flex-col gap-2 items-center px-4"
                            >
                              {/* 出せる理由（緑） */}
                              {validationResult.reason && (
                                <div className="bg-green-500 text-white px-4 py-2 rounded-md font-bold shadow-lg text-sm border-2 border-green-300 whitespace-nowrap">
                                  {validationResult.reason}
                                </div>
                              )}
                              {/* 発動するエフェクト（黄色系バッジ） */}
                              {triggerEffects.length > 0 && (
                                <div className="flex flex-col gap-2 items-center max-w-full">
                                  {triggerEffects.map((effect: string, index: number) => (
                                    <div
                                      key={index}
                                      className="bg-yellow-400 text-yellow-900 px-4 py-2 rounded-md font-bold shadow-lg text-sm border-2 border-yellow-300 whitespace-nowrap"
                                    >
                                      {effect}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </motion.div>
                          </div>
                        )
                      ) : (
                        // 無効な選択の場合：エラー理由を表示
                        invalidReason && (
                          <div className="absolute bottom-full left-1/2 mb-3" style={{ transform: 'translateX(-50%)' }}>
                            <motion.div
                              initial={{ opacity: 0, y: 10, scale: 0.9 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 10, scale: 0.9 }}
                              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                              className="bg-red-500 text-white px-4 py-2 rounded-md font-bold shadow-lg text-sm border-2 border-red-300 whitespace-nowrap"
                            >
                              {invalidReason}
                            </motion.div>
                          </div>
                        )
                      ))}
                    </AnimatePresence>

                    <button
                      onClick={isCurrentSelectionValid ? submitCardSelection : undefined}
                      disabled={!isCurrentSelectionValid}
                      className={`
                        px-8 py-4 text-xl font-bold rounded-lg shadow-lg transition-all
                        ${isCurrentSelectionValid
                          ? isOnlyPassValid
                            ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse ring-2 ring-red-300 cursor-pointer'
                            : 'bg-green-500 hover:bg-green-600 text-white cursor-pointer'
                          : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                        }
                      `}
                    >
                      {buttonText}
                    </button>
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
            className="text-center text-white text-lg opacity-75 pointer-events-auto"
          >
            {isGameInitializing ? '準備中...' : `${currentPlayer.name} のターン...`}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </>
  );
};
