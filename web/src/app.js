// =============================================
// TITI - Family Chat, Private Messages, and Calls
// =============================================

import {
  auth,
  db,
  googleProvider
} from './firebase-config.js';

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";

import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

const currentFamilyId = "family-default";

let currentUser = null;
let activeChat = { type: "family", userId: null, userName: "Family" };
let messages = [];
let familyMembers = [];
let groups = [];
let favorites = loadFavorites();
let replyingTo = null;
let activeMessagesUnsubscribe = null;
let familyMembersUnsubscribe = null;
let groupsUnsubscribe = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let localStream = null;
let callTimer = null;
let callSeconds = 0;
let openActionMenuId = null;
let isSignup = false;

const els = {
  authScreen: document.getElementById('auth-screen'),
  mainApp: document.getElementById('main-app'),
  messages: document.getElementById('messages'),
  messageInput: document.getElementById('message-input'),
  userEmail: document.getElementById('user-email'),
  currentAvatar: document.getElementById('current-avatar'),
  currentName: document.getElementById('current-name'),
  currentStatus: document.getElementById('current-status'),
  familyList: document.getElementById('family-list'),
  typingIndicator: document.getElementById('typing-indicator'),
  replyPreview: document.getElementById('reply-preview'),
  recordingStatus: document.getElementById('recording-status'),
  groupInviteBtn: document.getElementById('group-invite-btn')
};

const fallbackMembers = [
  { uid: "dad-demo", name: "Dad", email: "dad@titi.local" },
  { uid: "mom-demo", name: "Mom", email: "mom@titi.local" },
  { uid: "emma-demo", name: "Emma", email: "emma@titi.local" },
  { uid: "liam-demo", name: "Liam", email: "liam@titi.local" }
];

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function initials(name = "T") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || "T").toUpperCase();
}

function getDisplayName(user = currentUser) {
  return user?.displayName || user?.email?.split("@")[0] || "You";
}

function getPrivateThreadId(userA, userB) {
  return [userA, userB].sort().join("__");
}

function generateInviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function normalizeInviteCode(value = "") {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function inviteLinkFor(code) {
  const url = new URL(window.location.href);
  url.searchParams.set("invite", code);
  return url.toString();
}

function getInviteCodeFromUrl() {
  return normalizeInviteCode(new URLSearchParams(window.location.search).get("invite") || "");
}

function loadFavorites() {
  try {
    return JSON.parse(localStorage.getItem("titi-favorites") || "[]");
  } catch (_) {
    return [];
  }
}

function saveFavorites() {
  localStorage.setItem("titi-favorites", JSON.stringify(favorites));
}

function messagePreviewText(msg = {}) {
  const text = msg.text || (msg.image ? "Photo" : msg.audio ? "Voice message" : "Message");
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

function renderReplyPreview() {
  if (!els.replyPreview) return;

  if (!replyingTo) {
    els.replyPreview.classList.add('hidden');
    els.replyPreview.innerHTML = "";
    return;
  }

  els.replyPreview.classList.remove('hidden');
  els.replyPreview.innerHTML = `
    <div class="mx-auto mb-2 flex max-w-4xl items-center gap-3 rounded-xl border border-pink-100 bg-pink-50 px-3 py-2 text-left dark:border-pink-900 dark:bg-pink-950/40">
      <div class="h-10 w-1 flex-none rounded-full bg-pink-500"></div>
      <div class="min-w-0 flex-1">
        <p class="truncate text-xs font-black text-pink-700 dark:text-pink-200">Replying to ${escapeHtml(replyingTo.senderName || "message")}</p>
        <p class="truncate text-sm font-semibold text-slate-600 dark:text-slate-300">${escapeHtml(replyingTo.text || "Message")}</p>
      </div>
      <button type="button" onclick="window.cancelReply()" title="Cancel reply" class="flex h-9 w-9 flex-none items-center justify-center rounded-lg text-slate-500 transition hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white">
        <i class="fas fa-xmark"></i>
      </button>
    </div>
  `;
}

function clearReply() {
  replyingTo = null;
  renderReplyPreview();
}

function currentReplyPayload() {
  if (!replyingTo) return {};

  return {
    replyTo: {
      id: replyingTo.id,
      senderId: replyingTo.senderId,
      senderName: replyingTo.senderName,
      text: replyingTo.text,
      chatType: replyingTo.chatType
    }
  };
}

function activeMessagesRef() {
  if (activeChat.type === "private" && activeChat.userId) {
    const threadId = getPrivateThreadId(currentUser.uid, activeChat.userId);
    return collection(db, `privateThreads/${threadId}/messages`);
  }

  if (activeChat.type === "group" && activeChat.groupId) {
    return collection(db, `groups/${activeChat.groupId}/messages`);
  }

  return collection(db, `families/${currentFamilyId}/messages`);
}

async function writeMessage(payload) {
  if (!currentUser) return;

  if (activeChat.type === "private" && activeChat.userId) {
    const threadId = getPrivateThreadId(currentUser.uid, activeChat.userId);
    await setDoc(doc(db, "privateThreads", threadId), {
      participants: [currentUser.uid, activeChat.userId],
      participantNames: {
        [currentUser.uid]: getDisplayName(),
        [activeChat.userId]: activeChat.userName
      },
      updatedAt: serverTimestamp()
    }, { merge: true });
  }

  if (activeChat.type === "group" && activeChat.groupId) {
    await updateDoc(doc(db, "groups", activeChat.groupId), {
      lastMessage: payload.text || "New message",
      lastMessageBy: getDisplayName(),
      updatedAt: serverTimestamp()
    });
  }

  await addDoc(activeMessagesRef(), {
    senderId: currentUser.uid,
    senderName: getDisplayName(),
    timestamp: serverTimestamp(),
    chatType: activeChat.type,
    ...payload
  });
}

function setActiveHeader() {
  const isPrivate = activeChat.type === "private";
  const isGroup = activeChat.type === "group";
  els.currentAvatar.textContent = initials(activeChat.userName);
  els.currentName.textContent = activeChat.userName;
  els.currentStatus.textContent = isGroup ? "Group chat" : isPrivate ? "Private message" : "Family room";
  els.messageInput.placeholder = isGroup
    ? `Message ${activeChat.userName}...`
    : isPrivate
    ? `Message ${activeChat.userName} privately...`
    : "Message the family...";
  if (els.groupInviteBtn) {
    els.groupInviteBtn.classList.toggle('hidden', !isGroup);
    els.groupInviteBtn.classList.toggle('flex', isGroup);
  }
}

function setupActiveMessages() {
  if (activeMessagesUnsubscribe) activeMessagesUnsubscribe();

  setActiveHeader();
  const q = query(activeMessagesRef(), orderBy("timestamp", "asc"));
  activeMessagesUnsubscribe = onSnapshot(q, (snapshot) => {
    messages = snapshot.docs.map(messageDoc => ({ id: messageDoc.id, ...messageDoc.data() }));
    renderMessages();
  }, () => {
    showToast("Could not load this conversation");
  });
}

function setupFamilyMembers() {
  if (familyMembersUnsubscribe) familyMembersUnsubscribe();

  const q = query(collection(db, `families/${currentFamilyId}/members`), orderBy("name", "asc"));
  familyMembersUnsubscribe = onSnapshot(q, (snapshot) => {
    const savedMembers = snapshot.docs.map(memberDoc => ({ uid: memberDoc.id, ...memberDoc.data() }));
    const currentMemberIds = new Set(savedMembers.map(member => member.uid));
    const demoMembers = fallbackMembers.filter(member => member.uid !== currentUser?.uid && !currentMemberIds.has(member.uid));

    familyMembers = [
      ...savedMembers.filter(member => member.uid !== currentUser?.uid),
      ...demoMembers
    ];

    renderFamilyList();
  });
}

function setupGroups() {
  if (groupsUnsubscribe) groupsUnsubscribe();
  if (!currentUser) return;

  const q = query(collection(db, "groups"), where("memberIds", "array-contains", currentUser.uid));
  groupsUnsubscribe = onSnapshot(q, (snapshot) => {
    groups = snapshot.docs
      .map(groupDoc => ({ id: groupDoc.id, ...groupDoc.data() }))
      .sort((a, b) => {
        const aTime = a.updatedAt?.toMillis?.() || 0;
        const bTime = b.updatedAt?.toMillis?.() || 0;
        return bTime - aTime;
      });
    renderFamilyList();
  }, () => {
    showToast("Could not load groups");
  });
}

async function saveCurrentMember() {
  if (!currentUser) return;

  await setDoc(doc(db, `families/${currentFamilyId}/members`, currentUser.uid), {
    uid: currentUser.uid,
    name: getDisplayName(),
    email: currentUser.email || "",
    photoURL: currentUser.photoURL || "",
    lastSeen: serverTimestamp()
  }, { merge: true });
}

function renderFamilyList() {
  const groupRows = groups.map(group => {
    const groupName = escapeHtml(group.name || "Group chat");
    const active = activeChat.type === "group" && activeChat.groupId === group.id;
    const memberCount = Array.isArray(group.memberIds) ? group.memberIds.length : 1;
    return `
      <div class="family-member flex w-full items-center gap-2 rounded-xl px-3 py-3 ${active ? 'bg-pink-50 text-pink-700 dark:bg-pink-950 dark:text-pink-200' : 'text-slate-700 dark:text-slate-200'}">
        <button type="button"
                class="flex min-w-0 flex-1 items-center gap-3 text-left"
                data-action="open-group"
                data-group-id="${escapeHtml(group.id)}">
          <span class="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-sky-100 text-sm font-black text-sky-700 dark:bg-sky-950 dark:text-sky-200">${initials(group.name || "G")}</span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-black">${groupName}</span>
            <span class="block truncate text-xs font-semibold text-slate-400">${memberCount} member${memberCount === 1 ? '' : 's'}</span>
          </span>
        </button>
        <button type="button" data-action="show-group-invite" data-group-id="${escapeHtml(group.id)}" class="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-pink-500 transition hover:bg-pink-50 dark:hover:bg-pink-950" title="Invite">
          <i class="fas fa-user-plus text-xs"></i>
        </button>
      </div>
    `;
  }).join("");

  const privateRows = familyMembers.map(member => {
    const memberName = escapeHtml(member.name || member.email || "Family member");
    const active = activeChat.type === "private" && activeChat.userId === member.uid;
    return `
      <button type="button"
              class="family-member flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left ${active ? 'bg-pink-50 text-pink-700 dark:bg-pink-950 dark:text-pink-200' : 'text-slate-700 dark:text-slate-200'}"
              data-action="open-private"
              data-user-id="${escapeHtml(member.uid)}"
              data-user-name="${memberName}">
        <span class="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-slate-100 text-sm font-black text-slate-700 dark:bg-slate-800 dark:text-slate-200">${initials(member.name || member.email)}</span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm font-black">${memberName}</span>
          <span class="block truncate text-xs font-semibold text-slate-400">Private message</span>
        </span>
        <i class="fas fa-comment-dots text-xs text-pink-500"></i>
      </button>
    `;
  }).join("");

  els.familyList.innerHTML = `
    <button type="button"
            class="family-member mb-3 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left ${activeChat.type === 'family' ? 'bg-pink-50 text-pink-700 dark:bg-pink-950 dark:text-pink-200' : 'text-slate-700 dark:text-slate-200'}"
            data-action="open-family">
      <span class="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-pink-100 text-sm font-black text-pink-700 dark:bg-pink-950 dark:text-pink-200">T</span>
      <span class="min-w-0 flex-1">
        <span class="block truncate text-sm font-black">Family chat</span>
        <span class="block truncate text-xs font-semibold text-slate-400">Everyone together</span>
      </span>
      <i class="fas fa-users text-xs text-pink-500"></i>
    </button>
    <div class="mb-2 flex items-center justify-between px-3 pt-2">
      <span class="text-xs font-black uppercase tracking-normal text-slate-400">Groups</span>
      <span class="flex gap-1">
        <button type="button" data-action="open-create-group-modal" class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-pink-600 dark:text-slate-300 dark:hover:bg-slate-800" title="Create group">
          <i class="fas fa-plus text-xs"></i>
        </button>
        <button type="button" data-action="open-join-invite-modal" class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-pink-600 dark:text-slate-300 dark:hover:bg-slate-800" title="Join with invite">
          <i class="fas fa-link text-xs"></i>
        </button>
      </span>
    </div>
    ${groupRows || '<div class="px-3 py-4 text-sm font-semibold text-slate-400">No groups yet</div>'}
    <div class="mb-2 px-3 pt-2 text-xs font-black uppercase tracking-normal text-slate-400">Private messages</div>
    ${privateRows || '<div class="px-3 py-6 text-sm font-semibold text-slate-400">No contacts yet</div>'}
  `;
}

function renderMessages() {
  if (!messages.length) {
    els.messages.innerHTML = `
      <div class="flex h-full items-center justify-center text-center">
        <div>
          <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-pink-100 text-pink-600 dark:bg-pink-950 dark:text-pink-200">
            <i class="fas ${activeChat.type === 'private' ? 'fa-user-lock' : activeChat.type === 'group' ? 'fa-user-group' : 'fa-comments'} text-xl"></i>
          </div>
          <p class="mt-4 text-sm font-black text-slate-700 dark:text-slate-200">${activeChat.type === 'private' ? 'Start a private message' : activeChat.type === 'group' ? 'Start the group chat' : 'Start the family chat'}</p>
          <p class="mt-1 text-sm font-semibold text-slate-400">Messages you send here stay in this conversation.</p>
        </div>
      </div>
    `;
    return;
  }

  els.messages.innerHTML = messages.map(msg => {
    const isMine = msg.senderId === currentUser?.uid;
    const senderName = escapeHtml(msg.senderName || "Family member");
    const timeValue = msg.timestamp?.toDate?.() || msg.timestamp || new Date();
    const sentTime = new Date(timeValue).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isMenuOpen = openActionMenuId === msg.id;
    const canPrivateReply = !isMine && msg.senderId;
    const canReply = Boolean(msg.id);
    const replyTo = msg.replyTo;

    return `
      <div class="flex ${isMine ? 'justify-end' : 'justify-start'} group">
        <div class="max-w-[82%] sm:max-w-[70%]">
          <div class="mb-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 ${isMine ? 'justify-end' : 'justify-start'}">
            <span>${senderName}</span>
            ${activeChat.type === 'private' ? '<span class="rounded-full bg-pink-50 px-2 py-0.5 text-[0.68rem] font-black text-pink-600 dark:bg-pink-950 dark:text-pink-200">PRIVATE</span>' : ''}
          </div>

          <div class="message-bubble rounded-2xl px-4 py-3 shadow-sm ${isMine ? 'bg-pink-600 text-white' : 'border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'}">
            ${replyTo ? `
              <div class="mb-2 rounded-xl border-l-4 px-3 py-2 ${isMine ? 'border-white/60 bg-white/15 text-white/90' : 'border-pink-300 bg-pink-50 text-slate-600 dark:border-pink-700 dark:bg-pink-950/40 dark:text-slate-200'}">
                <p class="truncate text-xs font-black">${escapeHtml(replyTo.senderName || "Message")}</p>
                <p class="truncate text-xs font-semibold opacity-90">${escapeHtml(replyTo.text || "Message")}</p>
              </div>
            ` : ''}
            ${msg.text ? `<p class="whitespace-pre-wrap text-sm font-medium leading-6">${escapeHtml(msg.text)}</p>` : ''}
            ${msg.image ? `<img src="${msg.image}" alt="Shared image" class="mt-3 max-h-80 w-full rounded-xl object-cover">` : ''}
            ${msg.audio ? `<audio controls src="${msg.audio}" class="mt-3 w-full"></audio>` : ''}
          </div>

          <div class="relative mt-1 flex items-center gap-2 text-xs text-slate-400 ${isMine ? 'justify-end' : 'justify-start'}">
            <span>${sentTime}</span>
            <button type="button" data-action="toggle-favorite" data-id="${escapeHtml(msg.id)}" class="rounded-md px-1 transition hover:text-pink-500" title="Favorite">
              <i class="${favorites.includes(msg.id) ? 'fas' : 'far'} fa-heart"></i>
            </button>
            <button type="button" data-action="toggle-message-menu" data-id="${escapeHtml(msg.id)}" class="rounded-md px-1 transition hover:text-slate-700 dark:hover:text-white" title="More actions">
              <i class="fas fa-ellipsis-vertical"></i>
            </button>

            ${isMenuOpen ? `
              <div class="absolute ${isMine ? 'right-0' : 'left-0'} top-7 z-30 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white py-2 text-left text-sm font-semibold text-slate-700 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                ${canReply ? `<button type="button" data-action="reply-message" data-id="${escapeHtml(msg.id)}" class="flex w-full items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800"><i class="fas fa-reply w-5"></i><span>Reply</span></button>` : ''}
                ${canPrivateReply ? `<button type="button" data-action="add-contact" data-user-id="${escapeHtml(msg.senderId)}" data-user-name="${senderName}" class="flex w-full items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800"><i class="fas fa-user-plus w-5"></i><span>Add to contacts</span></button>` : ''}
                ${canPrivateReply ? `<button type="button" data-action="open-private" data-user-id="${escapeHtml(msg.senderId)}" data-user-name="${senderName}" class="flex w-full items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800"><i class="far fa-comment w-5"></i><span>Message ${senderName}</span></button>` : ''}
                <button type="button" data-action="translate" data-id="${escapeHtml(msg.id)}" class="flex w-full items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800"><i class="fas fa-language w-5"></i><span>Translate</span></button>
                <button type="button" data-action="report" data-id="${escapeHtml(msg.id)}" class="flex w-full items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800"><i class="fas fa-triangle-exclamation w-5"></i><span>Report</span></button>
                ${isMine ? `<button type="button" data-action="delete-message" data-id="${escapeHtml(msg.id)}" class="flex w-full items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"><i class="far fa-trash-can w-5"></i><span>Delete</span></button>` : ''}
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  els.messages.scrollTop = els.messages.scrollHeight;
}

async function translateText(text) {
  const targetLanguage = navigator.language.split("-")[0] || "en";
  const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${targetLanguage}`);
  const data = await response.json();
  return data.responseData?.translatedText || text;
}

async function addContact(userId, userName) {
  await setDoc(doc(db, `families/${currentFamilyId}/members`, userId), {
    uid: userId,
    name: userName,
    addedBy: currentUser.uid,
    addedAt: serverTimestamp()
  }, { merge: true });
  showToast(`${userName} added to contacts`);
}

async function findGroupByInviteCode(code) {
  const normalizedCode = normalizeInviteCode(code);
  if (!normalizedCode) return null;

  const inviteQuery = query(collection(db, "groups"), where("inviteCode", "==", normalizedCode));
  const snapshot = await getDocs(inviteQuery);
  const groupDoc = snapshot.docs[0];
  return groupDoc ? { id: groupDoc.id, ...groupDoc.data() } : null;
}

async function createUniqueInviteCode() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateInviteCode();
    const existingGroup = await findGroupByInviteCode(code);
    if (!existingGroup) return code;
  }
  return generateInviteCode();
}

function closeModal(id) {
  document.getElementById(id)?.classList.add('hidden');
}

function openModal(id) {
  document.getElementById(id)?.classList.remove('hidden');
}

function resetModalForms() {
  document.getElementById('create-group-form')?.reset();
  document.getElementById('join-invite-form')?.reset();
}

window.openPrivateChat = (userId, userName) => {
  if (!currentUser || !userId || userId === currentUser.uid) return;
  activeChat = { type: "private", userId, userName: userName || "Private chat" };
  openActionMenuId = null;
  clearReply();
  setupActiveMessages();
  renderFamilyList();
  showToast(`Private chat with ${activeChat.userName}`);
};

window.openGroupChat = (groupId) => {
  const group = groups.find(groupItem => groupItem.id === groupId);
  if (!currentUser || !group) return;

  activeChat = { type: "group", groupId, userName: group.name || "Group chat" };
  openActionMenuId = null;
  clearReply();
  setupActiveMessages();
  renderFamilyList();
  showToast(`Group chat: ${activeChat.userName}`);
};

window.openFamilyChat = () => {
  activeChat = { type: "family", userId: null, userName: "Family" };
  openActionMenuId = null;
  clearReply();
  setupActiveMessages();
  renderFamilyList();
};

window.openCreateGroupModal = () => {
  resetModalForms();
  openModal('create-group-modal');
  setTimeout(() => document.getElementById('group-name-input')?.focus(), 0);
};

window.openJoinInviteModal = () => {
  resetModalForms();
  openModal('join-invite-modal');
  setTimeout(() => document.getElementById('invite-code-input')?.focus(), 0);
};

window.closeGroupModal = closeModal;

window.startReply = (id) => {
  const msg = messages.find(message => message.id === id);
  if (!msg) return;

  replyingTo = {
    id: msg.id,
    senderId: msg.senderId || "",
    senderName: msg.senderName || "Family member",
    text: messagePreviewText(msg),
    chatType: activeChat.type
  };
  openActionMenuId = null;
  renderMessages();
  renderReplyPreview();
  els.messageInput.focus();
};

window.cancelReply = clearReply;

window.createGroupFromForm = async (event) => {
  event.preventDefault();
  if (!currentUser) return;

  const input = document.getElementById('group-name-input');
  const name = input.value.trim();
  if (!name) {
    showToast("Group name is required");
    return;
  }

  const submit = event.submitter;
  if (submit) submit.disabled = true;

  try {
    const inviteCode = await createUniqueInviteCode();
    const groupRef = doc(collection(db, "groups"));
    const group = {
      id: groupRef.id,
      name,
      createdBy: currentUser.uid,
      createdByName: getDisplayName(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      inviteCode,
      memberIds: [currentUser.uid],
      memberNames: {
        [currentUser.uid]: getDisplayName()
      }
    };

    await setDoc(groupRef, group);
    groups = [{ ...group, createdAt: new Date(), updatedAt: new Date() }, ...groups];
    closeModal('create-group-modal');
    window.openGroupChat(groupRef.id);
    window.showGroupInvite(groupRef.id);
    showToast(`${name} created`);
  } catch (error) {
    showToast(error.message || "Could not create group");
  } finally {
    if (submit) submit.disabled = false;
  }
};

window.joinGroupByInvite = async (eventOrCode) => {
  if (eventOrCode?.preventDefault) eventOrCode.preventDefault();
  if (!currentUser) return;

  const code = normalizeInviteCode(
    typeof eventOrCode === "string"
      ? eventOrCode
      : document.getElementById('invite-code-input')?.value || ""
  );

  if (!code) {
    showToast("Enter an invite code");
    return;
  }

  const submit = eventOrCode?.submitter;
  if (submit) submit.disabled = true;

  try {
    const group = await findGroupByInviteCode(code);
    if (!group) {
      showToast("Invite not found");
      return;
    }

    await setDoc(doc(db, "groups", group.id), {
      memberIds: arrayUnion(currentUser.uid),
      memberNames: {
        [currentUser.uid]: getDisplayName()
      },
      updatedAt: serverTimestamp()
    }, { merge: true });

    const joinedGroup = {
      ...group,
      memberIds: Array.from(new Set([...(group.memberIds || []), currentUser.uid]))
    };
    groups = [joinedGroup, ...groups.filter(groupItem => groupItem.id !== group.id)];
    closeModal('join-invite-modal');
    window.openGroupChat(group.id);
    showToast(`Joined ${group.name || "group chat"}`);
  } catch (error) {
    showToast(error.message || "Could not join group");
  } finally {
    if (submit) submit.disabled = false;
  }
};

window.showGroupInvite = async (groupId = activeChat.groupId) => {
  let group = groups.find(groupItem => groupItem.id === groupId);
  if (!currentUser || !group) return;

  if (!group.inviteCode) {
    group.inviteCode = await createUniqueInviteCode();
    await updateDoc(doc(db, "groups", group.id), {
      inviteCode: group.inviteCode,
      updatedAt: serverTimestamp()
    });
  }

  document.getElementById('invite-group-name').textContent = group.name || "Group chat";
  document.getElementById('invite-code-display').value = group.inviteCode;
  document.getElementById('invite-link-display').value = inviteLinkFor(group.inviteCode);
  openModal('group-invite-modal');
};

window.copyGroupInvite = async (targetId) => {
  const input = document.getElementById(targetId);
  if (!input) return;

  input.select();
  input.setSelectionRange(0, input.value.length);
  try {
    await navigator.clipboard.writeText(input.value);
    showToast("Invite copied");
  } catch (_) {
    document.execCommand("copy");
    showToast("Invite copied");
  }
};

window.sendMessage = async () => {
  const text = els.messageInput.value.trim();
  if (!text) return;

  await writeMessage({ text, ...currentReplyPayload() });
  els.messageInput.value = "";
  clearReply();
};

window.triggerImageUpload = () => document.getElementById('image-upload').click();

window.handleImageUpload = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  showToast("Uploading image...");

  const reader = new FileReader();
  reader.onload = async (readerEvent) => {
    try {
      await writeMessage({
        text: "Shared a photo",
        image: readerEvent.target.result,
        ...currentReplyPayload()
      });
      clearReply();
      showToast("Image sent");
    } catch (_) {
      showToast("Image failed to send");
    }
  };
  reader.readAsDataURL(file);
  event.target.value = "";
};

window.startVoiceRecording = async () => {
  const btn = document.getElementById('voice-btn');

  if (!isRecording) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      mediaRecorder.ondataavailable = event => audioChunks.push(event.data);
      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = async () => {
          await writeMessage({
            audio: reader.result,
            text: "Voice message",
            ...currentReplyPayload()
          });
          clearReply();
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      isRecording = true;
      btn.classList.add('text-red-600', 'animate-pulse');
      btn.innerHTML = '<i class="fas fa-stop"></i>';
      els.recordingStatus.textContent = "Recording...";
    } catch (_) {
      showToast("Microphone access is needed");
    }
  } else {
    mediaRecorder.stop();
    isRecording = false;
    btn.classList.remove('text-red-600', 'animate-pulse');
    btn.innerHTML = '<i class="fas fa-microphone text-2xl"></i>';
    els.recordingStatus.textContent = "";
  }
};

window.startVideoCall = async () => {
  const modal = document.getElementById('video-call-modal');
  const localVideo = document.getElementById('local-video');
  const callName = document.getElementById('call-target-name');
  const callStatus = document.getElementById('call-status-text');

  modal.classList.remove('hidden');
  callName.textContent = activeChat.type === "private"
    ? activeChat.userName
    : activeChat.type === "group"
    ? `${activeChat.userName} video call`
    : "Family video call";
  callStatus.textContent = "Starting camera...";

  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
    callSeconds = 0;
    callStatus.textContent = activeChat.type === "private"
      ? "Private call active"
      : activeChat.type === "group"
      ? "Group call active"
      : "Family call active";

    await addDoc(collection(db, `families/${currentFamilyId}/calls`), {
      startedBy: currentUser.uid,
      startedByName: getDisplayName(),
      targetType: activeChat.type,
      targetUserId: activeChat.userId || null,
      targetName: activeChat.userName,
      status: "started",
      startedAt: serverTimestamp()
    });

    callTimer = setInterval(() => {
      callSeconds += 1;
      const minutes = String(Math.floor(callSeconds / 60)).padStart(2, "0");
      const seconds = String(callSeconds % 60).padStart(2, "0");
      document.getElementById('call-timer').textContent = `${minutes}:${seconds}`;
    }, 1000);
  } catch (_) {
    showToast("Camera and microphone access are needed");
    window.endVideoCall();
  }
};

window.endVideoCall = () => {
  const modal = document.getElementById('video-call-modal');
  const localVideo = document.getElementById('local-video');

  modal.classList.add('hidden');
  if (localVideo) localVideo.srcObject = null;
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  if (callTimer) clearInterval(callTimer);
  callTimer = null;
  document.getElementById('call-timer').textContent = "00:00";
};

window.toggleMute = () => {
  if (!localStream) return;
  const audioTrack = localStream.getAudioTracks()[0];
  if (!audioTrack) return;
  audioTrack.enabled = !audioTrack.enabled;
  document.getElementById('mute-btn').classList.toggle('bg-white/20', !audioTrack.enabled);
};

window.toggleCamera = () => {
  if (!localStream) return;
  const videoTrack = localStream.getVideoTracks()[0];
  if (!videoTrack) return;
  videoTrack.enabled = !videoTrack.enabled;
  document.getElementById('camera-btn').classList.toggle('bg-white/20', !videoTrack.enabled);
};

window.toggleFavorite = (id) => {
  favorites = favorites.includes(id)
    ? favorites.filter(favoriteId => favoriteId !== id)
    : [...favorites, id];
  saveFavorites();
  renderMessages();
};

window.translateMessage = async (id) => {
  const msg = messages.find(message => message.id === id);
  if (!msg?.text) return;

  try {
    const translated = await translateText(msg.text);
    showToast(`Translated: ${translated}`);
  } catch (_) {
    showToast("Translation failed");
  }
};

window.deleteMessage = async (id) => {
  await deleteDoc(doc(activeMessagesRef(), id));
  showToast("Message deleted");
};

window.toggleDarkMode = () => {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('titi-theme', isDark ? 'dark' : 'light');
};

window.toggleEmojiPicker = () => {
  document.getElementById('emoji-picker').classList.toggle('hidden');
};

window.addEmoji = (emoji) => {
  els.messageInput.value += emoji;
  els.messageInput.focus();
};

window.toggleAuthMode = () => {
  isSignup = !isSignup;
  document.getElementById('auth-mode-label').textContent = isSignup ? "Create your Titi account" : "Log in to Titi";
  document.getElementById('auth-subtitle').textContent = isSignup ? "Set up your family chat profile." : "Use your family account to continue.";
  document.getElementById('auth-switch-text').textContent = isSignup ? "Already have an account?" : "Need an account?";
  document.getElementById('auth-toggle').textContent = isSignup ? "Log in" : "Sign up";
  document.getElementById('auth-submit').textContent = isSignup ? "Create account" : "Log in";
  document.getElementById('auth-name').classList.toggle('hidden', !isSignup);
};

window.togglePasswordVisibility = () => {
  const password = document.getElementById('auth-password');
  const icon = document.getElementById('auth-password-icon');
  const showPassword = password.type === "password";
  password.type = showPassword ? "text" : "password";
  icon.className = showPassword ? "fas fa-eye-slash" : "fas fa-eye";
};

window.handleEmailAuth = async (event) => {
  event.preventDefault();
  const name = document.getElementById('auth-name').value.trim();
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const submit = document.getElementById('auth-submit');

  submit.disabled = true;
  try {
    if (isSignup) {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      if (name) await updateProfile(credential.user, { displayName: name });
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
  } catch (error) {
    showToast(error.message || "Authentication failed");
  } finally {
    submit.disabled = false;
  }
};

window.signInWithGoogle = async () => {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    showToast(error.message || "Google sign-in failed");
  }
};

window.logout = () => signOut(auth);

window.showToast = showToast;

function showToast(message) {
  const root = document.getElementById('toast-root');
  const toast = document.createElement('div');
  toast.className = 'toast rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-2xl dark:bg-white dark:text-slate-950';
  toast.textContent = message;
  root.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast-visible'));
  setTimeout(() => {
    toast.classList.remove('toast-visible');
    setTimeout(() => toast.remove(), 200);
  }, 2600);
}

document.addEventListener('click', async (event) => {
  const actionTarget = event.target.closest('[data-action]');
  if (!actionTarget) {
    if (openActionMenuId) {
      openActionMenuId = null;
      renderMessages();
    }
    return;
  }

  const { action, id, userId, userName, groupId } = actionTarget.dataset;

  if (action === "toggle-message-menu") {
    openActionMenuId = openActionMenuId === id ? null : id;
    renderMessages();
    return;
  }

  openActionMenuId = null;

  if (action === "open-family") window.openFamilyChat();
  if (action === "open-group") window.openGroupChat(groupId);
  if (action === "show-group-invite") await window.showGroupInvite(groupId);
  if (action === "open-create-group-modal") window.openCreateGroupModal();
  if (action === "open-join-invite-modal") window.openJoinInviteModal();
  if (action === "reply-message") window.startReply(id);
  if (action === "open-private") window.openPrivateChat(userId, userName);
  if (action === "add-contact") await addContact(userId, userName);
  if (action === "toggle-favorite") window.toggleFavorite(id);
  if (action === "translate") window.translateMessage(id);
  if (action === "delete-message") window.deleteMessage(id);
  if (action === "report") showToast("Message reported");
});

els.messageInput.addEventListener('keydown', (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    window.sendMessage();
  }
});

onAuthStateChanged(auth, async (user) => {
  if (activeMessagesUnsubscribe) activeMessagesUnsubscribe();
  if (familyMembersUnsubscribe) familyMembersUnsubscribe();
  if (groupsUnsubscribe) groupsUnsubscribe();

  currentUser = user;
  messages = [];
  groups = [];
  replyingTo = null;
  activeChat = { type: "family", userId: null, userName: "Family" };
  renderReplyPreview();

  if (user) {
    els.authScreen.classList.add('hidden');
    els.mainApp.classList.remove('hidden');
    els.userEmail.textContent = user.email || getDisplayName(user);
    await saveCurrentMember();
    setupFamilyMembers();
    setupGroups();
    setupActiveMessages();

    const inviteCode = getInviteCodeFromUrl();
    if (inviteCode) {
      await window.joinGroupByInvite(inviteCode);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  } else {
    els.authScreen.classList.remove('hidden');
    els.mainApp.classList.add('hidden');
    els.userEmail.textContent = "";
  }
});

console.log("%cTiti chat features ready", "color:#ec4899; font-weight:bold");
