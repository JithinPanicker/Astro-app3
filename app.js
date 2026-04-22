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

// ========== PDF GENERATION HELPERS ==========
// Logo cache
let logoDataURL = null;
async function getLogoDataURL() {
    if (logoDataURL) return logoDataURL;
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = 'logo.png';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            logoDataURL = canvas.toDataURL('image/png');
            resolve(logoDataURL);
        };
        img.onerror = () => resolve('');
    });
}

// Draw CK Saji Panicker header (exact replica of HTML)
async function drawCKHeader(doc, logoData, pageNumber, totalPages) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    
    if (pageNumber === 1) {
        // Left side: Astrologer, Name, Address
        doc.setFontSize(16);
        doc.setFont('Georgia', 'italic');
        doc.setTextColor(46, 125, 50);
        doc.text('Astrologer', margin, 20);
        
        doc.setFontSize(26);
        doc.setFont('Georgia', 'bold');
        doc.text('C.K. Saji Panicker', margin, 32);
        
        doc.setFontSize(12);
        doc.setFont('Georgia', 'normal');
        doc.text('Chathangottupuram, Kalarikkal', margin, 42);
        doc.text('Wandoor-Malappuram', margin, 48);
        doc.text('Kerala : 679 328', margin, 54);
        
        // Right side: Consultation and numbers
        doc.setFontSize(16);
        doc.setFont('Georgia', 'italic');
        doc.text('Consultation', pageWidth - margin - 65, 20);
        doc.setFontSize(14);
        doc.setFont('Georgia', 'normal');
        doc.text('Online: 9207 773 880', pageWidth - margin - 65, 30);
        doc.text('Office: 7034 600 880', pageWidth - margin - 65, 38);
        
        // Green line
        doc.setDrawColor(46, 125, 50);
        doc.setLineWidth(0.8);
        doc.line(margin, 62, pageWidth - margin, 62);
    } else {
        // Simplified header for subsequent pages
        doc.setFontSize(14);
        doc.setFont('Georgia', 'bold');
        doc.setTextColor(46, 125, 50);
        doc.text('C.K. Saji Panicker - Continued', margin, 20);
        doc.setDrawColor(46, 125, 50);
        doc.setLineWidth(0.5);
        doc.line(margin, 26, pageWidth - margin, 26);
    }
}

// Draw Pratnya header (centered logo)
async function drawPratnyaHeader(doc, logoData, pageNumber, totalPages) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    
    if (pageNumber === 1) {
        if (logoData) {
            // Center the logo (approx 60x60)
            doc.addImage(logoData, 'PNG', (pageWidth - 60)/2, 15, 60, 60);
        }
        // No text below logo as per original (just the logo)
        doc.setDrawColor(46, 125, 50);
        doc.setLineWidth(0.8);
        doc.line(margin, 85, pageWidth - margin, 85);
    } else {
        doc.setFontSize(14);
        doc.setFont('Georgia', 'bold');
        doc.setTextColor(46, 125, 50);
        doc.text('Pratnya - Continued', margin, 20);
        doc.setDrawColor(46, 125, 50);
        doc.setLineWidth(0.5);
        doc.line(margin, 26, pageWidth - margin, 26);
    }
}

