import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";
import moment from "moment";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Keyboard,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  ViewStyle,
} from "react-native";
import DropDownPicker from "react-native-dropdown-picker";
import Icon from "react-native-vector-icons/MaterialIcons";
import styles from "./Style";

interface PickerItem {
  label: string;
  value: string;
}

type ExpiryEntry = {
  month: string;
  quantity: string;
};

interface AndroidPickerProps {
  label: string;
  selectedValue: string;
  onValueChange: (value: string) => void;
  items: PickerItem[];
  enabled?: boolean;
}

const AndroidPicker: React.FC<AndroidPickerProps> = ({
  label,
  selectedValue,
  onValueChange,
  items,
  enabled = true, // Set default to true
}) => (
  <>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.dropdown}>
      <Picker
        selectedValue={selectedValue}
        onValueChange={(itemValue: string) => onValueChange(itemValue)}
        mode="dialog"
        prompt={label}
        enabled={enabled} // Pass it to Picker
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

const LabeledInput = ({
  label,
  value,
  onChangeText,
  keyboardType = "default",
  editable = true,
  style, // ✅ receive style here
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: "default" | "numeric";
  editable?: boolean;
  style?: ViewStyle; // ❌ remove TextStyle here
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

type AvailabilityType = "Carried" | "Not Carried" | "Delisted";
type VersionType = "V1" | "V2" | "V3";

type GroupedInventory = {
  email: String;
  date: string;
  merchandiser: string;
  outlet: string;
  weeksCovered: string;
  month: string;
  week: string;
  versions: {
    [key in VersionType]: {
      [key in AvailabilityType]: any[]; // You can type this more strictly later
    };
  };
};

// export interface OfflineInventoryItem {
//   data: GroupedInventory;
//   previousWeekId?: string;
//   isOffline?: boolean; // add this optional field if you want
// }

const InventoryProcess = () => {
  const [email, setEmail] = useState("");
  const [date] = useState(moment().format("YYYY-MM-DD"));
  const [merchandiser, setMerchandiser] = useState("");
  const [outlet, setOutlet] = useState("");
  const [weeksCovered, setWeeksCovered] = useState("");
  const [month, setMonth] = useState("");
  const [week, setWeek] = useState("");
  const [sku, setSku] = useState("");
  const [selectedSkuCode, setSelectedSkuCode] = useState("");
  const [availability, setAvailability] = useState<{
    [version: string]: { [skuKey: string]: string };
  }>({});

  const [version, setVersion] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedOutlet, setSelectedOutlet] = useState("");
  const [outletOptions, setOutletOptions] = useState([
    { label: "Select Branch", value: "" },
  ]);
  const [weekOptions, setWeekOptions] = useState<PickerItem[]>([
    { label: "Select Week", value: "" },
  ]);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [skuValues, setSkuValues] = useState<any>({
    beginning: {},
    delivery: {},
    ending: {},
    expiry: {}, // Add expiry field here
    quantity: {}, // Add quantity field here
    offtake: {},
    inventoryDays: {},
  });
  const router = useRouter();

  const handleExpiryChange = (skuKey: string, month: string) => {
    setSkuValues((prev: any) => ({
      ...prev,
      expiry: {
        ...prev.expiry,
        [skuKey]: month,
      },
    }));
  };

  const handleQuantityChange = (skuKey: string, qty: string) => {
    setSkuValues((prev: any) => ({
      ...prev,
      quantity: {
        ...prev.quantity,
        [skuKey]: qty,
      },
    }));
  };

  useEffect(() => {
    if (!version) return; // avoid calculating if version not selected

    const newOfftake: any = {};
    const newInventoryDays: any = {};

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
  }, [skuValues.beginning, skuValues.delivery, skuValues.ending, version]);

  useEffect(() => {
    const today = moment();

    // Find last Friday:
    let lastFriday = today.clone().day(5);
    if (today.day() < 5) {
      // if today is before Friday, go back one week
      lastFriday.subtract(7, "days");
    }

    // Compute the Saturday that begins that week:
    const weekStart = lastFriday.clone().subtract(6, "days"); // Saturday
    const weekEnd = lastFriday.clone(); // Friday

    const label = `${weekStart.format("MMMDD")}-${weekEnd.format("MMMDD")}`;

    setWeekOptions([
      { label: "Select Week", value: "" },
      { label, value: label },
    ]);
  }, []);

  // 2) When they pick it, calculate month & week off that Friday
  const handleWeeksCoveredChange = (value: string) => {
    setWeeksCovered(value);

    if (value) {
      const [start, end] = value.split("-");
      // end is the Friday date in MMMDD
      const friDate = moment(end, "MMMDD");
      const monthName = friDate.format("MMMM");

      // Find first Friday of the year
      const startOfYear = moment().startOf("year");
      const firstFriday =
        startOfYear.day() <= 5
          ? startOfYear.day(5)
          : startOfYear.add(1, "week").day(5);

      // Compute week number (difference in weeks + 1)
      const weekNum = friDate.diff(firstFriday, "weeks") + 1;

      setMonth(monthName);
      setWeek(`Week ${weekNum}`);
    } else {
      setMonth("");
      setWeek("");
    }
  };

  useEffect(() => {
    if (weekOptions.length > 1) {
      const autoSelectedWeek = weekOptions[1].value; // index 1 because index 0 is "Select Week"
      setWeeksCovered(autoSelectedWeek);
      handleWeeksCoveredChange(autoSelectedWeek);
    }
  }, [weekOptions]);

  useEffect(() => {
    if (version && sku) {
      const code =
        skuData[version].find((item) => item.value === sku)?.code || "";
      setSelectedSkuCode(code);
    }
  }, [version, sku]);

  useEffect(() => {
    const fetchUserInfo = async () => {
      const userData = await AsyncStorage.getItem("user");
      if (userData) {
        const user = JSON.parse(userData);
        setMerchandiser(`${user.firstName} ${user.lastName}`);
      }
    };

    fetchUserInfo();
  }, []);

  useEffect(() => {
    const fetchUserEmail = async () => {
      const userEmail = await AsyncStorage.getItem("user");
      if (userEmail) {
        const Emailuser = JSON.parse(userEmail);
        setEmail(`${Emailuser.email}`);
      }
    };

    fetchUserEmail();
  }, []);

  useEffect(() => {
    if (!version) return;

    // If this version has never been initialized, set all SKUs to “Carried”
    setAvailability((prev) => {
      if (prev[version]) return prev; // already done

      const defaults = (skuData[version] || []).reduce<Record<string, string>>(
        (acc, sku) => {
          acc[sku.value] = "Carried";
          return acc;
        },
        {}
      );

      return {
        ...prev,
        [version]: defaults,
      };
    });
  }, [version]);

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

          setOutletOptions([{ label: "Select Branch", value: "" }, ...options]);
        } else {
          console.error("Failed to fetch outlets:", await response.text());
        }
      } catch (error) {
        console.error("Failed to load outlets", error);
      }
    };

    loadOutlets();
  }, []);

  const skuData: {
    [version: string]: { label: string; value: string; code: string }[];
  } = {
    V1: [
      // { label: "Select SKU", value: "", code: "" },

      {
        label: "BENG BENG CHOCOLATE 12X10X26.5G",
        value: "BENG BENG CHOCOLATE 12X10X26.5G",
        code: "",
      },
      // {
      //   label: "BENG-BENG SHARE IT 16X95G",
      //   value: "BENG-BENG SHARE IT 16X95G",
      //   code: "",
      // },
      // {
      //   label: "CAL CHEESE CHEESE WAFER 20X10X20G",
      //   value: "CAL CHEESE CHEESE WAFER 20X10X20G",
      //   code: "",
      // },
      // {
      //   label: "CAL CHEESE CHEESE WAFER 20X20X8.5G PH",
      //   value: "CAL CHEESE CHEESE WAFER 20X20X8.5G PH",
      //   code: "",
      // },
      // {
      //   label: "CAL CHEESE CHEESE WAFER 60X48G PH",
      //   value: "CAL CHEESE CHEESE WAFER 60X48G PH",
      //   code: "",
      // },
      // {
      //   label: "CAL CHEESE CHEESE CHOCO 20X10X20.5G",
      //   value: "CAL CHEESE CHEESE CHOCO 20X10X20.5G",
      //   code: "",
      // },
      // {
      //   label: "CAL CHEESE CHEESE CHOCO 60X48G PH",
      //   value: "CAL CHEESE CHEESE CHOCO 60X48G PH",
      //   code: "",
      // },
      // {
      //   label: "DANISA BUTTER COOKIES 12X454G",
      //   value: "DANISA BUTTER COOKIES 12X454G",
      //   code: "",
      // },
      // {
      //   label: "MALKIST CAPPUCCINO 30X10X18G PH",
      //   value: "MALKIST CAPPUCCINO 30X10X18G PH",
      //   code: "",
      // },
      // {
      //   label: "MALKIST CHOCOLATE 30X10X18G PH",
      //   value: "MALKIST CHOCOLATE 30X10X18G PH",
      //   code: "",
      // },
      // {
      //   label: "SUPERSTAR TRIPLE CHOCOLATE 12X10X16G",
      //   value: "SUPERSTAR TRIPLE CHOCOLATE 12X10X16G",
      //   code: "",
      // },
      // {
      //   label: "VALMER SANDWICH CHOCOLATE 12X10X36G",
      //   value: "VALMER SANDWICH CHOCOLATE 12X10X36G",
      //   code: "",
      // },
      // {
      //   label: "WAFELLO BUTTER CARAMEL 20X10X20.5G PH",
      //   value: "WAFELLO BUTTER CARAMEL 20X10X20.5G PH",
      //   code: "",
      // },
      // {
      //   label: "WAFELLO BUTTER CARAMEL 60X48G PH",
      //   value: "WAFELLO BUTTER CARAMEL 60X48G PH",
      //   code: "",
      // },
      // {
      //   label: "WAFELLO CHOCOLATE WAFER 20X10X20.5G PH",
      //   value: "WAFELLO CHOCOLATE WAFER 20X10X20.5G PH",
      //   code: "",
      // },
      // {
      //   label: "WAFELLO CHOCOLATE WAFER 60X48G PH",
      //   value: "WAFELLO CHOCOLATE WAFER 60X48G PH",
      //   code: "",
      // },
      // {
      //   label: "WAFELLO COCO CREME 60X48G PH",
      //   value: "WAFELLO COCO CREME 60X48G PH",
      //   code: "",
      // },
      // {
      //   label: "WAFELLO COCO CREME 20X10X20.5g PH",
      //   value: "WAFELLO COCO CREME 20X10X20.5g PH",
      //   code: "",
      // },
      // {
      //   label: "FRES APPLEPEACH CANDY 24X150G",
      //   value: "FRES APPLEPEACH CANDY 24X150G",
      //   code: "",
      // },
      // {
      //   label: "FRES MINT BARLEY 24X50X3G",
      //   value: "FRES MINT BARLEY 24X50X3G",
      //   code: "",
      // },
      // {
      //   label: "FRES MINT CHERRY 24X50X3G",
      //   value: "FRES MINT CHERRY 24X50X3G",
      //   code: "",
      // },
      // {
      //   label: "FRES MINT CHERRY JAR 12X200X3G",
      //   value: "FRES MINT CHERRY JAR 12X200X3G",
      //   code: "",
      // },
      // {
      //   label: "FRES MINT GRAPE 24X50X3G",
      //   value: "FRES MINT GRAPE 24X50X3G",
      //   code: "",
      // },
      // {
      //   label: "FRES MINT GRAPE JAR 12X200X3G",
      //   value: "FRES MINT GRAPE JAR 12X200X3G",
      //   code: "",
      // },
      // {
      //   label: "FRES MINT BARLEY JAR 12X200X3G",
      //   value: "FRES MINT BARLEY JAR 12X200X3G",
      //   code: "",
      // },
      // {
      //   label: "FRES MIXED CANDY JAR 12X600G",
      //   value: "FRES MIXED CANDY JAR 12X600G",
      //   code: "",
      // },
      // {
      //   label: "KOPIKO CAPPUCCINO CANDY 24X175G",
      //   value: "KOPIKO CAPPUCCINO CANDY 24X175G",
      //   code: "",
      // },
      // {
      //   label: "KOPIKO COFFEE CANDY 24 X 175G",
      //   value: "KOPIKO COFFEE CANDY 24 X 175G",
      //   code: "",
      // },
      // {
      //   label: "KOPIKO COFFEE CANDY JAR 6 X 560G",
      //   value: "KOPIKO COFFEE CANDY JAR 6 X 560G",
      //   code: "",
      // },
      // {
      //   label: "MALKIST SWEET GLAZED 12X10X28G PH",
      //   value: "MALKIST SWEET GLAZED 12X10X28G PH",
      //   code: "",
      // },
      // {
      //   label: "MALKIST BARBECUE 12X10X28G PH",
      //   value: "MALKIST BARBECUE 12X10X28G PH",
      //   code: "",
      // },
      // {
      //   label: "WOW PASTA CARBONARA 12X5X88G PH",
      //   value: "WOW PASTA CARBONARA 12X5X88G PH",
      //   code: "",
      // },
      // {
      //   label: "WOW PASTA SPAGHETTI 12X5X86G PH",
      //   value: "WOW PASTA SPAGHETTI 12X5X86G PH",
      //   code: "",
      // },
    ],
    V2: [
      {
        label: "KOPIKO BLANCA HANGER 24X10X30G",
        value: "KOPIKO BLANCA HANGER 24X10X30G",
        code: "",
      },
      // {
      //   label: "KOPIKO BLANCA TWINPACK 12X10X2X29G",
      //   value: "KOPIKO BLANCA TWINPACK 12X10X2X29G",
      //   code: "",
      // },
      // {
      //   label: "KOPIKO BLANCA BAG 8X30X30G",
      //   value: "KOPIKO BLANCA BAG 8X30X30G",
      //   code: "",
      // },
      // {
      //   label: "KOPIKO BLANCA POUCH 24X10X30G",
      //   value: "KOPIKO BLANCA POUCH 24X10X30G",
      //   code: "",
      // },
      // {
      //   label: "KOPIKO BROWN PROMO TWIN 12x10x53.5g",
      //   value: "KOPIKO BROWN PROMO TWIN 12x10x53.5g",
      //   code: "",
      // },
      // {
      //   label: "KOPIKO BROWN BAG 8X30X27.5G",
      //   value: "KOPIKO BROWN BAG 8X30X27.5G",
      //   code: "",
      // },
      // {
      //   label: "KOPIKO BLACK 3 IN ONE HANGER 24X10X30G",
      //   value: "KOPIKO BLACK 3 IN ONE HANGER 24X10X30G",
      //   code: "",
      // },
      // {
      //   label: "ENERGEN VANILLA HANGER 24X10X40G",
      //   value: "ENERGEN VANILLA HANGER 24X10X40G",
      //   code: "",
      // },
      // {
      //   label: "KOPIKO BROWN COFFEE HANGER 24X10X27.5G",
      //   value: "KOPIKO BROWN COFFEE HANGER 24X10X27.5G",
      //   code: "",
      // },
      // {
      //   label: "KOPIKO BROWN POUCH 24X10X27.5G",
      //   value: "KOPIKO BROWN POUCH 24X10X27.5G",
      //   code: "",
      // },
      // {
      //   label: "KOPIKO BLACK 3IN1 BAG 8X30X30G",
      //   value: "KOPIKO BLACK 3IN1 BAG 8X30X30G",
      //   code: "",
      // },
      // {
      //   label: "KOPIKO BLACK 3IN1 POUCH 24X10X30G",
      //   value: "KOPIKO BLACK 3IN1 POUCH 24X10X30G",
      //   code: "",
      // },
      // {
      //   label: "KOPIKO BLACK 3IN1 TWINPACK 12X10X2X28G",
      //   value: "KOPIKO BLACK 3IN1 TWINPACK 12X10X2X28G",
      //   code: "",
      // },
      // {
      //   label: "KOPIKO CAPPUCCINO BAG 8X30X25G",
      //   value: "KOPIKO CAPPUCCINO BAG 8X30X25G",
      //   code: "",
      // },
      // {
      //   label: "KOPIKO CAPPUCCINO COFFEE HANGER 24X10X25G",
      //   value: "KOPIKO CAPPUCCINO COFFEE HANGER 24X10X25G",
      //   code: "",
      // },
      // {
      //   label: "KOPIKO CAPPUCCINO POUCH 24X10X25G",
      //   value: "KOPIKO CAPPUCCINO POUCH 24X10X25G",
      //   code: "",
      // },
      // {
      //   label: "KOPIKO ORIGINAL DOUBLE CUPS 24X10X36G",
      //   value: "KOPIKO ORIGINAL DOUBLE CUPS 24X10X36G",
      //   code: "",
      // },
      // {
      //   label: "KOPIKO L.A. COFFEE HANGER 24X10X25G",
      //   value: "KOPIKO L.A. COFFEE HANGER 24X10X25G",
      //   code: "",
      // },
      // {
      //   label: "KOPIKO L.A. COFFEE POUCH 24X10X25G",
      //   value: "KOPIKO L.A. COFFEE POUCH 24X10X25G",
      //   code: "",
      // },
      // {
      //   label: "ENERGEN CHOCOLATE BAG 8X30X40G",
      //   value: "ENERGEN CHOCOLATE BAG 8X30X40G",
      //   code: "",
      // },
      // {
      //   label: "ENERGEN CHOCOLATE HANGER 24X10X40G",
      //   value: "ENERGEN CHOCOLATE HANGER 24X10X40G",
      //   code: "",
      // },
      // {
      //   label: "ENERGEN CHOCOLATE POUCH 24X10X40G",
      //   value: "ENERGEN CHOCOLATE POUCH 24X10X40G",
      //   code: "",
      // },
      // {
      //   label: "ENERGEN VANILLA BAG 8X30X40G",
      //   value: "ENERGEN VANILLA BAG 8X30X40G",
      //   code: "",
      // },
      // {
      //   label: "ENERGEN VANILLA POUCH 24X10X40G",
      //   value: "ENERGEN VANILLA POUCH 24X10X40G",
      //   code: "",
      // },
      // {
      //   label: "ENERGEN PANDESAL MATE 24X10X30G",
      //   value: "ENERGEN PANDESAL MATE 24X10X30G",
      //   code: "",
      // },
      // {
      //   label: "ENERGEN CHAMPION HANGER 24X10X30G",
      //   value: "ENERGEN CHAMPION HANGER 24X10X30G",
      //   code: "",
      // },
      // {
      //   label: "ENERGEN CHAMPION NBA TP 15X8X2X30G PH",
      //   value: "ENERGEN CHAMPION NBA TP 15X8X2X30G PH",
      //   code: "",
      // },
      // {
      //   label: "KOPIKO CREAMY CARAMELO TP 12X10X2X25G",
      //   value: "KOPIKO CREAMY CARAMELO TP 12X10X2X25G",
      //   code: "",
      // },
      // {
      //   label: "TORACAFE WHITE AND CREAMY 12X10X2X26G",
      //   value: "TORACAFE WHITE AND CREAMY 12X10X2X26G",
      //   code: "",
      // },
      // {
      //   label: "KOPIKO CAFE MOCHA TWINPACK 12X10X2X25.5G",
      //   value: "KOPIKO CAFE MOCHA TWINPACK 12X10X2X25.5G",
      //   code: "",
      // },
      // {
      //   label: "ENERGEN CHAMPION 40X345G",
      //   value: "ENERGEN CHAMPION 40X345G",
      //   code: "",
      // },
      // {
      //   label: "KOPIKO SUPREMO PH 84X12X2G",
      //   value: "KOPIKO SUPREMO PH 84X12X2G",
      //   code: "",
      // },
      // {
      //   label: "KOPIKO VOLCANIC DRIP JAVA 24X10X8G PH",
      //   value: "KOPIKO VOLCANIC DRIP JAVA 24X10X8G PH",
      //   code: "",
      // },
      // {
      //   label: "KOPIKO VOLCANIC DRIP MANDHELING 24X10X8G PH",
      //   value: "KOPIKO VOLCANIC DRIP MANDHELING 24X10X8G PH",
      //   code: "",
      // },
      // {
      //   label: "KOPIKO VOLCANIC DRIP TORAJA 24X10X8G PH",
      //   value: "KOPIKO VOLCANIC DRIP TORAJA 24X10X8G PH",
      //   code: "",
      // },
    ],
    V3: [
      // { label: "Select SKU", value: "", code: "" },
      {
        label: "KOPIKO LUCKY DAY 24X180ML",
        value: "KOPIKO LUCKY DAY 24X180ML",
        code: "",
      },
      // {
      //   label: "LE MINERALE 12x1500ML",
      //   value: "LE MINERALE 12x1500ML",
      //   code: "",
      // },
      // {
      //   label: "LE MINERALE 24x330ML",
      //   value: "LE MINERALE 24x330ML",
      //   code: "",
      // },
      // {
      //   label: "LE MINERALE 24x600ML",
      //   value: "LE MINERALE 24x600ML",
      //   code: "",
      // },
      // {
      //   label: "LE MINERALE 4X5000ML",
      //   value: "LE MINERALE 4X5000ML",
      //   code: "",
      // },
      // {
      //   label: "TEH PUCUK HARUM 24X350ML",
      //   value: "TEH PUCUK HARUM 24X350ML",
      //   code: "",
      // },
    ],
  };

  // Count how many SKUs are considered completed
  const getCompletedSkuCount = () => {
    let completedCount = 0;

    ["V1", "V2", "V3"].forEach((v) => {
      const versionSkus = skuData[v] || [];

      versionSkus.forEach((skuItem) => {
        const key = skuItem.value;
        const avail = availability[v]?.[key];

        if (avail === "Not Carried" || avail === "Delisted") {
          // Unavailable skus count as completed
          completedCount++;
        } else {
          // Otherwise only if all three fields are filled
          const b = skuValues.beginning?.[v]?.[key] || "";
          const d = skuValues.delivery?.[v]?.[key] || "";
          const e = skuValues.ending?.[v]?.[key] || "";

          if (b !== "" && d !== "" && e !== "") {
            completedCount++;
          }
        }
      });
    });

    return completedCount;
  };

  const addExpiryEntry = (skuKey: string) => {
    setSkuValues((prev: any) => {
      const current = prev.expiry?.[version]?.[skuKey] || [];
      const updated = [...current, { month: "", quantity: "" }];

      return {
        ...prev,
        expiry: {
          ...prev.expiry,
          [version]: {
            ...(prev.expiry?.[version] || {}),
            [skuKey]: updated,
          },
        },
      };
    });
  };

  const deleteExpiryEntry = (skuKey: string, index: number) => {
    setSkuValues((prev: any) => {
      const current = prev.expiry?.[version]?.[skuKey] || [];
      const updated = current.filter(
        (_entry: { month: string; quantity: string }, i: number) => i !== index
      );

      return {
        ...prev,
        expiry: {
          ...prev.expiry,
          [version]: {
            ...(prev.expiry?.[version] || {}),
            [skuKey]: updated,
          },
        },
      };
    });
  };

  const handleExpiryEntryChange = (
    skuKey: string,
    index: number,
    field: "month" | "quantity",
    value: string
  ) => {
    setSkuValues((prev: any) => {
      const currentList = prev.expiry?.[version]?.[skuKey] || [];
      const updatedList = [...currentList];
      updatedList[index] = {
        ...updatedList[index],
        [field]: value,
      };

      return {
        ...prev,
        expiry: {
          ...prev.expiry,
          [version]: {
            ...(prev.expiry?.[version] || {}),
            [skuKey]: updatedList,
          },
        },
      };
    });
  };

  useEffect(() => {
    if (!skuData[version]) return;

    setSkuValues((prev: any) => {
      const alreadyInitialized = prev.expiry?.[version];

      // ✅ Prevent infinite loop
      if (alreadyInitialized) return prev;

      const initialExpiry: any = {};
      skuData[version].forEach((skuItem: any) => {
        initialExpiry[skuItem.value] = [{ month: "1", quantity: "" }];
      });

      return {
        ...prev,
        expiry: {
          ...prev.expiry,
          [version]: initialExpiry,
        },
      };
    });
  }, [skuData, version]);

  // Always the fixed total of all SKUs across V1, V2, V3
  const getTotalSkuCount = () => {
    return ["V1", "V2", "V3"].reduce(
      (sum, v) => sum + (skuData[v]?.length || 0),
      0
    );
  };

  const filteredSkuOptions =
    skuData[version]?.filter((item) => item.value !== "") || [];

  const handleConditionalSubmit = () => {
    const incompleteVersions: string[] = [];

    ["V1", "V2", "V3"].forEach((version) => {
      const skuList = skuData[version];
      const isVersionComplete = skuList.every((sku) => {
        const key = sku.value;
        const isNotCarriedOrDelisted =
          availability[version]?.[key] === "Not Carried" ||
          availability[version]?.[key] === "Delisted";

        const hasAllValues =
          skuValues.beginning?.[version]?.[key] &&
          skuValues.delivery?.[version]?.[key] &&
          skuValues.ending?.[version]?.[key];

        return isNotCarriedOrDelisted || hasAllValues;
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
    if (!merchandiser || !selectedOutlet || !weeksCovered || !month || !week) {
      Alert.alert("Error", "Please fill in all required fields.");
      return;
    }

    if (!email) {
      console.error("❌ Missing userEmail!");
      Alert.alert("Error", "User email is not set. Please log in again.");
      return;
    }

    setLoading(true);

    const versions: VersionType[] = ["V1", "V2", "V3"];

    const groupedInventory: GroupedInventory = {
      email,
      date,
      merchandiser,
      outlet: selectedOutlet,
      weeksCovered,
      month,
      week,
      versions: {
        V1: { Carried: [], "Not Carried": [], Delisted: [] },
        V2: { Carried: [], "Not Carried": [], Delisted: [] },
        V3: { Carried: [], "Not Carried": [], Delisted: [] },
      },
    };

    versions.forEach((v) => {
      const skus = skuData[v]?.filter((item) => item.value !== "") || [];

      skus.forEach((skuItem) => {
        const skuKey = skuItem.value;
        const status = (availability[v]?.[skuKey] ||
          "Carried") as AvailabilityType;

        const commonFields = {
          sku: skuItem.label,
          skuCode: skuKey,
        };
        const expiryList = skuValues.expiry?.[v]?.[skuKey] || [];

        if (status === "Carried") {
          groupedInventory.versions[v][status].push({
            ...commonFields,
            beginningPCS: Number(skuValues.beginning?.[v]?.[skuKey] || 0),
            deliveryPCS: Number(skuValues.delivery?.[v]?.[skuKey] || 0),
            endingPCS: Number(skuValues.ending?.[v]?.[skuKey] || 0),
            offtake: Number(skuValues.offtake?.[v]?.[skuKey] || 0),
            inventoryDays: Number(skuValues.inventoryDays?.[v]?.[skuKey] || 0),
            expiry: Array.isArray(expiryList)
              ? expiryList.map((entry) => ({
                  month: entry.month,
                  quantity: Number(entry.quantity) || 0,
                }))
              : [],
          });
        } else {
          groupedInventory.versions[v][status].push(commonFields);
        }
      });
    });

    // Use previousWeekId from state or props if available

    // const saveOffline = async () => {
    //   try {
    //     const existing = await AsyncStorage.getItem("offlineInventories");
    //     const offlineList: OfflineInventoryItem[] = existing
    //       ? JSON.parse(existing)
    //       : [];

    //     offlineList.push({
    //       data: groupedInventory,
    //     });

    //     await AsyncStorage.setItem(
    //       "offlineInventories",
    //       JSON.stringify(offlineList)
    //     );

    //     Alert.alert(
    //       "Saved Offline",
    //       "No internet. Inventory will sync automatically later."
    //     );
    //     router.replace("/HomeScreen");
    //   } catch (err) {
    //     console.error("Failed to save locally:", err);
    //     Alert.alert("Error", "Couldn't save inventory offline.");
    //   }
    // };

    try {
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        // await saveOffline();
        return;
      }

      const res = await fetch(
        "https://towi-react.onrender.com/inventory/grouped",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(groupedInventory),
        }
      );

      if (!res.ok) throw new Error(await res.text());

      const contentType = res.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        const data = await res.json();
        console.log("✅ Grouped inventory saved:", data);
        router.replace("/HomeScreen");
      } else {
        console.warn("Received non-JSON response:", await res.text());
      }
    } catch (err) {
      if (err instanceof TypeError && err.message.includes("Network")) {
        // await saveOffline();
      } else {
        console.error("❌ Error saving whole inventory:", err);
        Alert.alert("Error", "Failed to save inventory.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={{ flex: 1 }}>
        <View style={styles.appBarInventoryprocess}>
          <Text style={styles.appBarTitleInventoryprocess}>
            INVENTORY PROCESS
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
            label="Email Address"
            value={email}
            onChangeText={setEmail}
            editable={false}
            style={{ height: 0, opacity: 0 }}
          />
          <LabeledInput
            label="Merchandiser Name"
            value={merchandiser}
            onChangeText={setMerchandiser}
            editable={false}
            style={{ height: 0, opacity: 0 }}
          />

          <DropDownPicker
            open={open}
            value={selectedOutlet}
            items={outletOptions}
            setOpen={setOpen}
            setValue={setSelectedOutlet}
            setItems={setOutletOptions}
            searchable
            placeholder="Select Branch"
            // style={{ width: 407 }}
            // dropDownContainerStyle={{ width: 407 }}
            listMode="SCROLLVIEW"
          />

          <AndroidPicker
            label="Weeks Covered"
            selectedValue={weeksCovered}
            onValueChange={handleWeeksCoveredChange}
            items={weekOptions}
            enabled={false} // Use this instead of editable
          />

          <LabeledInput
            label="Month"
            value={month}
            onChangeText={setMonth}
            editable={false}
            style={{ height: 0, opacity: 0 }}
          />
          <LabeledInput
            label="Week"
            value={week}
            onChangeText={setWeek}
            editable={false}
            style={{ height: 0, opacity: 0 }}
          />

          <Text style={styles.label}>Select Version</Text>
          <View style={styles.buttonRow}>
            {["V1", "V2", "V3"].map((v) => {
              const versionSkus = skuData[v] || [];
              let completedSkuCount = 0;
              const totalSkuCount = versionSkus.length;

              versionSkus.forEach((skuItem) => {
                const key = skuItem.value;
                const avail = availability[v]?.[key];

                // If it’s not carried or delisted, count as done
                if (avail === "Not Carried" || avail === "Delisted") {
                  completedSkuCount++;
                } else {
                  // Otherwise require all three fields
                  const b = skuValues.beginning?.[v]?.[key] || "";
                  const d = skuValues.delivery?.[v]?.[key] || "";
                  const e = skuValues.ending?.[v]?.[key] || "";

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
                  onPress={() => {
                    setVersion((prev) => (prev === v ? "" : v));
                    setSku("");
                    setExpandedSection(null);
                  }}
                  disabled={version !== "" && version !== v}
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

                  // Count if value is filled or availability is Not Carried / Delisted
                  return (
                    (val !== undefined && val !== "") ||
                    availStatus === "Not Carried" ||
                    availStatus === "Delisted"
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
                            availability[version]?.[skuKey] ??
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
                              activeOpacity={1} // Keep the row visible when touched
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                marginBottom: 8,
                              }}
                            >
                              {/* SKU Label */}
                              <ScrollView
                                horizontal
                                style={{ flex: 1 }}
                                contentContainerStyle={{ paddingRight: 10 }}
                                scrollEnabled={true}
                              >
                                <Text style={styles.skuText} numberOfLines={1}>
                                  {skuItem.label}
                                </Text>
                              </ScrollView>

                              {/* Availability Picker (Beginning only) */}
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
                                      setAvailability((prev) => ({
                                        ...prev,
                                        [version]: {
                                          ...(prev[version] || {}),
                                          [skuKey]: value,
                                        },
                                      }));

                                      if (value !== "Carried") {
                                        // Clear all fields if Not Carried or Delisted
                                        setSkuValues((prev: any) => ({
                                          ...prev,
                                          beginning: {
                                            ...(prev.beginning || {}),
                                            [version]: {
                                              ...(prev.beginning?.[version] ||
                                                {}),
                                              [skuKey]: "",
                                            },
                                          },
                                          delivery: {
                                            ...(prev.delivery || {}),
                                            [version]: {
                                              ...(prev.delivery?.[version] ||
                                                {}),
                                              [skuKey]: "",
                                            },
                                          },
                                          ending: {
                                            ...(prev.ending || {}),
                                            [version]: {
                                              ...(prev.ending?.[version] || {}),
                                              [skuKey]: "",
                                            },
                                          },
                                        }));
                                      }
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
                                    <Picker.Item
                                      label="Delisted"
                                      value="Delisted"
                                      style={{ fontSize: 11, color: "black" }}
                                    />
                                  </Picker>
                                  <Icon
                                    name="arrow-drop-down"
                                    size={24}
                                    color="grey"
                                    style={{
                                      position: "absolute",
                                      right: 10,
                                      top: 13,
                                      pointerEvents: "none", // ensures Picker underneath still responds
                                    }}
                                  />
                                </View>
                              )}

                              {/* Quantity Input (editable only if Carried) */}
                              <TextInput
                                style={[
                                  styles.inputBox,
                                  {
                                    width: 52,
                                    height: 40,
                                    marginLeft: isBeginning ? 0 : 6,
                                    textAlign: "center",
                                    backgroundColor:
                                      availabilityValue === "Carried"
                                        ? "#FFFFFF"
                                        : "#f0f0f0", // light blue if carried, gray otherwise
                                    borderColor:
                                      availabilityValue === "Carried"
                                        ? "#2c1c5c"
                                        : "#ccc", // teal if carried
                                    borderWidth: 1,
                                  },
                                ]}
                                keyboardType="numeric"
                                value={
                                  skuValues[sectionKey]?.[version]?.[skuKey] ||
                                  ""
                                }
                                onChangeText={(text) => {
                                  setSkuValues((prev: any) => ({
                                    ...prev,
                                    [sectionKey]: {
                                      ...(prev[sectionKey] || {}),
                                      [version]: {
                                        ...(prev[sectionKey]?.[version] || {}),
                                        [skuKey]: text,
                                      },
                                    },
                                  }));
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

              {/* Expandable Expiry Section */}
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
                  <View style={{ marginTop: 10 }}>
                    {skuData[version]?.map((skuItem) => (
                      <View key={skuItem.value} style={{ marginBottom: 16 }}>
                        <Text style={[styles.skuText, { marginBottom: 6 }]}>
                          {skuItem.label}
                        </Text>

                        {(
                          skuValues.expiry?.[version]?.[skuItem.value] || []
                        ).map((entry: ExpiryEntry, index: number) => (
                          <View
                            key={`${skuItem.value}-${index}`}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              marginBottom: 8,
                            }}
                          >
                            {/* Expiry Month Picker */}
                            <View style={{ flex: 3, marginHorizontal: 8 }}>
                              <AndroidPicker
                                label=""
                                selectedValue={entry.month}
                                onValueChange={(val) =>
                                  handleExpiryEntryChange(
                                    skuItem.value,
                                    index,
                                    "month",
                                    val
                                  )
                                }
                                items={[1, 2, 3, 4, 5, 6].map((n) => ({
                                  label: `${n} Month${n > 1 ? "s" : ""}`,
                                  value: String(n),
                                }))}
                              />
                            </View>

                            {/* Quantity Field */}
                            <TextInput
                              placeholder="Qty"
                              placeholderTextColor={"grey"}
                              style={[
                                styles.inputBox,
                                { flex: 2, height: 40, fontSize: 14 },
                              ]}
                              keyboardType="numeric"
                              value={entry.quantity}
                              onChangeText={(text) =>
                                handleExpiryEntryChange(
                                  skuItem.value,
                                  index,
                                  "quantity",
                                  text
                                )
                              }
                            />
                          </View>
                        ))}

                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginTop: 4,
                          }}
                        >
                          {/* Add Button (Left) */}
                          <TouchableOpacity
                            activeOpacity={1}
                            onPress={() => addExpiryEntry(skuItem.value)}
                          >
                            <Text style={{ color: "#007bff", fontSize: 14 }}>
                              + Add Expiry Entry
                            </Text>
                          </TouchableOpacity>

                          {/* Delete Last Entry Button (Right) */}
                          {(skuValues.expiry?.[version]?.[skuItem.value]
                            ?.length || 0) > 1 && (
                            <TouchableOpacity
                              activeOpacity={1}
                              onPress={() =>
                                deleteExpiryEntry(
                                  skuItem.value,
                                  (skuValues.expiry?.[version]?.[skuItem.value]
                                    ?.length || 1) - 1
                                )
                              }
                            >
                              <Text style={{ color: "red", fontSize: 18 }}>
                                X
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Expandable Offtake Section */}
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
                  <TouchableOpacity
                    style={{ marginTop: 10 }}
                    activeOpacity={1} // Removes the opacity effect when pressed
                    onPress={() => {}} // Empty function
                  >
                    {filteredSkuOptions.map((skuItem) => (
                      <View key={skuItem.value} style={styles.skuItemRow}>
                        <Text style={styles.skuText}>{skuItem.label}</Text>
                        <TextInput
                          placeholder="Offtake"
                          style={styles.inputBox}
                          editable={false}
                          value={
                            skuValues.offtake?.[version]?.[skuItem.value] || ""
                          }
                        />
                      </View>
                    ))}
                  </TouchableOpacity>
                )}
              </View>

              {/* Expandable Inventory Days Level Section */}
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
                          editable={false}
                          value={
                            skuValues.inventoryDays?.[version]?.[
                              skuItem.value
                            ] || ""
                          }
                        />
                      </View>
                    ))}
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}

          <View style={[styles.buttonRow, { justifyContent: "space-between" }]}>
            <TouchableOpacity
              style={[styles.submitButton, { flex: 1, marginRight: 5 }]}
              onPress={() => router.replace("/(tabs)/HomeScreen")}
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
        </ScrollView>
      </View>
    </TouchableWithoutFeedback>
  );
};

export default InventoryProcess;
