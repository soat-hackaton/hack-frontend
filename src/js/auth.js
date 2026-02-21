import { API_AUTH } from './utils/api.js';
import { updateGreeting, logout } from './utils/auth.js';
import { clearFeedback, showFeedback } from './utils/ui.js';

document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("token");
    const path = window.location.pathname;

    // Verifica se estamos na página de login (login.html)
    const isLoginPage = path.includes("login.html");

    // =========================================================
    // LÓGICA DE PROTEÇÃO DE ROTAS (O Fim do Loop)
    // =========================================================

    // Cenário 1: Usuário NÃO logado tentando acessar Dashboard
    // Se não tem token e NÃO está no login, chuta para o login.
    if (!token && !isLoginPage) {
        window.location.href = "login.html";
        return; // Para a execução aqui
    }

    // Cenário 2: Usuário LOGADO tentando acessar Login
    // Se tem token e ESTÁ no login, manda para a Dashboard.
    if (token && isLoginPage) {
        window.location.href = "/"; // Manda para a raiz (index.html)
        return; // Para a execução aqui
    }

    // =========================================================
    // INICIALIZAÇÃO DA UI
    // =========================================================

    // Se estamos na página de Login, configura os formulários
    if (isLoginPage) {
        setupLoginUI();
    }

    // Se estamos na Dashboard (tem botão de logout), configura o logout
    const btnLogout = document.getElementById("btnLogout");
    if (btnLogout) {
        btnLogout.addEventListener("click", logout);
        updateGreeting(token);
    }
});

// Configura os botões e formulários da tela de Login
function setupLoginUI() {
    const loginContainer = document.getElementById("loginContainer");
    const signupContainer = document.getElementById("signupContainer");

    // Alternar para Cadastro
    const linkToSignup = document.getElementById("linkToSignup");
    if (linkToSignup) {
        linkToSignup.addEventListener("click", (e) => {
            e.preventDefault();
            loginContainer.classList.add("d-none");
            signupContainer.classList.remove("d-none");
            clearFeedback();
        });
    }

    // Alternar para Login
    const linkToLogin = document.getElementById("linkToLogin");
    if (linkToLogin) {
        linkToLogin.addEventListener("click", (e) => {
            e.preventDefault();
            signupContainer.classList.add("d-none");
            loginContainer.classList.remove("d-none");
            clearFeedback();
        });
    }

    // Submit Login
    const loginForm = document.getElementById("loginForm");
    if (loginForm) loginForm.addEventListener("submit", handleLogin);

    // Submit Cadastro
    const signupForm = document.getElementById("signupForm");
    if (signupForm) signupForm.addEventListener("submit", handleSignUp);
}

// --- Funções Auxiliares ---
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;

    await performLogin(email, password);
}

async function performLogin(email, password) {
    showFeedback("Autenticando...", "alert-info");

    try {
        const response = await fetch(`${API_AUTH}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) throw new Error(data.message || "Erro ao fazer login");

        localStorage.setItem("token", data.access_token || data.token);
        window.location.href = "/";

    } catch (error) {
        showFeedback(error.message, "alert-danger");
    }
}

async function handleSignUp(e) {
    e.preventDefault();
    const name = document.getElementById("regName").value;
    const email = document.getElementById("regEmail").value;
    const password = document.getElementById("regPassword").value;
    const confirmPassword = document.getElementById("regConfirmPassword").value;

    if (password !== confirmPassword) {
        showFeedback("As senhas não coincidem!", "alert-danger"); // Corrigido alert-error para alert-danger do bootstrap
        return;
    }

    showFeedback("Criando conta...", "alert-info");

    try {
        const response = await fetch(`${API_AUTH}/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, password })
        });

        const data = await response.json();

        if (!response.ok) throw new Error(data.message || "Erro ao criar conta");

        showFeedback("Conta criada com sucesso! Entrando...", "alert-success");

        setTimeout(async () => {
            await performLogin(email, password);
        }, 2000);

    } catch (error) {
        showFeedback(error.message, "alert-danger");
    }
}