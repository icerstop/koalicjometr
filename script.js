// ============================================================
// GLOBALNE DEFINICJE, STAŁE I KLASY
// ============================================================

// Definicja klas
class Committee {
    constructor(id, name, threshold, pastSupportEquivalence) {
        this.id = id;
        this.name = name;
        this.threshold = threshold;
        this.pastSupportEquivalence = pastSupportEquivalence;
    }
}

class Constituency {
    constructor(number, size, pastSupport) {
        this.number = number;
        this.size = size;
        this.pastSupport = pastSupport;
        this.support = null;
        this.mandates = null;
    }
}

class ElectionCalculator {
    constructor(committees, constituencies) {
        this.committees = committees;
        this.constituencies = constituencies;
        this.pastSupport = this.calculatePastSupport();
    }

    calculatePastSupport() {
        const totalMandates = this.constituencies.reduce((sum, c) => sum + c.size, 0);
        const pastSupport = {};
        const parties = ['td', 'nl', 'pis', 'konf', 'ko', 'rz', 'poz'];
        for (const party of parties) {
            const totalSupport = this.constituencies.reduce(
                (sum, c) => sum + (c.pastSupport[party] * c.size), 0
            );
            pastSupport[party] = totalSupport / totalMandates;
        }
        return pastSupport;
    }

    calculateLocalSupport(support, constituency) {
        const pastSupportProjection = this.committees.map(c => this.pastSupport[c.id] || 0);
        const localPastSupport = constituency.pastSupport;
        const localPastSupportProjection = this.committees.map(c => localPastSupport[c.id] || 0);
        const localSupportDeviation = localPastSupportProjection.map(
            (local, i) => (pastSupportProjection[i] !== 0 ? local / pastSupportProjection[i] : 0)
        );
        let localSupport = support.map((s, i) => {
            if (s === 100) {
                return 100;
            }
            return s * localSupportDeviation[i];
        });
        //if (constituency.number === 21) {
        //    localSupport.push(5.37); // MN w Opolu
        //}
        if (constituency.number === 32) {
            const nlIndex = this.committees.findIndex(c => c.id === 'nl');
            const cap = 1.8 * support[nlIndex];
            if (localSupport[nlIndex] > cap) localSupport[nlIndex] = cap;
        }

        localSupport = localSupport.map(value => Math.min(value, 100));
        const total = localSupport.reduce((sum, val) => sum + val, 0);
        if (total > 100) {
            localSupport = localSupport.map(value => value / total * 100);
        }
        return localSupport;
    }

    calculateMandates(support, method = "dHondt") {
        const mandates = new Array(this.committees.length).fill(0);
        for (const constituency of this.constituencies) {
            const localSupport = this.calculateLocalSupport(support, constituency);
            constituency.support = localSupport;
            constituency.mandates = new Array(this.committees.length).fill(0);
            const filteredLocalSupport = localSupport.slice(0, this.committees.length).map(
                (s, i) => (support[i] < this.committees[i].threshold ? 0 : s)
            );

            if (method === "dHondt" || method === "SainteLague") {
                const quotients = method === "dHondt"
                    ? this.calculateQuotientsDHondt(filteredLocalSupport, constituency.size)
                    : this.calculateQuotientsSainteLague(filteredLocalSupport, constituency.size);
                quotients.sort((a, b) => b.quotient - a.quotient);
                const topQuotients = quotients.slice(0, constituency.size);
                for (const q of topQuotients) {
                    mandates[q.committeeIndex]++;
                    constituency.mandates[q.committeeIndex]++;
                }
            } else if (method === "HareNiemeyer") {
                const committeeMandates = this.calculateMandatesHareNiemeyer(filteredLocalSupport, constituency.size);
                committeeMandates.forEach((m, i) => {
                    mandates[i] += m;
                    constituency.mandates[i] += m;
                });
            }
        }
        return mandates;
    }

