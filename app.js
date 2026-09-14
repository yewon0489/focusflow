import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, setDoc, query, orderBy, getDoc } 
from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } 
from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDuTcliFNf8xknWzB1Y8w6AdSSfxop4_8M",
  authDomain: "focusflow-db-9b872.firebaseapp.com",
  projectId: "focusflow-db-9b872",
  storageBucket: "focusflow-db-9b872.firebasestorage.app",
  messagingSenderId: "125507292387",
  appId: "1:125507292387:web:a4ad3ed445bda83ff289d6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

let currentUser = null;
let currentMode = 'personal'; 
let activeRoomCode = null; 
let currentRoomName = "";

let currentRoomZones = [];
let currentMemoBoardId = 'main';
let roomMemoBoards = [];

const SLOT_BOUNDS = [
  { top: 8, left: 5, width: 35, height: 45 }, { top: 8, left: 50, width: 45, height: 50 },
  { top: 60, left: 25, width: 50, height: 30 }, { top: 60, left: 5, width: 18, height: 30 }, { top: 60, left: 77, width: 18, height: 30 }
];

let allGoalsData = { daily: [], weekly: [], monthly: [], yearly: [] };
let currentModalType = null;
const themes = ['theme-blueprint', 'theme-matrix', 'theme-space'];
let currentThemeIndex = 0;

function getRobotSVG(statusId, uidString) {
  let hash = 0; for (let i = 0; i < uidString.length; i++) { hash = uidString.charCodeAt(i) + ((hash << 5) - hash); }
  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#0ea5e9', '#8b5cf6', '#ec4899'];
  const myColor = colors[Math.abs(hash) % colors.length];
  return `<svg width="56" height="56" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect x="16" y="20" width="32" height="28" fill="${myColor}" rx="6"/><rect x="20" y="24" width="24" height="12" fill="#0f1115" rx="2"/><rect x="24" y="28" width="4" height="4" fill="#4ade80"/><rect x="36" y="28" width="4" height="4" fill="#4ade80"/><rect x="20" y="48" width="6" height="6" fill="#475569" rx="3"/><rect x="38" y="48" width="6" height="6" fill="#475569" rx="3"/></svg>`;
}

setInterval(() => { const now = new Date(); document.getElementById('realtime-clock').textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`; }, 1000);
document.getElementById('btn-login').addEventListener('click', () => signInWithPopup(auth, provider));
document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-dashboard').style.display = 'flex';
    document.getElementById('user-name').textContent = `${user.displayName}님`;
    document.getElementById('user-photo').src = user.photoURL;
    const userEmailForCal = encodeURIComponent(user.email);
    document.getElementById('my-dynamic-calendar').src = `https://calendar.google.com/calendar/embed?src=${userEmailForCal}&ctz=Asia%2FSeoul&bgcolor=%230f1115&color=%234ade80&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=1&showCalendars=0&showTz=0&mode=MONTH`;
    switchMode('personal'); 
  } else {
    currentUser = null;
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('main-dashboard').style.display = 'none';
  }
});

document.getElementById('btn-mode-personal').addEventListener('click', () => switchMode('personal'));
document.getElementById('btn-mode-team').addEventListener('click', () => switchMode('team'));

function switchMode(mode) {
  if (mode === 'personal') {
    document.body.classList.remove('team-mode');
    document.getElementById('btn-mode-personal').classList.add('active');
    document.getElementById('btn-mode-team').classList.remove('active');
    document.getElementById('personal-view').style.display = 'grid';
    document.getElementById('team-lobby').style.display = 'none';
    document.getElementById('team-room-view').style.display = 'none';
    cleanupRoomListeners(); loadPersonalData();
  } else {
    document.body.classList.add('team-mode');
    document.getElementById('btn-mode-personal').classList.remove('active');
    document.getElementById('btn-mode-team').classList.add('active');
    document.getElementById('personal-view').style.display = 'none';
    if (activeRoomCode) document.getElementById('team-room-view').style.display = 'flex';
    else { document.getElementById('team-lobby').style.display = 'flex'; document.getElementById('team-room-view').style.display = 'none'; loadMyJoinedRooms(); }
  }
}

