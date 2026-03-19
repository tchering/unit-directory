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

export default function SoldierCard({
  soldier,
  onPress,
  actionLabel,
  onActionPress,
  disableAction,
  compactAction = false,
  isCurrentUser = false,
  currentUserLabel = "Vous"
}) {
  const availability = soldier.availability || "PRESENT";
  const availabilityColor = AVAILABILITY_COLORS[availability] || "#8aa0b6";
  const lastUpdated = soldier.positionUpdatedAt
    ? new Date(soldier.positionUpdatedAt).toLocaleString("fr-FR")
    : "";

  return (
    <View style={[styles.card, isCurrentUser && styles.cardCurrentUser]}>
      <Pressable style={styles.mainTap} onPress={onPress}>
        <Image source={{ uri: soldier.photo }} style={[styles.photo, isCurrentUser && styles.photoCurrentUser]} />
        <View style={styles.content}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{soldier.name}</Text>
            {isCurrentUser ? <Text style={styles.currentUserTag}>{currentUserLabel}</Text> : null}
          </View>
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
          style={[
            compactAction ? styles.actionBtnCompact : styles.actionBtn,
            disableAction && styles.actionBtnDisabled
          ]}
          onPress={onActionPress}
          disabled={disableAction}
        >
          <Text style={compactAction ? styles.actionBtnTextCompact : styles.actionBtnText}>{actionLabel}</Text>
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
    padding: 8,
    gap: 6,
    marginBottom: 9
  },
  cardCurrentUser: {
    backgroundColor: "#1a2b22",
    borderColor: colors.accent,
    borderWidth: 1.5
  },
  mainTap: {
    flexDirection: "row",
    gap: 8
  },
  photo: {
    width: 64,
    height: 64,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border
  },
  photoCurrentUser: {
    borderColor: colors.accent
  },
  content: {
    flex: 1,
    justifyContent: "center"
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  name: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700"
  },
  currentUserTag: {
    backgroundColor: colors.accent,
    color: "#1b260f",
    fontSize: 10,
    fontWeight: "900",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999
  },
  rank: {
    color: colors.muted,
    marginTop: 1,
    fontSize: 12
  },
  statusBadge: {
    marginTop: 4,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2
  },
  statusText: {
    fontSize: 10,
    fontWeight: "800"
  },
  positionText: {
    color: colors.text,
    marginTop: 3,
    fontSize: 11
  },
  updatedText: {
    color: colors.muted,
    marginTop: 2,
    fontSize: 10
  },
  actionBtn: {
    backgroundColor: "#253a33",
    borderWidth: 1,
    borderColor: "#3f5f53",
    borderRadius: 10,
    paddingVertical: 6,
    alignItems: "center"
  },
  actionBtnCompact: {
    alignSelf: "flex-end",
    backgroundColor: "#20342f",
    borderWidth: 1,
    borderColor: "#3a5a50",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  actionBtnDisabled: {
    opacity: 0.55
  },
  actionBtnText: {
    color: "#d7f1e6",
    fontWeight: "700",
    fontSize: 11
  },
  actionBtnTextCompact: {
    color: "#d7f1e6",
    fontWeight: "700",
    fontSize: 10
  }
});
