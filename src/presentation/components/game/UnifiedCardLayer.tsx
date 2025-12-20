import { motion } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { useCardPositionStore } from '../../store/cardPositionStore';
import { Card } from '../card/Card';
import { CardFactory } from '../../../core/domain/card/Card';
import { useEffect, useMemo } from 'react';

export const UnifiedCardLayer: React.FC = () => {
  const cardPositions = useCardPositionStore((state) => state.cards);
  const gameState = useGameStore((state) => state.gameState);
  const selectedCards = useGameStore((state) => state.selectedCards);
  const toggleCardSelection = useGameStore((state) => state.toggleCardSelection);
  const syncWithGameState = useCardPositionStore((state) => state.syncWithGameState);

  // GameStateの変化を監視してCardPositionを同期
  useEffect(() => {
    if (gameState) {
      syncWithGameState(gameState);
    }
  }, [
    gameState,
    gameState?.field.getHistory().length,
    gameState?.currentPlayerIndex,
    syncWithGameState,
  ]);

  // 54枚のカードオブジェクトを取得（変わらないのでuseMemoで最適化）
  const allCards = useMemo(() => CardFactory.createDeck(true), []);

  const handleCardClick = (cardId: string) => {
    const card = allCards.find((c) => c.id === cardId);
    if (card) {
      toggleCardSelection(card);
    }
  };

  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 50 }}>
      {Array.from(cardPositions.values()).map((cardPos) => {
        // CardPositionに対応するCardオブジェクトを取得
        const card = allCards.find((c) => c.id === cardPos.cardId);
        if (!card) return null;

        // このカードが選択されているか確認
        const isSelected = selectedCards.some((c) => c.id === card.id);

        // 手札の人間プレイヤーのカードはクリック可能
        const isClickable =
          cardPos.location === 'hand' && cardPos.ownerId === 'player-0';

        return (
          <motion.div
            key={cardPos.cardId}
            className={isClickable ? 'absolute pointer-events-auto' : 'absolute'}
            style={{
              left: 0,
              top: 0,
              zIndex: cardPos.zIndex,
            }}
            animate={{
              x: cardPos.x,
              y: cardPos.y,
              rotate: cardPos.rotation,
              scale: cardPos.scale,
              opacity: cardPos.opacity,
            }}
            transition={{
              duration: cardPos.transitionDuration / 1000,
              ease: [0.4, 0, 0.2, 1],
            }}
          >
            <Card
              card={card}
              isSelected={isSelected}
              onClick={isClickable ? () => handleCardClick(card.id) : undefined}
              className={cardPos.isFaceUp ? '' : 'bg-gradient-to-br from-blue-600 to-blue-800'}
            />
          </motion.div>
        );
      })}
    </div>
  );
};
