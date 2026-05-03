const POKE_API_BASE = 'https://pokeapi.co/api/v2/';
let currentLimit = 25;
// State
let offset = 0;
let currentPokemonList = [];
let allTypes = [];
let selectedTypes = [];
let filteredPokemonList = [];
let filteredOffset = 0;
let isFilteredMode = false;
let allPokemonMasterList = []; // Added for partial search
let searchResults = []; // Added to store search results
let searchOffset = 0; // Added for search pagination
let isSearchMode = false; // Added to track search state

// DOM Elements
const pokemonGrid = document.getElementById('pokemon-grid');
const searchInput = document.getElementById('pokemon-search');
const loadMoreBtn = document.getElementById('load-more');
const modal = document.getElementById('pokemon-modal');
const modalBody = document.getElementById('modal-body');
const closeModal = document.querySelector('.close-modal');
const typeFiltersContainer = document.getElementById('type-filters');
const filterToggleBtn = document.getElementById('filter-toggle');
const typeFiltersWrapper = document.getElementById('type-filters-container');
const activeFiltersCount = document.getElementById('active-filters-count');

// Initialize
async function init() {
    await fetchTypes();
    await fetchAllPokemonNames(); // New function to fetch all names for searching
    await fetchPokemon();
    setupEventListeners();
}

async function fetchAllPokemonNames() {
    try {
        const response = await fetch(`${POKE_API_BASE}pokemon?limit=2000`);
        const data = await response.json();
        allPokemonMasterList = data.results;
    } catch (error) {
        console.error('Error fetching all pokemon names:', error);
    }
}

// Fetch Pokemon Types for Filters
async function fetchTypes() {
    try {
        const response = await fetch(`${POKE_API_BASE}type`);
        const data = await response.json();
        allTypes = data.results.filter(type => type.name !== 'unknown' && type.name !== 'shadow');
        renderTypeFilters();
    } catch (error) {
        console.error('Error fetching types:', error);
    }
}

function renderTypeFilters() {
    allTypes.forEach(type => {
        const button = document.createElement('button');
        button.className = 'type-chip';
        button.dataset.type = type.name;
        button.textContent = type.name;
        button.addEventListener('click', () => toggleTypeFilter(type.name, button));
        typeFiltersContainer.appendChild(button);
    });

    // All button logic
    const allBtn = document.querySelector('[data-type="all"]');
    allBtn.addEventListener('click', () => resetFilters());
}

async function toggleTypeFilter(type, button) {
    if (selectedTypes.includes(type)) {
        selectedTypes = selectedTypes.filter(t => t !== type);
        button.classList.remove('active');
    } else {
        selectedTypes.push(type);
        button.classList.add('active');
    }

    // Update "All" button
    const allBtn = document.querySelector('[data-type="all"]');
    if (selectedTypes.length > 0) {
        allBtn.classList.remove('active');
    } else {
        allBtn.classList.add('active');
    }

    updateFilterCount();
    applyFilters();
}

function resetFilters() {
    selectedTypes = [];
    document.querySelectorAll('.type-chip').forEach(btn => btn.classList.remove('active'));
    document.querySelector('[data-type="all"]').classList.add('active');
    updateFilterCount();
    applyFilters();
}

function updateFilterCount() {
    if (selectedTypes.length > 0) {
        activeFiltersCount.textContent = selectedTypes.length;
        activeFiltersCount.style.display = 'flex';
        filterToggleBtn.classList.add('active');
    } else {
        activeFiltersCount.style.display = 'none';
        filterToggleBtn.classList.remove('active');
    }
}

async function applyFilters() {
    if (selectedTypes.length === 0) {
        isFilteredMode = false;
        pokemonGrid.innerHTML = '';
        if (searchInput.value.trim()) {
            handleSearch(searchInput.value.toLowerCase().trim());
        } else {
            renderPokemon(currentPokemonList);
            loadMoreBtn.style.display = 'inline-block';
        }
        return;
    }

    isFilteredMode = true;
    showLoader();
    pokemonGrid.innerHTML = '';
    filteredOffset = 0;
    
    try {
        // Fetch all pokemon for each selected type
        const typeDataPromises = selectedTypes.map(type => 
            fetch(`${POKE_API_BASE}type/${type}`).then(res => res.json())
        );
        const typesData = await Promise.all(typeDataPromises);

        // Find intersection of pokemon URLs
        let intersectedPokemon = typesData[0].pokemon.map(p => p.pokemon);
        
        for (let i = 1; i < typesData.length; i++) {
            const currentTypePokemonUrls = new Set(typesData[i].pokemon.map(p => p.pokemon.url));
            intersectedPokemon = intersectedPokemon.filter(p => currentTypePokemonUrls.has(p.url));
        }

        filteredPokemonList = intersectedPokemon;
        
        if (searchInput.value.trim()) {
            handleSearch(searchInput.value.toLowerCase().trim());
        } else {
            await fetchFilteredPokemonPage();
        }
    } catch (error) {
        console.error('Filter error:', error);
    } finally {
        hideLoader();
    }
}

