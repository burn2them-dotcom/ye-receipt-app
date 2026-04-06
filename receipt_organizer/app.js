// State to hold the processed data
let tableData = [];
let currentId = 1;

// Mock extraction data based on document types
const mockReceipts = [
    { date: '2026-04-01', vendor: '스타벅스 강남점', desc: '아메리카노 외 2잔', supply: 13636, tax: 1364, bank: '', acc: '', holder: '', note: '' },
    { date: '2026-04-02', vendor: '쿠팡(주)', desc: '사무용품 세트', supply: 45000, tax: 4500, bank: '', acc: '', holder: '', note: '빠른 배송' },
    { date: '2026-04-03', vendor: '알파문구', desc: 'A4 용지 2박스', supply: 30000, tax: 3000, bank: '', acc: '', holder: '', note: '' }
];

const mockBankBooks = [
    { date: '2026-03-25', vendor: '프리랜서 용역비', desc: '디자인 외주', supply: 1000000, tax: 100000, bank: '신한은행', acc: '110-123-456789', holder: '김디자인', note: '계좌 사본 확인됨' },
    { date: '2026-03-30', vendor: '월세', desc: '4월분 임대료', supply: 500000, tax: 0, bank: '국민은행', acc: '0000-00-0000', holder: '이건물', note: '부가세 없음' }
];

// Formatting utility
function formatCurrency(num) {
    if(!num) return '0';
    return Number(num).toLocaleString('ko-KR');
}

// DOM Elements
const uploadArea = document.getElementById('upload-area');
const fileInput = document.getElementById('file-input');
const overlay = document.getElementById('processing-overlay');
const tableBody = document.getElementById('table-body');
const dataCount = document.getElementById('data-count');
const editModal = document.getElementById('edit-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const saveEditBtn = document.getElementById('save-edit-btn');
const editForm = document.getElementById('edit-form');
const cameraReceiptBtn = document.getElementById('camera-receipt-btn');
const cameraBankBtn = document.getElementById('camera-bank-btn');
const cameraInput = document.getElementById('camera-input');
const rawTextInput = document.getElementById('raw-text-input');
const submitTextBtn = document.getElementById('submit-text-btn');
const globalBankInput = document.getElementById('global-bank');
const globalAccInput = document.getElementById('global-acc');
const globalHolderInput = document.getElementById('global-holder');

// Frontend is now using Serverless Backend

// File Upload Handlers
uploadArea.addEventListener('click', () => fileInput.click());

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    uploadArea.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
    uploadArea.addEventListener(eventName, () => uploadArea.classList.add('dragover'), false);
});

['dragleave', 'drop'].forEach(eventName => {
    uploadArea.addEventListener(eventName, () => uploadArea.classList.remove('dragover'), false);
});

uploadArea.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
});

fileInput.addEventListener('change', function() {
    handleFiles(this.files);
});

// Mobile Camera Handlers
cameraReceiptBtn.addEventListener('click', () => cameraInput.click());
cameraBankBtn.addEventListener('click', () => cameraInput.click());

// Text Input Handler
submitTextBtn.addEventListener('click', async () => {
    const text = rawTextInput.value.trim();
    if (!text) {
        alert('분석할 텍스트를 입력해주세요.');
        return;
    }
    
    overlay.style.display = 'flex';
    try {
        await processWithGeminiText(text);
        rawTextInput.value = '';
    } catch (error) {
        alert("오류가 발생했습니다: " + error.message);
    } finally {
        overlay.style.display = 'none';
    }
});

cameraInput.addEventListener('change', function() {
    handleFiles(this.files);
});

async function handleFiles(files) {
    if (files.length === 0) return;
    
    // Show Loading
    overlay.style.display = 'flex';

    try {
        for (let i = 0; i < files.length; i++) {
            await processWithGemini(files[i]);
        }
    } catch (error) {
        alert("오류가 발생했습니다: " + error.message);
    } finally {
        overlay.style.display = 'none';
        // Reset file input
        fileInput.value = '';
    }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const base64Data = reader.result.split(',')[1];
            resolve({ mimeType: file.type || "image/jpeg", data: base64Data });
        };
        reader.onerror = error => reject(error);
    });
}

async function processWithGemini(file) {
    const base64Image = await fileToBase64(file);
    
    const response = await fetch('/api/process-receipt', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            mimeType: base64Image.mimeType,
            data: base64Image.data
        })
    });
    
    if (!response.ok) {
        let errMsg = "서버 통신 오류";
        try {
            const err = await response.json();
            errMsg = err.error || errMsg;
        } catch (e) {}
        throw new Error(errMsg);
    }
    
    const data = await response.json();
    const textContent = data.result;
    
    // Parse the JSON array
    const results = JSON.parse(textContent);
    
    const uBank = globalBankInput.value.trim();
    const uAcc = globalAccInput.value.trim();
    const uHolder = globalHolderInput.value.trim();

    results.forEach(res => {
        tableData.push({
            id: currentId++,
            date: res.date || "",
            vendor: res.vendor || "",
            desc: res.desc || "",
            supply: Number(res.supply) || 0,
            tax: Number(res.tax) || 0,
            bank: uBank || res.bank || "",
            acc: uAcc || res.acc || "",
            holder: uHolder || res.holder || "",
            note: res.note || "",
            completed: false
        });
    });
    renderTable();
}

