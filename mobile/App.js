import { useEffect, useMemo, useState } from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Pressable, Text } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import HomeScreen from "./src/screens/HomeScreen";
import SectionScreen from "./src/screens/SectionScreen";
import SoldierProfileScreen from "./src/screens/SoldierProfileScreen";
import SearchScreen from "./src/screens/SearchScreen";
import AddSoldierScreen from "./src/screens/AddSoldierScreen";
import LoginScreen from "./src/screens/LoginScreen";
import ChangePasswordScreen from "./src/screens/ChangePasswordScreen";
import AdminUsersScreen from "./src/screens/AdminUsersScreen";
import IssuedCredentialsScreen from "./src/screens/IssuedCredentialsScreen";
import AnnouncementsScreen from "./src/screens/AnnouncementsScreen";
import AnnouncementEditorScreen from "./src/screens/AnnouncementEditorScreen";
import { colors } from "./src/theme";
import { clearSession, loadSession, saveSession } from "./src/authStorage";
import { fetchJson, postJson, setAccessToken, setTokenRefreshHandler } from "./src/api";
import { AuthContext } from "./src/AuthContext";
import { registerPushTokenOnBackend, unregisterPushTokenOnBackend } from "./src/pushNotifications";

const Stack = createNativeStackNavigator();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true
  })
});

const navTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    primary: colors.accent
  }
};

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSession()
      .then((stored) => {
        if (stored?.accessToken && stored?.user) {
          setSession(stored);
          setAccessToken(stored.accessToken);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const requiresPasswordChange = Boolean(session?.user?.mustChangePassword);

  const authValue = useMemo(() => ({
    session,
    isAdminLike: session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER",
    async signIn(identifier, password) {
      const next = await postJson("/auth/login", { identifier, password });
      setSession(next);
      setAccessToken(next.accessToken);
      await saveSession(next);
    },
    async completeFirstLoginPasswordChange(currentPassword, newPassword, passwordConfirm) {
      const next = await postJson("/auth/change-password-first-login", {
        currentPassword,
        newPassword,
        passwordConfirm
      });
      setSession(next);
      setAccessToken(next.accessToken);
      await saveSession(next);
    },
    async signOut() {
      try {
        await unregisterPushTokenOnBackend(postJson);
        if (session?.refreshToken) {
          await postJson("/auth/logout", { refreshToken: session.refreshToken }, { skipRefresh: true, retryOn401: false });
        }
      } catch (_error) {
        // Best effort logout.
      }

      setSession(null);
      setAccessToken(null);
      await clearSession();
    },
    async refreshSessionToken() {
      if (!session?.refreshToken) {
        return false;
      }

      try {
        const next = await postJson(
          "/auth/refresh",
          { refreshToken: session.refreshToken },
          { skipRefresh: true, retryOn401: false }
        );
        setSession(next);
        setAccessToken(next.accessToken);
        await saveSession(next);
        return true;
      } catch (_error) {
        setSession(null);
        setAccessToken(null);
        await clearSession();
        return false;
      }
    },
    async refreshMe() {
      if (!session?.accessToken) {
        return;
      }
      const me = await fetchJson("/auth/me");
      const next = {
        ...session,
        user: {
          id: me.id,
          username: me.username,
          email: me.email,
          role: me.role,
          mustChangePassword: me.mustChangePassword
        }
      };
      setSession(next);
      await saveSession(next);
    }
  }), [session]);

  useEffect(() => {
    setTokenRefreshHandler(authValue.refreshSessionToken);
    return () => setTokenRefreshHandler(null);
  }, [authValue]);

  useEffect(() => {
    if (!session?.accessToken || requiresPasswordChange) {
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        if (!cancelled) {
          await registerPushTokenOnBackend(postJson);
        }
      } catch (_error) {
        // Ignore push setup failures in app flow.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.accessToken, requiresPasswordChange]);

  if (loading) {
    return null;
  }

  return (
    <AuthContext.Provider value={authValue}>
      <NavigationContainer theme={navTheme}>
        <StatusBar style="light" />
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: colors.surface },
            headerTitleStyle: { color: colors.text, fontWeight: "700" },
            headerTintColor: colors.accent,
            contentStyle: { backgroundColor: colors.background }
          }}
        >
          {!session ? (
            <>
              <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            </>
          ) : requiresPasswordChange ? (
            <Stack.Screen
              name="ChangePassword"
              component={ChangePasswordScreen}
              options={{
                title: "Changer le mot de passe",
                headerRight: () => (
                  <Pressable onPress={authValue.signOut}>
                    <Text style={{ color: colors.accent, fontWeight: "700" }}>Déconnexion</Text>
                  </Pressable>
                )
              }}
            />
          ) : (
            <>
              <Stack.Screen
                name="Home"
                component={HomeScreen}
                options={{
                  title: "15e Compagnie",
                  headerRight: () => (
                    <Pressable onPress={authValue.signOut}>
                      <Text style={{ color: colors.accent, fontWeight: "700" }}>Déconnexion</Text>
                    </Pressable>
                  )
                }}
              />
              <Stack.Screen name="Section" component={SectionScreen} options={({ route }) => ({ title: route.params.sectionName })} />
              <Stack.Screen name="Soldier" component={SoldierProfileScreen} options={{ title: "Profil militaire" }} />
              <Stack.Screen name="Search" component={SearchScreen} options={{ title: "Rechercher un militaire" }} />
              <Stack.Screen name="AddSoldier" component={AddSoldierScreen} options={{ title: "Ajouter un militaire" }} />
              <Stack.Screen name="IssuedCredentials" component={IssuedCredentialsScreen} options={{ title: "Identifiants créés" }} />
              <Stack.Screen name="AdminUsers" component={AdminUsersScreen} options={{ title: "Gérer les utilisateurs" }} />
              <Stack.Screen name="Announcements" component={AnnouncementsScreen} options={{ title: "Annonces" }} />
              <Stack.Screen name="AnnouncementEditor" component={AnnouncementEditorScreen} options={{ title: "Éditer une annonce" }} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </AuthContext.Provider>
  );
}
