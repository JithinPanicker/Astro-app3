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

// --- GENERATE PRESCRIPTION PDF (global selector) ---
window.generatePrescriptionPDF = async () => {
    const template = getSelectedTemplate();
    if (!fillPrescriptionTemplate()) {
        topToast.fire({ text: 'Form is empty!', background: '#E0245E' });
        return;
    }
    const name = document.getElementById('prescName').value || "Client";

    topToast.fire({ text: 'Generating PDF...' });
    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 15;
        let currentPage = 1;
        let totalPages = 1; // will be updated later

        // Helper: draw header (only first page)
        const drawHeader = (doc, templateType) => {
            if (templateType === 'ck') {
                doc.setFontSize(16);
                doc.setTextColor(46, 125, 50);
                doc.setFont('Georgia', 'italic');
                doc.text('Astrologer', margin, margin + 5);
                doc.setFontSize(26);
                doc.setFont('Georgia', 'bold');
                doc.text('C.K. Saji Panicker', margin, margin + 15);
                doc.setFontSize(12);
                doc.setFont('Georgia', 'italic');
                doc.text('Chathangottupuram, Kalarikkal', margin, margin + 23);
                doc.text('Wandoor-Malappuram', margin, margin + 29);
                doc.text('Kerala : 679 328', margin, margin + 35);
                // Right side contact
                doc.setFontSize(14);
                doc.text('Consultation', pageWidth - margin - 40, margin + 5);
                doc.setFontSize(12);
                doc.text('Online: 9207 773 880', pageWidth - margin - 40, margin + 12);
                doc.text('Office: 7034 600 880', pageWidth - margin - 40, margin + 19);
            } else { // pratnya
                // centered logo would be drawn as text or image; we'll draw a simple text header
                doc.setFontSize(24);
                doc.setTextColor(46, 125, 50);
                doc.setFont('Georgia', 'bold');
                doc.text('Pratnya Astro', pageWidth / 2, margin + 15, { align: 'center' });
            }
            // Green line
            doc.setDrawColor(46, 125, 50);
            doc.setLineWidth(0.5);
            doc.line(margin, margin + 42, pageWidth - margin, margin + 42);
            return margin + 48; // y position after header
        };

        // Helper: draw footer (only last page)
        const drawFooter = (doc, templateType, lastPageY) => {
            // Footer only on last page
            const footerY = pageHeight - 25;
            doc.setDrawColor(46, 125, 50);
            doc.setLineWidth(0.5);
            doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
            doc.setFontSize(18);
            doc.setTextColor(46, 125, 50);
            doc.setFont('Brush Script MT', 'cursive');
            doc.text('Fix your appointment through the call', pageWidth / 2, footerY, { align: 'center' });
            doc.setFontSize(12);
            doc.setFont('Arial', 'bold');
            doc.text('www.pratnya.in', pageWidth / 2, footerY + 8, { align: 'center' });
        };

        // Get data
        const star = document.getElementById('prescStar').value || '';
        const place = document.getElementById('prescPlace').value || '';
        const rasi = document.getElementById('prescRasi').value || '';
        const udhaya = document.getElementById('prescUdhaya').value || '';
        const body = document.getElementById('prescBody').value || '';
        const currentDate = new Date().toLocaleDateString('en-IN');

        // ---- First page creation ----
        let y = drawHeader(pdf, template);
        
        // Client details grid
        pdf.setFontSize(12);
        pdf.setTextColor(0, 0, 0);
        pdf.setFont('Arial', 'normal');
        pdf.text(`Name: ${name}`, margin, y);
        pdf.text(`Date: ${currentDate}`, pageWidth / 2, y);
        y += 8;
        pdf.text(`Star: ${star}`, margin, y);
        pdf.text(`Place: ${place}`, pageWidth / 2, y);
        y += 8;
        pdf.text(`Rasi: ${rasi}`, margin, y);
        pdf.text(`Udhaya Rasi: ${udhaya}`, pageWidth / 2, y);
        y += 15;

        // Body text with pagination
        pdf.setFontSize(13);
        pdf.setFont('Georgia', 'normal');
        const lines = pdf.splitTextToSize(body, pageWidth - 2 * margin);
        const lineHeight = 7;
        const maxY = pageHeight - 35; // leave space for footer

        for (let i = 0; i < lines.length; i++) {
            if (y + lineHeight > maxY) {
                pdf.addPage();
                currentPage++;
                y = margin; // no header on subsequent pages
                // (if you want a small continuation header, you can add it here)
            }
            pdf.text(lines[i], margin, y);
            y += lineHeight;
        }

        // After all text, add footer only on last page
        totalPages = currentPage;
        drawFooter(pdf, template, y);

        pdf.save(`${name}_Prescription.pdf`);
        topToast.fire({ text: 'Downloaded successfully!' });
    } catch(e) { 
        console.error(e); 
        topToast.fire({ text: 'PDF generation failed', background: '#E0245E' });
    }
};

