import { NativeModules, Platform } from "react-native";
import Constants from "expo-constants";

const LOCAL_ANDROID = "http://10.0.2.2:4000/api";
const LOCAL_DEFAULT = "http://localhost:4000/api";

function detectLanApiBase() {
  const parseHost = (value) => {
    if (!value) {
      return null;
    }
    try {
      return new URL(value).hostname || null;
    } catch (_error) {
      return value.split(":")[0] || null;
    }
  };

  const scriptURL = NativeModules?.SourceCode?.scriptURL;
  const scriptHost = parseHost(scriptURL);
  if (scriptHost) {
    return `http://${scriptHost}:4000/api`;
  }

  const hostUri =
    Constants?.expoConfig?.hostUri ||
    Constants?.manifest2?.extra?.expoClient?.hostUri ||
    Constants?.manifest?.debuggerHost;
  const expoHost = parseHost(hostUri);
  if (expoHost) {
    return `http://${expoHost}:4000/api`;
  }

  return null;
}

const API_BASE = process.env.EXPO_PUBLIC_API_BASE
  || detectLanApiBase()
  || (Platform.OS === "android" ? LOCAL_ANDROID : LOCAL_DEFAULT);

export async function fetchJson(path) {
  const response = await fetch(`${API_BASE}${path}`);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}

export async function postJson(path, payload) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    try {
      const data = await response.json();
      if (data?.message) {
        message = data.message;
      }
    } catch (_error) {
      // Keep fallback message when no JSON body exists.
    }
    throw new Error(message);
  }

  return response.json();
}
