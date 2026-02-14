// AJUSTE IMPORTANTE: O Ingress do backend está configurado como path: /auth
const API_AUTH = "/auth"; 

// --- Gerenciamento de UI (Alternar Telas) ---
document.addEventListener("DOMContentLoaded", () => {
    // Verifica se já está logado
    if (localStorage.getItem("token")) {
        window.location.href = "index.html";
        return;
    }

    const loginContainer = document.getElementById("loginContainer");
    const signupContainer = document.getElementById("signupContainer");
    const feedbackMsg = document.getElementById("feedbackMsg");

    // Alternar para Cadastro
    document.getElementById("linkToSignup").addEventListener("click", (e) => {
        e.preventDefault();
        loginContainer.classList.add("d-none");
        signupContainer.classList.remove("d-none");
        clearFeedback();
    });

    // Alternar para Login
    document.getElementById("linkToLogin").addEventListener("click", (e) => {
        e.preventDefault();
        signupContainer.classList.add("d-none");
        loginContainer.classList.remove("d-none");
        clearFeedback();
    });

    // Listener Login
    document.getElementById("loginForm").addEventListener("submit", handleLogin);

    // Listener Cadastro
    document.getElementById("signupForm").addEventListener("submit", handleSignUp);

    function clearFeedback() {
        feedbackMsg.classList.add("d-none");
        feedbackMsg.className = "alert mt-3 text-center d-none";
    }
});

// --- Lógica de Login ---
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;

    showFeedback("Autenticando...", "alert-info");

    try {
        const response = await fetch(`${API_AUTH}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Erro ao fazer login");
        }

        // Sucesso: Salva token e redireciona
        localStorage.setItem("token", data.access_token || data.token);
        window.location.href = "index.html";

    } catch (error) {
        showFeedback(error.message, "alert-danger");
    }
}

// --- Lógica de Cadastro (SignUp) ---
async function handleSignUp(e) {
    e.preventDefault();
    const name = document.getElementById("regName").value;
    const email = document.getElementById("regEmail").value;
    const password = document.getElementById("regPassword").value;
    const confirmPassword = document.getElementById("regConfirmPassword").value;

    // 1. Validação local de senha igual
    if (password !== confirmPassword) {
        showFeedback("As senhas não coincidem!", "alert-warning");
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

        if (!response.ok) {
            // Tenta pegar mensagem de erro específica (ex: senha fraca)
            throw new Error(data.message || "Erro ao criar conta");
        }

        // Sucesso
        showFeedback("Conta criada com sucesso! Faça login.", "alert-success");
        
        // Limpa formulário e volta para login após 2 segundos
        document.getElementById("signupForm").reset();
        setTimeout(() => {
            document.getElementById("linkToLogin").click();
        }, 2000);

    } catch (error) {
        showFeedback(error.message, "alert-danger");
    }
}

function showFeedback(msg, type) {
    const el = document.getElementById("feedbackMsg");
    el.textContent = msg;
    el.className = `alert mt-3 text-center ${type}`; // alert-danger, alert-success, etc
    el.classList.remove("d-none");
}