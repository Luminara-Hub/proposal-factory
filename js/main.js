// Initialize form with current date and transfers array
let transfers = [];

document.addEventListener('DOMContentLoaded', () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('created').value = now.toISOString().slice(0, 16);

    // Initialize requires checkbox handler
    const requiresCheckbox = document.getElementById('requires-checkbox');
    const requiresInput = document.getElementById('requires');
    const requiresWarning = document.querySelector('.requires-warning');

    requiresCheckbox.addEventListener('change', (e) => {
        requiresInput.disabled = !e.target.checked;
        requiresWarning.style.display = e.target.checked ? 'block' : 'none';
        if (!e.target.checked) {
            requiresInput.value = '0';
        }
    });

    // Initialize PGF type handler
    document.getElementById('pgf-type').addEventListener('change', (e) => {
        const transferFields = document.getElementById('pgf-transfer-fields');
        const ibcFields = document.getElementById('pgf-ibc-fields');
        
        if (e.target.value === 'ibc') {
            transferFields.style.display = 'none';
            ibcFields.style.display = 'block';
        } else {
            transferFields.style.display = 'block';
            ibcFields.style.display = 'none';
        }
    });

    // Initialize add transfer button handler
    document.getElementById('add-transfer-btn').addEventListener('click', addTransfer);

    autoPrefixTitle();
    fetchVotingPower();
    fetchCurrentEpoch();
});

// Calculate epochs based on current epoch and hours
function calculateEpochs(currentEpoch, hours) {
    // Each epoch is 6 hours
    return currentEpoch + Math.ceil(hours / 6);
}

// Check if hours are in denominations of 6
function isValidHourDenomination(hours) {
    return hours % 6 === 0;
}

// Show warning message for an input
function showWarning(inputId, message) {
    let warningId = `${inputId}-warning`;
    let warningEl = document.getElementById(warningId);
    
    if (!warningEl) {
        warningEl = document.createElement('div');
        warningEl.id = warningId;
        warningEl.className = 'input-warning';
        const input = document.getElementById(inputId);
        input.parentNode.insertBefore(warningEl, input.nextSibling);
    }
    
    warningEl.textContent = message;
}

// Clear warning message
function clearWarning(inputId) {
    const warningEl = document.getElementById(`${inputId}-warning`);
    if (warningEl) {
        warningEl.remove();
    }
}

// Update the timing preview
function updateTimingPreview() {
    const currentEpoch = parseInt(document.getElementById('current-epoch').value) || 0;
    const votingStartHours = parseInt(document.getElementById('voting-start-hours').value) || 0;
    const votingDurationDays = parseInt(document.getElementById('voting-duration-days').value) || 0;
    const votingDurationHours = parseInt(document.getElementById('voting-duration-hours').value) || 0;
    const activationDelayDays = parseInt(document.getElementById('activation-delay-days').value) || 0;
    const activationDelayHours = parseInt(document.getElementById('activation-delay-hours').value) || 6;

    // Validate hours denominations
    if (!isValidHourDenomination(votingStartHours)) {
        showWarning('voting-start-hours', '⚠️ Hours should be in denominations of 6');
    } else {
        clearWarning('voting-start-hours');
    }

    if (!isValidHourDenomination(votingDurationHours)) {
        showWarning('voting-duration-hours', '⚠️ Hours should be in denominations of 6');
    } else {
        clearWarning('voting-duration-hours');
    }

    if (!isValidHourDenomination(activationDelayHours)) {
        showWarning('activation-delay-hours', '⚠️ Hours should be in denominations of 6');
    } else {
        clearWarning('activation-delay-hours');
    }

    const votingStartEpoch = calculateEpochs(currentEpoch, votingStartHours);
    const votingDurationTotalHours = (votingDurationDays * 24) + votingDurationHours;
    const votingEndEpoch = calculateEpochs(votingStartEpoch, votingDurationTotalHours);
    const activationDelayTotalHours = (activationDelayDays * 24) + activationDelayHours;
    const activationEpoch = calculateEpochs(votingEndEpoch, activationDelayTotalHours);

    // Validate minimum activation epoch difference
    const minActivationDiff = calculateEpochs(votingEndEpoch, 6) - votingEndEpoch;
    if (activationEpoch - votingEndEpoch < minActivationDiff) {
        showWarning('activation-delay-hours', '⚠️ Activation must be at least 6 hours after voting ends');
        document.getElementById('create-proposal-btn').disabled = true;
    } else {
        clearWarning('activation-delay-hours');
        document.getElementById('create-proposal-btn').disabled = false;
    }

    document.getElementById('voting-start-epoch-preview').textContent = `Epoch ${votingStartEpoch}`;
    document.getElementById('voting-end-epoch-preview').textContent = `Epoch ${votingEndEpoch}`;
    document.getElementById('activation-epoch-preview').textContent = `Epoch ${activationEpoch}`;

    return {
        votingStartEpoch,
        votingEndEpoch,
        activationEpoch
    };
}

