/**
 * ロビー画面
 *
 * プレイヤー一覧、CPU追加/削除、ゲーム開始ボタンを表示
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMultiplayerStore } from '../../store/multiplayerStore';
import { NetworkPlayer } from '../../../infrastructure/network/NetworkProtocol';

interface LobbyScreenProps {
  onStartGame: () => void;
  onLeave: () => void;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  onStartGame,
  onLeave,
}) => {
  const {
    mode,
    players,
    localPlayerId,
    localPlayerName,
    canStartGame,
    addCPU,
    removeCPU,
    setLocalPlayerName,
    error,
    setError,
    createOfferForGuest,
    acceptAnswer,
  } = useMultiplayerStore();

  const isHost = mode === 'host';

  // オファーモーダル用の状態
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerCode, setOfferCode] = useState('');
  const [answerInput, setAnswerInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const getPlayerTypeLabel = (player: NetworkPlayer): string => {
    if (player.type === 'HOST') return 'ホスト';
    if (player.type === 'GUEST') return 'ゲスト';
    return 'CPU';
  };

  const getPlayerTypeColor = (player: NetworkPlayer): string => {
    if (player.type === 'HOST') return 'bg-yellow-500/30 text-yellow-300 border-yellow-500/50';
    if (player.type === 'GUEST') return 'bg-blue-500/30 text-blue-300 border-blue-500/50';
    return 'bg-gray-500/30 text-gray-300 border-gray-500/50';
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value.slice(0, 12);
    setLocalPlayerName(newName);
  };

  const handleAddCPU = () => {
    if (players.length >= 8) {
      setError('プレイヤーは最大8人までです');
      return;
    }
    addCPU();
  };

  const handleRemoveCPU = (playerId: string) => {
    removeCPU(playerId);
  };

  // 招待ボタンクリック時にオファーコード生成
  const handleInviteClick = async () => {
    if (!isHost || players.length >= 8) return;

    setShowOfferModal(true);
    setOfferCode('');
    setAnswerInput('');
    setCopySuccess(false);
    setIsGenerating(true);

    try {
      const offer = await createOfferForGuest();
      setOfferCode(offer);
    } catch (err) {
      setError('オファーコードの生成に失敗しました');
      setShowOfferModal(false);
    } finally {
      setIsGenerating(false);
    }
  };

  // オファーコードをコピー
  const handleCopyOffer = async () => {
    try {
      await navigator.clipboard.writeText(offerCode);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      setError('コピーに失敗しました');
    }
  };

  // アンサーを受け入れ
  const handleAcceptAnswer = async () => {
    if (!answerInput.trim()) return;

    setIsAccepting(true);
    try {
      await acceptAnswer('', answerInput.trim());
      setShowOfferModal(false);
      setOfferCode('');
      setAnswerInput('');
    } catch (err) {
      setError('接続に失敗しました');
    } finally {
      setIsAccepting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-lg mx-auto"
    >
      <div className="game-panel p-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-orbitron text-xl text-white font-bold">
            🎮 ロビー
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-white/50 text-sm">
              {players.length}/8 人
            </span>
          </div>
        </div>

        {/* 自分の名前編集 */}
        <div className="mb-6">
          <label className="block text-white/60 text-xs uppercase tracking-wider mb-2">
            あなたの名前
          </label>
          <input
            type="text"
            value={localPlayerName}
            onChange={handleNameChange}
            maxLength={12}
            className="w-full px-4 py-2 bg-black/40 border border-white/20 rounded-lg text-white font-orbitron focus:border-blue-400 focus:outline-none transition-colors"
            placeholder="名前を入力"
          />
        </div>

        {/* プレイヤーリスト */}
        <div className="mb-6">
          <label className="block text-white/60 text-xs uppercase tracking-wider mb-2">
            プレイヤー
          </label>
          <div className="space-y-2">
            {players.map((player, index) => (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center justify-between p-3 bg-black/30 rounded-lg border border-white/10"
              >
                <div className="flex items-center gap-3">
                  <span className="text-white/40 text-sm font-orbitron w-6">
                    {index + 1}.
                  </span>
                  <span className="text-white font-medium">
                    {player.id === localPlayerId ? (
                      <span className="text-yellow-300">{player.name} (あなた)</span>
                    ) : (
                      player.name
                    )}
                  </span>
                  <span
                    className={`px-2 py-0.5 text-xs rounded border ${getPlayerTypeColor(player)}`}
                  >
                    {getPlayerTypeLabel(player)}
                  </span>
                  {!player.isConnected && (
                    <span className="px-2 py-0.5 text-xs rounded bg-red-500/30 text-red-300 border border-red-500/50">
                      切断
                    </span>
                  )}
                </div>

                {/* CPU削除ボタン（ホストのみ） */}
                {isHost && player.type === 'CPU' && (
                  <button
                    onClick={() => handleRemoveCPU(player.id)}
                    className="text-red-400 hover:text-red-300 transition-colors"
                  >
                    ✕
                  </button>
                )}
              </motion.div>
            ))}

            {/* 招待ボタン（ホストのみ、8人未満のとき表示） */}
            {isHost && players.length < 8 && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleInviteClick}
                className="w-full flex items-center justify-center p-3 bg-black/20 rounded-lg border border-dashed border-white/20 hover:border-blue-400/50 hover:bg-blue-500/10 cursor-pointer transition-all"
              >
                <span className="text-sm text-white/50">
                  + プレイヤーを招待
                </span>
              </motion.button>
            )}
          </div>
        </div>

        {/* エラー表示 */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm"
          >
            {error}
          </motion.div>
        )}

        {/* アクションボタン */}
        <div className="space-y-3">
          {/* CPU追加（ホストのみ） */}
          {isHost && players.length < 8 && (
            <button
              onClick={handleAddCPU}
              className="w-full py-3 px-4 bg-gradient-to-r from-gray-600 to-gray-500 hover:from-gray-500 hover:to-gray-400 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2"
            >
              <span>🤖</span>
              <span>CPU を追加</span>
            </button>
          )}

          {/* ゲーム開始（ホストのみ） */}
          {isHost && (
            <button
              onClick={() => {
                console.log('[LobbyScreen] Start game button clicked');
                onStartGame();
              }}
              disabled={!canStartGame()}
              className="w-full py-4 px-4 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 disabled:from-gray-600 disabled:to-gray-500 disabled:cursor-not-allowed text-white font-bold text-lg rounded-lg transition-all"
            >
              {canStartGame() ? 'ゲーム開始' : '4人以上でゲーム開始'}
            </button>
          )}

          {/* ゲスト向け待機メッセージ */}
          {!isHost && (
            <div className="text-center py-4">
              <div className="animate-pulse text-white/60">
                ホストがゲームを開始するのを待っています...
              </div>
            </div>
          )}

          {/* 退出ボタン */}
          <button
            onClick={onLeave}
            className="w-full py-2 px-4 bg-transparent border border-white/20 hover:border-white/40 text-white/60 hover:text-white/80 rounded-lg transition-all"
          >
            退出
          </button>
        </div>

        {/* 接続情報（ホストのみ） */}
        {isHost && (
          <div className="mt-6 pt-4 border-t border-white/10">
            <p className="text-white/40 text-xs text-center">
              空きスロットをクリックしてプレイヤーを招待できます
            </p>
          </div>
        )}
      </div>

      {/* オファーモーダル */}
      <AnimatePresence>
        {showOfferModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
            onClick={() => setShowOfferModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="game-panel p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-orbitron text-lg text-white font-bold mb-4">
                🔗 プレイヤーを招待
              </h3>

              {/* ステップ1: オファーコード */}
              <div className="mb-4">
                <label className="block text-white/60 text-xs uppercase tracking-wider mb-2">
                  ステップ1: このコードを相手に送信
                </label>
                {isGenerating ? (
                  <div className="flex items-center justify-center p-4 bg-black/40 rounded-lg border border-white/20">
                    <div className="animate-spin w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full" />
                    <span className="ml-2 text-white/60">生成中...</span>
                  </div>
                ) : (
                  <div className="relative">
                    <textarea
                      readOnly
                      value={offerCode}
                      className="w-full h-24 px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-white text-xs font-mono resize-none focus:outline-none"
                      placeholder="オファーコード"
                    />
                    <button
                      onClick={handleCopyOffer}
                      disabled={!offerCode}
                      className={`absolute top-2 right-2 px-3 py-1 text-xs font-bold rounded transition-all ${
                        copySuccess
                          ? 'bg-green-500 text-white border border-green-400'
                          : 'bg-blue-500 text-white border border-blue-400 hover:bg-blue-400'
                      }`}
                    >
                      {copySuccess ? 'コピー済み!' : 'コピー'}
                    </button>
                  </div>
                )}
              </div>

              {/* ステップ2: アンサー入力 */}
              <div className="mb-4">
                <label className="block text-white/60 text-xs uppercase tracking-wider mb-2">
                  ステップ2: 相手からのアンサーを貼り付け
                </label>
                <textarea
                  value={answerInput}
                  onChange={(e) => setAnswerInput(e.target.value)}
                  className="w-full h-24 px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-white text-xs font-mono resize-none focus:border-blue-400 focus:outline-none transition-colors"
                  placeholder="アンサーコードを貼り付け..."
                />
              </div>

              {/* アクションボタン */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowOfferModal(false)}
                  className="flex-1 py-2 px-4 bg-transparent border border-white/20 hover:border-white/40 text-white/60 hover:text-white/80 rounded-lg transition-all"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleAcceptAnswer}
                  disabled={!answerInput.trim() || isAccepting}
                  className="flex-1 py-2 px-4 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 disabled:from-gray-600 disabled:to-gray-500 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all"
                >
                  {isAccepting ? '接続中...' : '接続'}
                </button>
              </div>

              {/* 手順説明 */}
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-white/40 text-xs">
                  1. オファーコードをコピーして相手に送信<br />
                  2. 相手がゲームに参加してアンサーを生成<br />
                  3. 相手から受け取ったアンサーを貼り付けて接続
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
