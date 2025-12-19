import { Play } from '../card/Play';
import { PlayerId } from '../player/PlayerId';

export interface PlayHistory {
  play: Play;
  playerId: PlayerId;
  timestamp: number;
}

export class Field {
  private currentPlay: Play | null = null;
  private currentPlayerId: PlayerId | null = null;
  private history: PlayHistory[] = [];

  getCurrentPlay(): Play | null {
    return this.currentPlay;
  }

  getCurrentPlayerId(): PlayerId | null {
    return this.currentPlayerId;
  }

  addPlay(play: Play, playerId: PlayerId): void {
    this.currentPlay = play;
    this.currentPlayerId = playerId;
    this.history.push({
      play,
      playerId,
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.currentPlay = null;
    this.currentPlayerId = null;
  }

  isEmpty(): boolean {
    return this.currentPlay === null;
  }

  getHistory(): readonly PlayHistory[] {
    return this.history;
  }

  getLastPlay(): PlayHistory | null {
    return this.history.length > 0 ? this.history[this.history.length - 1] : null;
  }
}
