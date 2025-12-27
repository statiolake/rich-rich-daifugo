import { motion } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { useCardPositionStore } from '../../store/cardPositionStore';
import { GamePhaseType } from '../../../core/domain/game/GameState';
import { Card } from '../card/Card';
import { CardFactory, Card as CardType } from '../../../core/domain/card/Card';
import { LocalPlayerService } from '../../../core/domain/player/LocalPlayerService';
import { useEffect, useMemo } from 'react';
import { useWindowResize } from '../../hooks/useWindowResize';

export const UnifiedCardLayer: React.FC = () => {
  const cardPositions = useCardPositionStore((state) => state.cards);
  const gameState = useGameStore((state) => state.gameState);
  const selectedCards = useGameStore((state) => state.selectedCards);
  const toggleCardSelection = useGameStore((state) => state.toggleCardSelection);
  const syncWithGameState = useCardPositionStore((state) => state.syncWithGameState);

  // すべてのフックを最初に呼び出す
  // 有効な役をストアから取得
  const getValidCombinations = useGameStore(state => state.getValidCombinations);
  const validCombinations = useMemo(() => getValidCombinations(), [getValidCombinations, gameState, gameState?.field.getHistory().length]);

  // HumanStrategyを取得してvalidatorを確認
  const getHumanStrategy = useGameStore(state => state.getHumanStrategy);
  const getRuleEngine = useGameStore(state => state.getRuleEngine);
  const clearSelection = useGameStore(state => state.clearSelection);
  const humanStrategy = getHumanStrategy();
  const humanPlayer = gameState ? LocalPlayerService.findLocalPlayer(gameState) : null;

  // カード選択リクエスト・ランク選択リクエストの状態を取得
  const isPendingCardSelection = humanStrategy?.isPendingCardSelection() || false;
  const isPendingRankSelection = humanStrategy?.isPendingRankSelection() || false;

  // validatorがbottom type（すべて禁止）かどうかをチェック
  const isValidatorBottomType = useMemo(() => {
    const validator = humanStrategy?.getCurrentValidator();
    if (!validator) return false;

    // 空配列で試してみて、それも無効なら bottom type
    const emptyResult = validator([]);
    if (emptyResult.valid) return false;

    // 手札の任意のカードで試してみる
    if (humanPlayer) {
      const handCards = humanPlayer.hand.getCards();
      if (handCards.length > 0) {
        const anyCardResult = validator([handCards[0]]);
        return !anyCardResult.valid;
      }
    }

    return true;
  }, [humanStrategy, humanPlayer]);

  // 新しいバリデーションが適用されたときに選択状態をリセット
  useEffect(() => {
    if (isPendingCardSelection || isPendingRankSelection) {
      console.log('New validation applied, clearing selection');
      clearSelection();
    }
  }, [isPendingCardSelection, isPendingRankSelection, clearSelection]);

  // 禁止上がりのカードを決める（バリデーターを使用）
  const forbiddenFinishCards = useMemo(() => {
    const forbidden = new Set<string>();

    if (!humanPlayer || !gameState) return forbidden;

    const ruleEngine = getRuleEngine();
    const handCards = humanPlayer.hand.getCards();

    // 各カードについてバリデーションを実行
    handCards.forEach((card) => {
      const validation = ruleEngine.validate(humanPlayer, [card], gameState.field, gameState);
      // バリデーション失敗で、理由に「上がることができません」が含まれている場合
      if (!validation.valid && validation.reason?.includes('上がることができません')) {
        forbidden.add(card.id);
      }
    });

    return forbidden;
  }, [humanPlayer, gameState, getRuleEngine]);

  // 光らせるカードを決める
  const legalCards = useMemo(() => {
    const legal = new Set<string>();

    if (!humanPlayer) return legal;

    // 優先順位1: ランク選択リクエスト中は、カード選択を無効化
    if (isPendingRankSelection) {
      return legal; // 空のSet（選択不可）
    }

    // 優先順位2: カード選択リクエストがある場合（validatorが存在する場合）
    if (isPendingCardSelection) {
      const validator = humanStrategy?.getCurrentValidator();
      if (validator && !isValidatorBottomType) {
        const handCards = humanPlayer.hand.getCards();

        // 各カードが単独で有効かチェック（1枚選択の場合）
        handCards.forEach((card) => {
          if (validator([card]).valid) {
            legal.add(card.id);
          }
        });

        // 空配列が有効な場合もある（スキップ可能な場合）
        // この場合は手札を光らせないが、UIで「スキップ」ボタンを表示

        return legal;
      }
      // validator が bottom type の場合は空のSet
      return legal;
    }

    // 優先順位3: 通常のプレイ時
    // humanのターンの時だけハイライト
    const currentPlayer = gameState?.players[gameState.currentPlayerIndex];
    const isHumanTurn = currentPlayer?.id.value === humanPlayer.id.value;

    if (!isHumanTurn) {
      return legal; // 敵のターンは何も光らせない
    }

    // isPendingPlayでなくても、自分のターンならカードを選択可能にする
    // （場が流れた直後など、まだdecidePlay()が呼ばれていない状態でも選択できるようにする）

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
  }, [validCombinations, selectedCards, humanStrategy, humanPlayer, gameState, isValidatorBottomType, isPendingCardSelection, isPendingRankSelection]);

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

  // ウィンドウリサイズを監視してCardPositionを再計算
  useWindowResize(() => {
    if (gameState) {
      syncWithGameState(gameState);
    }
  }, 200);

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
        const localPlayerId = gameState ? LocalPlayerService.getLocalPlayerId(gameState) : undefined;
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
