import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { fetchJson } from "../api";
import { colors } from "../theme";
import { useAuth } from "../AuthContext";

const ROLE_LABELS = {
  ADMIN: "Administrateur",
  MANAGER: "Gestionnaire",
  VIEWER: "Lecteur"
};

export default function HomeScreen({ navigation }) {
  const { session } = useAuth();
  const isAdmin = session?.user?.role === "ADMIN";
  const isAdminLike = isAdmin || session?.user?.role === "MANAGER";
  const [unit, setUnit] = useState(null);
  const [sections, setSections] = useState([]);
  const [error, setError] = useState("");

  const loadHome = useCallback(() => {
    setError("");
    Promise.all([fetchJson("/unit"), fetchJson("/sections")])
      .then(([unitData, sectionData]) => {
        setUnit(unitData);
        setSections(sectionData);
      })
      .catch((err) => {
        setError(err.message);
      });
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHome();
    }, [loadHome])
  );

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.panel}>
        <Text style={styles.eyebrow}>Régiment</Text>
        <Text style={styles.regiment}>{unit?.regiment || "Chargement..."}</Text>
        <Text style={styles.company}>{unit?.company || ""}</Text>
      </View>

      <View style={styles.userPanel}>
        <Text style={styles.userLabel}>Connecté en tant que</Text>
        <Text style={styles.userValue}>{session?.user?.email || "Inconnu"}</Text>
        <Text style={styles.userRole}>Rôle: {ROLE_LABELS[session?.user?.role] || session?.user?.role}</Text>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.searchButton} onPress={() => navigation.navigate("Search")}>
        <Text style={styles.searchButtonText}>Rechercher un militaire</Text>
      </Pressable>
      {isAdminLike ? (
        <Pressable style={styles.addButton} onPress={() => navigation.navigate("AddSoldier")}>
          <Text style={styles.addButtonText}>Ajouter un militaire</Text>
        </Pressable>
      ) : (
        <Text style={styles.accessHint}>Connecté en {ROLE_LABELS[session?.user?.role] || session?.user?.role}. Écriture restreinte.</Text>
      )}
      {isAdmin ? (
        <Pressable style={styles.manageButton} onPress={() => navigation.navigate("AdminUsers")}>
          <Text style={styles.manageButtonText}>Gérer les rôles utilisateurs</Text>
        </Pressable>
      ) : null}

      <Text style={styles.title}>Sections</Text>
      {sections.map((section) => (
        <Pressable
          key={section.id}
          style={styles.sectionCard}
          onPress={() => navigation.navigate("Section", { sectionId: section.id, sectionName: section.name })}
        >
          <Text style={styles.sectionName}>{section.name}</Text>
          <Text style={styles.sectionMeta}>{section.soldierCount} militaires</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    padding: 16,
    paddingBottom: 28
  },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1
  },
  regiment: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
    marginTop: 6
  },
  company: {
    color: colors.muted,
    marginTop: 2,
    fontSize: 16
  },
  userPanel: {
    marginTop: 10,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12
  },
  userLabel: {
    color: colors.muted,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8
  },
  userValue: {
    color: colors.text,
    fontWeight: "800",
    marginTop: 4
  },
  userRole: {
    color: colors.accent,
    marginTop: 4,
    fontWeight: "700"
  },
  error: {
    color: "#ff9191",
    marginTop: 10
  },
  searchButton: {
    marginTop: 14,
    backgroundColor: colors.accent,
    borderRadius: 12,
    padding: 12,
    alignItems: "center"
  },
  searchButtonText: {
    color: "#19210f",
    fontWeight: "800"
  },
  addButton: {
    marginTop: 10,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center"
  },
  addButtonText: {
    color: colors.text,
    fontWeight: "700"
  },
  accessHint: {
    color: colors.muted,
    marginTop: 10
  },
  manageButton: {
    marginTop: 10,
    backgroundColor: "#243022",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#3d5237",
    alignItems: "center"
  },
  manageButtonText: {
    color: "#d8e8c5",
    fontWeight: "700"
  },
  title: {
    color: colors.text,
    marginTop: 20,
    marginBottom: 10,
    fontSize: 20,
    fontWeight: "700"
  },
  sectionCard: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10
  },
  sectionName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700"
  },
  sectionMeta: {
    color: colors.muted,
    marginTop: 4
  }
});
