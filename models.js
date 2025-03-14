// models.js
export class Committee {
    constructor(id, name, threshold, pastSupportEquivalence) {
        this.id = id;
        this.name = name;
        this.threshold = threshold;
        this.pastSupportEquivalence = pastSupportEquivalence;
    }
}

export class Constituency {
    constructor(number, size, pastSupport) {
        this.number = number;
        this.size = size;
        this.pastSupport = pastSupport;
        this.support = null;
        this.mandates = null;
    }
}

export class ElectionCalculator {
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
