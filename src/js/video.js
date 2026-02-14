const API_VIDEO = "/api/video";

// --- Variáveis de Estado (Paginação) ---
let allVideos = [];
let currentPage = 1;
const itemsPerPage = 10;

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
    // Aqui também podemos usar o showError se quisermos evitar alert no logout forçado,
    // mas o padrão é redirecionar, então alert + redirect está ok.
    alert("Sessão expirada. Faça login novamente.");
    localStorage.removeItem("token");
    window.location.href = "login.html";
}

// --- Helpers de Mensagem (Novo) ---

function showError(message) {
    const msgDiv = document.getElementById("uploadMsg");
    if (msgDiv) {
        msgDiv.innerHTML = `
            <div class="alert alert-danger alert-dismissible fade show" role="alert">
                <i class="bi bi-exclamation-triangle-fill me-2"></i> ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;
    }
}

function showSuccess(message) {
    const msgDiv = document.getElementById("uploadMsg");
    if (msgDiv) {
        msgDiv.innerHTML = `
            <div class="alert alert-success alert-dismissible fade show" role="alert">
                <i class="bi bi-check-circle-fill me-2"></i> ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;
    }
}

function clearError() {
    const msgDiv = document.getElementById("uploadMsg");
    if (msgDiv) {
        msgDiv.innerHTML = "";
    }
}

// --- Lógica de UI (Botão Enviar e Paginação) ---

function setupUI() {
    const input = document.getElementById("videoInput");
    const btnUpload = document.getElementById("btnUpload");
    
    // Upload Button Logic
    if (input && btnUpload) {
        input.addEventListener("change", () => {
            // Limpa mensagens anteriores ao selecionar novo arquivo
            clearError();
            
            // Habilita/Desabilita botão
            btnUpload.disabled = input.files.length === 0;
        });
    }

    // Pagination Listeners
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

// --- Lógica de Upload (Com Validação Visual) ---

async function uploadVideo() {
    const input = document.getElementById("videoInput");
    const btn = document.getElementById("btnUpload");
    const file = input.files[0];
    
    // Limpa mensagens anteriores
    clearError();

    if (!file) {
        showError("Selecione um arquivo para enviar.");
        return;
    }

    // 1. Validação de Tipo (MP4)
    if (file.type !== "video/mp4") {
        showError("Formato inválido! O arquivo deve ser <strong>.mp4</strong>.");
        input.value = ""; // Limpa o arquivo inválido
        btn.disabled = true;
        return;
    }

    // 2. Validação de Tamanho (100MB)
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

        // PASSO 1: Solicitar URL Pré-assinada
        console.log("1. Solicitando permissão de upload...");
        
        const reqInit = await fetch(`${API_VIDEO}/request-upload`, {
            method: "POST",
            headers: {
                ...authHeaders,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                filename: file.name,
                content_type: file.type
            })
        });

        if (reqInit.status === 401) return handleAuthError();
        
        if (!reqInit.ok) {
            const errData = await reqInit.json().catch(() => ({}));
            throw new Error(errData.detail || "Falha ao iniciar upload");
        }

        const { upload_url, task_id } = await reqInit.json();

        // PASSO 2: Enviar arquivo binário para o S3
        console.log("2. Enviando arquivo para o S3...");
        const s3Upload = await fetch(upload_url, {
            method: "PUT",
            headers: {
                "Content-Type": file.type
            },
            body: file
        });

        if (!s3Upload.ok) throw new Error("Falha ao enviar arquivo para o S3");

        // PASSO 3: Confirmar processamento
        console.log("3. Confirmando processamento...");
        
        const reqConfirm = await fetch(`${API_VIDEO}/confirm-upload`, {
            method: "POST",
            headers: {
                ...authHeaders,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ task_id: task_id })
        });

        if (reqConfirm.status === 401) return handleAuthError();
        if (!reqConfirm.ok) throw new Error("Falha ao confirmar upload");

        // Sucesso!
        showSuccess("Vídeo enviado com sucesso! O processamento iniciará em breve.");
        input.value = ""; 
        
        // Recarrega a lista e volta para a primeira página
        currentPage = 1;
        loadVideos(); 

    } catch (err) {
        console.error(err);
        showError("Erro no envio: " + err.message);
        // Em caso de erro de rede, permite tentar de novo se o arquivo ainda estiver lá
        if (input.files.length > 0) btn.disabled = false;
    } finally {
        toggleLoader(false);
    }
}

