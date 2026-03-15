import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useFocusEffect } from "@react-navigation/native";
import { fetchJson } from "../api";
import { colors } from "../theme";

function formatDate(value) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString("fr-FR");
}

export default function IssuedCredentialsScreen() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revealed, setRevealed] = useState({});

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchJson("/users/issued-credentials");
      setRows(data);
    } catch (err) {
      setError(err.message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRows();
    }, [loadRows])
  );

  async function copyCredential(item) {
    const password = revealed[item.id];
    if (!password) {
      return;
    }
    await Clipboard.setStringAsync(`Identifiant: ${item.username}\nMot de passe temporaire: ${password}`);
    Alert.alert("Copié", "Identifiants copiés dans le presse-papiers.");
  }

  async function revealCredential(item) {
    try {
      const data = await fetchJson(`/users/issued-credentials/${item.id}/reveal`);
      setRevealed((prev) => ({ ...prev, [item.id]: data.temporaryPassword }));
    } catch (err) {
      Alert.alert("Erreur", err.message || "Impossible de révéler le mot de passe");
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {rows.length === 0 ? <Text style={styles.empty}>Aucun identifiant généré.</Text> : null}

      {rows.map((item) => (
        <View key={item.id} style={styles.card}>
          <Text style={styles.soldier}>{item.soldierName}</Text>
          <Text style={styles.meta}>{item.rank}</Text>
          <Text style={styles.line}>Identifiant: {item.username}</Text>
          <Text style={styles.line}>Créé le: {formatDate(item.createdAt)}</Text>
          <Text style={styles.line}>Créé par: {item.createdBy}</Text>

          {item.passwordChangedAt ? (
            <Text style={styles.changed}>Mot de passe changé le {formatDate(item.passwordChangedAt)}</Text>
          ) : (
            <>
              <Text style={styles.tempPassword}>
                Mot de passe temporaire: {revealed[item.id] ? revealed[item.id] : "Masqué"}
              </Text>
              <Pressable style={styles.revealBtn} onPress={() => revealCredential(item)}>
                <Text style={styles.revealBtnText}>{revealed[item.id] ? "Révéler à nouveau" : "Révéler"}</Text>
              </Pressable>
              <Pressable style={styles.copyBtn} onPress={() => copyCredential(item)}>
                <Text style={styles.copyBtnText}>Copier les identifiants</Text>
              </Pressable>
            </>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    padding: 16,
    paddingBottom: 28
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  error: {
    color: "#ff9191",
    marginBottom: 10
  },
  empty: {
    color: colors.muted
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10
  },
  soldier: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 16
  },
  meta: {
    color: colors.muted,
    marginTop: 2,
    marginBottom: 6
  },
  line: {
    color: colors.text,
    marginTop: 4
  },
  tempPassword: {
    color: colors.accent,
    marginTop: 8,
    fontWeight: "700"
  },
  changed: {
    color: "#9bdd9b",
    marginTop: 8,
    fontWeight: "700"
  },
  revealBtn: {
    marginTop: 10,
    backgroundColor: "#1f2f2f",
    borderWidth: 1,
    borderColor: "#365252",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center"
  },
  revealBtnText: {
    color: "#d4ebeb",
    fontWeight: "700"
  },
  copyBtn: {
    marginTop: 10,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center"
  },
  copyBtnText: {
    color: colors.text,
    fontWeight: "700"
  }
});
