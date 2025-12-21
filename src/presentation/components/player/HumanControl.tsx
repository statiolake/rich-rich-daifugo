import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { PlayerType } from '../../../core/domain/player/Player';
import { GamePhaseType } from '../../../core/domain/game/GameState';
import { PlayValidator } from '../../../core/rules/basic/PlayValidator';
import { LocalPlayerService } from '../../../core/domain/player/LocalPlayerService';
import { useMemo, useState } from 'react';
import { useWindowResize } from '../../hooks/useWindowResize';

export const HumanControl: React.FC = () => {
  const gameState = useGameStore(state => state.gameState);
  const selectedCards = useGameStore(state => state.selectedCards);
  const error = useGameStore(state => state.error);
  const playCards = useGameStore(state => state.playCards);
  const pass = useGameStore(state => state.pass);
  const clearError = useGameStore(state => state.clearError);

  // ウィンドウ高さを state で管理（リサイズ対応）
  const [screenHeight, setScreenHeight] = useState(window.innerHeight);

  // ウィンドウリサイズを監視
  useWindowResize(() => {
    setScreenHeight(window.innerHeight);
  }, 200);

  // 有効な手をストアから取得
  const getValidCombinations = useGameStore(state => state.getValidCombinations);
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

  // バリデーターで出せるかを判定
  const validator = new PlayValidator();
  const canPlaySelected = selectedCards.length > 0 &&
    validator.isValidPlay(humanPlayer, selectedCards, gameState.field, gameState).valid;
  const canPass = validator.canPass(gameState.field).valid;
  // パスを目立たせるのは、合法手が一つもないときだけ
  const shouldHighlightPass = validCombinations.length === 0 && canPass;

  return (
    <div
      className="absolute left-0 right-0 p-6 bg-gradient-to-b from-black/70 via-black/50 to-transparent z-60 pointer-events-none"
      style={{ top: `${screenHeight - 280}px` }}
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
        {isHumanTurn ? (
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
              <button
                onClick={() => playCards(selectedCards)}
                className="px-8 py-4 text-xl font-bold rounded-lg shadow-lg transition-all bg-blue-500 hover:bg-blue-600 text-white cursor-pointer"
              >
                出す ({selectedCards.length}枚)
              </button>
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

            {/* 無効な手を選んだ場合のメッセージ */}
            {selectedCards.length > 0 && !canPlaySelected && canPass && (
              <div className="text-white text-lg font-bold opacity-75">その手は出せません</div>
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
  );
};
