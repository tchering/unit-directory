import { Platform } from "react-native";

const LOCAL_ANDROID = "http://10.0.2.2:4000/api";
const LOCAL_DEFAULT = "http://localhost:4000/api";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || (
  Platform.OS === "android" ? LOCAL_ANDROID : LOCAL_DEFAULT
);

export async function fetchJson(path) {
  const response = await fetch(`${API_BASE}${path}`);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}
