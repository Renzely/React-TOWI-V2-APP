import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";

export interface VersionGroup {
  Carried: any[]; // Replace 'any' with actual item type if available
  "Not Carried": any[];
  Delisted: any[];
}

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
  isOffline?: boolean;
  versions: {
    V1: VersionGroup;
    V2: VersionGroup;
    V3: VersionGroup;
  };
}

export interface OfflineInventoryItem {
  data: InventoryItem;
  previousWeekId?: string;
}

// Function to sync offline inventories
export const syncOfflineInventories = async () => {
  const netState = await NetInfo.fetch();
  if (!netState.isConnected) return;

  const saved = await AsyncStorage.getItem("offlineInventories");
  const offlineList: OfflineInventoryItem[] = saved ? JSON.parse(saved) : [];

  const successful: OfflineInventoryItem[] = [];

  for (const item of offlineList) {
    const { data, previousWeekId } = item;

    try {
      const saveRes = await fetch(
        "http://192.168.50.55:3001/inventory/grouped",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );

      if (!saveRes.ok) continue;

      // ✅ LOCK previous week's inventory (if exists)
      if (previousWeekId) {
        const lockRes = await fetch("http://192.168.50.55:3001/lock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inventoryId: Array.isArray(previousWeekId)
              ? previousWeekId[0]
              : previousWeekId,
            locked: true,
          }),
        });

        if (!lockRes.ok) {
          console.warn("Failed to lock previous week:", previousWeekId);
        }
      }

      successful.push(item);
    } catch (err) {
      console.warn("Retry failed:", err);
    }
  }

  const remaining = offlineList.filter(
    (item) =>
      !successful.some(
        (s) =>
          s.data &&
          item.data &&
          s.data.date === item.data.date &&
          s.data.email === item.data.email
      )
  );

  await AsyncStorage.setItem("offlineInventories", JSON.stringify(remaining));
};

export default syncOfflineInventories;