async function processWithGeminiText(rawText) {
    const response = await fetch('/api/process-receipt', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: rawText })
    });
    
    if (!response.ok) {
        let errMsg = "서버 통신 오류";
        try {
            const err = await response.json();
            errMsg = err.error || errMsg;
        } catch (e) {}
        throw new Error(errMsg);
    }
    
    const data = await response.json();
    const textContent = data.result;
    
    // Parse the JSON array
    const results = JSON.parse(textContent);
    
    const uBank = globalBankInput.value.trim();
    const uAcc = globalAccInput.value.trim();
    const uHolder = globalHolderInput.value.trim();

    results.forEach(res => {
        tableData.push({
            id: currentId++,
            date: res.date || "",
            vendor: res.vendor || "",
            desc: res.desc || "",
            supply: Number(res.supply) || 0,
            tax: Number(res.tax) || 0,
            bank: uBank || res.bank || "",
            acc: uAcc || res.acc || "",
            holder: uHolder || res.holder || "",
            note: res.note || "",
            completed: false
        });
    });
    
    renderTable();
}

// Render Table
function renderTable() {
    tableBody.innerHTML = '';
    
    tableData.forEach((row) => {
        const tr = document.createElement('tr');
        if (row.completed) {
            tr.classList.add('completed');
        }
        
        const total = Number(row.supply) + Number(row.tax);

        tr.innerHTML = `
            <td>${row.id}</td>
            <td>${row.date}</td>
            <td>${row.vendor}</td>
            <td>${row.desc}</td>
            <td>${formatCurrency(row.supply)}</td>
            <td>${formatCurrency(row.tax)}</td>
            <td><strong>${formatCurrency(total)}</strong></td>
            <td>${row.bank}</td>
            <td>${row.acc}</td>
            <td>${row.holder}</td>
            <td>${row.note}</td>
            <td style="text-align: center;">
                <input type="checkbox" class="checkbox-custom" data-id="${row.id}" ${row.completed ? 'checked' : ''}>
            </td>
            <td>
                <button class="action-btn edit-btn" data-id="${row.id}">
                    <i class='bx bx-edit-alt'></i> 수정
                </button>
            </td>
        `;

        // Checkbox event
        const checkbox = tr.querySelector('.checkbox-custom');
        checkbox.addEventListener('change', function() {
            toggleCompleted(row.id, this.checked);
        });

        // Edit button event
        const editBtn = tr.querySelector('.edit-btn');
        editBtn.addEventListener('click', () => {
            openEditModal(row.id);
        });

        tableBody.appendChild(tr);
    });

    dataCount.innerText = tableData.length;
}

function toggleCompleted(id, isChecked) {
    const index = tableData.findIndex(item => item.id === id);
    if (index !== -1) {
        tableData[index].completed = isChecked;
        // Optimization: re-render only necessary but for simplicity we re-render full table
        renderTable(); 
    }
}

// Modal Handlers
function openEditModal(id) {
    const item = tableData.find(x => x.id === id);
    if (!item) return;

    document.getElementById('edit-id').value = item.id;
    document.getElementById('edit-date').value = item.date;
    document.getElementById('edit-vendor').value = item.vendor;
    document.getElementById('edit-description').value = item.desc;
    document.getElementById('edit-supply').value = item.supply;
    document.getElementById('edit-tax').value = item.tax;
    document.getElementById('edit-bank').value = item.bank;
    document.getElementById('edit-account').value = item.acc;
    document.getElementById('edit-holder').value = item.holder;
    document.getElementById('edit-note').value = item.note;

    editModal.style.display = 'flex';
}

function closeEditModal() {
    editModal.style.display = 'none';
}

[closeModalBtn, cancelEditBtn].forEach(btn => {
    btn.addEventListener('click', closeEditModal);
});

// Save Edit
saveEditBtn.addEventListener('click', () => {
    const id = parseInt(document.getElementById('edit-id').value);
    const index = tableData.findIndex(item => item.id === id);
    
    if (index !== -1) {
        // Update values
        tableData[index].date = document.getElementById('edit-date').value;
        tableData[index].vendor = document.getElementById('edit-vendor').value;
        tableData[index].desc = document.getElementById('edit-description').value;
        tableData[index].supply = Number(document.getElementById('edit-supply').value) || 0;
        tableData[index].tax = Number(document.getElementById('edit-tax').value) || 0;
        tableData[index].bank = document.getElementById('edit-bank').value;
        tableData[index].acc = document.getElementById('edit-account').value;
        tableData[index].holder = document.getElementById('edit-holder').value;
        tableData[index].note = document.getElementById('edit-note').value;
        
        renderTable();
        closeEditModal();
    } else {
        alert('데이터를 저장할 수 없습니다.');
    }
});

// Export to Excel (CSV)
document.getElementById('export-excel-btn').addEventListener('click', () => {
    if (tableData.length === 0) {
        alert('내보낼 데이터가 없습니다.');
        return;
    }
    
    // CSV Header (Add BOM for Excel KO)
    let csvContent = "\uFEFF순서,날짜,구매처,내용,공급가액,세액,합계액,은행명,계좌번호,예금주,비고,입금완료\n";
    
    tableData.forEach(row => {
        const total = Number(row.supply) + Number(row.tax);
        // Escape quotes
        const rowData = [
            row.id,
            `"${row.date}"`,
            `"${row.vendor}"`,
            `"${row.desc}"`,
            row.supply,
            row.tax,
            total,
            `"${row.bank}"`,
            `"${row.acc}"`,
            `"${row.holder}"`,
            `"${row.note}"`,
            row.completed ? "O" : "X"
        ];
        csvContent += rowData.join(',') + "\n";
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `영수증_정리_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
});

// Initial Render
renderTable();
