const API_VIDEO = "/api/video";

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

// --- UI Logic ---
function setupUploadButton() {
    const input = document.getElementById("videoInput");
    const btn = document.getElementById("btnUpload");

    if (!input || !btn) return;

    input.addEventListener("change", () => {
        // Habilita se tiver arquivo
        btn.disabled = input.files.length === 0;
    });
}

// --- Upload Logic ---
async function uploadVideo() {
    const input = document.getElementById("videoInput");
    const btn = document.getElementById("btnUpload");
    const file = input.files[0];
    
    if (!file) return alert("Selecione um arquivo!");

    toggleLoader(true);
    btn.disabled = true;

    try {
        const authHeaders = getAuthHeaders();
        if (!authHeaders) return;

        // PASSO 1: Solicitar URL Pré-assinada
        console.log("1. Solicitando permissão de upload...");
        
        const reqInit = await fetch(`${API_VIDEO}/request-upload`, {
            method: "POST",
            // USANDO SPREAD OPERATOR AQUI
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
        if (!reqInit.ok) throw new Error("Falha ao iniciar upload");

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
            // USANDO SPREAD OPERATOR AQUI
            headers: {
                ...authHeaders,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ task_id: task_id })
        });

        if (reqConfirm.status === 401) return handleAuthError();
        if (!reqConfirm.ok) throw new Error("Falha ao confirmar upload");

        alert("Vídeo enviado com sucesso!");
        input.value = ""; 
        loadVideos(); 

    } catch (err) {
        console.error(err);
        alert("Erro no fluxo de upload: " + err.message);
        if (input.files.length > 0) btn.disabled = false;
    } finally {
        toggleLoader(false);
    }
}

// --- List Logic ---
async function loadVideos() {
    const tbody = document.getElementById("videoTableBody");
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" class="text-center">Carregando...</td></tr>';

    try {
        const authHeaders = getAuthHeaders();
        if (!authHeaders) return;

        const res = await fetch(`${API_VIDEO}/list`, {
            method: "GET",
            // USANDO SPREAD OPERATOR AQUI
            headers: {
                ...authHeaders,
                "Content-Type": "application/json"
            }
        });

        if (res.status === 401) return handleAuthError();
        if (!res.ok) throw new Error("Erro ao buscar lista");

        const data = await res.json();
        const videos = data.items || [];

        tbody.innerHTML = "";

        if (videos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">Nenhum vídeo encontrado.</td></tr>';
            return;
        }

        videos.forEach(v => {
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

    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Erro ao carregar vídeos.</td></tr>';
    }
}

// --- Helpers ---
function getStatusBadge(status) {
    const s = (status || "").toLowerCase();
    
    let color = "secondary";
    let label = status;

    if (s === "processed" || s === "concluido") {
        color = "success";      
        label = "CONCLUÍDO";
    } else if (s === "processing") {
        color = "info text-dark"; 
        label = "EM PROCESSAMENTO";
    } else if (s === "pending" || s === "pending_upload") {
        color = "warning text-dark"; 
        label = "PENDENTE";
    } else if (s === "error" || s === "erro") {
        color = "danger";       
        label = "ERRO";
    }

    return `<span class="badge bg-${color}">${label}</span>`;
}

function toggleLoader(show) {
    const loader = document.getElementById("loader");
    if (loader) loader.style.display = show ? "flex" : "none";
}

document.addEventListener("DOMContentLoaded", () => {
    setupUploadButton();

    if (document.getElementById("videoTableBody")) {
        loadVideos();
        
        const btnUpload = document.getElementById("btnUpload");
        if(btnUpload) btnUpload.addEventListener("click", uploadVideo);

        const btnRefresh = document.getElementById("btnRefresh");
        if(btnRefresh) btnRefresh.addEventListener("click", loadVideos);
        
        const btnLogout = document.getElementById("btnLogout");
        if(btnLogout) {
            btnLogout.addEventListener("click", () => {
                localStorage.removeItem("token");
                window.location.href = "login.html";
            });
        }
    }
});