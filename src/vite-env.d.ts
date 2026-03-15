declare global {
  const __APP_VERSION__: string;

  interface Window {
    appUpdate?: {
      getVersion: () => Promise<string> | string;
      checkForUpdates: () => Promise<
        | { status: 'no_update' }
        | { status: 'update_available'; version: string; source?: 'gitee' | 'github'; releaseUrl?: string; releaseName?: string; releaseNotes?: string }
        | { status: 'error'; message: string }
      >;
      downloadUpdate: () => Promise<
        | { status: 'downloaded' }
        | { status: 'error'; message: string }
      >;
      quitAndInstall: () => Promise<void> | void;
      onDownloadProgress?: (
        listener: (info: { percent?: number; transferred?: number; total?: number; bytesPerSecond?: number }) => void
      ) => () => void;
    };
  }
}

export {};