/* === 💡 전역 뽀모도로 타이머 엔진 === */
window.pomoInterval = null;
window.startPomodoro = function(taskText) {
  if (window.pomoInterval) clearInterval(window.pomoInterval);
  let pomoTime = 25 * 60; // 25분 (초 단위)
  const display = document.getElementById('pomodoro-display');
  
  display.style.display = 'block';
  display.style.background = '#4ade80';
  display.style.color = '#0f1115';
  
  window.pomoInterval = setInterval(() => {
    pomoTime--;
    const m = String(Math.floor(pomoTime / 60)).padStart(2, '0');
    const s = String(pomoTime % 60).padStart(2, '0');
    display.textContent = `⏳ ${m}:${s} - ${taskText}`;
    
    if (pomoTime <= 0) {
      clearInterval(window.pomoInterval);
      display.style.background = '#ef4444';
      display.style.color = '#f8fafc';
      display.textContent = `🎉 완료! 5분 휴식하세요.`;
      setTimeout(() => { display.style.display = 'none'; }, 10000);
    }
  }, 1000);
};

/* === 개인 데이터 처리 (신호등 & 뽀모도로 적용) === */
let unsubGoals, unsubPTask;
function loadPersonalData() {
  const userRef = doc(db, "users", currentUser.uid);
  const pMemo = document.getElementById('personal-memo-input');
  onSnapshot(doc(userRef, "data", "memo"), s => { if (s.exists() && document.activeElement !== pMemo) pMemo.value = s.data().content || ''; });
  pMemo.oninput = () => { setTimeout(() => setDoc(doc(userRef, "data", "memo"), { content: pMemo.value }, { merge: true }), 800); };

  if(unsubPTask) unsubPTask();
  unsubPTask = onSnapshot(query(collection(userRef, "tasks"), orderBy("createdAt", "asc")), s => {
    const list = document.getElementById('personal-task-list'); list.innerHTML = '';
    s.forEach(d => {
      const data = d.data();
      const li = document.createElement('li'); 
      li.className = `list-item ${data.completed ? 'completed' : ''}`;
      
      // 💡 마감 시간 신호등 계산 로직
      let timeBadgeHtml = '';
      if (data.deadline && !data.completed) {
        const now = new Date();
        const [dHour, dMin] = data.deadline.split(':').map(Number);
        const deadlineDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), dHour, dMin);
        const diffMs = deadlineDate - now; // 남은 시간(밀리초)
        
        let badgeClass = 'task-normal';
        if (diffMs < 0) badgeClass = 'task-critical'; // 마감시간 지남 (빨강)
        else if (diffMs <= 60 * 60 * 1000) badgeClass = 'task-urgent'; // 1시간 이내 (주황)
        
        timeBadgeHtml = `<span class="task-time-badge ${badgeClass}">${data.deadline}까지</span>`;
      } else if (data.deadline && data.completed) {
        timeBadgeHtml = `<span class="task-time-badge task-normal" style="opacity:0.4;">${data.deadline} (완료)</span>`;
      }

      li.innerHTML = `
        <div class="list-item-content">
          <input type="checkbox" ${data.completed ? 'checked' : ''}>
          <span style="flex:1;">${data.text}</span>
          ${timeBadgeHtml}
        </div>
        <div style="display:flex; align-items:center;">
          ${!data.completed ? `<button class="btn-play-pomodoro" onclick="window.startPomodoro('${data.text}')" title="이 작업 25분 집중하기">▶</button>` : ''}
          <button class="btn-delete" style="padding:0;">삭제</button>
        </div>
      `;
      
      li.querySelector('input').onclick = () => updateDoc(doc(collection(userRef, "tasks"), d.id), { completed: !data.completed });
      li.querySelector('.btn-delete').onclick = () => deleteDoc(doc(collection(userRef, "tasks"), d.id));
      list.appendChild(li);
    });
  });
  
  // 새 개인 할 일 등록 (시간 포함)
  document.getElementById('btn-add-personal-task').onclick = () => {
    const inp = document.getElementById('personal-task-input');
    const timeInp = document.getElementById('personal-task-time');
    if(inp.value.trim()) { 
      addDoc(collection(userRef, "tasks"), { 
        text: inp.value.trim(), 
        completed: false, 
        deadline: timeInp.value || null, // 시간 저장
        createdAt: Date.now() 
      }); 
      inp.value = ''; timeInp.value = '';
    }
  };

  if(unsubGoals) unsubGoals();
  unsubGoals = onSnapshot(query(collection(userRef, "goals"), orderBy("createdAt", "asc")), (snapshot) => {
    allGoalsData = { daily: [], weekly: [], monthly: [], yearly: [] };
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      if(allGoalsData[data.type]) allGoalsData[data.type].push({ id: docSnap.id, ...data });
    });
    ['daily', 'weekly', 'monthly', 'yearly'].forEach(type => {
      const goals = allGoalsData[type]; const total = goals.length; const completed = goals.filter(g => g.completed).length;
      const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
      document.getElementById(`pct-${type}`).textContent = `${percent}%`; document.getElementById(`bar-${type}`).style.width = `${percent}%`;
      const listEl = document.getElementById(`list-${type}`); listEl.innerHTML = '';
      goals.forEach(g => {
        const li = document.createElement('li'); li.className = `quick-goal-item ${g.completed ? 'completed' : ''}`;
        li.innerHTML = `<input type="checkbox" ${g.completed ? 'checked' : ''}><span style="flex:1;">${g.text}</span>`;
        li.querySelector('input').addEventListener('change', () => updateDoc(doc(db, "users", currentUser.uid, "goals", g.id), { completed: !g.completed }));
        listEl.appendChild(li);
      });
    });
    if (currentModalType) renderModalTable(currentModalType);
  });

  const postitContent = document.getElementById('postit-content');
  if (postitContent) {
    onSnapshot(doc(userRef, "data", "postit"), s => { 
      if (s.exists() && document.activeElement !== postitContent) postitContent.value = s.data().text || ''; 
    });
    postitContent.oninput = () => { setTimeout(() => setDoc(doc(userRef, "data", "postit"), { text: postitContent.value }, { merge: true }), 800); };
  }
}

