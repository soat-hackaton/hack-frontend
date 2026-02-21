import { API_VIDEO } from './utils/api.js';
import { getAuthHeaders, handleAuthError, getUserEmail, logout } from './utils/auth.js';
import { showError, showSuccess, clearError, getStatusBadge, toggleLoader, toggleUploadProgress, updateUploadStep, createUploadProgressItem, clearUploadProgressItems } from './utils/ui.js';

// --- Variáveis de Estado ---
let allVideos = [];
let currentPage = 1;
const itemsPerPage = 10;

// --- Lógica de UI (Botão Enviar e Paginação) ---

function setupUI() {
    const input = document.getElementById("videoInput");
    const btnUpload = document.getElementById("btnUpload");

    if (input && btnUpload) {
        input.addEventListener("change", () => {
            clearError();
            if (input.files.length === 0) {
                btnUpload.disabled = true;
            } else if (input.files.length > 5) {
                showError("Você pode selecionar no máximo 5 vídeos por vez.");
                btnUpload.disabled = true;
            } else {
                btnUpload.disabled = false;
            }
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
    const files = Array.from(input.files);

    clearError();

    if (files.length === 0) {
        showError("Selecione um arquivo para enviar.");
        return;
    }

    if (files.length > 5) {
        showError("Você pode selecionar no máximo 5 vídeos por vez.");
        return;
    }

    const MAX_SIZE_MB = 100;
    for (const file of files) {
        if (file.type !== "video/mp4") {
            showError(`O arquivo <strong>${file.name}</strong> possui formato inválido! Deve ser .mp4.`);
            input.value = "";
            btn.disabled = true;
            return;
        }
        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
            showError(`O arquivo <strong>${file.name}</strong> é muito grande! O limite é de ${MAX_SIZE_MB}MB.`);
            input.value = "";
            btn.disabled = true;
            return;
        }
    }

    clearUploadProgressItems();
    files.forEach((file, index) => {
        createUploadProgressItem(index, file.name);
    });
    toggleUploadProgress(true);
    btn.disabled = true;

    const authHeaders = getAuthHeaders();
    if (!authHeaders) return;

    let successFiles = [];
    let errorFiles = [];

    const uploadPromises = files.map(async (file, index) => {
        let task_id = null;
        try {
            updateUploadStep(index, "Iniciando requisição...", 10);

            const reqInit = await fetch(`${API_VIDEO}/request-upload`, {
                method: "POST",
                headers: { ...authHeaders, "Content-Type": "application/json" },
                body: JSON.stringify({ filename: file.name, content_type: file.type })
            });

            if (reqInit.status === 401) {
                handleAuthError();
                return;
            }

            if (!reqInit.ok) {
                const errData = await reqInit.json().catch(() => ({}));
                throw new Error(errData.detail || "Falha ao iniciar upload");
            }

            const initData = await reqInit.json();
            task_id = initData.task_id;
            const upload_url = initData.upload_url;

            updateUploadStep(index, "Enviando arquivo...", 40);

            const s3Upload = await fetch(upload_url, {
                method: "PUT",
                headers: { "Content-Type": file.type },
                body: file
            });

            if (!s3Upload.ok) throw new Error("Falha ao enviar arquivo para o S3");

            updateUploadStep(index, "Confirmando envio...", 80);

            const reqConfirm = await fetch(`${API_VIDEO}/confirm-upload`, {
                method: "POST",
                headers: { ...authHeaders, "Content-Type": "application/json" },
                body: JSON.stringify({ task_id: task_id })
            });

            if (reqConfirm.status === 401) {
                handleAuthError();
                return;
            }
            if (!reqConfirm.ok) throw new Error("Falha ao confirmar upload");

            updateUploadStep(index, "Concluído!", 100);
            successFiles.push(file.name);

            const itemContainer = document.getElementById(`uploadItem_${index}`);
            if (itemContainer) {
                const spinner = itemContainer.querySelector(".spinner-border");
                if (spinner) spinner.classList.add("d-none");
            }

        } catch (err) {
            console.error(err);
            updateUploadStep(index, "Erro: " + err.message, 0);
            errorFiles.push(file.name);

            const progressBar = document.getElementById(`uploadProgressBar_${index}`);
            if (progressBar) {
                progressBar.classList.remove("bg-success");
                progressBar.classList.add("bg-danger");
                progressBar.style.width = "100%";
            }

            if (task_id) {
                try {
                    const userEmail = getUserEmail();
                    if (userEmail) {
                        await fetch(`${API_VIDEO}/${task_id}`, {
                            method: "PATCH",
                            headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
                            body: JSON.stringify({
                                status: "ERROR",
                                user_email: userEmail
                            })
                        });
                        console.log("Status da task atualizado para ERROR no backend para o arquivo", file.name);
                    }
                } catch (apiError) {
                    console.warn("Falha ao reportar erro para o backend:", apiError);
                }
            }
        }
    });

    await Promise.all(uploadPromises);

    input.value = "";
    if (successFiles.length > 0 && errorFiles.length === 0) {
        if (successFiles.length === 1) {
            showSuccess(`Vídeo enviado com sucesso: <strong>${successFiles[0]}</strong>. O processamento iniciará em breve.`);
        } else {
            showSuccess(`<strong>${successFiles.length}</strong> vídeos enviados com sucesso:<br>- ${successFiles.join("<br>- ")}`);
        }
    } else if (successFiles.length > 0 && errorFiles.length > 0) {
        showSuccess(`Alguns vídeos enviados: <br>- ${successFiles.join("<br>- ")}`);
        showError(`Erro ao enviar: <br>- ${errorFiles.join("<br>- ")}`);
    } else if (errorFiles.length > 0) {
        showError(`Erro ao enviar todos os arquivos: <br>- ${errorFiles.join("<br>- ")}`);
    }

    currentPage = 1;
    loadVideos();

    setTimeout(() => {
        toggleUploadProgress(false);
    }, 5000);
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

        const s = (v.status || "").toLowerCase();
        const isDone = (s === "done");
        const isError = (s === "error");

        const downloadUrl = v.downloadUrl || v.download_url;

        let btnDownload = "";
        if (isDone && downloadUrl) {
            btnDownload = `
                <a href="${downloadUrl}" class="btn btn-sm btn-outline-success me-2" title="Baixar Vídeo" download>
                    <i class="bi bi-download"></i>
                </a>`;
        } else {
            btnDownload = `
                <button class="btn btn-sm btn-outline-secondary me-2" disabled title="Download Indisponível">
                    <i class="bi bi-download"></i>
                </button>`;
        }

        let btnRetry = "";
        if (isError) {
            const tId = v.task_id || v.id || "";
            btnRetry = `
                <button class="btn btn-sm btn-outline-danger btn-retry" data-task-id="${tId}" title="Tentar Novamente">
                    <i class="bi bi-arrow-clockwise"></i>
                </button>`;
        } else {
            btnRetry = `
                <button class="btn btn-sm btn-outline-secondary" disabled>
                    <i class="bi bi-arrow-clockwise"></i>
                </button>`;
        }

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
                <td>
                    <div class="d-flex align-items-center">
                        ${btnDownload}
                        ${btnRetry}
                    </div>
                </td>
            </tr>
        `;
    });
}

async function retryVideo(taskId, btnElement) {
    const originalHtml = btnElement.innerHTML;
    btnElement.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
    btnElement.disabled = true;

    try {
        const authHeaders = getAuthHeaders();
        const userEmail = getUserEmail();

        const res = await fetch(`${API_VIDEO}/${taskId}`, {
            method: "PATCH",
            headers: { ...authHeaders, "Content-Type": "application/json" },
            body: JSON.stringify({
                status: "QUEUED",
                user_email: userEmail
            })
        });

        if (res.status === 401) return handleAuthError();
        if (!res.ok) throw new Error("Erro ao tentar processar novamente");

        showSuccess("Vídeo reenviado para a fila de processamento!");
        loadVideos();
    } catch (err) {
        console.error(err);
        showError("Falha ao reenviar o vídeo para processamento.");
        btnElement.innerHTML = originalHtml;
        btnElement.disabled = false;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    setupUI();
    if (document.getElementById("videoTableBody")) {
        loadVideos();
        const btnUpload = document.getElementById("btnUpload");
        if (btnUpload) btnUpload.addEventListener("click", uploadVideo);
        const btnRefresh = document.getElementById("btnRefresh");
        if (btnRefresh) btnRefresh.addEventListener("click", () => { currentPage = 1; loadVideos(); });
        const btnLogout = document.getElementById("btnLogout");
        if (btnLogout) btnLogout.addEventListener("click", logout);

        document.getElementById("videoTableBody").addEventListener("click", (e) => {
            const retryBtn = e.target.closest(".btn-retry");
            if (retryBtn) {
                const taskId = retryBtn.getAttribute("data-task-id");
                if (taskId) {
                    retryVideo(taskId, retryBtn);
                }
            }
        });
    }
});