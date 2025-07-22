// Theme toggle
const themeToggle = document.querySelector('.theme-toggle');
if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-theme');
        const isDark = document.body.classList.contains('dark-theme');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        themeToggle.innerHTML = `<i class="fas fa-${isDark ? 'sun' : 'moon'}"></i>`;
    });
}

// Load saved theme
const currentThemeToggle = document.querySelector('.theme-toggle');
if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-theme');
    if (currentThemeToggle) {
        currentThemeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }
}

// Mobile sidebar toggle
const hamburger = document.querySelector('.hamburger');
const sidebar = document.querySelector('.sidebar');
if (hamburger && sidebar) {
    hamburger.addEventListener('click', () => {
        sidebar.classList.toggle('active');
    });
}

// Function to setup profile dropdown (copied from home.js)
function setupProfileDropdown() {
    const userProfileIcon = document.querySelector(
        ".user-profile .fa-user-circle"
    );
    const profileDropdown = document.querySelector(".profile-dropdown");
    if (userProfileIcon && profileDropdown) {
        userProfileIcon.addEventListener("click", (event) => {
            event.stopPropagation();
            const isActive = profileDropdown.classList.toggle("active");
            userProfileIcon.setAttribute("aria-expanded", isActive.toString());
        });
        document.addEventListener("click", (event) => {
            if (
                !userProfileIcon.contains(event.target) &&
                !profileDropdown.contains(event.target) &&
                profileDropdown.classList.contains("active")
            ) {
                profileDropdown.classList.remove("active");
                userProfileIcon.setAttribute("aria-expanded", "false");
            }
        });
    }
}

const helpButton = document.querySelector(".help-button");
if (helpButton) {
    helpButton.addEventListener("click", () =>
        document.getElementById("tutorial-modal").showModal()
    );
}

const getStartedButton = document.getElementById("get-started-button");
if (getStartedButton) {
    getStartedButton.addEventListener("click", () => {
        showTutorial(); // Assuming showTutorial() is defined elsewhere
        const tutorialModal = document.getElementById("tutorial-modal");
        if (tutorialModal && tutorialModal.hasAttribute("open")) {
            tutorialModal.close();
        }
    });
}