['daily', 'weekly', 'monthly', 'yearly'].forEach(type => {
  const addGoal = () => { const inp = document.getElementById(`input-${type}`); if(inp.value.trim()) { addDoc(collection(db, "users", currentUser.uid, "goals"), { type: type, text: inp.value.trim(), completed: false, createdAt: Date.now() }); inp.value = ''; } };
  document.getElementById(`btn-quick-${type}`).onclick = addGoal; document.getElementById(`input-${type}`).addEventListener('keypress', (e) => { if(e.key === 'Enter') addGoal(); });
});

const typeNames = { daily: '일일 목표', weekly: '주간 목표', monthly: '월간 목표', yearly: '올해 목표' };
document.querySelectorAll('.goal-header').forEach(header => {
  header.addEventListener('click', () => {
    currentModalType = header.dataset.type; document.getElementById('modal-title').textContent = `${typeNames[currentModalType]} 관리 (삭제)`;
    document.getElementById('goal-modal').style.display = 'flex'; renderModalTable(currentModalType);
  });
});
document.getElementById('btn-close-modal').addEventListener('click', () => { document.getElementById('goal-modal').style.display = 'none'; currentModalType = null; });

function renderModalTable(type) {
  const tbody = document.getElementById('modal-goal-tbody'); tbody.innerHTML = '';
  const goals = allGoalsData[type] || [];
  if (goals.length === 0) { tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#64748b; padding:20px;">등록된 목표가 없습니다.</td></tr>`; return; }
  goals.forEach(goal => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="table-check">${goal.completed ? '✅' : '⬜'}</td><td style="${goal.completed ? 'text-decoration: line-through; color: #64748b;' : ''}">${goal.text}</td><td class="table-action"><button class="btn-delete" style="font-size: 16px;" title="삭제">🗑️</button></td>`;
    tr.querySelector('.btn-delete').addEventListener('click', () => deleteDoc(doc(db, "users", currentUser.uid, "goals", goal.id))); tbody.appendChild(tr);
  });
}

/* === 🤝 팁 방 관리 로직 === */
let unsubJoinedRooms, unsubRoomData, unsubRoomUsers, unsubTTask, unsubTMemo;
function cleanupRoomListeners() { if(unsubRoomData) unsubRoomData(); if(unsubRoomUsers) unsubRoomUsers(); if(unsubTTask) unsubTTask(); if(unsubTMemo) unsubTMemo(); }

function loadMyJoinedRooms() {
  if(unsubJoinedRooms) unsubJoinedRooms();
  unsubJoinedRooms = onSnapshot(query(collection(db, "users", currentUser.uid, "joinedRooms"), orderBy("joinedAt", "desc")), (snapshot) => {
    const container = document.getElementById('my-room-list'); const wrapper = document.getElementById('joined-rooms-wrapper'); wrapper.innerHTML = '';
    if(snapshot.empty) container.style.display = 'none';
    else { container.style.display = 'flex'; snapshot.forEach(docSnap => {
        const data = docSnap.data(); const div = document.createElement('div'); div.className = 'room-list-item';
        div.innerHTML = `<span class="room-name">📌 ${data.name}</span><span class="room-code">${docSnap.id}</span>`;
        div.onclick = () => showTeamRoom(docSnap.id); wrapper.appendChild(div);
    });}
  });
}

document.getElementById('btn-create-room').addEventListener('click', async () => {
  const roomName = prompt("생성할 워크스페이스의 이름을 입력하세요."); if(!roomName || !roomName.trim()) return;
  const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const defaultZones = [ { id: 'zone-1', name: '업무/기획 존' }, { id: 'zone-2', name: '회의실' }, { id: 'zone-3', name: '휴게실' } ];
  const defaultMemoBoards = [{ id: 'main', name: '메인 보드' }];
  await setDoc(doc(db, "rooms", newCode), { createdAt: Date.now(), name: roomName.trim(), theme: 'theme-blueprint', createdBy: currentUser.uid, zones: defaultZones, memoBoards: defaultMemoBoards });
  await setDoc(doc(db, "users", currentUser.uid, "joinedRooms", newCode), { name: roomName.trim(), joinedAt: Date.now() });
  showTeamRoom(newCode);
});

document.getElementById('btn-join-room').addEventListener('click', async () => {
  const code = document.getElementById('invite-code-input').value.trim().toUpperCase(); if(!code) return;
  const roomSnap = await getDoc(doc(db, "rooms", code));
  if(roomSnap.exists()) { await setDoc(doc(db, "users", currentUser.uid, "joinedRooms", code), { name: roomSnap.data().name, joinedAt: Date.now() }); showTeamRoom(code); document.getElementById('invite-code-input').value = ''; } 
  else alert("잘못된 초대 코드입니다.");
});

document.getElementById('btn-leave-room').addEventListener('click', () => {
  if(activeRoomCode) deleteDoc(doc(db, "rooms", activeRoomCode, "users", currentUser.uid)); 
  activeRoomCode = null; document.getElementById('team-room-view').style.display = 'none'; document.getElementById('team-lobby').style.display = 'flex'; cleanupRoomListeners(); loadMyJoinedRooms();
});

document.getElementById('btn-edit-room').addEventListener('click', async () => {
  const newName = prompt("변경할 방 이름을 입력하세요:", currentRoomName);
  if(newName && newName.trim() && newName !== currentRoomName) { await updateDoc(doc(db, "rooms", activeRoomCode), { name: newName.trim() }); await updateDoc(doc(db, "users", currentUser.uid, "joinedRooms", activeRoomCode), { name: newName.trim() }); }
});

document.getElementById('btn-change-theme').addEventListener('click', async () => {
  currentThemeIndex = (currentThemeIndex + 1) % themes.length; await updateDoc(doc(db, "rooms", activeRoomCode), { theme: themes[currentThemeIndex] });
});

function showTeamRoom(code) {
  activeRoomCode = code;
  document.getElementById('team-lobby').style.display = 'none';
  document.getElementById('team-room-view').style.display = 'flex';
  document.getElementById('team-memo-input').value = '';
  currentMemoBoardId = 'main';

  unsubRoomData = onSnapshot(doc(db, "rooms", code), (docSnap) => {
    if(docSnap.exists()) {
      const data = docSnap.data();
      currentRoomName = data.name || "방 이름 없음";
      document.getElementById('current-room-code-display').textContent = `${currentRoomName} (${code})`;
      document.getElementById('canvas-area').className = `pixel-canvas ${data.theme || 'theme-blueprint'}`;
      currentThemeIndex = themes.indexOf(data.theme || 'theme-blueprint');
      currentRoomZones = data.zones || []; renderZonesAndStatus();
      roomMemoBoards = data.memoBoards || [{ id: 'main', name: '메인 보드' }]; renderMemoBoardSelector();
    }
  });

  const canvasArea = document.getElementById('canvas-area');
  Array.from(canvasArea.children).forEach(child => { if(child.classList.contains('avatar')) child.remove(); });
  
  unsubRoomUsers = onSnapshot(collection(db, "rooms", code, "users"), (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      const uData = change.doc.data(); const uid = change.doc.id;
      if (change.type === "added") createAvatar(uid, uData.name, uData.status, uData.message);
      if (change.type === "modified") updateAvatar(uid, uData.status, uData.message);
      if (change.type === "removed") { const av = document.getElementById(`avatar-${uid}`); if(av) av.remove(); }
    });
  });

  unsubTTask = onSnapshot(query(collection(db, "rooms", code, "tasks"), orderBy("createdAt", "asc")), s => {
    const tbody = document.getElementById('team-task-list'); 
    if(!tbody) return;
    tbody.innerHTML = '';
    
    let total = 0, progress = 0, done = 0, delayed = 0;

    s.forEach(d => {
      const data = d.data();
      total++;
      if(data.status === '진행중') progress++;
      else if(data.status === '완료') done++;
      else if(data.status === '지연') delayed++;
      else delayed++; 

      const tr = document.createElement('tr');
      
      const tdStatus = document.createElement('td');
      const select = document.createElement('select');
      select.className = `status-select ${data.status || '대기'}`;
      ['대기', '진행중', '완료', '지연'].forEach(st => {
        const opt = document.createElement('option'); opt.value = st; opt.textContent = st;
        if(data.status === st) opt.selected = true;
        select.appendChild(opt);
      });
      select.onchange = (e) => updateDoc(doc(db, "rooms", activeRoomCode, "tasks", d.id), { status: e.target.value });
      tdStatus.appendChild(select);

      const tdName = document.createElement('td');
      tdName.textContent = data.text;
      if(data.status === '완료') { tdName.style.textDecoration = 'line-through'; tdName.style.color = '#64748b'; }

      const tdDate = document.createElement('td');
      const startStr = data.startDate || '?';
      const dueStr = data.dueDate || '?';
      
      if (startStr === '?' && dueStr === '?') { tdDate.textContent = '-'; } 
      else { tdDate.textContent = `${startStr} ~ ${dueStr}`; }

      if (data.dueDate && data.status !== '완료') {
          const today = new Date().toISOString().split('T')[0];
          if (data.dueDate < today) { tdDate.style.color = '#ef4444'; tdDate.style.fontWeight = 'bold'; } 
          else if (data.dueDate === today) { tdDate.style.color = '#f97316'; tdDate.style.fontWeight = 'bold'; } 
      }

      const tdLink = document.createElement('td');
      if(data.link) {
        const a = document.createElement('a');
        let validLink = data.link.startsWith('http') ? data.link : `https://${data.link}`;
        a.href = validLink; a.target = '_blank'; a.className = 'ms-link-btn'; a.innerHTML = '🔗 문서';
        tdLink.appendChild(a);
      } else { tdLink.textContent = '-'; }

      const tdAction = document.createElement('td');
      const delBtn = document.createElement('button');
      delBtn.className = 'btn-delete'; delBtn.textContent = '삭제';
      delBtn.onclick = () => deleteDoc(doc(db, "rooms", activeRoomCode, "tasks", d.id));
      tdAction.appendChild(delBtn);

      tr.appendChild(tdStatus); tr.appendChild(tdName); tr.appendChild(tdDate); tr.appendChild(tdLink); tr.appendChild(tdAction);
      tbody.appendChild(tr);
    });

    if(document.getElementById('ms-total')) {
      document.getElementById('ms-total').textContent = total;
      document.getElementById('ms-progress').textContent = progress;
      document.getElementById('ms-done').textContent = done;
      document.getElementById('ms-delayed').textContent = delayed;
      const pct = total === 0 ? 0 : Math.round((done / total) * 100);
      document.getElementById('ms-percent').textContent = `${pct}%`;
    }
  });
  
  const btnAddTask = document.getElementById('btn-add-team-task');
  if(btnAddTask) {
    btnAddTask.onclick = () => {
      const textInp = document.getElementById('ms-input-text');
      const startDateInp = document.getElementById('ms-input-start-date');
      const dateInp = document.getElementById('ms-input-date');
      const linkInp = document.getElementById('ms-input-link');
      
      if(textInp.value.trim()) { 
        addDoc(collection(db, "rooms", code, "tasks"), { 
          text: textInp.value.trim(), 
          status: '대기',
          startDate: startDateInp.value || '',
          dueDate: dateInp.value || '',
          link: linkInp.value.trim() || '',
          createdAt: Date.now() 
        }); 
        textInp.value = ''; 
        if(startDateInp) startDateInp.value = ''; 
        dateInp.value = ''; linkInp.value = '';
      }
    };
  }
}

