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
    Swal.fire({ title: 'Saved!', icon: 'success', timer: 1000, showConfirmButton: false, width: '200px' });
};

// --- SAVE PRESCRIPTION ---
window.savePrescription = async () => {
    const id = document.getElementById('prescClientId').value;
    const name = document.getElementById('prescName').value.trim();
    if(!name) { Swal.fire({title: 'Error', text: 'Name is required', icon: 'error'}); return; }

    const prescData = {
        name: name,
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
    Swal.fire({ title: 'Saved!', icon: 'success', timer: 1000, showConfirmButton: false, width: '200px' });
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

    // Load Consultations
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
    } else { listDiv.innerHTML = "<p style='color:#888; text-align:center;'>No previous consultations.</p>"; }

    // Load Prescriptions into Client Window
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
    } else { prescDiv.innerHTML = "<p style='color:#888; text-align:center;'>No previous prescriptions.</p>"; }

    showForm();
};

// --- LOAD PRESCRIPTION DETAILS ---
window.loadPrescription = async (id) => {
    const client = await db.clients.get(id);
    if(!client) return;
    
    document.getElementById('prescClientId').value = client.id;
    document.getElementById('prescName').value = client.name || "";
    document.getElementById('prescStar').value = client.star || "";
    document.getElementById('prescPlace').value = client.location || "";
    
    // Clear current typing area
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
                            <button type="button" onclick="loadOldPrescText(${item.timestamp})" style="background: #1976D2; color: white; padding: 4px 10px; font-size: 12px; border-radius: 4px;">Load to Editor</button>
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
    } else { listDiv.innerHTML = "<p style='color:#888; text-align:center;'>No previous history.</p>"; }
    
    showPrescriptionForm();
};

window.loadOldPrescText = (timestamp) => {
    document.getElementById('prescRasi').value = document.getElementById(`p-rasi-${timestamp}`).innerText;
    document.getElementById('prescUdhaya').value = document.getElementById(`p-udhaya-${timestamp}`).innerText;
    document.getElementById('prescBody').value = document.getElementById(`p-notes-${timestamp}`).innerText;
};


// --- HISTORY EDIT & DELETE LOGIC ---
window.editHist = (clientId, timestamp) => {
    const probEl = document.getElementById(`prob-text-${timestamp}`);
    const solEl = document.getElementById(`sol-text-${timestamp}`);
    const probText = probEl.innerText;
    const solText = solEl.innerText;

    probEl.innerHTML = `<textarea id="edit-prob-${timestamp}" rows="3" style="width: 100%; margin-top: 5px; padding: 8px; border-radius: 4px; border: 1px solid #ccc; font-family: inherit;">${probText === '-' ? '' : probText}</textarea>`;
    solEl.innerHTML = `<textarea id="edit-sol-${timestamp}" rows="4" style="width: 100%; margin-top: 5px; padding: 8px; border-radius: 4px; border: 1px solid #ccc; font-family: inherit;">${solText === '-' ? '' : solText}</textarea>`;
    
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
    }
};

window.deleteHist = async (clientId, timestamp) => {
    Swal.fire({ title: 'Delete consultation?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Yes' }).then(async (result) => {
        if (result.isConfirmed) {
            const client = await db.clients.get(clientId);
            client.consultations = client.consultations.filter(c => c.timestamp !== timestamp);
            await db.clients.put(client);
            loadClient(clientId);
        }
    });
};

