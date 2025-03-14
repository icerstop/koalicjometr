// config.js
import { Committee } from './models.js';

export const committees = [
    new Committee('td', 'Trzecia Droga', 5, [['td', 1]]),
    new Committee('nl', 'Lewica', 5, [['nl', 1]]),
    new Committee('pis', 'Prawo i Sprawiedliwość', 5, [['pis', 1]]),
    new Committee('konf', 'Konfederacja', 5, [['konf', 1]]),
    new Committee('ko', 'Koalicja Obywatelska', 5, [['ko', 1]]),
    new Committee('rz', 'Razem', 5, [['rz', 1]]),
    new Committee('poz', 'Pozostałe', 100, [['poz', 1]])
];

export const colors = {
    'td': '#FFFF00',
    'nl': '#FF0000',
    'pis': '#000080',
    'konf': '#8B4513',
    'ko': '#FFA500',
    'rz': '#a10249',
    'poz': '#808080'
};

export const SHORT_NAMES = {
    'Trzecia Droga': 'TD',
    'Lewica': 'NL',
    'Prawo i Sprawiedliwość': 'PiS',
    'Konfederacja': 'KONF',
    'Koalicja Obywatelska': 'KO',
    'Razem': 'RZ',
    'Pozostałe': 'POZ'
};