function scrollCarousel(containerId, scrollAmount) {
    const container = document.getElementById(containerId);
    if (container) {
        container.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
}

// Save Real-Debrid API Token
const saveRealDebridSettingsButton = document.querySelector('.save-realdebrid-settings');
if (saveRealDebridSettingsButton) {
    saveRealDebridSettingsButton.addEventListener('click', () => {
        const realDebridApiToken = document.getElementById('realdebrid-api-token').value;
        const spinner = document.getElementById('realdebrid-loading');

        if (spinner) {
            spinner.classList.add('active');
            setTimeout(() => {
                spinner.classList.remove('active');
                localStorage.setItem('realDebridApiToken', realDebridApiToken);
                const notification = document.createElement('div');
                notification.className = 'notification success';
                notification.textContent = 'Real-Debrid API Token saved successfully!';
                document.body.appendChild(notification);
                setTimeout(() => notification.remove(), 3000);
            }, 1500);
        }
    });
}

// === INÍCIO: Firebase e Firestore para API Keys ===
let firebaseApp, firebaseAuth, firestore, currentUser;
let doc, setDoc, getDoc, getAuth, onAuthStateChanged;
async function initFirebaseAndAuth() {
  const { initializeApp, getApps } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js");
  const authModule = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js");
  const firestoreModule = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");
  getAuth = authModule.getAuth;
  onAuthStateChanged = authModule.onAuthStateChanged;
  doc = firestoreModule.doc;
  setDoc = firestoreModule.setDoc;
  getDoc = firestoreModule.getDoc;
  const firebaseConfig = {
    apiKey: "AIzaSyCqfBDHkKEsHSzdb5KTvagYwoEk1b3da3o",
    authDomain: "istreambyweb.firebaseapp.com",
    projectId: "istreambyweb",
    storageBucket: "istreambyweb.firebaseapp.com",
    messagingSenderId: "458543632560",
    appId: "1:458543632560:web:1de42763df2d1515316b75",
    measurementId: "G-JWNQKK2ZKW"
  };
  if (!window.firebaseApp) {
    if (!getApps().length) {
      window.firebaseApp = initializeApp(firebaseConfig);
    } else {
      window.firebaseApp = getApps()[0];
    }
  }
  firebaseAuth = getAuth(window.firebaseApp);
  firestore = firestoreModule.getFirestore(window.firebaseApp);
  await new Promise((resolve) => {
    onAuthStateChanged(firebaseAuth, (user) => {
      currentUser = user;
      resolve();
    });
  });
}
async function loadApiKeysFromFirestore() {
  await initFirebaseAndAuth();
  if (!currentUser) return;
  const docRef = doc(firestore, "userApiKeys", currentUser.uid);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    const data = snap.data();
    document.getElementById('tmdb-api-key').value = data.tmdbApiKey || '';
    document.getElementById('realdebrid-api-token').value = data.realDebridApiToken || '';
    document.getElementById('opensubtitles-api-token').value = data.openSubtitlesApiToken || '';
  }
}
async function saveApiKeysToFirestore() {
  await initFirebaseAndAuth();
  if (!currentUser) return;
  const tmdbApiKey = document.getElementById('tmdb-api-key').value.trim();
  const realDebridApiToken = document.getElementById('realdebrid-api-token').value.trim();
  const openSubtitlesApiToken = document.getElementById('opensubtitles-api-token').value.trim();
  const docRef = doc(firestore, "userApiKeys", currentUser.uid);
  await setDoc(docRef, {
    tmdbApiKey,
    realDebridApiToken,
    openSubtitlesApiToken
  });
  const notification = document.createElement('div');
  notification.className = 'notification success';
  notification.textContent = 'API Keys saved successfully!';
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 3000);
}
// === Alternância de tema escuro/claro padronizada ===
function setupThemeToggle() {
    const themeToggleButtons = document.querySelectorAll(".theme-toggle");
    if (!themeToggleButtons.length) return;

    const applyTheme = (theme) => {
        if (theme === "dark") {
            document.body.classList.add("dark-theme");
            themeToggleButtons.forEach(btn => {
                btn.innerHTML = '<i class="fas fa-sun"></i>';
                btn.setAttribute("data-tooltip", "Mudar para tema claro");
            });
        } else {
            document.body.classList.remove("dark-theme");
            themeToggleButtons.forEach(btn => {
                btn.innerHTML = '<i class="fas fa-moon"></i>';
                btn.setAttribute("data-tooltip", "Mudar para tema escuro");
            });
        }
    };

    themeToggleButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const isDark = document.body.classList.toggle("dark-theme");
            const newTheme = isDark ? "dark" : "light";
            localStorage.setItem("theme", newTheme);
            applyTheme(newTheme);
        });
    });

    const savedTheme = localStorage.getItem("theme") || "light";
    applyTheme(savedTheme);
}
// Proteção de autenticação: impede acesso sem login
async function requireAuth() {
    const firebaseConfig = {
        apiKey: "AIzaSyCqfBDHkKEsHSzdb5KTvagYwoEk1b3da3o",
        authDomain: "istreambyweb.firebaseapp.com",
        projectId: "istreambyweb",
        storageBucket: "istreambyweb.firebaseapp.com",
        messagingSenderId: "458543632560",
        appId: "1:458543632560:web:1de42763df2d1515316b75",
        measurementId: "G-JWNQKK2ZKW"
    };
    const { initializeApp, getApps } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js");
    if (!getApps().length) {
        window.firebaseApp = initializeApp(firebaseConfig);
    } else {
        window.firebaseApp = getApps()[0];
    }
    const { getAuth, onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js");
    if (!window.firebaseAuth) {
        window.firebaseAuth = getAuth(firebaseApp);
    }
    return new Promise((resolve) => {
        onAuthStateChanged(window.firebaseAuth, (user) => {
            if (!user) {
                window.location.href = "../index.html";
            } else {
                resolve(user);
            }
        });
    });
}
function logout() {
  import("https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js").then(({ getAuth, signOut }) => {
    const auth = getAuth();
    signOut(auth).then(() => {
      window.location.href = "../index.html";
    });
  });
}
document.addEventListener('DOMContentLoaded', async () => {
    await requireAuth();
    setupThemeToggle();
    await loadApiKeysFromFirestore();
    // Call the setupProfileDropdown function here to initialize the profile dropdown
    setupProfileDropdown();
    // Botão de salvar
    const saveApiKeysButton = document.querySelector('.save-api-keys-settings');
    if (saveApiKeysButton) {
      saveApiKeysButton.addEventListener('click', async () => {
        const spinner = document.getElementById('api-keys-loading');
        if (spinner) spinner.classList.add('active');
        await saveApiKeysToFirestore();
        if (spinner) spinner.classList.remove('active');
      });
    }
});
// === FIM: Firebase e Firestore para API Keys ===