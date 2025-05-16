import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  ViewStyle,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Picker } from "@react-native-picker/picker";
import moment from "moment";
import styles from "./Style";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";

interface PickerItem {
  label: string;
  value: string;
}

interface AndroidPickerProps {
  label: string;
  selectedValue: string;
  onValueChange: (value: string) => void;
  items: PickerItem[];
}

const AndroidPicker: React.FC<AndroidPickerProps> = ({
  label,
  selectedValue,
  onValueChange,
  items,
}) => (
  <>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.dropdown}>
      <Picker
        selectedValue={selectedValue}
        onValueChange={(itemValue: string) => onValueChange(itemValue)}
        mode="dialog"
        prompt={label}
      >
        {items.map((item) => (
          <Picker.Item
            key={item.value}
            label={item.label}
            value={item.value}
            color="#000000"
          />
        ))}
      </Picker>
    </View>
  </>
);

type AvailabilityType = "Carried" | "Not Carried";
type VersionType = "V1" | "V2" | "V3";

interface GroupedInventory {
  date: string;
  email: string;
  merchandiser: string;
  outlet: string;
  weeksCovered: string;
  month: string;
  week: string;
  locked: boolean;
  versions: {
    [key in VersionType]: {
      Carried: Array<{
        sku: string;
        skuCode: string;
        beginningPCS: number;
        deliveryPCS: number;
        endingPCS: number;
        offtake: number;
        inventoryDays: number;
        expiryMonths: string;
        expiryQty: number;
      }>;
      "Not Carried": Array<{ sku: string; skuCode: string }>;
    };
  };
}

interface SkuData {
  [version: string]: Array<{ label: string; value: string }>;
}

const LabeledInput = ({
  label,
  value,
  onChangeText,
  keyboardType = "default",
  editable = true,
  style,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: "default" | "numeric";
  editable?: boolean;
  style?: ViewStyle;
}) => (
  <View style={style}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      editable={editable}
    />
  </View>
);

