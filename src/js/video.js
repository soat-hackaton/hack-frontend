const API_VIDEO = "/api/video";

async function uploadVideo() {
    const input = document.getElementById("videoInput");
    const file = input.files[0];
    if (!file) return alert("Selecione um arquivo!");

    const formData = new FormData();
    formData.append("file", file); // O nome do campo deve bater com o Backend Go

    toggleLoader(true);
    try {
        const res = await fetch(`${API_VIDEO}/upload`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${localStorage.getItem("token")}`
            },
            body: formData
        });

        if (!res.ok) throw new Error("Falha no upload");

        alert("Vídeo enviado com sucesso!");
        input.value = ""; // Limpa input
        loadVideos(); // Recarrega lista
    } catch (err) {
        alert("Erro ao enviar vídeo: " + err.message);
    } finally {
        toggleLoader(false);
    }
}

async function loadVideos() {
    const tbody = document.getElementById("videoTableBody");
    tbody.innerHTML = '<tr><td colspan="3" class="text-center">Carregando...</td></tr>';

    try {
        const res = await fetch(`${API_VIDEO}/list`, {
            headers: {
                "Authorization": `Bearer ${localStorage.getItem("token")}`
            }
        });

        if (!res.ok) throw new Error("Erro ao listar");

        const videos = await res.json();
        tbody.innerHTML = "";

        if (videos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center">Nenhum vídeo encontrado.</td></tr>';
            return;
        }

        videos.forEach(v => {
            tbody.innerHTML += `
                <tr>
                    <td>${v.filename}</td>
                    <td><span class="badge bg-${getStatusColor(v.status)}">${v.status}</span></td>
                    <td>
                        ${v.downloadUrl ? `<a href="${v.downloadUrl}" target="_blank" class="btn btn-sm btn-primary">Baixar</a>` : '-'}
                    </td>
                </tr>
            `;
        });
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-danger">Erro ao carregar vídeos.</td></tr>';
    }
}

function getStatusColor(status) {
    switch(status.toLowerCase()) {
        case 'processed': return 'success';
        case 'processing': return 'warning';
        case 'error': return 'danger';
        default: return 'secondary';
    }
}

function toggleLoader(show) {
    document.getElementById("loader").style.display = show ? "flex" : "none";
}

// Inicialização
document.addEventListener("DOMContentLoaded", () => {
    // Só carrega se estiver na dashboard
    if (document.getElementById("videoTableBody")) {
        loadVideos();
        document.getElementById("btnUpload").addEventListener("click", uploadVideo);
        document.getElementById("btnRefresh").addEventListener("click", loadVideos);
    }
});