// Handle proposal type selection
document.getElementById('proposal-type').addEventListener('change', (e) => {
    const protocolFields = document.getElementById('protocol-fields');
    const pgfFields = document.getElementById('pgf-fields');
    
    protocolFields.style.display = e.target.value === 'protocol' ? 'block' : 'none';
    pgfFields.style.display = e.target.value === 'pgf' ? 'block' : 'none';
    
    if (e.target.value !== 'pgf') {
        transfers = [];
        updateTransfersPreview();
    }

    autoPrefixTitle();
    fetchVotingPower();
});

// Attach the same handler to both Next: Timing Settings buttons
const nextBtn = document.getElementById('next-btn');
const nextBtnTop = document.getElementById('next-btn-top');
function handleNextClick() {
    // Basic validation
    const requiredFields = ['title', 'authors', 'abstract', 'motivation', 'details', 'author-address'];
    const missingFields = requiredFields.filter(field => !document.getElementById(field).value.trim());
    if (missingFields.length > 0) {
        alert('Please fill in all required fields:\n' + missingFields.join('\n'));
        return;
    }
    // Auto-fill current epoch if blank
    if (!document.getElementById('current-epoch').value) {
        fetchCurrentEpoch();
    }
    document.getElementById('proposal-form').style.display = 'none';
    document.getElementById('timing-form').style.display = 'block';
}
nextBtn.addEventListener('click', handleNextClick);
nextBtnTop.addEventListener('click', handleNextClick);

document.getElementById('back-btn').addEventListener('click', () => {
    document.getElementById('timing-form').style.display = 'none';
    document.getElementById('proposal-form').style.display = 'block';
});

// Convert NAM to base units
function convertToBaseUnits(nam) {
    return (parseFloat(nam) * 1_000_000).toString();
}

// Add a transfer to the list
function addTransfer() {
    const pgfType = document.getElementById('pgf-type').value;
    let transfer;

    if (pgfType === 'ibc') {
        const amount = document.getElementById('ibc-amount').value;
        const target = document.getElementById('ibc-target').value;
        const portId = document.getElementById('ibc-port').value;
        const channelId = document.getElementById('ibc-channel').value;

        if (!amount || !target || !portId || !channelId) {
            alert('Please fill in all IBC transfer fields');
            return;
        }

        transfer = {
            IBC: {
                amount: convertToBaseUnits(amount),
                target: target,
                port_id: portId,
                channel_id: channelId
            }
        };
    } else {
        const amount = document.getElementById('transfer-amount').value;
        const target = document.getElementById('transfer-target').value;

        if (!amount || !target) {
            alert('Please fill in amount and target address');
            return;
        }

        transfer = {
            Internal: {
                amount: convertToBaseUnits(amount),
                target: target
            }
        };
    }

    transfers.push(transfer);
    updateTransfersPreview();
    clearTransferFields();
}

