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

// --- TOASTS (fallback if Swal fails) ---
let topToast, warnToast;
if (typeof Swal !== 'undefined') {
    topToast = Swal.mixin({
        toast: true,
        position: 'top',
        showConfirmButton: false,
        timer: 2500,
        background: '#1DA1F2',
        color: '#fff',
        customClass: { popup: 'x-toast' }
    });
    warnToast = Swal.mixin({
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
} else {
    console.error('SweetAlert2 not loaded. Using alert fallback.');
    topToast = { fire: (opts) => alert(opts.text) };
    warnToast = { fire: (opts) => confirm(opts.text) };
}

// --- TEXTAREA UNDO / CLEAR ---
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

// --- DATABASE ---
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

// --- LOAD CLIENT DETAILS (unchanged but included for completeness) ---
// ... (rest of loadClient, loadPrescription, edit/delete functions are identical to your original, omitted here for brevity)
// Note: I'm omitting them to keep this answer focused, but you should keep your existing code for those functions.

// --- LETTERHEAD SELECTION (with debugging) ---
function askLetterheadChoice() {
    console.log('askLetterheadChoice called');
    if (typeof Swal === 'undefined') {
        console.warn('Swal not defined, using confirm fallback');
        const choice = confirm('Choose letterhead:\nOK = CK Saji Panicker\nCancel = Pratnya (Logo)');
        if (choice) return Promise.resolve('ck');
        else return Promise.resolve('pratnya');
    }
    
    return Swal.fire({
        title: 'Select Letterhead',
        text: 'Choose the header style for the PDF',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'CK Saji Panicker',
        cancelButtonText: 'Pratnya (Logo)',
        reverseButtons: true,
        focusConfirm: false,
        focusCancel: false,
        allowOutsideClick: false
    }).then((result) => {
        console.log('Swal result:', result);
        if (result.isConfirmed) {
            return 'ck';
        } else if (result.dismiss === Swal.DismissReason.cancel) {
            return 'pratnya';
        }
        return null;
    });
}

function applyPratnyaHeader(templateElement) {
    const header = templateElement.querySelector('.letterhead-header');
    if (!header) return () => {};
    const originalHTML = header.innerHTML;
    header.innerHTML = `
        <div style="text-align: center; width: 100%; padding: 10px 0;">
            <img src="logo.png" alt="Pratnya Astro" style="height: 80px; width: auto;">
        </div>
    `;
    header.style.borderBottom = '2px solid #2E7D32';
    header.style.paddingBottom = '10px';
    return () => {
        header.innerHTML = originalHTML;
        header.style.borderBottom = '';
        header.style.paddingBottom = '';
    };
}

// --- PRESCRIPTION PDF (with choice) ---
function fillPrescriptionTemplate() {
    const name = document.getElementById('prescName').value || "";
    const star = document.getElementById('prescStar').value || "";
    const place = document.getElementById('prescPlace').value || "";
    const rasi = document.getElementById('prescRasi').value || "";
    const udhaya = document.getElementById('prescUdhaya').value || "";
    const body = document.getElementById('prescBody').value || "";

    if(!name && !body) return false;

    document.getElementById('pdfPrescName').innerText = name;
    document.getElementById('pdfPrescDate').innerText = new Date().toLocaleDateString('en-IN');
    document.getElementById('pdfPrescStar').innerText = star;
    document.getElementById('pdfPrescPlace').innerText = place;
    document.getElementById('pdfPrescRasi').innerText = rasi;
    document.getElementById('pdfPrescUdhaya').innerText = udhaya;
    document.getElementById('pdfPrescBody').innerText = body;
    return true;
}

window.generatePrescriptionPDF = async () => {
    console.log('generatePrescriptionPDF clicked');
    if (!fillPrescriptionTemplate()) {
        topToast.fire({ text: 'Form is empty!', background: '#E0245E' });
        return;
    }

    const choice = await askLetterheadChoice();
    console.log('Choice received:', choice);
    if (!choice) return;

    const template = document.getElementById('prescriptionTemplate');
    let restoreHeader = () => {};
    if (choice === 'pratnya') {
        restoreHeader = applyPratnyaHeader(template);
    }

    const name = document.getElementById('prescName').value || "Client";
    topToast.fire({ text: 'Generating PDF...' });

    try {
        const { jsPDF } = window.jspdf;
        const canvas = await html2canvas(template, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const width = pdf.internal.pageSize.getWidth();
        const height = (canvas.height * width) / canvas.width;
        
        pdf.addImage(imgData, 'PNG', 0, 0, width, height);
        pdf.save(`${name}_Prescription.pdf`);
        topToast.fire({ text: 'Downloaded successfully!' });
    } catch(e) {
        console.error(e);
        topToast.fire({ text: 'PDF generation failed', background: '#E0245E' });
    } finally {
        restoreHeader();
    }
};

// --- SHARE WA (with choice) ---
window.sharePrescriptionPDF = async () => {
    console.log('sharePrescriptionPDF clicked');
    if (!fillPrescriptionTemplate()) {
        topToast.fire({ text: 'Form is empty!', background: '#E0245E' });
        return;
    }

    const choice = await askLetterheadChoice();
    console.log('Choice received:', choice);
    if (!choice) return;

    const template = document.getElementById('prescriptionTemplate');
    let restoreHeader = () => {};
    if (choice === 'pratnya') {
        restoreHeader = applyPratnyaHeader(template);
    }

    const name = document.getElementById('prescName').value || "Client";
    topToast.fire({ text: 'Preparing file for sharing...' });

    try {
        const { jsPDF } = window.jspdf;
        const canvas = await html2canvas(template, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const width = pdf.internal.pageSize.getWidth();
        const height = (canvas.height * width) / canvas.width;
        
        pdf.addImage(imgData, 'PNG', 0, 0, width, height);
        
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
    } finally {
        restoreHeader();
    }
};

// --- CLIENT CONSULTATION PDF (with choice) ---
window.generatePDF = async () => {
    console.log('generatePDF (client) clicked');
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

    const choice = await askLetterheadChoice();
    console.log('Choice received:', choice);
    if (!choice) return;

    const template = document.getElementById('pdfTemplate');
    let restoreHeader = () => {};
    if (choice === 'pratnya') {
        restoreHeader = applyPratnyaHeader(template);
    }

    topToast.fire({ text: 'Generating PDF...' });

    try {
        const { jsPDF } = window.jspdf;
        const canvas = await html2canvas(template, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const width = pdf.internal.pageSize.getWidth();
        const height = (canvas.height * width) / canvas.width;
        
        pdf.addImage(imgData, 'PNG', 0, 0, width, height);
        pdf.save(`${name}_Full_Report.pdf`);
        topToast.fire({ text: 'Downloaded successfully!' });
    } catch (error) {
        console.error(error);
        topToast.fire({ text: 'PDF Failed', background: '#E0245E' });
    } finally {
        restoreHeader();
    }
};

// --- SEARCH & MISC (unchanged) ---
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