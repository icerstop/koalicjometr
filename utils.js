// utils.js
export function shadeColor(color, percent) {
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

export function addCustomTooltip(regionElement, tooltipText) {
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

export function getCombinations(arr, r) {
    if (r === 1) return arr.map(val => [val]);
    const result = [];
    arr.forEach((val, idx) => {
        const smaller = getCombinations(arr.slice(idx + 1), r - 1);
        smaller.forEach(small => result.push([val, ...small]));
    });
    return result;
}