async function fetchFilteredPokemonPage() {
    showLoader();
    const page = filteredPokemonList.slice(filteredOffset, filteredOffset + currentLimit);
    
    try {
        const detailedPokemon = await Promise.all(
            page.map(async (pokemon) => {
                const res = await fetch(pokemon.url);
                return await res.json();
            })
        );
        
        renderPokemon(detailedPokemon);
        filteredOffset += currentLimit;
        
        if (filteredOffset >= filteredPokemonList.length) {
            loadMoreBtn.style.display = 'none';
        } else {
            loadMoreBtn.style.display = 'inline-block';
        }
    } catch (error) {
        console.error('Error fetching filtered page:', error);
    } finally {
        hideLoader();
    }
}

// Fetch Pokemon List
async function fetchPokemon(isSearching = false) {
    if (!isSearching) {
        showLoader();
        try {
            const response = await fetch(`${POKE_API_BASE}pokemon?limit=${currentLimit}&offset=${offset}`);
            const data = await response.json();
            
            const detailedPokemon = await Promise.all(
                data.results.map(async (pokemon) => {
                    const res = await fetch(pokemon.url);
                    return await res.json();
                })
            );
            
            currentPokemonList = [...currentPokemonList, ...detailedPokemon];
            renderPokemon(detailedPokemon);
            offset += currentLimit;
        } catch (error) {
            console.error('Error fetching pokemon:', error);
        } finally {
            hideLoader();
        }
    }
}

// Render Pokemon Cards
function renderPokemon(pokemonList) {
    pokemonList.forEach(pokemon => {
        const card = document.createElement('div');
        card.className = 'pokemon-card';
        card.innerHTML = `
            <span class="card-id">#${String(pokemon.id).padStart(3, '0')}</span>
            <div class="card-img-container">
                <img src="${pokemon.sprites.other['official-artwork'].front_default || pokemon.sprites.front_default}" alt="${pokemon.name}">
            </div>
            <h2>${pokemon.name}</h2>
            <div class="card-types">
                ${pokemon.types.map(t => `<span class="badge" style="background-color: var(--type-${t.type.name})">${t.type.name}</span>`).join('')}
            </div>
        `;
        card.addEventListener('click', () => showPokemonDetail(pokemon));
        pokemonGrid.appendChild(card);
    });
}

// Show Detail Modal
async function showPokemonDetail(pokemon) {
    modalBody.innerHTML = `
        <div class="detail-header" style="background: linear-gradient(135deg, var(--type-${pokemon.types[0].type.name}) 0%, #14152a 100%)">
            <div class="detail-img">
                <img src="${pokemon.sprites.other['official-artwork'].front_default}" alt="${pokemon.name}" style="width: 100%; height: 100%; object-fit: contain;">
            </div>
        </div>
        <div class="detail-info">
            <div class="basic-info">
                <h1 style="text-transform: capitalize; font-size: 2.5rem; margin-bottom: 1rem;">${pokemon.name}</h1>
                <div class="card-types" style="justify-content: flex-start; margin-bottom: 2rem;">
                    ${pokemon.types.map(t => `<span class="badge" style="background-color: var(--type-${t.type.name})">${t.type.name}</span>`).join('')}
                </div>
                <div style="display: flex; gap: 2rem; margin-bottom: 2rem;">
                    <div>
                        <p style="color: var(--text-secondary); font-size: 0.9rem;">Peso</p>
                        <p style="font-weight: 700; font-size: 1.2rem;">${pokemon.weight / 10} kg</p>
                    </div>
                    <div>
                        <p style="color: var(--text-secondary); font-size: 0.9rem;">Altura</p>
                        <p style="font-weight: 700; font-size: 1.2rem;">${pokemon.height / 10} m</p>
                    </div>
                </div>
                <div>
                    <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 0.5rem;">Habilidades</p>
                    <p style="text-transform: capitalize;">${pokemon.abilities.map(a => a.ability.name).join(', ')}</p>
                </div>
            </div>
            <div class="stats-container">
                <h3>Estadísticas Base</h3>
                ${pokemon.stats.map(stat => `
                    <div class="stat-row">
                        <div class="stat-label">
                            <span>${stat.stat.name}</span>
                            <span>${stat.base_stat}</span>
                        </div>
                        <div class="stat-bar-bg">
                            <div class="stat-bar-fill" style="width: ${(stat.base_stat / 255) * 100}%; background-color: var(--type-${pokemon.types[0].type.name})"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Event Listeners
function setupEventListeners() {
    loadMoreBtn.addEventListener('click', () => {
        if (isSearchMode) {
            fetchSearchPokemonPage();
        } else if (isFilteredMode) {
            fetchFilteredPokemonPage();
        } else {
            fetchPokemon();
        }
    });

    filterToggleBtn.addEventListener('click', () => {
        typeFiltersWrapper.classList.toggle('open');
        filterToggleBtn.classList.toggle('open');
    });
    
    closeModal.addEventListener('click', () => {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    });
    
    modal.querySelector('.modal-overlay').addEventListener('click', () => {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    });

    // Search with debounce
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            handleSearch(query);
        }, 500);
    });

    // Limit dropdown logic
    const limitBtn = document.getElementById('limit-dropdown-toggle');
    const limitMenu = document.getElementById('limit-options-menu');
    const limitOptions = document.querySelectorAll('.limit-option');

    if (limitBtn && limitMenu) {
        limitBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            limitMenu.classList.toggle('show');
        });

        limitOptions.forEach(option => {
            option.addEventListener('click', () => {
                currentLimit = parseInt(option.dataset.limit);
                limitBtn.textContent = currentLimit;
                
                limitOptions.forEach(opt => opt.classList.remove('active'));
                option.classList.add('active');
                
                limitMenu.classList.remove('show');
                resetView();
            });
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            limitMenu.classList.remove('show');
        });
    }
}

