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
          const response = await fetch("http://192.168.50.55:3001/profile", {
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
          `http://192.168.50.55:3001/inventoryHistory?email=${encodeURIComponent(
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
              case "Sync Inventory":
                iconName = "sync-outline";
                break;
              case "Inventory":
                iconName = "cube-outline";
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
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>
    </SafeAreaView>
  );
};

export default Inventory;
