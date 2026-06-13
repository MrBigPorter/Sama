/**
 * Hermes Global Polyfills
 *
 * Hermes' static analyzer warns when it encounters references to undeclared
 * global variables. Some of these globals ARE available at runtime (provided
 * by React Native's JavaScript environment), while others are browser-only
 * APIs referenced inside guarded code paths in third-party libraries.
 *
 * This file explicitly declares them on globalThis to satisfy Hermes' static
 * analysis. These declarations are no-ops — they just ensure the identifier
 * exists so Hermes doesn't emit "variable was not declared" warnings.
 *
 * IMPORTANT: Hermes' static analyzer only recognizes the bare
 * `typeof X === 'undefined'` pattern. Do NOT use `typeof (globalThis as any).X`
 * or the analyzer will not register the declaration.
 *
 * Must be imported at the entry point (App.tsx) BEFORE any other code.
 */

// ── Type declarations ────────────────────────────────────────────────────

declare var performance: any;
declare var requestIdleCallback: any;
declare var cancelIdleCallback: any;
declare var location: any;
declare var navigator: any;
declare var setInterval: any;
declare var getComputedStyle: any;
declare var structuredClone: any;

// ── Timers ───────────────────────────────────────────────────────────────

if (typeof clearTimeout === 'undefined') {
  (globalThis as any).clearTimeout = function clearTimeout(_id?: number) {
    // React Native's clearTimeout is always available at runtime.
  };
}

if (typeof setImmediate === 'undefined') {
  (globalThis as any).setImmediate = function setImmediate(
    fn: (...args: any[]) => void,
    ..._args: any[]
  ): number {
    return setTimeout(fn, 0) as unknown as number;
  };
}

if (typeof clearInterval === 'undefined') {
  (globalThis as any).clearInterval = function clearInterval(_id?: number) {
    // Provided by RN.
  };
}

if (typeof setInterval === 'undefined') {
  (globalThis as any).setInterval = function setInterval(
    _fn: (...args: any[]) => void,
    _ms?: number,
    ..._args: any[]
  ): number {
    return 0;
  };
}

// ── Performance API (available in Hermes since RN 0.70+) ─────────────────

if (typeof performance === 'undefined') {
  (globalThis as any).performance = {
    now: function now(): number {
      return Date.now();
    },
    timing: { navigationStart: 0 },
  };
}

// ── Fetch-related globals ────────────────────────────────────────────────

if (typeof Blob === 'undefined') {
  (globalThis as any).Blob = class Blob {
    constructor(_parts?: any[], _options?: any) {
      // Full Blob implementation provided by RN at runtime
    }
    get size(): number {
      return 0;
    }
    get type(): string {
      return '';
    }
    slice(_start?: number, _end?: number, _contentType?: string): any {
      return new (globalThis as any).Blob();
    }
  } as any;
}

if (typeof FileReader === 'undefined') {
  (globalThis as any).FileReader = class FileReader {
    readyState = 0;
    result: any = null;
    error: any = null;
    onload: any = null;
    onerror: any = null;

    readAsArrayBuffer(_blob: any): void {
      // Provided by RN at runtime
    }
    readAsText(_blob: any, _encoding?: string): void {
      // Provided by RN at runtime
    }
    readAsDataURL(_blob: any): void {
      // Provided by RN at runtime
    }
    abort(): void {
      // Provided by RN at runtime
    }
  } as any;
}

if (typeof FormData === 'undefined') {
  (globalThis as any).FormData = class FormData {
    private _data: Map<string, any> = new Map();

    append(key: string, value: any): void {
      this._data.set(key, value);
    }
    delete(key: string): void {
      this._data.delete(key);
    }
    get(key: string): any {
      return this._data.get(key);
    }
    getAll(key: string): any[] {
      const val = this._data.get(key);
      return val !== undefined ? [val] : [];
    }
    has(key: string): boolean {
      return this._data.has(key);
    }
    set(key: string, value: any): void {
      this._data.set(key, value);
    }
    forEach(
      callbackfn: (value: any, key: string, parent: any) => void,
      _thisArg?: any,
    ): void {
      this._data.forEach((v, k) => callbackfn(v, k, this));
    }
    entries(): IterableIterator<[string, any]> {
      return this._data.entries();
    }
    keys(): IterableIterator<string> {
      return this._data.keys();
    }
    values(): IterableIterator<any> {
      return this._data.values();
    }
  } as any;
}

