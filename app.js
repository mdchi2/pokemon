const API_URL = 'https://api.pokemontcg.io/v2';
const API_KEY = ''; // Opcional, pero recomendado para mejores límites

let currentPage = 1;
const pageSize = 20;
let isLoading = false;
let currentQuery = '';
let currentFilters = {
    types: '',
    rarity: '',
    set: '',
    series: ''
};

let allSets = [];

// DOM Elements
const cardsGrid = document.getElementById('cardsGrid');
const searchInput = document.getElementById('cardSearch');
const clearSearchBtn = document.getElementById('clearSearch');
const filterToggle = document.getElementById('filterToggle');
const filtersPanel = document.getElementById('filtersPanel');
const typeFilter = document.getElementById('typeFilter');
const rarityFilter = document.getElementById('rarityFilter');
const setFilter = document.getElementById('setFilter');
const seriesFilter = document.getElementById('seriesFilter');
const applyFiltersBtn = document.getElementById('applyFilters');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const loader = document.getElementById('loader');
const resultCountText = document.getElementById('resultCount');
const cardModal = document.getElementById('cardModal');
const modalBody = document.getElementById('modalBody');
const closeModalBtn = document.querySelector('.close-modal');

// Init
document.addEventListener('DOMContentLoaded', () => {
    fetchInitialData();
    fetchCards();
    setupEventListeners();
});

async function fetchInitialData() {
    try {
        const [types, rarities, sets] = await Promise.all([
            fetch(`${API_URL}/types`).then(r => r.json()),
            fetch(`${API_URL}/rarities`).then(r => r.json()),
            fetch(`${API_URL}/sets?pageSize=100&orderBy=-releaseDate`).then(r => r.json())
        ]);

        allSets = sets.data || [];
        
        // Extract unique series
        const seriesList = [...new Set(allSets.map(s => s.series).filter(Boolean))];

        fillSelect(typeFilter, types.data);
        fillSelect(rarityFilter, rarities.data);
        fillSelect(seriesFilter, seriesList);
        fillSelect(setFilter, allSets.map(s => ({ name: s.name, id: s.id })), true);
    } catch (error) {
        console.error("Error fetching filter data:", error);
    }
}

function fillSelect(select, data, isSet = false) {
    data.forEach(item => {
        const option = document.createElement('option');
        option.value = isSet ? item.id : item;
        option.textContent = isSet ? item.name : item;
        select.appendChild(option);
    });
}

async function fetchCards(append = false) {
    if (isLoading) return;
    isLoading = true;
    
    if (!append) {
        cardsGrid.innerHTML = '';
        currentPage = 1;
        showSkeleton();
    } else {
        loader.classList.remove('hidden');
        loadMoreBtn.classList.add('hidden');
    }

    try {
        let query = [];
        if (currentQuery) query.push(`name:"*${currentQuery}*"`);
        if (currentFilters.types) query.push(`types:"${currentFilters.types}"`);
        if (currentFilters.rarity) query.push(`rarity:"${currentFilters.rarity}"`);
        if (currentFilters.set) query.push(`set.id:"${currentFilters.set}"`);
        if (currentFilters.series) query.push(`set.series:"${currentFilters.series}"`);

        const queryString = query.length > 0 ? `&q=${query.join(' ')}` : '';
        const response = await fetch(`${API_URL}/cards?page=${currentPage}&pageSize=${pageSize}${queryString}`, {
            headers: API_KEY ? { 'X-Api-Key': API_KEY } : {}
        });
        const data = await response.json();

        if (!append) cardsGrid.innerHTML = '';
        
        renderCards(data.data);
        
        resultCountText.textContent = `Mostrando ${data.count} de ${data.totalCount} cartas`;
        
        if (data.count === pageSize && data.totalCount > currentPage * pageSize) {
            loadMoreBtn.classList.remove('hidden');
        } else {
            loadMoreBtn.classList.add('hidden');
        }

    } catch (error) {
        console.error("Error fetching cards:", error);
        cardsGrid.innerHTML = `<div class="error">Error al cargar las cartas. Por favor, intenta de nuevo.</div>`;
    } finally {
        isLoading = false;
        loader.classList.add('hidden');
        removeSkeleton();
    }
}

function renderCards(cards) {
    cards.forEach(card => {
        const cardEl = document.createElement('div');
        cardEl.className = 'pokemon-card';
        cardEl.innerHTML = `
            <div class="card-image-wrapper">
                <img src="${card.images.small}" alt="${card.name}" loading="lazy">
            </div>
            <div class="card-info">
                <h3 class="card-name">${card.name}</h3>
                <div class="card-meta">
                    <span>${card.number}/${card.set.printedTotal}</span>
                    <span>${card.rarity || 'Común'}</span>
                </div>
            </div>
        `;
        cardEl.addEventListener('click', () => showCardDetails(card.id));
        cardsGrid.appendChild(cardEl);
    });
}

