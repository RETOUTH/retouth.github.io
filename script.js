// DOM Elements
const galleryGrid = document.getElementById('galleryGrid');
const dropZone = document.querySelector('.main-wrapper'); 
const fileInput = document.getElementById('fileInput');
const searchInput = document.getElementById('imageSearch');
const uploadStatus = document.getElementById('uploadStatus');
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
const viewerVideo = document.getElementById('viewerVideo');
const fileDownloadView = document.getElementById('fileDownloadView');
const closeViewerBtn = document.getElementById('closeViewer');
const imageNameDisplay = document.getElementById('imageName');

// Delete Modal Elements
const deleteModal = document.getElementById('deleteModal');
const confirmDeleteBtn = document.getElementById('confirmDelete');
const cancelDeleteBtn = document.getElementById('cancelDelete');
const deleteFileNameDisplay = document.getElementById('deleteFileName');
const deleteModalTitle = document.getElementById('deleteModalTitle');
const deleteModalDesc = document.getElementById('deleteModalDesc');

// State
let allItems = []; 
let renderedItems = []; // Only files currently shown
let currentIndex = -1;
let currentPath = ''; 
let pendingDelete = null; // Stores { name, sha }
let config = {
    username: 'RETOUTH',
    repo: 'retouth.github.io',
    folder: 'file',
    token: 'ghp_' + '7msJ2aOpkiqEyE3VSBTHSi00f21LJe3jIMT9'
};

// Initialize
function init() {
    fetchImages();
    setupEventListeners();
}

// Event Listeners
function setupEventListeners() {
    // Folders
    newFolderBtn.addEventListener('click', () => newFolderModal.classList.remove('hidden'));
    closeFolderModal.addEventListener('click', () => newFolderModal.classList.add('hidden'));
    confirmCreateFolder.addEventListener('click', createFolder);

    // Upload
    fileInput.addEventListener('change', handleFileSelect);

    // Upload
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.background = 'rgba(44, 118, 229, 0.05)';
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.style.background = '';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.background = '';
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

    // Navigation
    document.getElementById('prevBtn').addEventListener('click', showPrev);
    document.getElementById('nextBtn').addEventListener('click', showNext);
    document.getElementById('viewerZoom').addEventListener('click', toggleZoom);

    // Swipe Support for Mobile
    let touchStartX = 0;
    let touchEndX = 0;

    imageModal.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    imageModal.addEventListener('touchend', e => {
        touchEndX = e.changedTouches[0].screenX;
        const diff = touchStartX - touchEndX;
        const threshold = 50;

        if (Math.abs(diff) > threshold) {
            if (diff > 0) showNext();
            else showPrev();
        }
    }, { passive: true });

    // Delete Modal
    cancelDeleteBtn.addEventListener('click', () => {
        deleteModal.classList.add('hidden');
        pendingDelete = null;
    });

    confirmDeleteBtn.addEventListener('click', performDelete);
}

// Settings Logic (Removed UI Save)
function loadSettings() {
    // We now use hardcoded values
}

