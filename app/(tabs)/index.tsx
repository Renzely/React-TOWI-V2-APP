import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  Switch,
} from "react-native";
import { useRouter } from "expo-router";
import loginStyles from "./Style";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { useAuth } from "./auth";
import { useEffect } from "react";

const LoginScreen = () => {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [connectionType, setConnectionType] = useState("");
  const [isConnected, setIsConnected] = useState(true);
  const [allowOfflineLogin, setAllowOfflineLogin] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(!!state.isConnected);
      if (!state.isConnected) {
        setConnectionType("No Internet Connection");
      } else {
        setConnectionType(
          state.type.charAt(0).toUpperCase() + state.type.slice(1)
        );
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    const netState = await NetInfo.fetch();

    // Check if offline
    if (!netState.isConnected || !netState.isInternetReachable) {
      if (!allowOfflineLogin) {
        Alert.alert(
          "Offline Login Disabled",
          "Please enable the 'Offline Login' option to proceed without internet."
        );
        return;
      }

      // Attempt offline login
      try {
        const storedUser = await AsyncStorage.getItem("user");
        if (!storedUser) {
          Alert.alert(
            "Offline Login Failed",
            "No stored user credentials found."
          );
          return;
        }

        const parsedUser = JSON.parse(storedUser);

        if (parsedUser.email === email && parsedUser.password === password) {
          await signIn("offline-token"); // use dummy token or customize
          Alert.alert("Offline Login", "Logged in offline successfully!");
          router.replace("/HomeScreen");
        } else {
          Alert.alert("Offline Login Failed", "Incorrect email or password.");
        }
      } catch (error) {
        console.error("Offline login error:", error);
        Alert.alert("Error", "Something went wrong during offline login.");
      }

      return;
    }

    // Online login logic
    try {
      const response = await fetch("http://192.168.50.54:3001/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        Alert.alert("Login Failed", data.message || "Invalid credentials");
        return;
      }

      const user = data.user;

      // ⚠️ Store user + password in AsyncStorage for offline login (not secure for production)
      await AsyncStorage.setItem("user", JSON.stringify({ ...user, password }));

      await AsyncStorage.setItem("email", user?.email || data.email || email);

      if (user?.outlet) {
        const outletValue = Array.isArray(user.outlet)
          ? user.outlet.join(",")
          : user.outlet;
        await AsyncStorage.setItem("outlet", outletValue);
      }

      await signIn(data.token);
      Alert.alert("Success", "Login successful!");
      router.replace("/HomeScreen");
    } catch (error) {
      Alert.alert("Error", "Something went wrong during login.");
      console.error(error);
    }
  };

  return (
    <View style={loginStyles.container}>
      <View style={loginStyles.logoPlaceholder}>
        <Image
          source={require("../../assets/images/TOWI_LOGO.png")}
          style={loginStyles.logoImage}
          resizeMode="contain"
        />
      </View>
      <Text style={[loginStyles.title, { marginTop: 15 }]}>LOGIN</Text>

      {!isConnected && (
        <Text
          style={{
            marginVertical: 10,
            color: "red",
            textAlign: "center",
            fontWeight: "bold",
          }}
        >
          {connectionType}
        </Text>
      )}

      <TextInput
        style={[loginStyles.input, { marginTop: 3 }]}
        placeholder="Email"
        placeholderTextColor="#ccc"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={loginStyles.input}
        placeholder="Password"
        placeholderTextColor="#ccc"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginVertical: 10,
        }}
      >
        <Switch
          value={allowOfflineLogin}
          onValueChange={(value) => setAllowOfflineLogin(value)}
          thumbColor={allowOfflineLogin ? "green" : "gray"}
          trackColor={{ false: "lightgray", true: "lightgreen" }}
        />

        <Text style={{ marginLeft: 10, color: "#black" }}>
          Login As offline
        </Text>
      </View>

      <TouchableOpacity style={loginStyles.button} onPress={handleLogin}>
        <Text style={loginStyles.buttonText}>Login</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={loginStyles.signupButton}
        onPress={() => router.push("/SignUp")}
      >
        <Text style={loginStyles.signupText}>Create Account</Text>
      </TouchableOpacity>
    </View>
  );
};

export default LoginScreen;
