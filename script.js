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
// Fetch Species Data (Flavor Text, Genus, Evolution Chain Link)
async function fetchSpeciesData(id) {
    try {
        const response = await fetch(`${POKE_API_BASE}pokemon-species/${id}`);
        return await response.json();
    } catch (error) {
        console.error('Error fetching species data:', error);
        return null;
    }
}

// Fetch Evolution Chain
async function fetchEvolutionChain(url) {
    try {
        const response = await fetch(url);
        return await response.json();
    } catch (error) {
        console.error('Error fetching evolution chain:', error);
        return null;
    }
}

// Get Evolution Data Recursively
function getEvolutionData(evolution) {
    const evolutions = [];
    let current = evolution.chain;

    function extractEvolutions(node) {
        const speciesName = node.species.name;
        const speciesId = node.species.url.split('/').filter(Boolean).pop();
        
        evolutions.push({
            name: speciesName,
            id: speciesId,
            sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${speciesId}.png`
        });

        if (node.evolves_to.length > 0) {
            node.evolves_to.forEach(nextEvolution => extractEvolutions(nextEvolution));
        }
    }

    extractEvolutions(current);
    return evolutions;
}

// Fetch Type Effectiveness
async function fetchTypeEffectiveness(types) {
    const effectiveness = {};
    const typePromises = types.map(t => fetch(t.type.url).then(res => res.json()));
    const typesData = await Promise.all(typePromises);

    typesData.forEach(typeData => {
        typeData.damage_relations.double_damage_from.forEach(t => {
            effectiveness[t.name] = (effectiveness[t.name] || 1) * 2;
        });
        typeData.damage_relations.half_damage_from.forEach(t => {
            effectiveness[t.name] = (effectiveness[t.name] || 1) * 0.5;
        });
        typeData.damage_relations.no_damage_from.forEach(t => {
            effectiveness[t.name] = (effectiveness[t.name] || 1) * 0;
        });
    });

    // Remove neutral ones (1.0)
    Object.keys(effectiveness).forEach(key => {
        if (effectiveness[key] === 1.0) delete effectiveness[key];
    });

    return effectiveness;
}

// Show Detail Modal
async function showPokemonDetail(pokemon) {
    // Determine current list for navigation
    let activeList = [];
    if (isSearchMode) {
        activeList = searchResults;
    } else if (isFilteredMode) {
        activeList = filteredPokemonList;
    } else {
        activeList = currentPokemonList;
    }

    // Find current index
    const currentIndex = activeList.findIndex(p => p.id === pokemon.id || (p.url && p.url.split('/').filter(Boolean).pop() == pokemon.id));
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Initial loading state in modal
    modalBody.innerHTML = `
        <div class="loader-container">
            <div class="loader"></div>
        </div>
    `;

    // Fetch species data
    const speciesData = await fetchSpeciesData(pokemon.id);
    let evolutionData = null;
    if (speciesData && speciesData.evolution_chain) {
        evolutionData = await fetchEvolutionChain(speciesData.evolution_chain.url);
    }

    // Get flavor text (Spanish if available, otherwise English)
    const flavorEntry = speciesData ? speciesData.flavor_text_entries.find(entry => entry.language.name === 'es') || 
                       speciesData.flavor_text_entries.find(entry => entry.language.name === 'en') : null;
    const flavorText = flavorEntry ? flavorEntry.flavor_text.replace(/\f/g, ' ') : 'No hay descripción disponible.';

    // Get genus (Spanish if available, otherwise English)
    const genusEntry = speciesData ? speciesData.genera.find(g => g.language.name === 'es') || 
                      speciesData.genera.find(g => g.language.name === 'en') : null;
    const genus = genusEntry ? genusEntry.genus : '';

    const evolutions = evolutionData ? getEvolutionData(evolutionData) : [];
    const effectiveness = await fetchTypeEffectiveness(pokemon.types);

    const mainType = pokemon.types[0].type.name;
    const spriteRegular = pokemon.sprites.other['official-artwork'].front_default;

    modalBody.innerHTML = `
        <div class="detail-header" style="background: linear-gradient(135deg, var(--type-${mainType}) 0%, #14152a 100%)">
            <div class="modal-nav">
                <button id="prev-pokemon" class="nav-btn ${currentIndex <= 0 ? 'disabled' : ''}" ${currentIndex <= 0 ? 'disabled' : ''}>←</button>
                <div class="header-main-info">
                    <span class="detail-id">#${String(pokemon.id).padStart(3, '0')}</span>
                    <h1 class="detail-title">${pokemon.name}</h1>
                    <p class="detail-genus">${genus}</p>
                </div>
                <button id="next-pokemon" class="nav-btn ${currentIndex >= activeList.length - 1 ? 'disabled' : ''}" ${currentIndex >= activeList.length - 1 ? 'disabled' : ''}>→</button>
            </div>
            
            <div class="detail-img-container">
                <img id="pokemon-main-img" src="${spriteRegular}" alt="${pokemon.name}" class="main-pokemon-img">
            </div>
        </div>

        <div class="detail-content">
            <div class="info-section description-section">
                <p class="flavor-text">${flavorText}</p>
                <div class="badge-row">
                    ${pokemon.types.map(t => `<span class="badge" style="background-color: var(--type-${t.type.name})">${t.type.name}</span>`).join('')}
                </div>
                
                <div class="physical-stats">
                    <div class="p-stat">
                        <span class="p-label">Altura</span>
                        <span class="p-value">${pokemon.height / 10} m</span>
                    </div>
                    <div class="p-stat">
                        <span class="p-label">Peso</span>
                        <span class="p-value">${pokemon.weight / 10} kg</span>
                    </div>
                    <div class="p-stat">
                        <span class="p-label">Habilidades</span>
                        <span class="p-value-list">${pokemon.abilities.map(a => `<span class="ability-tag">${a.ability.name}</span>`).join('')}</span>
                    </div>
                </div>
            </div>

            <div class="info-section effectiveness-section">
                <h3 class="section-title">Debilidades y Resistencias</h3>
                <div class="effectiveness-grid">
                    ${Object.entries(effectiveness)
                        .sort((a, b) => b[1] - a[1])
                        .map(([type, multiplier]) => `
                            <div class="eff-item">
                                <span class="badge" style="background-color: var(--type-${type})">${type}</span>
                                <span class="multiplier ${multiplier > 1 ? 'weak' : multiplier < 1 ? 'res' : ''}">
                                    ${multiplier === 0 ? '0' : multiplier}x
                                </span>
                            </div>
                        `).join('')}
                </div>
            </div>

            <div class="info-section stats-section">
                <h3 class="section-title">Estadísticas Base</h3>
                <div class="stats-grid">
                    ${pokemon.stats.map(stat => {
                        const statMap = {
                            'hp': 'HP',
                            'attack': 'ATK',
                            'defense': 'DEF',
                            'special-attack': 'SPA',
                            'special-defense': 'SPD',
                            'speed': 'SPE'
                        };
                        return `
                            <div class="stat-row">
                                <div class="stat-info">
                                    <span class="stat-name">${statMap[stat.stat.name] || stat.stat.name}</span>
                                    <span class="stat-value">${stat.base_stat}</span>
                                </div>
                                <div class="stat-bar-wrapper">
                                    <div class="stat-bar" style="width: ${(stat.base_stat / 255) * 100}%; background: var(--type-${mainType})"></div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            ${evolutions.length > 1 ? `
            <div class="info-section evolution-section">
                <h3 class="section-title">Cadena Evolutiva</h3>
                <div class="evolution-chain">
                    ${evolutions.map((ev, index) => `
                        <div class="evo-item" onclick="navigateToPokemon('${ev.id}')">
                            <div class="evo-img-wrapper">
                                <img src="${ev.sprite}" alt="${ev.name}">
                            </div>
                            <span>${ev.name}</span>
                        </div>
                        ${index < evolutions.length - 1 ? '<div class="evo-arrow">→</div>' : ''}
                    `).join('')}
                </div>
            </div>
            ` : ''}
        </div>
    `;

    const prevBtn = document.getElementById('prev-pokemon');
    const nextBtn = document.getElementById('next-pokemon');

    if (prevBtn && !prevBtn.disabled) {
        prevBtn.addEventListener('click', async () => {
            const prevPokemonData = activeList[currentIndex - 1];
            const fullData = prevPokemonData.url ? await fetch(prevPokemonData.url).then(res => res.json()) : prevPokemonData;
            showPokemonDetail(fullData);
        });
    }

    if (nextBtn && !nextBtn.disabled) {
        nextBtn.addEventListener('click', async () => {
            const nextPokemonData = activeList[currentIndex + 1];
            const fullData = nextPokemonData.url ? await fetch(nextPokemonData.url).then(res => res.json()) : nextPokemonData;
            showPokemonDetail(fullData);
        });
    }
}

// Global function to navigate from evolution chain
window.navigateToPokemon = async (id) => {
    showLoader();
    try {
        const response = await fetch(`${POKE_API_BASE}pokemon/${id}`);
        const data = await response.json();
        showPokemonDetail(data);
    } catch (error) {
        console.error('Error navigating to pokemon:', error);
    } finally {
        hideLoader();
    }
};


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

    // Back to top logic
    const bttBtn = document.getElementById('back-to-top');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 500) {
            bttBtn.classList.add('show');
        } else {
            bttBtn.classList.remove('show');
        }
    });

    bttBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

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
