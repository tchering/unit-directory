import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { fetchJson, postJson } from "../api";
import { colors } from "../theme";
import { useAuth } from "../AuthContext";

const CATEGORIES = [
  { value: "CHEF_DE_SECTION", label: "Chef de section" },
  { value: "SOUS_OFFICIER_ADJOINT", label: "Sous-officier adjoint" },
  { value: "SERGENT", label: "Sergent" },
  { value: "MILITAIRE_DU_RANG", label: "Militaire du rang" }
];

export default function AddSoldierScreen({ navigation }) {
  const { isAdminLike } = useAuth();
  const [sections, setSections] = useState([]);
  const [sectionId, setSectionId] = useState("section-1");
  const [name, setName] = useState("");
  const [fullName, setFullName] = useState("");
  const [rank, setRank] = useState("");
  const [role, setRole] = useState("");
  const [photo, setPhoto] = useState("https://i.pravatar.cc/480?img=60");
  const [commandCategory, setCommandCategory] = useState("MILITAIRE_DU_RANG");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAdminLike) {
      setError("Seuls ADMIN et MANAGER peuvent ajouter des militaires.");
      return;
    }

    fetchJson("/sections")
      .then((data) => {
        setSections(data);
        if (data.length > 0) {
          setSectionId(data[0].id);
        }
      })
      .catch((err) => {
        setError(err.message);
      });
  }, [isAdminLike]);

  const canSubmit = useMemo(() => {
    return name.trim() && fullName.trim() && rank.trim() && role.trim() && sectionId;
  }, [fullName, name, rank, role, sectionId]);

  async function handleCreate() {
    if (!canSubmit || saving) {
      return;
    }
    if (!isAdminLike) {
      setError("Accès interdit");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const created = await postJson("/soldiers", {
        name,
        fullName,
        rank,
        role,
        sectionId,
        photo,
        commandCategory
      });
      navigation.replace("Soldier", { soldierId: created.id });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <TextInput style={styles.input} placeholder="Nom affiché (ex: Soldat Paul Durand)" placeholderTextColor={colors.muted} value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder="Nom complet" placeholderTextColor={colors.muted} value={fullName} onChangeText={setFullName} />
      <TextInput style={styles.input} placeholder="Grade" placeholderTextColor={colors.muted} value={rank} onChangeText={setRank} />
      <TextInput style={styles.input} placeholder="Fonction" placeholderTextColor={colors.muted} value={role} onChangeText={setRole} />
      <TextInput style={styles.input} placeholder="URL photo" placeholderTextColor={colors.muted} value={photo} onChangeText={setPhoto} autoCapitalize="none" />

      <Text style={styles.label}>Catégorie de commandement</Text>
      <View style={styles.sectionWrap}>
        {CATEGORIES.map((category) => (
          <Pressable
            key={category.value}
            style={[styles.sectionChip, commandCategory === category.value && styles.sectionChipActive]}
            onPress={() => setCommandCategory(category.value)}
          >
            <Text style={[styles.sectionText, commandCategory === category.value && styles.sectionTextActive]}>{category.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Section</Text>
      <View style={styles.sectionWrap}>
        {sections.map((section) => (
          <Pressable
            key={section.id}
            style={[styles.sectionChip, sectionId === section.id && styles.sectionChipActive]}
            onPress={() => setSectionId(section.id)}
          >
            <Text style={[styles.sectionText, sectionId === section.id && styles.sectionTextActive]}>{section.name}</Text>
          </Pressable>
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={[styles.submit, (!canSubmit || saving) && styles.submitDisabled]} onPress={handleCreate}>
        <Text style={styles.submitText}>{saving ? "Enregistrement..." : "Créer le militaire"}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    padding: 16,
    paddingBottom: 28
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
    marginBottom: 10
  },
  label: {
    color: colors.text,
    marginTop: 6,
    marginBottom: 8,
    fontWeight: "700"
  },
  sectionWrap: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 14
  },
  sectionChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.surface
  },
  sectionChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent
  },
  sectionText: {
    color: colors.text,
    fontWeight: "600"
  },
  sectionTextActive: {
    color: "#1b260f"
  },
  error: {
    color: "#ff9191",
    marginBottom: 10
  },
  submit: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center"
  },
  submitDisabled: {
    opacity: 0.6
  },
  submitText: {
    color: "#1b260f",
    fontWeight: "800"
  }
});