    calculateQuotientsDHondt(support, size) {
        const quotients = [];
        for (let divisor = 1; divisor <= size; divisor++) {
            support.forEach((s, i) => {
                quotients.push({ quotient: s / divisor, committeeIndex: i });
            });
        }
        return quotients;
    }

    calculateQuotientsSainteLague(support, size) {
        const quotients = [];
        for (let i = 1; i <= size; i++) {
            const divisor = 2 * i - 1;
            support.forEach((s, idx) => {
                quotients.push({ quotient: s / divisor, committeeIndex: idx });
            });
        }
        return quotients;
    }

    calculateMandatesHareNiemeyer(support, size) {
        const totalSupport = support.reduce((sum, s) => sum + s, 0);
        const mandates = new Array(support.length).fill(0);
        const hareQuota = totalSupport / size;
        let remainingMandates = size;
        const remainders = [];

        support.forEach((s, i) => {
            if (s > 0) {
                const committeeMandates = Math.floor(s / hareQuota);
                mandates[i] = committeeMandates;
                remainingMandates -= committeeMandates;
                remainders.push({ index: i, remainder: (s / hareQuota) - committeeMandates });
            }
        });

        remainders.sort((a, b) => b.remainder - a.remainder);
        for (let i = 0; i < remainingMandates && i < remainders.length; i++) {
            mandates[remainders[i].index]++;
        }
        return mandates;
    }
}

// Globalne stałe i zmienne
const committees = [
    new Committee('td', 'Trzecia Droga', 5, [['td', 1]]),
    new Committee('nl', 'Lewica', 5, [['nl', 1]]),
    new Committee('pis', 'Prawo i Sprawiedliwość', 5, [['pis', 1]]),
    new Committee('konf', 'Konfederacja', 5, [['konf', 1]]),
    new Committee('ko', 'Koalicja Obywatelska', 5, [['ko', 1]]),
    new Committee('rz', 'Razem', 5, [['rz', 1]]),
    new Committee('poz', 'Pozostałe', 100, [['poz', 1]])
];

const colors = {
    'td': '#FFFF00',
    'nl': '#FF0000',
    'pis': '#000080',
    'konf': '#8B4513',
    'ko': '#FFA500',
    'rz': '#a10249',
    'poz': '#808080'
};

// Globalna mapa skrótów nazw partii (usunięto duplikację)
const SHORT_NAMES = {
    'Trzecia Droga': 'TD',
    'Lewica': 'NL',
    'Prawo i Sprawiedliwość': 'PiS',
    'Konfederacja': 'KONF',
    'Koalicja Obywatelska': 'KO',
    'Razem': 'RZ',
    'Pozostałe': 'POZ'
};

let constituencies = [];
let calculator;

// ============================================================
// FUNKCJE POMOCNICZE (UTILITIES)
// ============================================================

// Funkcja do rozjaśniania lub przyciemniania koloru
function shadeColor(color, percent) {
    // percent: dodatnia wartość – rozjaśnienie, ujemna – przyciemnienie
    let num = parseInt(color.slice(1), 16),
        amt = Math.round(2.55 * percent),
        R = (num >> 16) + amt,
        G = (num >> 8 & 0x00FF) + amt,
        B = (num & 0x0000FF) + amt;
    return "#" + (
        0x1000000 +
        (R < 255 ? (R < 0 ? 0 : R) : 255) * 0x10000 +
        (G < 255 ? (G < 0 ? 0 : G) : 255) * 0x100 +
        (B < 255 ? (B < 0 ? 0 : B) : 255)
    ).toString(16).slice(1);
}

// Funkcja tworząca i zwracająca element tooltip (jeśli nie istnieje)
let customTooltip = document.getElementById('custom-tooltip');
if (!customTooltip) {
    customTooltip = document.createElement('div');
    customTooltip.id = 'custom-tooltip';
    customTooltip.style.position = 'absolute';
    customTooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    customTooltip.style.color = 'white';
    customTooltip.style.padding = '5px 8px';
    customTooltip.style.borderRadius = '4px';
    customTooltip.style.fontSize = '12px';
    customTooltip.style.pointerEvents = 'none';
    customTooltip.style.transition = 'opacity 0.1s';
    customTooltip.style.opacity = 0;
    document.body.appendChild(customTooltip);
}

