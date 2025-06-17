// --- DOM Elements ---
const themeToggleButton = document.getElementById('theme-toggle');
const body = document.body;
const addCategoryBtn = document.getElementById('add-category-btn');
const categoryList = document.getElementById('category-list');
const currentCategoryTitle = document.getElementById('current-category-title');
const addBookmarkBtn = document.getElementById('add-bookmark-btn');
const bookmarkList = document.getElementById('bookmark-list');
const searchInput = document.getElementById('search-input');

// --- Modals (assuming we'll add these to index.html later) ---
// For simplicity in this complete script, we'll create the modal elements dynamically or
// assume their presence and use CSS to hide/show them.
// Let's define placeholders for them now, and ensure HTML is updated later.
// For now, we'll use simple prompts for add/edit.
// To fully meet the "Notion-like" feel, modals are better. Let's create them dynamically.

let addEditBookmarkModal = null;
let addEditCategoryModal = null;
let exportImportModal = null; // For export/import options

// --- IndexedDB Variables ---
let db;
const DB_NAME = 'SuperBookmarkManagerDB'; // Changed name to avoid conflict with previous tests
const DB_VERSION = 2; // Incrementing version for schema changes (adding new fields/indexes)
const BOOKMARKS_STORE_NAME = 'bookmarks';
const CATEGORIES_STORE_NAME = 'categories';

// --- Global State ---
let currentCategoryId = 'all'; // Default to 'all' bookmarks
let categories = []; // Cache for categories
let allBookmarks = []; // Cache for all bookmarks, for searching

// --- IndexedDB Functions ---

/**
 * Opens the IndexedDB database, creating object stores and indexes if needed.
 */
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            db = event.target.result;
            console.log('IndexedDB upgrade needed / creating stores...');

            if (!db.objectStoreNames.contains(CATEGORIES_STORE_NAME)) {
                const categoriesStore = db.createObjectStore(CATEGORIES_STORE_NAME, { keyPath: 'id', autoIncrement: true });
                categoriesStore.createIndex('name', 'name', { unique: true });
                console.log(`Object store '${CATEGORIES_STORE_NAME}' created.`);
            }

            if (!db.objectStoreNames.contains(BOOKMARKS_STORE_NAME)) {
                const bookmarksStore = db.createObjectStore(BOOKMARKS_STORE_NAME, { keyPath: 'id', autoIncrement: true });
                bookmarksStore.createIndex('categoryId', 'categoryId', { unique: false });
                bookmarksStore.createIndex('title', 'title', { unique: false });
                bookmarksStore.createIndex('url', 'url', { unique: false }); // Added index for URL
                bookmarksStore.createIndex('notes', 'notes', { unique: false });
                bookmarksStore.createIndex('tags', 'tags', { unique: false, multiEntry: true });
                console.log(`Object store '${BOOKMARKS_STORE_NAME}' created.`);
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log('IndexedDB opened successfully.');
            resolve(db);
        };

        request.onerror = (event) => {
            console.error('IndexedDB error:', event.target.errorCode, event.target.error);
            reject('IndexedDB error: ' + event.target.errorCode);
        };
    });
}

/**
 * Gets an object store from a transaction.
 * @param {string} storeName The name of the object store.
 * @param {IDBTransactionMode} mode The transaction mode ('readonly' or 'readwrite').
 * @returns {IDBObjectStore} The object store.
 */
function getObjectStore(storeName, mode) {
    const transaction = db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
}

/**
 * Adds an item to an object store.
 * @param {string} storeName The name of the object store.
 * @param {object} item The item to add.
 * @returns {Promise<number>} A promise that resolves with the ID of the added item.
 */
