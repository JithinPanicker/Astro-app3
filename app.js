// --- LICENSE SYSTEM ---
checkLicense();
function checkLicense() {
    const expiry = localStorage.getItem('pratnya_license_expiry');
    const lockScreen = document.getElementById('licenseScreen');
    if (!expiry || new Date() > new Date(expiry)) {
        lockScreen.style.display = 'flex'; document.body.style.overflow = 'hidden';
    } else {
        lockScreen.style.display = 'none'; document.body.style.overflow = 'auto';
    }
}
window.activateLicense = function() {
    const input = document.getElementById('licenseKeyInput').value.trim();
    try {
        const decoded = atob(input);
        const parts = decoded.split('|');
        if (parts[0] !== "PRATNYA-SECRET") throw new Error("Invalid Key");
        localStorage.setItem('pratnya_license_expiry', parts[1]);
        location.reload();
    } catch (e) { document.getElementById('licenseError').style.display = 'block'; }
};

// --- X / TWITTER STYLE TOASTS ---
const topToast = Swal.mixin({
    toast: true,
    position: 'top',
    showConfirmButton: false,
    timer: 2500,
    background: '#1DA1F2',
    color: '#fff',
    customClass: { popup: 'x-toast' }
});

const warnToast = Swal.mixin({
    toast: true,
    position: 'top',
    showConfirmButton: true,
    showCancelButton: true,
    confirmButtonColor: '#E0245E',
    cancelButtonColor: '#657786',
    confirmButtonText: 'Confirm',
    background: '#15202B',
    color: '#fff',
    customClass: { popup: 'x-toast-confirm' }
});

// --- TEXTAREA UNDO / CLEAR & COUNTERS ---
window.textHistory = {};
window.clearText = (id) => {
    const el = document.getElementById(id);
    if(el) { window.textHistory[id] = el.value; el.value = ''; el.focus(); }
};
window.undoText = (id) => {
    const el = document.getElementById(id);
    if(el) {
        if(window.textHistory[id] !== undefined) {
            el.value = window.textHistory[id]; delete window.textHistory[id];
        } else { document.execCommand('undo'); }
        el.focus();
    }
};
window.adjCount = (id, delta) => {
    const el = document.getElementById(id);
    let val = parseInt(el.value) || 0;
    val += delta;
    if(val < 0) val = 0;
    el.value = val;
};

// --- DATABASE & CORE ---
const db = new Dexie('AstroAppDB');
db.version(4).stores({ clients: '++id, name, star, phone, location, age, dob, birthTime, profession' });

const modal = document.getElementById('clientFormModal');
const prescModal = document.getElementById('prescriptionModal');
const form = document.getElementById('clientForm');
const prescForm = document.getElementById('prescriptionForm');
const searchInput = document.getElementById('searchInput');

updateList();