// Funkcja dołączająca event listenery do elementu SVG – tooltip
function addCustomTooltip(regionElement, tooltipText) {
    regionElement.addEventListener('mouseover', (e) => {
        customTooltip.textContent = tooltipText;
        customTooltip.style.left = e.pageX + 10 + 'px';
        customTooltip.style.top = e.pageY + 10 + 'px';
        customTooltip.style.opacity = 1;
    });
    regionElement.addEventListener('mousemove', (e) => {
        customTooltip.style.left = e.pageX + 10 + 'px';
        customTooltip.style.top = e.pageY + 10 + 'px';
    });
    regionElement.addEventListener('mouseout', () => {
        customTooltip.style.opacity = 0;
    });
}

// ============================================================
// FUNKCJE ODPOWIEDZIALNE ZA MAPY I WYKRESY
// ============================================================

// --- Aktualizacja mapy partii ---
async function updatePartyMap() {
    // Pobierz plik okregi.svg
    const response = await fetch('mapa-partie.svg');
    const text = await response.text();
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(text, 'image/svg+xml');
    const svgElement = svgDoc.querySelector('svg');
    svgElement.setAttribute('width', '100%');
    svgElement.setAttribute('height', 'auto');
    svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    
    // Pobierz wybraną partię
    const selectedParty = document.getElementById('party-list').value;
    const partyIndex = committees.findIndex(c => c.id === selectedParty);
    const baseColor = colors[selectedParty];
    
    // Zbierz poparcie w każdym okręgu dla wybranej partii
    const supportValues = constituencies.map(c => (c.support && c.support[partyIndex]) ? c.support[partyIndex] : 0);
    const minSupport = Math.min(...supportValues);
    const maxSupport = Math.max(...supportValues);
    
    // Ustal zakres – żeby uniknąć dzielenia przez zero
    const range = (maxSupport - minSupport) || 1;
    
    // Dla każdego okręgu, oblicz nowy odcień koloru i ustaw tooltip
    constituencies.forEach(c => {
        const supportValue = (c.support && c.support[partyIndex]) ? c.support[partyIndex] : 0;
        const factor = (supportValue - minSupport) / range;
        const adjustment = 75 * (1 - factor);
        const newColor = shadeColor(baseColor, adjustment);
        
        const regionElement = svgDoc.getElementById(`okreg_${c.number}`);
        if (regionElement) {
            regionElement.setAttribute('style', `fill:${newColor};stroke:#000000;stroke-width:1px;pointer-events:visiblePainted;`);
            const existingTitle = regionElement.querySelector('title');
            if (existingTitle) {
                existingTitle.remove();
            }
            const mandateValue = (c.mandates && c.mandates[partyIndex] != null) ? c.mandates[partyIndex] : 0;
            const tooltipText = `Okręg ${c.number}\nPoparcie: ${supportValue.toFixed(2)}%\nMandaty: ${mandateValue}/${c.size}`;
            addCustomTooltip(regionElement, tooltipText);
        }
    });
    
    // Wstaw zaktualizowany SVG do kontenera, przy jednoczesnym zachowaniu kontenera legendy
    const partyMapContainer = document.getElementById('party-map');
    partyMapContainer.innerHTML = "";
    // Utwórz nowy kontener na legendę
    const legendWrapper = document.createElement('div');
    legendWrapper.id = 'party-map-legend';
    partyMapContainer.appendChild(legendWrapper);
    // Dołącz mapę (SVG)
    partyMapContainer.appendChild(svgElement);
    
    // Wywołaj funkcję tworzącą legendę
    createLegend(minSupport, maxSupport, baseColor);
}

