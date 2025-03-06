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
        const parties = ['td', 'nl', 'pis', 'konf', 'ko'];
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
        let localSupport = support.map((s, i) => s * localSupportDeviation[i]);
        //if (constituency.number === 21) {
        //    localSupport.push(5.37); // MN w Opolu
        //}
        if (constituency.number === 32) {
            const nlIndex = this.committees.findIndex(c => c.id === 'nl');
            const cap = 1.8 * support[nlIndex];
            if (localSupport[nlIndex] > cap) localSupport[nlIndex] = cap;
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

// Inicjalizacja danych
const committees = [
    new Committee('td', 'Trzecia Droga', 5, [['td', 1]]),
    new Committee('nl', 'Lewica', 5, [['nl', 1]]),
    new Committee('pis', 'Prawo i Sprawiedliwość', 5, [['pis', 1]]),
    new Committee('konf', 'Konfederacja', 5, [['konf', 1]]),
    new Committee('ko', 'Koalicja Obywatelska', 5, [['ko', 1]])
];

const colors = {
    'td': '#FFFF00',
    'nl': '#FF0000',
    'pis': '#000080',
    'konf': '#8B4513',
    'ko': '#FFA500'
};

let constituencies = [];
let calculator;

async function loadConstituencies() {
    const response = await fetch('data/wybory2023.csv');
    const text = await response.text();
    const rows = text.trim().split('\n').slice(1); // Usuwamy białe znaki i pomijamy nagłówek
    constituencies = rows
        .filter(row => row.trim() !== '') // Pomijamy puste linie
        .map((row, index) => {
            const parts = row.split(';');
            if (parts.length !== 7) {
                console.error(`Błąd w wierszu ${index + 2}: za mało kolumn (${parts.length} zamiast 7)`);
                return null;
            }
            const [number, size, td, nl, pis, konf, ko] = parts;
            const pastSupport = {
                td: parseFloat(td.replace(',', '.')),
                nl: parseFloat(nl.replace(',', '.')),
                pis: parseFloat(pis.replace(',', '.')),
                konf: parseFloat(konf.replace(',', '.')),
                ko: parseFloat(ko.replace(',', '.'))
            };
            return new Constituency(parseInt(number), parseInt(size), pastSupport);
        })
        .filter(c => c !== null); // Usuwamy błędne wiersze
    if (constituencies.length === 0) {
        console.error('Nie udało się załadować żadnych danych z pliku CSV.');
        return;
    }
    calculator = new ElectionCalculator(committees, constituencies);
    populateConstituencyList();
    calculateMandates();
}

// Interakcja z UI
const sliders = ['td', 'nl', 'pis', 'konf', 'ko'].map(id => document.getElementById(`${id}-slider`));
const entries = ['td', 'nl', 'pis', 'konf', 'ko'].map(id => document.getElementById(`${id}-entry`));
const thresholds = ['td', 'nl', 'pis', 'konf', 'ko'].map(id => document.getElementById(`${id}-threshold`));
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
}

// Wykresy
const donutChart = new Chart(document.getElementById('donut-chart'), {
    type: 'doughnut',
    data: { labels: [], datasets: [{ data: [], backgroundColor: [] }] },
    options: { cutout: '50%', plugins: { legend: { position: 'bottom' } } }
});

const barChart = new Chart(document.getElementById('bar-chart'), {
    type: 'bar',
    data: { labels: [], datasets: [{ data: [], backgroundColor: [] }] },
    options: { scales: { y: { beginAtZero: true } } }
});

