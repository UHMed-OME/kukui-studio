// kukui-bridge.jslib — Unity Emscripten plugin for the Kukui SCORM bridge.
//
// Drop this file into Unity at: Assets/Plugins/WebGL/kukui-bridge.jslib
// Then declare the imports in C# with [DllImport("__Internal")]:
//
//   [DllImport("__Internal")] static extern void KukuiOnActivityComplete(float raw, float max, int success);
//   [DllImport("__Internal")] static extern void KukuiSaveSuspendData(string json);
//   [DllImport("__Internal")] static extern string KukuiLoadSuspendData();
//   [DllImport("__Internal")] static extern string KukuiGetUrlParam(string key);
//
// Each function delegates to window.kukuiBridge, which is attached by
// @kukui/bridge in the SCORM zip's HTML wrapper. If the bridge is missing
// (e.g., the build is opened directly without the SCORM wrapper) every
// function no-ops and returns sensible defaults.

mergeInto(LibraryManager.library, {
  KukuiOnActivityComplete: function (raw, max, success) {
    if (typeof window !== "undefined" && window.kukuiBridge) {
      window.kukuiBridge.OnActivityComplete(raw, max, success);
    }
  },

  KukuiSaveSuspendData: function (jsonPtr) {
    if (typeof window !== "undefined" && window.kukuiBridge) {
      var json = UTF8ToString(jsonPtr);
      window.kukuiBridge.SaveSuspendData(json);
    }
  },

  KukuiLoadSuspendData: function () {
    var s = "";
    if (typeof window !== "undefined" && window.kukuiBridge) {
      s = window.kukuiBridge.LoadSuspendData() || "";
    }
    var bytes = lengthBytesUTF8(s) + 1;
    var ptr = _malloc(bytes);
    stringToUTF8(s, ptr, bytes);
    return ptr;
  },

  KukuiGetUrlParam: function (keyPtr) {
    var key = UTF8ToString(keyPtr);
    var s = "";
    if (typeof window !== "undefined" && window.kukuiBridge) {
      s = window.kukuiBridge.GetUrlParam(key) || "";
    }
    var bytes = lengthBytesUTF8(s) + 1;
    var ptr = _malloc(bytes);
    stringToUTF8(s, ptr, bytes);
    return ptr;
  },

  KukuiIsConnected: function () {
    if (typeof window !== "undefined" && window.kukuiBridge) {
      return window.kukuiBridge.IsConnected() ? 1 : 0;
    }
    return 0;
  },
});