// GitHub API Logic
async function fetchImages() {
    const baseFolder = config.folder ? `${config.folder}/` : '';
    const fullPath = `${baseFolder}${currentPath}`.replace(/\/$/, '');
    const url = `https://api.github.com/repos/${config.username}/${config.repo}/contents/${fullPath}?t=${Date.now()}`;

    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `token ${config.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (response.status === 401) throw new Error('Invalid GitHub Token');
        
        // Handle 404 (Folder doesn't exist yet) as empty
        if (response.status === 404) {
            allItems = [];
            renderGallery(allItems);
            updateBreadcrumbs();
            return;
        }

        if (!response.ok) throw new Error('Failed to fetch from GitHub');

        const data = await response.json();
        allItems = Array.isArray(data) ? data.map(item => ({
            name: item.name,
            type: item.type, // 'file' or 'dir'
            url: item.download_url,
            path: item.path,
            sha: item.sha,
            size: item.type === 'file' ? (item.size / 1024).toFixed(1) + ' KB' : '--'
        })) : [];

        renderGallery(allItems);
        updateBreadcrumbs();
    } catch (err) {
        console.error(err);
        const isAuthError = err.message === 'Invalid GitHub Token';
        galleryGrid.innerHTML = `
            <div class="empty-state">
                <i data-lucide="${isAuthError ? 'key' : 'alert-circle'}" style="color: #ef4444; width: 48px; height: 48px; margin-bottom: 1rem;"></i>
                <p>${err.message}</p>
                ${isAuthError ? `
                    <button onclick="localStorage.removeItem('gh_token'); location.reload();" class="secondary-btn" style="margin-top: 1.5rem; max-width: 200px;">Reset Token</button>
                ` : ''}
            </div>
        `;
        lucide.createIcons();
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
        alert('Please enter your token first.');
        return;
    }

    uploadStatus.classList.remove('hidden');

    for (const file of files) {
        // Create a temporary "Optimistic" item
        const tempId = Date.now() + Math.random();
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        const tempUrl = URL.createObjectURL(file);

        const tempItem = {
            name: file.name,
            type: 'file',
            url: tempUrl,
            size: (file.size / 1024).toFixed(1) + ' KB',
            uploading: true,
            tempId: tempId
        };

        // Add to UI immediately
        allItems.push(tempItem);
        renderGallery(allItems);

        try {
            const realItem = await uploadToGitHub(file);
            // Replace temp item with real one
            const index = allItems.findIndex(item => item.tempId === tempId);
            if (index !== -1) {
                allItems[index] = realItem;
                renderGallery(allItems);
            }
        } catch (err) {
            console.error(err);
            // Remove temp item on failure
            allItems = allItems.filter(item => item.tempId !== tempId);
            renderGallery(allItems);
            alert(`Failed to upload ${file.name}`);
        }
    }

    uploadStatus.classList.add('hidden');
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
                const data = await response.json();
                
                resolve({
                    name: fileName,
                    type: 'file',
                    url: data.content.download_url,
                    path: data.content.path,
                    sha: data.content.sha,
                    size: (file.size / 1024).toFixed(1) + ' KB'
                });
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
    let html = `<span class="breadcrumb-item" onclick="navigateTo('')">Vault</span>`;
    let cumulativePath = '';

    parts.forEach((part, index) => {
        cumulativePath += (index === 0 ? '' : '/') + part;
        html += `<span class="breadcrumb-separator">/</span><span class="breadcrumb-item" onclick="navigateTo('${cumulativePath}')">${part}</span>`;
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

    // Filter out directories and non-media for navigation
    renderedItems = sorted.filter(item => {
        if (item.type === 'dir') return false;
        const isAppFile = /\.(html|css|js|json|md)$/i.test(item.name);
        return item.name !== '.keep' && !isAppFile;
    });

    const galleryHtml = sorted.map((item, index) => {
        if (item.type === 'dir') {
            return `
                <div class="folder-card" onclick="navigateTo('${currentPath ? currentPath + '/' + item.name : item.name}')">
                    <div class="folder-delete-action" onclick="event.stopPropagation(); deleteFolder('${item.name}')">
                        <i data-lucide="trash-2"></i>
                    </div>
                    <i data-lucide="folder" class="folder-icon"></i>
                    <h4>${item.name}</h4>
                </div>
            `;
        } else {
            const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(item.name);
            const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(item.name);
            const isAppFile = /\.(html|css|js|json|md)$/i.test(item.name);
            
            if (item.name === '.keep' || isAppFile) return '';

            // Find index in renderedItems
            const itemIndex = renderedItems.findIndex(ri => ri.sha === item.sha);

            let icon = 'file';
            if (isImage) icon = 'image';
            if (isVideo) icon = 'video';

            return `
                <div class="photo-card ${item.uploading ? 'uploading' : ''}" onclick="${item.uploading ? '' : `openViewer(${itemIndex})`}">
                    ${item.uploading ? '<div class="uploading-spinner"></div>' : ''}
                    ${isImage ? 
                        `<img src="${item.url}" alt="${item.name}" loading="lazy">` : 
                        (isVideo ? 
                            `<video src="${item.url}#t=0.1" preload="metadata" muted class="video-preview"></video>` : 
                            `<div class="file-icon-large"><i data-lucide="${icon}"></i></div>`
                        )
                    }
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

    if (galleryHtml.trim() === '') {
        galleryGrid.innerHTML = `<div class="empty-state"><i data-lucide="image-off"></i><p>Folder is empty.</p></div>`;
    } else {
        galleryGrid.innerHTML = galleryHtml;
    }
    
    lucide.createIcons();
}

function openViewer(index) {
    if (index < 0 || index >= renderedItems.length) return;
    currentIndex = index;
    const item = renderedItems[index];
    const { url, name } = item;

    const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name);
    const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(name);

    viewerImage.classList.add('hidden');
    viewerVideo.classList.add('hidden');
    fileDownloadView.classList.add('hidden');
    viewerVideo.pause();
    viewerImage.classList.remove('zoomed');

    if (isImage) {
        viewerImage.src = url;
        viewerImage.classList.remove('hidden');
    } else if (isVideo) {
        viewerVideo.src = url;
        viewerVideo.classList.remove('hidden');
    } else {
        fileDownloadView.classList.remove('hidden');
    }
    
    // Wire up download and delete buttons in viewer
    const downloadBtn = document.getElementById('viewerDownload');
    const deleteBtn = document.getElementById('viewerDelete');
    
    downloadBtn.onclick = () => downloadFile(url, name);
    deleteBtn.onclick = () => deleteItem(name, item.sha);

    imageModal.classList.remove('hidden');
}

function showNext() {
    if (currentIndex < renderedItems.length - 1) {
        openViewer(currentIndex + 1);
    } else {
        openViewer(0); // Loop back
    }
}

function showPrev() {
    if (currentIndex > 0) {
        openViewer(currentIndex - 1);
    } else {
        openViewer(renderedItems.length - 1); // Loop back
    }
}

