import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";

const AVAILABILITY_LABELS = {
  PRESENT: "Présent",
  ABSENT: "Absent",
  MISSION: "En mission",
  PERMISSION: "Permission"
};

const AVAILABILITY_COLORS = {
  PRESENT: "#7bc47f",
  ABSENT: "#d86f6f",
  MISSION: "#76a6ff",
  PERMISSION: "#d6b36a"
};

export default function SoldierCard({ soldier, onPress, actionLabel, onActionPress, disableAction }) {
  const availability = soldier.availability || "PRESENT";
  const availabilityColor = AVAILABILITY_COLORS[availability] || "#8aa0b6";
  const lastUpdated = soldier.positionUpdatedAt
    ? new Date(soldier.positionUpdatedAt).toLocaleString("fr-FR")
    : "";

  return (
    <View style={styles.card}>
      <Pressable style={styles.mainTap} onPress={onPress}>
        <Image source={{ uri: soldier.photo }} style={styles.photo} />
        <View style={styles.content}>
          <Text style={styles.name}>{soldier.name}</Text>
          <Text style={styles.rank}>{soldier.rank}</Text>
          <View style={[styles.statusBadge, { borderColor: availabilityColor }]}>
            <Text style={[styles.statusText, { color: availabilityColor }]}>
              {AVAILABILITY_LABELS[availability] || "Présent"}
            </Text>
          </View>
          <Text style={styles.positionText}>
            Position: {soldier.currentPosition || "Non renseignée"}
          </Text>
          {lastUpdated ? (
            <Text style={styles.updatedText}>Dernière mise à jour: {lastUpdated}</Text>
          ) : null}
        </View>
      </Pressable>
      {actionLabel && onActionPress ? (
        <Pressable
          style={[styles.actionBtn, disableAction && styles.actionBtnDisabled]}
          onPress={onActionPress}
          disabled={disableAction}
        >
          <Text style={styles.actionBtnText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 10,
    marginBottom: 12
  },
  mainTap: {
    flexDirection: "row",
    gap: 12
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
  },
  statusBadge: {
    marginTop: 8,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4
  },
  statusText: {
    fontSize: 11,
    fontWeight: "800"
  },
  positionText: {
    color: colors.text,
    marginTop: 6,
    fontSize: 12
  },
  updatedText: {
    color: colors.muted,
    marginTop: 4,
    fontSize: 11
  },
  actionBtn: {
    backgroundColor: "#253a33",
    borderWidth: 1,
    borderColor: "#3f5f53",
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center"
  },
  actionBtnDisabled: {
    opacity: 0.55
  },
  actionBtnText: {
    color: "#d7f1e6",
    fontWeight: "700"
  }
});
