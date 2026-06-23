import React from "react";
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
} from "react-native";
import sampleReport from "@/sampleReport.json";

interface ActionButtonsProps {
  studentId: string;
  onSendMessage: (question: string) => void;
  isLoading?: boolean;
}

export default function ActionButtons({
  studentId,
  onSendMessage,
  isLoading = false,
}: ActionButtonsProps) {
  const extractUpcomingTests = () => {
    const upcomingTests: string[] = [];

    if (sampleReport.entries && Array.isArray(sampleReport.entries)) {
      sampleReport.entries.forEach((entry: any) => {
        if (entry.subjects) {
          Object.entries(entry.subjects).forEach(([subject, details]: [string, any]) => {
            if (typeof details === "object") {
              // Check if this is a teacher-based structure (has nested teachers)
              const values = Object.values(details);
              const hasTeacherStructure = values.some((v: any) => 
                typeof v === "object" && v !== null && "upcoming" in v
              );

              if (hasTeacherStructure) {
                // Handle teacher-based structure
                Object.entries(details).forEach(([, teacherData]: [string, any]) => {
                  if (typeof teacherData === "object" && teacherData.upcoming && teacherData.upcoming.trim() && teacherData.upcoming !== "N/A" && teacherData.upcoming !== "None") {
                    upcomingTests.push(`${subject}: ${teacherData.upcoming}`);
                  }
                });
              } else {
                // Handle direct structure (no teacher nesting)
                if (details.upcoming && details.upcoming.trim() && details.upcoming !== "N/A" && details.upcoming !== "None") {
                  upcomingTests.push(`${subject}: ${details.upcoming}`);
                }
              }
            }
          });
        }
      });
    }

    let message = "UPCOMING TESTS & EXAMS:\n\n";
    if (upcomingTests.length > 0) {
      upcomingTests.forEach((test) => {
        message += `• ${test}\n`;
      });
    } else {
      message += "No upcoming tests found.";
    }
    return message;
  };

  const extractUpcomingDueDates = () => {
    const dueDates: string[] = [];

    if (sampleReport.entries && Array.isArray(sampleReport.entries)) {
      sampleReport.entries.forEach((entry: any) => {
        if (entry.subjects) {
          Object.entries(entry.subjects).forEach(([subject, details]: [string, any]) => {
            if (typeof details === "object") {
              // Check if this is a teacher-based structure
              const values = Object.values(details);
              const hasTeacherStructure = values.some((v: any) => 
                typeof v === "object" && v !== null && "homework" in v
              );

              if (hasTeacherStructure) {
                // Handle teacher-based structure
                Object.entries(details).forEach(([, teacherData]: [string, any]) => {
                  if (typeof teacherData === "object" && teacherData.homework && teacherData.homework.trim()) {
                    dueDates.push(`${subject}: ${teacherData.homework}`);
                  }
                });
              } else {
                // Handle direct structure
                if (details.homework && details.homework.trim()) {
                  dueDates.push(`${subject}: ${details.homework}`);
                }
              }
            }
          });
        }
      });
    }

    let message = "UPCOMING DUE DATES:\n\n";
    if (dueDates.length > 0) {
      dueDates.forEach((due) => {
        message += `• ${due}\n`;
      });
    } else {
      message += "No upcoming assignments found.";
    }
    return message;
  };

  const extractLowestGrade = () => {
    // Mock data for lowest class grade
    const grades = {
      "History": "74% C",
      "Math": "82% B",
      "English": "88% A",
      "Science": "91% A"
    };

    const sortedGrades = Object.entries(grades).sort((a, b) => {
      const gradeA = parseInt(a[1]);
      const gradeB = parseInt(b[1]);
      return gradeA - gradeB;
    });

    let message = "LOWEST CLASS GRADES:\n\n";
    message += `Lowest: ${sortedGrades[0][0]} - ${sortedGrades[0][1]}\n\n`;
    message += "All Grades:\n";
    sortedGrades.forEach(([subject, grade]) => {
      message += `• ${subject}: ${grade}\n`;
    });
    return message;
  };

  const extractMissingAssignments = () => {
    const missingAssignments: string[] = [];

    if (sampleReport.entries && Array.isArray(sampleReport.entries)) {
      sampleReport.entries.forEach((entry: any) => {
        if (entry.subjects) {
          Object.entries(entry.subjects).forEach(([subject, details]: [string, any]) => {
            if (typeof details === "object") {
              // Check if this is a teacher-based structure
              const values = Object.values(details);
              const hasTeacherStructure = values.some((v: any) => 
                typeof v === "object" && v !== null && "homework" in v
              );

              if (hasTeacherStructure) {
                // Handle teacher-based structure
                Object.entries(details).forEach(([, teacherData]: [string, any]) => {
                  if (typeof teacherData === "object" && teacherData.homework && teacherData.homework.toLowerCase().includes("missing")) {
                    missingAssignments.push(`${subject}: ${teacherData.homework}`);
                  }
                });
              } else {
                // Handle direct structure
                if (details.homework && details.homework.toLowerCase().includes("missing")) {
                  missingAssignments.push(`${subject}: ${details.homework}`);
                }
              }
            }
          });
        }
      });
    }

    let message = "MISSING ASSIGNMENTS:\n\n";
    if (missingAssignments.length > 0) {
      missingAssignments.forEach((assignment) => {
        message += `• ${assignment}\n`;
      });
    } else {
      message += "No missing assignments found.";
    }
    return message;
  };

  const handleUpcomingTests = () => {
    if (!studentId.trim()) {
      alert("Please enter a Student ID");
      return;
    }
    const tests = extractUpcomingTests();
    onSendMessage(tests);
  };

  const handleUpcomingDueDates = () => {
    if (!studentId.trim()) {
      alert("Please enter a Student ID");
      return;
    }
    const dueDates = extractUpcomingDueDates();
    onSendMessage(dueDates);
  };

  const handleLowestGrade = () => {
    if (!studentId.trim()) {
      alert("Please enter a Student ID");
      return;
    }
    const grades = extractLowestGrade();
    onSendMessage(grades);
  };

  const handleMissingAssignments = () => {
    if (!studentId.trim()) {
      alert("Please enter a Student ID");
      return;
    }
    const missing = extractMissingAssignments();
    onSendMessage(missing);
  };

  const handleQuickSummary = () => {
    if (!studentId.trim()) {
      alert("Please enter a Student ID");
      return;
    }
    onSendMessage("Give me a quick 1-2 sentence summary of my current tasks.");
  };

  const handleViewSchedule = () => {
    if (!studentId.trim()) {
      alert("Please enter a Student ID");
      return;
    }
    onSendMessage(
      "What is my schedule for today? List all classes and times."
    );
  };

  const handleGetHomework = () => {
    if (!studentId.trim()) {
      alert("Please enter a Student ID");
      return;
    }
    onSendMessage(
      "List all my homework assignments due this week, organized by subject."
    );
  };

  const buttonConfig = [
    {
      label: "Upcoming Tests",
      onPress: handleUpcomingTests,
      color: "#667eea",
    },
    {
      label: "Upcoming Due Dates",
      onPress: handleUpcomingDueDates,
      color: "#764AF2",
    },
    {
      label: "Lowest Grade",
      onPress: handleLowestGrade,
      color: "#F093FB",
    },
    {
      label: "Missing Assignments",
      onPress: handleMissingAssignments,
      color: "#4DD0E1",
    },
  ];

  return (
    <View style={styles.container}>
      {buttonConfig.map((btn, idx) => (
        <TouchableOpacity
          key={idx}
          style={[styles.button, { backgroundColor: btn.color }]}
          onPress={btn.onPress}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>{btn.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    gap: 10,
  },
  button: {
    width: "48%",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 12,
    textAlign: "center",
  },
});