// Update the transfers preview
function updateTransfersPreview() {
    const previewEl = document.getElementById('transfers-preview');
    previewEl.innerHTML = transfers.map((transfer, index) => {
        const isIBC = 'IBC' in transfer;
        const details = isIBC ? transfer.IBC : transfer.Internal;
        const amount = (parseInt(details.amount) / 1_000_000).toFixed(6);

        return `
            <div class="transfer-item">
                <button class="remove-transfer" onclick="removeTransfer(${index})">×</button>
                <div class="transfer-details">
                    <span class="transfer-label">Type:</span>
                    <span class="transfer-value">${isIBC ? 'IBC Transfer' : 'Internal Transfer'}</span>
                    
                    <span class="transfer-label">Amount:</span>
                    <span class="transfer-value transfer-amount">${amount} NAM</span>
                    
                    <span class="transfer-label">Target:</span>
                    <span class="transfer-value">${details.target}</span>
                    
                    ${isIBC ? `
                        <span class="transfer-label">Port ID:</span>
                        <span class="transfer-value">${details.port_id}</span>
                        
                        <span class="transfer-label">Channel ID:</span>
                        <span class="transfer-value">${details.channel_id}</span>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('') || '<div class="empty-state">No transfers added yet</div>';
}

// Remove a transfer from the list
function removeTransfer(index) {
    transfers.splice(index, 1);
    updateTransfersPreview();
}

// Clear transfer input fields
function clearTransferFields() {
    const pgfType = document.getElementById('pgf-type').value;
    if (pgfType === 'ibc') {
        document.getElementById('ibc-amount').value = '';
        document.getElementById('ibc-target').value = '';
        document.getElementById('ibc-port').value = '';
        document.getElementById('ibc-channel').value = '';
    } else {
        document.getElementById('transfer-amount').value = '';
        document.getElementById('transfer-target').value = '';
    }
}

// Update createProposalJson function to include transfers
function createProposalJson() {
    const proposalType = document.getElementById('proposal-type').value;
    const title = document.getElementById('title').value;
    const authors = document.getElementById('authors').value;
    const discussionsTo = document.getElementById('discussions-to').value;
    const created = new Date(document.getElementById('created').value).toISOString();
    const abstract = document.getElementById('abstract').value;
    const motivation = document.getElementById('motivation').value;
    const details = document.getElementById('details').value;
    const requires = document.getElementById('requires-checkbox').checked ? 
        document.getElementById('requires').value : "0";
    const authorAddress = document.getElementById('author-address').value;

    // Get epoch values from the timing preview
    const epochs = updateTimingPreview();

    const proposal = {
        proposal: {
            content: {
                title,
                authors,
                "discussions-to": discussionsTo,
                created,
                abstract,
                motivation,
                details,
                requires
            },
            author: authorAddress,
            voting_start_epoch: epochs.votingStartEpoch,
            voting_end_epoch: epochs.votingEndEpoch,
            activation_epoch: epochs.activationEpoch
        }
    };

    // Add protocol-specific fields
    if (proposalType === 'protocol') {
        const wasmCode = document.getElementById('wasm-code').value;
        if (wasmCode.trim()) {
            proposal.wasm = wasmCode;
        }
    }

    if (proposalType === 'pgf' && transfers.length > 0) {
        proposal.data = {
            continuous: [],
            retro: transfers
        };
    }

    return JSON.stringify(proposal, null, 2);
}

// Handle proposal creation
document.getElementById('create-proposal-btn').addEventListener('click', () => {
    const jsonOutput = createProposalJson();
    document.getElementById('json-output').value = jsonOutput;
});

// Add timing form input handlers
const timingInputs = [
    'current-epoch',
    'voting-start-hours',
    'voting-duration-days',
    'voting-duration-hours',
    'activation-delay-days',
    'activation-delay-hours'
];

timingInputs.forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateTimingPreview);
});

// Initialize marked.js with options
marked.setOptions({
    breaks: true,
    gfm: true,
    headerIds: true,
    highlight: function (code, lang) {
        if (lang && hljs.getLanguage(lang)) {
            try {
                return hljs.highlight(code, { language: lang }).value;
            } catch (err) {}
        }
        return code;
    }
});

// Custom renderer for better handling of checkboxes and emojis
const renderer = new marked.Renderer();

