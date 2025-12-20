import { motion } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { useCardPositionStore } from '../../store/cardPositionStore';
import { GamePhaseType } from '../../../core/domain/game/GameState';
import { Card } from '../card/Card';
import { CardFactory, Card as CardType } from '../../../core/domain/card/Card';
import { PlayValidator } from '../../../core/rules/basic/PlayValidator';
import { useEffect, useMemo } from 'react';

export const UnifiedCardLayer: React.FC = () => {
  const cardPositions = useCardPositionStore((state) => state.cards);
  const gameState = useGameStore((state) => state.gameState);
  const selectedCards = useGameStore((state) => state.selectedCards);
  const toggleCardSelection = useGameStore((state) => state.toggleCardSelection);
  const syncWithGameState = useCardPositionStore((state) => state.syncWithGameState);

  // ヘルパー関数を先に定義（useMemoで使用するため）
  const generateCombinationsForSize = (
    cards: CardType[],
    size: number
  ): CardType[][] => {
    if (size === 1) {
      return cards.map((card) => [card]);
    }

    const result: CardType[][] = [];
    for (let i = 0; i < cards.length; i++) {
      const remaining = cards.slice(i + 1);
      const restCombos = generateCombinationsForSize(remaining, size - 1);
      for (const combo of restCombos) {
        result.push([cards[i], ...combo]);
      }
    }

    return result;
  };

  const generateCombinations = (cards: CardType[]): CardType[][] => {
    const result: CardType[][] = [];

    // 1～4枚の組み合わせ
    for (let size = 1; size <= Math.min(4, cards.length); size++) {
      const combos = generateCombinationsForSize(cards, size);
      result.push(...combos);
    }

    return result;
  };

  // すべてのフックを最初に呼び出す
  // 有効な役を見つける
  const validCombinations = useMemo(() => {
    if (!gameState) return [];

    const humanPlayer = gameState.players.find(p => p.id.value === 'player-0');
    if (!humanPlayer) return [];

    const validator = new PlayValidator();
    const validCombos: CardType[][] = [];

    // すべての組み合わせを試す
    const allCombinations = generateCombinations([...humanPlayer.hand.getCards()]);
    for (const combo of allCombinations) {
      const validation = validator.isValidPlay(humanPlayer, combo, gameState.field, gameState);
      if (validation.valid) {
        validCombos.push(combo);
      }
    }

    return validCombos;
  }, [gameState]);

  // 光らせるカードを決める
  const legalCards = useMemo(() => {
    const legal = new Set<string>();

    if (selectedCards.length === 0) {
      // 何も選んでない場合：すべての有効な役に含まれるカードを光らせる
      validCombinations.forEach((combo) => {
        combo.forEach((card) => {
          legal.add(card.id);
        });
      });
    } else {
      // 何か選んでいる場合：その選択に関連する有効な役に含まれるカードのみを光らせる
      const selectedIds = new Set(selectedCards.map((c) => c.id));

      validCombinations.forEach((combo) => {
        // この役に選択済みカードが1枚以上含まれているか確認
        const hasSelectedCard = combo.some((card) => selectedIds.has(card.id));

        if (hasSelectedCard) {
          // 含まれている場合、この役のすべてのカードを光らせる
          combo.forEach((card) => {
            legal.add(card.id);
          });
        }
      });
    }

    return legal;
  }, [validCombinations, selectedCards]);

  // 54枚のカードオブジェクトを取得（ジョーカーは固定IDなので毎回同じになる）
  const allCards = useMemo(() => CardFactory.createDeck(true), []);

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

  // すべてのフックを呼び出した後に早期リターンチェック
  if (!gameState || gameState.phase === GamePhaseType.RESULT) {
    return null;
  }

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

        // 合法手のカードのみクリック可能
        const isClickable =
          cardPos.location === 'hand' && cardPos.ownerId === 'player-0' && legalCards.has(card.id);

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
              isFaceUp={cardPos.isFaceUp}
              onClick={isClickable ? () => handleCardClick(card.id) : undefined}
              className={
                cardPos.isFaceUp && cardPos.location === 'hand' && cardPos.ownerId === 'player-0'
                  ? legalCards.has(card.id)
                    ? isSelected
                      ? 'drop-shadow-[0_0_40px_rgba(250,204,21,1)] drop-shadow-[0_0_80px_rgba(234,179,8,0.9)]'
                      : 'ring-2 ring-blue-400 border-blue-300 border-2 drop-shadow-[0_0_30px_rgba(96,165,250,0.95)] drop-shadow-[0_0_60px_rgba(147,197,253,0.7)]'
                    : ''
                  : ''
              }
            />
          </motion.div>
        );
      })}
    </div>
  );
};