if (typeof URLSearchParams === 'undefined') {
  (globalThis as any).URLSearchParams = class URLSearchParams {
    private params = new Map<string, string>();

    constructor(
      init?: string | Record<string, string> | string[][] | undefined,
    ) {
      if (typeof init === 'string') {
        init.split('&').forEach(pair => {
          const [k, v] = pair.split('=');
          if (k) {
            this.params.set(decodeURIComponent(k), decodeURIComponent(v || ''));
          }
        });
      }
    }

    append(name: string, value: string): void {
      this.params.set(name, value);
    }
    delete(name: string): void {
      this.params.delete(name);
    }
    get(name: string): string | null {
      return this.params.get(name) ?? null;
    }
    getAll(name: string): string[] {
      const val = this.params.get(name);
      return val !== undefined ? [val] : [];
    }
    has(name: string): boolean {
      return this.params.has(name);
    }
    set(name: string, value: string): void {
      this.params.set(name, value);
    }
    toString(): string {
      return Array.from(this.params.entries())
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
    }
    forEach(
      callbackfn: (value: string, key: string, parent: any) => void,
      _thisArg?: any,
    ): void {
      this.params.forEach((v, k) => callbackfn(v, k, this));
    }
    entries(): IterableIterator<[string, string]> {
      return this.params.entries();
    }
    keys(): IterableIterator<string> {
      return this.params.keys();
    }
    values(): IterableIterator<string> {
      return this.params.values();
    }
    get size(): number {
      return this.params.size;
    }
  } as any;
}

if (typeof XMLHttpRequest === 'undefined') {
  (globalThis as any).XMLHttpRequest = class XMLHttpRequest {
    static UNSENT = 0;
    static OPENED = 1;
    static HEADERS_RECEIVED = 2;
    static LOADING = 3;
    static DONE = 4;

    readyState = 4;
    status = 200;
    statusText = 'OK';
    responseText = '';
    response: any = null;
    responseType = '';
    timeout = 0;
    withCredentials = false;
    onreadystatechange: any = null;
    onload: any = null;
    onerror: any = null;
    ontimeout: any = null;
    onabort: any = null;

    open(_method: string, _url: string | any, _async?: boolean): void {
      // Provided by RN at runtime
    }
    send(_body?: any): void {
      // Provided by RN at runtime
    }
    abort(): void {
      // Provided by RN at runtime
    }
    setRequestHeader(_header: string, _value: string): void {
      // Provided by RN at runtime
    }
    getResponseHeader(_header: string): string | null {
      return null;
    }
    getAllResponseHeaders(): string {
      return '';
    }
    overrideMimeType(_mime: string): void {
      // Provided by RN at runtime
    }
  } as any;
}

// ── Animation frame API ──────────────────────────────────────────────────

if (typeof cancelAnimationFrame === 'undefined') {
  (globalThis as any).cancelAnimationFrame = function cancelAnimationFrame(
    _id: number,
  ): void {
    // Provided by React Native at runtime
  };
}

// ── Idle callback (NOT available in RN — stub for guarded code) ──────────

if (typeof requestIdleCallback === 'undefined') {
  (globalThis as any).requestIdleCallback = function requestIdleCallback(
    cb: any,
    _options?: any,
  ): number {
    return setTimeout(
      () =>
        cb({
          didTimeout: false,
          timeRemaining: () => 50,
        }),
      1,
    ) as unknown as number;
  };
}

if (typeof cancelIdleCallback === 'undefined') {
  (globalThis as any).cancelIdleCallback = function cancelIdleCallback(
    id: number,
  ): void {
    clearTimeout(id);
  };
}

// ── Browser-specific globals ─────────────────────────────────────────────

if (typeof location === 'undefined') {
  (globalThis as any).location = {
    protocol: 'https:',
    hostname: '',
    href: '',
    origin: '',
    pathname: '/',
    search: '',
    hash: '',
    host: '',
    port: '',
  };
}

if (typeof navigator === 'undefined') {
  (globalThis as any).navigator = {
    userAgent: 'ReactNative',
    vendor: '',
    platform: 'ReactNative',
    language: 'en',
    languages: ['en'],
  };
}

// @ts-ignore — HTMLElement is a DOM type not recognized in RN TypeScript lib
if (typeof HTMLElement === 'undefined') {
  (globalThis as any).HTMLElement = class HTMLElement {
    // Browser DOM element — not applicable in RN
  };
}

if (typeof getComputedStyle === 'undefined') {
  (globalThis as any).getComputedStyle = function getComputedStyle(
    _elt: any,
    _pseudoElt?: string | null,
  ): any {
    return {};
  };
}

if (typeof structuredClone === 'undefined') {
  (globalThis as any).structuredClone = function structuredClone<T>(
    value: T,
    _options?: any,
  ): T {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return value;
    }
  };
}

// @ts-ignore — MutationObserver not declared in RN TypeScript lib
if (typeof MutationObserver === 'undefined') {
  (globalThis as any).MutationObserver = class MutationObserver {
    constructor(_callback: any) {
      // Provided by Hermes at runtime
    }
    observe(_target: any, _options?: any): void {
      // Provided by Hermes at runtime
    }
    disconnect(): void {
      // Provided by Hermes at runtime
    }
    takeRecords(): any[] {
      return [];
    }
  } as any;
}

// ── @react-navigation/native global devtools reference ────────────────────

if (typeof REACT_NAVIGATION_DEVTOOLS === 'undefined') {
  (globalThis as any).REACT_NAVIGATION_DEVTOOLS = new WeakMap();
}

// ── Internal RN globals ──────────────────────────────────────────────────

// @ts-expect-error — nativeFabricUIManager is an RN internal
if (typeof nativeFabricUIManager === 'undefined') {
  (globalThis as any).nativeFabricUIManager = {};
}

export {};
