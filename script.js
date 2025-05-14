// Silnik gry decyzyjnej ładuje fabułę z fabula.json

let fabula = null;
let currentScene = null;
let stats = {};
let inventory = [];
let eventLog = [];

function renderStats() {
    const statsDiv = document.getElementById('stats');
    // Statystyki, które mają progressbar (0-100)
    const barStats = [
        'morale', 'energia', 'kac_power', 'smrod_level', 'stan_watraby', 'wiara_w_gowno',
        'szacun_na_dzielni', 'szacun_w_kenie', 'moc_bicka_centusia', 'skill_cs', 'skill_programowania', 'podejrzliwosc_psow',
        'relacje_z_matka', 'hajs_w_kieszeni'
    ];
    function capitalizeWords(str) {
        return str.replace(/\b\w/g, l => l.toUpperCase());
    }
    statsDiv.innerHTML = Object.entries(stats).map(([key, value]) => {
        const label = capitalizeWords(key.replace(/_/g, ' '));
        if (barStats.includes(key)) {
            let min = 0, max = 100;
            // Dla szacunów i relacji z matką: tylko wartości dodatnie mają pasek
            if (key === 'szacun_w_kenie' || key === 'szacun_na_dzielni' || key === 'relacje_z_matka') {
                min = 0; max = 100;
                value = value > 0 ? value : 0;
            }
            if (key === 'hajs_w_kieszeni') { min = 0; max = 200; value = value > 0 ? value : 0; }
            let percent = Math.min(100, Math.round(((value - min) / (max - min)) * 100));
            return `<div class=\"stat-row\">
                <span class=\"stat-label\">${label}:</span>
                <div class=\"stat-bar-container\"><div class=\"stat-bar\" style=\"width:${percent}%\"></div></div>
                <span class=\"stat-value\">${stats[key]}</span>
            </div>`;
        } else {
            return `<div class=\"stat-row\">
                <span class=\"stat-label\">${label}:</span>
                <span class=\"stat-value\">${value}</span>
            </div>`;
        }
    }).join('');
}

function renderInventory() {
    const invList = document.getElementById('inventory-list');
    invList.innerHTML = inventory.map(item => `<li>${item.name}</li>`).join('');
}

function showFloatingEffectSingle(html) {
    const effectDiv = document.createElement('div');
    effectDiv.className = 'decision-effect-floating';
    effectDiv.innerHTML = html;
    // Losowa pozycja na ekranie (nie za blisko krawędzi)
    const top = Math.random() * 60 + 10; // 10% - 70% wysokości
    const left = Math.random() * 60 + 10; // 10% - 70% szerokości
    effectDiv.style.position = 'fixed';
    effectDiv.style.top = top + 'vh';
    effectDiv.style.left = left + 'vw';
    effectDiv.style.zIndex = 9999;
    effectDiv.style.pointerEvents = 'none';
    document.body.appendChild(effectDiv);
    setTimeout(() => {
        effectDiv.style.opacity = '0';
        setTimeout(() => effectDiv.remove(), 400);
    }, 1200);
}

function animateButtonClick(btn) {
    btn.classList.add('btn-anim');
    setTimeout(() => btn.classList.remove('btn-anim'), 400);
}

function typewriterEffect(element, text, callback) {
    element.textContent = '';
    let i = 0;
    function type() {
        if (i < text.length) {
            element.textContent += text.charAt(i);
            i++;
            setTimeout(type, 28 + Math.random() * 40);
        } else if (callback) {
            callback();
        }
    }
    type();
}

function getWaldekMood(choices) {
    // Rdzenie słów, by łapać różne formy
    const angry = ["wkurw", "krzycz", "awantur", "grozi", "wypierdol", "nienawidz", "złoś", "złos", "wkurwi", "wkurwiasz", "spier", "chuj", "zły"];
    const sad = ["płaka", "smut", "depres", "rozpłaka", "rozpacz", "załam", "menel", "błąd"];
    const excited = ["zajar", "podekscyt", "podniec", "ochot", "jaram", "zajaw", "ekscyt", "gówno", "julka", "sex"];
    let mood = "zielony"; // domyślny
    for (const choice of choices) {
        const text = choice.text.toLowerCase();
        if (angry.some(root => text.includes(root))) return "czerwony";
        if (sad.some(root => text.includes(root))) mood = "szary";
        if (excited.some(root => text.includes(root))) mood = "rozowy";
    }
    return mood;
}

