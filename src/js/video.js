const API_VIDEO = "/api/video";

// --- Gerenciamento de Autenticação ---

function getAuthHeaders() {
    const token = localStorage.getItem("token");
    if (!token) {
        // Sem token, nem tenta. Manda pro login.
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

// --- Lógica de Upload (Padrão S3 Presigned URL) ---

async function uploadVideo() {
    const input = document.getElementById("videoInput");
    const file = input.files[0];
    if (!file) return alert("Selecione um arquivo!");

    toggleLoader(true);

    try {
        const headers = getAuthHeaders();
        if (!headers) return; // Se não tem header, o getAuthHeaders já redirecionou

        // PASSO 1: Solicitar URL Pré-assinada ao Backend
        // Enviamos apenas metadados (JSON), não o arquivo.
        console.log("1. Solicitando permissão de upload...");
        const reqInit = await fetch(`${API_VIDEO}/request-upload`, {
            method: "POST",
            headers: {
                ...headers,
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

        // PASSO 2: Enviar o Arquivo DIRETAMENTE para o S3 (PUT)
        // Nota: NÃO enviamos o header Authorization aqui, pois a URL já contém a assinatura da AWS.
        // O Content-Type deve ser exatamente o mesmo informado no passo 1.
        console.log("2. Enviando arquivo para o S3...");
        const s3Upload = await fetch(upload_url, {
            method: "PUT",
            headers: {
                "Content-Type": file.type
            },
            body: file // O binário do arquivo vai aqui
        });

        if (!s3Upload.ok) throw new Error("Falha ao enviar arquivo para o S3");

        // PASSO 3: Confirmar para o Backend que o upload terminou
        console.log("3. Confirmando processamento...");
        const reqConfirm = await fetch(`${API_VIDEO}/confirm-upload`, {
            method: "POST",
            headers: {
                ...headers, // Aqui precisamos do token de novo
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ task_id: task_id })
        });

        if (reqConfirm.status === 401) return handleAuthError();
        if (!reqConfirm.ok) throw new Error("Falha ao confirmar upload");
        console.log("4. Vídeo enviado com sucesso! O processamento iniciará em breve.");

        alert("Vídeo enviado com sucesso! O processamento iniciará em breve.");
        input.value = ""; // Limpa o input
        loadVideos(); // Recarrega a lista

    } catch (err) {
        console.error(err);
        alert("Erro no fluxo de upload: " + err.message);
    } finally {
        toggleLoader(false);
    }
}

// --- Lógica de Listagem ---

async function loadVideos() {
    const tbody = document.getElementById("videoTableBody");
    if (!tbody) return; // Proteção caso script rode fora da dashboard

    tbody.innerHTML = '<tr><td colspan="3" class="text-center">Carregando...</td></tr>';

    try {
        const headers = getAuthHeaders();
        if (!headers) return;

        const res = await fetch(`${API_VIDEO}/list`, {
            method: "GET",
            headers: {
                ...headers,
                "Content-Type": "application/json"
            }
        });

        // Intercepta Token Expirado
        if (res.status === 401) {
            return handleAuthError();
        }

        if (!res.ok) throw new Error("Erro ao buscar lista de vídeos");

        const data = await res.json();
        const videos = data.items || [];
        
        tbody.innerHTML = "";

        if (!videos || videos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center">Nenhum vídeo encontrado.</td></tr>';
            return;
        }

        // Renderiza as linhas
        videos.forEach(v => {
            const statusBadge = getStatusBadge(v.status);
            // Se tiver downloadUrl e status for processed, exibe botão
            const downloadBtn = (v.downloadUrl || v.download_url) 
                ? `<a href="${v.downloadUrl || v.download_url}" target="_blank" class="btn btn-sm btn-success">Baixar</a>` 
                : '<span class="text-muted">-</span>';
            
            // Formatando data simples (opcional)
            const dateStr = v.created_at ? new Date(v.created_at).toLocaleString() : "-";

            tbody.innerHTML += `
                <tr>
                    <td>
                        ${v.filename}<br>
                        <small class="text-muted">${dateStr}</small>
                    </td>
                    <td>${statusBadge}</td>
                    <td>${downloadBtn}</td>
                </tr>
            `;
        });

    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-danger">Erro ao carregar vídeos.</td></tr>';
    }
}

// --- Helpers de UI ---

function getStatusBadge(status) {
    let color = "secondary";
    let label = status || "Desconhecido";
    const s = label.toLowerCase();

    if (s === "processed" || s === "concluido") {
        color = "success";
    } else if (s === "processing" || s === "pending" || s === "pending_upload") {
        color = "warning";
        label = "Processando";
    } else if (s === "error" || s === "erro") {
        color = "danger";
    }

    return `<span class="badge bg-${color}">${label}</span>`;
}

function toggleLoader(show) {
    const loader = document.getElementById("loader");
    if (loader) loader.style.display = show ? "flex" : "none";
}

// --- Inicialização ---

document.addEventListener("DOMContentLoaded", () => {
    // Verifica se estamos na página que tem a tabela (Dashboard)
    if (document.getElementById("videoTableBody")) {
        loadVideos();
        
        const btnUpload = document.getElementById("btnUpload");
        if(btnUpload) btnUpload.addEventListener("click", uploadVideo);

        const btnRefresh = document.getElementById("btnRefresh");
        if(btnRefresh) btnRefresh.addEventListener("click", loadVideos);
    }
});