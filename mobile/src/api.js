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

let accessToken = null;
let refreshHandler = null;

export function setAccessToken(token) {
  accessToken = token || null;
}

export function setTokenRefreshHandler(handler) {
  refreshHandler = handler || null;
}

function buildHeaders(extraHeaders = {}) {
  return {
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...extraHeaders
  };
}

async function buildError(response) {
  let message = `Requête échouée: ${response.status}`;
  try {
    const data = await response.json();
    if (data?.message) {
      message = data.message;
    }
  } catch (_error) {
    // Ignore non-JSON error bodies.
  }
  return new Error(message);
}

async function requestJson(method, path, payload, options = {}) {
  const { retryOn401 = true, skipRefresh = false } = options;

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: buildHeaders(
      payload ? { "Content-Type": "application/json" } : {}
    ),
    ...(payload ? { body: JSON.stringify(payload) } : {})
  });

  if (response.status === 401 && retryOn401 && !skipRefresh && refreshHandler) {
    const refreshed = await refreshHandler();
    if (refreshed) {
      return requestJson(method, path, payload, { retryOn401: false, skipRefresh });
    }
  }

  if (!response.ok) {
    throw await buildError(response);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export function fetchJson(path, options = {}) {
  return requestJson("GET", path, undefined, options);
}

export function postJson(path, payload, options = {}) {
  return requestJson("POST", path, payload, options);
}

export function patchJson(path, payload, options = {}) {
  return requestJson("PATCH", path, payload, options);
}
