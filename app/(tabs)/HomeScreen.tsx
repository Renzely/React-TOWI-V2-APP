import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  ListRenderItem,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
  Button,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useRouter } from "expo-router";
import styles from "./Style";
import moment from "moment";
import Icon from "react-native-vector-icons/MaterialIcons";
import { useAuth } from "./auth";
import { ScrollView } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { syncOfflineInventories } from "./offlineSync";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Image } from "react-native";
import { Picker } from "@react-native-picker/picker";
import DropDownPicker from "react-native-dropdown-picker";

type SKUCarried = {
  sku: string;
  skuCode: string;
  beginningPCS: number;
  deliveryPCS: number;
  endingPCS: number;
  offtake: number;
  inventoryDays: number;
  expiryMonths: string;
  expiryQty: number;
};

type SKUInfo = {
  sku: string;
  skuCode: string;
};

type VersionGroup = {
  Carried: SKUCarried[];
  "Not Carried": SKUInfo[];
  Delisted: SKUInfo[];
};

//PROFILE

type UserData = {
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  contactNumber: string;
};

export interface InventoryItem {
  _id: string;
  date: string;
  email: string;
  merchandiser: string;
  outlet: string;
  weeksCovered: string;
  month: string;
  week: string;
  locked?: boolean;
  versions: {
    V1: VersionGroup;
    V2: VersionGroup;
    V3: VersionGroup;
  };
  isOffline?: boolean;
}

export interface OfflineInventoryItem {
  data: InventoryItem;
  previousWeekId?: string;
}

