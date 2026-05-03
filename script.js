const POKE_API_BASE = 'https://pokeapi.co/api/v2/';
const INITIAL_LIMIT = 20;
let offset = 0;
let currentPokemonList = [];
let allTypes = [];

// DOM Elements
const pokemonGrid = document.getElementById('pokemon-grid');
const searchInput = document.getElementById('pokemon-search');
const loadMoreBtn = document.getElementById('load-more');
const modal = document.getElementById('pokemon-modal');
const modalBody = document.getElementById('modal-body');
const closeModal = document.querySelector('.close-modal');
const typeFiltersContainer = document.getElementById('type-filters');

// Initialize
async function init() {
    await fetchTypes();
    await fetchPokemon();
    setupEventListeners();
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
        button.addEventListener('click', () => filterByType(type.name, button));
        typeFiltersContainer.appendChild(button);
    });
}

// Fetch Pokemon List
async function fetchPokemon(isSearching = false) {
    if (!isSearching) {
        showLoader();
        try {
            const response = await fetch(`${POKE_API_BASE}pokemon?limit=${INITIAL_LIMIT}&offset=${offset}`);
            const data = await response.json();
            
            const detailedPokemon = await Promise.all(
                data.results.map(async (pokemon) => {
                    const res = await fetch(pokemon.url);
                    return await res.json();
                })
            );
            
            currentPokemonList = [...currentPokemonList, ...detailedPokemon];
            renderPokemon(detailedPokemon);
            offset += INITIAL_LIMIT;
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
    loadMoreBtn.addEventListener('click', () => fetchPokemon());
    
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
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            handleSearch(e.target.value.toLowerCase());
        }, 500);
    });
}

// Search Logic
async function handleSearch(query) {
    if (!query) {
        pokemonGrid.innerHTML = '';
        renderPokemon(currentPokemonList);
        loadMoreBtn.style.display = 'inline-block';
        return;
    }

    showLoader();
    loadMoreBtn.style.display = 'none';
    try {
        const response = await fetch(`${POKE_API_BASE}pokemon/${query}`);
        if (response.ok) {
            const pokemon = await response.json();
            pokemonGrid.innerHTML = '';
            renderPokemon([pokemon]);
        } else {
            pokemonGrid.innerHTML = `<div class="loader-container"><p>No se encontró ningún Pokémon con ese nombre o ID.</p></div>`;
        }
    } catch (error) {
        console.error('Search error:', error);
    } finally {
        hideLoader();
    }
}

// Filter Logic
async function filterByType(type, button) {
    // Reset buttons
    document.querySelectorAll('.type-chip').forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');

    if (type === 'all') {
        pokemonGrid.innerHTML = '';
        renderPokemon(currentPokemonList);
        loadMoreBtn.style.display = 'inline-block';
        return;
    }

    showLoader();
    loadMoreBtn.style.display = 'none';
    pokemonGrid.innerHTML = '';
    
    try {
        const response = await fetch(`${POKE_API_BASE}type/${type}`);
        const data = await response.json();
        
        const detailedPokemon = await Promise.all(
            data.pokemon.slice(0, 20).map(async (p) => {
                const res = await fetch(p.pokemon.url);
                return await res.json();
            })
        );
        
        renderPokemon(detailedPokemon);
    } catch (error) {
        console.error('Filter error:', error);
    } finally {
        hideLoader();
    }
}

// Utilities
function showLoader() {
    const loader = document.querySelector('.loader-container');
    if (loader) loader.style.display = 'flex';
}

function hideLoader() {
    const loader = document.querySelector('.loader-container');
    if (loader) loader.style.display = 'none';
}

// Start the app
init();
