import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput } from "react-native";
import SoldierCard from "../components/SoldierCard";
import { fetchJson } from "../api";
import { colors } from "../theme";

export default function SearchScreen({ navigation }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

  useEffect(() => {
    fetchJson(`/soldiers?search=${encodeURIComponent(query)}`)
      .then(setResults)
      .catch((error) => {
        console.error(error);
      });
  }, [query]);

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <TextInput
        style={styles.input}
        placeholder="Search by name"
        placeholderTextColor={colors.muted}
        value={query}
        onChangeText={setQuery}
      />

      {results.length === 0 ? <Text style={styles.empty}>No matching soldiers.</Text> : null}

      {results.map((soldier) => (
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
  empty: {
    color: colors.muted,
    marginTop: 4,
    marginBottom: 10
  }
});
