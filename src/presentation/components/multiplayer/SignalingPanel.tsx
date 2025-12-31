/**
 * シグナリングパネル
 *
 * WebRTC接続の確立に必要なSDP交換をUI経由で行う
 * ホスト側とゲスト側で異なるフローを提供
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SignalingPanelProps {
  mode: 'host' | 'guest';
  // ホストモード
  onCreateOffer?: () => Promise<string>;
  onAcceptAnswer?: (answer: string) => Promise<void>;
  // ゲストモード
  onAcceptOffer?: (offer: string) => Promise<string>;
  // 共通
  onCancel: () => void;
  isConnected: boolean;
}

type HostStep = 'initial' | 'offer_created' | 'waiting_answer' | 'connected';
type GuestStep = 'initial' | 'answer_created' | 'connected';

export const SignalingPanel: React.FC<SignalingPanelProps> = ({
  mode,
  onCreateOffer,
  onAcceptAnswer,
  onAcceptOffer,
  onCancel,
  isConnected,
}) => {
  // ホストモード用
  const [hostStep, setHostStep] = useState<HostStep>('initial');
  const [offer, setOffer] = useState('');
  const [answerInput, setAnswerInput] = useState('');

  // ゲストモード用
  const [guestStep, setGuestStep] = useState<GuestStep>('initial');
  const [offerInput, setOfferInput] = useState('');
  const [answer, setAnswer] = useState('');

  // 共通
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // 接続完了時にステップを更新
  if (isConnected && mode === 'host' && hostStep !== 'connected') {
    setHostStep('connected');
  }
  if (isConnected && mode === 'guest' && guestStep !== 'connected') {
    setGuestStep('connected');
  }

  // クリップボードにコピー
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      setError('コピーに失敗しました');
    }
  };

  // ホスト: オファー生成
  const handleCreateOffer = async () => {
    if (!onCreateOffer) return;
    setIsProcessing(true);
    setError(null);

    try {
      const generatedOffer = await onCreateOffer();
      setOffer(generatedOffer);
      setHostStep('offer_created');
    } catch (err) {
      setError('オファーの生成に失敗しました');
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  // ホスト: アンサー受け入れ
  const handleAcceptAnswer = async () => {
    if (!onAcceptAnswer || !answerInput.trim()) return;
    setIsProcessing(true);
    setError(null);

    try {
      await onAcceptAnswer(answerInput.trim());
      setHostStep('waiting_answer');
    } catch (err) {
      setError('アンサーの受け入れに失敗しました。正しいアンサーコードを貼り付けてください。');
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  // ゲスト: オファー受け入れ
  const handleAcceptOffer = async () => {
    if (!onAcceptOffer || !offerInput.trim()) return;
    setIsProcessing(true);
    setError(null);

    try {
      const generatedAnswer = await onAcceptOffer(offerInput.trim());
      setAnswer(generatedAnswer);
      setGuestStep('answer_created');
    } catch (err) {
      setError('オファーの受け入れに失敗しました。正しいオファーコードを貼り付けてください。');
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  // ホストモードのUI
  const renderHostUI = () => {
    switch (hostStep) {
      case 'initial':
        return (
          <div className="space-y-4">
            <p className="text-white/80 text-sm">
              「オファー生成」をクリックして、接続コードを生成してください。
            </p>
            <button
              onClick={handleCreateOffer}
              disabled={isProcessing}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:from-gray-600 disabled:to-gray-500 text-white font-bold rounded-lg transition-all"
            >
              {isProcessing ? '生成中...' : 'オファー生成'}
            </button>
          </div>
        );

      case 'offer_created':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-white/60 text-xs uppercase tracking-wider mb-2">
                オファーコード（相手に送信）
              </label>
              <div className="relative">
                <textarea
                  readOnly
                  value={offer}
                  className="w-full h-24 p-3 bg-black/40 border border-white/20 rounded-lg text-white/90 text-xs font-mono resize-none"
                />
                <button
                  onClick={() => copyToClipboard(offer)}
                  className="absolute top-2 right-2 px-2 py-1 bg-white/10 hover:bg-white/20 text-white/80 text-xs rounded transition-colors"
                >
                  {copySuccess ? '✓ コピー済み' : 'コピー'}
                </button>
              </div>
              <p className="text-white/50 text-xs mt-1">
                このコードをDiscord等で相手に送ってください
              </p>
            </div>

            <div className="border-t border-white/10 pt-4">
              <label className="block text-white/60 text-xs uppercase tracking-wider mb-2">
                アンサーコード（相手から受信）
              </label>
              <textarea
                value={answerInput}
                onChange={(e) => setAnswerInput(e.target.value)}
                placeholder="相手から受け取ったアンサーコードを貼り付け"
                className="w-full h-24 p-3 bg-black/40 border border-white/20 rounded-lg text-white/90 text-xs font-mono resize-none placeholder-white/30"
              />
              <button
                onClick={handleAcceptAnswer}
                disabled={isProcessing || !answerInput.trim()}
                className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 disabled:from-gray-600 disabled:to-gray-500 text-white font-bold rounded-lg transition-all"
              >
                {isProcessing ? '接続中...' : '接続する'}
              </button>
            </div>
          </div>
        );

      case 'waiting_answer':
        return (
          <div className="space-y-4 text-center">
            <div className="animate-pulse">
              <div className="w-12 h-12 mx-auto border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-white/80">接続を確立中...</p>
          </div>
        );

      case 'connected':
        return (
          <div className="space-y-4 text-center">
            <div className="text-green-400 text-4xl">✓</div>
            <p className="text-green-400 font-bold">接続完了！</p>
          </div>
        );
    }
  };

  // ゲストモードのUI
  const renderGuestUI = () => {
    switch (guestStep) {
      case 'initial':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-white/60 text-xs uppercase tracking-wider mb-2">
                オファーコード（ホストから受信）
              </label>
              <textarea
                value={offerInput}
                onChange={(e) => setOfferInput(e.target.value)}
                placeholder="ホストから受け取ったオファーコードを貼り付け"
                className="w-full h-24 p-3 bg-black/40 border border-white/20 rounded-lg text-white/90 text-xs font-mono resize-none placeholder-white/30"
              />
            </div>
            <button
              onClick={handleAcceptOffer}
              disabled={isProcessing || !offerInput.trim()}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:from-gray-600 disabled:to-gray-500 text-white font-bold rounded-lg transition-all"
            >
              {isProcessing ? '処理中...' : 'アンサー生成'}
            </button>
          </div>
        );

      case 'answer_created':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-white/60 text-xs uppercase tracking-wider mb-2">
                アンサーコード（ホストに送信）
              </label>
              <div className="relative">
                <textarea
                  readOnly
                  value={answer}
                  className="w-full h-24 p-3 bg-black/40 border border-white/20 rounded-lg text-white/90 text-xs font-mono resize-none"
                />
                <button
                  onClick={() => copyToClipboard(answer)}
                  className="absolute top-2 right-2 px-2 py-1 bg-white/10 hover:bg-white/20 text-white/80 text-xs rounded transition-colors"
                >
                  {copySuccess ? '✓ コピー済み' : 'コピー'}
                </button>
              </div>
              <p className="text-white/50 text-xs mt-1">
                このコードをホストに送ってください
              </p>
            </div>

            <div className="text-center py-4">
              <div className="animate-pulse">
                <div className="w-8 h-8 mx-auto border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-white/60 text-sm mt-2">接続待機中...</p>
            </div>
          </div>
        );

      case 'connected':
        return (
          <div className="space-y-4 text-center">
            <div className="text-green-400 text-4xl">✓</div>
            <p className="text-green-400 font-bold">接続完了！</p>
          </div>
        );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="w-full max-w-md mx-auto"
    >
      <div className="game-panel p-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-orbitron text-xl text-white font-bold">
            {mode === 'host' ? '🎮 ホスト' : '🎮 参加'}
          </h2>
          {!isConnected && (
            <button
              onClick={onCancel}
              className="text-white/50 hover:text-white/80 transition-colors"
            >
              ✕
            </button>
          )}
        </div>

        {/* エラー表示 */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* メインコンテンツ */}
        {mode === 'host' ? renderHostUI() : renderGuestUI()}

        {/* 手順ガイド */}
        {!isConnected && (
          <div className="mt-6 pt-4 border-t border-white/10">
            <h3 className="text-white/60 text-xs uppercase tracking-wider mb-2">
              接続手順
            </h3>
            <ol className="text-white/50 text-xs space-y-1 list-decimal list-inside">
              {mode === 'host' ? (
                <>
                  <li>「オファー生成」をクリック</li>
                  <li>生成されたコードを相手に送信</li>
                  <li>相手からのアンサーコードを貼り付け</li>
                  <li>「接続する」をクリック</li>
                </>
              ) : (
                <>
                  <li>ホストからオファーコードを受け取る</li>
                  <li>コードを貼り付けて「アンサー生成」</li>
                  <li>生成されたアンサーコードをホストに送信</li>
                  <li>接続完了を待つ</li>
                </>
              )}
            </ol>
          </div>
        )}
      </div>
    </motion.div>
  );
};
