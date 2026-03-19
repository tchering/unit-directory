import { useMemo, useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import SoldierCard from "../components/SoldierCard";
import { fetchJson, patchJson } from "../api";
import { colors } from "../theme";
import { useAuth } from "../AuthContext";

const GROUPS = [
  { key: "CHEF_DE_SECTION", label: "Chef de section" },
  { key: "SOUS_OFFICIER_ADJOINT", label: "SOA" },
  { key: "SERGENT", label: "Sergent" },
  { key: "MILITAIRE_DU_RANG", label: "MDR" }
];

const AVAILABILITY = [
  { key: "PRESENT", label: "Présent" },
  { key: "ABSENT", label: "Absent" },
  { key: "MISSION", label: "En mission" },
  { key: "PERMISSION", label: "Permission" }
];

export default function SectionScreen({ navigation, route }) {
  const { sectionId } = route.params;
  const { session } = useAuth();
  const isAdminLike = session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER";
  const mySoldierId = session?.user?.soldierId || null;

  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [editingSoldierId, setEditingSoldierId] = useState("");
  const [positionInput, setPositionInput] = useState("");
  const [availabilityInput, setAvailabilityInput] = useState("PRESENT");
  const [saving, setSaving] = useState(false);

  const loadSection = useCallback(() => {
    setError("");
    return fetchJson(`/sections/${sectionId}/soldiers`)
      .then(setData)
      .catch((err) => {
        setError(err.message);
      });
  }, [sectionId]);

  useFocusEffect(
    useCallback(() => {
      loadSection();
    }, [loadSection])
  );

  const grouped = useMemo(() => {
    if (!data?.soldiers) {
      return [];
    }

    return GROUPS.map((group) => ({
      ...group,
      soldiers: data.soldiers
        .filter((soldier) => (soldier.commandCategory || "MILITAIRE_DU_RANG") === group.key)
        .sort((a, b) => a.name.localeCompare(b.name, "fr"))
    }));
  }, [data]);

  function canEditPosition(soldier) {
    if (isAdminLike) {
      return true;
    }
    return Boolean(mySoldierId) && mySoldierId === soldier.id;
  }

  function openEditor(soldier) {
    if (!canEditPosition(soldier)) {
      return;
    }
    setEditingSoldierId(soldier.id);
    setPositionInput(soldier.currentPosition || "");
    setAvailabilityInput(soldier.availability || "PRESENT");
    setError("");
  }

  async function savePosition() {
    if (!editingSoldierId || saving) {
      return;
    }

    if (availabilityInput !== "PRESENT" && !positionInput.trim()) {
      setError("Position actuelle requise sauf si statut Présent");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await patchJson(`/soldiers/${editingSoldierId}/position`, {
        currentPosition: positionInput,
        availability: availabilityInput
      });
      setEditingSoldierId("");
      setPositionInput("");
      setAvailabilityInput("PRESENT");
      await loadSection();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!data) {
    return <Text style={styles.loading}>Chargement de la section...</Text>;
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {grouped.map((group) => (
        <View key={group.key} style={styles.group}>
          <Text style={styles.groupTitle}>{group.label}</Text>
          {group.soldiers.length === 0 ? (
            <Text style={styles.empty}>Aucun militaire.</Text>
          ) : (
            group.soldiers.map((soldier) => {
              const canEdit = canEditPosition(soldier);
              const isEditing = editingSoldierId === soldier.id;

              return (
                <View key={soldier.id}>
                  <SoldierCard
                    soldier={soldier}
                    onPress={() => navigation.navigate("Soldier", { soldierId: soldier.id })}
                    actionLabel={canEdit ? "Mettre à jour position" : null}
                    onActionPress={canEdit ? () => openEditor(soldier) : null}
                    disableAction={saving}
                  />

                  {isEditing ? (
                    <View style={styles.editorPanel}>
                      <Text style={styles.editorLabel}>Position actuelle</Text>
                      <TextInput
                        value={positionInput}
                        onChangeText={setPositionInput}
                        placeholder="Ex: service régimentaire"
                        placeholderTextColor="#8391a0"
                        style={[styles.input, availabilityInput === "PRESENT" && styles.inputDisabled]}
                        editable={availabilityInput !== "PRESENT"}
                      />
                      {availabilityInput === "PRESENT" ? (
                        <Text style={styles.inputHint}>Avec le statut Présent, la position est automatiquement non renseignée.</Text>
                      ) : null}

                      <Text style={styles.editorLabel}>Statut présence</Text>
                      <View style={styles.chipsWrap}>
                        {AVAILABILITY.map((item) => (
                          <Pressable
                            key={item.key}
                            style={[styles.chip, availabilityInput === item.key && styles.chipActive]}
                            onPress={() => {
                              setAvailabilityInput(item.key);
                              if (item.key === "PRESENT") {
                                setPositionInput("");
                              }
                            }}
                          >
                            <Text style={[styles.chipText, availabilityInput === item.key && styles.chipTextActive]}>{item.label}</Text>
                          </Pressable>
                        ))}
                      </View>

                      <View style={styles.editorActions}>
                        <Pressable style={[styles.saveBtn, saving && styles.disabledBtn]} onPress={savePosition} disabled={saving}>
                          <Text style={styles.saveBtnText}>{saving ? "Enregistrement..." : "Enregistrer"}</Text>
                        </Pressable>
                        <Pressable
                          style={styles.cancelBtn}
                          onPress={() => {
                            setEditingSoldierId("");
                            setPositionInput("");
                            setAvailabilityInput("PRESENT");
                            setError("");
                          }}
                          disabled={saving}
                        >
                          <Text style={styles.cancelBtnText}>Annuler</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </View>
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
  },
  group: {
    marginBottom: 12
  },
  groupTitle: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 8
  },
  empty: {
    color: colors.muted,
    marginBottom: 8
  },
  error: {
    color: "#ff9191",
    marginBottom: 10
  },
  editorPanel: {
    marginTop: -2,
    marginBottom: 12,
    backgroundColor: "#1a1f1f",
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10
  },
  editorLabel: {
    color: colors.muted,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 6
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9
  },
  inputDisabled: {
    opacity: 0.55
  },
  inputHint: {
    color: colors.muted,
    marginTop: 6,
    fontSize: 12
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: colors.surfaceAlt
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent
  },
  chipText: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 12
  },
  chipTextActive: {
    color: "#1b260f"
  },
  editorActions: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8
  },
  saveBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center"
  },
  saveBtnText: {
    color: "#1b260f",
    fontWeight: "800"
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: "#2b2e33",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center"
  },
  cancelBtnText: {
    color: colors.text,
    fontWeight: "700"
  },
  disabledBtn: {
    opacity: 0.6
  }
});
