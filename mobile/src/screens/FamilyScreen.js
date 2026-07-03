import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
// In your ChatScreen.js
useEffect(() => {
  // Initialize when user logs in
  initZegoCall(currentUser.uid, currentUser.displayName || "Family Member");
}, [currentUser]);
const FamilyScreen = () => {
  const family = [
    { id: '1', name: "Dad", avatar: "👨", isAdmin: true },
    { id: '2', name: "Mom", avatar: "👩", isAdmin: true },
    { id: '3', name: "Emma", avatar: "👧", isAdmin: false },
    { id: '4', name: "Liam", avatar: "👦", isAdmin: false }
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Our Family</Text>
      <FlatList
        data={family}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.memberCard}>
            <Text style={styles.avatar}>{item.avatar}</Text>
            <View>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.role}>{item.isAdmin ? '👑 Admin' : '👤 Member'}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  avatar: {
    fontSize: 32,
    marginRight: 15,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
  },
  role: {
    fontSize: 14,
    color: '#888',
  }
});

export default FamilyScreen;