async function showCardDetails(cardId) {
    cardModal.classList.add('active');
    modalBody.innerHTML = `<div class="loader"></div>`;
    
    try {
        const response = await fetch(`${API_URL}/cards/${cardId}`);
        const { data: card } = await response.json();
        
        modalBody.innerHTML = `
            <div class="detail-image">
                <img src="${card.images.large}" alt="${card.name}">
            </div>
            <div class="detail-info">
                <div class="detail-header">
                    <h2>${card.name}</h2>
                    <p>${card.supertype} - ${card.subtypes.join(', ')}</p>
                </div>
                <div class="detail-tags">
                    ${card.types ? card.types.map(t => `<span class="tag tag-type">${t}</span>`).join('') : ''}
                    <span class="tag tag-rarity">${card.rarity || 'Desconocida'}</span>
                </div>
                
                <div class="detail-section">
                    <h3>Set</h3>
                    <p><img src="${card.set.images.symbol}" width="20" style="vertical-align: middle"> ${card.set.name} (${card.set.series})</p>
                </div>

                ${card.attacks ? `
                <div class="detail-section">
                    <h3>Ataques</h3>
                    ${card.attacks.map(attack => `
                        <div class="attack-item">
                            <div class="attack-name">
                                <span>${attack.name}</span>
                                <span>${attack.damage || ''}</span>
                            </div>
                            <p class="attack-desc">${attack.text}</p>
                        </div>
                    `).join('')}
                </div>
                ` : ''}

                <div class="detail-section">
                    <h3>Precios (TCGPlayer)</h3>
                    ${card.tcgplayer ? `
                        <p>Promedio: $${card.tcgplayer.prices.holofoil?.market || card.tcgplayer.prices.normal?.market || 'N/A'}</p>
                        <a href="${card.tcgplayer.url}" target="_blank" class="btn-primary" style="display:inline-block; margin-top:10px; text-decoration:none; text-align:center">Ver en TCGPlayer</a>
                    ` : '<p>No disponible</p>'}
                </div>
            </div>
        `;
    } catch (error) {
        modalBody.innerHTML = `<p>Error al cargar detalles.</p>`;
    }
}

function showSkeleton() {
    for (let i = 0; i < 8; i++) {
        const skel = document.createElement('div');
        skel.className = 'skeleton-card';
        cardsGrid.appendChild(skel);
    }
}

function removeSkeleton() {
    const skeletons = document.querySelectorAll('.skeleton-card');
    skeletons.forEach(s => s.remove());
}

// Event Listeners
function setupEventListeners() {
    // Search with debounce
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
        currentQuery = e.target.value.trim();
        clearSearchBtn.classList.toggle('hidden', !currentQuery);
        
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            fetchCards();
        }, 500);
    });

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        currentQuery = '';
        clearSearchBtn.classList.add('hidden');
        fetchCards();
    });

    filterToggle.addEventListener('click', () => {
        filtersPanel.classList.toggle('active');
    });

    seriesFilter.addEventListener('change', (e) => {
        currentFilters.series = e.target.value;
        updateSetFilterOptions();
        fetchCards();
    });

    applyFiltersBtn.addEventListener('click', () => {
        currentFilters.types = typeFilter.value;
        currentFilters.rarity = rarityFilter.value;
        currentFilters.set = setFilter.value;

        // If a set is selected, ensure the series dropdown aligns with it
        if (currentFilters.set) {
            const selectedSetObj = allSets.find(s => s.id === currentFilters.set);
            if (selectedSetObj && selectedSetObj.series) {
                currentFilters.series = selectedSetObj.series;
                seriesFilter.value = selectedSetObj.series;
                updateSetFilterOptions();
                setFilter.value = currentFilters.set;
            }
        } else if (!currentFilters.series) {
            // If they reset set and there's no series selected in seriesFilter, keep it as is
        }

        filtersPanel.classList.remove('active');
        fetchCards();
    });

    loadMoreBtn.addEventListener('click', () => {
        currentPage++;
        fetchCards(true);
    });

    closeModalBtn.addEventListener('click', () => {
        cardModal.classList.remove('active');
    });

    window.addEventListener('click', (e) => {
        if (e.target === cardModal) cardModal.classList.remove('active');
    });
}

function updateSetFilterOptions() {
    // Clear all except the first option ("Todos los Sets")
    setFilter.innerHTML = '<option value="">Todos los Sets</option>';
    
    // Filter the sets
    let filteredSets = allSets;
    if (currentFilters.series) {
        filteredSets = allSets.filter(s => s.series === currentFilters.series);
    }
    
    // Repopulate
    fillSelect(setFilter, filteredSets.map(s => ({ name: s.name, id: s.id })), true);
    
    // Reset set filter if selected set is not in the new filtered list
    if (currentFilters.set && !filteredSets.some(s => s.id === currentFilters.set)) {
        currentFilters.set = '';
        setFilter.value = '';
    }
}
