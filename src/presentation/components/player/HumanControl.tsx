import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { PlayerType } from '../../../core/domain/player/Player';
import { GamePhaseType } from '../../../core/domain/game/GameState';
import { LocalPlayerService } from '../../../core/domain/player/LocalPlayerService';
import { useMemo, useState } from 'react';
import { useWindowResize } from '../../hooks/useWindowResize';
import { CardFactory, Suit, Rank } from '../../../core/domain/card/Card';

export const HumanControl: React.FC = () => {
  const gameState = useGameStore(state => state.gameState);
  const selectedCards = useGameStore(state => state.selectedCards);
  const error = useGameStore(state => state.error);
  const playCards = useGameStore(state => state.playCards);
  const pass = useGameStore(state => state.pass);
  const clearError = useGameStore(state => state.clearError);
  const executeSevenPass = useGameStore(state => state.executeSevenPass);
  const executeTenDiscard = useGameStore(state => state.executeTenDiscard);
  const executeQueenBomber = useGameStore(state => state.executeQueenBomber);

  // ウィンドウ高さを state で管理（リサイズ対応）
  const [screenHeight, setScreenHeight] = useState(window.innerHeight);

  // ウィンドウリサイズを監視
  useWindowResize(() => {
    setScreenHeight(window.innerHeight);
  }, 200);

  // 有効な手をストアから取得
  const getValidCombinations = useGameStore(state => state.getValidCombinations);
  const getRuleEngine = useGameStore(state => state.getRuleEngine);
  const validCombinations = useMemo(() => getValidCombinations(), [getValidCombinations, gameState, gameState?.field.getHistory().length]);

  // すべてのフックを呼び出した後に早期リターンチェック
  if (!gameState || gameState.phase === GamePhaseType.RESULT) return null;

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const humanPlayer = LocalPlayerService.findLocalPlayer(gameState);

  // 人間プレイヤーが存在しない、または既に上がっている場合は表示しない
  if (!humanPlayer || humanPlayer.isFinished) {
    return null;
  }

  const isHumanTurn = currentPlayer.type === PlayerType.HUMAN && !currentPlayer.isFinished;

  // 特殊ルール選択が必要かを gameState.pendingSpecialRule から取得
  const pendingSpecialRule = gameState.pendingSpecialRule;
  const isPendingCardSelection = pendingSpecialRule?.type === 'sevenPass' || pendingSpecialRule?.type === 'tenDiscard';
  const isPendingRankSelection = pendingSpecialRule?.type === 'queenBomber' && !pendingSpecialRule?.context?.selectedRank;
  const selectionContext = pendingSpecialRule?.context;

  // RuleEngine で出せるかを判定
  const ruleEngine = getRuleEngine();

  // カード選択リクエスト時は単純に1枚選択されているかチェック
  // TODO: 特殊ルール用のバリデーターを実装（10捨てなら10より弱いカードのみ、など）
  const validationResult = isPendingCardSelection
    ? { valid: selectedCards.length === 1 }
    : selectedCards.length > 0
    ? ruleEngine.validate(humanPlayer, selectedCards, gameState.field, gameState)
    : { valid: false };
  const canPlaySelected = validationResult.valid;

  // トリガーエフェクトは実際のプレイ時に発火するため、ここでは空配列
  const triggerEffects: string[] = [];

  const canPass = ruleEngine.canPass(gameState.field).valid;
  // パスを目立たせるのは、合法手が一つもないときだけ
  const shouldHighlightPass = validCombinations.length === 0 && canPass;

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
              クイーンボンバー：全員が捨てるランクを選んでください
            </div>

            {/* 全ランクのボタンを表示 */}
            {(
              <div className="flex flex-nowrap justify-center gap-2 overflow-x-auto max-w-full px-4">
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
                        px-6 py-4 text-xl font-bold rounded-lg shadow-lg transition-all cursor-pointer
                        ${isSelected
                          ? 'bg-yellow-500 text-black ring-4 ring-yellow-300 scale-110'
                          : 'bg-white text-gray-800 hover:bg-gray-200'
                        }
                      `}
                    >
                      <div className="flex flex-col items-center">
                        <div className="text-2xl">{rank}</div>
                        <div className="text-sm text-gray-500">?</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* ランク選択の確定ボタン */}
            {selectedCards.length === 1 && (
              <button
                onClick={() => {
                  const rank = selectedCards[0].rank;
                  executeQueenBomber(humanPlayer.id.value, rank);
                }}
                className="px-8 py-4 text-xl font-bold rounded-lg shadow-lg transition-all bg-green-500 hover:bg-green-600 text-white cursor-pointer"
              >
                決定
              </button>
            )}
          </motion.div>
        ) : isPendingCardSelection ? (
            <motion.div
              key="card-selection"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="flex flex-col items-center gap-4 pointer-events-auto"
            >
            {/* 説明テキスト */}
            <div className="text-white text-lg font-bold bg-blue-600 px-6 py-3 rounded-lg">
              {selectionContext?.message || 'カードを選んでください'}
            </div>

            {/* カード選択の確定ボタン */}
            {canPlaySelected && (
              <button
                onClick={() => {
                  if (pendingSpecialRule?.type === 'sevenPass' && selectedCards.length === 1) {
                    executeSevenPass(humanPlayer.id.value, selectedCards[0]);
                  } else if (pendingSpecialRule?.type === 'tenDiscard' && selectedCards.length === 1) {
                    executeTenDiscard(humanPlayer.id.value, selectedCards[0]);
                  } else if (pendingSpecialRule?.type === 'queenBomber' && pendingSpecialRule.context?.selectedRank) {
                    executeQueenBomber(humanPlayer.id.value, undefined, selectedCards);
                  }
                }}
                className="px-8 py-4 text-xl font-bold rounded-lg shadow-lg transition-all bg-green-500 hover:bg-green-600 text-white cursor-pointer"
              >
                決定
              </button>
            )}
          </motion.div>
        ) : isHumanTurn ? (
          <motion.div
            key="buttons"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="flex justify-center gap-4 pointer-events-auto"
          >
            {/* 出すボタン：選択したカードが有効な場合のみ表示 */}
            {canPlaySelected && (
              <div className="relative inline-block">
                {/* 効果プレビュー */}
                <AnimatePresence>
                  {(validationResult.reason || triggerEffects.length > 0) && selectedCards.length > 0 && (
                    <div className="absolute bottom-full left-1/2 mb-3 w-screen max-w-4xl" style={{ transform: 'translateX(-50%)' }}>
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.9 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                        className="flex flex-col gap-2 items-center px-4"
                      >
                        {/* 理由（valid=trueなら緑、falseなら赤） */}
                        {validationResult.reason && (
                          <div
                            className={`px-4 py-2 rounded-md font-bold shadow-lg text-sm border-2 whitespace-nowrap ${
                              validationResult.valid
                                ? 'bg-green-500 text-white border-green-300'
                                : 'bg-red-500 text-white border-red-300'
                            }`}
                          >
                            {validationResult.reason}
                          </div>
                        )}

                        {/* 発動するイベント（黄色系バッジ） */}
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
                  )}
                </AnimatePresence>

                <button
                  onClick={() => playCards(selectedCards)}
                  className="px-8 py-4 text-xl font-bold rounded-lg shadow-lg transition-all bg-blue-500 hover:bg-blue-600 text-white cursor-pointer"
                >
                  出す
                </button>
              </div>
            )}

            {/* パスボタン：パスができる場合のみ表示 */}
            {canPass && (
              <button
                onClick={pass}
                className={`
                  px-8 py-4 text-xl font-bold rounded-lg shadow-lg transition-all cursor-pointer
                  ${shouldHighlightPass
                    ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse ring-2 ring-red-300'
                    : 'bg-gray-600 hover:bg-gray-700 text-white'}
                `}
              >
                パス
              </button>
            )}

            {/* カード選択を促すメッセージ */}
            {!canPlaySelected && !canPass && selectedCards.length === 0 && (
              <div className="text-white text-lg font-bold opacity-75">場に出すカードを選んでください</div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="waiting"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="text-center text-white text-lg opacity-75 pointer-events-auto"
          >
            {currentPlayer.name} のターン...
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </>
  );
};
