// DOM Elements
const galleryGrid = document.getElementById('galleryGrid');
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const searchInput = document.getElementById('imageSearch');
const openSettingsBtn = null; // Removed
const closeSettingsBtn = null; // Removed
const settingsModal = null; // Removed
const saveSettingsBtn = null; // Removed
const uploadStatus = document.getElementById('uploadStatus');
const uploadContent = document.querySelector('.upload-content');
const breadcrumbs = document.getElementById('breadcrumbs');

// New Folder Modal
const newFolderBtn = document.getElementById('newFolderBtn');
const newFolderModal = document.getElementById('newFolderModal');
const closeFolderModal = document.getElementById('closeFolderModal');
const confirmCreateFolder = document.getElementById('confirmCreateFolder');
const folderNameInput = document.getElementById('folderName');

// Settings Elements (Removed UI connections)
const ghUsername = null;
const ghRepo = null;
const ghFolder = null;
const ghToken = null;

// Viewer Elements
const imageModal = document.getElementById('imageModal');
const viewerImage = document.getElementById('viewerImage');
const closeViewerBtn = document.getElementById('closeViewer');
const imageNameDisplay = document.getElementById('imageName');

// State
let allItems = []; // Mixture of files and folders
let currentPath = ''; // Relative to config.folder
let config = {
    username: 'RETOUTH',
    repo: 'GER.github.io',
    folder: 'file',            // โฟลเดอร์หลักสำหรับเก็บรูป
    token: localStorage.getItem('gh_token') || '' 
};

// Initialize
function init() {
    if (!config.token) {
        const token = prompt('Please enter your GitHub Personal Access Token to continue:');
        if (token) {
            config.token = token.trim();
            localStorage.setItem('gh_token', config.token);
            fetchImages();
        } else {
            alert('A GitHub token is required to view and upload images.');
        }
    } else {
        fetchImages();
    }
    setupEventListeners();
}

// Event Listeners
function setupEventListeners() {
    // Folders
    newFolderBtn.addEventListener('click', () => newFolderModal.classList.remove('hidden'));
    closeFolderModal.addEventListener('click', () => newFolderModal.classList.add('hidden'));
    confirmCreateFolder.addEventListener('click', createFolder);

    // Upload
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--accent)';
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = 'var(--glass-border)';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--glass-border)';
        const files = e.dataTransfer.files;
        if (files.length > 0) handleFiles(files);
    });

    // Search
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allItems.filter(p => p.name.toLowerCase().includes(term));
        renderGallery(filtered);
    });

    // Viewer
    closeViewerBtn.addEventListener('click', () => imageModal.classList.add('hidden'));
    imageModal.querySelector('.modal-overlay').addEventListener('click', () => imageModal.classList.add('hidden'));
}

// Settings Logic (Removed UI Save)
function loadSettings() {
    // We now use hardcoded values
}

// GitHub API Logic
async function fetchImages() {
    const baseFolder = config.folder ? `${config.folder}/` : '';
    const fullPath = `${baseFolder}${currentPath}`.replace(/\/$/, '');
    const url = `https://api.github.com/repos/${config.username}/${config.repo}/contents/${fullPath}`;

    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `token ${config.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) throw new Error('Failed to fetch from GitHub');

        const data = await response.json();
        allItems = data.map(item => ({
            name: item.name,
            type: item.type, // 'file' or 'dir'
            url: item.download_url,
            path: item.path,
            sha: item.sha,
            size: item.type === 'file' ? (item.size / 1024).toFixed(1) + ' KB' : '--'
        }));

        renderGallery(allItems);
        updateBreadcrumbs();
    } catch (err) {
        console.error(err);
        galleryGrid.innerHTML = `<div class="empty-state"><p>Error connecting to GitHub. Check settings or path.</p></div>`;
    }
}

async function createFolder() {
    const folderName = folderNameInput.value.trim();
    if (!folderName) return;

    const baseFolder = config.folder ? `${config.folder}/` : '';
    const folderPath = currentPath ? `${currentPath}/${folderName}` : folderName;
    const fullPath = `${baseFolder}${folderPath}/.keep`;

    confirmCreateFolder.disabled = true;
    confirmCreateFolder.innerText = 'Creating...';

    try {
        const response = await fetch(`https://api.github.com/repos/${config.username}/${config.repo}/contents/${fullPath}`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${config.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: `Create folder ${folderName}`,
                content: btoa('This is a placeholder for folder creation.')
            })
        });

        if (!response.ok) throw new Error('Failed to create folder');
        
        folderNameInput.value = '';
        newFolderModal.classList.add('hidden');
        fetchImages();
    } catch (err) {
        console.error(err);
        alert('Failed to create folder.');
    } finally {
        confirmCreateFolder.disabled = false;
        confirmCreateFolder.innerText = 'Create Folder';
    }
}

