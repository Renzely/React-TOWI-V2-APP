import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import moment from "moment";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DropDownPicker from "react-native-dropdown-picker";
import Icon from "react-native-vector-icons/MaterialIcons";
import { useAuth } from "./auth";
import styles from "./Style";

type ExpiryEntry = {
  month: string;
  quantity: number;
};

type SKUCarried = {
  sku: string;
  skuCode: string;
  beginningPCS: number;
  deliveryPCS: number;
  endingPCS: number;
  offtake: number;
  inventoryDays: number;
  expiry: ExpiryEntry[];
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

// export interface OfflineInventoryItem {
//   data: InventoryItem;
//   previousWeekId?: string;
// }

type TimeLog = {
  outlet: string;
  timeIn: string;
  timeOut?: string | null;
  addressTimeIn?: string | null;
  addressTimeOut?: string | null;
  timeInSelfieUri?: string | null;
  timeOutSelfieUri?: string | null;
};

type AttendanceRecord = {
  date: string;
  timeLogs: TimeLog[];
};

const AttendanceScreen = () => {
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedOutlet, setSelectedOutlet] = useState("");
  const [outletOptions, setOutletOptions] = useState([
    { label: "Select Branch", value: "" },
  ]);
  const [email, setEmail] = useState("");
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedSelfieUri, setSelectedSelfieUri] = useState<string | null>(
    null
  );
  const [isLoadingTimeIn, setIsLoadingTimeIn] = useState(false);
  const [isLoadingTimeOut, setIsLoadingTimeOut] = useState(false);
  const [loading, setLoading] = useState(false);
  const [attendanceData, setAttendanceData] = useState<{
    hasTimedIn: boolean;
    hasTimedOut: boolean;
    timeInTimestamp: string | null;
    timeOutTimestamp: string | null;
    addressTimeIn: string | null;
    addressTimeOut: string | null;
    timeInSelfieUri: string | null;
    timeOutSelfieUri: string | null;
  }>({
    hasTimedIn: false,
    hasTimedOut: false,
    timeInTimestamp: null,
    timeOutTimestamp: null,
    addressTimeIn: null,
    addressTimeOut: null,
    timeInSelfieUri: null,
    timeOutSelfieUri: null,
  });

  // TIME and DAY STAMP
  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      const options = {
        year: "numeric" as const,
        month: "long" as const,
        day: "numeric" as const,
      };
      const formattedDate = now.toLocaleDateString(undefined, options);
      const hours = now.getHours() % 12 || 12;
      const minutes = now.getMinutes().toString().padStart(2, "0");
      const ampm = now.getHours() >= 12 ? "PM" : "AM";
      const formattedTime = `${hours}:${minutes} ${ampm}`;

      setCurrentDate(formattedDate);
      setCurrentTime(formattedTime);
    };

    updateDateTime();
    const interval = setInterval(updateDateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  //TIME AND DAY FOR TIME STAMP

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString("en-PH", {
      weekday: "long", // e.g., "Friday"
      hour: "numeric",
      minute: "2-digit",
      hour12: true, // Use 12-hour format with AM/PM
    });
  };

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
    })();
  }, []);

  const fetchAttendanceHistory = async () => {
    if (!email || !selectedOutlet) {
      Alert.alert("Please select a branch first.");
      return;
    }

    setHistoryLoading(true);

    try {
      const response = await fetch(
        `https://towi-react.onrender.com/attendance/history?email=${email}&outlet=${selectedOutlet}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch attendance history");
      }

      const data = await response.json();
      setAttendanceHistory(data);
      setHistoryModalVisible(true);
    } catch (error: any) {
      console.error(error);
      Alert.alert("Error", error.message || "Failed to fetch history");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    const loadOutlets = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        if (!token) {
          console.error("No auth token found");
          return;
        }

        const response = await fetch(
          "https://towi-react.onrender.com/user/outlets",
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.ok) {
          const outlets = await response.json();
          const options = outlets.map((outlet: string) => ({
            label: outlet,
            value: outlet,
          }));

          // Load saved outlet
          const savedOutlet = await AsyncStorage.getItem("outlet");

          setOutletOptions([{ label: "Select Branch", value: "" }, ...options]);

          if (savedOutlet) {
            setSelectedOutlet(savedOutlet);
          }
        } else {
          console.error("Failed to fetch outlets:", await response.text());
        }
      } catch (error) {
        console.error("Failed to load outlets", error);
      }
    };

    loadOutlets();
  }, []);

  const fetchEmail = async () => {
    try {
      const storedEmail = await AsyncStorage.getItem("userEmail");
      if (storedEmail) {
        setEmail(storedEmail);
      } else {
        Alert.alert("Error", "User email not found. Please log in again.");
      }
    } catch (error) {
      console.error("Failed to fetch email from storage:", error);
      Alert.alert("Error", "Failed to fetch user email.");
    }
  };

  useEffect(() => {
    fetchEmail();
  }, []);

  const fetchAttendanceData = async (outlet: string) => {
    if (!outlet || !email) return;

    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      // Encode the parameters to handle special characters like &
      const encodedEmail = encodeURIComponent(email);
      const encodedOutlet = encodeURIComponent(outlet);
      const response = await fetch(
        `https://towi-react.onrender.com/attendance/status?email=${encodedEmail}&outlet=${encodedOutlet}&date=${today}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setAttendanceData({
          hasTimedIn: data.hasTimedIn || false,
          hasTimedOut: data.hasTimedOut || false,
          timeInTimestamp: data.timeInTimestamp || null,
          timeOutTimestamp: data.timeOutTimestamp || null,
          addressTimeIn: data.addressTimeIn || null,
          addressTimeOut: data.addressTimeOut || null,
          timeInSelfieUri: data.timeInSelfieUri || null,
          timeOutSelfieUri: data.timeOutSelfieUri || null,
        });
      } else {
        // Reset if no data found
        setAttendanceData({
          hasTimedIn: false,
          hasTimedOut: false,
          timeInTimestamp: null,
          timeOutTimestamp: null,
          addressTimeIn: null,
          addressTimeOut: null,
          timeInSelfieUri: null,
          timeOutSelfieUri: null,
        });
      }
    } catch (error) {
      console.error("Failed to fetch attendance data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendanceData(selectedOutlet);
  }, [selectedOutlet, email]);

  const handleTimeIn = async () => {
    setIsLoadingTimeIn(true);
    try {
      const permissionResult =
        await ImagePicker.requestCameraPermissionsAsync();
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

      const uri = result.assets[0].uri;
      setSelfieUri(uri);
      const timestamp = Date.now();
      const fileName = `Time_In_${email}_${timestamp}.jpg`;

      const presignRes = await fetch(
        "https://towi-react.onrender.com/save-attendance-images",
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
      const timeIn = now.toLocaleTimeString("en-PH", {
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
      }

      const saveRes = await fetch(
        "https://towi-react.onrender.com/attendance/time-in",
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

      if (!saveRes.ok) {
        const errorText = await saveRes.text();
        console.error("Time-in backend response:", errorText);
        throw new Error("Failed to save time-in data");
      }

      await fetchAttendanceData(selectedOutlet);
      Alert.alert("Time In recorded!");
    } catch (error: unknown) {
      console.error(error);
      Alert.alert(
        "Failed to upload or save time-in.",
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      setIsLoadingTimeIn(false);
    }
  };

  const handleTimeOut = async () => {
    setIsLoadingTimeOut(true);
    try {
      const permissionResult =
        await ImagePicker.requestCameraPermissionsAsync();
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

      const uri = result.assets[0].uri;
      const timestamp = Date.now();
      const fileName = `Time_Out_${email}_${timestamp}.jpg`;

      const presignRes = await fetch(
        "https://towi-react.onrender.com/save-attendance-images",
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
      const timeOut = now.toLocaleTimeString("en-PH", {
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
      }

      const saveRes = await fetch(
        "https://towi-react.onrender.com/attendance/time-out",
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

      await fetchAttendanceData(selectedOutlet);
      Alert.alert("Time Out recorded!");
    } catch (error: unknown) {
      console.error(error);
      Alert.alert(
        "Failed to upload or save time-out.",
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      setIsLoadingTimeOut(false);
    }
  };

  return (
    <ScrollView style={styles.safeArea}>
      <View style={styles.appBarAttendance}>
        <Text style={styles.appBarTitleAttendance}>ATTENDANCE</Text>
      </View>

      {loading && <ActivityIndicator size="large" color="#0aafeb" />}

      {/* DATE & TIME */}
      <View style={{ alignItems: "center", marginBottom: 30 }}>
        <Text style={{ fontSize: 22, fontWeight: "500", color: "#333" }}>
          {currentDate}
        </Text>
        <Text
          style={{
            fontSize: 48,
            fontWeight: "bold",
            color: "black",
            marginTop: 5,
          }}
        >
          {currentTime}
        </Text>
      </View>

      {/* BRANCH DROPDOWN */}
      <DropDownPicker
        open={open}
        value={selectedOutlet}
        items={outletOptions}
        setOpen={setOpen}
        setValue={setSelectedOutlet}
        setItems={setOutletOptions}
        searchable={true}
        placeholder="Select Branch"
        disabled={attendanceData.hasTimedIn && !attendanceData.hasTimedOut}
        onChangeValue={(value) => {
          if (value) {
            AsyncStorage.setItem("outlet", value);
          }
        }}
        listMode="SCROLLVIEW"
        style={{
          marginBottom: 30,
          borderRadius: 10,
          borderColor: "#ccc",
          width: "100%",
        }}
        dropDownContainerStyle={{ borderRadius: 10, width: "100%" }}
      />

      {/* TIME IN SECTION */}
      <Text style={styles.sectionLabel}>TIME IN</Text>

      <TouchableOpacity
        onPress={handleTimeIn}
        disabled={attendanceData.hasTimedIn || isLoadingTimeIn}
        style={[
          styles.customButton,
          {
            backgroundColor: attendanceData.hasTimedIn ? "#ccc" : "#4caf50",
          },
        ]}
      >
        {isLoadingTimeIn ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>TIME IN</Text>
        )}
      </TouchableOpacity>

      <View style={{ alignItems: "center", marginBottom: 30 }}>
        {attendanceData.timeInSelfieUri && (
          <TouchableOpacity
            onPress={() => viewSelfie(attendanceData.timeInSelfieUri!)}
          >
            <View style={styles.iconContainer}>
              <Ionicons name="eye" size={24} color="#2c1c5c" />
              <Text style={styles.viewText}>View Time In Selfie</Text>
            </View>
          </TouchableOpacity>
        )}

        {attendanceData.timeInTimestamp && (
          <Text style={styles.timestamp}>
            {formatTimestamp(attendanceData.timeInTimestamp)}
          </Text>
        )}

        {attendanceData.addressTimeIn && (
          <Text style={styles.timestamp}>{attendanceData.addressTimeIn}</Text>
        )}
      </View>
      {/* TIME OUT SECTION */}
      <Text style={[styles.sectionLabel, { marginTop: 30 }]}>TIME OUT</Text>

      <TouchableOpacity
        onPress={handleTimeOut}
        disabled={
          !attendanceData.hasTimedIn ||
          attendanceData.hasTimedOut ||
          isLoadingTimeOut
        }
        style={[
          styles.customButton,
          {
            backgroundColor:
              !attendanceData.hasTimedIn || attendanceData.hasTimedOut
                ? "#ccc"
                : "#eb3b5a",
          },
        ]}
      >
        {isLoadingTimeOut ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>TIME OUT</Text>
        )}
      </TouchableOpacity>
      <View style={{ alignItems: "center", marginBottom: 30 }}>
        {attendanceData.timeOutSelfieUri && (
          <TouchableOpacity
            onPress={() => viewSelfie(attendanceData.timeOutSelfieUri!)}
          >
            <View style={styles.iconContainer}>
              <Ionicons name="eye" size={24} color="#2c1c5c" />
              <Text style={styles.viewText}>View Time Out Selfie</Text>
            </View>
          </TouchableOpacity>
        )}

        {attendanceData.timeOutTimestamp && (
          <Text style={styles.timestamp}>
            {formatTimestamp(attendanceData.timeOutTimestamp)}
          </Text>
        )}

        {attendanceData.addressTimeOut && (
          <Text style={styles.timestamp}>{attendanceData.addressTimeOut}</Text>
        )}
      </View>
      {/* SELFIE MODAL */}
      {selectedSelfieUri && (
        <Modal visible={modalVisible} transparent animationType="fade">
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Image
                source={{ uri: selectedSelfieUri }}
                style={styles.modalImage}
                resizeMode="contain"
              />
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeButton}
              >
                <Text style={{ color: "#fff" }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* ATTENDANCE HISTORY BUTTON */}

      <TouchableOpacity
        style={[styles.button, { backgroundColor: "#357a38", marginTop: 20 }]}
        onPress={fetchAttendanceHistory}
        disabled={loading || historyLoading}
      >
        <Text style={styles.buttonText}>
          {historyLoading ? "Loading..." : "View Attendance History"}
        </Text>
      </TouchableOpacity>

      {/*  <View style={styles.appBarAttendance}>
        <Text style={styles.appBarTitleAttendance}>ATTENDANCE</Text>
      </View>
       */}

      {/* ATTENDANCE HISTORY MODAL */}

      <Modal
        visible={historyModalVisible}
        animationType="slide"
        onRequestClose={() => setHistoryModalVisible(false)}
      >
        <View style={styles.appBarAttendance}>
          <Text style={styles.appBarTitleAttendance}>ATTENDANCE HISTORY</Text>
        </View>

        <View style={{ flex: 1, backgroundColor: "#fff" }}>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <TouchableOpacity
              onPress={() => setHistoryModalVisible(false)}
              style={{ marginBottom: 15 }}
            >
              <Text style={{ color: "blue" }}>Close</Text>
            </TouchableOpacity>

            {attendanceHistory.length === 0 ? (
              <Text>No attendance records found.</Text>
            ) : (
              attendanceHistory.map(
                (record: AttendanceRecord, index: number) => {
                  const dateObj = new Date(record.date);
                  const formattedDate = dateObj.toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  });

                  const formatTimestamp = (timestamp?: string | null) => {
                    if (!timestamp) return "N/A";

                    const date = new Date(timestamp);

                    // Convert to Philippine Time (Asia/Manila) and format nicely with weekday, 12-hour time
                    return date.toLocaleString("en-PH", {
                      timeZone: "Asia/Manila",
                      weekday: "long", // e.g. Friday
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true, // 12-hour format with AM/PM
                    });
                  };

                  return (
                    <View
                      key={index}
                      style={{
                        marginBottom: 15,
                        padding: 10,
                        borderWidth: 1,
                        borderColor: "#ccc",
                        borderRadius: 8,
                      }}
                    >
                      <Text>Date: {formattedDate}</Text>

                      {record.timeLogs.map((log: TimeLog, idx: number) => (
                        <View
                          key={idx}
                          style={{
                            marginTop: 10,
                            padding: 8,
                            borderWidth: 1,
                            borderColor: "#ddd",
                            borderRadius: 6,
                            backgroundColor: "#f9f9f9",
                          }}
                        >
                          <Text style={{ fontWeight: "bold", marginBottom: 6 }}>
                            Outlet: {log.outlet}
                          </Text>

                          <Text>Time In: {formatTimestamp(log.timeIn)}</Text>
                          <Text>
                            Time In Location: {log.addressTimeIn || "N/A"}
                          </Text>
                          {log.timeInSelfieUri ? (
                            <TouchableOpacity
                              onPress={() => {
                                setSelectedSelfieUri(log.timeInSelfieUri!);
                                setModalVisible(true);
                              }}
                            >
                              <Text style={{ color: "blue" }}>
                                View Time In Selfie
                              </Text>
                            </TouchableOpacity>
                          ) : null}

                          <View style={{ height: 15 }} />

                          <Text>Time Out: {formatTimestamp(log.timeOut)}</Text>
                          <Text>
                            Time Out Location: {log.addressTimeOut || "N/A"}
                          </Text>
                          {log.timeOutSelfieUri ? (
                            <TouchableOpacity
                              onPress={() => {
                                setSelectedSelfieUri(log.timeOutSelfieUri!);
                                setModalVisible(true);
                              }}
                            >
                              <Text style={{ color: "blue" }}>
                                View Time Out Selfie
                              </Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  );
                }
              )
            )}
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
};

// const SyncScreen = () => {
//   const handleSync = async () => {
//     try {
//       await syncOfflineInventories(); // Your utility to send data to backend
//       Alert.alert("Success", "All offline inventories synced.");
//     } catch (error) {
//       console.error("Sync error:", error);
//       Alert.alert("Error", "Failed to sync offline inventories.");
//     }
//   };

//   return (
//     <View style={styles.center}>
//       <Text style={styles.title}>TAP TO SYNCHRONIZE</Text>
//       <Button title="Sync Now" onPress={handleSync} />
//     </View>
//   );
// };

const ProfileScreen = () => {
  const { userToken, signOut } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const storedUser = await AsyncStorage.getItem("user");
        if (!storedUser) throw new Error("No stored user data found");
        const parsedUser = JSON.parse(storedUser);
        setUserData(parsedUser);
      } catch (error) {
        Alert.alert("Error", (error as Error).message);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

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

    // Safely convert endingPCS to string
    skuValues.ending[ver] = Object.fromEntries(
      carriedSKUs.map((sku) => [
        sku.skuCode,
        sku.endingPCS !== undefined && sku.endingPCS !== null
          ? sku.endingPCS.toString()
          : "0",
      ])
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

          {/* 👇 This section renders the new expiry format */}
          {Array.isArray(sku.expiry) && sku.expiry.length > 0 && (
            <View style={{ marginTop: 4 }}>
              <Text style={[styles.itemText, { fontWeight: "bold" }]}>
                Expiry Entries:
              </Text>
              {sku.expiry.map(
                (
                  entry: { month?: string | number; quantity?: number },
                  index: number
                ) =>
                  entry?.month ? (
                    <Text key={index} style={styles.itemText}>
                      {entry.month} Month{entry.month !== "1" ? "s" : ""} — Qty:{" "}
                      {entry.quantity ?? 0}
                    </Text>
                  ) : null
              )}
            </View>
          )}
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
      onPress={() => setExpanded(!expanded)}
      style={[styles.tileContainer, isLocked && styles.lockedContainer]}
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
      </View>

      {expanded && (
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
          `https://towi-react.onrender.com/inventoryHistory?email=${encodeURIComponent(
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

      // // Load offline-only inventories, stored as OfflineInventoryItem { data, previousWeekId }
      // const offlineRaw = await AsyncStorage.getItem("offlineInventories");
      // const offlineList: OfflineInventoryItem[] = offlineRaw
      //   ? JSON.parse(offlineRaw)
      //   : [];

      // // Filter offline inventories where data.email matches userEmail
      // const userOffline = offlineList
      //   .filter((inv) => inv.data?.email === userEmail)
      //   .map((inv) => ({ ...inv.data, isOffline: true }));

      // Combine online + offline and sort by date descending
      const fullList = [...combinedData].sort(
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
        const email = await AsyncStorage.getItem("userEmail");
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
        {/* <Tab.Screen name="Sync Inventory" component={SyncScreen} /> */}
        <Tab.Screen name="Attendance" component={AttendanceScreen} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>
    </SafeAreaView>
  );
};

export default Inventory;
