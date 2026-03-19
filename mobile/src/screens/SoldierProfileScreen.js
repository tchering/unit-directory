import { useEffect, useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { deleteJson, fetchJson, patchJson } from "../api";
import { colors } from "../theme";
import { useAuth } from "../AuthContext";

const CATEGORY_LABELS = {
  CHEF_DE_SECTION: "Chef de section",
  SOUS_OFFICIER_ADJOINT: "SOA",
  SERGENT: "Sergent",
  MILITAIRE_DU_RANG: "MDR"
};
const AVAILABILITY_LABELS = {
  PRESENT: "Présent",
  ABSENT: "Absent",
  MISSION: "En mission",
  PERMISSION: "Permission"
};

const CATEGORIES = [
  "CHEF_DE_SECTION",
  "SOUS_OFFICIER_ADJOINT",
  "SERGENT",
  "MILITAIRE_DU_RANG"
];

export default function SoldierProfileScreen({ route, navigation }) {
  const { soldierId } = route.params;
  const { isAdminLike, session } = useAuth();
  const [mySoldierId, setMySoldierId] = useState(session?.user?.soldierId || null);
  const [soldier, setSoldier] = useState(null);
  const [sections, setSections] = useState([]);
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("MILITAIRE_DU_RANG");
  const [working, setWorking] = useState(false);
  const [photoWorking, setPhotoWorking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchJson(`/soldiers/${soldierId}`)
      .then((data) => {
        setSoldier(data);
        setSelectedSectionId(data.sectionId || "");
        setSelectedCategory(data.commandCategory || "MILITAIRE_DU_RANG");
      })
      .catch((err) => {
        setError(err.message);
      });

    if (isAdminLike) {
      fetchJson("/sections")
        .then(setSections)
        .catch(() => {
          // Non bloquant pour l'affichage du profil.
        });
    }
  }, [isAdminLike, soldierId]);

  useEffect(() => {
    if (isAdminLike || mySoldierId) {
      return;
    }
    fetchJson("/auth/me")
      .then((me) => setMySoldierId(me?.soldierId || null))
      .catch(() => {
        // Non bloquant: le backend appliquera quand même les permissions.
      });
  }, [isAdminLike, mySoldierId]);

  const canChangePhoto = Boolean(
    isAdminLike || (mySoldierId && mySoldierId === soldier?.id)
  );
  const canSeePhotoAction = Boolean(session?.user?.id);

  async function changePhoto() {
    if (!soldier || photoWorking) {
      return;
    }
    if (!canChangePhoto) {
      Alert.alert(
        "Accès limité",
        "Vous pouvez changer uniquement votre propre photo de profil."
      );
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission requise", "Autorisez l'accès aux photos pour changer la photo du profil.");
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.65,
      base64: true
    });

    if (picked.canceled || !picked.assets?.length) {
      return;
    }

    const asset = picked.assets[0];
    if (!asset.base64) {
      Alert.alert("Erreur", "Impossible de lire l'image sélectionnée.");
      return;
    }

    const mime = asset.mimeType || "image/jpeg";
    const photoDataUrl = `data:${mime};base64,${asset.base64}`;

    setPhotoWorking(true);
    setError("");
    try {
      const updated = await patchJson(`/soldiers/${soldier.id}/photo`, { photoDataUrl });
      setSoldier(updated);
      Alert.alert("Succès", "Photo mise à jour.");
    } catch (err) {
      setError(err.message);
    } finally {
      setPhotoWorking(false);
    }
  }

  async function moveSoldier() {
    if (!isAdminLike || !soldier || working) {
      return;
    }

    setWorking(true);
    setError("");

    try {
      const updated = await patchJson(`/soldiers/${soldier.id}`, {
        sectionId: selectedSectionId,
        commandCategory: selectedCategory
      });
      setSoldier(updated);
      Alert.alert("Succès", "Militaire déplacé avec succès.");
    } catch (err) {
      setError(err.message);
    } finally {
      setWorking(false);
    }
  }

  function confirmDelete() {
    if (!soldier || working || !isAdminLike) {
      return;
    }

    Alert.alert(
      "Supprimer le militaire",
      "Cette action est définitive. Confirmer la suppression ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            setWorking(true);
            setError("");
            try {
              await deleteJson(`/soldiers/${soldier.id}`);
              Alert.alert("Supprimé", "Le militaire a été supprimé.", [
                { text: "OK", onPress: () => navigation.goBack() }
              ]);
            } catch (err) {
              setError(err.message);
              setWorking(false);
            }
          }
        }
      ]
    );
  }

  if (!soldier) {
    return <Text style={styles.loading}>Chargement du profil...</Text>;
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View>
        <Image source={{ uri: soldier.photo }} style={styles.photo} />
        {canSeePhotoAction ? (
          <Pressable
            style={[styles.photoEditBtn, (!canChangePhoto || photoWorking) && styles.disabledBtn]}
            onPress={changePhoto}
            disabled={photoWorking}
          >
            <Text style={styles.photoEditBtnText}>{photoWorking ? "Upload..." : "Changer la photo"}</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.panel}>
        <Text style={styles.eyebrow}>Profil militaire</Text>
        <Text style={styles.name}>{soldier.fullName}</Text>
        <Text style={styles.line}>Grade: {soldier.rank}</Text>
        <Text style={styles.line}>Section: {soldier.section}</Text>
        <Text style={styles.line}>Catégorie: {CATEGORY_LABELS[soldier.commandCategory] || "MDR"}</Text>
        <Text style={styles.line}>Statut: {AVAILABILITY_LABELS[soldier.availability] || "Présent"}</Text>
        <Text style={styles.line}>Position: {soldier.currentPosition || "Non renseignée"}</Text>
      </View>

      {isAdminLike ? (
        <View style={styles.panel}>
          <Text style={styles.eyebrow}>Actions gestion</Text>
          <Text style={styles.label}>Nouvelle catégorie</Text>
          <View style={styles.row}>
            {CATEGORIES.map((category) => (
              <Pressable
                key={category}
                style={[styles.chip, selectedCategory === category && styles.chipActive]}
                onPress={() => setSelectedCategory(category)}
              >
                <Text style={[styles.chipText, selectedCategory === category && styles.chipTextActive]}>
                  {CATEGORY_LABELS[category]}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Nouvelle section</Text>
          <View style={styles.row}>
            {sections.map((section) => (
              <Pressable
                key={section.id}
                style={[styles.chip, selectedSectionId === section.id && styles.chipActive]}
                onPress={() => setSelectedSectionId(section.id)}
              >
                <Text style={[styles.chipText, selectedSectionId === section.id && styles.chipTextActive]}>{section.name}</Text>
              </Pressable>
            ))}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable style={[styles.primaryBtn, working && styles.disabledBtn]} onPress={moveSoldier}>
            <Text style={styles.primaryBtnText}>{working ? "Traitement..." : "Déplacer"}</Text>
          </Pressable>

          <Pressable style={[styles.dangerBtn, working && styles.disabledBtn]} onPress={confirmDelete}>
            <Text style={styles.dangerBtnText}>Supprimer</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    padding: 16,
    gap: 12,
    paddingBottom: 30
  },
  loading: {
    color: colors.text,
    padding: 16
  },
  photo: {
    width: "100%",
    height: 220,
    borderRadius: 14,
    borderColor: colors.border,
    borderWidth: 1
  },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14
  },
  photoEditBtn: {
    position: "absolute",
    right: 10,
    bottom: 10,
    backgroundColor: "#1d2f29",
    borderWidth: 1,
    borderColor: "#3b5f53",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  photoEditBtnText: {
    color: "#d7f1e6",
    fontSize: 12,
    fontWeight: "700"
  },
  eyebrow: {
    color: colors.accent,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 12
  },
  name: {
    color: colors.text,
    fontSize: 24,
    marginTop: 6,
    marginBottom: 8,
    fontWeight: "800"
  },
  line: {
    color: colors.text,
    marginTop: 5,
    fontSize: 16
  },
  label: {
    color: colors.text,
    marginTop: 10,
    marginBottom: 8,
    fontWeight: "700"
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
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
  error: {
    color: "#ff9191",
    marginTop: 10
  },
  primaryBtn: {
    marginTop: 12,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center"
  },
  primaryBtnText: {
    color: "#1b260f",
    fontWeight: "800"
  },
  dangerBtn: {
    marginTop: 10,
    backgroundColor: "#5a2020",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#7a2d2d"
  },
  dangerBtnText: {
    color: "#ffdede",
    fontWeight: "800"
  },
  disabledBtn: {
    opacity: 0.6
  }
});