// Draw footer with signature line and page number
function drawFooter(doc, pageNumber, totalPages) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    
    // Green line above footer
    doc.setDrawColor(46, 125, 50);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 28, pageWidth - margin, pageHeight - 28);
    
    // Signature text
    doc.setFontSize(18);
    doc.setFont('Brush Script MT', 'cursive');
    doc.setTextColor(46, 125, 50);
    doc.text('Fix your appointment through the call', pageWidth/2, pageHeight - 18, { align: 'center' });
    
    // Website
    doc.setFontSize(11);
    doc.setFont('Arial', 'bold');
    doc.text('www.pratnya.in', pageWidth/2, pageHeight - 10, { align: 'center' });
    
    // Page number
    doc.setFontSize(10);
    doc.setFont('Arial', 'normal');
    doc.text(`Page ${pageNumber} of ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
}

// Add watermark logo (low opacity) on every page
async function addWatermark(doc, logoData) {
    if (!logoData) return;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    // Center, large, low opacity
    const imgWidth = 120;
    const imgHeight = 120;
    const x = (pageWidth - imgWidth) / 2;
    const y = (pageHeight - imgHeight) / 2;
    
    // Set global alpha for transparency
    const ctx = doc.canvas.getContext('2d');
    ctx.save();
    ctx.globalAlpha = 0.08;
    // We need to draw image using canvas context directly
    const img = new Image();
    img.src = logoData;
    await new Promise((resolve) => { img.onload = resolve; });
    ctx.drawImage(img, x, y, imgWidth, imgHeight);
    ctx.restore();
}

// ========== MULTI-PAGE PRESCRIPTION PDF ==========
window.generatePrescriptionPDF = async () => {
    const template = getSelectedTemplate();
    const name = document.getElementById('prescName').value || "Client";
    const star = document.getElementById('prescStar').value || "";
    const place = document.getElementById('prescPlace').value || "";
    const rasi = document.getElementById('prescRasi').value || "";
    const udhaya = document.getElementById('prescUdhaya').value || "";
    const body = document.getElementById('prescBody').value || "";
    const currentDate = new Date().toLocaleDateString('en-IN');

    if (!name && !body) {
        topToast.fire({ text: 'Form is empty!', background: '#E0245E' });
        return;
    }

    topToast.fire({ text: 'Generating PDF...' });
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;
        const contentWidth = pageWidth - 2 * margin;
        
        const logoData = await getLogoDataURL();
        
        // Pre-calculate total pages? We'll build incrementally.
        let currentPage = 1;
        
        // Helper to add new page with header/footer/watermark
        const addNewPage = async () => {
            doc.addPage();
            currentPage++;
            // Watermark first (behind everything)
            await addWatermark(doc, logoData);
            if (template === 'ck') {
                await drawCKHeader(doc, logoData, currentPage, 0);
            } else {
                await drawPratnyaHeader(doc, logoData, currentPage, 0);
            }
            return 35; // Y position after header on new page
        };
        
        // First page setup
        await addWatermark(doc, logoData);
        if (template === 'ck') {
            await drawCKHeader(doc, logoData, 1, 0);
        } else {
            await drawPratnyaHeader(doc, logoData, 1, 0);
        }
        
        let yPos = template === 'ck' ? 75 : 95; // below header
        doc.setFontSize(12);
        doc.setFont('Arial', 'normal');
        doc.setTextColor(0, 0, 0);
        
        const leftColX = margin;
        const rightColX = pageWidth/2 + 5;
        const lineHeight = 7;
        
        // Client info grid
        doc.setFont('Arial', 'bold');
        doc.text('Name:', leftColX, yPos);
        doc.setFont('Arial', 'normal');
        doc.text(name, leftColX + 25, yPos);
        
        doc.setFont('Arial', 'bold');
        doc.text('Date:', rightColX, yPos);
        doc.setFont('Arial', 'normal');
        doc.text(currentDate, rightColX + 25, yPos);
        yPos += lineHeight;
        
        doc.setFont('Arial', 'bold');
        doc.text('Star:', leftColX, yPos);
        doc.setFont('Arial', 'normal');
        doc.text(star, leftColX + 25, yPos);
        
        doc.setFont('Arial', 'bold');
        doc.text('Place:', rightColX, yPos);
        doc.setFont('Arial', 'normal');
        doc.text(place, rightColX + 25, yPos);
        yPos += lineHeight;
        
        doc.setFont('Arial', 'bold');
        doc.text('Rasi:', leftColX, yPos);
        doc.setFont('Arial', 'normal');
        doc.text(rasi, leftColX + 25, yPos);
        
        doc.setFont('Arial', 'bold');
        doc.text('Udhaya Rasi:', rightColX, yPos);
        doc.setFont('Arial', 'normal');
        doc.text(udhaya, rightColX + 35, yPos);
        yPos += lineHeight + 8;
        
        // Prescription body
        doc.setFontSize(12);
        doc.setFont('Arial', 'normal');
        
        const lines = doc.splitTextToSize(body, contentWidth);
        const footerMargin = 32; // space for footer
        
        for (let i = 0; i < lines.length; i++) {
            if (yPos > pageHeight - footerMargin) {
                yPos = await addNewPage();
            }
            doc.text(lines[i], margin, yPos);
            yPos += lineHeight;
        }
        
        // Now add footers and page numbers to all pages
        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            drawFooter(doc, i, totalPages);
        }
        
        doc.save(`${name}_Prescription.pdf`);
        topToast.fire({ text: 'Downloaded successfully!' });
    } catch(e) {
        console.error(e);
        topToast.fire({ text: 'PDF generation failed', background: '#E0245E' });
    }
};

// ========== SHARE PRESCRIPTION PDF (WhatsApp) ==========
window.sharePrescriptionPDF = async () => {
    const template = getSelectedTemplate();
    const name = document.getElementById('prescName').value || "Client";
    const star = document.getElementById('prescStar').value || "";
    const place = document.getElementById('prescPlace').value || "";
    const rasi = document.getElementById('prescRasi').value || "";
    const udhaya = document.getElementById('prescUdhaya').value || "";
    const body = document.getElementById('prescBody').value || "";
    const currentDate = new Date().toLocaleDateString('en-IN');

    if (!name && !body) {
        topToast.fire({ text: 'Form is empty!', background: '#E0245E' });
        return;
    }

    topToast.fire({ text: 'Preparing file for sharing...' });
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;
        const contentWidth = pageWidth - 2 * margin;
        
        const logoData = await getLogoDataURL();
        
        let currentPage = 1;
        
        const addNewPage = async () => {
            doc.addPage();
            currentPage++;
            await addWatermark(doc, logoData);
            if (template === 'ck') {
                await drawCKHeader(doc, logoData, currentPage, 0);
            } else {
                await drawPratnyaHeader(doc, logoData, currentPage, 0);
            }
            return 35;
        };
        
        await addWatermark(doc, logoData);
        if (template === 'ck') {
            await drawCKHeader(doc, logoData, 1, 0);
        } else {
            await drawPratnyaHeader(doc, logoData, 1, 0);
        }
        
        let yPos = template === 'ck' ? 75 : 95;
        doc.setFontSize(12);
        doc.setFont('Arial', 'normal');
        doc.setTextColor(0, 0, 0);
        
        const leftColX = margin;
        const rightColX = pageWidth/2 + 5;
        const lineHeight = 7;
        
        doc.setFont('Arial', 'bold');
        doc.text('Name:', leftColX, yPos);
        doc.setFont('Arial', 'normal');
        doc.text(name, leftColX + 25, yPos);
        
        doc.setFont('Arial', 'bold');
        doc.text('Date:', rightColX, yPos);
        doc.setFont('Arial', 'normal');
        doc.text(currentDate, rightColX + 25, yPos);
        yPos += lineHeight;
        
        doc.setFont('Arial', 'bold');
        doc.text('Star:', leftColX, yPos);
        doc.setFont('Arial', 'normal');
        doc.text(star, leftColX + 25, yPos);
        
        doc.setFont('Arial', 'bold');
        doc.text('Place:', rightColX, yPos);
        doc.setFont('Arial', 'normal');
        doc.text(place, rightColX + 25, yPos);
        yPos += lineHeight;
        
        doc.setFont('Arial', 'bold');
        doc.text('Rasi:', leftColX, yPos);
        doc.setFont('Arial', 'normal');
        doc.text(rasi, leftColX + 25, yPos);
        
        doc.setFont('Arial', 'bold');
        doc.text('Udhaya Rasi:', rightColX, yPos);
        doc.setFont('Arial', 'normal');
        doc.text(udhaya, rightColX + 35, yPos);
        yPos += lineHeight + 8;
        
        const lines = doc.splitTextToSize(body, contentWidth);
        const footerMargin = 32;
        
        for (let i = 0; i < lines.length; i++) {
            if (yPos > pageHeight - footerMargin) {
                yPos = await addNewPage();
            }
            doc.text(lines[i], margin, yPos);
            yPos += lineHeight;
        }
        
        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            drawFooter(doc, i, totalPages);
        }
        
        const pdfBlob = doc.output('blob');
        const file = new File([pdfBlob], `${name}_Prescription.pdf`, { type: 'application/pdf' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: 'Prescription',
                text: 'Here is your prescription from Pratnya Astro.'
            });
            topToast.fire({ text: 'Opened share menu!' });
        } else {
            Swal.fire({
                title: 'Unsupported Browser',
                text: 'Your device/browser does not support direct file sharing. Please click "PDF" to download it, then attach it in WhatsApp manually.',
                icon: 'info'
            });
        }
    } catch(e) { 
        console.error(e); 
        topToast.fire({ text: 'Sharing cancelled or failed', background: '#E0245E' }); 
    }
};

// ========== MULTI-PAGE CONSULTATION REPORT PDF ==========
window.generatePDF = async () => {
    const template = getSelectedTemplate();
    const name = document.getElementById('name').value || 'Client';
    const star = document.getElementById('star').value || '';
    const dob = document.getElementById('dob').value || '';
    let time = document.getElementById('birthTime').value || '';
    
    if (time) {
        const [h, m] = time.split(':');
        const hour = parseInt(h);
        time = `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
    }
    
    const clientId = document.getElementById('clientId').value;
    let consultations = [];
    if (clientId) {
        const client = await db.clients.get(parseInt(clientId));
        if (client && client.consultations) {
            consultations = client.consultations;
        }
    }
    
    if (!name && consultations.length === 0) {
        topToast.fire({ text: 'No data to generate PDF', background: '#E0245E' });
        return;
    }
    
    topToast.fire({ text: 'Generating PDF...' });
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;
        const contentWidth = pageWidth - 2 * margin;
        
        const logoData = await getLogoDataURL();
        
        // Prepare table rows
        const rows = [];
        consultations.forEach(c => {
            rows.push([
                c.date,
                `Problem:\n${c.problem || '-'}\n\nSolution:\n${c.solution || '-'}`
            ]);
        });
        
        // Use autoTable with custom header/footer drawing
        doc.autoTable({
            startY: template === 'ck' ? 75 : 95,
            margin: { left: margin, right: margin },
            head: [['Date', 'Details']],
            body: rows,
            theme: 'grid',
            headStyles: { fillColor: [46, 125, 50], textColor: 255, fontStyle: 'bold' },
            columnStyles: {
                0: { cellWidth: 40 },
                1: { cellWidth: 'auto' }
            },
            didDrawPage: async (data) => {
                const pageNumber = doc.internal.getCurrentPageInfo().pageNumber;
                const totalPages = doc.internal.getNumberOfPages();
                
                // Watermark on every page
                await addWatermark(doc, logoData);
                
                // Draw header
                if (pageNumber === 1) {
                    if (template === 'ck') {
                        await drawCKHeader(doc, logoData, 1, totalPages);
                    } else {
                        await drawPratnyaHeader(doc, logoData, 1, totalPages);
                    }
                    // Client info above table
                    doc.setFontSize(12);
                    doc.setFont('Arial', 'normal');
                    doc.setTextColor(0, 0, 0);
                    let yInfo = template === 'ck' ? 65 : 85;
                    doc.text(`Name: ${name}    Star: ${star}    DOB: ${dob}    Time: ${time}`, margin, yInfo);
                } else {
                    if (template === 'ck') {
                        await drawCKHeader(doc, logoData, pageNumber, totalPages);
                    } else {
                        await drawPratnyaHeader(doc, logoData, pageNumber, totalPages);
                    }
                }
                // Draw footer
                drawFooter(doc, pageNumber, totalPages);
            }
        });
        
        // If no consultations, add a simple page
        if (consultations.length === 0) {
            await addWatermark(doc, logoData);
            if (template === 'ck') {
                await drawCKHeader(doc, logoData, 1, 1);
            } else {
                await drawPratnyaHeader(doc, logoData, 1, 1);
            }
            doc.setFontSize(12);
            let yPos = template === 'ck' ? 75 : 95;
            doc.text(`Name: ${name}    Star: ${star}    DOB: ${dob}    Time: ${time}`, margin, yPos);
            yPos += 10;
            doc.text('No consultation history available.', margin, yPos);
            drawFooter(doc, 1, 1);
        }
        
        doc.save(`${name}_Full_Report.pdf`);
        topToast.fire({ text: 'Downloaded successfully!' });
    } catch (error) {
        console.error(error);
        topToast.fire({ text: 'PDF Failed', background: '#E0245E' });
    }
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