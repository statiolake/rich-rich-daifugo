/**
 * マルチプレイヤーフロー制御コンポーネント
 *
 * 画面遷移を制御:
 * 1. モード選択（ホスト/参加）
 * 2. シグナリング（接続確立）
 * 3. ロビー（プレイヤー待機）
 * 4. ゲーム開始
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMultiplayerStore } from '../../store/multiplayerStore';
import { useGameStore } from '../../store/gameStore';
import { useCardPositionStore } from '../../store/cardPositionStore';
import { SignalingPanel } from './SignalingPanel';
import { LobbyScreen } from './LobbyScreen';
import { deserializeGameState } from '../../../infrastructure/network/GameStateSerializer';
import { GuestInputHandler } from '../../../infrastructure/network/GuestInputHandler';
import { HostMessage } from '../../../infrastructure/network/NetworkProtocol';
import { CardFactory } from '../../../core/domain/card/Card';

type FlowStep = 'mode_select' | 'signaling' | 'lobby';

interface MultiplayerFlowProps {
  initialPlayerName?: string;
  onStartGame: () => void;
  onCancel: () => void;
}

export const MultiplayerFlow: React.FC<MultiplayerFlowProps> = ({
  initialPlayerName = '',
  onStartGame,
  onCancel,
}) => {
  const [step, setStep] = useState<FlowStep>('mode_select');
  const [playerName, setPlayerName] = useState(initialPlayerName);

  const {
    mode,
    connectionState,
    players,
    localPlayerId,
    initAsHost,
    initAsGuest,
    createOfferForGuest,
    acceptAnswer,
    acceptOffer,
    reset,
    setHostMessageHandler,
    sendToHost,
  } = useMultiplayerStore();

  const updateGameStateFromHost = useGameStore(state => state.updateGameStateFromHost);
  const setGuestMode = useGameStore(state => state.setGuestMode);
  const enableGuestCardSelection = useGameStore(state => state.enableGuestCardSelection);
  const initializeCardPositions = useCardPositionStore(state => state.initialize);

  // GuestInputHandler のインスタンスを保持
  const guestInputHandlerRef = useRef<GuestInputHandler | null>(null);

  // ゲストが接続完了したらロビーに移動
  useEffect(() => {
    if (mode === 'guest' && connectionState === 'connected' && players.length > 0) {
      setStep('lobby');
    }
  }, [mode, connectionState, players.length]);

  // ゲスト側: GuestInputHandlerを初期化
  useEffect(() => {
    if (mode === 'guest') {
      guestInputHandlerRef.current = new GuestInputHandler({
        sendResponse: (message) => {
          sendToHost(message);
        },
        onCardSelectionRequest: (request) => {
          if (request.type !== 'CARD_SELECTION') return;
          // カード選択UIを有効化
          enableGuestCardSelection(
            request.validCardIds,
            request.canPass,
            (selectedCardIds, isPass) => {
              // 選択完了時にGuestInputHandlerに通知
              guestInputHandlerRef.current?.submitCardSelection(selectedCardIds, isPass);
            },
            'カードを選択してください'
          );
        },
        onRankSelectionRequest: (_request) => {
          // TODO: ランク選択UIを表示
          console.log('[Guest] Rank selection requested');
        },
        onExchangeRequest: (_request) => {
          // TODO: カード交換UIを表示
          console.log('[Guest] Exchange requested');
        },
      });
    }

    return () => {
      guestInputHandlerRef.current?.dispose();
      guestInputHandlerRef.current = null;
    };
  }, [mode, sendToHost, enableGuestCardSelection]);

  // ホストメッセージハンドラを設定
  useEffect(() => {
    if (mode === 'guest') {
      const handleHostMessage = (message: HostMessage) => {
        switch (message.type) {
          case 'GAME_STARTED':
            // ゲーム開始メッセージを受信
            setGuestMode(true);
            // カードデッキを初期化（ジョーカー含む54枚）
            const allCards = CardFactory.createDeck(true);
            initializeCardPositions(allCards);
            if (message.initialState) {
              const gameState = deserializeGameState(message.initialState, localPlayerId);
              updateGameStateFromHost(gameState);
            }
            onStartGame();
            break;

          case 'GAME_STATE':
            // ゲーム状態を更新
            if (message.state) {
              const gameState = deserializeGameState(message.state, localPlayerId);
              updateGameStateFromHost(gameState);
            }
            break;

          case 'INPUT_REQUEST':
            // 入力リクエストを処理
            if (guestInputHandlerRef.current && message.request) {
              guestInputHandlerRef.current.handleRequest(message.request);
            }
            break;

          case 'GAME_ENDED':
            console.log('[Guest] Game ended:', message.finalRankings);
            break;

          case 'PLAYER_DISCONNECTED':
            console.log('[Guest] Player disconnected:', message.playerId);
            break;
        }
      };

      setHostMessageHandler(handleHostMessage);
    }
  }, [mode, localPlayerId, setHostMessageHandler, onStartGame, updateGameStateFromHost, setGuestMode, initializeCardPositions]);

  const handleSelectHost = () => {
    const name = playerName.trim() || 'ホスト';
    initAsHost(name);
    setStep('lobby'); // シグナリングをスキップして直接ロビーへ
  };

  const handleSelectGuest = () => {
    const name = playerName.trim() || 'ゲスト';
    initAsGuest(name);
    setStep('signaling');
  };

  const handleSignalingComplete = () => {
    setStep('lobby');
  };

  const handleLeave = () => {
    reset();
    onCancel();
  };

  const handleBackToSignaling = () => {
    // ホストの場合のみ、ロビーからシグナリングに戻れる（新しいゲストを追加するため）
    if (mode === 'host') {
      setStep('signaling');
    }
  };

  // ホスト用: オファー生成
  const handleCreateOffer = async (): Promise<string> => {
    return await createOfferForGuest();
  };

  // ホスト用: アンサー受け入れ
  const handleAcceptAnswer = async (answer: string): Promise<void> => {
    await acceptAnswer('', answer);
    // 接続成功したらロビーに移動
    setStep('lobby');
  };

  // ゲスト用: オファー受け入れ
  const handleAcceptOffer = async (offer: string): Promise<string> => {
    return await acceptOffer(offer);
  };

  return (
    <div className="w-full h-screen game-board-bg flex items-center justify-center">
      <AnimatePresence mode="wait">
        {/* モード選択 */}
        {step === 'mode_select' && (
          <motion.div
            key="mode_select"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-md mx-auto px-4"
          >
            <div className="game-panel p-6">
              <h2 className="font-orbitron text-2xl text-white font-bold text-center mb-6">
                🌐 マルチプレイ
              </h2>

              {/* プレイヤー名入力 */}
              <div className="mb-6">
                <label className="block text-white/60 text-xs uppercase tracking-wider mb-2">
                  あなたの名前
                </label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  maxLength={12}
                  placeholder="プレイヤー名"
                  className="w-full px-4 py-3 bg-black/40 border border-white/20 rounded-lg text-white font-orbitron focus:border-blue-400 focus:outline-none transition-colors"
                />
              </div>

              <div className="space-y-4">
                <button
                  onClick={handleSelectHost}
                  className="w-full py-4 px-4 bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-white font-bold text-lg rounded-lg transition-all flex items-center justify-center gap-3"
                >
                  <span className="text-2xl">👑</span>
                  <div className="text-left">
                    <div>ホストとして開始</div>
                    <div className="text-xs opacity-70">部屋を作成して友達を招待</div>
                  </div>
                </button>

                <button
                  onClick={handleSelectGuest}
                  className="w-full py-4 px-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold text-lg rounded-lg transition-all flex items-center justify-center gap-3"
                >
                  <span className="text-2xl">🎮</span>
                  <div className="text-left">
                    <div>ゲームに参加</div>
                    <div className="text-xs opacity-70">ホストのコードを入力して参加</div>
                  </div>
                </button>

                <button
                  onClick={onCancel}
                  className="w-full py-2 px-4 bg-transparent border border-white/20 hover:border-white/40 text-white/60 hover:text-white/80 rounded-lg transition-all"
                >
                  戻る
                </button>
              </div>

              {/* 手順説明 */}
              <div className="mt-6 pt-4 border-t border-white/10">
                <h3 className="text-white/60 text-xs uppercase tracking-wider mb-2">
                  接続方法
                </h3>
                <ol className="text-white/50 text-xs space-y-1 list-decimal list-inside">
                  <li>ホストがコードを生成</li>
                  <li>Discord等でコードを共有</li>
                  <li>ゲストがコードを入力</li>
                  <li>アンサーコードをホストに送信</li>
                </ol>
              </div>
            </div>
          </motion.div>
        )}

        {/* シグナリング */}
        {step === 'signaling' && (
          <motion.div
            key="signaling"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full px-4"
          >
            <SignalingPanel
              mode={mode as 'host' | 'guest'}
              onCreateOffer={handleCreateOffer}
              onAcceptAnswer={handleAcceptAnswer}
              onAcceptOffer={handleAcceptOffer}
              onCancel={handleLeave}
              isConnected={connectionState === 'connected'}
            />

            {/* 接続完了後、ロビーへ進むボタン（ホストのみ） */}
            {mode === 'host' && connectionState === 'connected' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-md mx-auto mt-4"
              >
                <button
                  onClick={handleSignalingComplete}
                  className="w-full py-3 px-4 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-bold rounded-lg transition-all"
                >
                  ロビーへ進む →
                </button>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ロビー */}
        {step === 'lobby' && (
          <motion.div
            key="lobby"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full px-4"
          >
            <LobbyScreen
              onStartGame={onStartGame}
              onLeave={handleLeave}
            />

            {/* ホストの場合、追加のプレイヤーを招待するボタン */}
            {mode === 'host' && players.length < 4 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="max-w-lg mx-auto mt-4"
              >
                <button
                  onClick={handleBackToSignaling}
                  className="w-full py-2 px-4 bg-transparent border border-white/20 hover:border-white/40 text-white/60 hover:text-white/80 rounded-lg transition-all"
                >
                  + 別のプレイヤーを招待
                </button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
