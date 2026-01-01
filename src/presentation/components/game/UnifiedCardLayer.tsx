import { motion } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { useCardPositionStore } from '../../store/cardPositionStore';
import { GamePhaseType } from '../../../core/domain/game/GameState';
import { Card } from '../card/Card';
import { CardFactory, Card as CardType } from '../../../core/domain/card/Card';
import { useEffect, useMemo } from 'react';
import { useWindowResize } from '../../hooks/useWindowResize';
import { handSize, handGetCards, handGetForbiddenFinishCardIds } from '../../../core/domain/card/Hand';

export const UnifiedCardLayer: React.FC = () => {
  const cardPositions = useCardPositionStore((state) => state.cards);
  const gameState = useGameStore((state) => state.gameState);
  const selectedCards = useGameStore((state) => state.selectedCards);
  const toggleCardSelection = useGameStore((state) => state.toggleCardSelection);
  const syncWithGameState = useCardPositionStore((state) => state.syncWithGameState);

  // すべてのフックを最初に呼び出す
  // 有効な役をストアから取得
  const getValidCombinations = useGameStore(state => state.getValidCombinations);
  const cardSelectionValidator = useGameStore(state => state.cardSelectionValidator);
  const validCombinations = useMemo(() => getValidCombinations(), [getValidCombinations, gameState, gameState?.field.history.length, cardSelectionValidator]);

  // ゲーム状態から特殊ルールの状態を取得
  const getRuleEngine = useGameStore(state => state.getRuleEngine);
  const clearSelection = useGameStore(state => state.clearSelection);
  const localPlayerId = useGameStore(state => state.localPlayerId);
  const localPlayer = gameState?.players.find(p => p.id === localPlayerId) ?? null;

  // カード選択リクエスト・ランク選択リクエストの状態を取得（新しいアーキテクチャ）
  const isCardSelectionEnabled = useGameStore(state => state.isCardSelectionEnabled);
  const isQueenBomberRankSelectionEnabled = useGameStore(state => state.isQueenBomberRankSelectionEnabled);
  const isPendingCardSelection = isCardSelectionEnabled;
  const isPendingRankSelection = isQueenBomberRankSelectionEnabled;

  // validatorがbottom type（すべて禁止）かどうかをチェック
  // TODO: 特殊ルール用のバリデーター実装が必要
  const isValidatorBottomType = false;

  // 新しいバリデーションが適用されたときに選択状態をリセット
  useEffect(() => {
    if (isPendingCardSelection || isPendingRankSelection) {
      console.log('New validation applied, clearing selection');
      clearSelection();
    }
  }, [isPendingCardSelection, isPendingRankSelection, clearSelection]);

  // 禁止上がりのカードを決める（Hand.getForbiddenFinishCardIds()を使用）
  const forbiddenFinishCards = useMemo(() => {
    if (!localPlayer || !gameState) return new Set<string>();

    const ruleEngine = getRuleEngine();
    return handGetForbiddenFinishCardIds(localPlayer.hand, 
      localPlayer,
      gameState.field,
      gameState,
      ruleEngine
    );
  }, [localPlayer, gameState, getRuleEngine]);

  // 光らせるカードを決める
  const legalCards = useMemo(() => {
    const legal = new Set<string>();

    if (!localPlayer) return legal;

    // 優先順位1: ランク選択リクエスト中は、カード選択を無効化
    if (isPendingRankSelection) {
      return legal; // 空のSet（選択不可）
    }

    // 優先順位2: カード選択リクエストがある場合
    if (isPendingCardSelection) {
      // validCombinations を使って有効な組み合わせに含まれるカードをハイライト
      // 選択したカードが部分集合になっている出せる手をすべて見つけ、
      // その手に含まれるカードの和集合を光らせる
      validCombinations.forEach((combo) => {
        // この役が選択状態を部分集合として含むか確認
        const isSubset = selectedCards.every((selectedCard) =>
          combo.some((c) => c.id === selectedCard.id)
        );

        if (isSubset) {
          // この役のすべてのカードを光らせる
          combo.forEach((card) => {
            legal.add(card.id);
          });
        }
      });
      return legal;
    }

    // 優先順位3: カード選択が有効化されていない場合は何も光らせない
    // HumanPlayerController.chooseCardsInHand() が呼ばれて初めてハイライトする
    // ゲーム開始直後など、まだ選択が有効化されていない状態ではハイライトしない
    return legal;
  }, [validCombinations, selectedCards, localPlayer, gameState, isValidatorBottomType, isPendingCardSelection, isPendingRankSelection]);

  // 54枚のカードオブジェクトを取得（ジョーカーは固定IDなので毎回同じになる）
  const allCards = useMemo(() => CardFactory.createDeck(true), []);

  // GameStateの変化を監視してCardPositionを同期
  useEffect(() => {
    if (gameState) {
      syncWithGameState(gameState);
    }
  }, [
    gameState,
    gameState?.field.history.length,
    gameState?.currentPlayerIndex,
    syncWithGameState,
  ]);

  // ウィンドウリサイズを監視してCardPositionを再計算
  useWindowResize(() => {
    if (gameState) {
      syncWithGameState(gameState);
    }
  }, 200);

  // CPUプレイヤーの一番上のカードIDとその手札枚数を計算
  const cpuTopCardInfo = useMemo(() => {
    if (!gameState) return new Map<string, number>();

    const info = new Map<string, number>(); // cardId -> cardCount

    gameState.players.forEach((player) => {
      // CPUプレイヤーのみ
      if (player.type !== 'HUMAN') {
        const handCards = handGetCards(player.hand);
        if (handCards.length > 0) {
          // 一番最後のカード（一番上に表示されるカード）のIDと枚数を記録
          const topCard = handCards[handCards.length - 1];
          info.set(topCard.id, handCards.length);
        }
      }
    });

    return info;
  }, [gameState, gameState?.players.map(p => handSize(p.hand)).join(',')]);

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

        // 自分の手札であればすべてクリック可能（valid/invalidに関わらず）
        const isClickable =
          cardPos.location === 'hand' && cardPos.ownerId === localPlayerId;

        // bottom type（確定後）の時はdim
        const isHandCard = cardPos.isFaceUp && cardPos.location === 'hand' && cardPos.ownerId === localPlayerId;
        const isForbiddenFinish = isHandCard && forbiddenFinishCards.has(card.id);
        const shouldDim = isHandCard && (isValidatorBottomType || isForbiddenFinish);

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
            <div className="relative">
              <Card
                card={card}
                isSelected={isSelected}
                isFaceUp={cardPos.isFaceUp}
                cardCount={cpuTopCardInfo.get(card.id)}
                onClick={isClickable ? () => handleCardClick(card.id) : undefined}
                className={
                  isHandCard
                    ? shouldDim
                      ? 'opacity-50'
                      : legalCards.has(card.id)
                      ? isSelected
                        ? 'drop-shadow-[0_0_40px_rgba(250,204,21,1)] drop-shadow-[0_0_80px_rgba(234,179,8,0.9)]'
                        : 'ring-2 ring-blue-400 border-blue-300 border-2 drop-shadow-[0_0_30px_rgba(96,165,250,0.95)] drop-shadow-[0_0_60px_rgba(147,197,253,0.7)]'
                      : ''
                    : ''
                }
              />
              {/* 禁止上がりのバッテンマーク */}
              {isForbiddenFinish && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-red-600 text-6xl font-bold drop-shadow-[0_0_10px_rgba(0,0,0,0.8)]">
                    ✕
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};
