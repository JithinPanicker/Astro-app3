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

// --- TEXTAREA UNDO / CLEAR LOGIC ---
window.textHistory = {};
window.clearText = (id) => {
    const el = document.getElementById(id);
    if(el) {
        window.textHistory[id] = el.value;
        el.value = '';
        el.focus();
    }
};
window.undoText = (id) => {
    const el = document.getElementById(id);
    if(el) {
        if(window.textHistory[id] !== undefined) {
            el.value = window.textHistory[id];
            delete window.textHistory[id];
        } else {
            document.execCommand('undo'); 
        }
        el.focus();
    }
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

// --- GLOBAL TEMPLATE SELECTOR HELPER ---
function getSelectedTemplate() {
    return document.getElementById('globalTemplateSelect').value; // 'ck' or 'pratnya'
}

// --- MODAL FUNCTIONS ---
function showForm() { modal.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
function closeForm() { 
    modal.classList.add('hidden'); document.body.style.overflow = 'auto'; 
    form.reset(); document.getElementById('clientId').value = ""; 
    document.getElementById('historyList').innerHTML = ""; 
    document.getElementById('clientPrescList').innerHTML = ""; 
}

function showPrescriptionForm() { prescModal.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
function closePrescriptionForm() { 
    prescModal.classList.add('hidden'); document.body.style.overflow = 'auto'; 
    prescForm.reset(); document.getElementById('prescClientId').value = "";
    document.getElementById('prescHistoryList').innerHTML = "";
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
    
    let consultationEntry = null;
    if (problem || solution) {
        consultationEntry = {
            date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
            timestamp: Date.now(),
            problem: problem,
            solution: solution
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

    let newPresc = null;
    if(rasi || udhaya || notes) {
        newPresc = {
            date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
            timestamp: Date.now(),
            rasi: rasi,
            udhaya: udhaya,
            notes: notes
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
                </div>`;
        });
    } else { listDiv.innerHTML = "<p style='color:#888; text-align:center; font-size: 13px;'>No previous consultations.</p>"; }

    const prescDiv = document.getElementById('clientPrescList');
    prescDiv.innerHTML = "";
    if (client.prescriptions && client.prescriptions.length > 0) {
        client.prescriptions.forEach(item => {
            prescDiv.innerHTML += `
                <div class="history-item" style="border-left-color: #FF9800;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 8px;">
                        <span style="font-size: 12px; color: #E65100; font-weight: bold;">${item.date}</span>
                    </div>
                    <div style="font-size: 13px; margin-bottom: 4px;"><strong>Rasi:</strong> ${item.rasi || '-'} | <strong>Udhaya:</strong> ${item.udhaya || '-'}</div>
                    <div style="white-space: pre-wrap; font-size: 14px; margin-top: 8px;">${item.notes || '-'}</div>
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
                </div>`;
        });
    } else { listDiv.innerHTML = "<p style='color:#888; text-align:center; font-size: 13px;'>No previous history.</p>"; }
    
    showPrescriptionForm();
};

// --- HISTORY EDIT & DELETE LOGIC (unchanged) ---
window.editHist = (clientId, timestamp) => {
    const probEl = document.getElementById(`prob-text-${timestamp}`);
    const solEl = document.getElementById(`sol-text-${timestamp}`);
    const probText = probEl.innerText;
    const solText = solEl.innerText;

    probEl.innerHTML = `
        <div class="mini-toolbar">
            <span onclick="undoText('edit-prob-${timestamp}')">Undo</span>
            <span onclick="clearText('edit-prob-${timestamp}')">Clear</span>
        </div>
        <textarea id="edit-prob-${timestamp}" rows="3" style="width: 100%; margin-top: 5px; padding: 8px; border-radius: 4px; border: 1px solid #ccc; font-family: inherit;">${probText === '-' ? '' : probText}</textarea>`;
    
    solEl.innerHTML = `
        <div class="mini-toolbar">
            <span onclick="undoText('edit-sol-${timestamp}')">Undo</span>
            <span onclick="clearText('edit-sol-${timestamp}')">Clear</span>
        </div>
        <textarea id="edit-sol-${timestamp}" rows="4" style="width: 100%; margin-top: 5px; padding: 8px; border-radius: 4px; border: 1px solid #ccc; font-family: inherit;">${solText === '-' ? '' : solText}</textarea>`;
    
    const actionsDiv = document.querySelector(`#hist-${timestamp} .history-actions`);
    actionsDiv.innerHTML = `
        <button type="button" onclick="saveHist(${clientId}, ${timestamp})" style="background: #4CAF50; color: white; padding: 4px 10px; font-size: 12px; border-radius: 4px;">Save</button>
        <button type="button" onclick="loadClient(${clientId})" style="background: #9e9e9e; color: white; padding: 4px 10px; font-size: 12px; border-radius: 4px; margin-left: 5px;">Cancel</button>
    `;
};

window.saveHist = async (clientId, timestamp) => {
    const client = await db.clients.get(clientId);
    const probVal = document.getElementById(`edit-prob-${timestamp}`).value;
    const solVal = document.getElementById(`edit-sol-${timestamp}`).value;

    const histIndex = client.consultations.findIndex(c => c.timestamp === timestamp);
    if(histIndex !== -1) {
        client.consultations[histIndex].problem = probVal;
        client.consultations[histIndex].solution = solVal;
        await db.clients.put(client);
        loadClient(clientId);
        topToast.fire({ text: 'Consultation updated' });
    }
};

window.editPrescHist = (clientId, timestamp) => {
    const rasiEl = document.getElementById(`p-rasi-${timestamp}`);
    const udhayaEl = document.getElementById(`p-udhaya-${timestamp}`);
    const notesEl = document.getElementById(`p-notes-${timestamp}`);

    const rasiText = rasiEl.innerText;
    const udhayaText = udhayaEl.innerText;
    const notesText = notesEl.innerText;

    rasiEl.innerHTML = `<input type="text" id="edit-p-rasi-${timestamp}" value="${rasiText}" style="width: 70px; padding: 2px; font-size: 12px;">`;
    udhayaEl.innerHTML = `<input type="text" id="edit-p-udhaya-${timestamp}" value="${udhayaText}" style="width: 70px; padding: 2px; font-size: 12px;">`;
    
    notesEl.innerHTML = `
        <div class="mini-toolbar" style="margin-top: 8px;">
            <span onclick="undoText('edit-p-notes-${timestamp}')">Undo</span>
            <span onclick="clearText('edit-p-notes-${timestamp}')">Clear</span>
        </div>
        <textarea id="edit-p-notes-${timestamp}" rows="4" style="width: 100%; margin-top: 5px; padding: 8px; border-radius: 4px; border: 1px solid #ccc; font-family: inherit;">${notesText}</textarea>
    `;

    const actionsDiv = document.querySelector(`#p-hist-${timestamp} .history-actions`);
    actionsDiv.innerHTML = `
        <button type="button" onclick="savePrescHist(${clientId}, ${timestamp})" style="background: #4CAF50; color: white; padding: 4px 10px; font-size: 12px; border-radius: 4px;">Save</button>
        <button type="button" onclick="loadPrescription(${clientId})" style="background: #9e9e9e; color: white; padding: 4px 10px; font-size: 12px; border-radius: 4px; margin-left: 5px;">Cancel</button>
    `;
};

window.savePrescHist = async (clientId, timestamp) => {
    const client = await db.clients.get(clientId);
    const rasiVal = document.getElementById(`edit-p-rasi-${timestamp}`).value;
    const udhayaVal = document.getElementById(`edit-p-udhaya-${timestamp}`).value;
    const notesVal = document.getElementById(`edit-p-notes-${timestamp}`).value;

    const histIndex = client.prescriptions.findIndex(c => c.timestamp === timestamp);
    if(histIndex !== -1) {
        client.prescriptions[histIndex].rasi = rasiVal;
        client.prescriptions[histIndex].udhaya = udhayaVal;
        client.prescriptions[histIndex].notes = notesVal;
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

// --- FILL PRESCRIPTION TEMPLATE (uses global selector) ---
function fillPrescriptionTemplate() {
    const template = getSelectedTemplate();
    const name = document.getElementById('prescName').value || "";
    const star = document.getElementById('prescStar').value || "";
    const place = document.getElementById('prescPlace').value || "";
    const rasi = document.getElementById('prescRasi').value || "";
    const udhaya = document.getElementById('prescUdhaya').value || "";
    const body = document.getElementById('prescBody').value || "";
    const currentDate = new Date().toLocaleDateString('en-IN');

    if(!name && !body) return false;

    const suffix = template === 'ck' ? 'CK' : 'Pratnya';
    document.getElementById(`pdfPrescName${suffix}`).innerText = name;
    document.getElementById(`pdfPrescDate${suffix}`).innerText = currentDate;
    document.getElementById(`pdfPrescStar${suffix}`).innerText = star;
    document.getElementById(`pdfPrescPlace${suffix}`).innerText = place;
    document.getElementById(`pdfPrescRasi${suffix}`).innerText = rasi;
    document.getElementById(`pdfPrescUdhaya${suffix}`).innerText = udhaya;
    document.getElementById(`pdfPrescBody${suffix}`).innerText = body;
    return true;
}

// =====================================================================
//  MULTI-PAGE PDF ENGINE
//  - Page 1 : header + client info + body text (first chunk)
//  - Middle  : body text only (no header, no footer)
//  - Last    : remaining body text + footer
//  Works for both Prescription (CK & Pratnya) and Full Report PDFs
// =====================================================================

/**
 * Renders one off-screen div, captures it via html2canvas and returns
 * a { imgData, pxWidth, pxHeight } object.
 */
async function captureElement(el) {
    // Temporarily make it visible off-screen so html2canvas can measure it
    const prev = el.style.cssText;
    el.style.cssText = `position:fixed;top:-99999px;left:-99999px;visibility:visible;`;
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging: false });
    el.style.cssText = prev;
    return { imgData: canvas.toDataURL('image/png'), pxW: canvas.width, pxH: canvas.height };
}

/**
 * Core multi-page builder.
 *
 * @param {object} opts
 *   template    - 'ck' | 'pratnya'
 *   type        - 'prescription' | 'report'
 *   clientData  - { name, star, place, rasi, udhaya, body, dob, time, consultations }
 * @returns {jsPDF} ready-to-save pdf object
 */
async function buildMultiPagePDF({ template, type, clientData }) {
    const { jsPDF } = window.jspdf;
    const A4_W_MM = 210;
    const A4_H_MM = 297;
    const SCALE    = 2;                 // html2canvas scale
    const MM_PER_PX = 25.4 / 96;       // 96 dpi → mm
    const PAGE_H_PX = (A4_H_MM / MM_PER_PX) * SCALE;   // ≈ 2245 px @2x

    // --- helper: create one of the hidden section divs on the fly ---
    function makeSectionDiv(id, innerHtml, extraStyle = '') {
        let el = document.getElementById(id);
        if (!el) {
            el = document.createElement('div');
            el.id = id;
            document.body.appendChild(el);
        }
        el.innerHTML = innerHtml;
        // A4 width at 96dpi = 794px; we render at 1x width, @2x scale
        el.style.cssText = `position:fixed;top:-99999px;left:-99999px;
            width:595px;background:white;padding:0;margin:0;
            box-sizing:border-box;font-family:'Segoe UI',Arial,sans-serif;
            visibility:hidden;${extraStyle}`;
        return el;
    }

    const isCK = (template === 'ck');

    // ---- build HTML for HEADER section ----
    const headerHtml = isCK ? `
        <div style="padding:30px 40px 20px 40px;border-bottom:2px solid #2E7D32;
                    display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
                <p style="color:#2E7D32;font-style:italic;font-size:16px;margin:0 0 2px 0;">Astrologer</p>
                <h2 style="color:#2E7D32;font-size:26px;font-weight:bold;margin:0;">C.K. Saji Panicker</h2>
                <div style="color:#2E7D32;font-style:italic;font-size:14px;line-height:1.6;margin-top:6px;">
                    Chathangottupuram, Kalarikkal<br>Wandoor-Malappuram<br>Kerala : 679 328
                </div>
            </div>
            <div style="text-align:right;">
                <p style="color:#2E7D32;font-style:italic;font-size:16px;margin:0 0 2px 0;">Consultation</p>
                <p style="color:#2E7D32;font-size:14px;margin:2px 0;">Online: <strong style="font-style:italic;">9207 773 880</strong></p>
                <p style="color:#2E7D32;font-size:14px;margin:2px 0;">Office: <strong style="font-style:italic;">7034 600 880</strong></p>
            </div>
        </div>` : `
        <div style="padding:30px 40px 20px 40px;border-bottom:2px solid #2E7D32;text-align:center;">
            <img src="logo.png" style="height:70px;width:auto;">
        </div>`;

    // ---- build HTML for CLIENT INFO row (prescription) ----
    const infoHtml = type === 'prescription' ? `
        <div style="padding:20px 40px 10px 40px;display:grid;grid-template-columns:1fr 1fr;
                    gap:8px;font-size:14px;font-family:Arial,sans-serif;border-bottom:1px solid #e0e0e0;">
            <div><strong>Name:</strong> ${clientData.name || ''}</div>
            <div><strong>Date:</strong> ${clientData.date || ''}</div>
            <div><strong>Star:</strong> ${clientData.star || ''}</div>
            <div><strong>Place:</strong> ${clientData.place || ''}</div>
            <div><strong>Rasi:</strong> ${clientData.rasi || ''}</div>
            <div><strong>Udhaya Rasi:</strong> ${clientData.udhaya || ''}</div>
        </div>` : `
        <div style="padding:20px 40px 10px 40px;font-size:14px;font-family:Arial,sans-serif;border-bottom:1px solid #e0e0e0;">
            <table style="width:100%;margin-bottom:8px;">
                <tr><td><strong>Name:</strong> ${clientData.name || ''}</td>
                    <td><strong>Star:</strong> ${clientData.star || ''}</td></tr>
                <tr><td><strong>DOB:</strong> ${clientData.dob || ''}</td>
                    <td><strong>Time:</strong> ${clientData.time || ''}</td></tr>
            </table>
            <strong style="color:#2E7D32;">Consultation History</strong>
        </div>`;

    // ---- build HTML for FOOTER ----
    const footerHtml = `
        <div style="padding:15px 40px 20px 40px;border-top:1px solid #2E7D32;text-align:center;">
            <span style="font-family:'Brush Script MT',cursive;font-size:22px;color:#2E7D32;">
                Fix your appointment through the call</span><br>
            <span style="font-family:Arial,sans-serif;font-size:14px;color:#2E7D32;
                         font-weight:bold;display:block;margin-top:4px;">www.pratnya.in</span>
        </div>`;

    // ---- body text / consultation rows ----
    let bodyLines = [];
    if (type === 'prescription') {
        // Split on newlines; each line is one entry
        bodyLines = (clientData.body || '').split('\n');
    } else {
        // Build rows from consultations array
        (clientData.consultations || []).forEach(c => {
            bodyLines.push(`__DATE__${c.date}`);
            if (c.problem) bodyLines.push(`__PROB__${c.problem}`);
            if (c.solution) bodyLines.push(`__SOL__${c.solution}`);
            bodyLines.push('__SEP__');
        });
    }

    // Render body lines as HTML
    function renderBodyLines(lines) {
        if (type === 'prescription') {
            return `<div style="padding:15px 40px;font-size:16px;line-height:1.9;
                               white-space:pre-wrap;font-family:Georgia,serif;">` +
                lines.join('\n') + `</div>`;
        } else {
            return lines.map(l => {
                if (l.startsWith('__DATE__')) return `<div style="padding:6px 40px 2px 40px;font-size:13px;color:#555;font-weight:bold;border-top:1px solid #eee;">${l.slice(8)}</div>`;
                if (l.startsWith('__PROB__')) return `<div style="padding:2px 40px;font-size:14px;"><strong>Problem:</strong> ${l.slice(8).replace(/\n/g,'<br>')}</div>`;
                if (l.startsWith('__SOL__'))  return `<div style="padding:2px 40px 8px 40px;font-size:14px;color:#1a5c1a;"><strong>Solution:</strong> ${l.slice(7).replace(/\n/g,'<br>')}</div>`;
                if (l === '__SEP__') return '<div style="height:8px;"></div>';
                return '';
            }).join('');
        }
    }

    // ---- measure fixed parts ----
    const headerEl = makeSectionDiv('_pdf_header', headerHtml);
    const infoEl   = makeSectionDiv('_pdf_info',   infoHtml);
    const footerEl = makeSectionDiv('_pdf_footer',  footerHtml);

    const [hCap, iCap, fCap] = await Promise.all([
        captureElement(headerEl),
        captureElement(infoEl),
        captureElement(footerEl)
    ]);

    const headerH = hCap.pxH;
    const infoH   = iCap.pxH;
    const footerH = fCap.pxH;
    const pageW   = hCap.pxW;
    const pageH   = PAGE_H_PX;

    // Available body space per page type (in px @2x)
    const bodySpacePage1    = pageH - headerH - infoH - footerH - 40 * SCALE; // leave margin
    const bodySpaceMiddle   = pageH - 40 * SCALE;
    const bodySpaceLastPage = pageH - footerH - 40 * SCALE;

    // ---- chunk body lines to fit into pages ----
    // Binary-search approach: keep adding lines until the rendered height exceeds limit
    async function chunkLines(lines, maxPxHeight) {
        if (lines.length === 0) return { fit: [], rest: [] };
        // Quick upper bound check
        const fullEl = makeSectionDiv('_pdf_body_probe', renderBodyLines(lines));
        const { pxH } = await captureElement(fullEl);
        if (pxH <= maxPxHeight) return { fit: lines, rest: [] };

        // Binary search
        let lo = 1, hi = lines.length - 1, best = 1;
        while (lo <= hi) {
            const mid = Math.floor((lo + hi) / 2);
            const probeEl = makeSectionDiv('_pdf_body_probe', renderBodyLines(lines.slice(0, mid)));
            const { pxH: ph } = await captureElement(probeEl);
            if (ph <= maxPxHeight) { best = mid; lo = mid + 1; }
            else { hi = mid - 1; }
        }
        return { fit: lines.slice(0, best), rest: lines.slice(best) };
    }

    // ---- build page list ----
    const pages = [];   // each entry: { header, info, bodyLines, footer }
    let remaining = bodyLines;

    // Page 1
    const chunk1 = await chunkLines(remaining, bodySpacePage1);
    pages.push({ header: true, info: true, body: chunk1.fit, footer: false });
    remaining = chunk1.rest;

    // Middle pages
    while (remaining.length > 0) {
        const isLast = true; // optimistic — check after
        const limit = bodySpaceLastPage; // reserve space for footer always at last
        const chunkM = await chunkLines(remaining, bodySpaceMiddle);
        if (chunkM.rest.length === 0) {
            // This is the last page
            pages.push({ header: false, info: false, body: chunkM.fit, footer: true });
        } else {
            pages.push({ header: false, info: false, body: chunkM.fit, footer: false });
        }
        remaining = chunkM.rest;
    }

    // If only 1 page, add footer to it
    if (pages.length === 1) {
        pages[0].footer = true;
    } else {
        // Ensure last page has footer
        pages[pages.length - 1].footer = true;
    }

    // ---- render PDF ----
    const pdf = new jsPDF('p', 'mm', 'a4');

    for (let p = 0; p < pages.length; p++) {
        if (p > 0) pdf.addPage();
        const pg = pages[p];
        let cursorMM = 0;

        function pxToMM(px) { return (px / SCALE) * MM_PER_PX; }

        // watermark on every page
        // (we skip html2canvas for watermark to keep it simple — jsPDF opacity)

        if (pg.header) {
            pdf.addImage(hCap.imgData, 'PNG', 0, cursorMM, A4_W_MM, pxToMM(headerH));
            cursorMM += pxToMM(headerH);
        }
        if (pg.info) {
            pdf.addImage(iCap.imgData, 'PNG', 0, cursorMM, A4_W_MM, pxToMM(infoH));
            cursorMM += pxToMM(infoH);
        }
        if (pg.body.length > 0) {
            const bodyEl = makeSectionDiv('_pdf_body_final', renderBodyLines(pg.body));
            const bCap = await captureElement(bodyEl);
            pdf.addImage(bCap.imgData, 'PNG', 0, cursorMM, A4_W_MM, pxToMM(bCap.pxH));
            cursorMM += pxToMM(bCap.pxH);
        }
        if (pg.footer) {
            // Pin footer to bottom of page
            const footerMM = pxToMM(footerH);
            pdf.addImage(fCap.imgData, 'PNG', 0, A4_H_MM - footerMM, A4_W_MM, footerMM);
        }
    }

    // cleanup temp divs
    ['_pdf_header','_pdf_info','_pdf_footer','_pdf_body_probe','_pdf_body_final'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
    });

    return pdf;
}

// --- GENERATE PRESCRIPTION PDF (global selector) ---
window.generatePrescriptionPDF = async () => {
    const template = getSelectedTemplate();
    if (!fillPrescriptionTemplate()) {
        topToast.fire({ text: 'Form is empty!', background: '#E0245E' });
        return;
    }
    const name  = document.getElementById('prescName').value  || "Client";
    const star  = document.getElementById('prescStar').value  || "";
    const place = document.getElementById('prescPlace').value || "";
    const rasi  = document.getElementById('prescRasi').value  || "";
    const udhaya= document.getElementById('prescUdhaya').value|| "";
    const body  = document.getElementById('prescBody').value  || "";
    const date  = new Date().toLocaleDateString('en-IN');

    topToast.fire({ text: 'Generating PDF…' });
    try {
        const pdf = await buildMultiPagePDF({
            template,
            type: 'prescription',
            clientData: { name, star, place, rasi, udhaya, body, date }
        });
        pdf.save(`${name}_Prescription.pdf`);
        topToast.fire({ text: 'Downloaded successfully!' });
    } catch(e) { console.error(e); topToast.fire({ text: 'PDF Failed', background: '#E0245E' }); }
};

// --- SHARE PRESCRIPTION PDF (global selector) ---
window.sharePrescriptionPDF = async () => {
    const template = getSelectedTemplate();
    if (!fillPrescriptionTemplate()) {
        topToast.fire({ text: 'Form is empty!', background: '#E0245E' });
        return;
    }
    const name  = document.getElementById('prescName').value  || "Client";
    const star  = document.getElementById('prescStar').value  || "";
    const place = document.getElementById('prescPlace').value || "";
    const rasi  = document.getElementById('prescRasi').value  || "";
    const udhaya= document.getElementById('prescUdhaya').value|| "";
    const body  = document.getElementById('prescBody').value  || "";
    const date  = new Date().toLocaleDateString('en-IN');

    topToast.fire({ text: 'Preparing file for sharing…' });
    try {
        const pdf = await buildMultiPagePDF({
            template,
            type: 'prescription',
            clientData: { name, star, place, rasi, udhaya, body, date }
        });
        const pdfBlob = pdf.output('blob');
        const file = new File([pdfBlob], `${name}_Prescription.pdf`, { type: 'application/pdf' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: 'Prescription', text: 'Here is your prescription from Pratnya Astro.' });
            topToast.fire({ text: 'Opened share menu!' });
        } else {
            Swal.fire({ title: 'Unsupported Browser', text: 'Your device/browser does not support direct file sharing. Please click "PDF" to download it, then attach it in WhatsApp manually.', icon: 'info' });
        }
    } catch(e) {
        console.error(e);
        topToast.fire({ text: 'Sharing cancelled or failed', background: '#E0245E' });
    }
};

// --- GENERATE CLIENT FULL REPORT PDF (global selector) ---
window.generatePDF = async () => {
    const template = getSelectedTemplate();
    const name = document.getElementById('name').value || "Client";
    const star = document.getElementById('star').value || "";
    const dob  = document.getElementById('dob').value  || "";
    const time = document.getElementById('birthTime').value;

    let displayTime = time;
    if (time) {
        const [h, m] = time.split(':');
        const hour = parseInt(h);
        displayTime = `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
    }

    let consultations = [];
    const id = document.getElementById('clientId').value;
    if (id) {
        const client = await db.clients.get(parseInt(id));
        if (client && client.consultations) consultations = client.consultations;
    }

    topToast.fire({ text: 'Generating PDF…' });
    try {
        const pdf = await buildMultiPagePDF({
            template,
            type: 'report',
            clientData: { name, star, dob, time: displayTime, consultations }
        });
        pdf.save(`${name}_Full_Report.pdf`);
        topToast.fire({ text: 'Downloaded successfully!' });
    } catch(e) { console.error(e); topToast.fire({ text: 'PDF Failed', background: '#E0245E' }); }
};

searchInput.oninput = () => updateList();
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