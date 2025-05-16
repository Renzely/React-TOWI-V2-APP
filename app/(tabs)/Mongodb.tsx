import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";

const Mongodb = () => {
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("http://192.168.50.55:3001/inventory") // Replace with your actual IP
      .then((res) => res.json())
      .then((data) => setMessage(data.message))
      .catch((err) => console.error("Fetch error:", err));
  }, []);

  return (
    <View style={styles.container}>
      <Text>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    marginTop: 50,
  },
});

export default Mongodb;
