import { useEffect, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { fetchJson } from "../api";
import { colors } from "../theme";

export default function SoldierProfileScreen({ route }) {
  const { soldierId } = route.params;
  const [soldier, setSoldier] = useState(null);

  useEffect(() => {
    fetchJson(`/soldiers/${soldierId}`)
      .then(setSoldier)
      .catch((error) => {
        console.error(error);
      });
  }, [soldierId]);

  if (!soldier) {
    return <Text style={styles.loading}>Loading profile...</Text>;
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Image source={{ uri: soldier.photo }} style={styles.photo} />
      <View style={styles.panel}>
        <Text style={styles.eyebrow}>Soldier Profile</Text>
        <Text style={styles.name}>{soldier.fullName}</Text>
        <Text style={styles.line}>Rank: {soldier.rank}</Text>
        <Text style={styles.line}>Section: {soldier.section}</Text>
        <Text style={styles.line}>Role: {soldier.role}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    padding: 16,
    gap: 12,
    paddingBottom: 30
  },
  loading: {
    color: colors.text,
    padding: 16
  },
  photo: {
    width: "100%",
    height: 340,
    borderRadius: 14,
    borderColor: colors.border,
    borderWidth: 1
  },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14
  },
  eyebrow: {
    color: colors.accent,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 12
  },
  name: {
    color: colors.text,
    fontSize: 24,
    marginTop: 6,
    marginBottom: 8,
    fontWeight: "800"
  },
  line: {
    color: colors.text,
    marginTop: 5,
    fontSize: 16
  }
});