function renderZonesAndStatus() {
  const canvasArea = document.getElementById('canvas-area');
  const statusContainer = document.getElementById('dynamic-status-controls');
  Array.from(canvasArea.children).forEach(c => { if(c.classList.contains('zone')) c.remove(); });
  statusContainer.innerHTML = `<span style="color: #94a3b8; font-size: 13px; margin-right: 10px;">구역 이동:</span>`;

  currentRoomZones.forEach((z, index) => {
    const slot = SLOT_BOUNDS[index % SLOT_BOUNDS.length]; 
    const zDiv = document.createElement('div'); zDiv.className = 'zone'; zDiv.innerHTML = `${z.name}`;
    zDiv.style.top = `${slot.top}%`; zDiv.style.left = `${slot.left}%`; zDiv.style.width = `${slot.width}%`; zDiv.style.height = `${slot.height}%`;
    if(currentThemeIndex === 1) { zDiv.style.border = '2px solid #22c55e'; zDiv.style.color = '#4ade80'; zDiv.style.background = 'rgba(22, 101, 52, 0.2)'; }
    else if (currentThemeIndex === 2) { zDiv.style.border = '2px dashed #8b5cf6'; zDiv.style.color = '#c4b5fd'; zDiv.style.background = 'rgba(76, 29, 149, 0.3)'; }
    else { zDiv.style.border = '2px dashed #475569'; zDiv.style.color = '#64748b'; zDiv.style.background = 'rgba(30, 41, 59, 0.4)'; }
    canvasArea.appendChild(zDiv);

    const btn = document.createElement('button'); btn.className = 'btn-status'; btn.dataset.status = z.id; btn.innerHTML = `${z.name}`;
    btn.onclick = () => { 
      document.querySelectorAll('.btn-status').forEach(b => b.classList.remove('active')); 
      btn.classList.add('active'); 
      const currentInput = document.querySelector('.status-input-inline');
      const msg = currentInput ? currentInput.value : '열일중 🔥';
      updateMyStatus(z.id, msg); 
    };
    statusContainer.appendChild(btn);
  });
}

