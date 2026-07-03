import ZegoUIKitPrebuiltCallService from '@zegocloud/zego-uikit-prebuilt-call-rn';

export const initZegoCall = (userID, userName) => {
  ZegoUIKitPrebuiltCallService.init({
    appID: 1349683024, // Replace with your actual ZEGOCLOUD App ID
    appSign: '196fc1b18a939134263e09471766f2d290c12017cf681ae7f75d553b39eeedcc, // Replace with your actual ZEGOCLOUD App Sign
    userID,
    userName,
    requireMicrophone: true,
    requireCamera: true,
  });
};

export const startCall = (callID, invitees = []) => {
  ZegoUIKitPrebuiltCallService.call({
    callID,
    invitees, // Array of {userID, userName}
    config: {
      audioVideoViewConfig: { showAudioVideo: true },
      bottomMenuBarConfig: { buttons: ["mic", "camera", "hangUp", "switchCamera"] }
    }
  });
};
