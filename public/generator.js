document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const binInput = document.getElementById('bin-input');
    const clearBtn = document.querySelector('.clear-btn');
    const dateCheck = document.getElementById('date-check');
    const cvvCheck = document.getElementById('cvv-check');
    const quantityInput = document.getElementById('quantity');
    const cvvTypeSelect = document.getElementById('cvv-type');
    const monthSelect = document.getElementById('month');
    const yearSelect = document.getElementById('year');
    const generateBtn = document.getElementById('generate-btn');
    const clearFormBtn = document.getElementById('clear-btn');
    const copyBtn = document.getElementById('copy-btn');
    const downloadBtn = document.getElementById('download-btn');
    const emptyState = document.getElementById('empty-state');
    const resultsArea = document.getElementById('results');
    const toast = document.getElementById('toast');

    // Initialize
    binInput.focus();

    // Event Listeners
    binInput.addEventListener('input', formatBinInput);
    clearBtn.addEventListener('click', clearBinInput);
    generateBtn.addEventListener('click', generateCards);
    clearFormBtn.addEventListener('click', clearForm);
    copyBtn.addEventListener('click', copyResults);
    downloadBtn.addEventListener('click', downloadResults);

    // Format BIN input
    function formatBinInput(e) {
        let value = e.target.value.replace(/\D/g, '');

        if (value.length > 16) {
            value = value.slice(0, 16);
        }

        e.target.value = value;
    }

    // Clear BIN input
    function clearBinInput() {
        binInput.value = '';
        binInput.focus();
    }

    // Generate Cards
    async function generateCards() {
        const bin = binInput.value.trim();
        const quantity = parseInt(quantityInput.value) || 10;
        const includeDate = dateCheck.checked;
        const includeCvv = cvvCheck.checked;
        const cvvType = cvvTypeSelect.value;
        const month = monthSelect.value;
        const year = yearSelect.value;

        // Validate input
        if (bin.length < 6) {
            showToast('Please enter a BIN with at least 6 digits', false);
            binInput.focus();
            return;
        }

        if (quantity < 1 || quantity > 100) {
            showToast('Quantity must be between 1 and 100', false);
            quantityInput.focus();
            return;
        }

        // Show loading state
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';

        try {
            // Generate cards with slight delay to show loading
            await new Promise(resolve => setTimeout(resolve, 300));

            const cards = generateValidCards(bin, quantity, includeDate, includeCvv, cvvType, month, year);
            displayResults(cards);
            showToast(`Generated ${quantity} cards successfully`);
        } catch (error) {
            showToast('Error generating cards', false);
            console.error(error);
        } finally {
            // Reset button state
            generateBtn.disabled = false;
            generateBtn.innerHTML = '<i class="fa-solid fa-bolt"></i> Generate';
        }
    }

    // Generate valid cards with Luhn algorithm
    function generateValidCards(bin, quantity, includeDate, includeCvv, cvvType, month, year) {
        const cards = [];
        const currentYear = new Date().getFullYear();
        let fixedCvv = '';

        // Generate fixed CVV if needed
        if (cvvType === 'same' && includeCvv) {
            fixedCvv = generateRandomCvv(bin.startsWith('34') || bin.startsWith('37'));
        }

        for (let i = 0; i < quantity; i++) {
            // Generate card number with Luhn
            const cardNumber = generateLuhnNumber(bin);

            // Build card string
            let card = cardNumber;

            // Add date if needed
            if (includeDate) {
                const genMonth = month === 'random' ? 
                    String(Math.floor(Math.random() * 12) + 1).padStart(2, '0') : 
                    month;

                const genYear = year === 'random' ? 
                    String(currentYear + Math.floor(Math.random() * 10)).slice(-2) : 
                    year.slice(-2);

                card += `|${genMonth}|${genYear}`;
            }

            // Add CVV if needed
            if (includeCvv) {
                const cvv = cvvType === 'same' ? 
                    fixedCvv : 
                    generateRandomCvv(bin.startsWith('34') || bin.startsWith('37'));

                card += `|${cvv}`;
            }

            cards.push(card);
        }

        return cards;
    }

    // Generate card number with Luhn algorithm
    function generateLuhnNumber(bin) {
        const isAmex = bin.startsWith('34') || bin.startsWith('37');
        const length = isAmex ? 15 : 16;

        // Ensure bin isn't too long
        if (bin.length >= length) {
            bin = bin.slice(0, length - 1);
        }

        // Generate random digits
        let cardNumber = bin;
        const digitsNeeded = length - bin.length - 1; // -1 for checksum

        for (let i = 0; i < digitsNeeded; i++) {
            cardNumber += Math.floor(Math.random() * 10);
        }

        // Calculate and add Luhn check digit
        const checkDigit = calculateLuhnCheckDigit(cardNumber);
        return cardNumber + checkDigit;
    }

    // Calculate Luhn check digit
    function calculateLuhnCheckDigit(partial) {
        let sum = 0;
        let alternate = false;

        // Calculate sum
        for (let i = partial.length - 1; i >= 0; i--) {
            let digit = parseInt(partial.charAt(i));

            if (alternate) {
                digit *= 2;
                if (digit > 9) {
                    digit = (digit % 10) + 1;
                }
            }

            sum += digit;
            alternate = !alternate;
        }

        // Calculate check digit
        const checkDigit = (10 - (sum % 10)) % 10;
        return checkDigit.toString();
    }

    // Generate random CVV
    function generateRandomCvv(isAmex) {
        const length = isAmex ? 4 : 3;
        let cvv = '';

        for (let i = 0; i < length; i++) {
            cvv += Math.floor(Math.random() * 10);
        }

        return cvv;
    }

    // Display results
    function displayResults(cards) {
        if (cards.length === 0) {
            emptyState.classList.remove('hidden');
            resultsArea.classList.add('hidden');
            copyBtn.disabled = true;
            downloadBtn.disabled = true;
            return;
        }

        // Show results
        emptyState.classList.add('hidden');
        resultsArea.classList.remove('hidden');
        resultsArea.value = cards.join('\n');

        // Enable buttons
        copyBtn.disabled = false;
        downloadBtn.disabled = false;
    }

    // Clear form
    function clearForm() {
        binInput.value = '';
        quantityInput.value = '10';
        cvvTypeSelect.value = 'random';
        monthSelect.value = 'random';
        yearSelect.value = 'random';
        emptyState.classList.remove('hidden');
        resultsArea.classList.add('hidden');
        resultsArea.value = '';
        copyBtn.disabled = true;
        downloadBtn.disabled = true;
        binInput.focus();
    }

    // Copy results
    function copyResults() {
        if (!resultsArea.value.trim()) {
            showToast('No cards to copy', false);
            return;
        }

        resultsArea.select();
        document.execCommand('copy');
        window.getSelection().removeAllRanges();
        showToast('Cards copied to clipboard');
    }

    // Download results
    function downloadResults() {
        if (!resultsArea.value.trim()) {
            showToast('No cards to download', false);
            return;
        }

        const blob = new Blob([resultsArea.value], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');

        a.href = url;
        a.download = `cards-${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('Cards downloaded successfully');
    }

    // Show toast notification
    function showToast(message, success = true) {
        const icon = toast.querySelector('i');
        const text = toast.querySelector('span');

        // Set icon and color
        if (success) {
            icon.className = 'fa-solid fa-check';
            icon.style.color = '#4ade80';
        } else {
            icon.className = 'fa-solid fa-exclamation-triangle';
            icon.style.color = '#f87171';
        }

        // Set message and show
        text.textContent = message;
        toast.classList.remove('hidden');

        // Hide after delay
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 3000);
    }
});