// --- MODAL FUNCTIONS ---
function showForm() { modal.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
function closeForm() { 
    modal.classList.add('hidden'); document.body.style.overflow = 'auto'; 
    form.reset(); 
    document.getElementById('clientId').value = ""; 
    document.getElementById('historyList').innerHTML = ""; 
    document.getElementById('clientPrescList').innerHTML = ""; 
    document.getElementById('slrCount').value = "0";
    document.getElementById('dhrCount').value = "0";
}

function showPrescriptionForm() { prescModal.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
function closePrescriptionForm() { 
    prescModal.classList.add('hidden'); document.body.style.overflow = 'auto'; 
    prescForm.reset(); 
    document.getElementById('prescClientId').value = "";
    document.getElementById('prescHistoryList').innerHTML = "";
    document.getElementById('prescSlrCount').value = "0";
    document.getElementById('prescDhrCount').value = "0";
}

// --- SAVE MAIN CLIENT ---
form.onsubmit = async (event) => {
    event.preventDefault();
    const id = document.getElementById('clientId').value;
    
    const basicData = {
        name: document.getElementById('name').value,
        star: document.getElementById('star').value,
        dob: document.getElementById('dob').value,
        age: document.getElementById('age').value,
        birthTime: document.getElementById('birthTime').value,
        location: document.getElementById('place').value,
        phone: document.getElementById('phone').value,
        profession: document.getElementById('profession').value,
        updated: new Date()
    };
    
    const problem = document.getElementById('currentProblem').value.trim();
    const solution = document.getElementById('currentSolution').value.trim();
    const slr = parseInt(document.getElementById('slrCount').value) || 0;
    const dhr = parseInt(document.getElementById('dhrCount').value) || 0;
    
    let consultationEntry = null;
    if (problem || solution || slr > 0 || dhr > 0) {
        consultationEntry = {
            date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
            timestamp: Date.now(),
            problem: problem,
            solution: solution,
            slr: slr,
            dhr: dhr
        };
    }

    if (id) {
        const client = await db.clients.get(parseInt(id));
        let history = client.consultations || [];
        if (consultationEntry) history.unshift(consultationEntry);
        await db.clients.update(parseInt(id), { ...basicData, consultations: history });
    } else {
        const history = consultationEntry ? [consultationEntry] : [];
        await db.clients.add({ ...basicData, consultations: history, prescriptions: [] });
    }
    closeForm();
    await updateList();
    topToast.fire({ text: 'Client saved successfully' });
};

// --- SAVE PRESCRIPTION ---
window.savePrescription = async () => {
    const id = document.getElementById('prescClientId').value;
    const name = document.getElementById('prescName').value.trim();
    if(!name) { topToast.fire({ text: 'Name is required', background: '#E0245E' }); return; }

    const prescData = {
        name: name,
        phone: document.getElementById('prescPhone').value,
        star: document.getElementById('prescStar').value,
        location: document.getElementById('prescPlace').value,
        updated: new Date()
    };
    
    const rasi = document.getElementById('prescRasi').value.trim();
    const udhaya = document.getElementById('prescUdhaya').value.trim();
    const notes = document.getElementById('prescBody').value.trim();
    const slr = parseInt(document.getElementById('prescSlrCount').value) || 0;
    const dhr = parseInt(document.getElementById('prescDhrCount').value) || 0;

    let newPresc = null;
    if(rasi || udhaya || notes || slr > 0 || dhr > 0) {
        newPresc = {
            date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
            timestamp: Date.now(),
            rasi: rasi,
            udhaya: udhaya,
            notes: notes,
            slr: slr,
            dhr: dhr
        };
    }

    if (id) {
        const client = await db.clients.get(parseInt(id));
        let pHistory = client.prescriptions || [];
        if(newPresc) pHistory.unshift(newPresc);
        await db.clients.update(parseInt(id), { ...prescData, prescriptions: pHistory });
    } else {
        const pHistory = newPresc ? [newPresc] : [];
        await db.clients.add({ ...prescData, consultations: [], prescriptions: pHistory });
    }
    
    closePrescriptionForm();
    await updateList();
    topToast.fire({ text: 'Prescription saved successfully' });
};

// --- LOAD CLIENT DETAILS ---
window.loadClient = async (id) => {
    const client = await db.clients.get(id);
    if(!client) return;
    document.getElementById('clientId').value = client.id;
    document.getElementById('name').value = client.name || "";
    document.getElementById('star').value = client.star || "";
    document.getElementById('dob').value = client.dob || "";
    document.getElementById('age').value = client.age || "";
    document.getElementById('birthTime').value = client.birthTime || "";
    document.getElementById('place').value = client.location || "";
    document.getElementById('phone').value = client.phone || "";
    document.getElementById('profession').value = client.profession || "";

    const listDiv = document.getElementById('historyList');
    listDiv.innerHTML = "";
    if (client.consultations && client.consultations.length > 0) {
        client.consultations.forEach(item => {
            let counters = '';
            if(item.slr > 0) counters += `<span style="margin-right: 15px;"><strong>SLR:</strong> ${item.slr}</span>`;
            if(item.dhr > 0) counters += `<span><strong>DHR:</strong> ${item.dhr}</span>`;
            
            listDiv.innerHTML += `
                <div class="history-item" id="hist-${item.timestamp}">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 8px;">
                        <span style="font-size: 12px; color: #555; font-weight: bold;">${item.date}</span>
                        <div class="history-actions">
                            <button type="button" onclick="editHist(${client.id}, ${item.timestamp})" style="background: #FFC107; padding: 4px 10px; font-size: 12px; border-radius: 4px;">Edit</button>
                            <button type="button" onclick="deleteHist(${client.id}, ${item.timestamp})" style="background: #F44336; color: white; padding: 4px 10px; font-size: 12px; border-radius: 4px; margin-left: 5px;">Delete</button>
                        </div>
                    </div>
                    <div style="margin-bottom: 8px;">
                        <span class="history-label" style="font-weight: 600;">Problem:</span>
                        <div class="history-text" id="prob-text-${item.timestamp}" style="white-space: pre-wrap; margin-top: 4px;">${item.problem || '-'}</div>
                    </div>
                    <div>
                        <span class="history-label" style="color:#1976D2; font-weight: 600;">Solution:</span>
                        <div class="history-text" id="sol-text-${item.timestamp}" style="white-space: pre-wrap; margin-top: 4px;">${item.solution || '-'}</div>
                    </div>
                    ${counters ? `<div id="count-text-${item.timestamp}" style="margin-top: 8px; color: #E65100; font-size: 12px;">${counters}</div>` : `<div id="count-text-${item.timestamp}"></div>`}
                </div>`;
        });
    } else { listDiv.innerHTML = "<p style='color:#888; text-align:center; font-size: 13px;'>No previous consultations.</p>"; }

    const prescDiv = document.getElementById('clientPrescList');
    prescDiv.innerHTML = "";
    if (client.prescriptions && client.prescriptions.length > 0) {
        client.prescriptions.forEach(item => {
            let counters = '';
            if(item.slr > 0) counters += `<span style="margin-right: 15px;"><strong>SLR:</strong> ${item.slr}</span>`;
            if(item.dhr > 0) counters += `<span><strong>DHR:</strong> ${item.dhr}</span>`;
            
            prescDiv.innerHTML += `
                <div class="history-item" style="border-left-color: #FF9800;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 8px;">
                        <span style="font-size: 12px; color: #E65100; font-weight: bold;">${item.date}</span>
                    </div>
                    <div style="font-size: 13px; margin-bottom: 4px;"><strong>Rasi:</strong> ${item.rasi || '-'} | <strong>Udhaya:</strong> ${item.udhaya || '-'}</div>
                    <div style="white-space: pre-wrap; font-size: 14px; margin-top: 8px;">${item.notes || '-'}</div>
                    ${counters ? `<div style="margin-top: 8px; color: #E65100; font-size: 12px;">${counters}</div>` : ''}
                </div>`;
        });
    } else { prescDiv.innerHTML = "<p style='color:#888; text-align:center; font-size: 13px;'>No previous prescriptions.</p>"; }

    showForm();
};

// --- LOAD PRESCRIPTION DETAILS ---
window.loadPrescription = async (id) => {
    const client = await db.clients.get(id);
    if(!client) return;
    
    document.getElementById('prescClientId').value = client.id;
    document.getElementById('prescName').value = client.name || "";
    document.getElementById('prescPhone').value = client.phone || "";
    document.getElementById('prescStar').value = client.star || "";
    document.getElementById('prescPlace').value = client.location || "";
    
    document.getElementById('prescRasi').value = "";
    document.getElementById('prescUdhaya').value = "";
    document.getElementById('prescBody').value = "";

    const listDiv = document.getElementById('prescHistoryList');
    listDiv.innerHTML = "";
    if (client.prescriptions && client.prescriptions.length > 0) {
        client.prescriptions.forEach(item => {
            let counters = '';
            if(item.slr > 0) counters += `<span style="margin-right: 15px;"><strong>SLR:</strong> ${item.slr}</span>`;
            if(item.dhr > 0) counters += `<span><strong>DHR:</strong> ${item.dhr}</span>`;

            listDiv.innerHTML += `
                <div class="history-item" id="p-hist-${item.timestamp}" style="border-left-color: #FF9800;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 8px;">
                        <span style="font-size: 12px; color: #E65100; font-weight: bold;">${item.date}</span>
                        <div class="history-actions">
                            <button type="button" onclick="editPrescHist(${client.id}, ${item.timestamp})" style="background: #FFC107; padding: 4px 10px; font-size: 12px; border-radius: 4px;">Edit</button>
                            <button type="button" onclick="deletePrescHist(${client.id}, ${item.timestamp})" style="background: #F44336; color: white; padding: 4px 10px; font-size: 12px; border-radius: 4px; margin-left: 5px;">Delete</button>
                        </div>
                    </div>
                    <div style="font-size: 13px; margin-bottom: 4px;">
                        <strong>Rasi:</strong> <span id="p-rasi-${item.timestamp}">${item.rasi || ''}</span> | 
                        <strong>Udhaya:</strong> <span id="p-udhaya-${item.timestamp}">${item.udhaya || ''}</span>
                    </div>
                    <div id="p-notes-${item.timestamp}" style="white-space: pre-wrap; font-size: 14px; margin-top: 8px;">${item.notes || ''}</div>
                    ${counters ? `<div id="p-count-${item.timestamp}" style="margin-top: 8px; color: #E65100; font-size: 12px;">${counters}</div>` : `<div id="p-count-${item.timestamp}"></div>`}
                </div>`;
        });
    } else { listDiv.innerHTML = "<p style='color:#888; text-align:center; font-size: 13px;'>No previous history.</p>"; }
    
    showPrescriptionForm();
};

// --- HISTORY EDIT & DELETE LOGIC ---
window.editHist = async (clientId, timestamp) => {
    const client = await db.clients.get(clientId);
    const hist = client.consultations.find(c => c.timestamp === timestamp);
    if(!hist) return;

    const probEl = document.getElementById(`prob-text-${timestamp}`);
    const solEl = document.getElementById(`sol-text-${timestamp}`);
    const countEl = document.getElementById(`count-text-${timestamp}`);

    probEl.innerHTML = `
        <textarea id="edit-prob-${timestamp}" rows="3" style="width: 100%; margin-top: 5px; padding: 8px; border-radius: 4px; border: 1px solid #ccc; font-family: inherit;">${hist.problem || ''}</textarea>`;
    solEl.innerHTML = `
        <textarea id="edit-sol-${timestamp}" rows="4" style="width: 100%; margin-top: 5px; padding: 8px; border-radius: 4px; border: 1px solid #ccc; font-family: inherit;">${hist.solution || ''}</textarea>`;
    
    countEl.innerHTML = `
        <div style="display: flex; gap: 15px; margin-top: 10px;">
            <label style="font-weight:bold; color:#E65100; font-size:12px;">SLR: <input type="number" id="edit-slr-${timestamp}" value="${hist.slr || 0}" style="width: 50px; padding:2px; font-size:12px;"></label>
            <label style="font-weight:bold; color:#E65100; font-size:12px;">DHR: <input type="number" id="edit-dhr-${timestamp}" value="${hist.dhr || 0}" style="width: 50px; padding:2px; font-size:12px;"></label>
        </div>`;
    
    const actionsDiv = document.querySelector(`#hist-${timestamp} .history-actions`);
    actionsDiv.innerHTML = `
        <button type="button" onclick="saveHist(${clientId}, ${timestamp})" style="background: #4CAF50; color: white; padding: 4px 10px; font-size: 12px; border-radius: 4px;">Save</button>
        <button type="button" onclick="loadClient(${clientId})" style="background: #9e9e9e; color: white; padding: 4px 10px; font-size: 12px; border-radius: 4px; margin-left: 5px;">Cancel</button>
    `;
};

window.saveHist = async (clientId, timestamp) => {
    const client = await db.clients.get(clientId);
    const histIndex = client.consultations.findIndex(c => c.timestamp === timestamp);
    if(histIndex !== -1) {
        client.consultations[histIndex].problem = document.getElementById(`edit-prob-${timestamp}`).value;
        client.consultations[histIndex].solution = document.getElementById(`edit-sol-${timestamp}`).value;
        client.consultations[histIndex].slr = parseInt(document.getElementById(`edit-slr-${timestamp}`).value) || 0;
        client.consultations[histIndex].dhr = parseInt(document.getElementById(`edit-dhr-${timestamp}`).value) || 0;
        await db.clients.put(client);
        loadClient(clientId);
        topToast.fire({ text: 'Consultation updated' });
    }
};

window.editPrescHist = async (clientId, timestamp) => {
    const client = await db.clients.get(clientId);
    const hist = client.prescriptions.find(c => c.timestamp === timestamp);
    if(!hist) return;

    const rasiEl = document.getElementById(`p-rasi-${timestamp}`);
    const udhayaEl = document.getElementById(`p-udhaya-${timestamp}`);
    const notesEl = document.getElementById(`p-notes-${timestamp}`);
    const countEl = document.getElementById(`p-count-${timestamp}`);

    rasiEl.innerHTML = `<input type="text" id="edit-p-rasi-${timestamp}" value="${hist.rasi || ''}" style="width: 70px; padding: 2px; font-size: 12px;">`;
    udhayaEl.innerHTML = `<input type="text" id="edit-p-udhaya-${timestamp}" value="${hist.udhaya || ''}" style="width: 70px; padding: 2px; font-size: 12px;">`;
    notesEl.innerHTML = `
        <textarea id="edit-p-notes-${timestamp}" rows="4" style="width: 100%; margin-top: 5px; padding: 8px; border-radius: 4px; border: 1px solid #ccc; font-family: inherit;">${hist.notes || ''}</textarea>
    `;
    countEl.innerHTML = `
        <div style="display: flex; gap: 15px; margin-top: 10px;">
            <label style="font-weight:bold; color:#E65100; font-size:12px;">SLR: <input type="number" id="edit-p-slr-${timestamp}" value="${hist.slr || 0}" style="width: 50px; padding:2px; font-size:12px;"></label>
            <label style="font-weight:bold; color:#E65100; font-size:12px;">DHR: <input type="number" id="edit-p-dhr-${timestamp}" value="${hist.dhr || 0}" style="width: 50px; padding:2px; font-size:12px;"></label>
        </div>`;

    const actionsDiv = document.querySelector(`#p-hist-${timestamp} .history-actions`);
    actionsDiv.innerHTML = `
        <button type="button" onclick="savePrescHist(${clientId}, ${timestamp})" style="background: #4CAF50; color: white; padding: 4px 10px; font-size: 12px; border-radius: 4px;">Save</button>
        <button type="button" onclick="loadPrescription(${clientId})" style="background: #9e9e9e; color: white; padding: 4px 10px; font-size: 12px; border-radius: 4px; margin-left: 5px;">Cancel</button>
    `;
};

window.savePrescHist = async (clientId, timestamp) => {
    const client = await db.clients.get(clientId);
    const histIndex = client.prescriptions.findIndex(c => c.timestamp === timestamp);
    if(histIndex !== -1) {
        client.prescriptions[histIndex].rasi = document.getElementById(`edit-p-rasi-${timestamp}`).value;
        client.prescriptions[histIndex].udhaya = document.getElementById(`edit-p-udhaya-${timestamp}`).value;
        client.prescriptions[histIndex].notes = document.getElementById(`edit-p-notes-${timestamp}`).value;
        client.prescriptions[histIndex].slr = parseInt(document.getElementById(`edit-p-slr-${timestamp}`).value) || 0;
        client.prescriptions[histIndex].dhr = parseInt(document.getElementById(`edit-p-dhr-${timestamp}`).value) || 0;
        await db.clients.put(client);
        loadPrescription(clientId);
        topToast.fire({ text: 'Prescription updated' });
    }
};

window.deleteHist = async (clientId, timestamp) => {
    warnToast.fire({ text: 'Delete this consultation?' }).then(async (result) => {
        if (result.isConfirmed) {
            const client = await db.clients.get(clientId);
            client.consultations = client.consultations.filter(c => c.timestamp !== timestamp);
            await db.clients.put(client);
            loadClient(clientId);
            topToast.fire({ text: 'Deleted' });
        }
    });
};

window.deletePrescHist = async (clientId, timestamp) => {
    warnToast.fire({ text: 'Delete this prescription?' }).then(async (result) => {
        if (result.isConfirmed) {
            const client = await db.clients.get(clientId);
            client.prescriptions = client.prescriptions.filter(c => c.timestamp !== timestamp);
            await db.clients.put(client);
            loadPrescription(clientId);
            topToast.fire({ text: 'Deleted' });
        }
    });
};

async function updateList() {
    const query = searchInput.value.toLowerCase();
    let clients = await db.clients.toArray();
    if (query) clients = clients.filter(c => c.name.toLowerCase().includes(query));
    clients.reverse();
    
    let html = "";
    clients.forEach(client => {
        const hasConsults = client.consultations && client.consultations.length > 0;
        const hasPresc = client.prescriptions && client.prescriptions.length > 0;
        const noHistory = !hasConsults && !hasPresc;

        let waBtn = '';
        if (client.phone) {
            let waPhone = client.phone.replace(/\D/g, '');
            if(waPhone.length === 10) waPhone = '91' + waPhone;
            waBtn = `<a href="https://wa.me/${waPhone}" target="_blank" class="btn-wa" onclick="event.stopPropagation();" title="Contact on WhatsApp"><i class="fab fa-whatsapp"></i></a>`;
        }

        if (hasConsults || noHistory || client.dob) {
            html += `
            <div class="client-item" onclick="loadClient(${client.id})">
                <div class="client-info">
                    <h4>${client.name} <span style="background: #e3f2fd; color: #1976D2; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-left: 5px; vertical-align: middle;">Client</span></h4>
                    <p>${client.star || ''} ${client.location ? '• ' + client.location : ''}</p>
                </div>
                <div class="actions">${waBtn}<button class="btn-view">View</button></div>
            </div>`;
        }
        if (hasPresc) {
            html += `
            <div class="client-item" style="border-left: 4px solid #FF9800;" onclick="loadPrescription(${client.id})">
                <div class="client-info">
                    <h4>${client.name} <span style="background: #FFF3E0; color: #E65100; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-left: 5px; vertical-align: middle;">Prescription</span></h4>
                    <p>${client.star || ''} ${client.location ? '• ' + client.location : ''}</p>
                </div>
                <div class="actions">${waBtn}<button class="btn-view" style="background: #FFF3E0; color: #E65100;">View</button></div>
            </div>`;
        }
    });
    document.getElementById('clientList').innerHTML = html;
}

// --- DYNAMIC PDF PRINT HELPERS ---
async function getEntriesToPrint(clientId, isPresc) {
    let entries = [];
    const exportOpt = isPresc ? document.querySelector('input[name="prescExport"]:checked').value : document.querySelector('input[name="mainExport"]:checked').value;

    if (!isPresc) {
        const prob = document.getElementById('currentProblem').value.trim();
        const sol = document.getElementById('currentSolution').value.trim();
        const slr = parseInt(document.getElementById('slrCount').value) || 0;
        const dhr = parseInt(document.getElementById('dhrCount').value) || 0;
        if (prob || sol || slr > 0 || dhr > 0) entries.push({ date: new Date().toLocaleDateString('en-IN'), problem: prob, solution: sol, slr, dhr });
    } else {
        const rasi = document.getElementById('prescRasi').value.trim();
        const udhaya = document.getElementById('prescUdhaya').value.trim();
        const notes = document.getElementById('prescBody').value.trim();
        const slr = parseInt(document.getElementById('prescSlrCount').value) || 0;
        const dhr = parseInt(document.getElementById('prescDhrCount').value) || 0;
        if (rasi || udhaya || notes || slr > 0 || dhr > 0) entries.push({ date: new Date().toLocaleDateString('en-IN'), rasi, udhaya, notes, slr, dhr });
    }

    if (clientId) {
        const client = await db.clients.get(parseInt(clientId));
        if (client) {
            const history = isPresc ? client.prescriptions : client.consultations;
            if (history && history.length > 0) {
                if (exportOpt === 'all') { entries = entries.concat(history); } 
                else if (entries.length === 0) { entries.push(history[0]); }
            }
        }
    }
    return entries;
}


// --- NATIVE PDF GENERATOR ENGINE (PERFECT PAGE BREAKS + FIXED HEADERS/FOOTERS) ---
async function executeNativePDF(htmlContent, fileName, action) {
    
    // Create a strict 800px wrapper in the background so text NEVER shrinks or disappears
    const wrapper = document.createElement('div');
    wrapper.innerHTML = htmlContent;
    wrapper.style.position = 'absolute';
    wrapper.style.left = '-9999px'; 
    wrapper.style.top = '0';
    wrapper.style.width = '800px'; 
    wrapper.style.backgroundColor = 'white';
    wrapper.style.color = 'black';
    wrapper.style.padding = '0 55px'; // Mimics the 15mm left/right margin perfectly
    document.body.appendChild(wrapper);

    // CRITICAL: Give the browser 500ms to calculate Malayalam fonts and layout
    await new Promise(resolve => setTimeout(resolve, 500));

    const opt = {
        margin:       [46, 0, 30, 0], // Top, Left, Bottom, Right spaces specifically left for Header & Footer
        filename:     fileName,
        image:        { type: 'jpeg', quality: 1.0 },
        html2canvas:  { scale: 2, useCORS: true, letterRendering: true, windowWidth: 800 },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['css', 'legacy'] }
    };

    try {
        const pdfWorker = html2pdf().set(opt).from(wrapper).toPdf();

        await pdfWorker.get('pdf').then((pdf) => {
            const totalPages = pdf.internal.getNumberOfPages();
            
            // Loop through every page generated to stamp the Header and Footer securely
            for (let i = 1; i <= totalPages; i++) {
                pdf.setPage(i);
                
                // --- HEADER OVERLAY ---
                pdf.setTextColor(49, 140, 75); // Professional Match for Green Color

                // Left Header
                pdf.setFont("helvetica", "italic");
                pdf.setFontSize(10);
                pdf.text("Astrologer", 15, 18);

                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(18);
                pdf.text("C.K. Saji Panicker", 15, 25);

                pdf.setFont("helvetica", "italic");
                pdf.setFontSize(9);
                pdf.text("Chathangottupuram, Kalarikkal", 15, 30);
                pdf.text("Wandoor-Malappuram", 15, 34);
                pdf.text("Kerala : 679 328", 15, 38);

                // Right Header
                pdf.setFont("helvetica", "italic");
                pdf.setFontSize(10);
                pdf.text("Consultation", 195, 18, { align: "right" });

                pdf.setFont("helvetica", "normal");
                pdf.setFontSize(9);
                pdf.text("Online: ", 165, 25);
                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(10);
                pdf.text("9207 773 880", 195, 25, { align: "right" });

                pdf.setFont("helvetica", "normal");
                pdf.setFontSize(9);
                pdf.text("Office: ", 166.5, 29);
                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(10);
                pdf.text("7034 600 880", 195, 29, { align: "right" });

                // Header Bottom Line
                pdf.setDrawColor(49, 140, 75);
                pdf.setLineWidth(0.4);
                pdf.line(15, 42, 195, 42);

                // --- FOOTER OVERLAY ---
                // Footer Top Line
                pdf.setDrawColor(49, 140, 75);
                pdf.setLineWidth(0.4);
                pdf.line(15, 275, 195, 275);

                // Footer Text
                pdf.setTextColor(49, 140, 75);
                pdf.setFont("times", "italic");
                pdf.setFontSize(16);
                pdf.text("Fix your appointment through the call", 105, 283, { align: "center" });

                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(10);
                pdf.text("www.pratnya.in", 105, 288, { align: "center" });
            }
        });

        if (action === 'save') {
            await pdfWorker.save();
            topToast.fire({ text: 'Downloaded successfully!' });
        } else if (action === 'share') {
            const pdfBlob = await pdfWorker.output('blob');
            const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: 'Consultation Report', text: 'Here is your document from Pratnya Astro.' });
                topToast.fire({ text: 'Opened share menu!' });
            } else {
                Swal.fire({ title: 'Unsupported Browser', text: 'Please download the PDF manually.', icon: 'info' });
            }
        }
    } catch(e) {
        console.error("PDF Generation Error: ", e);
        topToast.fire({ text: 'Failed to generate PDF', background: '#E0245E' });
    } finally {
        // Always clean up DOM
        document.body.removeChild(wrapper);
    }
}


