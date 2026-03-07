import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import HomeScreen from "./src/screens/HomeScreen";
import SectionScreen from "./src/screens/SectionScreen";
import SoldierProfileScreen from "./src/screens/SoldierProfileScreen";
import SearchScreen from "./src/screens/SearchScreen";
import { colors } from "./src/theme";

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
  return (
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
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: "15e Compagnie" }} />
        <Stack.Screen name="Section" component={SectionScreen} options={({ route }) => ({ title: route.params.sectionName })} />
        <Stack.Screen name="Soldier" component={SoldierProfileScreen} options={{ title: "Soldier Profile" }} />
        <Stack.Screen name="Search" component={SearchScreen} options={{ title: "Search Soldiers" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
