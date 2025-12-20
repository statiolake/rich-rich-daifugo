import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { Card } from '../card/Card';
import { PlayerType } from '../../../core/domain/player/Player';
import { useRef } from 'react';

export const HumanControl: React.FC = () => {
  const gameState = useGameStore(state => state.gameState);
  const selectedCards = useGameStore(state => state.selectedCards);
  const error = useGameStore(state => state.error);
  const playCards = useGameStore(state => state.playCards);
  const pass = useGameStore(state => state.pass);
  const toggleCardSelection = useGameStore(state => state.toggleCardSelection);
  const clearError = useGameStore(state => state.clearError);
  const addMovingCard = useGameStore(state => state.addMovingCard);

  // カード要素への参照を保持
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

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

  // カードを場に出す処理（移動アニメーション付き）
  const handlePlayCards = () => {
    if (selectedCards.length === 0) return;

    // 場の位置を取得（画面中央）
    const fieldX = window.innerWidth / 2 - 32; // カード幅の半分を引く (64px / 2)
    const fieldY = window.innerHeight / 2 - 48; // カード高さの半分を引く (96px / 2)

    // 各カードの現在位置を取得して移動アニメーションを開始
    selectedCards.forEach(card => {
      const cardElement = cardRefs.current.get(card.id);
      if (cardElement) {
        const rect = cardElement.getBoundingClientRect();
        addMovingCard(card, rect.left, rect.top, fieldX, fieldY);
      }
    });

    // 実際のカードプレイ処理を実行
    playCards(selectedCards);
  };

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
              ref={(el) => {
                if (el) {
                  cardRefs.current.set(card.id, el);
                } else {
                  cardRefs.current.delete(card.id);
                }
              }}
              initial={{ opacity: 0, y: 100, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{
                opacity: 0, // 移動アニメーションレイヤーで表示するので消す
                scale: 0.8,
                transition: {
                  duration: 0.2,
                  ease: [0.4, 0, 1, 1]
                }
              }}
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
            onClick={handlePlayCards}
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