// --- SHARE PRESCRIPTION PDF (global selector) ---
window.sharePrescriptionPDF = async () => {
    const template = getSelectedTemplate();
    if (!fillPrescriptionTemplate()) {
        topToast.fire({ text: 'Form is empty!', background: '#E0245E' });
        return;
    }
    const name = document.getElementById('prescName').value || 'Client';

    topToast.fire({ text: 'Preparing file for sharing...' });
    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 15;
        let currentPage = 1;

        // Helper: draw header (only first page)
        const drawHeader = (doc, templateType) => {
            if (templateType === 'ck') {
                doc.setFontSize(16);
                doc.setTextColor(46, 125, 50);
                doc.setFont('Georgia', 'italic');
                doc.text('Astrologer', margin, margin + 5);
                doc.setFontSize(26);
                doc.setFont('Georgia', 'bold');
                doc.text('C.K. Saji Panicker', margin, margin + 15);
                doc.setFontSize(12);
                doc.setFont('Georgia', 'italic');
                doc.text('Chathangottupuram, Kalarikkal', margin, margin + 23);
                doc.text('Wandoor-Malappuram', margin, margin + 29);
                doc.text('Kerala : 679 328', margin, margin + 35);
                doc.setFontSize(14);
                doc.text('Consultation', pageWidth - margin - 40, margin + 5);
                doc.setFontSize(12);
                doc.text('Online: 9207 773 880', pageWidth - margin - 40, margin + 12);
                doc.text('Office: 7034 600 880', pageWidth - margin - 40, margin + 19);
            } else {
                doc.setFontSize(24);
                doc.setTextColor(46, 125, 50);
                doc.setFont('Georgia', 'bold');
                doc.text('Pratnya Astro', pageWidth / 2, margin + 15, { align: 'center' });
            }
            doc.setDrawColor(46, 125, 50);
            doc.setLineWidth(0.5);
            doc.line(margin, margin + 42, pageWidth - margin, margin + 42);
            return margin + 48;
        };

        const drawFooter = (doc, templateType) => {
            const footerY = pageHeight - 25;
            doc.setDrawColor(46, 125, 50);
            doc.setLineWidth(0.5);
            doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
            doc.setFontSize(18);
            doc.setTextColor(46, 125, 50);
            doc.setFont('Brush Script MT', 'cursive');
            doc.text('Fix your appointment through the call', pageWidth / 2, footerY, { align: 'center' });
            doc.setFontSize(12);
            doc.setFont('Arial', 'bold');
            doc.text('www.pratnya.in', pageWidth / 2, footerY + 8, { align: 'center' });
        };

        const star = document.getElementById('prescStar').value || '';
        const place = document.getElementById('prescPlace').value || '';
        const rasi = document.getElementById('prescRasi').value || '';
        const udhaya = document.getElementById('prescUdhaya').value || '';
        const body = document.getElementById('prescBody').value || '';
        const currentDate = new Date().toLocaleDateString('en-IN');

        let y = drawHeader(pdf, template);
        
        pdf.setFontSize(12);
        pdf.setTextColor(0, 0, 0);
        pdf.setFont('Arial', 'normal');
        pdf.text(`Name: ${name}`, margin, y);
        pdf.text(`Date: ${currentDate}`, pageWidth / 2, y);
        y += 8;
        pdf.text(`Star: ${star}`, margin, y);
        pdf.text(`Place: ${place}`, pageWidth / 2, y);
        y += 8;
        pdf.text(`Rasi: ${rasi}`, margin, y);
        pdf.text(`Udhaya Rasi: ${udhaya}`, pageWidth / 2, y);
        y += 15;

        pdf.setFontSize(13);
        pdf.setFont('Georgia', 'normal');
        const lines = pdf.splitTextToSize(body, pageWidth - 2 * margin);
        const lineHeight = 7;
        const maxY = pageHeight - 35;

        for (let i = 0; i < lines.length; i++) {
            if (y + lineHeight > maxY) {
                pdf.addPage();
                currentPage++;
                y = margin;
            }
            pdf.text(lines[i], margin, y);
            y += lineHeight;
        }

        drawFooter(pdf, template);

        const pdfBlob = pdf.output('blob');
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

// --- GENERATE CLIENT FULL REPORT PDF (global selector) ---
window.generatePDF = async () => {
    const template = getSelectedTemplate();
    const name = document.getElementById('name').value || 'Client';
    const star = document.getElementById('star').value || '';
    const dob = document.getElementById('dob').value || '';
    const rawTime = document.getElementById('birthTime').value;
    let displayTime = rawTime;
    if (rawTime) {
        const [h, m] = rawTime.split(':');
        const hour = parseInt(h);
        displayTime = `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
    }

    const id = document.getElementById('clientId').value;
    let consults = [];
    if (id) {
        const client = await db.clients.get(parseInt(id));
        if (client && client.consultations) consults = client.consultations;
    }

    topToast.fire({ text: 'Generating PDF...' });
    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 15;
        let currentPage = 1;

        // Header drawing (same as prescription, first page only)
        const drawHeader = (doc, templateType) => {
            if (templateType === 'ck') {
                doc.setFontSize(16);
                doc.setTextColor(46, 125, 50);
                doc.setFont('Georgia', 'italic');
                doc.text('Astrologer', margin, margin + 5);
                doc.setFontSize(26);
                doc.setFont('Georgia', 'bold');
                doc.text('C.K. Saji Panicker', margin, margin + 15);
                doc.setFontSize(12);
                doc.setFont('Georgia', 'italic');
                doc.text('Chathangottupuram, Kalarikkal', margin, margin + 23);
                doc.text('Wandoor-Malappuram', margin, margin + 29);
                doc.text('Kerala : 679 328', margin, margin + 35);
                doc.setFontSize(14);
                doc.text('Consultation', pageWidth - margin - 40, margin + 5);
                doc.setFontSize(12);
                doc.text('Online: 9207 773 880', pageWidth - margin - 40, margin + 12);
                doc.text('Office: 7034 600 880', pageWidth - margin - 40, margin + 19);
            } else {
                doc.setFontSize(24);
                doc.setTextColor(46, 125, 50);
                doc.setFont('Georgia', 'bold');
                doc.text('Pratnya Astro', pageWidth / 2, margin + 15, { align: 'center' });
            }
            doc.setDrawColor(46, 125, 50);
            doc.setLineWidth(0.5);
            doc.line(margin, margin + 42, pageWidth - margin, margin + 42);
            return margin + 48;
        };

        const drawFooter = (doc, templateType) => {
            const footerY = pageHeight - 25;
            doc.setDrawColor(46, 125, 50);
            doc.setLineWidth(0.5);
            doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
            doc.setFontSize(18);
            doc.setTextColor(46, 125, 50);
            doc.setFont('Brush Script MT', 'cursive');
            doc.text('Fix your appointment through the call', pageWidth / 2, footerY, { align: 'center' });
            doc.setFontSize(12);
            doc.setFont('Arial', 'bold');
            doc.text('www.pratnya.in', pageWidth / 2, footerY + 8, { align: 'center' });
        };

        // ---- Start first page ----
        let y = drawHeader(pdf, template);

        // Client info
        pdf.setFontSize(12);
        pdf.setTextColor(0, 0, 0);
        pdf.setFont('Arial', 'normal');
        pdf.text(`Name: ${name}`, margin, y);
        pdf.text(`Star: ${star}`, pageWidth / 2, y);
        y += 8;
        pdf.text(`DOB: ${dob}`, margin, y);
        pdf.text(`Time: ${displayTime}`, pageWidth / 2, y);
        y += 15;

        pdf.setFontSize(14);
        pdf.setFont('Arial', 'bold');
        pdf.text('Consultation History', margin, y);
        y += 8;

        // Build table rows
        const tableRows = consults.map(c => [
            c.date || '',
            `Problem:\n${c.problem || '-'}\n\nSolution:\n${c.solution || '-'}`
        ]);

        // Use autoTable with custom header/footer handling
        pdf.autoTable({
            startY: y,
            margin: { left: margin, right: margin },
            head: [['Date', 'Details']],
            body: tableRows,
            theme: 'grid',
            styles: { fontSize: 10, cellPadding: 3 },
            headStyles: { fillColor: [46, 125, 50], textColor: 255 },
            columnStyles: {
                0: { cellWidth: 40 },
                1: { cellWidth: 'auto' }
            },
            didDrawPage: (data) => {
                // After autoTable draws, we manually add footer on last page
                // autoTable increments page count; we can't easily know total pages ahead
                // We'll draw footer in the final step after autoTable completes.
            }
        });

        // After table is drawn, determine total pages
        const totalPages = pdf.internal.getNumberOfPages();
        // Draw footer on the last page only
        pdf.setPage(totalPages);
        drawFooter(pdf, template);

        pdf.save(`${name}_Full_Report.pdf`);
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