import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "unit_directory_push_token";

async function getStoredToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function setStoredToken(token) {
  if (!token) return;
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

async function clearStoredToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

function getExpoProjectId() {
  return (
    Constants?.expoConfig?.extra?.eas?.projectId
    || Constants?.easConfig?.projectId
    || null
  );
}

export async function registerPushTokenOnBackend(postJson) {
  const existingStatus = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus.status;

  if (finalStatus !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }

  if (finalStatus !== "granted") {
    return { ok: false, reason: "PERMISSION_DENIED" };
  }

  const projectId = getExpoProjectId();
  const tokenResult = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync();

  const token = tokenResult?.data;
  if (!token) {
    return { ok: false, reason: "TOKEN_UNAVAILABLE" };
  }

  const previous = await getStoredToken();
  if (previous && previous !== token) {
    try {
      await postJson("/push/unregister", { token: previous });
    } catch (_error) {
      // Best effort cleanup.
    }
  }

  await postJson("/push/register", {
    token,
    platform: Platform.OS
  });
  await setStoredToken(token);
  return { ok: true };
}

export async function unregisterPushTokenOnBackend(postJson) {
  const token = await getStoredToken();
  if (!token) {
    return;
  }

  try {
    await postJson("/push/unregister", { token });
  } catch (_error) {
    // Best effort unregister.
  }

  await clearStoredToken();
}
