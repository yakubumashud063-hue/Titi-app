import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { GiftedChat } from 'react-native-gifted-chat';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase-config';
import { initZegoCall, startCall } from '../services/zegocloud';

const ChatScreen = ({ navigation }) => {
  const [messages, setMessages] = useState([]);
  
  // Dummy user for demo purposes
  const currentUser = {
    _id: 'user1',
    name: 'Dad',
    avatar: 'ðŸ‘¨'
  };

  const familyId = 'default-family';

  useEffect(() => {
    initZegoCall(currentUser._id, currentUser.name);

    const q = query(collection(db, `families/${familyId}/messages`), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(
        snapshot.docs.map(doc => ({
          _id: doc.id,
          text: doc.data().text,
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          user: doc.data().user,
        }))
      );
    });

    return () => unsubscribe();
  }, []);

  const onSend = async (newMessages = []) => {
    const text = newMessages[0].text;
    await addDoc(collection(db, `families/${familyId}/messages`), {
      text,
      createdAt: serverTimestamp(),
      user: currentUser,
    });
  };

  const handleVideoCall = () => {
    const callID = `titi-family-call-${familyId}`;
    // For demo, passing empty invitees will start a room call
    startCall(callID, []);
  };

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={handleVideoCall} style={styles.videoButton}>
          <Text style={styles.videoButtonText}>ðŸŽ¥</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  return (
    <View style={styles.container}>
      <GiftedChat
        messages={messages}
        onSend={messages => onSend(messages)}
        user={currentUser}
        renderAvatarOnTop
      />
    </View>
  );
};
import { ZegoUIKitPrebuiltCall } from '@zegocloud/zego-uikit-prebuilt-call-rn';

const VideoCallButton = ({ familyMembers, currentUser }) => {
  const callID = `titi-family-${Date.now()}`; // Or fixed per family session

  const handleStartCall = () => {
    const invitees = familyMembers
      .filter(m => m.id !== currentUser.uid)
      .map(m => ({ userID: m.id, userName: m.name }));

    startCall(callID, invitees);
  };

  return (
    <TouchableOpacity 
      onPress={handleStartCall}
      className="bg-pink-500 px-6 py-3 rounded-3xl flex-row items-center gap-2"
    >
      <Icon name="video" size={24} color="white" />
      <Text className="text-white font-semibold">Video Call Family</Text>
    </TouchableOpacity>
  );
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  videoButton: {
    marginRight: 15,
  },
  videoButtonText: {
    fontSize: 24,
  }
});

export default ChatScreen;