// Override the checkbox renderer
renderer.checkbox = function(checked) {
    return checked ? '✅' : '⬜️';
};

// Emoji map for conversion
const emojiMap = {
    ':white_check_mark:': '✅',
    ':heart:': '❤️',
    ':tada:': '🎉',
    ':rocket:': '🚀',
    ':dart:': '🎯',
    ':superhero:': '🦸',
    ':sparkles:': '✨',
    ':fire:': '🔥',
    ':star2:': '🌟',
    ':wave:': '👋',
    ':low_brightness:': '🔅',
    ':bullseye:': '🎯',
    ':ballot_box:': '🗳️',
    ':raised_hands:': '🙌',
    ':eyes:': '👀',
    ':bright_button:': '🔆',
    ':dim_button:': '🔅',
    ':sweat_droplets:': '💦'
};

// Helper function to replace emoji shortcodes
function replaceEmojis(text) {
    return Object.entries(emojiMap).reduce((str, [shortcode, emoji]) => {
        return str.split(shortcode).join(emoji);
    }, text);
}

// Override the text renderer to handle emojis
renderer.text = function(text) {
    if (typeof text !== 'string') return '';
    return replaceEmojis(text);
};

// Add renderer to marked options
marked.use({ renderer });

// Format date to a readable string
function formatDate(timestamp) {
    return new Date(timestamp).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Format NAM amount
function formatNAM(amount) {
    // Convert from base units to NAM (divide by 1,000,000)
    let namAmount = Number(amount) / 1_000_000;
    let [whole, decimal] = namAmount.toFixed(6).split('.');
    // Remove trailing zeros in decimal
    decimal = decimal.replace(/0+$/, '');
    let formatted = Number(whole).toLocaleString();
    if (decimal.length > 0) {
        formatted += '.' + decimal;
    }
    return `${formatted} NAM`;
}

// Clean markdown content
function cleanMarkdownContent(content) {
    // Convert emoji shortcodes to actual emojis
    let result = replaceEmojis(content);
    
    // Remove image embeds and their links
    result = result.replace(/!\[([^\]]*)\]\([^)]+\)(?:\n*\([^)]+\))?/g, '');
    
    // Clean up Twitter links
    result = result.replace(/\(https:\/\/(?:x\.com|twitter\.com)\/[^)]+\)/g, '');
    
    // Remove [(link)] lines
    result = result.replace(/^\s*\[\(link\)\]\s*$/gm, '');
    
    // Clean up any remaining empty lines and normalize spacing
    return result.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n\n');
}

