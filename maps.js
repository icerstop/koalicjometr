// maps.js
import { shadeColor, addCustomTooltip } from './utils.js';
import { colors } from './config.js';

export async function updatePartyMap(committees, constituencies) {
    const response = await fetch('mapa-partie.svg');
    const text = await response.text();
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(text, 'image/svg+xml');
    const svgElement = svgDoc.querySelector('svg');
    svgElement.setAttribute('width', '100%');
    svgElement.setAttribute('height', 'auto');
    svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    
    const selectedParty = document.getElementById('party-list').value;
    const partyIndex = committees.findIndex(c => c.id === selectedParty);
    const baseColor = colors[selectedParty];
    
    const supportValues = constituencies.map(c => (c.support && c.support[partyIndex]) ? c.support[partyIndex] : 0);
    const minSupport = Math.min(...supportValues);
    const maxSupport = Math.max(...supportValues);
    
    const range = (maxSupport - minSupport) || 1;
    
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
    
    const partyMapContainer = document.getElementById('party-map');
    partyMapContainer.innerHTML = "";
    const legendWrapper = document.createElement('div');
    legendWrapper.id = 'party-map-legend';
    partyMapContainer.appendChild(legendWrapper);
    partyMapContainer.appendChild(svgElement);
    
    createLegend(minSupport, maxSupport, baseColor);
}

export function createLegend(minSupport, maxSupport, baseColor) {
    const legendContainer = document.getElementById('party-map-legend');
    legendContainer.innerHTML = '';

    const legendCanvas = document.createElement('canvas');
    legendCanvas.className = 'legend-canvas';
    legendContainer.appendChild(legendCanvas);

    const legendWidth = legendCanvas.offsetWidth || 200;
    const legendHeight = legendCanvas.offsetHeight || 20;
    legendCanvas.width = legendWidth;
    legendCanvas.height = legendHeight;

    const ctx = legendCanvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, legendWidth, 0);
    gradient.addColorStop(0, shadeColor(baseColor, 75));
    gradient.addColorStop(1, shadeColor(baseColor, 0));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, legendWidth, legendHeight);

    const labelContainer = document.createElement('div');
    labelContainer.className = 'legend-labels';
    
    const minLabel = document.createElement('div');
    minLabel.className = 'legend-min';
    minLabel.textContent = `${minSupport.toFixed(1)}%`;
    
    const maxLabel = document.createElement('div');
    maxLabel.className = 'legend-max';
    maxLabel.textContent = `${maxSupport.toFixed(1)}%`;
    
    labelContainer.appendChild(minLabel);
    labelContainer.appendChild(maxLabel);
    legendContainer.appendChild(labelContainer);
}

export async function colorMap(committees, constituencies) {
    const response = await fetch('okregi.svg');
    const text = await response.text();
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(text, 'image/svg+xml');
    const svgElement = svgDoc.querySelector('svg');
    svgElement.setAttribute('width', '100%');
    svgElement.setAttribute('height', 'auto');
    svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    const winners = getWinners(committees, constituencies);
    for (const [okreg, winner] of Object.entries(winners)) {
        const path = svgDoc.getElementById(`okreg_${okreg}`);
        if (path) {
            path.setAttribute('style', `fill:${colors[winner] || '#FFFFFF'};stroke:#000000;stroke-width:1px;`);
        }
    }
    const serializer = new XMLSerializer();
    document.getElementById('map').innerHTML = serializer.serializeToString(svgDoc);
}

export function getWinners(committees, constituencies) {
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

export function populateConstituencyList(constituencies) {
    const list = document.getElementById('constituency-list');
    constituencies.forEach(c => {
        const option = document.createElement('option');
        option.text = `Okręg ${c.number} (${c.size} mandatów)`;
        list.add(option);
    });
    list.selectedIndex = 0;
    list.addEventListener('change', updateConstituencyDetails);
}

export function updateConstituencyDetails(committees, constituencies, constituencyChart, SHORT_NAMES, colors) {
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
