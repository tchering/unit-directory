import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "../theme";
import { useAuth } from "../AuthContext";

export default function LoginScreen({ navigation }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!email.trim() || !password) {
      setError("Email et mot de passe requis.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err.message || "Échec de connexion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.panel}>
        <Text style={styles.title}>Unit Directory</Text>
        <Text style={styles.subtitle}>Accès réservé au personnel autorisé</Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.muted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Mot de passe"
          placeholderTextColor={colors.muted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={submit}>
          <Text style={styles.buttonText}>{loading ? "Connexion..." : "Se connecter"}</Text>
        </Pressable>

        <Pressable style={styles.linkButton} onPress={() => navigation.navigate("Register")}>
          <Text style={styles.linkText}>Créer un compte</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    padding: 18
  },
  panel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800"
  },
  subtitle: {
    color: colors.muted,
    marginTop: 4,
    marginBottom: 14
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 10
  },
  error: {
    color: "#ff9191",
    marginBottom: 10
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center"
  },
  buttonDisabled: {
    opacity: 0.65
  },
  buttonText: {
    color: "#1b260f",
    fontWeight: "800"
  },
  linkButton: {
    alignItems: "center",
    marginTop: 12
  },
  linkText: {
    color: colors.accent,
    fontWeight: "700"
  }
});