function updateMyStatus(statusType, msg) {
  setDoc(doc(db, "rooms", activeRoomCode, "users", currentUser.uid), { name: currentUser.displayName, status: statusType, message: msg, updatedAt: Date.now() }, { merge: true });
}

function getAvatarCoordinates(statusId, uid) {
  const idx = currentRoomZones.findIndex(z => z.id === statusId);
  const slot = idx !== -1 ? SLOT_BOUNDS[idx % SLOT_BOUNDS.length] : SLOT_BOUNDS[0];
  const offsetTop = (uid.charCodeAt(0) % (slot.height * 2)) - slot.height; 
  const offsetLeft = (uid.charCodeAt(1) % (slot.width * 2)) - slot.width;
  return { top: `calc(${slot.top + slot.height/2}% + ${offsetTop}px)`, left: `calc(${slot.left + slot.width/2}% + ${offsetLeft}px)` };
}

function createAvatar(uid, name, status, message) {
  const coord = getAvatarCoordinates(status, uid);
  const avatarDiv = document.createElement('div'); avatarDiv.id = `avatar-${uid}`; avatarDiv.className = `avatar ${uid === currentUser.uid ? 'active-user' : ''}`;
  avatarDiv.style.top = coord.top; avatarDiv.style.left = coord.left;
  avatarDiv.dataset.status = status;
  
  const isMe = (uid === currentUser.uid);
  const bubble = document.createElement('div'); bubble.className = 'avatar-bubble'; 
  
  if (isMe) {
    bubble.innerHTML = `<input type="text" class="status-input-inline" value="${message || '열일중 🔥'}" placeholder="상태 메시지 입력" />`;
    const inputEl = bubble.querySelector('input');
    inputEl.addEventListener('click', (e) => e.stopPropagation());
    inputEl.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const newMsg = inputEl.value.trim() || '열일중 🔥';
        const currentZoneId = avatarDiv.dataset.status;
        updateMyStatus(currentZoneId, newMsg);
        inputEl.blur();
      }
    });
  } else {
    bubble.textContent = message || '열일중 🔥';
  }

  avatarDiv.addEventListener('mouseenter', () => avatarDiv.classList.add('active')); 
  avatarDiv.addEventListener('mouseleave', () => avatarDiv.classList.remove('active'));

  const body = document.createElement('div'); body.className = 'avatar-body'; body.innerHTML = getRobotSVG(status, uid); 
  const nameTag = document.createElement('div'); nameTag.className = 'avatar-name'; nameTag.textContent = name;
  
  avatarDiv.appendChild(bubble); avatarDiv.appendChild(body); avatarDiv.appendChild(nameTag);
  document.getElementById('canvas-area').appendChild(avatarDiv);
}

