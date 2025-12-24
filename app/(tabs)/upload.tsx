import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as DocumentPicker from "expo-document-picker";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  DocumentStorage,
  MedicalDocument,
} from "../../services/DocumentStorage";

export default function UploadScreen() {
  const [documents, setDocuments] = useState<MedicalDocument[]>([]);
  const [uploading, setUploading] = useState(false);

  /* ---------------- LOAD DOCUMENTS ---------------- */
  const loadDocuments = async () => {
    try {
      const docs = await DocumentStorage.getDocuments();
      setDocuments(docs);
    } catch (err) {
      console.error("Failed to load documents", err);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadDocuments();
    }, [])
  );

  /* ---------------- PICK & UPLOAD DOCUMENT ---------------- */
  const pickDocument = async () => {
    try {
      setUploading(true);

      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];

        const response = await fetch(asset.uri);
        const blob = await response.blob();

        const file = new File([blob], asset.name || "medical_document", {
          type: asset.mimeType || "application/octet-stream",
        });

        const uploadedDoc = await DocumentStorage.uploadToCloudinary(file);

        // ✅ Instant UI update
        setDocuments((prev) => [...prev, uploadedDoc]);

        Alert.alert("Success", "Medical report uploaded successfully!");
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      Alert.alert("Error", error.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  /* ---------------- DELETE SINGLE DOCUMENT ---------------- */
  const deleteDocument = (id: string) => {
    Alert.alert(
      "Delete Document",
      "Are you sure you want to delete this document?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await DocumentStorage.deleteDocument(id);

              // ✅ IMMEDIATE UI UPDATE
              setDocuments((prev) => prev.filter((doc) => doc.id !== id));
            } catch (error: any) {
              console.error("Delete error:", error);
              Alert.alert("Error", "Failed to delete document");
            }
          },
        },
      ]
    );
  };

  /* ---------------- DELETE ALL DOCUMENTS ---------------- */
  const deleteAllDocuments = () => {
    if (documents.length === 0) return;

    Alert.alert(
      "Delete All Documents",
      `Are you sure you want to delete all ${documents.length} documents?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete All",
          style: "destructive",
          onPress: async () => {
            try {
              await DocumentStorage.deleteAllDocuments();

              // ✅ Clear UI instantly
              setDocuments([]);

              Alert.alert("Success", "All documents deleted");
            } catch (error: any) {
              console.error("Delete all error:", error);
              Alert.alert("Error", "Failed to delete all documents");
            }
          },
        },
      ]
    );
  };

  /* ---------------- HELPERS ---------------- */
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Medical Scan":
        return "scan-outline";
      case "Medical Report":
        return "document-text-outline";
      case "Medical Bill":
        return "receipt-outline";
      default:
        return "document-outline";
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Medical Scan":
        return "#3498db";
      case "Medical Report":
        return "#667eea";
      case "Medical Bill":
        return "#e74c3c";
      default:
        return "#95a5a6";
    }
  };

  /* ---------------- RENDER ITEM ---------------- */
  const renderDocument = ({ item }: { item: MedicalDocument }) => (
    <View style={styles.documentItem}>
      <View
        style={[
          styles.documentIcon,
          { backgroundColor: getCategoryColor(item.category) + "20" },
        ]}
      >
        <Ionicons
          name={getCategoryIcon(item.category)}
          size={24}
          color={getCategoryColor(item.category)}
        />
      </View>

      <View style={styles.documentInfo}>
        <Text style={styles.documentName} numberOfLines={1}>
          {item.name}
        </Text>

        <View style={styles.documentMeta}>
          <Text
            style={[
              styles.categoryTag,
              {
                backgroundColor: getCategoryColor(item.category) + "20",
                color: getCategoryColor(item.category),
              },
            ]}
          >
            {item.category}
          </Text>

          <Text style={styles.documentDate}>
            {new Date(item.uploadDate).toLocaleDateString()} •{" "}
            {(item.size / 1024 / 1024).toFixed(2)} MB
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => deleteDocument(item.id)}
      >
        <Ionicons name="trash-outline" size={18} color="#ff4444" />
      </TouchableOpacity>
    </View>
  );

  /* ---------------- UI ---------------- */
  return (
    <LinearGradient colors={["#f8f9ff", "#e8f0ff"]} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Medical Reports</Text>
        <Text style={styles.subtitle}>
          Upload your medical documents for AI analysis
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
        onPress={pickDocument}
        disabled={uploading}
      >
        <LinearGradient
          colors={uploading ? ["#bdc3c7", "#95a5a6"] : ["#667eea", "#764ba2"]}
          style={styles.uploadButtonGradient}
        >
          {uploading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Ionicons name="cloud-upload-outline" size={24} color="white" />
          )}
          <Text style={styles.uploadButtonText}>
            {uploading ? "Uploading..." : "Upload Document"}
          </Text>
        </LinearGradient>
      </TouchableOpacity>

      <View style={styles.documentsSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Your Documents ({documents.length})
          </Text>

          {documents.length > 0 && (
            <TouchableOpacity
              style={styles.deleteAllButton}
              onPress={deleteAllDocuments}
            >
              <Ionicons name="trash-outline" size={16} color="#ff4444" />
              <Text style={styles.deleteAllText}>Delete All</Text>
            </TouchableOpacity>
          )}
        </View>

        <FlatList
          data={documents}
          renderItem={renderDocument}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="document-outline" size={64} color="#bdc3c7" />
              <Text style={styles.emptyText}>No documents uploaded yet</Text>
              <Text style={styles.emptySubtext}>
                Upload PDF files or images of your medical reports
              </Text>
            </View>
          }
        />
      </View>
    </LinearGradient>
  );
}

/* ---------------- STYLES ---------------- */
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 50, paddingHorizontal: 20, paddingBottom: 20 },
  title: { fontSize: 28, fontWeight: "700", color: "#2c3e50" },
  subtitle: { fontSize: 16, color: "#667eea", fontWeight: "500" },

  uploadButton: {
    marginHorizontal: 20,
    marginBottom: 30,
    borderRadius: 16,
    elevation: 6,
  },
  uploadButtonDisabled: { elevation: 0 },
  uploadButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    borderRadius: 16,
    gap: 12,
  },
  uploadButtonText: { color: "white", fontSize: 18, fontWeight: "600" },

  documentsSection: { flex: 1, paddingHorizontal: 20 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 20, fontWeight: "600" },

  deleteAllButton: {
    flexDirection: "row",
    backgroundColor: "#ffe6e6",
    padding: 8,
    borderRadius: 12,
    gap: 6,
  },
  deleteAllText: { color: "#ff4444", fontWeight: "600" },

  documentItem: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  documentIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  documentInfo: { flex: 1 },
  documentName: { fontSize: 16, fontWeight: "600" },
  documentMeta: { flexDirection: "row", gap: 8, marginTop: 4 },
  categoryTag: {
    fontSize: 10,
    fontWeight: "600",
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  documentDate: { fontSize: 12, color: "#95a5a6" },

  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ffe6e6",
    justifyContent: "center",
    alignItems: "center",
  },

  emptyContainer: { alignItems: "center", paddingTop: 80 },
  emptyText: { fontSize: 18, fontWeight: "600", color: "#95a5a6" },
  emptySubtext: { fontSize: 14, color: "#bdc3c7", marginTop: 6 },
});