function createLegend(minSupport, maxSupport, baseColor) {
    const legendContainer = document.getElementById('party-map-legend');
    legendContainer.innerHTML = '';

    // Tworzymy canvas do narysowania gradientu
    const legendCanvas = document.createElement('canvas');
    legendCanvas.className = 'legend-canvas';
    legendContainer.appendChild(legendCanvas);

    // Ustal rozmiar faktyczny canvas, tak jak dotychczas
    const legendWidth = legendCanvas.offsetWidth || 200;
    const legendHeight = legendCanvas.offsetHeight || 20;
    legendCanvas.width = legendWidth;
    legendCanvas.height = legendHeight;

    // Rysowanie gradientu
    const ctx = legendCanvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, legendWidth, 0);
    gradient.addColorStop(0, shadeColor(baseColor, 75));
    gradient.addColorStop(1, shadeColor(baseColor, 0));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, legendWidth, legendHeight);

    // Tworzymy kontener na etykiety (min i max)
    const labelContainer = document.createElement('div');
    labelContainer.className = 'legend-labels';
    
    // Etykieta minimalna
    const minLabel = document.createElement('div');
    minLabel.className = 'legend-min';
    minLabel.textContent = `${minSupport.toFixed(1)}%`;
    
    // Etykieta maksymalna
    const maxLabel = document.createElement('div');
    maxLabel.className = 'legend-max';
    maxLabel.textContent = `${maxSupport.toFixed(1)}%`;
    
    // Dodaj etykiety do kontenera
    labelContainer.appendChild(minLabel);
    labelContainer.appendChild(maxLabel);
    legendContainer.appendChild(labelContainer);
}

// --- Aktualizacja wykresów ---
function updateDonutChart(mandates) {
    // Definicja lokalnej mapy kolorów – pozostawiono bez zmian
    const colorMapping = {
        'Trzecia Droga': '#FFFF00',  // Żółty
        'Lewica': '#FF0000',         // Czerwony
        'Konfederacja': '#8B4513',   // Brąz
        'Koalicja Obywatelska': '#FFA500', // Pomarańczowy
        'Prawo i Sprawiedliwość': '#000080', // Granatowy
        'Razem': '#880E4F',           // Bordowy dla Razem
        'Pozostałe': '#808080'       // Szary
    };

    // Przygotowanie danych – wykorzystanie globalnego SHORT_NAMES
    const labels = [];
    const data = [];
    const bgColors = [];
    const preferredOrder = [
        'Razem',
        'Lewica',
        'Koalicja Obywatelska',
        'Trzecia Droga',
        'Konfederacja',
        'Prawo i Sprawiedliwość',
        'Pozostałe'
    ];
    
    preferredOrder.forEach(partyName => {
        const idx = committees.findIndex(c => c.name === partyName);
        if (idx !== -1 && mandates[idx] > 0) {
            data.push(mandates[idx]);
            labels.push(`${SHORT_NAMES[partyName]} (${mandates[idx]})`);
            bgColors.push(colorMapping[partyName]);
        }
    });

    donutChart.data.labels = labels;
    donutChart.data.datasets[0].data = data;
    donutChart.data.datasets[0].backgroundColor = bgColors;
    
    donutChart.options = {
        plugins: {
            legend: {
                position: 'bottom'
            },
            majorityLinePlugin: {}
        },
        cutout: '60%',
        circumference: 180,
        rotation: 270,
        layout: {
            padding: {
                bottom: 10
            }
        }
    };

    donutChart.update();
}

function updateBarChart(support) {
    const data = committees.map((c, i) => ({ support: support[i], name: SHORT_NAMES[c.name], color: colors[c.id] }));
    const dataOthers = data.filter(item => item.name !== 'POZ').sort((a, b) => b.support - a.support);
    const dataPoz = data.filter(item => item.name === 'POZ');
    const sortedData = [...dataOthers, ...dataPoz];
    barChart.data.labels = sortedData.map(d => d.name);
    barChart.data.datasets[0].data = sortedData.map(d => d.support);
    barChart.data.datasets[0].backgroundColor = sortedData.map(d => d.color);
    const maxValue = Math.max(...support);
    barChart.options.scales.y.suggestedMax = maxValue * 1.03;
    barChart.update();
}

