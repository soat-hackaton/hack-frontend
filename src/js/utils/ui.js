let msgTimeout = null;

export function clearFeedback() {
    const feedbackMsg = document.getElementById("feedbackMsg");
    if (feedbackMsg) {
        feedbackMsg.classList.add("d-none");
        feedbackMsg.className = "alert mt-3 text-center d-none";
    }
}

export function showFeedback(msg, type) {
    const el = document.getElementById("feedbackMsg");
    if (el) {
        el.textContent = msg;
        el.className = `alert mt-3 text-center ${type}`;
        el.classList.remove("d-none");
    }
}

export function showError(message) {
    const msgDiv = document.getElementById("uploadMsg");
    if (msgDiv) {
        if (msgTimeout) clearTimeout(msgTimeout);

        msgDiv.innerHTML = `
            <div class="alert alert-danger fade show" role="alert">
                <i class="bi bi-exclamation-triangle-fill me-2"></i> ${message}
            </div>
        `;

        msgTimeout = setTimeout(() => {
            msgDiv.innerHTML = "";
            msgTimeout = null;
        }, 5000);
    }
}

export function showSuccess(message) {
    const msgDiv = document.getElementById("uploadMsg");
    if (msgDiv) {
        if (msgTimeout) clearTimeout(msgTimeout);

        msgDiv.innerHTML = `
            <div class="alert alert-success fade show" role="alert">
                <i class="bi bi-check-circle-fill me-2"></i> ${message}
            </div>
        `;

        msgTimeout = setTimeout(() => {
            msgDiv.innerHTML = "";
            msgTimeout = null;
        }, 5000);
    }
}

export function clearError() {
    const msgDiv = document.getElementById("uploadMsg");
    if (msgDiv) {
        msgDiv.innerHTML = "";
    }
    if (msgTimeout) {
        clearTimeout(msgTimeout);
        msgTimeout = null;
    }
}

export function getStatusBadge(status) {
    const s = (status || "").toLowerCase();

    let color = "secondary";
    let label = status;

    if (s === "done") {
        color = "success";
        label = "CONCLUÍDO";
    }
    else if (s === "processing") {
        color = "info text-dark";
        label = "PROCESSANDO";
    }
    else if (s === "queued") {
        color = "warning text-dark";
        label = "NA FILA";
    }
    else if (s === "error") {
        color = "danger";
        label = "ERRO";
    }

    return `<span class="badge bg-${color}">${label}</span>`;
}

export function toggleLoader(show) {
    const loader = document.getElementById("loader");
    if (loader) loader.style.display = show ? "flex" : "none";
}
