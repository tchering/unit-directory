import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import SoldierCard from "../components/SoldierCard";
import { fetchJson } from "../api";
import { colors } from "../theme";

const RANK_FILTERS = [
  { key: "ALL", label: "Tous" },
  { key: "OFFICIER", label: "Officier" },
  { key: "SOUS_OFFICIER", label: "Sous-off" },
  { key: "CAPORAL_CHEF", label: "CCH/BCH/CC1" },
  { key: "BRIGADIER_CAPORAL", label: "Brigadier/Caporal" },
  { key: "MDR", label: "MDR (1CL/Soldat)" }
];

function normalizeRank(value) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function includesAny(value, tokens) {
  return tokens.some((token) => value.includes(token));
}

function resolveRankFilter(rank) {
  const normalized = normalizeRank(rank);

  if (includesAny(normalized, ["LIEUTENANT", "LTN", "CAPITAINE", "CNE", "COMMANDANT", "CDT", "COLONEL", "COL", "LCL"])) {
    return "OFFICIER";
  }
  if (includesAny(normalized, ["CAPORAL CHEF", "BCH", "CCH", "CC1"])) {
    return "CAPORAL_CHEF";
  }
  if (includesAny(normalized, ["BRIGADIER", "CAPORAL", "CPL"])) {
    return "BRIGADIER_CAPORAL";
  }
  if (includesAny(normalized, ["1ER CLASSE", "1 CLASSE", "1CL", "SOLDAT"])) {
    return "MDR";
  }
  if (includesAny(normalized, ["SERGENT", "SGT", "SCH", "ADJ", "ADC", "MAJOR", "MDL", "MARECHAL DES LOGIS"])) {
    return "SOUS_OFFICIER";
  }

  return "MDR";
}

export default function SearchScreen({ navigation }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [rankFilter, setRankFilter] = useState("ALL");

  useEffect(() => {
    fetchJson(`/soldiers?search=${encodeURIComponent(query)}`)
      .then(setResults)
      .catch((error) => {
        console.error(error);
      });
  }, [query]);

  const filteredResults = useMemo(() => {
    if (rankFilter === "ALL") {
      return results;
    }
    return results.filter((soldier) => resolveRankFilter(soldier.rank) === rankFilter);
  }, [rankFilter, results]);

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <TextInput
        style={styles.input}
        placeholder="Rechercher par nom"
        placeholderTextColor={colors.muted}
        value={query}
        onChangeText={setQuery}
      />

      <View style={styles.filtersWrap}>
        {RANK_FILTERS.map((filter) => (
          <Pressable
            key={filter.key}
            style={[styles.filterChip, rankFilter === filter.key && styles.filterChipActive]}
            onPress={() => setRankFilter(filter.key)}
          >
            <Text style={[styles.filterChipText, rankFilter === filter.key && styles.filterChipTextActive]}>
              {filter.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {filteredResults.length === 0 ? <Text style={styles.empty}>Aucun militaire trouvé.</Text> : null}

      {filteredResults.map((soldier) => (
        <SoldierCard
          key={soldier.id}
          soldier={soldier}
          onPress={() => navigation.navigate("Soldier", { soldierId: soldier.id })}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    padding: 16,
    paddingBottom: 26
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
    marginBottom: 12
  },
  filtersWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10
  },
  filterChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: colors.surface
  },
  filterChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent
  },
  filterChipText: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 12
  },
  filterChipTextActive: {
    color: "#1b260f"
  },
  empty: {
    color: colors.muted,
    marginTop: 4,
    marginBottom: 10
  }
});
