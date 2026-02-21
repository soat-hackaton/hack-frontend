export function getAuthHeaders() {
    const token = localStorage.getItem("token");
    if (!token) {
        window.location.href = "login.html";
        return null;
    }
    return {
        "Authorization": `Bearer ${token}`
    };
}

export function handleAuthError() {
    alert("Sessão expirada. Faça login novamente.");
    localStorage.removeItem("token");
    window.location.href = "login.html";
}

export function getUserEmail() {
    const token = localStorage.getItem("token");
    if (!token) return null;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.email;
    } catch (e) {
        console.error("Erro ao extrair email do token:", e);
        return null;
    }
}

export function updateGreeting(token) {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const userName = payload.name || "";

        const greetingEl = document.getElementById("userGreeting");
        if (greetingEl) {
            greetingEl.textContent = `Olá ${userName}, que vídeo iremos processar hoje?`;
        }
    } catch (e) {
        console.error("Erro ao ler nome do token", e);
    }
}

export function logout() {
    localStorage.removeItem("token");
    window.location.href = "login.html";
}