function updateAvatar(uid, status, message) {
  const avatarDiv = document.getElementById(`avatar-${uid}`); if(!avatarDiv) return;
  
  avatarDiv.dataset.status = status;
  const coord = getAvatarCoordinates(status, uid);
  avatarDiv.style.top = coord.top; avatarDiv.style.left = coord.left;
  
  const isMe = (uid === currentUser.uid);
  if (isMe) {
    const inputEl = avatarDiv.querySelector('.status-input-inline');
    if (inputEl && document.activeElement !== inputEl) { inputEl.value = message || '열일중 🔥'; }
  } else {
    avatarDiv.querySelector('.avatar-bubble').textContent = message || '열일중 🔥';
  }
  avatarDiv.querySelector('.avatar-body').innerHTML = getRobotSVG(status, uid);
}

/* === 💡 구역(Zone) 편집 모달 로직 === */
let tempZones = [];
document.getElementById('btn-edit-zones').addEventListener('click', () => { 
  tempZones = JSON.parse(JSON.stringify(currentRoomZones));
  document.getElementById('zone-modal').style.display = 'flex'; 
  renderZoneEditList(); 
});
document.getElementById('btn-close-zone-modal').addEventListener('click', () => { document.getElementById('zone-modal').style.display = 'none'; });

function renderZoneEditList() {
  const listDiv = document.getElementById('zone-edit-list'); listDiv.innerHTML = '';
  tempZones.forEach((z, i) => {
    const item = document.createElement('div'); item.className = 'zone-edit-item';
    const inputName = document.createElement('input'); 
    inputName.type = 'text'; inputName.value = z.name; inputName.id = `ze-${i}-name`; 
    inputName.style.flex = '1'; inputName.placeholder = "구역 이름을 입력하세요";
    
    const btnDelete = document.createElement('button'); btnDelete.className = 'btn-delete'; btnDelete.textContent = '삭제';
    btnDelete.addEventListener('click', () => {
      if(tempZones.length <= 1) { alert("최소 1개의 구역은 남겨두어야 합니다."); return; }
      tempZones.splice(i, 1); renderZoneEditList();
    });
    item.appendChild(inputName); item.appendChild(btnDelete); listDiv.appendChild(item);
  });
}

