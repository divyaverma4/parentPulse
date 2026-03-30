import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView } from "react-native";

export default function Chatbot() {
  const [studentId, setStudentId] = useState("1");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([
    { sender: "bot", text: "Hello! I'm your ParentPulse assistant. How can I help you today?" }
  ]);

  const sendMessage = async () => {
    if (!message.trim()) return;

    const userMsg = { sender: "user", text: message };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch("http://10.0.2.2:3000/api/chat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: message,
          studentUserId: Number(studentId)
        })
      });

      const data = await res.json();
      const botMsg = { sender: "bot", text: data.response || "No response" };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      setMessages((prev) => [...prev, { sender: "bot", text: "Error contacting server." }]);
    }

    setMessage("");
  };

  return (
    <View style={{ flex: 1, padding: 20, backgroundColor: "white" }}>
      <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 10 }}>
        ParentPulse Chatbot
      </Text>

      <View style={{ marginBottom: 15 }}>
        <Text>Student ID:</Text>
        <TextInput
          value={studentId}
          onChangeText={setStudentId}
          keyboardType="numeric"
          style={{
            borderWidth: 1,
            borderColor: "#ccc",
            padding: 8,
            borderRadius: 6,
            marginTop: 5
          }}
        />
      </View>

      <ScrollView style={{ flex: 1, marginBottom: 10 }}>
        {messages.map((msg, i) => (
          <View
            key={i}
            style={{
              alignSelf: msg.sender === "user" ? "flex-end" : "flex-start",
              backgroundColor: msg.sender === "user" ? "#d0e8ff" : "#eee",
              padding: 10,
              borderRadius: 8,
              marginVertical: 4,
              maxWidth: "80%"
            }}
          >
            <Text>{msg.text}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={{ flexDirection: "row" }}>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="Type your message..."
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: "#ccc",
            padding: 10,
            borderRadius: 6
          }}
        />
        <TouchableOpacity
          onPress={sendMessage}
          style={{
            marginLeft: 10,
            backgroundColor: "#007bff",
            paddingHorizontal: 15,
            justifyContent: "center",
            borderRadius: 6
          }}
        >
          <Text style={{ color: "white" }}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}