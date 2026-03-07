import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "../theme";
import { useAuth } from "../AuthContext";

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  async function submit() {
    if (!email.trim() || !password || !passwordConfirm) {
      setError("Email, mot de passe et confirmation requis.");
      return;
    }

    if (password !== passwordConfirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await register(email.trim(), password, passwordConfirm);
      setSuccess("Inscription réussie. Connectez-vous.");
      setTimeout(() => navigation.navigate("Login"), 600);
    } catch (err) {
      setError(err.message || "Échec de l'inscription");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.panel}>
        <Text style={styles.title}>Créer un compte</Text>
        <Text style={styles.subtitle}>Les nouveaux comptes sont créés en rôle lecture seule (VIEWER).</Text>

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
          placeholder="Mot de passe (10 caractères min)"
          placeholderTextColor={colors.muted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TextInput
          style={styles.input}
          placeholder="Confirmer le mot de passe"
          placeholderTextColor={colors.muted}
          value={passwordConfirm}
          onChangeText={setPasswordConfirm}
          secureTextEntry
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}

        <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={submit}>
          <Text style={styles.buttonText}>{loading ? "Inscription..." : "S'inscrire"}</Text>
        </Pressable>

        <Pressable style={styles.linkButton} onPress={() => navigation.navigate("Login")}>
          <Text style={styles.linkText}>Retour à la connexion</Text>
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
  success: {
    color: "#9bdd9b",
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
