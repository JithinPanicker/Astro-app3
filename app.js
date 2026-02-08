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
const searchInput = document.getElementById('searchInput');

updateList();

// --- MODAL FUNCTIONS ---
function showForm() { modal.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
function closeForm() { 
    modal.classList.add('hidden'); document.body.style.overflow = 'auto'; 
    form.reset(); document.getElementById('clientId').value = ""; 
    document.getElementById('historyList').innerHTML = ""; 
}

function showPrescriptionForm() { prescModal.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
function closePrescriptionForm() { 
    prescModal.classList.add('hidden'); document.body.style.overflow = 'auto'; 
    document.getElementById('prescriptionForm').reset();
}

// --- SAVE CLIENT ---
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
        await db.clients.add({ ...basicData, consultations: history });
    }
    closeForm();
    await updateList();
    Swal.fire({ title: 'Saved!', icon: 'success', timer: 1000, showConfirmButton: false, width: '200px' });
};

// --- LOAD CLIENT ---
window.loadClient = async (id) => {
    const client = await db.clients.get(id);
    if(!client) return;
    document.getElementById('clientId').value = client.id;
    document.getElementById('name').value = client.name;
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
                <div class="history-item">
                    <span class="history-date">${item.date}</span>
                    <span class="history-label">Problem:</span><div class="history-text">${item.problem || '-'}</div>
                    <span class="history-label" style="color:#1976D2">Solution:</span><div class="history-text">${item.solution || '-'}</div>
                </div>`;
        });
    } else { listDiv.innerHTML = "<p style='color:#888; text-align:center;'>No previous consultations.</p>"; }
    showForm();
};

async function updateList() {
    const query = searchInput.value.toLowerCase();
    let clients = await db.clients.toArray();
    if (query) clients = clients.filter(c => c.name.toLowerCase().includes(query));
    clients.reverse();
    document.getElementById('clientList').innerHTML = clients.map(client => `
        <div class="client-item" onclick="loadClient(${client.id})">
            <div class="client-info"><h4>${client.name}</h4><p>${client.star || ''} ${client.location ? '• ' + client.location : ''}</p></div>
            <div class="actions"><button class="btn-view">View</button></div>
        </div>`).join('');
}

// --- 1. STANDALONE PRESCRIPTION PDF (Watermark Style) ---
window.generatePrescriptionPDF = async () => {
    const name = document.getElementById('prescName').value || "";
    const star = document.getElementById('prescStar').value || "";
    const place = document.getElementById('prescPlace').value || "";
    const rasi = document.getElementById('prescRasi').value || "";
    const ubhaya = document.getElementById('prescUbhaya').value || "";
    const body = document.getElementById('prescBody').value || "";

    // Fill Template
    document.getElementById('pdfPrescName').innerText = name;
    document.getElementById('pdfPrescDate').innerText = new Date().toLocaleDateString('en-IN');
    document.getElementById('pdfPrescStar').innerText = star;
    document.getElementById('pdfPrescPlace').innerText = place;
    document.getElementById('pdfPrescRasi').innerText = rasi;
    document.getElementById('pdfPrescUbhaya').innerText = ubhaya;
    document.getElementById('pdfPrescBody').innerText = body;

    await createAndDownloadPDF('prescriptionTemplate', `${name}_Prescription.pdf`);
};

// --- 2. MAIN CLIENT PDF (With Intelligent Page 2) ---
window.generatePDF = async () => {
    // A. Generate Page 1 (Standard Details)
    const name = document.getElementById('name').value;
    const star = document.getElementById('star').value;
    const dob = document.getElementById('dob').value;
    const time = document.getElementById('birthTime').value;
    const currentSolution = document.getElementById('currentSolution').value;

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

    // B. Start Generation
    Swal.fire({ title: 'Generating PDF...', didOpen: () => Swal.showLoading() });
    
    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const width = pdf.internal.pageSize.getWidth();

        // -- PAGE 1: CLIENT HISTORY --
        const element1 = document.getElementById('pdfTemplate');
        const canvas1 = await html2canvas(element1, { scale: 2 });
        const imgData1 = canvas1.toDataURL('image/png');
        const height1 = (canvas1.height * width) / canvas1.width;
        pdf.addImage(imgData1, 'PNG', 0, 0, width, height1);

        // -- PAGE 2: PRESCRIPTION (If Solution Exists) --
        if(currentSolution.trim()) {
            pdf.addPage(); // Add Page 2
            
            // Fill Prescription Template with Client Data + Solution
            document.getElementById('pdfPrescName').innerText = name;
            document.getElementById('pdfPrescDate').innerText = new Date().toLocaleDateString('en-IN');
            document.getElementById('pdfPrescStar').innerText = star;
            document.getElementById('pdfPrescPlace').innerText = document.getElementById('place').value;
            // Leave Rasi/Ubhaya blank for auto-gen, or add fields to main form if needed
            document.getElementById('pdfPrescRasi').innerText = ""; 
            document.getElementById('pdfPrescUbhaya').innerText = "";
            document.getElementById('pdfPrescBody').innerText = currentSolution;

            const element2 = document.getElementById('prescriptionTemplate');
            const canvas2 = await html2canvas(element2, { scale: 2 });
            const imgData2 = canvas2.toDataURL('image/png');
            const height2 = (canvas2.height * width) / canvas2.width;
            pdf.addImage(imgData2, 'PNG', 0, 0, width, height2);
        }

        pdf.save(`${name}_Full_Report.pdf`);
        Swal.fire({ title: 'Downloaded!', icon: 'success', timer: 1500, showConfirmButton: false });

    } catch (error) {
        console.error(error);
        Swal.fire({ title: 'Error', text: 'PDF Failed', icon: 'error' });
    }
};

// Helper for Standalone Prescription PDF
async function createAndDownloadPDF(templateId, filename) {
    Swal.fire({ title: 'Generating...', didOpen: () => Swal.showLoading() });
    try {
        const { jsPDF } = window.jspdf;
        const element = document.getElementById(templateId);
        const canvas = await html2canvas(element, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const width = pdf.internal.pageSize.getWidth();
        const height = (canvas.height * width) / canvas.width;
        
        pdf.addImage(imgData, 'PNG', 0, 0, width, height);
        pdf.save(filename);
        Swal.fire({ title: 'Downloaded!', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch(e) { console.error(e); }
}

// Listeners
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
    Swal.fire({ title: 'Delete?', text: "Cannot undo!", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Yes' }).then(async (result) => {
        if (result.isConfirmed) { await db.clients.delete(parseInt(id)); closeForm(); await updateList(); }
    });
}
// --- NEW FEATURE: TRANSFER TO PRESCRIPTION ---
function transferToPrescription() {
    // 1. Get data from the Main Form
    const name = document.getElementById('name').value;
    const star = document.getElementById('star').value;
    const place = document.getElementById('place').value;
    // Note: Rasi/Ubhaya are not in main form, so we leave them blank or you can add them
    const solution = document.getElementById('currentSolution').value;

    if (!name) {
        Swal.fire({ title: 'Error', text: 'Please enter a Name first', icon: 'warning', width: '250px' });
        return;
    }

    // 2. Open the Prescription Modal
    showPrescriptionForm();

    // 3. Fill the data automatically
    document.getElementById('prescName').value = name;
    document.getElementById('prescStar').value = star;
    document.getElementById('prescPlace').value = place;
    document.getElementById('prescBody').value = solution; // Copy the solution text!
}