const AttendanceScreen = () => {
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [hasTimedIn, setHasTimedIn] = useState(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedOutlet, setSelectedOutlet] = useState("");
  const [outletOptions, setOutletOptions] = useState([
    { label: "Select Branch", value: "" },
  ]);
  const [email, setUserEmail] = useState("");
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [timeInTimestamp, setTimeInTimestamp] = useState<string | null>(null);
  const [timeOutTimestamp, setTimeOutTimestamp] = useState<string | null>(null);
  const [addressTimeIn, setAddressTimeIn] = useState<string | null>(null);
  const [addressTimeOut, setAddressTimeOut] = useState<string | null>(null);
  const [timeInSelfieUri, setTimeInSelfieUri] = useState<string | null>(null);
  const [timeOutSelfieUri, setTimeOutSelfieUri] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedSelfieUri, setSelectedSelfieUri] = useState<string | null>(
    null
  );

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();

      // Format date: e.g., May 19, 2025
      const options = {
        year: "numeric" as const,
        month: "long" as const,
        day: "numeric" as const,
      };

      const formattedDate = now.toLocaleDateString(undefined, options);

      // Format time: e.g., 2:45 PM
      const hours = now.getHours() % 12 || 12;
      const minutes = now.getMinutes().toString().padStart(2, "0");
      const ampm = now.getHours() >= 12 ? "PM" : "AM";
      const formattedTime = `${hours}:${minutes} ${ampm}`;

      setCurrentDate(formattedDate);
      setCurrentTime(formattedTime);
    };

    updateDateTime(); // Initial call
    const interval = setInterval(updateDateTime, 60000); // Update every 60 seconds

    return () => clearInterval(interval); // Cleanup on unmount
  }, []);

  const viewSelfie = (uri: string) => {
    setSelectedSelfieUri(uri);
    setModalVisible(true);
  };
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const getAddressFromCoords = async (
    lat: number,
    lon: number
  ): Promise<string | null> => {
    try {
      const [address] = await Location.reverseGeocodeAsync({
        latitude: lat,
        longitude: lon,
      });
      if (address) {
        return `${address.street || ""}, ${
          address.city || address.district || ""
        }, ${address.region || ""}`;
      }
    } catch (error) {
      console.error("Reverse geocoding failed", error);
    }
    return null;
  };

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission to access location was denied");
        return;
      }

      let currentLocation = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      });

      // Remove reverse geocoding here — now handled in Time In/Out functions
    })();
  }, []);

  useEffect(() => {
    const loadOutlets = async () => {
      try {
        const storedBranch = await AsyncStorage.getItem("outlet");

        if (storedBranch) {
          const outlets = storedBranch
            .split(",")
            .map((outlet) => outlet.trim());
          const options = outlets.map((outlet) => ({
            label: outlet,
            value: outlet,
          }));

          setOutletOptions([{ label: "Select Branch", value: "" }, ...options]);

          // Optional: set default selected outlet to first actual outlet
          if (options.length > 0) {
            setSelectedOutlet(options[0].value);
          }
        }
      } catch (error) {
        console.error("Failed to load outlets", error);
      }
    };

    loadOutlets();
  }, []);

  // Request location permission & get coordinates
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission to access location was denied");
        return;
      }

      let currentLocation = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      });
    })();
  }, []);

  useEffect(() => {
    const getEmail = async () => {
      const email = await AsyncStorage.getItem("email");
      if (email) setUserEmail(email);
    };
    getEmail();
  }, []);

  const loadAttendanceStatusForOutlet = async (outlet: string) => {
    const today = new Date().toISOString().split("T")[0];

    // Reset everything if no outlet is selected
    if (!outlet) {
      setHasTimedIn(false);
      setHasTimedOut(false);
      setTimeInTimestamp(null);
      setTimeOutTimestamp(null);
      setAddressTimeIn(null);
      setAddressTimeOut(null);
      setTimeInSelfieUri(null);
      setTimeOutSelfieUri(null);
      return;
    }

    // Keys
    const hasTimedInKey = `hasTimedIn_${outlet}`;
    const timeInDateKey = `timeInDate_${outlet}`;
    const timeInTimestampKey = `timeInTimestamp_${outlet}`;
    const addressTimeInKey = `addressTimeIn_${outlet}`;
    const timeInSelfieUriKey = `timeInSelfieUri_${outlet}`;
    const hasTimedOutKey = `hasTimedOut_${outlet}`;
    const timeOutDateKey = `timeOutDate_${outlet}`;
    const timeOutTimestampKey = `timeOutTimestamp_${outlet}`;
    const addressTimeOutKey = `addressTimeOut_${outlet}`;
    const timeOutSelfieUriKey = `timeOutSelfieUri_${outlet}`;

    // Load & Validate Time In
    const storedTimeIn = await AsyncStorage.getItem(hasTimedInKey);
    const storedTimeInDate = await AsyncStorage.getItem(timeInDateKey);

    if (storedTimeIn === "true" && storedTimeInDate === today) {
      setHasTimedIn(true);
      setTimeInTimestamp(await AsyncStorage.getItem(timeInTimestampKey));
      setAddressTimeIn(await AsyncStorage.getItem(addressTimeInKey));
      setTimeInSelfieUri(await AsyncStorage.getItem(timeInSelfieUriKey));
    } else {
      setHasTimedIn(false);
      setTimeInTimestamp(null);
      setAddressTimeIn(null);
      setTimeInSelfieUri(null);
      await AsyncStorage.multiRemove([
        hasTimedInKey,
        timeInDateKey,
        timeInTimestampKey,
        addressTimeInKey,
        timeInSelfieUriKey,
      ]);
    }

    // Load & Validate Time Out
    const storedTimeOut = await AsyncStorage.getItem(hasTimedOutKey);
    const storedTimeOutDate = await AsyncStorage.getItem(timeOutDateKey);

    if (storedTimeOut === "true" && storedTimeOutDate === today) {
      setHasTimedOut(true);
      setTimeOutTimestamp(await AsyncStorage.getItem(timeOutTimestampKey));
      setAddressTimeOut(await AsyncStorage.getItem(addressTimeOutKey));
      setTimeOutSelfieUri(await AsyncStorage.getItem(timeOutSelfieUriKey));
    } else {
      setHasTimedOut(false);
      setTimeOutTimestamp(null);
      setAddressTimeOut(null);
      setTimeOutSelfieUri(null);
      await AsyncStorage.multiRemove([
        hasTimedOutKey,
        timeOutDateKey,
        timeOutTimestampKey,
        addressTimeOutKey,
        timeOutSelfieUriKey,
      ]);
    }
  };

  // Load attendance data when selected outlet changes
  useEffect(() => {
    loadAttendanceStatusForOutlet(selectedOutlet);
  }, [selectedOutlet]);

  const handleTimeIn = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Camera access is required to take a selfie.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
      cameraType: ImagePicker.CameraType.front,
    });

    if (result.canceled || !result.assets?.length) {
      Alert.alert("Selfie is required to Time In.");
      return;
    }

    try {
      const uri = result.assets[0].uri;
      setSelfieUri(uri);
      setTimeInSelfieUri(uri);

      const fileName = `Time_In_(${email}).jpg`;
      const presignRes = await fetch(
        "http://192.168.50.54:3001/save-attendance-images",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName }),
        }
      );

      if (!presignRes.ok) throw new Error("Failed to get upload URL");
      const { url } = await presignRes.json();

      const imageBlob = await fetch(uri).then((r) => r.blob());
      const uploadRes = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "image/jpeg" },
        body: imageBlob,
      });

      if (!uploadRes.ok) {
        const errorText = await uploadRes.text();
        throw new Error(`Upload failed: ${errorText}`);
      }

      const selfieUrl = url.split("?")[0];
      const now = new Date();
      const date = now.toISOString().split("T")[0];
      const timeIn = now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      });

      let resolvedAddress: string | null = null;
      if (location) {
        resolvedAddress = await getAddressFromCoords(
          location.latitude,
          location.longitude
        );
        setAddressTimeIn(resolvedAddress);
      }

      // Save attendance to backend
      const saveRes = await fetch(
        "http://192.168.50.54:3001/attendance/time-in",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            date,
            outlet: selectedOutlet,
            timeIn,
            selfieUrl,
            location,
            timeInLocation: resolvedAddress,
          }),
        }
      );

      if (!saveRes.ok) throw new Error("Failed to save time-in data");

      setHasTimedIn(true);
      setTimeInTimestamp(`${date} ${timeIn}`);

      const hasTimedInKey = `hasTimedIn_${selectedOutlet}`;
      const timeInDateKey = `timeInDate_${selectedOutlet}`;
      const timeInTimestampKey = `timeInTimestamp_${selectedOutlet}`;
      const addressTimeInKey = `addressTimeIn_${selectedOutlet}`;
      const timeInSelfieUriKey = `timeInSelfieUri_${selectedOutlet}`;
      await AsyncStorage.setItem(timeInSelfieUriKey, uri);
      await AsyncStorage.setItem(hasTimedInKey, "true");
      await AsyncStorage.setItem(timeInDateKey, date);
      await AsyncStorage.setItem(timeInTimestampKey, `${date} ${timeIn}`);

      if (resolvedAddress) {
        await AsyncStorage.setItem(addressTimeInKey, resolvedAddress);
      }

      Alert.alert("Time In recorded!");
    } catch (error: unknown) {
      console.error(error);
      Alert.alert(
        "Failed to upload or save time-in.",
        error instanceof Error ? error.message : String(error)
      );
    }
  };

  const handleTimeOut = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Camera access is required to take a selfie.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
      cameraType: ImagePicker.CameraType.front,
    });

    if (result.canceled || !result.assets?.length) {
      Alert.alert("Selfie is required to Time Out.");
      return;
    }

    try {
      const uri = result.assets[0].uri;
      const fileName = `Time_Out_(${email}).jpg`;

      const presignRes = await fetch(
        "http://192.168.50.54:3001/save-attendance-images",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName }),
        }
      );

      if (!presignRes.ok) throw new Error("Failed to get upload URL");

      const { url } = await presignRes.json();

      const imageBlob = await fetch(uri).then((r) => r.blob());
      const uploadRes = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "image/jpeg" },
        body: imageBlob,
      });

      if (!uploadRes.ok) {
        const errorText = await uploadRes.text();
        throw new Error(`Upload failed: ${errorText}`);
      }

      const timeOutSelfieUrl = url.split("?")[0];
      const now = new Date();
      const date = now.toISOString().split("T")[0];
      const timeOut = now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      });

      let resolvedAddress: string | null = null;
      if (location) {
        resolvedAddress = await getAddressFromCoords(
          location.latitude,
          location.longitude
        );
        setAddressTimeOut(resolvedAddress);
      }

      // Save to backend
      const saveRes = await fetch(
        "http://192.168.50.54:3001/attendance/time-out",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            date,
            outlet: selectedOutlet,
            timeOut,
            timeOutSelfieUrl,
            location,
            timeOutLocation: resolvedAddress,
          }),
        }
      );

      if (!saveRes.ok) throw new Error("Failed to save time-out data");

      setHasTimedOut(true);
      setTimeOutTimestamp(`${date} ${timeOut}`);
      setTimeOutSelfieUri(uri);
      const hasTimedOutKey = `hasTimedOut_${selectedOutlet}`;
      const timeOutDateKey = `timeOutDate_${selectedOutlet}`;
      const timeOutTimestampKey = `timeOutTimestamp_${selectedOutlet}`;
      const addressTimeOutKey = `addressTimeOut_${selectedOutlet}`;
      const timeOutSelfieUriKey = `timeOutSelfieUri_${selectedOutlet}`;
      await AsyncStorage.setItem(timeOutSelfieUriKey, uri);
      await AsyncStorage.setItem(hasTimedOutKey, "true");
      await AsyncStorage.setItem(timeOutDateKey, date);
      await AsyncStorage.setItem(timeOutTimestampKey, `${date} ${timeOut}`);

      if (resolvedAddress) {
        await AsyncStorage.setItem(addressTimeOutKey, resolvedAddress);
      }

      Alert.alert("Time Out recorded!");
    } catch (error: unknown) {
      console.error(error);
      Alert.alert(
        "Failed to upload or save time-out.",
        error instanceof Error ? error.message : String(error)
      );
    }
  };

  return (
    <View style={styles.safeArea}>
      <View style={styles.appBarAttendance}>
        <Text style={styles.appBarTitleAttendance}>ATTENDANCE</Text>
      </View>

      <View style={styles.containerAttendance}>
        <View style={{ alignItems: "center", marginBottom: 20 }}>
          <Text style={{ fontSize: 24, fontWeight: "600" }}>{currentDate}</Text>
          <Text style={{ fontSize: 56, fontWeight: "bold", marginTop: 5 }}>
            {currentTime}
          </Text>
        </View>

        <View style={styles.pickerWrapper}>
          <DropDownPicker
            open={open}
            value={selectedOutlet}
            items={outletOptions}
            setOpen={setOpen}
            setValue={setSelectedOutlet}
            setItems={setOutletOptions}
            searchable={true}
            placeholder="Select Branch"
            disabled={hasTimedIn && !hasTimedOut} // disable after TIME IN, enable after TIME OUT
            style={{ width: 250 }}
            dropDownContainerStyle={{ width: 250 }}
          />
        </View>

        {/* TIME IN */}
        <Text style={styles.sectionLabel}>TIME IN</Text>

        <View style={styles.buttonContainer}>
          <Button
            title="TIME IN"
            onPress={handleTimeIn}
            disabled={hasTimedIn}
            color={hasTimedIn ? "gray" : "green"}
          />
        </View>

        {/* 👇 View Time In Selfie Icon */}
        {timeInSelfieUri && (
          <TouchableOpacity onPress={() => viewSelfie(timeInSelfieUri)}>
            <View style={styles.iconContainer}>
              <Ionicons name="eye" size={24} color="blue" />
              <Text style={styles.viewText}>View Time In Selfie</Text>
            </View>
          </TouchableOpacity>
        )}

        {timeInTimestamp && (
          <Text style={styles.timestamp}> {timeInTimestamp}</Text>
        )}

        {addressTimeIn && (
          <Text style={styles.timestamp}> {addressTimeIn}</Text>
        )}

        {/* TIME OUT */}
        <Text style={styles.sectionLabel}>TIME OUT</Text>

        <View style={styles.buttonContainer}>
          <Button
            title="TIME OUT"
            onPress={handleTimeOut}
            disabled={!hasTimedIn || hasTimedOut}
            color={!hasTimedIn || hasTimedOut ? "gray" : "red"}
          />
        </View>

        {/* 👇 View Time Out Selfie Icon */}
        {timeOutSelfieUri && (
          <TouchableOpacity onPress={() => viewSelfie(timeOutSelfieUri)}>
            <View style={styles.iconContainer}>
              <Ionicons name="eye" size={24} color="blue" />
              <Text style={styles.viewText}>View Time Out Selfie</Text>
            </View>
          </TouchableOpacity>
        )}

        {timeOutTimestamp && (
          <Text style={styles.timestamp}> {timeOutTimestamp}</Text>
        )}

        {addressTimeOut && (
          <Text style={styles.timestamp}> {addressTimeOut}</Text>
        )}

        {/* 📷 Modal to View Selfie Image */}
        {selectedSelfieUri && (
          <Modal visible={modalVisible} transparent={true} animationType="fade">
            <View style={styles.modalContainer}>
              <View style={styles.modalContent}>
                <Image
                  source={{ uri: selectedSelfieUri }}
                  style={styles.modalImage}
                  resizeMode="contain"
                />
                <Button title="Close" onPress={() => setModalVisible(false)} />
              </View>
            </View>
          </Modal>
        )}
      </View>
    </View>
  );
};