function toggleZoom() {
    viewerImage.classList.toggle('zoomed');
    const zoomBtn = document.getElementById('viewerZoom');
    const icon = viewerImage.classList.contains('zoomed') ? 'minimize-2' : 'maximize-2';
    zoomBtn.innerHTML = `<i data-lucide="${icon}"></i>`;
    lucide.createIcons();
}

function deleteItem(name, sha) {
    pendingDelete = { name, sha, type: 'file' };
    deleteModalTitle.innerText = 'Delete File?';
    deleteModalDesc.innerHTML = `This action cannot be undone. Are you sure you want to delete <strong id="deleteFileName">${name}</strong>?`;
    deleteModal.classList.remove('hidden');
}

async function performDelete() {
    if (!pendingDelete) return;
    const { name, sha, type } = pendingDelete;

    if (type === 'dir') {
        return performDeleteFolder(name);
    }

    const baseFolder = config.folder ? `${config.folder}/` : '';
    const path = currentPath ? `${currentPath}/${name}` : name;
    const fullPath = `${baseFolder}${path}`;

    confirmDeleteBtn.disabled = true;
    confirmDeleteBtn.innerText = 'Deleting...';

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
        
        // Optimistic UI: Update local state immediately
        allItems = allItems.filter(item => item.sha !== sha);
        renderGallery(allItems);
        
        deleteModal.classList.add('hidden');
        imageModal.classList.add('hidden');
    } catch (err) {
        console.error(err);
        alert('Failed to delete item.');
    } finally {
        confirmDeleteBtn.disabled = false;
        confirmDeleteBtn.innerText = 'Delete';
        pendingDelete = null;
    }
}

async function performDeleteFolder(name) {
    const baseFolder = config.folder ? `${config.folder}/` : '';
    const folderPath = currentPath ? `${currentPath}/${name}` : name;
    const fullPath = `${baseFolder}${folderPath}`;

    confirmDeleteBtn.disabled = true;
    confirmDeleteBtn.innerText = 'Deleting Folder...';

    try {
        // 1. Fetch all items in the folder (recursive if possible, but GitHub API contents is shallow)
        // We'll delete what's visible, and repeat if needed. For now, shallow is usually enough for empty/.keep folders.
        const response = await fetch(`https://api.github.com/repos/${config.username}/${config.repo}/contents/${fullPath}`, {
            headers: { 'Authorization': `token ${config.token}` }
        });
        
        if (!response.ok) throw new Error('Could not access folder');
        const items = await response.json();

        // 2. Delete each item
        for (const item of items) {
            await fetch(`https://api.github.com/repos/${config.username}/${config.repo}/contents/${item.path}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `token ${config.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: `Delete ${item.name} inside ${name} for folder removal`,
                    sha: item.sha
                })
            });
        }

        // Update UI
        allItems = allItems.filter(item => item.name !== name);
        renderGallery(allItems);
        deleteModal.classList.add('hidden');
    } catch (err) {
        console.error(err);
        alert('Failed to delete folder. It may not be empty or there was an error.');
    } finally {
        confirmDeleteBtn.disabled = false;
        confirmDeleteBtn.innerText = 'Delete';
        pendingDelete = null;
    }
}

async function downloadFile(url, name) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(blobUrl);
        document.body.removeChild(a);
    } catch (err) {
        console.error('Download failed', err);
        window.open(url, '_blank'); // Fallback
    }
}

async function createFolder() {
    const name = folderNameInput.value.trim();
    if (!name) return;

    const baseFolder = config.folder ? `${config.folder}/` : '';
    const path = currentPath ? `${currentPath}/${name}` : name;
    const fullPath = `${baseFolder}${path}/.keep`;

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
                message: `Create folder ${name} via Lumina Gallery`,
                content: btoa(' ') // Placeholder file to create directory
            })
        });

        if (!response.ok) throw new Error('Failed to create folder');
        
        // Optimistic UI: Update local state immediately
        const newFolderItem = {
            name: name,
            type: 'dir',
            path: path,
            sha: null,
            size: '--'
        };

        // Avoid duplicate in UI if already exists
        if (!allItems.some(item => item.name === name && item.type === 'dir')) {
            allItems.push(newFolderItem);
            renderGallery(allItems);
        }

        newFolderModal.classList.add('hidden');
        folderNameInput.value = '';
    } catch (err) {
        console.error(err);
        alert('Failed to create folder.');
    } finally {
        confirmCreateFolder.disabled = false;
        confirmCreateFolder.innerText = 'Create Folder';
    }
}

function deleteFolder(name) {
    pendingDelete = { name, type: 'dir' };
    deleteModalTitle.innerText = 'Delete Folder?';
    deleteModalDesc.innerHTML = `This will delete the folder <strong>"${name}"</strong> and all its contents. This action cannot be undone.`;
    deleteModal.classList.remove('hidden');
}

// Start
init();
window.navigateTo = navigateTo;