// Extract title from markdown
function extractTitleFromMarkdown(content) {
    const titleMatch = content.match(/^#+\s*(.+)$/m);
    return titleMatch ? titleMatch[1].trim() : 'Untitled Proposal';
}

// Process markdown content for preview
function processMarkdown(content) {
    if (typeof content !== 'string') return '<p>Invalid content</p>';
    
    // Convert checkboxes to emoji format
    content = content.split('[x]').join('✅');
    content = content.split('[ ]').join('⬜️');
    
    // Parse markdown
    return marked.parse(content);
}

// Display the proposal preview
function displayProposalPreview(jsonString) {
    try {
        const data = JSON.parse(jsonString);
        const proposal = data.proposal?.content || {};
        const proposalType = document.getElementById('proposal-type').value;
        
        // Set title and metadata
        document.getElementById('proposal-title').textContent = proposal.title || 'Untitled Proposal';
        document.getElementById('proposal-author').textContent = proposal.authors || 'Anonymous';
        document.getElementById('proposal-date').textContent = proposal.created ? 
            new Date(proposal.created).toLocaleDateString() : 'Date not specified';
        
        // Set proposal info
        const votingStart = data.proposal?.voting_start_epoch;
        const votingEnd = data.proposal?.voting_end_epoch;
        const activationEpoch = data.proposal?.activation_epoch;
        
        document.getElementById('voting-start').textContent = votingStart ? `Epoch ${votingStart}` : 'Not specified';
        document.getElementById('voting-end').textContent = votingEnd ? `Epoch ${votingEnd}` : 'Not specified';
        document.getElementById('activation-epoch').textContent = activationEpoch ? `Epoch ${activationEpoch}` : 'Not specified';
        
        // Render markdown content
        const contentHtml = proposal.details ? processMarkdown(proposal.details) : '<p>No details provided</p>';
        document.getElementById('proposal-content').innerHTML = contentHtml;
        
        // Handle transfers section
        const transfersSection = document.querySelector('.transfers-section');
        if (proposalType === 'pgf') {
            transfersSection.style.display = 'block';
            const retroTransfers = data.data?.retro || [];
            const continuousTransfers = data.data?.continuous || [];
            
            const transfersList = document.getElementById('transfers-list');
            let transfersHtml = '';
            
            if (retroTransfers.length > 0) {
                transfersHtml += '<h3>Retro Transfers</h3>';
                transfersHtml += retroTransfers.map(transfer => {
                    if (!transfer?.Internal) return '';
                    const amount = transfer.Internal.amount ? formatNAM(transfer.Internal.amount) : 'Amount not specified';
                    const target = transfer.Internal.target || 'Address not specified';
                    return `
                        <div class="transfer-item">
                            <div class="transfer-amount">${amount}</div>
                            <div class="transfer-address">${target}</div>
                        </div>
                    `;
                }).join('');
            }
            
            if (continuousTransfers.length > 0) {
                transfersHtml += '<h3>Continuous Transfers</h3>';
                transfersHtml += continuousTransfers.map(transfer => {
                    if (!transfer?.Internal) return '';
                    const amount = transfer.Internal.amount ? formatNAM(transfer.Internal.amount) : 'Amount not specified';
                    const target = transfer.Internal.target || 'Address not specified';
                    return `
                        <div class="transfer-item">
                            <div class="transfer-amount">${amount}</div>
                            <div class="transfer-address">${target}</div>
                        </div>
                    `;
                }).join('');
            }
            
            if (!transfersHtml) {
                transfersHtml = '<div class="empty-state">No transfers specified in this proposal</div>';
            }
            
            transfersList.innerHTML = transfersHtml;
        } else {
            transfersSection.style.display = 'none';
        }
        
        // Show preview section
        document.getElementById('preview-section').style.display = 'block';
    } catch (error) {
        console.error('Error displaying proposal preview:', error);
        alert('Error displaying proposal preview. Please check the JSON format.');
    }
}

// Handle preview button click
document.getElementById('preview-btn').addEventListener('click', () => {
    const jsonOutput = document.getElementById('json-output').value;
    displayProposalPreview(jsonOutput);
    setTimeout(() => {
        const previewSection = document.getElementById('preview-section');
        if (previewSection) {
            previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, 100);
});

// Helper to set proposal type and update UI
function setType(type) {
    document.getElementById('proposal-type').value = type;
    autoPrefixTitle();
    fetchVotingPower();
    // Show/hide conditional fields
    document.getElementById('protocol-fields').style.display = type === 'protocol' ? 'block' : 'none';
    document.getElementById('pgf-fields').style.display = type === 'pgf' ? 'block' : 'none';
}

// Update populateFormFromProposal to use new logic
function populateFormFromProposal(proposalData) {
    // Set proposal type
    if (proposalData.proposal) {
        // Improved type detection
        if (Array.isArray(proposalData.data)) {
            setType('protocol');
        } else if (
            proposalData.data &&
            typeof proposalData.data === 'object' &&
            (proposalData.data.retro || proposalData.data.continuous)
        ) {
            setType('pgf');
        } else {
            setType('signalling');
        }
        const content = proposalData.proposal.content || {};
        document.getElementById('title').value = content.title || '';
        document.getElementById('authors').value = content.authors || '';
        document.getElementById('discussions-to').value = content['discussions-to'] || '';
        document.getElementById('created').value = content.created ? new Date(content.created).toISOString().slice(0, 16) : '';
        document.getElementById('abstract').value = content.abstract || '';
        document.getElementById('motivation').value = content.motivation || '';
        document.getElementById('details').value = content.details || '';
        if (content.requires && content.requires !== '0') {
            document.getElementById('requires-checkbox').checked = true;
            document.getElementById('requires').disabled = false;
            document.getElementById('requires').value = content.requires;
            document.querySelector('.requires-warning').style.display = 'block';
        } else {
            document.getElementById('requires-checkbox').checked = false;
            document.getElementById('requires').disabled = true;
            document.getElementById('requires').value = '0';
            document.querySelector('.requires-warning').style.display = 'none';
        }
        document.getElementById('author-address').value = proposalData.proposal.author || '';
        // Protocol
        if (proposalData.wasm) {
            document.getElementById('wasm-code').value = proposalData.wasm;
        }
        // Timing
        document.getElementById('current-epoch').value = proposalData.proposal.voting_start_epoch ? '' : '';
        document.getElementById('voting-start-hours').value = '';
        document.getElementById('voting-duration-days').value = '';
        document.getElementById('voting-duration-hours').value = '';
        document.getElementById('activation-delay-days').value = '';
        document.getElementById('activation-delay-hours').value = '';
        // PGF transfers
        if (
            proposalData.data &&
            typeof proposalData.data === 'object' &&
            proposalData.data.retro
        ) {
            transfers = proposalData.data.retro;
            updateTransfersPreview();
        } else {
            transfers = [];
            updateTransfersPreview();
        }
    }
}

// File input handler
const proposalFileInput = document.getElementById('proposal-file');
proposalFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const data = JSON.parse(evt.target.result);
            populateFormFromProposal(data);
            document.getElementById('load-warning').textContent = '';
        } catch (err) {
            document.getElementById('load-warning').textContent = 'Invalid JSON file.';
        }
    };
    reader.readAsText(file);
});

