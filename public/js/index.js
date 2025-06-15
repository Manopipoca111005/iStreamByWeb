// js/index.js

// Função para limpar todas as mensagens de erro visíveis
function clearAllAuthMessages() {
    const errorElements = [
        document.getElementById("email-error"),
        document.getElementById("password-error"),
        document.getElementById("signup-email-error"), // Se for implementar signup
        document.getElementById("signup-password-error"), // Se for implementar signup
        document.getElementById("auth-general-error")
    ];
    errorElements.forEach(el => {
        if (el) {
            el.classList.add('hidden');
            el.textContent = ''; // Limpa o texto
        }
    });
}

// Função para exibir mensagens de erro
function showMessage(elementId, message, isError = true) {
    const el = document.getElementById(elementId);
    if (el) {
        el.textContent = message;
        el.classList.remove('hidden');
        if (isError) {
            el.classList.remove('text-green-400');
            el.classList.add('text-red-400');
        } else {
            el.classList.remove('text-red-400');
            el.classList.add('text-green-400');
        }
    } else {
        console.warn(`Element with ID '${elementId}' not found for showing message.`);
    }
}


document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM carregado. Iniciando Firebase…");

    import("https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js")
        .then(({ initializeApp }) => {
            import("https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js")
                .then(({ getAuth, GoogleAuthProvider, GithubAuthProvider, signInWithPopup }) => {
                    // Configuração do Firebase ------------------------------------------------
                    const firebaseConfig = {
                        apiKey: "AIzaSyCqfBDHkKEsHSzdb5KTvagYwoEk1b3da3o",
                        authDomain: "istreambyweb.firebaseapp.com",
                        projectId: "istreambyweb",
                        storageBucket: "istreambyweb.firebasestorage.app",
                        messagingSenderId: "458543632560",
                        appId: "1:458543632560:web:1de42763df2d1515316b75",
                        measurementId: "G-JWNQKK2ZKW"
                    };

                    const app = initializeApp(firebaseConfig);
                    const auth = getAuth(app);
                    auth.languageCode = "en";
                    console.log("Firebase inicializado.");

                    // Google
                    const googleButton = document.getElementById("google-button");
                    const googleProvider = new GoogleAuthProvider();

                    if (googleButton) {
                        googleButton.addEventListener("click", () => {
                            clearAllAuthMessages();
                            console.log("Login Google → popup");
                            signInWithPopup(auth, googleProvider)
                                .then(({ user }) => {
                                    console.log("Google OK:", user.email);
                                    showMessage("auth-general-error", "Login Google bem‑sucedido! Redirecionando…", false);
                                    window.location.href = "pages/home.html";
                                })
                                .catch(err => handleOauthError(err, "Google"));
                        });
                    } else {
                        console.warn("Botão Google (#google-button) não encontrado.");
                    }

                    // GitHub
                    const githubButton = document.getElementById("github-button");
                    const githubProvider = new GithubAuthProvider();

                    if (githubButton) {
                        githubButton.addEventListener("click", () => {
                            clearAllAuthMessages();
                            console.log("Login GitHub → popup");
                            signInWithPopup(auth, githubProvider)
                                .then(({ user }) => {
                                    console.log("GitHub OK:", user.email);
                                    showMessage("auth-general-error", "Login GitHub bem‑sucedido! Redirecionando…", false);
                                    window.location.href = "pages/home.html";
                                })
                                .catch(err => handleOauthError(err, "GitHub"));
                        });
                    } else {
                        console.warn("Botão GitHub (#github-button) não encontrado.");
                    }

                    function handleOauthError(error, providerName) {
                        console.error(`Erro ${providerName}:`, error.code, error.message);
                        let msg = `Falha no login com ${providerName}.`;
                        switch (error.code) {
                            case "auth/popup-closed-by-user":
                                msg = "Login cancelado – a janela foi fechada.";
                                break;
                            case "auth/popup-blocked":
                                msg = "Pop‑up bloqueado. Permita pop‑ups e tente novamente.";
                                break;
                            case "auth/cancelled-popup-request":
                                msg = "Várias janelas abertas. Tente novamente.";
                                break;
                            case "auth/account-exists-with-different-credential":
                                msg = "Já existe uma conta com este email usando outro método.";
                                break;
                        }
                        showMessage("auth-general-error", msg);
                    }
                })
                .catch(err => {
                    console.error("Falha ao carregar Firebase Auth:", err);
                    showMessage("auth-general-error", "Não foi possível carregar autenticação.");
                });
        })
        .catch(err => {
            console.error("Falha ao carregar Firebase App SDK:", err);
            showMessage("auth-general-error", "Erro ao carregar recursos principais.");
        });
});
