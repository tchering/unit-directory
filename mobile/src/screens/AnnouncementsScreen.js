import { useCallback, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { fetchJson, postJson } from "../api";
import { colors } from "../theme";
import { useAuth } from "../AuthContext";

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("fr-FR");
}

function scopeLabel(item) {
  if (item.scope === "SECTION") {
    return item.sectionName ? `Section: ${item.sectionName}` : "Section";
  }
  if (item.scope === "REGIMENT") return "Régiment";
  return "Compagnie";
}

export default function AnnouncementsScreen({ navigation }) {
  const { session } = useAuth();
  const isAdminLike = session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER";
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchJson("/announcements");
      setItems(data?.items || []);
      setUnreadCount(data?.unreadCount || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const canEdit = useMemo(() => isAdminLike, [isAdminLike]);

  async function markRead(item) {
    try {
      await postJson(`/announcements/${item.id}/read`, {});
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.screen}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent} />}
    >
      <View style={styles.headerCard}>
        <Text style={styles.title}>Flux d'annonces</Text>
        <Text style={styles.subtitle}>Non lues: {unreadCount}</Text>
      </View>

      {canEdit ? (
        <Pressable style={styles.createButton} onPress={() => navigation.navigate("AnnouncementEditor")}> 
          <Text style={styles.createButtonText}>Créer une annonce</Text>
        </Pressable>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {items.map((item) => (
        <View key={item.id} style={[styles.card, item.isUrgent ? styles.cardUrgent : null]}>
          <View style={styles.rowTop}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            {!item.isRead ? <Text style={styles.unread}>NOUVEAU</Text> : null}
          </View>

          <View style={styles.metaRow}>
            {item.isPinned ? <Text style={styles.tag}>ÉPINGLÉE</Text> : null}
            {item.isUrgent ? <Text style={styles.tagUrgent}>URGENT</Text> : null}
            <Text style={styles.scope}>{scopeLabel(item)}</Text>
          </View>

          <Text style={styles.body}>{item.body}</Text>
          <Text style={styles.meta}>Par {item.createdBy} • {formatDate(item.createdAt)}</Text>
          {item.expiresAt ? <Text style={styles.meta}>Expire: {formatDate(item.expiresAt)}</Text> : null}

          <View style={styles.actionsRow}>
            {!item.isRead ? (
              <Pressable style={styles.readButton} onPress={() => markRead(item)}>
                <Text style={styles.readButtonText}>Marquer comme lue</Text>
              </Pressable>
            ) : (
              <Text style={styles.readDone}>Lu</Text>
            )}

            {canEdit ? (
              <Pressable style={styles.editButton} onPress={() => navigation.navigate("AnnouncementEditor", { announcement: item })}>
                <Text style={styles.editButtonText}>Modifier</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ))}

      {items.length === 0 && !loading ? <Text style={styles.empty}>Aucune annonce active.</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    padding: 16,
    paddingBottom: 28
  },
  headerCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12
  },
  title: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 20
  },
  subtitle: {
    color: colors.muted,
    marginTop: 4
  },
  createButton: {
    marginTop: 10,
    backgroundColor: colors.accent,
    borderRadius: 12,
    padding: 12,
    alignItems: "center"
  },
  createButtonText: {
    color: "#19210f",
    fontWeight: "800"
  },
  error: {
    marginTop: 10,
    color: "#ff9191"
  },
  card: {
    marginTop: 10,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12
  },
  cardUrgent: {
    borderColor: "#a24545"
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
    flex: 1
  },
  unread: {
    color: "#ffad8a",
    fontWeight: "800",
    fontSize: 11
  },
  metaRow: {
    marginTop: 6,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center"
  },
  tag: {
    color: "#c8d8ff",
    fontSize: 11,
    fontWeight: "700"
  },
  tagUrgent: {
    color: "#ff8a8a",
    fontSize: 11,
    fontWeight: "800"
  },
  scope: {
    color: colors.muted,
    fontSize: 12
  },
  body: {
    marginTop: 8,
    color: colors.text,
    lineHeight: 20
  },
  meta: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 12
  },
  actionsRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  readButton: {
    backgroundColor: "#273549",
    borderWidth: 1,
    borderColor: "#3e5a7b",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10
  },
  readButtonText: {
    color: "#dbe8ff",
    fontWeight: "700"
  },
  readDone: {
    color: "#8fb388",
    fontWeight: "700"
  },
  editButton: {
    backgroundColor: "#2f2f2f",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: 10
  },
  editButtonText: {
    color: colors.text,
    fontWeight: "700"
  },
  empty: {
    marginTop: 14,
    color: colors.muted,
    textAlign: "center"
  }
});