const constituencyChart = new Chart(document.getElementById('constituency-chart'), {
    type: 'bar',
    data: { labels: [], datasets: [{ data: [], backgroundColor: [] }] },
    options: { scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
});

function updateDonutChart(mandates) {
    const shortNames = { 'Trzecia Droga': 'TD', 'Lewica': 'NL', 'Prawo i Sprawiedliwość': 'PiS', 'Konfederacja': 'KONF', 'Koalicja Obywatelska': 'KO' };
    const order = ['Prawo i Sprawiedliwość', 'Konfederacja', 'Trzecia Droga', 'Koalicja Obywatelska', 'Lewica'];
    const labels = [];
    const data = [];
    const bgColors = [];
    order.forEach(name => {
        const idx = committees.findIndex(c => c.name === name);
        if (mandates[idx] > 0) {
            labels.push(`${shortNames[name]} (${mandates[idx]})`);
            data.push(mandates[idx]);
            bgColors.push(colors[committees[idx].id]);
        }
    });
    donutChart.data.labels = labels;
    donutChart.data.datasets[0].data = data;
    donutChart.data.datasets[0].backgroundColor = bgColors;
    donutChart.update();
}

function updateBarChart(support) {
    const shortNames = { 'Trzecia Droga': 'TD', 'Lewica': 'NL', 'Prawo i Sprawiedliwość': 'PiS', 'Konfederacja': 'KONF', 'Koalicja Obywatelska': 'KO' };
    const data = committees.map((c, i) => ({ support: support[i], name: shortNames[c.name], color: colors[c.id] }));
    data.sort((a, b) => b.support - a.support);
    barChart.data.labels = data.map(d => d.name);
    barChart.data.datasets[0].data = data.map(d => d.support);
    barChart.data.datasets[0].backgroundColor = data.map(d => d.color);
    barChart.update();
}

// Mapa
async function colorMap() {
    const response = await fetch('okregi.svg');
    const text = await response.text();
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(text, 'image/svg+xml');
    const svgElement = svgDoc.querySelector('svg');
    svgElement.setAttribute('width', '100%');  // Pełna szerokość kontenera
    svgElement.setAttribute('height', 'auto'); // Automatyczna wysokość
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
        if (c.mandates) {
            const maxMandates = Math.max(...c.mandates);
            const winnerIndex = c.mandates.indexOf(maxMandates);
            winners[c.number] = committees[winnerIndex].id;
        }
    }
    return winners;
}

// Szczegóły okręgów
function populateConstituencyList() {
    const list = document.getElementById('constituency-list');
    constituencies.forEach(c => {
        const option = document.createElement('option');
        option.text = `Okręg ${c.number} (${c.size} mandatów)`;
        list.add(option);
    });
    list.selectedIndex = 0;
    list.addEventListener('change', updateConstituencyDetails);
}

function updateConstituencyDetails() {
    const list = document.getElementById('constituency-list');
    const idx = list.selectedIndex;
    if (idx === -1) return;
    const c = constituencies[idx];
    if (!c.mandates) return;
    const shortNames = { 'Trzecia Droga': 'TD', 'Lewica': 'NL', 'Prawo i Sprawiedliwość': 'PiS', 'Konfederacja': 'KONF', 'Koalicja Obywatelska': 'KO' };
    const data = committees.map((comm, i) => ({
        name: shortNames[comm.name],
        mandates: c.mandates[i],
        color: colors[comm.id]
    })).filter(d => d.mandates > 0);
    data.sort((a, b) => b.mandates - a.mandates);
    constituencyChart.data.labels = data.map(d => d.name);
    constituencyChart.data.datasets[0].data = data.map(d => d.mandates);
    constituencyChart.data.datasets[0].backgroundColor = data.map(d => d.color);
    constituencyChart.update();
}

// Koalicje
function updateCoalitions(mandates, support) {
    const shortNames = { 'Trzecia Droga': 'TD', 'Lewica': 'NL', 'Prawo i Sprawiedliwość': 'PiS', 'Konfederacja': 'KONF', 'Koalicja Obywatelska': 'KO' };
    const coalitions = [];
    const n = committees.length;
    for (let r = 1; r <= n; r++) {
        const combinations = getCombinations([...Array(n).keys()], r);
        for (const subset of combinations) {
            const subsetIds = subset.map(i => committees[i].id);
            if (subsetIds.includes('pis') && subsetIds.includes('ko')) continue;
            if (subsetIds.includes('nl') && subsetIds.includes('konf')) continue;
            if (subsetIds.includes('nl') && subsetIds.includes('pis')) continue;
            const total = subset.reduce((sum, i) => sum + mandates[i], 0);
            if (total >= 231) {
                const coalitionData = subset.map(i => ({
                    abbr: shortNames[committees[i].name],
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
    document.getElementById('coalitions-text').value = uniqueCoalitions.join('\n') || 'Brak koalicji dających większość';
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

// Start
loadConstituencies();
