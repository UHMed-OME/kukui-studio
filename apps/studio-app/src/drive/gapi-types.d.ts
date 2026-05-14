/**
 * Shared `window.google` / `window.gapi` typings for the Drive
 * integration modules. Declared in one place to avoid TS's "subsequent
 * property declarations must have the same type" error when auth.ts
 * and openFromDrive.ts both want to augment `window.google`.
 *
 * Typed loosely to the surface area we actually call — Google's full
 * API typings are several hundred KB and pull in their own toolchain.
 */

interface SketchfabPickerDocsView {
  setMimeTypes: (mimeTypes: string) => SketchfabPickerDocsView;
  setIncludeFolders: (b: boolean) => SketchfabPickerDocsView;
  setMode: (mode: unknown) => SketchfabPickerDocsView;
  setSelectFolderEnabled: (b: boolean) => SketchfabPickerDocsView;
}

interface GooglePickerBuilder {
  addView: (view: SketchfabPickerDocsView) => GooglePickerBuilder;
  setOAuthToken: (token: string) => GooglePickerBuilder;
  setDeveloperKey: (key: string) => GooglePickerBuilder;
  setAppId: (id: string) => GooglePickerBuilder;
  setCallback: (
    cb: (data: {
      action: string;
      docs?: Array<{ id: string; name: string }>;
    }) => void,
  ) => GooglePickerBuilder;
  setTitle: (s: string) => GooglePickerBuilder;
  build: () => { setVisible: (b: boolean) => void };
}

interface Window {
  google?: {
    accounts?: {
      oauth2?: {
        initTokenClient: (config: {
          client_id: string;
          scope: string;
          prompt?: string;
          callback: (response: { access_token?: string; error?: string }) => void;
          error_callback?: (err: { type?: string; message?: string }) => void;
        }) => { requestAccessToken: (opts?: { prompt?: string }) => void };
      };
    };
    picker?: {
      PickerBuilder: new () => GooglePickerBuilder;
      ViewId: { DOCS: string };
      DocsView: new (viewId?: string) => SketchfabPickerDocsView;
      Action: { PICKED: string; CANCEL: string };
    };
  };
  gapi?: {
    load: (
      name: string,
      cb: { callback: () => void; onerror?: () => void } | (() => void),
    ) => void;
  };
}