export default function InventoryNextWeek() {
  const { data, previousWeekId } = useLocalSearchParams();
  const rawData = Array.isArray(data) ? data[0] : data;
  const parsedData = JSON.parse(rawData);
  const [loading, setLoading] = useState(false);

  const [skuValues, setSkuValues] = useState(parsedData.skuValues || {});
  const [availability, setAvailability] = useState(
    parsedData.availability || {}
  );
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [version, setVersion] = useState(parsedData.version);
  const [weeksCovered, setWeeksCovered] = useState(parsedData.weeksCovered);
  const [month, setMonth] = useState(parsedData.month);
  const [week, setWeek] = useState(parsedData.week);
  const [outlet] = useState(parsedData.outlet);
  const [merchandiser] = useState(parsedData.merchandiser);
  const [email] = useState(parsedData.email);
  const [date] = useState(parsedData.date);
  const isNetworkError = (error: any) =>
    error instanceof TypeError && error.message === "Network request failed";

  const [skuData, setSkuData] = useState<SkuData>({
    V1: [],
    V2: [],
    V3: [],
  });

  const router = useRouter();

  useEffect(() => {
    if (!version) return;

    const newOfftake: Record<string, string> = {};
    const newInventoryDays: Record<string, string> = {};

    filteredSkuOptions.forEach((skuItem) => {
      const beginning = parseFloat(
        skuValues.beginning?.[version]?.[skuItem.value] || "0"
      );
      const delivery = parseFloat(
        skuValues.delivery?.[version]?.[skuItem.value] || "0"
      );
      const ending = parseFloat(
        skuValues.ending?.[version]?.[skuItem.value] || "0"
      );

      const calculatedOfftake = beginning + delivery - ending;
      newOfftake[skuItem.value] = calculatedOfftake.toFixed(2);

      if (calculatedOfftake === 0) {
        newInventoryDays[skuItem.value] = "";
      } else {
        const inventoryDaysLevel = ending / (calculatedOfftake / 7);
        newInventoryDays[skuItem.value] = inventoryDaysLevel.toFixed(2);
      }
    });

    setSkuValues((prev: any) => ({
      ...prev,
      offtake: {
        ...prev.offtake,
        [version]: newOfftake,
      },
      inventoryDays: {
        ...prev.inventoryDays,
        [version]: newInventoryDays,
      },
    }));
  }, [
    skuValues.beginning?.[version],
    skuValues.delivery?.[version],
    skuValues.ending?.[version],
    version,
  ]);

  useEffect(() => {
    const today = moment(); // Last submitted inventory date

    let lastFriday = today.clone().day(5);
    if (today.day() < 5) {
      lastFriday.subtract(7, "days");
    }

    // 2. USE YOUR EXACT DATE RANGE CALCULATION
    const weekStart = lastFriday.clone().subtract(6, "days"); // Saturday
    const weekEnd = lastFriday.clone(); // Friday

    const label = `${weekStart.format("MMMDD")}-${weekEnd.format("MMMDD")}`;
    setWeeksCovered(label);

    const monthName = lastFriday.format("MMMM");

    const startOfYear = moment().startOf("year");
    const firstFriday =
      startOfYear.day() <= 5
        ? startOfYear.day(5)
        : startOfYear.add(1, "week").day(5);

    const weekNum = lastFriday.diff(firstFriday, "weeks") + 1;

    setMonth(monthName);
    setWeek(`Week ${weekNum}`);

    const newSkuValues = { ...skuValues };
    Object.keys(skuValues?.ending?.[version] || {}).forEach((skuKey) => {
      newSkuValues.beginning = {
        ...(newSkuValues.beginning || {}),
        [version]: {
          ...(newSkuValues.beginning?.[version] || {}),
          [skuKey]: skuValues.ending[version][skuKey],
        },
      };
    });
    setSkuValues(newSkuValues);
  }, []);

  const handleInputChange = (
    field: string,
    skuKey: string,
    value: string | number
  ) => {
    setSkuValues((prev: any) => ({
      ...prev,
      [field]: {
        ...prev[field],
        [version]: {
          ...(prev[field]?.[version] || {}),
          [skuKey]: value,
        },
      },
    }));
  };

  const filteredSkuOptions = Object.keys(
    skuValues?.beginning?.[version] || {}
  ).map((skuKey) => ({
    label: skuKey,
    value: skuKey,
  }));

  const getCompletedSkuCount = () => {
    let completedCount = 0;

    ["V1", "V2", "V3"].forEach((v) => {
      const versionSkus = Object.keys(skuValues?.beginning?.[v] || {}).map(
        (skuKey) => ({
          label: skuKey,
          value: skuKey,
        })
      );

      versionSkus.forEach((skuItem) => {
        const skuKey = skuItem.value;
        const avail = availability?.[v]?.[skuKey];

        if (avail === "Not Carried") {
          completedCount++;
        } else {
          const b = skuValues.beginning?.[v]?.[skuKey] || "";
          const d = skuValues.delivery?.[v]?.[skuKey] || "";
          const e = skuValues.ending?.[v]?.[skuKey] || "";

          if (b !== "" && d !== "" && e !== "") {
            completedCount++;
          }
        }
      });
    });

    return completedCount;
  };

  const getTotalSkuCount = () => {
    let totalCount = 0;

    ["V1", "V2", "V3"].forEach((v) => {
      totalCount += Object.keys(skuValues?.beginning?.[v] || {}).length;
    });

    return totalCount;
  };

  const handleConditionalSubmit = () => {
    const incompleteVersions: string[] = [];

    ["V1", "V2", "V3"].forEach((version) => {
      const skuList = skuData[version];
      const isVersionComplete = skuList.every((sku) => {
        const key = sku.value;
        const isNotCarried = availability[version]?.[key] === "Not Carried";

        const hasAllValues =
          skuValues.beginning?.[version]?.[key] &&
          skuValues.delivery?.[version]?.[key] &&
          skuValues.ending?.[version]?.[key];

        return isNotCarried || hasAllValues;
      });

      if (!isVersionComplete) {
        incompleteVersions.push(version);
      }
    });

    if (incompleteVersions.length > 0) {
      Alert.alert(
        "Incomplete SKUs",
        `Please complete all SKUs in: ${incompleteVersions.join(", ")}`,
        [{ text: "OK" }]
      );
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (!merchandiser || !outlet || !weeksCovered || !month || !week) {
      Alert.alert("Error", "Please fill in all required fields.");
      return;
    }

    setLoading(true);

    const versions: VersionType[] = ["V1", "V2", "V3"];
    const groupedInventory: GroupedInventory = {
      email,
      date,
      merchandiser,
      outlet,
      weeksCovered,
      month,
      week,
      locked: false,
      versions: {
        V1: { Carried: [], "Not Carried": [] },
        V2: { Carried: [], "Not Carried": [] },
        V3: { Carried: [], "Not Carried": [] },
      },
    };

    versions.forEach((v) => {
      const skus = skuData[v]?.filter((item) => item.value !== "") || [];

      skus.forEach((skuItem) => {
        const skuKey = skuItem.value;
        const status = (availability[v]?.[skuKey] ||
          "Carried") as AvailabilityType;
        const commonFields = { sku: skuItem.label, skuCode: skuKey };

        if (status === "Carried") {
          groupedInventory.versions[v][status].push({
            ...commonFields,
            beginningPCS: Number(skuValues.beginning?.[v]?.[skuKey] || 0),
            deliveryPCS: Number(skuValues.delivery?.[v]?.[skuKey] || 0),
            endingPCS: Number(skuValues.ending?.[v]?.[skuKey] || 0),
            offtake: Number(skuValues.offtake?.[v]?.[skuKey] || 0),
            inventoryDays: Number(skuValues.inventoryDays?.[v]?.[skuKey] || 0),
            expiryMonths: skuValues.expiry?.[v]?.[skuKey] || "",
            expiryQty: Number(skuValues.quantity?.[v]?.[skuKey] || 0),
          });
        } else {
          groupedInventory.versions[v][status].push(commonFields);
        }
      });
    });

    const saveOffline = async () => {
      try {
        const existing = await AsyncStorage.getItem("offlineInventories");
        const offlineList = existing ? JSON.parse(existing) : [];

        offlineList.push({ data: groupedInventory, previousWeekId }); // <<<< THIS

        await AsyncStorage.setItem(
          "offlineInventories",
          JSON.stringify(offlineList)
        );

        Alert.alert(
          "Saved Offline",
          "No internet. Inventory will sync automatically later."
        );
        router.push("/HomeScreen");
      } catch (err) {
        console.error("Failed to save locally:", err);
        Alert.alert("Error", "Couldn't save inventory offline");
      }
    };

    try {
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        await saveOffline();
        return;
      }

      const saveRes = await fetch(
        "http://192.168.50.55:3001/inventory/grouped",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(groupedInventory),
        }
      );

      if (!saveRes.ok) throw new Error("Failed to save inventory");

      if (previousWeekId) {
        await fetch("http://192.168.50.55:3001/lock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inventoryId: Array.isArray(previousWeekId)
              ? previousWeekId[0]
              : previousWeekId,
            locked: true,
          }),
        });
      }

      router.push("/HomeScreen");
    } catch (err) {
      if (isNetworkError(err)) {
        await saveOffline();
      } else {
        console.error("Save error:", err);
        Alert.alert("Error", "Failed to save inventory");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const newSkuData: SkuData = { V1: [], V2: [], V3: [] };

    ["V1", "V2", "V3"].forEach((v) => {
      newSkuData[v] = Object.keys(skuValues?.beginning?.[v] || {}).map(
        (skuKey) => ({
          label: skuKey,
          value: skuKey,
        })
      );
    });

    setSkuData(newSkuData);
  }, [skuValues.beginning]);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={{ flex: 1 }}>
        <View style={styles.appBarInventoryprocess}>
          <Text style={styles.appBarTitleInventoryprocess}>
            UPDATE INVENTORY
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.containerinventory,
            { paddingBottom: 50, paddingTop: 120 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <LabeledInput
            label="Date"
            value={date}
            onChangeText={() => {}}
            editable={false}
          />
          <LabeledInput
            label="Email"
            value={email}
            onChangeText={() => {}}
            editable={false}
            style={{ height: 0, opacity: 0 }}
          />
          <LabeledInput
            label="Merchandiser Name"
            value={merchandiser}
            onChangeText={() => {}}
            editable={false}
            style={{ height: 0, opacity: 0 }}
          />

          <LabeledInput
            label="Branch / Outlet"
            value={outlet}
            onChangeText={() => {}}
            editable={false}
          />
          <LabeledInput
            label="Weeks Covered"
            value={weeksCovered}
            onChangeText={() => {}}
            editable={false}
          />
          <LabeledInput
            label="Month"
            value={month}
            onChangeText={() => {}}
            editable={false}
            style={{ height: 0, opacity: 0 }}
          />
          <LabeledInput
            label="Week"
            value={week}
            onChangeText={() => {}}
            editable={false}
            style={{ height: 0, opacity: 0 }}
          />

          <Text style={styles.label}>Select Version</Text>
          <View style={styles.buttonRow}>
            {["V1", "V2", "V3"].map((v) => {
              const versionSkus = Object.keys(skuValues?.beginning?.[v] || {});
              let completedSkuCount = 0;
              const totalSkuCount = versionSkus.length;

              versionSkus.forEach((skuKey) => {
                const avail = availability?.[v]?.[skuKey];

                if (avail === "Not Carried") {
                  completedSkuCount++;
                } else {
                  const b = skuValues.beginning?.[v]?.[skuKey] || "";
                  const d = skuValues.delivery?.[v]?.[skuKey] || "";
                  const e = skuValues.ending?.[v]?.[skuKey] || "";

                  if (b !== "" && d !== "" && e !== "") {
                    completedSkuCount++;
                  }
                }
              });

              return (
                <TouchableOpacity
                  key={v}
                  style={[
                    styles.versionBtn,
                    version === v && styles.selectedButton,
                  ]}
                  onPress={() => setVersion(v)}
                >
                  <Text style={styles.btnText}>
                    {completedSkuCount}/{totalSkuCount} {v}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {version !== "" && (
            <>
              {["Beginning", "Delivery", "Ending"].map((section) => {
                const sectionKey = section.toLowerCase();
                const filledCount = filteredSkuOptions.filter((skuItem) => {
                  const skuKey = skuItem.value;
                  const val = skuValues[sectionKey]?.[version]?.[skuKey];
                  const availStatus = availability[version]?.[skuKey];

                  return (
                    (val !== undefined && val !== "") ||
                    availStatus === "Not Carried"
                  );
                }).length;

                const totalSkuCount = filteredSkuOptions.length;

                return (
                  <View key={section} style={{ marginVertical: 10 }}>
                    <TouchableOpacity
                      style={styles.expandButton}
                      onPress={() =>
                        setExpandedSection((prev) =>
                          prev === section ? null : section
                        )
                      }
                    >
                      <Text style={styles.expandButtonText}>
                        {expandedSection === section
                          ? `Hide ${section} ${filledCount}/${totalSkuCount}`
                          : `Expand ${section} ${filledCount}/${totalSkuCount}`}
                      </Text>
                    </TouchableOpacity>
                    {expandedSection === section && (
                      <View style={{ marginTop: 10 }}>
                        {filteredSkuOptions.map((skuItem) => {
                          const skuKey = skuItem.value;
                          const isBeginning = sectionKey === "beginning";
                          const availabilityValue =
                            availability?.[version]?.[skuKey] ??
                            (isBeginning ? "Carried" : "");
                          const isBeginningEditable =
                            isBeginning && availabilityValue === "Carried";
                          const isOtherSectionEditable =
                            !isBeginning &&
                            availability[version]?.[skuKey] === "Carried";
                          const isEditable = isBeginning
                            ? isBeginningEditable
                            : isOtherSectionEditable;

                          return (
                            <TouchableOpacity
                              key={skuKey}
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                marginBottom: 8,
                              }}
                              activeOpacity={1}
                              onPress={() => {}}
                            >
                              <Text
                                style={[styles.skuText, { flex: 1 }]}
                                numberOfLines={1}
                              >
                                {skuItem.label}
                              </Text>
                              {isBeginning && (
                                <View
                                  style={{
                                    flex: 0.5,
                                    marginHorizontal: 2,
                                    borderWidth: 1,
                                    borderColor: "#ccc",
                                    borderRadius: 4,
                                    overflow: "hidden",
                                    minWidth: 20,
                                  }}
                                >
                                  <Picker
                                    selectedValue={availabilityValue}
                                    style={{
                                      height: 50,
                                      width: "100%",
                                      backgroundColor: "white",
                                    }}
                                    itemStyle={{
                                      fontSize: 11, // Adjust this value as needed
                                    }}
                                    onValueChange={(value) => {
                                      // Update availability based on selected value
                                      setAvailability((prev: any) => ({
                                        ...prev,
                                        [version]: {
                                          ...(prev[version] || {}),
                                          [skuKey]: value,
                                        },
                                      }));

                                      // When 'Not Carried' is selected, we don't reset the values, just hide them.
                                      if (value === "Carried") {
                                        const prevEnding =
                                          skuValues.ending?.[version]?.[
                                            skuKey
                                          ] || "";
                                        if (prevEnding !== "") {
                                          setSkuValues((prev: any) => ({
                                            ...prev,
                                            beginning: {
                                              ...(prev.beginning || {}),
                                              [version]: {
                                                ...(prev.beginning?.[version] ||
                                                  {}),
                                                [skuKey]: prevEnding, // Restore value from ending to beginning
                                              },
                                            },
                                          }));
                                        }
                                      }
                                      // If "Not Carried" is selected, we can just leave the values intact but hide inputs
                                    }}
                                    mode="dropdown"
                                  >
                                    <Picker.Item
                                      label="Carried"
                                      value="Carried"
                                      style={{ fontSize: 11, color: "black" }}
                                    />
                                    <Picker.Item
                                      label="Not Carried"
                                      value="Not Carried"
                                      style={{ fontSize: 11, color: "black" }}
                                    />
                                  </Picker>
                                </View>
                              )}

                              <TextInput
                                style={[
                                  styles.inputBox,
                                  {
                                    width: 52,
                                    height: 40,
                                    marginLeft: isBeginning ? 0 : 6,
                                    textAlign: "center",
                                  },
                                ]}
                                keyboardType="numeric"
                                value={
                                  availabilityValue === "Carried"
                                    ? skuValues[sectionKey]?.[version]?.[
                                        skuKey
                                      ] || ""
                                    : ""
                                }
                                onChangeText={(text) => {
                                  handleInputChange(sectionKey, skuKey, text);
                                }}
                                editable={isEditable}
                              />
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })}

              <View style={{ marginVertical: 10 }}>
                <TouchableOpacity
                  style={styles.expandButton}
                  onPress={() =>
                    setExpandedSection((prev) =>
                      prev === "Expiry" ? null : "Expiry"
                    )
                  }
                >
                  <Text style={styles.expandButtonText}>
                    {expandedSection === "Expiry"
                      ? `Hide Expiry`
                      : `Expand Expiry`}
                  </Text>
                </TouchableOpacity>

                {expandedSection === "Expiry" && (
                  <TouchableOpacity
                    style={{ marginTop: 10 }}
                    activeOpacity={1}
                    onPress={() => {}}
                  >
                    {filteredSkuOptions.map((skuItem) => (
                      <View
                        key={skuItem.value}
                        style={[
                          styles.skuItemRow,
                          {
                            flexDirection: "row",
                            alignItems: "center",
                            marginBottom: 12,
                          },
                        ]}
                      >
                        <Text style={[styles.skuText, { flex: 2 }]}>
                          {skuItem.label}
                        </Text>

                        <View style={{ flex: 3, marginHorizontal: 8 }}>
                          <AndroidPicker
                            label=""
                            selectedValue={
                              skuValues.expiry?.[version]?.[skuItem.value] || ""
                            }
                            onValueChange={(val: any) =>
                              handleInputChange("expiry", skuItem.value, val)
                            }
                            items={[1, 2, 3, 4, 5, 6].map((n) => ({
                              label: `${n} Month${n > 1 ? "s" : ""}`,
                              value: String(n),
                            }))}
                          />
                        </View>

                        <TextInput
                          placeholder="Qty"
                          style={[
                            styles.inputBox,
                            { flex: 1.5, height: 40, fontSize: 14 },
                          ]}
                          keyboardType="numeric"
                          value={
                            skuValues.quantity?.[version]?.[skuItem.value] || ""
                          }
                          onChangeText={(text) =>
                            handleInputChange("quantity", skuItem.value, text)
                          }
                        />
                      </View>
                    ))}
                  </TouchableOpacity>
                )}
              </View>

              <View style={{ marginVertical: 10 }}>
                <TouchableOpacity
                  style={styles.expandButton}
                  onPress={() =>
                    setExpandedSection((prev) =>
                      prev === "Offtake" ? null : "Offtake"
                    )
                  }
                >
                  <Text style={styles.expandButtonText}>
                    {expandedSection === "Offtake"
                      ? `Hide Offtake`
                      : `Expand Offtake`}
                  </Text>
                </TouchableOpacity>

                {expandedSection === "Offtake" && (
                  <View style={{ marginTop: 10 }}>
                    {filteredSkuOptions.map((skuItem) => (
                      <View key={skuItem.value} style={styles.skuItemRow}>
                        <Text style={styles.skuText}>{skuItem.label}</Text>
                        <TextInput
                          placeholder="Offtake"
                          style={styles.inputBox}
                          value={
                            skuValues.offtake?.[version]?.[skuItem.value] || ""
                          }
                          onChangeText={(text) =>
                            handleInputChange("offtake", skuItem.value, text)
                          }
                        />
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <View style={{ marginVertical: 10 }}>
                <TouchableOpacity
                  style={styles.expandButton}
                  onPress={() =>
                    setExpandedSection((prev) =>
                      prev === "InventoryDaysLevel"
                        ? null
                        : "InventoryDaysLevel"
                    )
                  }
                >
                  <Text style={styles.expandButtonText}>
                    {expandedSection === "InventoryDaysLevel"
                      ? `Hide Inventory Days Level`
                      : `Expand Inventory Days Level`}
                  </Text>
                </TouchableOpacity>

                {expandedSection === "InventoryDaysLevel" && (
                  <TouchableOpacity
                    style={{ marginTop: 10 }}
                    activeOpacity={1}
                    onPress={() => {}}
                  >
                    {filteredSkuOptions.map((skuItem) => (
                      <View key={skuItem.value} style={styles.skuItemRow}>
                        <Text style={styles.skuText}>{skuItem.label}</Text>
                        <TextInput
                          placeholder="Inventory Days Level"
                          style={styles.inputBox}
                          value={
                            skuValues.inventoryDays?.[version]?.[
                              skuItem.value
                            ] || ""
                          }
                          onChangeText={(text) =>
                            handleInputChange(
                              "inventoryDays",
                              skuItem.value,
                              text
                            )
                          }
                        />
                      </View>
                    ))}
                  </TouchableOpacity>
                )}
              </View>
              <View
                style={[
                  styles.buttonRow,
                  { justifyContent: "space-between", marginTop: 20 },
                ]}
              >
                <TouchableOpacity
                  style={[styles.submitButton, { flex: 1, marginRight: 5 }]}
                  onPress={() => router.back()}
                >
                  <Text style={styles.submitButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    { flex: 1, marginLeft: 5, opacity: loading ? 0.5 : 1 },
                  ]}
                  disabled={loading}
                  onPress={handleConditionalSubmit}
                >
                  <Text style={styles.submitButtonText}>
                    {loading
                      ? "Submitting..."
                      : `Submit (${getCompletedSkuCount()}/${getTotalSkuCount()})`}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </TouchableWithoutFeedback>
  );
}
