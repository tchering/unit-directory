import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";

export default function SoldierCard({ soldier, onPress }) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Image source={{ uri: soldier.photo }} style={styles.photo} />
      <View style={styles.content}>
        <Text style={styles.name}>{soldier.name}</Text>
        <Text style={styles.rank}>{soldier.rank}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    gap: 12,
    marginBottom: 12
  },
  photo: {
    width: 88,
    height: 88,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border
  },
  content: {
    flex: 1,
    justifyContent: "center"
  },
  name: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700"
  },
  rank: {
    color: colors.muted,
    marginTop: 2
  }
});
