/**
 * cutInStore
 *
 * ルール発動時のカットイン表示状態を管理する。
 * gameStore から分離された独立したZustandストア。
 */

import { create } from 'zustand';

export interface RuleCutInData {
  id: string;
  text: string;
  variant?: 'gold' | 'red' | 'blue' | 'green' | 'yellow';
  duration?: number;
  delay?: number;
  verticalPosition?: string;
  onComplete?: () => void;
}

interface CutInStore {
  cutInQueue: RuleCutInData[];
  activeCutIns: RuleCutInData[];
  cutInResolve: (() => void) | null;

  enqueueCutIn: (cutIn: RuleCutInData) => Promise<void>;
  removeCutIn: (id: string) => void;
  processQueue: () => void;
  waitForCutIn: () => Promise<void>;
  reset: () => void;
}

export const useCutInStore = create<CutInStore>((set, get) => ({
  cutInQueue: [],
  activeCutIns: [],
  cutInResolve: null,

  enqueueCutIn: async (cutIn) => {
    return new Promise<void>((resolve) => {
      const cutInWithCallback: RuleCutInData = {
        ...cutIn,
        onComplete: resolve,
      };
      set((state) => ({ cutInQueue: [...state.cutInQueue, cutInWithCallback] }));
      // 次のイベントループでprocessQueueを呼ぶことで、
      // 同時に追加されたカットインが全部キューに入ってからバッチ処理される
      setTimeout(() => get().processQueue(), 0);
    });
  },

  removeCutIn: (id) => {
    // カットインを削除する前に onComplete コールバックを取得
    const { activeCutIns } = get();
    const removedCutIn = activeCutIns.find((c) => c.id === id);

    set((state) => ({ activeCutIns: state.activeCutIns.filter((c) => c.id !== id) }));

    // カットインが削除されたら onComplete を呼び出す
    if (removedCutIn?.onComplete) {
      removedCutIn.onComplete();
    }

    const { activeCutIns: remainingCutIns, cutInResolve, cutInQueue } = get();
    if (remainingCutIns.length === 0) {
      if (cutInResolve) {
        cutInResolve();
        set({ cutInResolve: null });
      }
      if (cutInQueue.length > 0) {
        get().processQueue();
      }
    }
  },

  processQueue: () => {
    const { cutInQueue, activeCutIns } = get();

    if (cutInQueue.length === 0 || activeCutIns.length > 0) {
      return;
    }

    // 最大3つ同時表示
    const batchSize = Math.min(cutInQueue.length, 3);
    const batch = cutInQueue.slice(0, batchSize);
    const rest = cutInQueue.slice(batchSize);

    const calculateVerticalPosition = (index: number, total: number): string => {
      if (total === 1) return '50%';
      const spacing = 100 / (total + 1);
      return `${spacing * (index + 1)}%`;
    };

    // 50msディレイで順次表示
    const cutInsWithDelay = batch.map((cutIn, index) => ({
      ...cutIn,
      delay: index * 50,
      verticalPosition: calculateVerticalPosition(index, batchSize),
    }));

    set({ activeCutIns: cutInsWithDelay, cutInQueue: rest });
  },

  waitForCutIn: async () => {
    const { cutInQueue, activeCutIns } = get();

    if (cutInQueue.length === 0 && activeCutIns.length === 0) {
      return;
    }

    return new Promise<void>((resolve) => {
      set({ cutInResolve: resolve });
    });
  },

  reset: () => {
    set({
      cutInQueue: [],
      activeCutIns: [],
      cutInResolve: null,
    });
  },
}));