// --- MAIN PDF DATA COMPILER ---
async function prepareMainPDF() {
    const name = document.getElementById('name').value || "Client";
    const star = document.getElementById('star').value;
    const place = document.getElementById('place').value;

    const id = document.getElementById('clientId').value;
    const entries = await getEntriesToPrint(id, false);
    
    if(entries.length === 0) {
        topToast.fire({ text: 'No data to print!', background: '#E0245E' }); return null;
    }

    let htmlContent = `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 13px; color: black; line-height: 1.5; padding-top: 5px;">
            <div style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 8px;">
                <span>Name: ${name}</span>
                <span>Star: ${star || ''}</span>
            </div>
            ${place ? `<div style="font-weight: bold; margin-bottom: 12px;">Place: ${place}</div>` : `<div style="margin-bottom: 12px;"></div>`}
            <div style="border-bottom: 1px solid #318c4b; margin-bottom: 25px;"></div>
    `;

    entries.forEach((e, index) => {
        let safeProblem = (e.problem || '').split('\n').join('<br>');
        let safeSolution = (e.solution || '').split('\n').join('<br>');
        let divider = (index < entries.length - 1) ? `<div style="border-bottom: 1px dashed #ccc; margin-top: 20px; margin-bottom: 25px;"></div>` : ``;

        htmlContent += `
            <div style="page-break-inside: avoid; margin-bottom: 15px;">
                <div style="color: #d25c1a; font-weight: bold; margin-bottom: 8px; font-size: 13px;">Date: ${e.date}</div>
                ${e.problem ? `<div style="margin-bottom: 8px;"><strong style="color: #666;">Problem:</strong><br><div style="margin-top: 3px; color: #222; text-align: justify;">${safeProblem}</div></div>` : ''}
                ${e.solution ? `<div style="margin-bottom: 8px;"><strong style="color: #666;">Solution:</strong><br><div style="margin-top: 3px; color: #222; text-align: justify;">${safeSolution}</div></div>` : ''}
                
                ${(e.slr > 0 || e.dhr > 0) ? `<div style="color: #d25c1a; font-weight: bold; font-size: 12px; margin-top: 10px;">
                    ${e.slr > 0 ? `SLR: ${e.slr}` : ''} ${e.slr > 0 && e.dhr > 0 ? '&nbsp;&nbsp;&nbsp;&nbsp;' : ''} ${e.dhr > 0 ? `DHR: ${e.dhr}` : ''}
                </div>` : ''}
                ${divider}
            </div>
        `;
    });
    
    htmlContent += `</div>`;
    return { html: htmlContent, fileName: `${name}_Consultation.pdf` };
}

