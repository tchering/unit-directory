import { useEffect, useMemo, useState } from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Pressable, Text } from "react-native";
import { StatusBar } from "expo-status-bar";
import HomeScreen from "./src/screens/HomeScreen";
import SectionScreen from "./src/screens/SectionScreen";
import SoldierProfileScreen from "./src/screens/SoldierProfileScreen";
import SearchScreen from "./src/screens/SearchScreen";
import AddSoldierScreen from "./src/screens/AddSoldierScreen";
import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import AdminUsersScreen from "./src/screens/AdminUsersScreen";
import { colors } from "./src/theme";
import { clearSession, loadSession, saveSession } from "./src/authStorage";
import { fetchJson, postJson, setAccessToken, setTokenRefreshHandler } from "./src/api";
import { AuthContext } from "./src/AuthContext";

const Stack = createNativeStackNavigator();

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

  const authValue = useMemo(() => ({
    session,
    isAdminLike: session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER",
    async signIn(email, password) {
      const next = await postJson("/auth/login", { email, password });
      setSession(next);
      setAccessToken(next.accessToken);
      await saveSession(next);
    },
    async register(email, password, passwordConfirm) {
      await postJson("/auth/register", {
        email,
        password,
        passwordConfirm
      });
    },
    async signOut() {
      try {
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
          email: me.email,
          role: me.role
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
              <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
            </>
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
              <Stack.Screen name="AdminUsers" component={AdminUsersScreen} options={{ title: "Gérer les utilisateurs" }} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </AuthContext.Provider>
  );
}
