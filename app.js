// app.js
import { Constituency, ElectionCalculator } from './models.js';
import { committees, colors, SHORT_NAMES } from './config.js';
import { getCombinations } from './utils.js';
import { updateDonutChart, updateBarChart, initializeCharts } from './charts.js';
import { updatePartyMap, populateConstituencyList, updateConstituencyDetails, colorMap } from './maps.js';

let constituencies = [];
let calculator;

const { donutChart, barChart, constituencyChart } = initializeCharts();

// Funkcja ładowania danych CSV i inicjalizacji kalkulatora
export async function loadConstituencies() {
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
    populateConstituencyList(constituencies);
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

    updateDonutChart(donutChart, mandates, committees);
    updateBarChart(barChart, support, committees);
    colorMap(committees, constituencies);
    updateConstituencyDetails(committees, constituencies, constituencyChart, SHORT_NAMES, colors);
    updateCoalitions(mandates, support);
    updatePartyMap(committees, constituencies);
}

// Funkcja aktualizująca koalicje (pozostaje w tym pliku, aby nie komplikować struktury)
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

// Ustawienie event listenera dla zmiany wybranej partii
document.getElementById('party-list').addEventListener('change', () => updatePartyMap(committees, constituencies));

// Start aplikacji
loadConstituencies();