function updateWaldekImg(choices) {
    // Zawsze ustawiamy zielonego Waldka jako domyślnego
    const img = document.getElementById('waldek-img');
    if (img) {
        img.src = `waldki/zielony_waldek.png`;
        img.alt = `Waldek (zielony)`;
    }
}

// Dodaję funkcję do nakładania efektów wyboru na stats, inventory i flagi
function applyEffects(effects) {
    if (!effects) return;
    // Statystyki
    if (effects.stats_change) {
        for (const [stat, val] of Object.entries(effects.stats_change)) {
            if (typeof stats[stat] === 'number') {
                stats[stat] += val;
            } else {
                stats[stat] = val;
            }
        }
    }
    // Flagi
    if (effects.flags_set) {
        if (!fabula.flags) fabula.flags = {};
        for (const [flag, val] of Object.entries(effects.flags_set)) {
            fabula.flags[flag] = val;
        }
    }
    // Inventory
    if (effects.inventory_remove) {
        for (const item of effects.inventory_remove) {
            inventory = inventory.filter(i => i.item_id !== item.item_id);
        }
    }
    if (effects.inventory_add) {
        for (const item of effects.inventory_add) {
            // Dodaj tylko jeśli nie ma już takiego itemu
            if (!inventory.some(i => i.item_id === item.item_id)) {
                inventory.push(item);
            }
        }
    }
}

