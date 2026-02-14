// Constantes de API (Como estamos atrás do Kong, usamos caminhos relativos)
const API_AUTH = "/api/auth";

// Verifica se está logado (apenas para páginas protegidas)
function checkAuth() {
    const token = localStorage.getItem("token");
    const isLoginPage = window.location.pathname.includes("login.html");

    if (!token && !isLoginPage) {
        window.location.href = "login.html";
    }
    if (token && isLoginPage) {
        window.location.href = "index.html"; // Ou "/"
    }
    return token;
}

// Login
async function login(email, password) {
    try {
        const response = await fetch(`${API_AUTH}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) throw new Error("Credenciais inválidas");

        const data = await response.json();
        // O backend deve retornar { "access_token": "..." } ou similar
        // Ajuste 'access_token' conforme seu DTO de resposta real
        const token = data.access_token || data.token; 
        
        localStorage.setItem("token", token);
        window.location.href = "index.html";
    } catch (error) {
        const errorMsg = document.getElementById("errorMsg");
        if(errorMsg) {
            errorMsg.textContent = error.message;
            errorMsg.classList.remove("d-none");
        }
    }
}

// Logout
function logout() {
    localStorage.removeItem("token");
    window.location.href = "login.html";
}

// Event Listeners Globais
document.addEventListener("DOMContentLoaded", () => {
    checkAuth();

    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
        loginForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const email = document.getElementById("email").value;
            const pass = document.getElementById("password").value;
            login(email, pass);
        });
    }

    const btnLogout = document.getElementById("btnLogout");
    if (btnLogout) {
        btnLogout.addEventListener("click", logout);
    }
});