function resetView() {
    // Reset all state for reloading
    offset = 0;
    filteredOffset = 0;
    searchOffset = 0;
    currentPokemonList = [];
    pokemonGrid.innerHTML = '';
    
    if (isSearchMode) {
        handleSearch(searchInput.value.toLowerCase().trim());
    } else if (isFilteredMode) {
        applyFilters();
    } else {
        fetchPokemon();
    }
}

// Search Logic
async function handleSearch(query) {
    if (!query) {
        isSearchMode = false;
        pokemonGrid.innerHTML = '';
        if (isFilteredMode) {
            filteredOffset = 0;
            await fetchFilteredPokemonPage();
        } else {
            renderPokemon(currentPokemonList);
            loadMoreBtn.style.display = 'inline-block';
        }
        return;
    }

    isSearchMode = true;
    showLoader();
    pokemonGrid.innerHTML = '';
    searchOffset = 0;

    // Decide which list to filter based on whether type filters are active
    const listToFilter = isFilteredMode ? filteredPokemonList : allPokemonMasterList;

    // Filter list for partial matches
    searchResults = listToFilter.filter(pokemon => 
        pokemon.name.includes(query) || pokemon.url.split('/').filter(Boolean).pop() === query
    );

    if (searchResults.length === 0) {
        pokemonGrid.innerHTML = `<div class="loader-container"><p>No se encontró ningún Pokémon que coincida con "${query}".</p></div>`;
        loadMoreBtn.style.display = 'none';
        hideLoader();
    } else {
        await fetchSearchPokemonPage();
    }
}

async function fetchSearchPokemonPage() {
    showLoader();
    const page = searchResults.slice(searchOffset, searchOffset + currentLimit);
    
    try {
        const detailedPokemon = await Promise.all(
            page.map(async (pokemon) => {
                const res = await fetch(pokemon.url);
                return await res.json();
            })
        );
        
        renderPokemon(detailedPokemon);
        searchOffset += currentLimit;
        
        if (searchOffset >= searchResults.length) {
            loadMoreBtn.style.display = 'none';
        } else {
            loadMoreBtn.style.display = 'inline-block';
        }
    } catch (error) {
        console.error('Error fetching search results page:', error);
    } finally {
        hideLoader();
    }
}

// Filter logic handled in applyFilters and fetchFilteredPokemonPage

// Utilities
function showLoader() {
    const loader = document.querySelector('.loader-container');
    if (loader) loader.style.display = 'flex';
    loadMoreBtn.disabled = true;
    loadMoreBtn.textContent = 'Buscando Pokémon...';
}

function hideLoader() {
    const loader = document.querySelector('.loader-container');
    if (loader) loader.style.display = 'none';
    loadMoreBtn.disabled = false;
    loadMoreBtn.textContent = 'Cargar más Pokémon';
}

// Start the app
init();
