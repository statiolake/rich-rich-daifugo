/**
 * ロビー画面
 *
 * プレイヤー一覧、CPU追加/削除、ゲーム開始ボタンを表示
 * 複数の招待を並行して行えるUI
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMultiplayerStore } from '../../store/multiplayerStore';
import { NetworkPlayer } from '../../../infrastructure/network/NetworkProtocol';

interface LobbyScreenProps {
  onStartGame: () => void;
  onLeave: () => void;
}

// 招待スロットの状態
interface InviteSlot {
  id: string;
  status: 'generating' | 'waiting_copy' | 'waiting_answer' | 'connecting' | 'connected' | 'error';
  offerCode: string;
  copied: boolean;
  error?: string;
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

  // 招待スロットの状態管理
  const [inviteSlots, setInviteSlots] = useState<InviteSlot[]>([]);

  // アンサー入力モーダル
  const [answerModalSlotId, setAnswerModalSlotId] = useState<string | null>(null);
  const [answerInput, setAnswerInput] = useState('');
  const [isAccepting, setIsAccepting] = useState(false);

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
    if (players.length + inviteSlots.length >= 8) {
      setError('プレイヤーは最大8人までです');
      return;
    }
    addCPU();
  };

  const handleRemoveCPU = (playerId: string) => {
    removeCPU(playerId);
  };

  // 招待スロットを追加
  const handleAddInviteSlot = useCallback(async () => {
    if (players.length + inviteSlots.length >= 8) {
      setError('プレイヤーは最大8人までです');
      return;
    }

    const slotId = `invite-${Date.now()}`;

    // 生成中状態でスロットを追加
    setInviteSlots(prev => [...prev, {
      id: slotId,
      status: 'generating',
      offerCode: '',
      copied: false,
    }]);

    try {
      const offer = await createOfferForGuest();
      setInviteSlots(prev => prev.map(slot =>
        slot.id === slotId
          ? { ...slot, status: 'waiting_copy', offerCode: offer }
          : slot
      ));
    } catch (err) {
      setInviteSlots(prev => prev.map(slot =>
        slot.id === slotId
          ? { ...slot, status: 'error', error: 'オファーコードの生成に失敗しました' }
          : slot
      ));
    }
  }, [players.length, inviteSlots.length, createOfferForGuest, setError]);

  // 招待スロットを削除
  const handleRemoveInviteSlot = useCallback((slotId: string) => {
    setInviteSlots(prev => prev.filter(slot => slot.id !== slotId));
  }, []);

  // オファーコードをコピー
  const handleCopyOffer = useCallback(async (slotId: string, offerCode: string) => {
    try {
      await navigator.clipboard.writeText(offerCode);
      setInviteSlots(prev => prev.map(slot =>
        slot.id === slotId
          ? { ...slot, copied: true, status: 'waiting_answer' }
          : slot
      ));
    } catch (err) {
      setError('コピーに失敗しました');
    }
  }, [setError]);

  // アンサー入力モーダルを開く
  const handleOpenAnswerModal = useCallback((slotId: string) => {
    setAnswerModalSlotId(slotId);
    setAnswerInput('');
  }, []);

  // アンサーを受け入れ
  const handleAcceptAnswer = useCallback(async () => {
    if (!answerModalSlotId || !answerInput.trim()) return;

    setIsAccepting(true);
    setInviteSlots(prev => prev.map(slot =>
      slot.id === answerModalSlotId
        ? { ...slot, status: 'connecting' }
        : slot
    ));

    try {
      await acceptAnswer('', answerInput.trim());
      // 接続成功 - スロットを削除（playersに追加される）
      setInviteSlots(prev => prev.filter(slot => slot.id !== answerModalSlotId));
      setAnswerModalSlotId(null);
      setAnswerInput('');
    } catch (err) {
      setInviteSlots(prev => prev.map(slot =>
        slot.id === answerModalSlotId
          ? { ...slot, status: 'error', error: '接続に失敗しました' }
          : slot
      ));
    } finally {
      setIsAccepting(false);
    }
  }, [answerModalSlotId, answerInput, acceptAnswer]);

  // 利用可能なスロット数
  const availableSlots = 8 - players.length - inviteSlots.length;

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
              {players.length + inviteSlots.length}/8 人
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
            {/* 接続済みプレイヤー */}
            {players.map((player, index) => (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
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

            {/* 招待スロット */}
            {isHost && inviteSlots.map((slot, index) => (
              <motion.div
                key={slot.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-3 bg-blue-900/20 rounded-lg border border-blue-500/30"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-white/40 text-sm font-orbitron w-6">
                      {players.length + index + 1}.
                    </span>
                    <span className="text-blue-300 text-sm">招待中...</span>
                    {slot.status === 'generating' && (
                      <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    )}
                    {slot.status === 'connecting' && (
                      <div className="flex items-center gap-1 text-yellow-300 text-xs">
                        <div className="w-3 h-3 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                        接続中
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveInviteSlot(slot.id)}
                    className="text-red-400 hover:text-red-300 transition-colors text-sm"
                  >
                    ✕
                  </button>
                </div>

                {slot.status === 'error' && (
                  <div className="text-red-400 text-xs mb-2">{slot.error}</div>
                )}

                {(slot.status === 'waiting_copy' || slot.status === 'waiting_answer') && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCopyOffer(slot.id, slot.offerCode)}
                      className={`flex-1 py-2 px-3 text-xs font-bold rounded transition-all flex items-center justify-center gap-1 ${
                        slot.copied
                          ? 'bg-green-500 text-white'
                          : 'bg-blue-500 hover:bg-blue-400 text-white'
                      }`}
                    >
                      {slot.copied ? (
                        <>✓ コピー済み</>
                      ) : (
                        <>📋 招待コードをコピー</>
                      )}
                    </button>
                    <button
                      onClick={() => handleOpenAnswerModal(slot.id)}
                      disabled={!slot.copied}
                      className={`flex-1 py-2 px-3 text-xs font-bold rounded transition-all flex items-center justify-center gap-1 ${
                        slot.copied
                          ? 'bg-purple-500 hover:bg-purple-400 text-white'
                          : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      📝 アンサーを入力
                    </button>
                  </div>
                )}
              </motion.div>
            ))}

            {/* 招待スロット追加ボタン（ホストのみ、空きがある時） */}
            {isHost && availableSlots > 0 && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleAddInviteSlot}
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
          {isHost && availableSlots > 0 && (
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
              「プレイヤーを招待」で招待コードを生成し、相手に送信してください
            </p>
          </div>
        )}
      </div>

      {/* アンサー入力モーダル */}
      <AnimatePresence>
        {answerModalSlotId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
            onClick={() => setAnswerModalSlotId(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="game-panel p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-orbitron text-lg text-white font-bold mb-4">
                📝 アンサーコードを入力
              </h3>

              <p className="text-white/60 text-sm mb-4">
                相手から受け取ったアンサーコードを貼り付けてください
              </p>

              <textarea
                value={answerInput}
                onChange={(e) => setAnswerInput(e.target.value)}
                className="w-full h-32 px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-white text-xs font-mono resize-none focus:border-blue-400 focus:outline-none transition-colors mb-4"
                placeholder="アンサーコードを貼り付け..."
                autoFocus
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setAnswerModalSlotId(null)}
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
