import { useGameStore } from '../../store/gameStore';
import { Card } from '../card/Card';
import { PlayerType } from '../../../core/domain/player/Player';

export const HumanControl: React.FC = () => {
  const gameState = useGameStore(state => state.gameState);
  const selectedCards = useGameStore(state => state.selectedCards);
  const playCards = useGameStore(state => state.playCards);
  const pass = useGameStore(state => state.pass);
  const toggleCardSelection = useGameStore(state => state.toggleCardSelection);

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
      {/* 手札 */}
      <div className="flex justify-center gap-2 mb-4 flex-wrap">
        {humanPlayer.hand.getCards().map((card) => (
          <Card
            key={card.id}
            card={card}
            isSelected={selectedCards.some(c => c.id === card.id)}
            onClick={isHumanTurn ? () => toggleCardSelection(card) : undefined}
          />
        ))}
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
