import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { PlayerType } from '../../../core/domain/player/Player';
import { GamePhaseType } from '../../../core/domain/game/GameState';
import { LocalPlayerService } from '../../../core/domain/player/LocalPlayerService';
import { useMemo, useState } from 'react';
import { useWindowResize } from '../../hooks/useWindowResize';
import { PlayAnalyzer } from '../../../core/domain/card/Play';

export const HumanControl: React.FC = () => {
  const gameState = useGameStore(state => state.gameState);
  const selectedCards = useGameStore(state => state.selectedCards);
  const error = useGameStore(state => state.error);
  const playCards = useGameStore(state => state.playCards);
  const pass = useGameStore(state => state.pass);
  const clearError = useGameStore(state => state.clearError);
  const submitCardSelection = useGameStore(state => state.submitCardSelection);

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

  // カード選択リクエストがあるか確認
  const cardSelectionRequest = gameState.cardSelectionRequest;
  const needsCardSelection = cardSelectionRequest && cardSelectionRequest.playerId === humanPlayer.id.value;

  // RuleEngine で出せるかを判定
  const ruleEngine = getRuleEngine();
  const canPlaySelected = selectedCards.length > 0 &&
    ruleEngine.validate(humanPlayer, selectedCards, gameState.field, gameState).valid;
  const canPass = ruleEngine.canPass(gameState.field).valid;
  // パスを目立たせるのは、合法手が一つもないときだけ
  const shouldHighlightPass = validCombinations.length === 0 && canPass;

  // カード選択の説明テキスト
  const getSelectionDescription = () => {
    if (!cardSelectionRequest) return '';
    switch (cardSelectionRequest.reason) {
      case 'sevenPass':
        const targetPlayer = gameState.players.find(p => p.id.value === cardSelectionRequest.targetPlayerId);
        return `7渡し：${targetPlayer?.name}に渡すカードを1枚選んでください`;
      case 'tenDiscard':
        return '10捨て：捨てるカードを1枚選んでください';
      case 'queenBomber':
        // Qボンバーの場合、現在のプレイヤー名を表示
        if (humanPlayer.hand.isEmpty()) {
          return `クイーンボンバー：${humanPlayer.name}の手札がないのでスキップします`;
        }
        return `クイーンボンバー：${humanPlayer.name}が捨てるカードを1枚選んでください`;
      default:
        return 'カードを選んでください';
    }
  };

  // 選択中のカードから発動する効果を判定
  const getEffects = (): string[] => {
    if (!canPlaySelected || selectedCards.length === 0) return [];

    const play = PlayAnalyzer.analyze(selectedCards);
    if (!play) return [];

    const effects: string[] = [];
    const ruleSettings = gameState.ruleSettings;

    // 革命判定
    if (play.triggersRevolution) {
      effects.push(gameState.isRevolution ? '革命終了' : '革命');
    }

    // イレブンバック判定
    if (play.cards.some(card => card.rank === 'J')) {
      effects.push(gameState.isElevenBack ? 'イレブンバック解除' : 'イレブンバック');
    }

    // 4止め判定（8切りを止める）
    if (ruleSettings.fourStop && play.type === 'PAIR' && play.cards.every(card => card.rank === '4') && gameState.isEightCutPending) {
      effects.push('4止め');
    }

    // 8切り判定
    if (ruleSettings.eightCut && play.cards.some(card => card.rank === '8')) {
      effects.push('8切り');
    }

    // 救急車判定（9x2）
    if (ruleSettings.ambulance && play.type === 'PAIR' && play.cards.every(card => card.rank === '9')) {
      effects.push('救急車');
    }

    // ろくろ首判定（6x2）
    if (ruleSettings.rokurokubi && play.type === 'PAIR' && play.cards.every(card => card.rank === '6')) {
      effects.push('ろくろ首');
    }

    // エンペラー判定（4種マーク連番）
    if (ruleSettings.emperor && play.type === 'STAIR' && play.cards.length === 4) {
      const suits = new Set(play.cards.map(card => card.suit));
      if (suits.size === 4) {
        effects.push(gameState.isRevolution ? 'エンペラー終了' : 'エンペラー');
      }
    }

    // クーデター判定（9x3）
    if (ruleSettings.coup && play.type === 'TRIPLE' && play.cards.every(card => card.rank === '9')) {
      effects.push(gameState.isRevolution ? 'クーデター終了' : 'クーデター');
    }

    // オーメン判定（6x3）
    if (ruleSettings.omen && play.type === 'TRIPLE' && play.cards.every(card => card.rank === '6') && !gameState.isOmenActive) {
      effects.push('オーメン');
    }

    // 大革命判定（2x4）
    if (ruleSettings.greatRevolution && play.type === 'QUAD' && play.cards.every(card => card.rank === '2')) {
      effects.push('大革命＋即勝利');
    }

    // 砂嵐判定（3x3）
    if (ruleSettings.sandstorm && play.type === 'TRIPLE' && play.cards.every(card => card.rank === '3')) {
      effects.push('砂嵐');
    }

    // 5スキップ判定
    if (ruleSettings.fiveSkip && play.cards.some(card => card.rank === '5')) {
      effects.push('5スキップ');
    }

    // 7渡し判定
    if (ruleSettings.sevenPass && play.cards.some(card => card.rank === '7')) {
      effects.push('7渡し');
    }

    // 9リバース判定
    if (ruleSettings.nineReverse && play.cards.some(card => card.rank === '9')) {
      effects.push('9リバース');
    }

    // 10捨て判定
    if (ruleSettings.tenDiscard && play.cards.some(card => card.rank === '10')) {
      effects.push('10捨て');
    }

    // クイーンボンバー判定
    if (ruleSettings.queenBomber && play.cards.some(card => card.rank === 'Q')) {
      effects.push('クイーンボンバー');
    }

    // スぺ3返し判定
    const fieldPlay = gameState.field.getCurrentPlay();
    if (ruleSettings.spadeThreeReturn && play.type === 'SINGLE' && selectedCards.length === 1 &&
        selectedCards[0].rank === '3' && selectedCards[0].suit === 'SPADE' &&
        fieldPlay && fieldPlay.cards.length === 1 && fieldPlay.cards[0].rank === 'JOKER') {
      effects.push('スぺ3返し');
    }

    // 禁止上がり判定
    const remainingCards = humanPlayer.hand.size() - selectedCards.length;
    if (remainingCards === 0) {
      const forbiddenRanks = ['J', '2', '8', 'JOKER'];
      const hasForbiddenCard = selectedCards.some(card => forbiddenRanks.includes(card.rank));
      if (ruleSettings.forbiddenFinish && hasForbiddenCard) {
        effects.push('⚠️禁止上がり');
      }
    }

    return effects;
  };

  const effects = getEffects();

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
        {needsCardSelection ? (
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
              {getSelectionDescription()}
            </div>

            {/* 確定ボタン */}
            {(selectedCards.length === cardSelectionRequest?.count ||
              (humanPlayer.hand.isEmpty() && cardSelectionRequest?.reason === 'queenBomber')) && (
              <button
                onClick={() => submitCardSelection(humanPlayer.id.value, selectedCards)}
                className="px-8 py-4 text-xl font-bold rounded-lg shadow-lg transition-all bg-green-500 hover:bg-green-600 text-white cursor-pointer"
              >
                {humanPlayer.hand.isEmpty() ? 'スキップ' : '決定'}
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
                {/* 効果プレビュー吹き出し */}
                <AnimatePresence>
                  {effects.length > 0 && (
                    <div className="absolute bottom-full left-1/2 mb-3" style={{ transform: 'translateX(-50%)' }}>
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.9 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                        className="relative"
                      >
                        {/* 吹き出し本体 */}
                        <div className="bg-yellow-400 text-yellow-900 px-6 py-3 rounded-lg font-bold shadow-lg text-center whitespace-nowrap">
                          {effects.map((effect, index) => (
                            <div key={index}>{effect}</div>
                          ))}
                        </div>
                        {/* 吹き出しの三角形 */}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                          <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-yellow-400"></div>
                        </div>
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