const SyncScreen = () => {
  const handleSync = async () => {
    try {
      await syncOfflineInventories(); // Your utility to send data to backend
      Alert.alert("Success", "All offline inventories synced.");
    } catch (error) {
      console.error("Sync error:", error);
      Alert.alert("Error", "Failed to sync offline inventories.");
    }
  };

  return (
    <View style={styles.center}>
      <Text style={styles.title}>TAP TO SYNCHRONIZE</Text>
      <Button title="Sync Now" onPress={handleSync} />
    </View>
  );
};

const ProfileScreen = () => {
  const { userToken, signOut } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchProfile = async () => {
      if (!userToken) {
        setLoading(false);
        return;
      }

      try {
        if (userToken === "offline-token") {
          // Offline login: Load from AsyncStorage
          const storedUser = await AsyncStorage.getItem("user");
          if (!storedUser) throw new Error("No stored user data found");
          const parsedUser = JSON.parse(storedUser);
          setUserData(parsedUser);
        } else {
          // Online login: Fetch from API
          const response = await fetch("http://192.168.50.54:3001/profile", {
            headers: {
              Authorization: `Bearer ${userToken}`,
            },
          });

          if (!response.ok) throw new Error("Failed to fetch profile");
          const data = await response.json();
          setUserData(data);
        }
      } catch (error) {
        Alert.alert("Error", (error as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [userToken]);

  const handleLogout = () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        onPress: () => {
          signOut(); // Clears token
          router.replace("/");
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!userData) {
    return (
      <View style={styles.center}>
        <Text>Failed to load profile data</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.appBarProfile}>
        <Text style={styles.appBarProfileTitle}>PROFILE</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {userData.firstName?.charAt(0)?.toUpperCase() || "?"}
            </Text>
          </View>
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            value={userData.email}
            editable={false}
            style={styles.input}
          />

          <Text style={styles.label}>Contact Number</Text>
          <TextInput
            value={userData.contactNumber || ""}
            editable={false}
            style={styles.input}
          />

          <Text style={styles.label}>Full Name</Text>
          <TextInput
            value={`${userData.firstName} ${userData.lastName}`}
            editable={false}
            style={styles.input}
          />
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

//INVENTORY

const InventoryCard: React.FC<{ item: InventoryItem }> = ({ item }) => {
  const [isOffline, setIsOffline] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const isLocked =
    item.locked ||
    Object.values(item.versions || {}).every((version) => {
      const totalSKUs =
        (version.Carried?.length || 0) +
        (version["Not Carried"]?.length || 0) +
        (version.Delisted?.length || 0);

      const inactiveSKUs =
        (version["Not Carried"]?.length || 0) + (version.Delisted?.length || 0);

      return totalSKUs > 0 && totalSKUs === inactiveSKUs;
    });

  const router = useRouter();

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(!state.isConnected);
    });

    return () => unsubscribe();
  }, []);

  // ✅ Destructure required values
  const { merchandiser, outlet, weeksCovered, email, versions } = item;
  const version = ["V1", "V2", "V3"] as const;
  type VersionKey = (typeof version)[number];

  const skuValues: {
    ending: Record<VersionKey, Record<string, string>>;
    expiry: Record<VersionKey, Record<string, number>>;
    quantity: Record<VersionKey, Record<string, string>>;
  } = {
    ending: {} as Record<VersionKey, Record<string, string>>,
    expiry: {} as Record<VersionKey, Record<string, number>>,
    quantity: {} as Record<VersionKey, Record<string, string>>,
  };

  const availability: Record<VersionKey, Record<string, string>> = {} as Record<
    VersionKey,
    Record<string, string>
  >;

  version.forEach((ver) => {
    const carriedSKUs = versions[ver]?.Carried || [];

    skuValues.ending[ver] = Object.fromEntries(
      carriedSKUs.map((sku) => [sku.skuCode, sku.endingPCS.toString()])
    );

    skuValues.expiry[ver] = carriedSKUs.reduce((acc, sku) => {
      acc[sku.skuCode] = Number(sku.expiryMonths); // ✅ ensure number
      return acc;
    }, {} as Record<string, number>);

    skuValues.quantity[ver] = Object.fromEntries(
      carriedSKUs.map((sku) => [sku.skuCode, sku.expiryQty.toString()])
    );

    const allSKUs = [
      ...(versions[ver]?.Carried || []),
      ...(versions[ver]?.["Not Carried"] || []),
      ...(versions[ver]?.Delisted || []),
    ];

    const carriedCodes = new Set(
      (versions[ver]?.Carried || []).map((s) => s.skuCode)
    );
    const notCarriedCodes = new Set(
      (versions[ver]?.["Not Carried"] || []).map((s) => s.skuCode)
    );

    availability[ver] = Object.fromEntries(
      allSKUs.map((sku) => [
        sku.skuCode,
        carriedCodes.has(sku.skuCode)
          ? "Carried"
          : notCarriedCodes.has(sku.skuCode)
          ? "Not Carried"
          : "Delisted",
      ])
    );
  });

  const renderSkuDetails = (sku: any, status: string) => (
    <View key={sku.skuCode} style={{ marginBottom: 10 }}>
      <Text style={styles.itemText}>Status: {status}</Text>
      <Text style={styles.itemText}>SKU: {sku.sku}</Text>

      <Text style={[styles.itemText, { height: 0, opacity: 0 }]}>
        SKU Code: {sku.skuCode}
      </Text>

      {status === "Carried" && (
        <>
          <Text style={styles.itemText}>Beginning PCS: {sku.beginningPCS}</Text>
          <Text style={styles.itemText}>Delivery PCS: {sku.deliveryPCS}</Text>
          <Text style={styles.itemText}>Ending PCS: {sku.endingPCS}</Text>
          <Text style={styles.itemText}>Offtake: {sku.offtake}</Text>
          <Text style={styles.itemText}>IDL: {sku.inventoryDays}</Text>
          <Text style={styles.itemText}>
            Expiry (Months): {sku.expiryMonths}
          </Text>
          <Text style={styles.itemText}>Expiry Qty: {sku.expiryQty}</Text>
        </>
      )}
    </View>
  );

  const renderVersion = (versionKey: string, versionData: any) => (
    <View key={versionKey} style={{ marginBottom: 10 }}>
      <Text style={{ fontWeight: "bold", fontSize: 15, marginTop: 8 }}>
        {versionKey}
      </Text>

      {["Carried", "Not Carried", "Delisted"].map((status) =>
        versionData[status]?.map((sku: any) => renderSkuDetails(sku, status))
      )}
    </View>
  );

  const handleGoToNextWeek = () => {
    try {
      const getNextWeekInfo = (currentRange: string) => {
        const [startStr] = currentRange.split("-");
        const thisYear = moment().year();
        const startDate = moment(`${startStr} ${thisYear}`, "MMMDD YYYY");
        if (!startDate.isValid())
          throw new Error(`Invalid start date: ${startStr} ${thisYear}`);

        const nextStartDate = startDate.clone().add(7, "days");
        const nextEndDate = nextStartDate.clone().add(6, "days");

        const newStart = nextStartDate.format("MMMDD");
        const newEnd = nextEndDate.format("MMMDD");
        const newWeeksCovered = `${newStart}-${newEnd}`;
        const newMonth = nextStartDate.format("MMMM");

        const startOfYear = moment().startOf("year");
        const firstFriday =
          startOfYear.day() <= 5
            ? startOfYear.clone().day(5)
            : startOfYear.clone().add(1, "week").day(5);
        const newWeekNumber = nextEndDate.diff(firstFriday, "weeks") + 1;
        const newWeek = `Week ${newWeekNumber}`;

        return { newWeeksCovered, newMonth, newWeek };
      };

      const nextWeekInfo = getNextWeekInfo(weeksCovered);

      const nextWeekData = {
        date: moment().format("YYYY-MM-DD"),
        email,
        merchandiser,
        outlet,
        weeksCovered: nextWeekInfo.newWeeksCovered,
        month: nextWeekInfo.newMonth,
        week: nextWeekInfo.newWeek,
        availability,
        version,
        skuValues: {
          beginning: skuValues.ending,
          delivery: {},
          ending: {},
          offtake: {},
          inventoryDays: {},
          expiry: skuValues.expiry,
          quantity: skuValues.quantity,
        },
        previousWeekId: item._id,
        isOffline: isOffline, // optional flag
      };

      router.push({
        pathname: "/InventoryNextWeek",
        params: {
          data: JSON.stringify(nextWeekData),
          previousWeekId: item._id,
        },
      });
    } catch (error) {
      Alert.alert("Navigation Error", (error as Error).message);
    }
  };

  return (
    <TouchableOpacity
      onPress={() => {
        if (!item.isOffline) {
          setExpanded(!expanded);
        } else {
          Alert.alert(
            "Sync Required",
            "Please sync this inventory to view details."
          );
        }
      }}
      style={[
        styles.tileContainer,
        item.isOffline && { backgroundColor: "#ffe082" }, // Yellow background for offline
        isLocked && styles.lockedContainer,
      ]}
    >
      <View
        style={{
          marginBottom: 10,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <View>
          <Text style={[styles.tileHeader, { fontWeight: "bold" }]}>
            {item.outlet}
          </Text>
          <Text style={[styles.tileHeader, { color: "#666" }]}>
            {item.week}
          </Text>
        </View>

        {!item.isOffline && (
          <TouchableOpacity
            style={{
              backgroundColor: isLocked ? "#e0e0e0" : "#4caf50",
              padding: 8,
              borderRadius: 20,
            }}
            onPress={() => {
              if (!isLocked) {
                handleGoToNextWeek();
              }
            }}
            disabled={isLocked}
          >
            <Icon name="edit-document" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {item.isOffline && (
        <View
          style={{ backgroundColor: "#ffc107", padding: 8, borderRadius: 6 }}
        >
          <Text style={{ textAlign: "center", color: "#333" }}>
            This inventory was saved offline. Please sync to view full details.
          </Text>
        </View>
      )}

      {expanded && !item.isOffline && (
        <View style={styles.tileDetails}>
          <Text style={styles.itemText}>
            Weeks Covered: {item.weeksCovered}
          </Text>
          <Text style={styles.itemText}>Month: {item.month}</Text>
          <Text style={styles.itemText}>Week: {item.week}</Text>

          {Object.entries(item.versions).map(([versionKey, versionData]) =>
            renderVersion(versionKey, versionData)
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const InventoryContent = () => {
  const [inventoryData, setInventoryData] = useState<InventoryItem[]>([]);
  const [email, setUserEmail] = useState<string | null>(null);
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const fetchInventoryData = async (userEmail: string) => {
    try {
      const netState = await NetInfo.fetch();
      let combinedData: InventoryItem[] = [];

      if (netState.isConnected) {
        const res = await fetch(
          `http://192.168.50.54:3001/inventoryHistory?email=${encodeURIComponent(
            userEmail
          )}`
        );

        if (!res.ok) throw new Error(`Server error: ${res.status}`);

        const data: InventoryItem[] = await res.json();

        combinedData = data.map((item) => ({ ...item, isOffline: false }));

        // Cache the server data locally for offline use
        await AsyncStorage.setItem(
          `inventoryHistory_${userEmail}`,
          JSON.stringify(combinedData)
        );
      } else {
        // Offline: load cached data
        const savedData = await AsyncStorage.getItem(
          `inventoryHistory_${userEmail}`
        );
        if (savedData) {
          combinedData = JSON.parse(savedData);
        }
      }

      // Load offline-only inventories, stored as OfflineInventoryItem { data, previousWeekId }
      const offlineRaw = await AsyncStorage.getItem("offlineInventories");
      const offlineList: OfflineInventoryItem[] = offlineRaw
        ? JSON.parse(offlineRaw)
        : [];

      // Filter offline inventories where data.email matches userEmail
      const userOffline = offlineList
        .filter((inv) => inv.data?.email === userEmail)
        .map((inv) => ({ ...inv.data, isOffline: true }));

      // Combine online + offline and sort by date descending
      const fullList = [...combinedData, ...userOffline].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      setInventoryData(fullList);
    } catch (error) {
      console.error("❌ Error fetching inventory:", error);
      Alert.alert("Error", "Failed to load inventory.");
    }
  };

  // ✅ Refresh handler just calls the reusable fetch function
  const handleRefresh = async () => {
    if (!email) return;
    try {
      setLoading(true);
      await fetchInventoryData(email);
    } catch (error) {
      console.error("Failed to refresh inventory:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchUserEmail = async () => {
      try {
        const email = await AsyncStorage.getItem("email");
        if (email) {
          setUserEmail(email);
          console.log("📥 userEmail retrieved:", email);
          await fetchInventoryData(email); // fetch initial inventory
        } else {
          console.warn("⚠️ No userEmail found in AsyncStorage.");
        }
      } catch (e) {
        console.error("Failed to load userEmail:", e);
      }
    };

    fetchUserEmail();
  }, []);

  const renderItem = ({ item }: { item: InventoryItem }) => (
    <InventoryCard item={item} />
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.appBar}>
        <Text style={styles.appBarTitle}>INVENTORY</Text>
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={inventoryData}
        renderItem={renderItem}
        keyExtractor={(item) => item._id}
        contentContainerStyle={[styles.content, { paddingBottom: 100 }]}
        initialNumToRender={10}
        maxToRenderPerBatch={20}
        removeClippedSubviews
        refreshing={loading}
        onRefresh={handleRefresh}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          if (!email) {
            console.warn(
              "⚠️ No userEmail found, cannot navigate to Inventory Process."
            );
            return;
          }
          router.replace("/InventoryProcess");
        }}
      >
        <Ionicons name="add" size={30} color="white" />
      </TouchableOpacity>
    </View>
  );
};

// Bottom Tab Navigator
const Tab = createBottomTabNavigator();

const Inventory = () => {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ color, size }) => {
            let iconName: keyof typeof Ionicons.glyphMap;

            switch (route.name) {
              case "Attendance":
                iconName = "save-outline";
                break;
              case "Sync Inventory":
                iconName = "sync-outline";
                break;
              case "Inventory":
                iconName = "clipboard-outline";
                break;
              case "Profile":
                iconName = "person-outline";
                break;
              default:
                iconName = "help-circle-outline";
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: "green",
          tabBarInactiveTintColor: "gray",
          headerShown: false,
        })}
      >
        <Tab.Screen name="Inventory" component={InventoryContent} />
        <Tab.Screen name="Sync Inventory" component={SyncScreen} />
        <Tab.Screen name="Attendance" component={AttendanceScreen} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>
    </SafeAreaView>
  );
};

export default Inventory;
