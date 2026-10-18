/**
 * A handle on one player page (one WebView). Controllers send commands
 * through it; the WebView host attaches itself when its page has loaded.
 * Commands sent before that are queued (only the latest load matters, the
 * page keeps its own intent once it exists).
 */
export interface EngineHost {
  run: (js: string) => void;
  /** Throw the page away and build a new one (render process gone, page broken). */
  rebuild: () => void;
}

export class EngineRef {
  private host: EngineHost | null = null;
  private pageLoaded = false;
  private queue: string[] = [];
  private resetListener: (() => void) | null = null;

  attach(host: EngineHost): void {
    this.host = host;
  }

  detach(host: EngineHost): void {
    if (this.host === host) {
      this.host = null;
      this.pageLoaded = false;
    }
  }

  /** The WebView finished loading the page document: flush queued commands. */
  onPageLoaded(): void {
    this.pageLoaded = true;
    const pending = this.queue;
    this.queue = [];
    pending.forEach((js) => this.host?.run(js));
  }

  /** The page is being rebuilt: commands go to the queue until it has loaded. */
  onPageReset(): void {
    this.pageLoaded = false;
    this.resetListener?.();
  }

  onReset(listener: () => void): void {
    this.resetListener = listener;
  }

  run(js: string): void {
    if (this.host && this.pageLoaded) {
      this.host.run(js);
      return;
    }
    this.queue.push(js);
    if (this.queue.length > 20) this.queue.splice(0, this.queue.length - 20);
  }

  rebuild(): void {
    this.host?.rebuild();
  }

  /** The page exists and has loaded (commands run at once instead of queueing). */
  get isReady(): boolean {
    return !!this.host && this.pageLoaded;
  }
}
