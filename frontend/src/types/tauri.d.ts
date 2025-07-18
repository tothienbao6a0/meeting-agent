declare global {
  interface Window {
    __TAURI__?: {
      api: any;
      primitives: any;
      plugins: any;
      [key: string]: any;
    };
  }
}

export {}; 