window.generatePDF = async () => {
    const data = await prepareMainPDF();
    if(!data) return;
    topToast.fire({ text: 'Generating PDF...' });
    await executeNativePDF(data.html, data.fileName, 'save');
};

window.shareMainPDF = async () => {
    const data = await prepareMainPDF();
    if(!data) return;
    topToast.fire({ text: 'Preparing file for sharing...' });
    await executeNativePDF(data.html, data.fileName, 'share');
};


// --- PRESCRIPTION PDF DATA COMPILER ---
async function preparePrescriptionPDF() {
    const name = document.getElementById('prescName').value || "Client";
    const star = document.getElementById('prescStar').value || "";
    const place = document.getElementById('prescPlace').value || "";
    
    const id = document.getElementById('prescClientId').value;
    const entries = await getEntriesToPrint(id, true);

    if(entries.length === 0) {
        topToast.fire({ text: 'No data to print!', background: '#E0245E' }); return null;
    }

    let htmlContent = `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 13px; color: black; line-height: 1.5; padding-top: 5px;">
            <div style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 8px;">
                <span>Name: ${name}</span>
                <span>Star: ${star || ''}</span>
            </div>
            ${place ? `<div style="font-weight: bold; margin-bottom: 12px;">Place: ${place}</div>` : `<div style="margin-bottom: 12px;"></div>`}
            <div style="border-bottom: 1px solid #318c4b; margin-bottom: 25px;"></div>
    `;

    entries.forEach((e, index) => {
        let safeNotes = (e.notes || '').split('\n').join('<br>');
        let divider = (index < entries.length - 1) ? `<div style="border-bottom: 1px dashed #ccc; margin-top: 20px; margin-bottom: 25px;"></div>` : ``;

        let rasiUdhaya = '';
        if(e.rasi || e.udhaya) {
            rasiUdhaya = `<div style="color: #666; font-weight: bold; font-size: 12px; margin-bottom: 8px;">`;
            if(e.rasi) rasiUdhaya += `Rasi: ${e.rasi}`;
            if(e.rasi && e.udhaya) rasiUdhaya += ` | `;
            if(e.udhaya) rasiUdhaya += `Udhaya: ${e.udhaya}`;
            rasiUdhaya += `</div>`;
        }

        htmlContent += `
            <div style="page-break-inside: avoid; margin-bottom: 15px;">
                <div style="color: #d25c1a; font-weight: bold; margin-bottom: 6px; font-size: 13px;">Date: ${e.date}</div>
                ${rasiUdhaya}
                <div style="margin-bottom: 8px; color: #222; text-align: justify;">${safeNotes}</div>
                
                ${(e.slr > 0 || e.dhr > 0) ? `<div style="color: #d25c1a; font-weight: bold; font-size: 12px; margin-top: 10px;">
                    ${e.slr > 0 ? `SLR: ${e.slr}` : ''} ${e.slr > 0 && e.dhr > 0 ? '&nbsp;&nbsp;&nbsp;&nbsp;' : ''} ${e.dhr > 0 ? `DHR: ${e.dhr}` : ''}
                </div>` : ''}
                ${divider}
            </div>
        `;
    });

    htmlContent += `</div>`;
    return { html: htmlContent, fileName: `${name}_Prescription.pdf` };
}