// Upload Handling
function handleFileSelect(e) {
    handleFiles(e.target.files);
}

async function handleFiles(files) {
    if (!config.token) {
        alert('Please configure GitHub settings first.');
        openSettingsBtn.click();
        return;
    }

    uploadStatus.classList.remove('hidden');
    uploadContent.classList.add('hidden');

    for (const file of files) {
        try {
            await uploadToGitHub(file);
        } catch (err) {
            console.error(err);
            alert(`Failed to upload ${file.name}`);
        }
    }

    uploadStatus.classList.add('hidden');
    uploadContent.classList.remove('hidden');
    fetchImages();
}

async function uploadToGitHub(file) {
    const reader = new FileReader();
    
    return new Promise((resolve, reject) => {
        reader.onload = async () => {
            const base64Content = reader.result.split(',')[1];
            const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
            const baseFolder = config.folder ? `${config.folder}/` : '';
            const path = currentPath ? `${currentPath}/${fileName}` : fileName;
            const fullPath = `${baseFolder}${path}`;

            try {
                const response = await fetch(`https://api.github.com/repos/${config.username}/${config.repo}/contents/${fullPath}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${config.token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        message: `Upload ${fileName} via Lumina Gallery`,
                        content: base64Content
                    })
                });

                if (!response.ok) throw new Error('Upload failed');
                resolve();
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Navigation Logic
function navigateTo(path) {
    currentPath = path;
    fetchImages();
}

function updateBreadcrumbs() {
    const parts = currentPath.split('/').filter(p => p);
    let html = `<span class="breadcrumb-item" onclick="navigateTo('')">Root</span>`;
    let cumulativePath = '';

    parts.forEach((part, index) => {
        cumulativePath += (index === 0 ? '' : '/') + part;
        html += `<span class="breadcrumb-item" onclick="navigateTo('${cumulativePath}')">${part}</span>`;
    });

    breadcrumbs.innerHTML = html;
}

// UI Rendering
function renderGallery(items) {
    if (items.length === 0) {
        galleryGrid.innerHTML = `<div class="empty-state"><i data-lucide="image-off"></i><p>Folder is empty.</p></div>`;
        lucide.createIcons();
        return;
    }

    // Sort: Folders first, then files
    const sorted = [...items].sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'dir' ? -1 : 1;
    });

    galleryGrid.innerHTML = sorted.map(item => {
        if (item.type === 'dir') {
            return `
                <div class="folder-card" onclick="navigateTo('${currentPath ? currentPath + '/' + item.name : item.name}')">
                    <i data-lucide="folder"></i>
                    <h4>${item.name}</h4>
                </div>
            `;
        } else {
            const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(item.name);
            const isAppFile = /\.(html|css|js|json|md)$/i.test(item.name);
            if (item.name === '.keep' || isAppFile) return ''; // Hide placeholder and app source files

            return `
                <div class="photo-card" onclick="${isImage ? `openViewer('${item.url}', '${item.name}')` : ''}">
                    ${isImage ? `<img src="${item.url}" alt="${item.name}" loading="lazy">` : `<div class="file-icon"><i data-lucide="file"></i></div>`}
                    <div class="photo-overlay">
                        <div class="photo-info">
                            <h4>${item.name}</h4>
                            <span>${item.size}</span>
                        </div>
                        <button class="icon-btn" onclick="event.stopPropagation(); deleteItem('${item.name}', '${item.sha}')">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </div>
            `;
        }
    }).join('');
    
    lucide.createIcons();
}

function openViewer(url, name) {
    viewerImage.src = url;
    imageNameDisplay.innerText = name;
    imageModal.classList.remove('hidden');
}

async function deleteItem(name, sha) {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;

    const baseFolder = config.folder ? `${config.folder}/` : '';
    const path = currentPath ? `${currentPath}/${name}` : name;
    const fullPath = `${baseFolder}${path}`;

    try {
        const response = await fetch(`https://api.github.com/repos/${config.username}/${config.repo}/contents/${fullPath}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `token ${config.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: `Delete ${name} via Lumina Gallery`,
                sha: sha
            })
        });

        if (!response.ok) throw new Error('Delete failed');
        fetchImages();
    } catch (err) {
        console.error(err);
        alert('Failed to delete item.');
    }
}

// Start
init();
window.navigateTo = navigateTo; // Make accessible to breadcrumbs