async function colorMap() {
    const response = await fetch('okregi.svg');
    const text = await response.text();
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(text, 'image/svg+xml');
    const svgElement = svgDoc.querySelector('svg');
    svgElement.setAttribute('width', '100%');
    svgElement.setAttribute('height', 'auto');
    svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    const winners = getWinners();
    for (const [okreg, winner] of Object.entries(winners)) {
        const path = svgDoc.getElementById(`okreg_${okreg}`);
        if (path) {
            path.setAttribute('style', `fill:${colors[winner] || '#FFFFFF'};stroke:#000000;stroke-width:1px;`);
        }
    }
    const serializer = new XMLSerializer();
    document.getElementById('map').innerHTML = serializer.serializeToString(svgDoc);
}

function getWinners() {
    const winners = {};
    for (const c of constituencies) {
        if (c.support) {
            const maxSupport = Math.max(...c.support);
            const winnerIndex = c.support.indexOf(maxSupport);
            winners[c.number] = committees[winnerIndex].id;
        }
    }
    return winners;
}

// --- Aktualizacja szczegółów okręgów ---
function populateConstituencyList() {
    const list = document.getElementById('constituency-list');
    constituencies.forEach(c => {
        const option = document.createElement('option');
        option.text = `Okręg ${c.number} (${c.size} mandatów)`;
        list.add(option);
    });
    list.selectedIndex = 0;
    list.addEventListener('change', () => {
        updateConstituencyDetails(committees, constituencies, constituencyChart, SHORT_NAMES, colors);
    });
}

function updateConstituencyDetails() {
    const list = document.getElementById('constituency-list');
    const idx = list.selectedIndex;
    if (idx === -1) return;
    const c = constituencies[idx];
    if (!c.mandates) return;
    const data = committees.map((comm, i) => ({
        name: SHORT_NAMES[comm.name],
        mandates: c.mandates[i],
        color: colors[comm.id]
    })).filter(d => d.mandates > 0);
    data.sort((a, b) => b.mandates - a.mandates);
    constituencyChart.data.labels = data.map(d => d.name);
    constituencyChart.data.datasets[0].data = data.map(d => d.mandates);
    constituencyChart.data.datasets[0].backgroundColor = data.map(d => d.color);
    constituencyChart.update();
}

// --- Aktualizacja koalicji ---
function updateCoalitions(mandates, support) {
    const coalitions = [];
    const n = committees.length;
    for (let r = 1; r <= n; r++) {
        const combinations = getCombinations([...Array(n).keys()], r);
        for (const subset of combinations) {
            const subsetIds = subset.map(i => committees[i].id);
            if (subsetIds.includes('pis') && subsetIds.includes('ko')) continue;
            if (subsetIds.includes('nl') && subsetIds.includes('konf')) continue;
            if (subsetIds.includes('nl') && subsetIds.includes('pis')) continue;
            if (subsetIds.includes('rz') && subsetIds.includes('konf')) continue;
            if (subsetIds.includes('rz') && subsetIds.includes('pis')) continue;
            if (subsetIds.includes('rz') && subsetIds.includes('ko')) continue;
            if (subsetIds.includes('poz')) continue;
            if (subset.some(i => mandates[i] === 0)) continue;
            const total = subset.reduce((sum, i) => sum + mandates[i], 0);
            if (total >= 231) {
                const coalitionData = subset.map(i => ({
                    abbr: SHORT_NAMES[committees[i].name],
                    mandates: mandates[i],
                    support: support[i]
                }));
                coalitionData.sort((a, b) => b.mandates - a.mandates || b.support - a.support);
                const coalitionStr = coalitionData.length === 1
                    ? `Samodzielna większość: ${coalitionData[0].abbr} (${coalitionData[0].mandates})`
                    : `Koalicja: ${coalitionData.map(d => `${d.abbr}(${d.mandates})`).join('+')} = ${total}`;
                coalitions.push({ total, str: coalitionStr });
            }
        }
    }
    coalitions.sort((a, b) => b.total - a.total);
    const uniqueCoalitions = [...new Set(coalitions.map(c => c.str))];
    document.getElementById('coalitions-text').innerText = uniqueCoalitions.join('\n') || 'Brak koalicji dających większość';
}