window.generatePrescriptionPDF = async () => {
    const data = await preparePrescriptionPDF();
    if(!data) return;
    topToast.fire({ text: 'Generating PDF...' });
    await executeNativePDF(data.html, data.fileName, 'save');
};

window.sharePrescriptionPDF = async () => {
    const data = await preparePrescriptionPDF();
    if(!data) return;
    topToast.fire({ text: 'Preparing file for sharing...' });
    await executeNativePDF(data.html, data.fileName, 'share');
};

function calculateAge() {
    const dobInput = document.getElementById('dob').value;
    if (!dobInput) return;
    const dob = new Date(dobInput);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) age--;
    document.getElementById('age').value = age;
}

async function deleteCurrentClient() {
    const id = document.getElementById('clientId').value;
    if (!id) return;
    warnToast.fire({ text: 'Delete entire client? (Consults & Prescriptions)' }).then(async (result) => {
        if (result.isConfirmed) { await db.clients.delete(parseInt(id)); closeForm(); await updateList(); topToast.fire({ text: 'Deleted' }); }
    });
}
async function deleteCurrentPrescClient() {
    const id = document.getElementById('prescClientId').value;
    if (!id) return;
    warnToast.fire({ text: 'Delete entire client? (Consults & Prescriptions)' }).then(async (result) => {
        if (result.isConfirmed) { await db.clients.delete(parseInt(id)); closePrescriptionForm(); await updateList(); topToast.fire({ text: 'Deleted' }); }
    });
}

function transferToPrescription() {
    const id = document.getElementById('clientId').value; 
    const name = document.getElementById('name').value;
    const phone = document.getElementById('phone').value;
    const star = document.getElementById('star').value;
    const place = document.getElementById('place').value;
    const solution = document.getElementById('currentSolution').value;

    if (!name) { topToast.fire({ text: 'Please enter a Name first', background: '#E0245E' }); return; }

    showPrescriptionForm();
    document.getElementById('prescClientId').value = id;
    document.getElementById('prescName').value = name;
    document.getElementById('prescPhone').value = phone;
    document.getElementById('prescStar').value = star;
    document.getElementById('prescPlace').value = place;
    document.getElementById('prescBody').value = solution;
}

searchInput.oninput = () => updateList();