import { useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { fetchJson, postJson } from "../api";
import { colors } from "../theme";
import { useAuth } from "../AuthContext";

const CATEGORIES = [
  { value: "CHEF_DE_SECTION", label: "Chef de section" },
  { value: "SOUS_OFFICIER_ADJOINT", label: "SOA" },
  { value: "SERGENT", label: "Sergent" },
  { value: "MILITAIRE_DU_RANG", label: "MDR" }
];

const RANK_OPTIONS_BY_CATEGORY = {
  MILITAIRE_DU_RANG: ["Soldat", "1er classe", "Cpl", "BCH", "CC1"],
  CHEF_DE_SECTION: ["Ltn", "Maj", "Adc", "Adj", "MDL/C(BM2)", "MDL/C", "MDL"],
  SOUS_OFFICIER_ADJOINT: ["Adj", "MDL/C(BM2)", "MDL/C", "MDL"],
  SERGENT: ["MDL"]
};

export default function AddSoldierScreen({ navigation }) {
  const { isAdminLike } = useAuth();
  const [sections, setSections] = useState([]);
  const [sectionId, setSectionId] = useState("section-1");
  const [name, setName] = useState("");
  const [fullName, setFullName] = useState("");
  const [rank, setRank] = useState("");
  const [photo, setPhoto] = useState("https://i.pravatar.cc/480?img=60");
  const [commandCategory, setCommandCategory] = useState("MILITAIRE_DU_RANG");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [generatedCredentials, setGeneratedCredentials] = useState(null);
  const [rankPickerVisible, setRankPickerVisible] = useState(false);

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
    return name.trim() && fullName.trim() && rank.trim() && sectionId;
  }, [fullName, name, rank, sectionId]);

  const rankOptions = useMemo(() => {
    return RANK_OPTIONS_BY_CATEGORY[commandCategory] || [];
  }, [commandCategory]);

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
      const created = await postJson("/users/soldier-account", {
        name,
        fullName,
        rank,
        sectionId,
        photo,
        commandCategory,
        email: email.trim() ? email.trim().toLowerCase() : null
      });
      setGeneratedCredentials({
        soldierId: created.soldierId,
        username: created.username,
        temporaryPassword: created.temporaryPassword
      });
      setName("");
      setFullName("");
      setRank("");
      setEmail("");
      setPhoto("https://i.pravatar.cc/480?img=60");
      setCommandCategory("MILITAIRE_DU_RANG");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function copyCredentials() {
    if (!generatedCredentials) {
      return;
    }
    await Clipboard.setStringAsync(
      `Identifiant: ${generatedCredentials.username}\nMot de passe temporaire: ${generatedCredentials.temporaryPassword}`
    );
    Alert.alert("Copié", "Identifiants copiés dans le presse-papiers.");
  }

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <TextInput style={styles.input} placeholder="Nom affiché (ex: Soldat Paul Durand)" placeholderTextColor={colors.muted} value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder="Nom complet" placeholderTextColor={colors.muted} value={fullName} onChangeText={setFullName} />
      {rankOptions.length > 0 ? (
        <Pressable style={styles.input} onPress={() => setRankPickerVisible(true)}>
          <Text style={rank ? styles.inputValueText : styles.inputPlaceholderText}>
            {rank || "Choisir un grade"}
          </Text>
        </Pressable>
      ) : (
        <TextInput style={styles.input} placeholder="Grade" placeholderTextColor={colors.muted} value={rank} onChangeText={setRank} />
      )}
      <TextInput
        style={styles.input}
        placeholder="Email (optionnel)"
        placeholderTextColor={colors.muted}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
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
        <Text style={styles.submitText}>{saving ? "Création..." : "Créer compte soldat"}</Text>
      </Pressable>

      <Modal visible={Boolean(generatedCredentials)} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Identifiants générés</Text>
            <Text style={styles.modalText}>Ces identifiants ne seront plus affichés après fermeture.</Text>
            <Text style={styles.credentialLine}>Identifiant: {generatedCredentials?.username}</Text>
            <Text style={styles.credentialLine}>Mot de passe: {generatedCredentials?.temporaryPassword}</Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.secondaryBtn} onPress={copyCredentials}>
                <Text style={styles.secondaryBtnText}>Copier</Text>
              </Pressable>
              <Pressable style={styles.submit} onPress={() => setGeneratedCredentials(null)}>
                <Text style={styles.submitText}>Fermer</Text>
              </Pressable>
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => {
                  const soldierId = generatedCredentials?.soldierId;
                  setGeneratedCredentials(null);
                  if (soldierId) {
                    navigation.replace("Soldier", { soldierId });
                  }
                }}
              >
                <Text style={styles.secondaryBtnText}>Voir profil</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={rankPickerVisible} transparent animationType="fade" onRequestClose={() => setRankPickerVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Choisir un grade</Text>
            <View style={styles.modalActions}>
              {rankOptions.map((option) => (
                <Pressable
                  key={option}
                  style={[styles.secondaryBtn, rank === option && styles.sectionChipActive]}
                  onPress={() => {
                    setRank(option);
                    setRankPickerVisible(false);
                  }}
                >
                  <Text style={[styles.secondaryBtnText, rank === option && styles.sectionTextActive]}>{option}</Text>
                </Pressable>
              ))}
              <Pressable style={styles.secondaryBtn} onPress={() => setRankPickerVisible(false)}>
                <Text style={styles.secondaryBtnText}>Annuler</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  inputValueText: {
    color: colors.text,
    fontSize: 16
  },
  inputPlaceholderText: {
    color: colors.muted,
    fontSize: 16
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
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    padding: 18
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800"
  },
  modalText: {
    color: colors.muted,
    marginTop: 6
  },
  credentialLine: {
    color: colors.text,
    marginTop: 10,
    fontWeight: "700"
  },
  modalActions: {
    marginTop: 14,
    gap: 8
  },
  secondaryBtn: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center"
  },
  secondaryBtnText: {
    color: colors.text,
    fontWeight: "700"
  }
});