// URL input handler
const proposalUrlBtn = document.getElementById('load-url-btn');
proposalUrlBtn.addEventListener('click', async () => {
    const url = document.getElementById('proposal-url').value.trim();
    if (!url) return;
    try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('Network error');
        const data = await resp.json();
        populateFormFromProposal(data);
        document.getElementById('load-warning').textContent = '';
    } catch (err) {
        document.getElementById('load-warning').textContent = 'Could not load proposal from this URL. Some sites block direct access for security reasons. Please download the file to your computer and use the file upload option instead.';
    }
});

// Clear button handler
const clearBtn = document.getElementById('clear-btn');
clearBtn.addEventListener('click', () => {
    // Reset all form fields
    document.getElementById('proposal-type').value = 'signalling';
    document.getElementById('title').value = '';
    document.getElementById('authors').value = '';
    document.getElementById('discussions-to').value = '';
    document.getElementById('created').value = '';
    document.getElementById('abstract').value = '';
    document.getElementById('motivation').value = '';
    document.getElementById('details').value = '';
    document.getElementById('requires-checkbox').checked = false;
    document.getElementById('requires').disabled = true;
    document.getElementById('requires').value = '0';
    document.querySelector('.requires-warning').style.display = 'none';
    document.getElementById('author-address').value = '';
    document.getElementById('wasm-code').value = '';
    document.getElementById('current-epoch').value = '';
    document.getElementById('voting-start-hours').value = '';
    document.getElementById('voting-duration-days').value = '';
    document.getElementById('voting-duration-hours').value = '';
    document.getElementById('activation-delay-days').value = '';
    document.getElementById('activation-delay-hours').value = '';
    transfers = [];
    updateTransfersPreview();
    document.getElementById('json-output').value = '';
    document.getElementById('preview-section').style.display = 'none';
    document.getElementById('load-warning').textContent = '';
    // Hide conditional fields
    document.getElementById('protocol-fields').style.display = 'none';
    document.getElementById('pgf-fields').style.display = 'none';
});

// --- Voting Power and Proposal Type Logic ---
const votingPowerInfo = document.getElementById('voting-power-info');
const proposalTypeSelect = document.getElementById('proposal-type');
const titleInput = document.getElementById('title');
let lastAutoPrefix = '';