function renderScene() {
    let scene = fabula.scenes[currentScene];
    const sceneDiv = document.getElementById('scene');
    const choicesDiv = document.getElementById('choices');
    choicesDiv.innerHTML = '';

    function describeEffectsArray(effects) {
        if (!effects) return [];
        let desc = [];
        if (effects.stats_change) {
            for (const [stat, val] of Object.entries(effects.stats_change)) {
                if (val === 0) continue;
                const sign = val > 0 ? '+' : '';
                desc.push(`<span style='color:${val > 0 ? '#00ff99' : '#ff4e4e'}'>${stat.replace(/_/g, ' ')}: ${sign}${val}</span>`);
            }
        }
        if (effects.flags_set) {
            for (const [flag, val] of Object.entries(effects.flags_set)) {
                desc.push(`<span style='color:#ffe066'>${flag.replace(/_/g, ' ')}: ${val ? 'TAK' : 'NIE'}</span>`);
            }
        }
        if (effects.inventory_remove) {
            for (const item of effects.inventory_remove) {
                desc.push(`<span style='color:#ff4e4e'>- ${item.item_id.replace(/_/g, ' ')}</span>`);
            }
        }
        if (effects.inventory_add) {
            for (const item of effects.inventory_add) {
                desc.push(`<span style='color:#00ff99'>+ ${item.item_id.replace(/_/g, ' ')}</span>`);
            }
        }
        return desc;
    }

    if (scene) {
        // Efekt pisania na konsoli
        typewriterEffect(sceneDiv, scene.description, () => {
            scene.choices.forEach((choice, idx) => {
                const btn = document.createElement('button');
                btn.textContent = choice.text;
                btn.disabled = false;
                btn.style.animationDelay = (0.08 * idx) + 's';
                btn.onclick = () => {
                    // Animacja kliknięcia
                    animateButtonClick(btn);
                    // Animacja znikania wszystkich przycisków
                    Array.from(choicesDiv.children).forEach(b => b.classList.add('btn-disappear'));
                    setTimeout(() => {
                        Array.from(choicesDiv.children).forEach(b => b.remove());
                    }, 380);
                    // Animacja znikania tekstu sceny
                    sceneDiv.classList.add('scene-disappear');
                    // Pokaż każdy efekt osobno jako floating toast
                    const effectsArr = describeEffectsArray(choice.effects);
                    effectsArr.forEach((html, i) => {
                        setTimeout(() => showFloatingEffectSingle(html), i * 120);
                    });
                    // --- TU: Nakładanie efektów na stats/inventory/flags ---
                    applyEffects(choice.effects);
                    renderStats(); // Natychmiastowa aktualizacja statystyk
                    renderInventory(); // Natychmiastowa aktualizacja ekwipunku
                    // --- KONIEC ---
                    // Przejście do kolejnej sceny po efektach i animacji znikania sceny
                    const totalDelay = Math.max(440, effectsArr.length ? (120 * effectsArr.length + 1000) : 0);
                    setTimeout(() => {
                        eventLog.unshift(`Wybrałeś: ${choice.text}`);
                        currentScene = choice.nextScene;
                        renderAll();
                        setTimeout(() => sceneDiv.classList.remove('scene-disappear'), 10);
                    }, totalDelay);
                };
                btn.disabled = true; // Ukryj do końca animacji

                // --- DODANE: obsługa hovera dla zmiany Waldka ---
                btn.addEventListener('mouseenter', () => {
                    // Zmień Waldka na nastrój tego wyboru
                    const mood = getWaldekMood([choice]);
                    const img = document.getElementById('waldek-img');
                    if (img) {
                        img.src = `waldki/${mood}_waldek.png`;
                        img.alt = `Waldek (${mood})`;
                    }
                });
                btn.addEventListener('mouseleave', () => {
                    // Przywróć Waldka do zielonego (domyślnego)
                    const img = document.getElementById('waldek-img');
                    if (img) {
                        img.src = 'waldki/zielony_waldek.png';
                        img.alt = 'Waldek (zielony)';
                    }
                });
                // --- KONIEC DODANEGO ---

                choicesDiv.appendChild(btn);
            });
            setTimeout(() => {
                Array.from(choicesDiv.children).forEach(b => b.disabled = false);
            }, 100);
            // Aktualizuj Waldka po pojawieniu się przycisków
            updateWaldekImg(scene.choices);
        });
    } else if (fabula.endings && fabula.endings[currentScene]) {
        // Obsługa zakończenia
        const ending = fabula.endings[currentScene];
        sceneDiv.innerHTML = `<div style='font-size:1.2em; font-weight:bold; margin-bottom:10px;'>${ending.description}</div>` +
            (ending.achievement ? `<div style='color:#1976d2; font-size:1.1em; margin-top:10px;'>Osiągnięcie: <b>${ending.achievement}</b></div>` : '');
        // Dodaj przycisk "Zagraj od nowa"
        const restartBtn = document.createElement('button');
        restartBtn.textContent = 'Zagraj od nowa';
        restartBtn.style.marginTop = '24px';
        restartBtn.onclick = () => restartGame();
        choicesDiv.appendChild(restartBtn);
        // Waldka domyślny
        updateWaldekImg([{ text: '' }]);
    } else {
        sceneDiv.textContent = 'Brak opisu tej sceny lub zakończenia.';
        updateWaldekImg([{ text: '' }]);
    }
}

function renderLog() {
    const logUl = document.getElementById('event-log');
    logUl.innerHTML = eventLog.slice(0, 10).map(e => `<li>${e}</li>`).join('');
}

function restartGame() {
    stats = { ...fabula.initial_stats };
    inventory = fabula.inventory ? [...fabula.inventory] : [];
    eventLog = [];
    currentScene = Object.keys(fabula.scenes)[0];
    renderAll();
}

// Ładowanie fabuły z fabula.json
fetch('fabula.json')
    .then(res => res.json())
    .then(data => {
        // Zakładamy, że jest jeden główny wątek fabularny
        const story = data[Object.keys(data)[0]];
        fabula = story;
        stats = { ...story.initial_stats };
        inventory = story.inventory || [];
        eventLog = [];
        currentScene = Object.keys(story.scenes)[0]; // Pierwsza scena
        renderAll();
    })
    .catch(err => {
        document.getElementById('scene').textContent = 'Błąd ładowania fabuły: ' + err;
    });

// Zmodyfikowany renderAll aby dodawać interaktywność po renderowaniu
function renderAll() {
    renderStats();
    renderInventory();
    renderScene();
    renderLog();
} 