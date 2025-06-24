import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import styles from "./Style";

const SignUp = () => {
  const router = useRouter();
  const [form, setForm] = useState({
    outlet: ["Branch"],
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    contactNumber: "",
    password: "",
    confirmPassword: "",
  });
  const [otp, setOtp] = useState("");
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (field: string, value: string) => {
    setForm({ ...form, [field]: value });
  };

  const handleSignUp = async () => {
    if (form.password !== form.confirmPassword) {
      Alert.alert("Passwords do not match");
      return;
    }

    try {
      const res = await fetch("https://towi-react.onrender.com/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (res.ok) {
        Alert.alert("Success", data.message);
        setIsOtpSent(true);
      } else {
        Alert.alert("Error", data.message || "Something went wrong");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to connect to the server");
    }
  };

  const handleVerifyOtp = async () => {
    try {
      const res = await fetch("https://towi-react.onrender.com/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, otp }),
      });

      const data = await res.json();
      if (res.ok) {
        Alert.alert("Success", "Email verified successfully");
        setIsVerified(true);
        router.back();
      } else {
        Alert.alert("Error", data.message || "Invalid OTP");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to connect to the server");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign Up</Text>

      {!isOtpSent ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="First Name"
            placeholderTextColor="#ccc"
            value={form.firstName}
            onChangeText={(text) => handleChange("firstName", text)}
          />
          <TextInput
            style={styles.input}
            placeholder="Middle Name (Optional)"
            placeholderTextColor="#ccc"
            value={form.middleName}
            onChangeText={(text) => handleChange("middleName", text)}
          />
          <TextInput
            style={styles.input}
            placeholder="Last Name"
            placeholderTextColor="#ccc"
            value={form.lastName}
            onChangeText={(text) => handleChange("lastName", text)}
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#ccc"
            keyboardType="email-address"
            value={form.email}
            onChangeText={(text) => handleChange("email", text)}
          />
          <TextInput
            style={styles.input}
            placeholder="Contact Number"
            placeholderTextColor="#ccc"
            keyboardType="phone-pad"
            value={form.contactNumber}
            maxLength={11}
            onChangeText={(text) => {
              const numeric = text.replace(/[^0-9]/g, ""); // remove non-numeric
              handleChange("contactNumber", numeric.slice(0, 11)); // keep max 11 digits
            }}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#ccc"
            secureTextEntry={!showPassword}
            value={form.password}
            onChangeText={(text) => handleChange("password", text)}
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor="#ccc"
            secureTextEntry={!showPassword}
            value={form.confirmPassword}
            onChangeText={(text) => handleChange("confirmPassword", text)}
          />

          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={{ alignSelf: "flex-start", marginBottom: 10 }}
          >
            <Ionicons
              name={showPassword ? "eye-off" : "eye"}
              size={34}
              color="green"
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={handleSignUp}>
            <Text style={styles.buttonText}>Create Account</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TextInput
            style={styles.input}
            placeholder="Enter OTP"
            placeholderTextColor="#ccc"
            keyboardType="number-pad"
            value={otp}
            onChangeText={(text) => setOtp(text)}
          />

          <TouchableOpacity style={styles.button} onPress={handleVerifyOtp}>
            <Text style={styles.buttonText}>Verify OTP</Text>
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity
        style={styles.signupButton}
        onPress={() => router.back()}
      >
        <Text style={styles.signupText}>Back to Login</Text>
      </TouchableOpacity>
    </View>
  );
};

export default SignUp;