window.deletePrescHist = async (clientId, timestamp) => {
    Swal.fire({ title: 'Delete prescription?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Yes' }).then(async (result) => {
        if (result.isConfirmed) {
            const client = await db.clients.get(clientId);
            client.prescriptions = client.prescriptions.filter(c => c.timestamp !== timestamp);
            await db.clients.put(client);
            loadPrescription(clientId);
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
        const noHistory = !hasConsults && !hasPresc; // Purely basic details

        // 1. Show Client Profile Card
        if (hasConsults || noHistory || client.dob) {
            html += `
            <div class="client-item" onclick="loadClient(${client.id})">
                <div class="client-info">
                    <h4>${client.name} <span style="background: #e3f2fd; color: #1976D2; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-left: 5px; vertical-align: middle;">Client</span></h4>
                    <p>${client.star || ''} ${client.location ? '• ' + client.location : ''}</p>
                </div>
                <div class="actions"><button class="btn-view">View</button></div>
            </div>`;
        }

        // 2. Show Prescription Profile Card
        if (hasPresc) {
            html += `
            <div class="client-item" style="border-left: 4px solid #FF9800;" onclick="loadPrescription(${client.id})">
                <div class="client-info">
                    <h4>${client.name} <span style="background: #FFF3E0; color: #E65100; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-left: 5px; vertical-align: middle;">Prescription</span></h4>
                    <p>${client.star || ''} ${client.location ? '• ' + client.location : ''}</p>
                </div>
                <div class="actions"><button class="btn-view" style="background: #FFF3E0; color: #E65100;">View</button></div>
            </div>`;
        }
    });

    document.getElementById('clientList').innerHTML = html;
}

// --- GENERATE PRESCRIPTION PDF ---
window.generatePrescriptionPDF = async () => {
    const name = document.getElementById('prescName').value || "";
    const star = document.getElementById('prescStar').value || "";
    const place = document.getElementById('prescPlace').value || "";
    const rasi = document.getElementById('prescRasi').value || "";
    const udhaya = document.getElementById('prescUdhaya').value || "";
    const body = document.getElementById('prescBody').value || "";

    if(!name && !body) { Swal.fire('Error', 'Form is empty!', 'error'); return; }

    document.getElementById('pdfPrescName').innerText = name;
    document.getElementById('pdfPrescDate').innerText = new Date().toLocaleDateString('en-IN');
    document.getElementById('pdfPrescStar').innerText = star;
    document.getElementById('pdfPrescPlace').innerText = place;
    document.getElementById('pdfPrescRasi').innerText = rasi;
    document.getElementById('pdfPrescUdhaya').innerText = udhaya;
    document.getElementById('pdfPrescBody').innerText = body;

    Swal.fire({ title: 'Generating...', didOpen: () => Swal.showLoading() });
    try {
        const { jsPDF } = window.jspdf;
        const element = document.getElementById('prescriptionTemplate');
        const canvas = await html2canvas(element, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const width = pdf.internal.pageSize.getWidth();
        const height = (canvas.height * width) / canvas.width;
        
        pdf.addImage(imgData, 'PNG', 0, 0, width, height);
        pdf.save(`${name}_Prescription.pdf`);
        Swal.fire({ title: 'Downloaded!', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch(e) { console.error(e); }
};

// --- GENERATE CLIENT MAIN PDF ---
window.generatePDF = async () => {
    const name = document.getElementById('name').value;
    const star = document.getElementById('star').value;
    const dob = document.getElementById('dob').value;
    const time = document.getElementById('birthTime').value;

    let displayTime = time;
    if(time) {
        const [h, m] = time.split(':');
        const hour = parseInt(h);
        displayTime = `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
    }

    let htmlContent = `
        <table style="width: 100%; margin-bottom: 20px; font-size: 14px;">
            <tr><td><strong>Name:</strong> ${name}</td><td><strong>Star:</strong> ${star}</td></tr>
            <tr><td><strong>DOB:</strong> ${dob}</td><td><strong>Time:</strong> ${displayTime}</td></tr>
        </table>
        <h3>Consultation History</h3>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #ddd;">
            <tr style="background-color: #f2f2f2;">
                <th style="border: 1px solid #ddd; padding: 8px;">Date</th>
                <th style="border: 1px solid #ddd; padding: 8px;">Details</th>
            </tr>`;

    const id = document.getElementById('clientId').value;
    if(id) {
        const client = await db.clients.get(parseInt(id));
        if(client && client.consultations) {
            client.consultations.forEach(c => {
                htmlContent += `
                    <tr>
                        <td style="border: 1px solid #ddd; padding: 8px; width: 25%; vertical-align: top;">${c.date}</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">
                            <strong>Problem:</strong><br>${c.problem || '-'}<br><br>
                            <strong style="color: #2E7D32;">Solution:</strong><br>${c.solution || '-'}
                        </td>
                    </tr>`;
            });
        }
    }
    htmlContent += `</table>`;
    document.getElementById('pdfContent').innerHTML = htmlContent;

    Swal.fire({ title: 'Generating PDF...', didOpen: () => Swal.showLoading() });
    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const width = pdf.internal.pageSize.getWidth();

        const element1 = document.getElementById('pdfTemplate');
        const canvas1 = await html2canvas(element1, { scale: 2 });
        const imgData1 = canvas1.toDataURL('image/png');
        const height1 = (canvas1.height * width) / canvas1.width;
        pdf.addImage(imgData1, 'PNG', 0, 0, width, height1);

        pdf.save(`${name}_Full_Report.pdf`);
        Swal.fire({ title: 'Downloaded!', icon: 'success', timer: 1500, showConfirmButton: false });

    } catch (error) { Swal.fire({ title: 'Error', text: 'PDF Failed', icon: 'error' }); }
};


// Listeners & Utilities
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

// Delete Entire Client
async function deleteCurrentClient() {
    const id = document.getElementById('clientId').value;
    if (!id) return;
    Swal.fire({ title: 'Delete Entire Client?', text: "This deletes all their info, consults, AND prescriptions!", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Yes' }).then(async (result) => {
        if (result.isConfirmed) { await db.clients.delete(parseInt(id)); closeForm(); await updateList(); }
    });
}
async function deleteCurrentPrescClient() {
    const id = document.getElementById('prescClientId').value;
    if (!id) return;
    Swal.fire({ title: 'Delete Entire Client?', text: "This deletes all their info, consults, AND prescriptions!", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Yes' }).then(async (result) => {
        if (result.isConfirmed) { await db.clients.delete(parseInt(id)); closePrescriptionForm(); await updateList(); }
    });
}

// Transfer to Prescription
function transferToPrescription() {
    const id = document.getElementById('clientId').value; // Get ID to link them!
    const name = document.getElementById('name').value;
    const star = document.getElementById('star').value;
    const place = document.getElementById('place').value;
    const solution = document.getElementById('currentSolution').value;

    if (!name) { Swal.fire('Error', 'Please enter a Name first', 'warning'); return; }

    showPrescriptionForm();
    document.getElementById('prescClientId').value = id; // Link DB entry
    document.getElementById('prescName').value = name;
    document.getElementById('prescStar').value = star;
    document.getElementById('prescPlace').value = place;
    document.getElementById('prescBody').value = solution;
}