async function fetchVotingPower() {
    try {
        const resp = await fetch('https://indexer.namada.tududes.com/api/v1/pos/voting-power');
        const data = await resp.json();
        const total = Number(data.totalVotingPower);
        const million = 1_000_000;
        let info = '';
        if (proposalTypeSelect.value === 'pgf') {
            const needed = Math.round((total / 3) / million * 10) / 10;
            info = `PGF proposals require <b>33.3% of voting power</b> (~<b>${needed}M NAM</b>). 'Yay' votes must be greater than 'Nay' to pass.`;
        } else {
            const needed = Math.round((total * 0.4) / million * 10) / 10;
            info = `Signalling and Protocol proposals require <b>40% of voting power</b> (~<b>${needed}M NAM</b>). 2/3 of votes must be 'yay' to pass.`;
        }
        votingPowerInfo.innerHTML = info;
    } catch (e) {
        votingPowerInfo.textContent = 'Could not fetch voting power info.';
    }
}

function autoPrefixTitle() {
    const type = proposalTypeSelect.value;
    let prefix = '';
    if (type === 'pgf') prefix = 'PGF - ';
    else if (type === 'protocol') prefix = 'Protocol - ';
    else prefix = 'Signalling - ';
    // Only update if the title is empty or matches the last auto prefix
    if (!titleInput.value || titleInput.value === lastAutoPrefix) {
        titleInput.value = prefix;
    } else if (titleInput.value.startsWith(lastAutoPrefix)) {
        titleInput.value = prefix + titleInput.value.slice(lastAutoPrefix.length);
    }
    lastAutoPrefix = prefix;
}

// --- Auto-fill Current Epoch ---
async function fetchCurrentEpoch() {
    try {
        const resp = await fetch('https://indexer.namada.tududes.com/api/v1/chain/epoch/latest');
        const data = await resp.json();
        document.getElementById('current-epoch').value = data.epoch;
    } catch (e) {
        // fallback: leave blank
    }
}

// When timing form is shown, auto-fill current epoch if blank
const timingForm = document.getElementById('timing-form');
const observer = new MutationObserver(() => {
    if (timingForm.style.display !== 'none' && !document.getElementById('current-epoch').value) {
        fetchCurrentEpoch();
    }
});
observer.observe(timingForm, { attributes: true, attributeFilter: ['style'] });

// --- Default Timing Values ---
function getTimingInputValue(id, fallback) {
    const val = document.getElementById(id).value;
    return val === '' || val === undefined || val === null ? fallback : val;
}

// Patch createProposalJson to use defaults if blank
const originalCreateProposalJson = createProposalJson;
createProposalJson = function() {
    // Use default timing values if blank
    document.getElementById('voting-start-hours').value = getTimingInputValue('voting-start-hours', 0);
    document.getElementById('voting-duration-days').value = getTimingInputValue('voting-duration-days', 7);
    document.getElementById('voting-duration-hours').value = getTimingInputValue('voting-duration-hours', 0);
    document.getElementById('activation-delay-days').value = getTimingInputValue('activation-delay-days', 0);
    document.getElementById('activation-delay-hours').value = getTimingInputValue('activation-delay-hours', 6);
    return originalCreateProposalJson();
};

// --- Clear default URL on focus, restore if empty on blur ---
const urlInput = document.getElementById('proposal-url');
const defaultUrl = 'https://raw.githubusercontent.com/Luminara-Hub/govproposals/refs/heads/main/mainnet_pgf_builders.json';
urlInput.addEventListener('focus', function() {
    if (urlInput.value === defaultUrl) {
        urlInput.value = '';
    }
});
urlInput.addEventListener('blur', function() {
    if (urlInput.value.trim() === '') {
        urlInput.value = defaultUrl;
    }
});

// Download JSON button handler
const downloadBtn = document.getElementById('download-json-btn');
downloadBtn.addEventListener('click', () => {
    const json = document.getElementById('json-output').value;
    if (!json.trim()) return;
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'proposal.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 0);
}); 