function getCombinations(arr, r) {
    if (r === 1) return arr.map(val => [val]);
    const result = [];
    arr.forEach((val, idx) => {
        const smaller = getCombinations(arr.slice(idx + 1), r - 1);
        smaller.forEach(small => result.push([val, ...small]));
    });
    return result;
}

// ============================================================
// OBSŁUGA INTERFEJSU UŻYTKOWNIKA I EVENTY
// ============================================================

document.getElementById('party-list').addEventListener('change', updatePartyMap);

async function loadConstituencies() {
    const response = await fetch('data/wybory2023.csv');
    const text = await response.text();
    const rows = text.trim().split('\n').slice(1);
    constituencies = rows
        .filter(row => row.trim() !== '')
        .map((row, index) => {
            const parts = row.split(';');
            if (parts.length !== 9) {
                console.error(`Błąd w wierszu ${index + 2}: za mało kolumn (${parts.length} zamiast 9)`);
                return null;
            }
            const [number, size, td, nl, pis, konf, ko, rz, poz] = parts;
            const pastSupport = {
                td: parseFloat(td.replace(',', '.')),
                nl: parseFloat(nl.replace(',', '.')),
                pis: parseFloat(pis.replace(',', '.')),
                konf: parseFloat(konf.replace(',', '.')),
                ko: parseFloat(ko.replace(',', '.')),
                rz: parseFloat(rz.replace(',', '.')),
                poz: parseFloat(poz.replace(',', '.'))
            };
            return new Constituency(parseInt(number), parseInt(size), pastSupport);
        })
        .filter(c => c !== null);
    if (constituencies.length === 0) {
        console.error('Nie udało się załadować żadnych danych z pliku CSV.');
        return;
    }
    calculator = new ElectionCalculator(committees, constituencies);
    populateConstituencyList();
    calculateMandates();
}

const sliders = ['td', 'nl', 'pis', 'konf', 'ko', 'rz', 'poz'].map(id => document.getElementById(`${id}-slider`));
const entries = ['td', 'nl', 'pis', 'konf', 'ko', 'rz', 'poz'].map(id => document.getElementById(`${id}-entry`));
const thresholds = ['td', 'nl', 'pis', 'konf', 'ko', 'rz'].map(id => document.getElementById(`${id}-threshold`));
const methodCombo = document.getElementById('method-combo');
let lastChangedIndex = null;

sliders.forEach((slider, i) => {
    slider.addEventListener('input', () => {
        lastChangedIndex = i;
        entries[i].value = (slider.value / 10).toFixed(2);
        debounceCalculateMandates();
    });
});

entries.forEach((entry, i) => {
    entry.addEventListener('change', () => {
        lastChangedIndex = i;
        let value = parseFloat(entry.value.replace(',', '.'));
        if (isNaN(value) || value < 0 || value > 100) {
            alert('Wpisz wartość od 0.0 do 100.0!');
            return;
        }
        sliders[i].value = value * 10;
        debounceCalculateMandates();
    });
});

thresholds.forEach((combo, i) => {
    combo.addEventListener('change', () => {
        committees[i].threshold = parseInt(combo.value);
        debounceCalculateMandates();
    });
});

methodCombo.addEventListener('change', debounceCalculateMandates);

let debounceTimer;
function debounceCalculateMandates() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(calculateMandates, 300);
}

