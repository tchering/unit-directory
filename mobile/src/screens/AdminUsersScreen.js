import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { fetchJson, patchJson } from "../api";
import { colors } from "../theme";
import { useAuth } from "../AuthContext";

const ROLES = ["VIEWER", "MANAGER", "ADMIN"];
const ROLE_LABELS = {
  VIEWER: "Lecteur",
  MANAGER: "Gestionnaire",
  ADMIN: "Administrateur"
};

export default function AdminUsersScreen() {
  const { session } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState("");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchJson("/admin/users");
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  async function changeRole(userId, role) {
    setUpdatingId(userId);
    setError("");
    try {
      const updated = await patchJson(`/admin/users/${userId}`, { role });
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: updated.role } : u)));
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingId("");
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {users.map((user) => {
        const isMe = user.id === session?.user?.id;
        return (
          <View key={user.id} style={styles.card}>
            <Text style={styles.email}>{user.username}</Text>
            {user.email ? <Text style={styles.secondary}>Email: {user.email}</Text> : null}
            <Text style={styles.meta}>Rôle actuel: {ROLE_LABELS[user.role] || user.role}{isMe ? " (Vous)" : ""}</Text>

            <View style={styles.row}>
              {ROLES.map((role) => (
                <Pressable
                  key={role}
                  style={[styles.roleButton, user.role === role && styles.roleButtonActive]}
                  onPress={() => changeRole(user.id, role)}
                  disabled={updatingId === user.id || user.role === role}
                >
                  <Text style={[styles.roleButtonText, user.role === role && styles.roleButtonTextActive]}>{ROLE_LABELS[role] || role}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    padding: 16,
    paddingBottom: 30
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  error: {
    color: "#ff9191",
    marginBottom: 12
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10
  },
  email: {
    color: colors.text,
    fontWeight: "800"
  },
  secondary: {
    color: colors.muted,
    marginTop: 2
  },
  meta: {
    color: colors.muted,
    marginTop: 4,
    marginBottom: 10
  },
  row: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap"
  },
  roleButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  roleButtonActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent
  },
  roleButtonText: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 12
  },
  roleButtonTextActive: {
    color: "#1b260f"
  }
});