document.getElementById('btn-add-new-zone').addEventListener('click', () => {
  if(tempZones.length >= 5) { alert("구역은 최대 5개까지만 추가할 수 있습니다."); return; }
  tempZones.push({ id: `zone-${Date.now()}`, name: '새로운 구역' }); renderZoneEditList();
});

document.getElementById('btn-save-zones').addEventListener('click', async () => {
  tempZones.forEach((z, i) => { z.name = document.getElementById(`ze-${i}-name`).value.trim() || '이름 없음'; });
  await updateDoc(doc(db, "rooms", activeRoomCode), { zones: tempZones });
  document.getElementById('zone-modal').style.display = 'none';
});

/* === 📢 팀 다중 메모보드 로직 === */
function renderMemoBoardSelector() {
  const selector = document.getElementById('memo-board-selector'); selector.innerHTML = ''; let hasCurrent = false;
  roomMemoBoards.forEach(board => {
    const opt = document.createElement('option'); opt.value = board.id; opt.textContent = board.name; selector.appendChild(opt);
    if(board.id === currentMemoBoardId) hasCurrent = true;
  });
  if(!hasCurrent && roomMemoBoards.length > 0) currentMemoBoardId = roomMemoBoards[0].id;
  selector.value = currentMemoBoardId;
  document.getElementById('btn-delete-memo-board').style.display = (currentMemoBoardId === 'main') ? 'none' : 'block';
  connectMemoBoardListener();
}