function calculateMandates() {
    const support = entries.map(e => parseFloat(e.value.replace(',', '.')));
    const totalSupport = support.reduce((sum, val) => sum + val, 0);

    if (totalSupport > 100 && lastChangedIndex !== null) {
        const changedValue = support[lastChangedIndex];
        const otherSum = totalSupport - changedValue;
        if (otherSum > 0) {
            const factor = (100 - changedValue) / otherSum;
            support.forEach((val, i) => {
                if (i !== lastChangedIndex) {
                    const newValue = val * factor;
                    support[i] = newValue;
                    sliders[i].value = newValue * 10;
                    entries[i].value = newValue.toFixed(2);
                }
            });
        }
    }

    const method = methodCombo.value;
    const mandates = calculator.calculateMandates(support, method);

    updateDonutChart(mandates);
    updateBarChart(support);
    colorMap();
    updateConstituencyDetails();
    updateCoalitions(mandates, support);
    updatePartyMap();
}

// ============================================================
// KONFIGURACJA I REJESTRACJA WYKRESÓW ORAZ PLUGINÓW
// ============================================================

// Plugin rysujący etykiety nad słupkami
const barDataLabelPlugin = {
    id: 'barDataLabelPlugin',
    afterDatasetsDraw(chart, args, options) {
      const { ctx } = chart;
      chart.data.datasets.forEach((dataset, datasetIndex) => {
        const meta = chart.getDatasetMeta(datasetIndex);
        meta.data.forEach((element, index) => {
          const dataValue = dataset.data[index];
          ctx.save();
          ctx.fillStyle = options.color || 'black';
          ctx.font = options.font || 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(dataValue.toFixed(2) + '%', element.x, element.y - 5);
          ctx.restore();
        });
      });
    }
};

// Inicjalizacja wykresu donut
const donutChart = new Chart(document.getElementById('donut-chart'), {
    type: 'doughnut',
    data: { labels: [], datasets: [{ data: [], backgroundColor: [] }] },
    options: { cutout: '50%', plugins: { legend: { position: 'bottom' }, datalabels: {display: false}, tooltip:{enabled: false} } }
});

// Inicjalizacja wykresu słupkowego
const barChart = new Chart(document.getElementById('bar-chart'), {
    type: 'bar',
    data: { labels: [], datasets: [{ data: [], backgroundColor: [] }] },
    options: { 
        scales: { y: { beginAtZero: true } },
        plugins: {
            legend: { display: false },
            barDataLabelPlugin: {
                color: '#000',
                font: 'bold 18px sans-serif'
            },
            tooltip:{ enabled: false }
        }
    },
    plugins: [barDataLabelPlugin]
});

// Inicjalizacja wykresu dla szczegółów okręgów
const constituencyChart = new Chart(document.getElementById('constituency-chart'), {
    type: 'bar',
    data: { 
        labels: [], 
        datasets: [{
            data: [], 
            backgroundColor: [],
        }] 
    },
    options: {
        scales: {
            y: {
                beginAtZero: true,
                ticks: { stepSize: 1 }
            }
        },
        plugins: {
            legend: { display: false }
        }
    }
});

// Plugin rysujący linię większości
const majorityLinePlugin = {
  id: 'majorityLinePlugin',
  afterDraw: (chart) => {
    const ctx = chart.ctx;
    const total = chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
    if (total === 0) return;
    const fraction = 231 / total;
    const meta = chart.getDatasetMeta(0);
    if (!meta || !meta.data || !meta.data.length) return;
    const arc = meta.data[0];
    const centerX = arc.x;
    const centerY = arc.y;
    const outerRadius = arc.outerRadius;
    const innerRadius = arc.innerRadius;
    const startAngle = (chart.options.rotation || 0) * (Math.PI / 180);
    const totalCircumference = (chart.options.circumference || 360) * (Math.PI / 180);
    const offsetDeg = 270; 
    const offset = offsetDeg * (Math.PI / 180);
    const angle = startAngle + fraction * totalCircumference + offset;
    const x1 = centerX + innerRadius * Math.cos(angle);
    const y1 = centerY + innerRadius * Math.sin(angle);
    const x2 = centerX + outerRadius * Math.cos(angle);
    const y2 = centerY + outerRadius * Math.sin(angle);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'black';
    ctx.stroke();
    ctx.restore();
  }
};

Chart.register(majorityLinePlugin);

// ============================================================
// START APLIKACJI
// ============================================================
loadConstituencies();
