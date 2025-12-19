import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { Card } from '../card/Card';
import { PlayerType } from '../../../core/domain/player/Player';

export const HumanControl: React.FC = () => {
  const gameState = useGameStore(state => state.gameState);
  const selectedCards = useGameStore(state => state.selectedCards);
  const error = useGameStore(state => state.error);
  const playCards = useGameStore(state => state.playCards);
  const pass = useGameStore(state => state.pass);
  const toggleCardSelection = useGameStore(state => state.toggleCardSelection);
  const clearError = useGameStore(state => state.clearError);

  if (!gameState) return null;

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const humanPlayer = gameState.players.find(p => p.type === PlayerType.HUMAN);

  // 人間プレイヤーが存在しない、または既に上がっている場合は表示しない
  if (!humanPlayer || humanPlayer.isFinished) {
    return null;
  }

  const isHumanTurn = currentPlayer.type === PlayerType.HUMAN && !currentPlayer.isFinished;
  const canPlay = selectedCards.length > 0;
  const canPass = !gameState.field.isEmpty();

  return (
    <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/70 via-black/50 to-transparent">
      {/* エラーメッセージ */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="mb-4 mx-auto max-w-md"
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

      {/* 手札 */}
      <div className="flex justify-center gap-2 mb-4 flex-wrap">
        <AnimatePresence mode="popLayout">
          {humanPlayer.hand.getCards().map((card, index) => (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, y: 50, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -50, scale: 0.8 }}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 25,
                delay: index * 0.02
              }}
              layout
            >
              <Card
                card={card}
                isSelected={selectedCards.some(c => c.id === card.id)}
                onClick={isHumanTurn ? () => {
                  toggleCardSelection(card);
                  // カード選択時にエラーをクリア
                  if (error) clearError();
                } : undefined}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* 操作ボタン */}
      {isHumanTurn ? (
        <div className="flex justify-center gap-4">
          <button
            onClick={() => playCards(selectedCards)}
            disabled={!canPlay}
            className={`
              px-8 py-4 text-xl font-bold rounded-lg shadow-lg transition-all
              ${canPlay
                ? 'bg-blue-500 hover:bg-blue-600 text-white cursor-pointer'
                : 'bg-gray-500 text-gray-300 cursor-not-allowed opacity-50'}
            `}
          >
            出す
          </button>

          <button
            onClick={pass}
            disabled={!canPass}
            className={`
              px-8 py-4 text-xl font-bold rounded-lg shadow-lg transition-all
              ${canPass
                ? 'bg-red-500 hover:bg-red-600 text-white cursor-pointer'
                : 'bg-gray-500 text-gray-300 cursor-not-allowed opacity-50'}
            `}
          >
            パス
          </button>
        </div>
      ) : (
        <div className="text-center text-white text-lg opacity-75">
          {currentPlayer.name} のターン...
        </div>
      )}
    </div>
  );
};
