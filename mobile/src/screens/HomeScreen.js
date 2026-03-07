import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { fetchJson } from "../api";
import { colors } from "../theme";

export default function HomeScreen({ navigation }) {
  const [unit, setUnit] = useState(null);
  const [sections, setSections] = useState([]);

  useEffect(() => {
    Promise.all([fetchJson("/unit"), fetchJson("/sections")])
      .then(([unitData, sectionData]) => {
        setUnit(unitData);
        setSections(sectionData);
      })
      .catch((error) => {
        console.error(error);
      });
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.panel}>
        <Text style={styles.eyebrow}>Regiment</Text>
        <Text style={styles.regiment}>{unit?.regiment || "Loading..."}</Text>
        <Text style={styles.company}>{unit?.company || ""}</Text>
      </View>

      <Pressable style={styles.searchButton} onPress={() => navigation.navigate("Search")}>
        <Text style={styles.searchButtonText}>Search Soldiers</Text>
      </Pressable>
      <Pressable style={styles.addButton} onPress={() => navigation.navigate("AddSoldier")}>
        <Text style={styles.addButtonText}>Add Soldier</Text>
      </Pressable>

      <Text style={styles.title}>Sections</Text>
      {sections.map((section) => (
        <Pressable
          key={section.id}
          style={styles.sectionCard}
          onPress={() => navigation.navigate("Section", { sectionId: section.id, sectionName: section.name })}
        >
          <Text style={styles.sectionName}>{section.name}</Text>
          <Text style={styles.sectionMeta}>{section.soldierCount} soldiers</Text>
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