async function addItem(storeName, item) {
    return new Promise((resolve, reject) => {
        const store = getObjectStore(storeName, 'readwrite');
        const request = store.add(item);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Gets all items from an object store.
 * @param {string} storeName The name of the object store.
 * @returns {Promise<Array<object>>} A promise that resolves with an array of items.
 */
async function getAllItems(storeName) {
    return new Promise((resolve, reject) => {
        const store = getObjectStore(storeName, 'readonly');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Updates an item in an object store.
 * @param {string} storeName The name of the object store.
 * @param {object} item The item to update (must include keyPath).
 * @returns {Promise<void>} A promise that resolves when the item is updated.
 */
async function updateItem(storeName, item) {
    return new Promise((resolve, reject) => {
        const store = getObjectStore(storeName, 'readwrite');
        const request = store.put(item); // 'put' works for both add and update
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * Deletes an item from an object store by ID.
 * @param {string} storeName The name of the object store.
 * @param {number} id The ID of the item to delete.
 * @returns {Promise<void>} A promise that resolves when the item is deleted.
 */
async function deleteItem(storeName, id) {
    return new Promise((resolve, reject) => {
        const store = getObjectStore(storeName, 'readwrite');
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * Clears all items from an object store.
 * @param {string} storeName The name of the object store.
 * @returns {Promise<void>} A promise that resolves when the store is cleared.
 */
async function clearStore(storeName) {
    return new Promise((resolve, reject) => {
        const store = getObjectStore(storeName, 'readwrite');
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// --- Dark/Light Mode ---
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        body.classList.add(savedTheme);
    } else {
        // Default to system preference if no theme saved
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            body.classList.add('dark-mode');
            localStorage.setItem('theme', 'dark-mode');
        } else {
            body.classList.add('light-mode');
            localStorage.setItem('theme', 'light-mode');
        }
    }
}

function toggleTheme() {
    if (body.classList.contains('dark-mode')) {
        body.classList.remove('dark-mode');
        body.classList.add('light-mode');
        localStorage.setItem('theme', 'light-mode');
    } else {
        body.classList.remove('light-mode');
        body.classList.add('dark-mode');
        localStorage.setItem('theme', 'dark-mode');
    }
}

// --- Category Management Functions ---

/**
 * Renders the list of categories in the sidebar.
 */
async function renderCategories() {
    categories = await getAllItems(CATEGORIES_STORE_NAME);
    // Sort categories by their displayOrder if present, otherwise by name
    categories.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0) || a.name.localeCompare(b.name));

    categoryList.innerHTML = ''; // Clear existing categories

    // Add "All Bookmarks" default category
    const allBookmarksItem = document.createElement('li');
    allBookmarksItem.classList.add('category-item', 'draggable');
    allBookmarksItem.dataset.categoryId = 'all';
    allBookmarksItem.draggable = true;
    allBookmarksItem.innerHTML = `
        <span>All Bookmarks</span>
        <div class="category-actions"></div>
    `;
    categoryList.appendChild(allBookmarksItem);

    categories.forEach(category => {
        const li = document.createElement('li');
        li.classList.add('category-item', 'draggable');
        li.dataset.categoryId = category.id;
        li.draggable = true; // Enable drag
        li.innerHTML = `
            <span>${category.name}</span>
            <div class="category-actions">
                <button class="edit-category-btn" data-id="${category.id}">✏️</button>
                <button class="delete-category-btn" data-id="${category.id}">🗑️</button>
            </div>
        `;
        categoryList.appendChild(li);
    });

    // Add active class to current category
    const activeItem = categoryList.querySelector(`[data-category-id="${currentCategoryId}"]`);
    if (activeItem) {
        activeItem.classList.add('active');
    }

    attachCategoryEventListeners();
    attachDragAndDropListeners(categoryList, handleCategoryDrop);
    renderBookmarks(currentCategoryId); // Re-render bookmarks for the currently active category
}

/**
 * Handles adding a new category.
 */
async function addNewCategory() {
    const categoryName = prompt('Enter new category name:');
    if (categoryName && categoryName.trim()) {
        try {
            // Check for duplicate name
            const existingCategories = await getAllItems(CATEGORIES_STORE_NAME);
            if (existingCategories.some(cat => cat.name.toLowerCase() === categoryName.trim().toLowerCase())) {
                alert('A category with this name already exists.');
                return;
            }

            const newCategory = {
                name: categoryName.trim(),
                displayOrder: categories.length // Simple order based on current count
            };
            await addItem(CATEGORIES_STORE_NAME, newCategory);
            renderCategories(); // Re-render to show new category
        } catch (error) {
            console.error('Error adding category:', error);
            alert('Failed to add category. Make sure the name is unique.');
        }
    }
}

/**
 * Handles editing an existing category.
 * @param {number} id The ID of the category to edit.
 */
async function editCategory(id) {
    const categoryToEdit = categories.find(cat => cat.id === id);
    if (!categoryToEdit) return;

    const newName = prompt('Edit category name:', categoryToEdit.name);
    if (newName && newName.trim() && newName.trim() !== categoryToEdit.name) {
        try {
            // Check for duplicate name if changed
            const existingCategories = await getAllItems(CATEGORIES_STORE_NAME);
            if (existingCategories.some(cat => cat.id !== id && cat.name.toLowerCase() === newName.trim().toLowerCase())) {
                alert('A category with this name already exists.');
                return;
            }
            categoryToEdit.name = newName.trim();
            await updateItem(CATEGORIES_STORE_NAME, categoryToEdit);
            renderCategories();
        } catch (error) {
            console.error('Error editing category:', error);
            alert('Failed to edit category.');
        }
    }
}

/**
 * Handles deleting a category.
 * @param {number} id The ID of the category to delete.
 */
async function deleteCategory(id) {
    if (confirm('Are you sure you want to delete this category? All bookmarks in this category will become uncategorized.')) {
        try {
            // Update bookmarks to remove their categoryId if they belong to this category
            const bookmarksToUpdate = allBookmarks.filter(b => b.categoryId === id);
            for (const bookmark of bookmarksToUpdate) {
                bookmark.categoryId = null; // Set to null or a default 'uncategorized' ID
                await updateItem(BOOKMARKS_STORE_NAME, bookmark);
            }

            await deleteItem(CATEGORIES_STORE_NAME, id);
            // If the deleted category was active, switch to 'all'
            if (currentCategoryId === id) {
                currentCategoryId = 'all';
            }
            renderCategories(); // Re-render categories and bookmarks
        } catch (error) {
            console.error('Error deleting category:', error);
            alert('Failed to delete category.');
        }
    }
}

/**
 * Attaches event listeners to category items.
 */
function attachCategoryEventListeners() {
    categoryList.querySelectorAll('.category-item').forEach(item => {
        item.removeEventListener('click', handleCategoryClick); // Prevent duplicate listeners
        item.addEventListener('click', handleCategoryClick);
    });

    categoryList.querySelectorAll('.edit-category-btn').forEach(btn => {
        btn.removeEventListener('click', handleEditCategoryClick);
        btn.addEventListener('click', handleEditCategoryClick);
    });

    categoryList.querySelectorAll('.delete-category-btn').forEach(btn => {
        btn.removeEventListener('click', handleDeleteCategoryClick);
        btn.addEventListener('click', handleDeleteCategoryClick);
    });
}

function handleCategoryClick(event) {
    // Prevent activating category when clicking edit/delete buttons
    if (event.target.closest('.category-actions')) {
        return;
    }
    const selectedCategoryId = event.currentTarget.dataset.categoryId;
    currentCategoryId = selectedCategoryId === 'all' ? 'all' : parseInt(selectedCategoryId, 10);

    // Remove active class from all categories
    categoryList.querySelectorAll('.category-item').forEach(item => item.classList.remove('active'));
    // Add active class to the clicked category
    event.currentTarget.classList.add('active');

    renderBookmarks(currentCategoryId);
}

function handleEditCategoryClick(event) {
    event.stopPropagation(); // Prevent category click from firing
    const categoryId = parseInt(event.currentTarget.dataset.id, 10);
    editCategory(categoryId);
}

function handleDeleteCategoryClick(event) {
    event.stopPropagation(); // Prevent category click from firing
    const categoryId = parseInt(event.currentTarget.dataset.id, 10);
    deleteCategory(categoryId);
}

// --- Bookmark Management Functions ---

/**
 * Renders bookmarks based on the active category or search query.
 * @param {number|string} categoryId The ID of the category to filter by, or 'all'.
 * @param {string} searchQuery Optional search query.
 */
async function renderBookmarks(categoryId = currentCategoryId, searchQuery = searchInput.value) {
    allBookmarks = await getAllItems(BOOKMARKS_STORE_NAME); // Always get all for search
    bookmarkList.innerHTML = ''; // Clear existing bookmarks

    currentCategoryTitle.textContent = 'All Bookmarks'; // Default title
    if (categoryId !== 'all') {
        const selectedCategory = categories.find(cat => cat.id === categoryId);
        if (selectedCategory) {
            currentCategoryTitle.textContent = selectedCategory.name;
        }
    }

    let filteredBookmarks = allBookmarks;

    // 1. Filter by category
    if (categoryId !== 'all') {
        filteredBookmarks = filteredBookmarks.filter(bookmark => bookmark.categoryId === categoryId);
    }

    // 2. Filter by search query
    if (searchQuery.trim() !== '') {
        const lowerCaseQuery = searchQuery.trim().toLowerCase();
        filteredBookmarks = filteredBookmarks.filter(bookmark =>
            bookmark.title.toLowerCase().includes(lowerCaseQuery) ||
            bookmark.url.toLowerCase().includes(lowerCaseQuery) ||
            bookmark.notes.toLowerCase().includes(lowerCaseQuery) ||
            (bookmark.tags && bookmark.tags.some(tag => tag.toLowerCase().includes(lowerCaseQuery)))
        );
    }

    // Sort bookmarks by displayOrder if available, otherwise by title
    filteredBookmarks.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0) || a.title.localeCompare(b.title));

    if (filteredBookmarks.length === 0) {
        bookmarkList.innerHTML = '<div class="no-bookmarks">No bookmarks found.</div>';
        return;
    }

    filteredBookmarks.forEach(bookmark => {
        const div = document.createElement('div');
        div.classList.add('bookmark-item', 'draggable');
        div.dataset.bookmarkId = bookmark.id;
        div.draggable = true; // Enable drag
        div.innerHTML = `
            <h3><a href="${bookmark.url}" target="_blank" rel="noopener noreferrer">${bookmark.title}</a></h3>
            <p class="bookmark-url">${bookmark.url}</p>
            <p class="bookmark-notes">${bookmark.notes || 'No notes.'}</p>
            <p class="bookmark-tags">Tags: ${bookmark.tags && bookmark.tags.length > 0 ? bookmark.tags.join(', ') : 'None'}</p>
            <div class="bookmark-actions">
                <button class="edit-bookmark-btn" data-id="${bookmark.id}">✏️</button>
                <button class="delete-bookmark-btn" data-id="${bookmark.id}">🗑️</button>
            </div>
        `;
        bookmarkList.appendChild(div);
    });

    attachBookmarkEventListeners();
    attachDragAndDropListeners(bookmarkList, handleBookmarkDrop);
}

/**
 * Handles adding a new bookmark.
 */
async function addNewBookmark(bookmarkToEdit = null) {
    // Dynamically create a simple modal for input
    const modal = createBookmarkModal(bookmarkToEdit);
    document.body.appendChild(modal);

    const form = modal.querySelector('form');
    const titleInput = document.getElementById('bookmark-title');
    const urlInput = document.getElementById('bookmark-url');
    const notesInput = document.getElementById('bookmark-notes');
    const tagsInput = document.getElementById('bookmark-tags');
    const categorySelect = document.getElementById('bookmark-category');
    const cancelButton = modal.querySelector('.cancel-btn');

    // Populate categories in the select dropdown
    categorySelect.innerHTML = '<option value="">-- Select Category (Optional) --</option>';
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name;
        if (bookmarkToEdit && bookmarkToEdit.categoryId === cat.id) {
            option.selected = true;
        } else if (currentCategoryId !== 'all' && currentCategoryId === cat.id && !bookmarkToEdit) {
            // Pre-select current category when adding a new bookmark
            option.selected = true;
        }
        categorySelect.appendChild(option);
    });

    if (bookmarkToEdit) {
        titleInput.value = bookmarkToEdit.title;
        urlInput.value = bookmarkToEdit.url;
        notesInput.value = bookmarkToEdit.notes;
        tagsInput.value = bookmarkToEdit.tags ? bookmarkToEdit.tags.join(', ') : '';
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const title = titleInput.value.trim();
        const url = urlInput.value.trim();
        const notes = notesInput.value.trim();
        const tags = tagsInput.value.trim().split(',').map(tag => tag.trim()).filter(tag => tag !== '');
        const categoryId = categorySelect.value ? parseInt(categorySelect.value, 10) : null;

        if (!title || !url) {
            alert('Bookmark Title and URL are required!');
            return;
        }

        try {
            if (bookmarkToEdit) {
                // Update existing bookmark
                bookmarkToEdit.title = title;
                bookmarkToEdit.url = url;
                bookmarkToEdit.notes = notes;
                bookmarkToEdit.tags = tags;
                bookmarkToEdit.categoryId = categoryId;
                await updateItem(BOOKMARKS_STORE_NAME, bookmarkToEdit);
            } else {
                // Add new bookmark
                const newBookmark = {
                    title,
                    url,
                    notes,
                    tags,
                    categoryId,
                    displayOrder: allBookmarks.length // Simple order
                };
                await addItem(BOOKMARKS_STORE_NAME, newBookmark);
            }
            modal.remove(); // Close modal
            renderBookmarks(currentCategoryId); // Re-render bookmarks
        } catch (error) {
            console.error('Error saving bookmark:', error);
            alert('Failed to save bookmark.');
        }
    });

    cancelButton.addEventListener('click', () => {
        modal.remove();
    });
}

/**
 * Creates and returns the HTML for the add/edit bookmark modal.
 * @param {object} bookmark The bookmark object if editing, otherwise null.
 * @returns {HTMLElement} The modal div element.
 */
function createBookmarkModal(bookmark = null) {
    const modal = document.createElement('div');
    modal.classList.add('modal-overlay');
    modal.innerHTML = `
        <div class="modal-content">
            <h2>${bookmark ? 'Edit Bookmark' : 'Add New Bookmark'}</h2>
            <form>
                <div class="form-group">
                    <label for="bookmark-title">Title:</label>
                    <input type="text" id="bookmark-title" required>
                </div>
                <div class="form-group">
                    <label for="bookmark-url">URL:</label>
                    <input type="url" id="bookmark-url" required placeholder="https://example.com">
                </div>
                <div class="form-group">
                    <label for="bookmark-notes">Notes:</label>
                    <textarea id="bookmark-notes" rows="3"></textarea>
                </div>
                <div class="form-group">
                    <label for="bookmark-tags">Tags (comma-separated):</label>
                    <input type="text" id="bookmark-tags" placeholder="coding, css, tutorial">
                </div>
                 <div class="form-group">
                    <label for="bookmark-category">Category:</label>
                    <select id="bookmark-category"></select>
                </div>
                <div class="modal-actions">
                    <button type="submit">${bookmark ? 'Update' : 'Add'} Bookmark</button>
                    <button type="button" class="cancel-btn">Cancel</button>
                </div>
            </form>
        </div>
    `;
    return modal;
}


/**
 * Handles editing an existing bookmark.
 * @param {number} id The ID of the bookmark to edit.
 */
async function editBookmark(id) {
    const bookmarkToEdit = allBookmarks.find(b => b.id === id);
    if (bookmarkToEdit) {
        addNewBookmark(bookmarkToEdit); // Reuse add function for editing
    }
}

/**
 * Handles deleting a bookmark.
 * @param {number} id The ID of the bookmark to delete.
 */
async function deleteBookmark(id) {
    if (confirm('Are you sure you want to delete this bookmark?')) {
        try {
            await deleteItem(BOOKMARKS_STORE_NAME, id);
            renderBookmarks(currentCategoryId); // Re-render bookmarks
        } catch (error) {
            console.error('Error deleting bookmark:', error);
            alert('Failed to delete bookmark.');
        }
    }
}

/**
 * Attaches event listeners to bookmark items.
 */
function attachBookmarkEventListeners() {
    bookmarkList.querySelectorAll('.edit-bookmark-btn').forEach(btn => {
        btn.removeEventListener('click', handleEditBookmarkClick);
        btn.addEventListener('click', handleEditBookmarkClick);
    });

    bookmarkList.querySelectorAll('.delete-bookmark-btn').forEach(btn => {
        btn.removeEventListener('click', handleDeleteBookmarkClick);
        btn.addEventListener('click', handleDeleteBookmarkClick);
    });
}

function handleEditBookmarkClick(event) {
    const bookmarkId = parseInt(event.currentTarget.dataset.id, 10);
    editBookmark(bookmarkId);
}

function handleDeleteBookmarkClick(event) {
    const bookmarkId = parseInt(event.currentTarget.dataset.id, 10);
    deleteBookmark(bookmarkId);
}


// --- Search Functionality ---
function handleSearchInput() {
    renderBookmarks(currentCategoryId, searchInput.value);
}

// --- Export/Import Functions ---
function createExportImportModal() {
    const modal = document.createElement('div');
    modal.classList.add('modal-overlay');
    modal.innerHTML = `
        <div class="modal-content">
            <h2>Export / Import Bookmarks</h2>
            <div class="form-group">
                <button id="export-data-btn">Export All Data (JSON)</button>
            </div>
            <div class="form-group">
                <label for="import-file-input">Import Data (JSON):</label>
                <input type="file" id="import-file-input" accept=".json">
                <button id="import-data-btn">Import Data</button>
            </div>
            <p style="font-size: 0.9em; color: gray;">Note: Importing will overwrite existing data with the same IDs.</p>
            <div class="modal-actions">
                <button type="button" class="cancel-btn">Close</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('.cancel-btn').addEventListener('click', () => modal.remove());
    modal.querySelector('#export-data-btn').addEventListener('click', exportData);
    modal.querySelector('#import-data-btn').addEventListener('click', importData);
}


async function exportData() {
    try {
        const allCategories = await getAllItems(CATEGORIES_STORE_NAME);
        const allBookmarks = await getAllItems(BOOKMARKS_STORE_NAME);

        const dataToExport = {
            categories: allCategories,
            bookmarks: allBookmarks
        };

        const jsonString = JSON.stringify(dataToExport, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `bookmark_data_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert('Data exported successfully!');
    } catch (error) {
        console.error('Error exporting data:', error);
        alert('Failed to export data.');
    }
}

async function importData() {
    const fileInput = document.getElementById('import-file-input');
    const file = fileInput.files[0];

    if (!file) {
        alert('Please select a JSON file to import.');
        return;
    }

    if (!confirm('Importing data will overwrite existing bookmarks and categories if IDs conflict. Are you sure you want to proceed?')) {
        return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const importedData = JSON.parse(event.target.result);

            if (importedData.categories && Array.isArray(importedData.categories)) {
                // Clear existing categories and then add imported ones
                await clearStore(CATEGORIES_STORE_NAME);
                for (const category of importedData.categories) {
                    try {
                         await updateItem(CATEGORIES_STORE_NAME, category); // Use put to handle existing IDs
                    } catch (e) {
                         // If 'put' fails due to unique index (e.g., name conflict for a new ID), try add
                        console.warn('Conflict adding category, skipping or trying different method:', category.name, e);
                        // A more robust solution might generate new IDs or merge. For simplicity, `put` will replace.
                    }
                }
            }

            if (importedData.bookmarks && Array.isArray(importedData.bookmarks)) {
                // Clear existing bookmarks and then add imported ones
                await clearStore(BOOKMARKS_STORE_NAME);
                for (const bookmark of importedData.bookmarks) {
                    try {
                        await updateItem(BOOKMARKS_STORE_NAME, bookmark); // Use put to handle existing IDs
                    } catch (e) {
                         console.warn('Conflict adding bookmark, skipping or trying different method:', bookmark.title, e);
                    }
                }
            }
            alert('Data imported successfully! Please refresh the page if you encounter issues.');
            document.querySelector('.modal-overlay').remove(); // Close modal
            await initApp(); // Re-initialize app to display new data
        } catch (error) {
            console.error('Error importing data:', error);
            alert('Failed to import data. Please ensure it\'s a valid JSON file.');
        }
    };
    reader.readAsText(file);
}

// --- Drag and Drop Functions ---
let draggedItem = null;

function attachDragAndDropListeners(container, dropHandler) {
    container.querySelectorAll('.draggable').forEach(item => {
        item.removeEventListener('dragstart', handleDragStart);
        item.removeEventListener('dragover', handleDragOver);
        item.removeEventListener('dragleave', handleDragLeave);
        item.removeEventListener('drop', dropHandler);
        item.removeEventListener('dragend', handleDragEnd);

        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('dragleave', handleDragLeave);
        item.addEventListener('drop', dropHandler);
        item.addEventListener('dragend', handleDragEnd);
    });
}

function handleDragStart(event) {
    draggedItem = event.target;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/html', draggedItem.outerHTML);
    draggedItem.classList.add('dragging');
}

function handleDragOver(event) {
    event.preventDefault(); // Essential to allow drop
    event.dataTransfer.dropEffect = 'move';
    const target = event.target.closest('.draggable');
    if (target && target !== draggedItem && target.parentNode === draggedItem.parentNode) {
        const rect = target.getBoundingClientRect();
        const midpoint = rect.y + rect.height / 2;
        if (event.clientY > midpoint) {
            target.parentNode.insertBefore(draggedItem, target.nextSibling);
        } else {
            target.parentNode.insertBefore(draggedItem, target);
        }
    }
}

function handleDragLeave(event) {
    // No specific action needed here for this simple implementation
}

async function handleCategoryDrop(event) {
    event.preventDefault();
    if (draggedItem && draggedItem !== event.target.closest('.draggable')) {
        draggedItem.classList.remove('dragging');
        await updateCategoryOrder();
    }
}

async function handleBookmarkDrop(event) {
    event.preventDefault();
    if (draggedItem && draggedItem !== event.target.closest('.draggable')) {
        draggedItem.classList.remove('dragging');
        await updateBookmarkOrder();
    }
}

function handleDragEnd(event) {
    draggedItem.classList.remove('dragging');
    draggedItem = null;
}

/**
 * Updates the displayOrder of categories based on their current DOM position.
 */
async function updateCategoryOrder() {
    const categoryElements = Array.from(categoryList.children).filter(el => el.dataset.categoryId !== 'all');
    for (let i = 0; i < categoryElements.length; i++) {
        const id = parseInt(categoryElements[i].dataset.categoryId, 10);
        const category = categories.find(cat => cat.id === id);
        if (category && category.displayOrder !== i) {
            category.displayOrder = i;
            await updateItem(CATEGORIES_STORE_NAME, category);
        }
    }
    await renderCategories(); // Re-render to ensure state is consistent
}

/**
 * Updates the displayOrder of bookmarks based on their current DOM position.
 */
async function updateBookmarkOrder() {
    const bookmarkElements = Array.from(bookmarkList.children).filter(el => el.classList.contains('bookmark-item'));
    for (let i = 0; i < bookmarkElements.length; i++) {
        const id = parseInt(bookmarkElements[i].dataset.bookmarkId, 10);
        const bookmark = allBookmarks.find(b => b.id === id);
        if (bookmark && bookmark.displayOrder !== i) {
            bookmark.displayOrder = i;
            await updateItem(BOOKMARKS_STORE_NAME, bookmark);
        }
    }
    await renderBookmarks(currentCategoryId); // Re-render to ensure state is consistent
}


// --- Initialization Function ---
async function initApp() {
    initTheme(); // Set initial theme
    await openDB(); // Open IndexedDB
    await renderCategories(); // Render categories and then bookmarks
    // Initial render of bookmarks will happen inside renderCategories
}

// --- Event Listeners ---
themeToggleButton.addEventListener('click', toggleTheme);
addCategoryBtn.addEventListener('click', addNewCategory);
addBookmarkBtn.addEventListener('click', () => addNewBookmark());
searchInput.addEventListener('input', handleSearchInput);

// Add export/import button (needs to be added to HTML, maybe in header-actions)
// For now, let's create a global one for testing or add it to the header-actions manually.
// You might want to add a button in index.html like this:
// <button id="export-import-btn">Export/Import</button>
// For now, let's create one via JS for quick testing.
const exportImportBtn = document.createElement('button');
exportImportBtn.id = 'export-import-btn';
exportImportBtn.textContent = '📦 Export/Import';
exportImportBtn.style.cssText = `
    padding: 10px 18px;
    border: none;
    border-radius: 8px;
    background-color: var(--secondary-color-light);
    color: white;
    cursor: pointer;
    font-size: 1em;
    transition: background-color 0.2s ease;
    margin-left: 10px;
`;
document.querySelector('.header-actions').appendChild(exportImportBtn);
exportImportBtn.addEventListener('click', createExportImportModal);


// --- Initialize the Application ---
document.addEventListener('DOMContentLoaded', initApp);