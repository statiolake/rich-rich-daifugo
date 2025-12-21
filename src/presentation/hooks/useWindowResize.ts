import { useEffect } from 'react';

/**
 * ウィンドウリサイズイベントをデバウンス付きで監視するカスタムフック
 * @param callback リサイズ時に実行するコールバック関数
 * @param debounceMs デバウンスの遅延時間（ms）、デフォルト 200ms
 */
export function useWindowResize(callback: () => void, debounceMs = 200) {
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(callback, debounceMs);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, [callback, debounceMs]);
}
