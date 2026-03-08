import { useMemo, useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import SoldierCard from "../components/SoldierCard";
import { fetchJson } from "../api";
import { colors } from "../theme";

const GROUPS = [
  { key: "CHEF_DE_SECTION", label: "Chef de section" },
  { key: "SOUS_OFFICIER_ADJOINT", label: "SOA" },
  { key: "SERGENT", label: "Sergent" },
  { key: "MILITAIRE_DU_RANG", label: "MDR" }
];

export default function SectionScreen({ navigation, route }) {
  const { sectionId } = route.params;
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const loadSection = useCallback(() => {
    setError("");
    fetchJson(`/sections/${sectionId}/soldiers`)
      .then(setData)
      .catch((err) => {
        setError(err.message);
      });
  }, [sectionId]);

  useFocusEffect(
    useCallback(() => {
      loadSection();
    }, [loadSection])
  );

  const grouped = useMemo(() => {
    if (!data?.soldiers) {
      return [];
    }

    return GROUPS.map((group) => ({
      ...group,
      soldiers: data.soldiers
        .filter((soldier) => (soldier.commandCategory || "MILITAIRE_DU_RANG") === group.key)
        .sort((a, b) => a.name.localeCompare(b.name, "fr"))
    }));
  }, [data]);

  if (!data) {
    return <Text style={styles.loading}>Chargement de la section...</Text>;
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {grouped.map((group) => (
        <View key={group.key} style={styles.group}>
          <Text style={styles.groupTitle}>{group.label}</Text>
          {group.soldiers.length === 0 ? (
            <Text style={styles.empty}>Aucun militaire.</Text>
          ) : (
            group.soldiers.map((soldier) => (
              <SoldierCard
                key={soldier.id}
                soldier={soldier}
                onPress={() => navigation.navigate("Soldier", { soldierId: soldier.id })}
              />
            ))
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    padding: 16,
    paddingBottom: 24
  },
  loading: {
    color: colors.text,
    padding: 16
  },
  group: {
    marginBottom: 12
  },
  groupTitle: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 8
  },
  empty: {
    color: colors.muted,
    marginBottom: 8
  },
  error: {
    color: "#ff9191",
    marginBottom: 10
  }
});
