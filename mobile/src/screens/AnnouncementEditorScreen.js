import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { fetchJson, patchJson, postJson } from "../api";
import { colors } from "../theme";
import { useAuth } from "../AuthContext";

const SCOPES = [
  { value: "REGIMENT", label: "Régiment" },
  { value: "COMPANY", label: "Compagnie" },
  { value: "SECTION", label: "Section" }
];

function toLocalInputDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const off = date.getTimezoneOffset();
  const local = new Date(date.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
}

export default function AnnouncementEditorScreen({ navigation, route }) {
  const { session } = useAuth();
  const isAdminLike = session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER";
  const initial = route.params?.announcement || null;
  const [title, setTitle] = useState(initial?.title || "");
  const [body, setBody] = useState(initial?.body || "");
  const [scope, setScope] = useState(initial?.scope || "COMPANY");
  const [sectionId, setSectionId] = useState(initial?.sectionId || "");
  const [isPinned, setIsPinned] = useState(Boolean(initial?.isPinned));
  const [isUrgent, setIsUrgent] = useState(Boolean(initial?.isUrgent));
  const [isArchived, setIsArchived] = useState(Boolean(initial?.isArchived));
  const [expiresAt, setExpiresAt] = useState(toLocalInputDateTime(initial?.expiresAt));
  const [sections, setSections] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAdminLike) {
      navigation.goBack();
      return;
    }
    fetchJson("/sections")
      .then((data) => setSections(data || []))
      .catch((err) => setError(err.message));
  }, [isAdminLike, navigation]);

  const selectedSectionName = useMemo(
    () => sections.find((section) => section.id === sectionId)?.name || "",
    [sections, sectionId]
  );

  async function save() {
    if (!title.trim() || !body.trim()) {
      setError("Titre et contenu sont requis");
      return;
    }
    if (scope === "SECTION" && !sectionId) {
      setError("Sélectionnez une section pour le scope Section");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const payload = {
        title: title.trim(),
        body: body.trim(),
        scope,
        sectionId: scope === "SECTION" ? sectionId : null,
        isPinned,
        isUrgent,
        isArchived,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null
      };

      if (initial?.id) {
        await patchJson(`/announcements/${initial.id}`, payload);
      } else {
        await postJson("/announcements", payload);
      }

      navigation.goBack();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function pickSection() {
    if (!sections.length) return;

    Alert.alert(
      "Choisir une section",
      selectedSectionName || "",
      sections.map((section) => ({
        text: section.name,
        onPress: () => setSectionId(section.id)
      }))
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.label}>Titre</Text>
      <TextInput value={title} onChangeText={setTitle} style={styles.input} placeholder="Titre" placeholderTextColor="#8290a1" />

      <Text style={styles.label}>Contenu</Text>
      <TextInput
        value={body}
        onChangeText={setBody}
        style={[styles.input, styles.textArea]}
        placeholder="Texte de l'annonce"
        placeholderTextColor="#8290a1"
        multiline
      />

      <Text style={styles.label}>Portée</Text>
      <View style={styles.scopeRow}>
        {SCOPES.map((item) => (
          <Pressable
            key={item.value}
            onPress={() => setScope(item.value)}
            style={[styles.scopeBtn, scope === item.value ? styles.scopeBtnActive : null]}
          >
            <Text style={scope === item.value ? styles.scopeBtnTextActive : styles.scopeBtnText}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      {scope === "SECTION" ? (
        <>
          <Text style={styles.label}>Section</Text>
          <Pressable style={styles.sectionPicker} onPress={pickSection}>
            <Text style={styles.sectionPickerText}>{selectedSectionName || "Sélectionner"}</Text>
          </Pressable>
        </>
      ) : null}

      <Text style={styles.label}>Expiration (optionnel)</Text>
      <TextInput
        value={expiresAt}
        onChangeText={setExpiresAt}
        style={styles.input}
        placeholder="AAAA-MM-JJTHH:MM"
        placeholderTextColor="#8290a1"
        autoCapitalize="none"
      />

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Épinglée</Text>
        <Switch value={isPinned} onValueChange={setIsPinned} />
      </View>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Urgente</Text>
        <Switch value={isUrgent} onValueChange={setIsUrgent} />
      </View>
      {initial ? (
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Archivée</Text>
          <Switch value={isArchived} onValueChange={setIsArchived} />
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.saveButton} onPress={save} disabled={saving}>
        <Text style={styles.saveButtonText}>{saving ? "Enregistrement..." : initial ? "Mettre à jour" : "Créer"}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    padding: 16,
    paddingBottom: 28
  },
  label: {
    color: colors.muted,
    marginBottom: 6,
    marginTop: 10,
    textTransform: "uppercase",
    fontSize: 12,
    letterSpacing: 0.8
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: "top"
  },
  scopeRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap"
  },
  scopeBtn: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: colors.surfaceAlt
  },
  scopeBtnActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent
  },
  scopeBtnText: {
    color: colors.text,
    fontWeight: "600"
  },
  scopeBtnTextActive: {
    color: "#16210f",
    fontWeight: "800"
  },
  sectionPicker: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  sectionPickerText: {
    color: colors.text
  },
  switchRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  switchLabel: {
    color: colors.text,
    fontWeight: "700"
  },
  error: {
    marginTop: 10,
    color: "#ff9191"
  },
  saveButton: {
    marginTop: 14,
    backgroundColor: colors.accent,
    borderRadius: 12,
    padding: 12,
    alignItems: "center"
  },
  saveButtonText: {
    color: "#19210f",
    fontWeight: "800"
  }
});