document.getElementById('memo-board-selector').addEventListener('change', (e) => {
  currentMemoBoardId = e.target.value; document.getElementById('team-memo-input').value = '';
  document.getElementById('btn-delete-memo-board').style.display = (currentMemoBoardId === 'main') ? 'none' : 'block';
  connectMemoBoardListener();
});

document.getElementById('btn-add-memo-board').addEventListener('click', async () => {
  const name = prompt("새로운 채널 이름을 입력하세요."); if(!name || !name.trim()) return;
  const newBoardId = `memo-${Date.now()}`;
  const newBoards = [...roomMemoBoards, { id: newBoardId, name: name.trim() }];
  await updateDoc(doc(db, "rooms", activeRoomCode), { memoBoards: newBoards }); currentMemoBoardId = newBoardId; 
});

document.getElementById('btn-delete-memo-board').addEventListener('click', async () => {
  if (currentMemoBoardId === 'main') return; 
  if (confirm("이 채널과 작성된 메모를 완전히 삭제하시겠습니까? (복구 불가)")) {
    const newBoards = roomMemoBoards.filter(b => b.id !== currentMemoBoardId);
    await updateDoc(doc(db, "rooms", activeRoomCode), { memoBoards: newBoards });
    await deleteDoc(doc(db, "rooms", activeRoomCode, "memos", currentMemoBoardId)); 
    currentMemoBoardId = 'main'; 
  }
});

function connectMemoBoardListener() {
  if(unsubTMemo) unsubTMemo();
  const tMemo = document.getElementById('team-memo-input');
  unsubTMemo = onSnapshot(doc(db, "rooms", activeRoomCode, "memos", currentMemoBoardId), s => {
    if (s.exists() && document.activeElement !== tMemo) tMemo.value = s.data().content || '';
    else if (!s.exists()) tMemo.value = '';
  });
  tMemo.oninput = () => { setTimeout(() => setDoc(doc(db, "rooms", activeRoomCode, "memos", currentMemoBoardId), { content: tMemo.value }, { merge: true }), 800); };
}

/* === 📝 포스트잇 위젯 드래그 및 토글 로직 === */
const postitWidget = document.getElementById('postit-widget');
const postitHeader = document.getElementById('postit-header');
const btnTogglePostit = document.getElementById('btn-toggle-postit');

if(btnTogglePostit && postitWidget && postitHeader) {
  btnTogglePostit.addEventListener('click', () => {
    postitWidget.style.display = postitWidget.style.display === 'none' ? 'flex' : 'none';
    if (postitWidget.style.display === 'flex') {
      postitWidget.style.top = 'auto'; postitWidget.style.left = 'auto';
      postitWidget.style.bottom = '70px'; postitWidget.style.right = '20px';
    }
  });
  document.getElementById('btn-close-postit').addEventListener('click', () => { postitWidget.style.display = 'none'; });

  let isDragging = false, postitStartX, postitStartY;
  postitHeader.addEventListener('mousedown', (e) => {
    isDragging = true;
    const rect = postitWidget.getBoundingClientRect();
    postitWidget.style.bottom = 'auto'; postitWidget.style.right = 'auto';
    postitWidget.style.left = rect.left + 'px'; postitWidget.style.top = rect.top + 'px';
    postitStartX = e.clientX - rect.left; postitStartY = e.clientY - rect.top;
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    e.preventDefault();
    postitWidget.style.left = `${e.clientX - postitStartX}px`;
    postitWidget.style.top = `${e.clientY - postitStartY}px`;
  });

  document.addEventListener('mouseup', () => { isDragging = false; });
}
