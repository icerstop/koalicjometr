// charts.js
import { SHORT_NAMES, colors } from './config.js';

export function updateDonutChart(donutChart, mandates, committees) {
    const colorMapping = {
        'Trzecia Droga': '#FFFF00',
        'Lewica': '#FF0000',
        'Konfederacja': '#8B4513',
        'Koalicja Obywatelska': '#FFA500',
        'Prawo i Sprawiedliwość': '#000080',
        'Razem': '#880E4F',
        'Pozostałe': '#808080'
    };

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

export function updateBarChart(barChart, support, committees) {
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

export function initializeCharts() {
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

    // Rejestracja pluginów
    //Chart.register(barDataLabelPlugin);
    Chart.register(majorityLinePlugin);

    // Inicjalizacja wykresów
    const donutChart = new Chart(document.getElementById('donut-chart'), {
        type: 'doughnut',
        data: { labels: [], datasets: [{ data: [], backgroundColor: [] }] },
        options: { cutout: '50%', plugins: { legend: { position: 'bottom' }, datalabels: {display: false}, tooltip:{enabled: false} } }
    });

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

    return { donutChart, barChart, constituencyChart };
}
