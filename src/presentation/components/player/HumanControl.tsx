import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { PlayerType } from '../../../core/domain/player/Player';
import { GamePhaseType } from '../../../core/domain/game/GameState';
import { LocalPlayerService } from '../../../core/domain/player/LocalPlayerService';
import { useMemo, useState } from 'react';
import { useWindowResize } from '../../hooks/useWindowResize';
import { PlayAnalyzer } from '../../../core/domain/card/Play';
import { CardFactory, Suit, Rank } from '../../../core/domain/card/Card';

export const HumanControl: React.FC = () => {
  const gameState = useGameStore(state => state.gameState);
  const selectedCards = useGameStore(state => state.selectedCards);
  const error = useGameStore(state => state.error);
  const playCards = useGameStore(state => state.playCards);
  const pass = useGameStore(state => state.pass);
  const clearError = useGameStore(state => state.clearError);
  const submitCardSelection = useGameStore(state => state.submitCardSelection);
  const submitRankSelection = useGameStore(state => state.submitRankSelection);
  const getHumanStrategy = useGameStore(state => state.getHumanStrategy);

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

  // HumanStrategyから状態を取得
  const humanStrategy = getHumanStrategy();
  const isPendingCardSelection = humanStrategy?.isPendingCardSelection() || false;
  const isPendingRankSelection = humanStrategy?.isPendingRankSelection() || false;
  const validator = humanStrategy?.getCurrentValidator();
  const selectionContext = humanStrategy?.getCurrentContext();

  // RuleEngine で出せるかを判定
  const ruleEngine = getRuleEngine();

  // カード選択リクエスト時はvalidatorを使う
  const canPlaySelected = isPendingCardSelection && validator
    ? validator(selectedCards).valid
    : selectedCards.length > 0 && ruleEngine.validate(humanPlayer, selectedCards, gameState.field, gameState).valid;

  const canPass = ruleEngine.canPass(gameState.field).valid;
  // パスを目立たせるのは、合法手が一つもないときだけ
  const shouldHighlightPass = validCombinations.length === 0 && canPass;

  // 選択中のカードから発動する効果を判定
  const getEffects = (): { playableReasons: string[]; triggerEffects: string[] } => {
    if (!canPlaySelected || selectedCards.length === 0) return { playableReasons: [], triggerEffects: [] };

    const play = PlayAnalyzer.analyze(selectedCards);
    if (!play) return { playableReasons: [], triggerEffects: [] };

    const playableReasons: string[] = []; // なぜ出せるのか
    const triggerEffects: string[] = []; // 出したときに発動するイベント
    const ruleSettings = gameState.ruleSettings;
    const fieldPlay = gameState.field.getCurrentPlay();

    // === 出せる理由（playableReasons）のチェック ===

    // ダウンナンバー判定
    if (ruleSettings.downNumber && play.type === 'SINGLE' && selectedCards.length === 1 &&
        fieldPlay && fieldPlay.type === 'SINGLE') {
      const playCard = selectedCards[0];
      const fieldCard = fieldPlay.cards[0];
      if (playCard.suit === fieldCard.suit && playCard.strength === fieldCard.strength - 1) {
        playableReasons.push('ダウンナンバー');
      }
    }

    // スぺ3返し判定
    if (ruleSettings.spadeThreeReturn && play.type === 'SINGLE' && selectedCards.length === 1 &&
        selectedCards[0].rank === '3' && selectedCards[0].suit === 'SPADE' &&
        fieldPlay && fieldPlay.cards.length === 1 && fieldPlay.cards[0].rank === 'JOKER') {
      playableReasons.push('スぺ3返し');
    }

    // 砂嵐判定（3x3が何にでも勝つ）
    if (ruleSettings.sandstorm && play.type === 'TRIPLE' && play.cards.every(card => card.rank === '3')) {
      if (fieldPlay && fieldPlay.type === play.type) {
        playableReasons.push('砂嵐');
      }
    }

    // === 発動するイベント（triggerEffects）のチェック ===

    // 砂嵐判定（イベントとしても発動）
    if (ruleSettings.sandstorm && play.type === 'TRIPLE' && play.cards.every(card => card.rank === '3')) {
      triggerEffects.push('砂嵐');
    }

    // 革命判定
    if (play.triggersRevolution) {
      triggerEffects.push(gameState.isRevolution ? '革命終了' : '革命');
    }

    // イレブンバック判定
    if (play.cards.some(card => card.rank === 'J')) {
      triggerEffects.push(gameState.isElevenBack ? 'イレブンバック解除' : 'イレブンバック');
    }

    // 4止め判定（8切りを止める）
    if (ruleSettings.fourStop && play.type === 'PAIR' && play.cards.every(card => card.rank === '4') && gameState.isEightCutPending) {
      triggerEffects.push('4止め');
    }

    // 8切り判定
    if (ruleSettings.eightCut && play.cards.some(card => card.rank === '8')) {
      triggerEffects.push('8切り');
    }

    // 救急車判定（9x2）
    if (ruleSettings.ambulance && play.type === 'PAIR' && play.cards.every(card => card.rank === '9')) {
      triggerEffects.push('救急車');
    }

    // ろくろ首判定（6x2）
    if (ruleSettings.rokurokubi && play.type === 'PAIR' && play.cards.every(card => card.rank === '6')) {
      triggerEffects.push('ろくろ首');
    }

    // エンペラー判定（4種マーク連番）
    if (ruleSettings.emperor && play.type === 'STAIR' && play.cards.length === 4) {
      const suits = new Set(play.cards.map(card => card.suit));
      if (suits.size === 4) {
        triggerEffects.push(gameState.isRevolution ? 'エンペラー終了' : 'エンペラー');
      }
    }

    // クーデター判定（9x3）
    if (ruleSettings.coup && play.type === 'TRIPLE' && play.cards.every(card => card.rank === '9')) {
      triggerEffects.push(gameState.isRevolution ? 'クーデター終了' : 'クーデター');
    }

    // オーメン判定（6x3）
    if (ruleSettings.omen && play.type === 'TRIPLE' && play.cards.every(card => card.rank === '6') && !gameState.isOmenActive) {
      triggerEffects.push('オーメン');
    }

    // 大革命判定（2x4）
    if (ruleSettings.greatRevolution && play.type === 'QUAD' && play.cards.every(card => card.rank === '2')) {
      triggerEffects.push('大革命＋即勝利');
    }

    // 5スキップ判定
    if (ruleSettings.fiveSkip && play.cards.some(card => card.rank === '5')) {
      triggerEffects.push('5スキップ');
    }

    // 7渡し判定
    if (ruleSettings.sevenPass && play.cards.some(card => card.rank === '7')) {
      triggerEffects.push('7渡し');
    }

    // 9リバース判定
    if (ruleSettings.nineReverse && play.cards.some(card => card.rank === '9')) {
      triggerEffects.push('9リバース');
    }

    // 10捨て判定
    if (ruleSettings.tenDiscard && play.cards.some(card => card.rank === '10')) {
      triggerEffects.push('10捨て');
    }

    // クイーンボンバー判定
    if (ruleSettings.queenBomber && play.cards.some(card => card.rank === 'Q')) {
      triggerEffects.push('クイーンボンバー');
    }

    // ラッキーセブン判定
    if (ruleSettings.luckySeven && play.type === 'TRIPLE' && play.cards.every(card => card.rank === '7')) {
      triggerEffects.push('ラッキーセブン');
    }

    // 禁止上がり判定
    const remainingCards = humanPlayer.hand.size() - selectedCards.length;
    if (remainingCards === 0) {
      const forbiddenRanks = ['J', '2', '8', 'JOKER'];
      const hasForbiddenCard = selectedCards.some(card => forbiddenRanks.includes(card.rank));
      if (ruleSettings.forbiddenFinish && hasForbiddenCard) {
        triggerEffects.push('⚠️禁止上がり');
      }
    }

    return { playableReasons, triggerEffects };
  };

  const { playableReasons, triggerEffects } = getEffects();

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
                  submitRankSelection(humanPlayer.id.value, rank);
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

            {/* カード選択の確定ボタンまたはスキップボタン */}
            {(() => {
              // 手札の中に選択可能なカードがあるかチェック
              const hasSelectableCards = validator && humanPlayer.hand.getCards().some(card => validator([card]).valid);
              const canSkip = validator && validator([]).valid;

              if (hasSelectableCards) {
                // 選択可能なカードがある場合：決定ボタンのみ
                return canPlaySelected && (
                  <button
                    onClick={() => submitCardSelection(humanPlayer.id.value, selectedCards)}
                    className="px-8 py-4 text-xl font-bold rounded-lg shadow-lg transition-all bg-green-500 hover:bg-green-600 text-white cursor-pointer"
                  >
                    決定
                  </button>
                );
              } else if (canSkip) {
                // 選択可能なカードがない場合：スキップボタンのみ
                return (
                  <button
                    onClick={() => submitCardSelection(humanPlayer.id.value, [])}
                    className="px-8 py-4 text-xl font-bold rounded-lg shadow-lg transition-all bg-gray-500 hover:bg-gray-600 text-white cursor-pointer"
                  >
                    スキップ
                  </button>
                );
              }
              return null;
            })()}
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
                  {(playableReasons.length > 0 || triggerEffects.length > 0) && (
                    <div className="absolute bottom-full left-1/2 mb-3" style={{ transform: 'translateX(-50%)' }}>
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.9 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                        className="flex flex-col gap-2 items-center"
                      >
                        {/* 出せる理由（青系バッジ） */}
                        {playableReasons.length > 0 && (
                          <div className="flex flex-wrap gap-2 justify-center">
                            {playableReasons.map((reason, index) => (
                              <div
                                key={index}
                                className="bg-blue-500 text-white px-4 py-2 rounded-md font-bold shadow-lg text-sm border-2 border-blue-300"
                              >
                                {reason}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* 発動するイベント（黄色系バッジ） */}
                        {triggerEffects.length > 0 && (
                          <div className="flex flex-wrap gap-2 justify-center">
                            {triggerEffects.map((effect, index) => (
                              <div
                                key={index}
                                className="bg-yellow-400 text-yellow-900 px-4 py-2 rounded-md font-bold shadow-lg text-sm border-2 border-yellow-300"
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
