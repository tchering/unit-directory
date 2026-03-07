import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import SoldierCard from "../components/SoldierCard";
import { fetchJson } from "../api";
import { colors } from "../theme";

export default function SectionScreen({ navigation, route }) {
  const { sectionId } = route.params;
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchJson(`/sections/${sectionId}/soldiers`)
      .then(setData)
      .catch((error) => {
        console.error(error);
      });
  }, [sectionId]);

  if (!data) {
    return <Text style={styles.loading}>Loading section...</Text>;
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      {data.soldiers.map((soldier) => (
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
    paddingBottom: 24
  },
  loading: {
    color: colors.text,
    padding: 16
  }
});
