import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuth } from "../AuthContext";
import { colors } from "../theme";

export default function ChangePasswordScreen() {
  const { completeFirstLoginPasswordChange } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!currentPassword || !newPassword || !passwordConfirm) {
      setError("Tous les champs sont requis.");
      return;
    }
    if (newPassword !== passwordConfirm) {
      setError("Les nouveaux mots de passe ne correspondent pas.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await completeFirstLoginPasswordChange(currentPassword, newPassword, passwordConfirm);
    } catch (err) {
      setError(err.message || "Impossible de changer le mot de passe");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.panel}>
        <Text style={styles.title}>Sécurité requise</Text>
        <Text style={styles.subtitle}>
          Vous devez changer votre mot de passe temporaire avant d'accéder à l'application.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Mot de passe temporaire"
          placeholderTextColor={colors.muted}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
        />
        <TextInput
          style={styles.input}
          placeholder="Nouveau mot de passe"
          placeholderTextColor={colors.muted}
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
        />
        <TextInput
          style={styles.input}
          placeholder="Confirmer le nouveau mot de passe"
          placeholderTextColor={colors.muted}
          value={passwordConfirm}
          onChangeText={setPasswordConfirm}
          secureTextEntry
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={[styles.button, saving && styles.buttonDisabled]} onPress={submit}>
          <Text style={styles.buttonText}>{saving ? "Mise à jour..." : "Mettre à jour le mot de passe"}</Text>
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
  }
});
