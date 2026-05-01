/**
 * ABA File Generator for Australian Bank Payments
 * Supports CBA, ANZ, NAB, Westpac format
 * 
 * Usage:
 *   const generator = new ABAGenerator(config);
 *   generator.addPayment({ ... });
 *   const abaContent = generator.generate();
 */

class ABAGenerator {
    constructor(config) {
        this.config = {
            bsb: config.bsb || '',                    // Your BSB (e.g., '062-000')
            accountNumber: config.accountNumber || '', // Your account number
            accountName: config.accountName || '',     // Your account name (max 26 chars)
            bankName: config.bankName || 'CBA',        // Bank name (3 chars)
            userId: config.userId || '',               // Bank-assigned user ID (6 chars)
            description: config.description || 'PAYMENT', // Description (max 12 chars)
            processingDate: config.processingDate || new Date()
        };
        this.payments = [];
    }

    /**
     * Add a payment to the batch
     * @param {Object} payment
     * @param {string} payment.bsb - Recipient BSB
     * @param {string} payment.accountNumber - Recipient account number
     * @param {string} payment.accountName - Recipient name (max 32 chars)
     * @param {number} payment.amount - Amount in dollars (will convert to cents)
     * @param {string} payment.reference - Your reference (max 18 chars)
     * @param {string} payment.remitterName - Your name on their statement (max 16 chars)
     */
    addPayment(payment) {
        this.payments.push({
            bsb: this.formatBSB(payment.bsb),
            accountNumber: this.padLeft(payment.accountNumber.replace(/\D/g, ''), 9, ' '),
            accountName: this.padRight(payment.accountName.toUpperCase().substring(0, 32), 32, ' '),
            amount: Math.round(payment.amount * 100), // Convert to cents
            reference: this.padRight((payment.reference || '').substring(0, 18), 18, ' '),
            remitterName: this.padRight((payment.remitterName || this.config.accountName).substring(0, 16), 16, ' '),
            indicator: ' ',
            transactionCode: '53' // Credit payment
        });
        return this;
    }

    formatBSB(bsb) {
        const clean = bsb.replace(/\D/g, '');
        return clean.substring(0, 3) + '-' + clean.substring(3, 6);
    }

    padLeft(str, len, char = ' ') {
        return String(str).padStart(len, char);
    }

    padRight(str, len, char = ' ') {
        return String(str).padEnd(len, char).substring(0, len);
    }

    formatDate(date) {
        const d = new Date(date);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yy = String(d.getFullYear()).substring(2);
        return dd + mm + yy;
    }

    /**
     * Generate the ABA file content
     * @returns {string} ABA file content
     */
    generate() {
        if (this.payments.length === 0) {
            throw new Error('No payments added');
        }

        const lines = [];
        
        // Record Type 0 - Descriptive Record (Header)
        const header = [
            '0',                                                    // Record type
            this.padRight('', 17, ' '),                            // Blank
            '01',                                                   // Reel sequence number
            this.padRight(this.config.bankName, 3, ' '),           // Bank name
            this.padRight('', 7, ' '),                             // Blank
            this.padRight(this.config.accountName.substring(0, 26), 26, ' '), // User name
            this.padLeft(this.config.userId, 6, '0'),              // User ID
            this.padRight(this.config.description.substring(0, 12), 12, ' '), // Description
            this.formatDate(this.config.processingDate),           // Processing date
            this.padRight('', 40, ' ')                             // Blank
        ].join('');
        lines.push(header);

        // Record Type 1 - Detail Records
        let totalCredit = 0;
        let totalDebit = 0;
        
        for (const payment of this.payments) {
            const detail = [
                '1',                                                // Record type
                payment.bsb,                                        // BSB
                payment.accountNumber,                              // Account number
                payment.indicator,                                  // Indicator
                payment.transactionCode,                            // Transaction code
                this.padLeft(payment.amount, 10, '0'),             // Amount in cents
                payment.accountName,                                // Account name
                payment.reference,                                  // Lodgement reference
                this.formatBSB(this.config.bsb),                   // Trace BSB
                this.padLeft(this.config.accountNumber.replace(/\D/g, ''), 9, ' '), // Trace account
                payment.remitterName,                               // Remitter name
                this.padLeft('0', 8, '0')                          // Withholding tax
            ].join('');
            lines.push(detail);
            totalCredit += payment.amount;
        }

        // Record Type 7 - File Total Record
        const netTotal = Math.abs(totalCredit - totalDebit);
        const footer = [
            '7',                                                    // Record type
            '999-999',                                              // BSB format filler
            this.padRight('', 12, ' '),                            // Blank
            this.padLeft(netTotal, 10, '0'),                       // Net total
            this.padLeft(totalCredit, 10, '0'),                    // Credit total
            this.padLeft(totalDebit, 10, '0'),                     // Debit total
            this.padRight('', 24, ' '),                            // Blank
            this.padLeft(this.payments.length, 6, '0'),            // Record count
            this.padRight('', 40, ' ')                             // Blank
        ].join('');
        lines.push(footer);

        return lines.join('\r\n');
    }

    /**
     * Generate and download as file
     */
    download(filename = 'payments.aba') {
        const content = this.generate();
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }
}

// Example usage:
/*
const generator = new ABAGenerator({
    bsb: '062-000',
    accountNumber: '12345678',
    accountName: 'MINT INVEST GROUP PTY LTD',
    bankName: 'CBA',
    userId: '123456',
    description: 'PAYROLL',
    processingDate: new Date()
});

generator.addPayment({
    bsb: '063-001',
    accountNumber: '87654321',
    accountName: 'JOHN SMITH',
    amount: 1500.00,
    reference: 'SALARY MAY 2026',
    remitterName: 'MINT INVEST'
});

generator.addPayment({
    bsb: '064-002',
    accountNumber: '11223344',
    accountName: 'JANE DOE',
    amount: 2000.00,
    reference: 'CONTRACTOR INV123',
    remitterName: 'MINT INVEST'
});

const abaContent = generator.generate();
// Or: generator.download('payroll-may-2026.aba');
*/

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ABAGenerator;
}