// --- Lógica de Listagem (Com Paginação) ---

async function loadVideos() {
    const tbody = document.getElementById("videoTableBody");
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" class="text-center">Carregando...</td></tr>';

    try {
        const authHeaders = getAuthHeaders();
        if (!authHeaders) return;

        const res = await fetch(`${API_VIDEO}/list`, {
            method: "GET",
            headers: {
                ...authHeaders,
                "Content-Type": "application/json"
            }
        });

        if (res.status === 401) return handleAuthError();
        if (!res.ok) throw new Error("Erro ao buscar lista");

        const data = await res.json();
        // Salva todos os vídeos na variável global
        allVideos = data.items || [];

        // Renderiza a página atual
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

    // Calcula paginação
    const totalPages = Math.ceil(allVideos.length / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = allVideos.slice(start, end);

    // Exibe/Oculta controles
    if (totalPages > 1) {
        controls.classList.remove("d-none");
        indicator.textContent = `Página ${currentPage} de ${totalPages}`;
        btnPrev.disabled = currentPage === 1;
        btnNext.disabled = currentPage === totalPages;
    } else {
        controls.classList.add("d-none");
    }

    // Renderiza linhas
    pageItems.forEach(v => {
        const statusBadge = getStatusBadge(v.status);
        
        const downloadUrl = v.downloadUrl || v.download_url;
        const downloadBtn = downloadUrl 
            ? `<a href="${downloadUrl}" target="_blank" class="btn btn-sm btn-outline-success">
                    <i class="bi bi-download"></i> Download
                </a>` 
            : '<span class="text-muted small">Aguardando...</span>';
        
        let dateStr = "-";
        if (v.created_at) {
            try {
                dateStr = new Date(v.created_at).toLocaleString('pt-BR', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                });
            } catch (e) { console.error("Data inválida", v.created_at); }
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

// --- Helpers ---

function getStatusBadge(status) {
    const s = (status || "").toLowerCase();
    
    let color = "secondary";
    let label = status;

    if (s === "processed" || s === "concluido") {
        color = "success";      
        label = "CONCLUÍDO";
    } 
    else if (s === "processing") {
        color = "info text-dark"; 
        label = "EM PROCESSAMENTO";
    } 
    else if (s === "pending" || s === "pending_upload" || s === "queued") {
        color = "warning text-dark"; 
        label = (s === "queued") ? "NA FILA" : "PENDENTE";
    } 
    else if (s === "error" || s === "erro" || s === "upload_failed") {
        color = "danger";       
        label = "ERRO";
    }

    return `<span class="badge bg-${color}">${label}</span>`;
}

function toggleLoader(show) {
    const loader = document.getElementById("loader");
    if (loader) loader.style.display = show ? "flex" : "none";
}

// --- Inicialização ---

document.addEventListener("DOMContentLoaded", () => {
    setupUI();

    if (document.getElementById("videoTableBody")) {
        loadVideos();
        
        const btnUpload = document.getElementById("btnUpload");
        if(btnUpload) btnUpload.addEventListener("click", uploadVideo);

        const btnRefresh = document.getElementById("btnRefresh");
        if(btnRefresh) btnRefresh.addEventListener("click", () => {
            currentPage = 1; // Reseta para primeira página ao atualizar
            loadVideos();
        });
        
        const btnLogout = document.getElementById("btnLogout");
        if(btnLogout) {
            btnLogout.addEventListener("click", () => {
                localStorage.removeItem("token");
                window.location.href = "login.html";
            });
        }
    }
});