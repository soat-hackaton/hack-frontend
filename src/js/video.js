const API_VIDEO = "/api/video";

// --- Variáveis de Estado ---
let allVideos = [];
let currentPage = 1;
const itemsPerPage = 10;
let msgTimeout = null; // Variável para controlar o tempo da mensagem

// --- Gerenciamento de Autenticação ---

function getAuthHeaders() {
    const token = localStorage.getItem("token");
    if (!token) {
        window.location.href = "login.html";
        return null;
    }
    return {
        "Authorization": `Bearer ${token}`
    };
}

function handleAuthError() {
    alert("Sessão expirada. Faça login novamente.");
    localStorage.removeItem("token");
    window.location.href = "login.html";
}

// --- Helpers de Mensagem (Atualizados) ---

function showError(message) {
    const msgDiv = document.getElementById("uploadMsg");
    if (msgDiv) {
        // Se já tiver um timer rodando, cancela ele para não sumir a nova mensagem cedo demais
        if (msgTimeout) clearTimeout(msgTimeout);

        // Removemos o botão close e a classe alert-dismissible
        msgDiv.innerHTML = `
            <div class="alert alert-danger fade show" role="alert">
                <i class="bi bi-exclamation-triangle-fill me-2"></i> ${message}
            </div>
        `;

        // Agenda o desaparecimento para 5 segundos
        msgTimeout = setTimeout(() => {
            msgDiv.innerHTML = "";
            msgTimeout = null;
        }, 5000);
    }
}

function showSuccess(message) {
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

function clearError() {
    const msgDiv = document.getElementById("uploadMsg");
    if (msgDiv) {
        msgDiv.innerHTML = "";
    }
    if (msgTimeout) {
        clearTimeout(msgTimeout);
        msgTimeout = null;
    }
}

// --- Lógica de UI (Botão Enviar e Paginação) ---

function setupUI() {
    const input = document.getElementById("videoInput");
    const btnUpload = document.getElementById("btnUpload");
    
    if (input && btnUpload) {
        input.addEventListener("change", () => {
            // Limpa mensagens anteriores ao selecionar novo arquivo
            clearError();
            btnUpload.disabled = input.files.length === 0;
        });
    }

    document.getElementById("btnPrevPage")?.addEventListener("click", () => changePage(-1));
    document.getElementById("btnNextPage")?.addEventListener("click", () => changePage(1));
}

function changePage(delta) {
    const totalPages = Math.ceil(allVideos.length / itemsPerPage);
    const newPage = currentPage + delta;

    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        renderTable();
    }
}

// --- Lógica de Upload ---

async function uploadVideo() {
    const input = document.getElementById("videoInput");
    const btn = document.getElementById("btnUpload");
    const file = input.files[0];
    
    clearError(); // Garante que limpamos timers antigos

    if (!file) {
        showError("Selecione um arquivo para enviar.");
        return;
    }

    // 1. Validação de Tipo
    if (file.type !== "video/mp4") {
        showError("Formato inválido! O arquivo deve ser <strong>.mp4</strong>.");
        input.value = ""; 
        btn.disabled = true;
        return;
    }

    // 2. Validação de Tamanho
    const MAX_SIZE_MB = 100;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        showError(`Arquivo muito grande! O limite é de <strong>${MAX_SIZE_MB}MB</strong>.`);
        input.value = "";
        btn.disabled = true;
        return;
    }

    toggleLoader(true);
    btn.disabled = true;

    try {
        const authHeaders = getAuthHeaders();
        if (!authHeaders) return;

        // PASSO 1
        const reqInit = await fetch(`${API_VIDEO}/request-upload`, {
            method: "POST",
            headers: { ...authHeaders, "Content-Type": "application/json" },
            body: JSON.stringify({ filename: file.name, content_type: file.type })
        });

        if (reqInit.status === 401) return handleAuthError();
        
        if (!reqInit.ok) {
            const errData = await reqInit.json().catch(() => ({}));
            throw new Error(errData.detail || "Falha ao iniciar upload");
        }

        const { upload_url, task_id } = await reqInit.json();

        // PASSO 2
        const s3Upload = await fetch(upload_url, {
            method: "PUT",
            headers: { "Content-Type": file.type },
            body: file
        });

        if (!s3Upload.ok) throw new Error("Falha ao enviar arquivo para o S3");

        // PASSO 3
        const reqConfirm = await fetch(`${API_VIDEO}/confirm-upload`, {
            method: "POST",
            headers: { ...authHeaders, "Content-Type": "application/json" },
            body: JSON.stringify({ task_id: task_id })
        });

        if (reqConfirm.status === 401) return handleAuthError();
        if (!reqConfirm.ok) throw new Error("Falha ao confirmar upload");

        showSuccess("Vídeo enviado com sucesso! O processamento iniciará em breve.");
        input.value = ""; 
        
        currentPage = 1;
        loadVideos(); 

    } catch (err) {
        console.error(err);
        showError("Erro no envio: " + err.message);
        if (input.files.length > 0) btn.disabled = false;
    } finally {
        toggleLoader(false);
    }
}

// --- Lógica de Listagem ---

async function loadVideos() {
    const tbody = document.getElementById("videoTableBody");
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" class="text-center">Carregando...</td></tr>';

    try {
        const authHeaders = getAuthHeaders();
        if (!authHeaders) return;

        const res = await fetch(`${API_VIDEO}/list`, {
            method: "GET",
            headers: { ...authHeaders, "Content-Type": "application/json" }
        });

        if (res.status === 401) return handleAuthError();
        if (!res.ok) throw new Error("Erro ao buscar lista");

        const data = await res.json();
        allVideos = data.items || [];
        renderTable();

    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Erro ao carregar vídeos.</td></tr>';
    }
}

function renderTable() {
    const tbody = document.getElementById("videoTableBody");
    const controls = document.getElementById("paginationControls");
    const btnPrev = document.getElementById("btnPrevPage");
    const btnNext = document.getElementById("btnNextPage");
    const indicator = document.getElementById("pageIndicator");

    tbody.innerHTML = "";

    if (allVideos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">Nenhum vídeo encontrado.</td></tr>';
        controls.classList.add("d-none");
        return;
    }

    const totalPages = Math.ceil(allVideos.length / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = allVideos.slice(start, end);

    if (totalPages > 1) {
        controls.classList.remove("d-none");
        indicator.textContent = `Página ${currentPage} de ${totalPages}`;
        btnPrev.disabled = currentPage === 1;
        btnNext.disabled = currentPage === totalPages;
    } else {
        controls.classList.add("d-none");
    }

    pageItems.forEach(v => {
        const statusBadge = getStatusBadge(v.status);
        const downloadUrl = v.downloadUrl || v.download_url;
        const downloadBtn = downloadUrl 
            ? `<a href="${downloadUrl}" target="_blank" class="btn btn-sm btn-outline-success"><i class="bi bi-download"></i> Download</a>` 
            : '<span class="text-muted small">Aguardando...</span>';
        
        let dateStr = "-";
        if (v.created_at) {
            try {
                dateStr = new Date(v.created_at).toLocaleString('pt-BR', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                });
            } catch (e) { }
        }

        tbody.innerHTML += `
            <tr>
                <td class="fw-medium">${v.filename}</td>
                <td>${statusBadge}</td>
                <td>${dateStr}</td>
                <td>${downloadBtn}</td>
            </tr>
        `;
    });
}

function getStatusBadge(status) {
    const s = (status || "").toLowerCase();
    
    let color = "secondary";
    let label = status;

    if (s === "done") {
        color = "success";      
        label = "CONCLUÍDO";
    } 
    else if (s === "processing") {
        color = "info text-dark"; 
        label = "EM PROCESSAMENTO";
    } 
    else if (s === "queued") {
        color = "warning text-dark"; 
        label = "NA FILA";
    } 
    else if (s === "error") {
        color = "danger";       
        label = "FALHOU";
    }

    return `<span class="badge bg-${color}">${label}</span>`;
}

function toggleLoader(show) {
    const loader = document.getElementById("loader");
    if (loader) loader.style.display = show ? "flex" : "none";
}

document.addEventListener("DOMContentLoaded", () => {
    setupUI();
    if (document.getElementById("videoTableBody")) {
        loadVideos();
        const btnUpload = document.getElementById("btnUpload");
        if(btnUpload) btnUpload.addEventListener("click", uploadVideo);
        const btnRefresh = document.getElementById("btnRefresh");
        if(btnRefresh) btnRefresh.addEventListener("click", () => { currentPage = 1; loadVideos(); });
        const btnLogout = document.getElementById("btnLogout");
        if(btnLogout) btnLogout.addEventListener("click", () => {
            localStorage.removeItem("token");
            window.location.href = "login.html";
        });
    }
});