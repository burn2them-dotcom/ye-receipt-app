import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, serverTimestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

// DOM Elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const loadingIndicator = document.getElementById('loading-indicator');
const tableBody = document.getElementById('table-body');
const firebaseWarning = document.getElementById('firebase-warning');

// Edit Modal Elements
const editModal = document.getElementById('edit-modal');
const editForm = document.getElementById('edit-form');
const btnCancel = document.getElementById('btn-cancel');

// Firebase Initialization
let app, db, storage;
let isFirebaseConnected = false;

// Mock local data if Firebase isn't set up yet
let localData = [];

try {
    if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        storage = getStorage(app);
        isFirebaseConnected = true;
        firebaseWarning.style.display = "none";
        document.querySelector('.status-text').textContent = '실시간 연동 됨';
        setupFirebaseRealtime();
    } else {
        firebaseWarning.style.display = "block";
        document.querySelector('.status-text').textContent = '오프라인 모드';
        document.querySelector('.status-dot').style.backgroundColor = '#ef4444';
        renderTable();
    }
} catch (error) {
    console.error("Firebase init error", error);
    firebaseWarning.style.display = "block";
    firebaseWarning.innerHTML = `<h3>⚠️ Firebase 연결 오픈 에러</h3><p>${error.message}</p>`;
}

// ==========================================
// File Upload & OCR Extraction
// ==========================================

// Drag & Drop
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFile(e.dataTransfer.files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
        handleFile(e.target.files[0]);
    }
});

async function handleFile(file) {
    if (!file.type.startsWith('image/')) {
        alert('이미지 파일만 업로드 가능합니다.');
        return;
    }

    loadingIndicator.classList.remove('hidden');
    dropZone.style.display = 'none';

    try {
        let attachmentUrl = "";
        
        // 1. Upload exactly to Firebase Storage if connected
        if (isFirebaseConnected) {
            const fileName = `receipts/${Date.now()}_${file.name}`;
            const storageRef = ref(storage, fileName);
            await uploadBytes(storageRef, file);
            attachmentUrl = await getDownloadURL(storageRef);
        }

        // 2. Convert file to Base64 to send to Vercel API for Gemini OCR
        const base64Image = await convertToBase64(file);

        // 3. Request API (simulated or real depending on deployment)
        // If API fails locally, we provide mock generated data
        let extractedData;
        try {
            const apiRes = await fetch('/api/extract-receipt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageBase64: base64Image })
            });
            if (apiRes.ok) {
                extractedData = await apiRes.json();
            } else {
                throw new Error("API call failed");
            }
        } catch (apiErr) {
            console.warn("API Call Failed, using fallback mock data. If deployed, make sure /api/extract-receipt exists.", apiErr);
            extractedData = {
                date: new Date().toISOString().split('T')[0],
                company: "테스트가게",
                details: "테스트 물품 외 1건",
                supplyValue: 10000,
                tax: 1000,
                totalAmount: 11000,
                bankName: "국민은행",
                accountNumber: "123-456-7890",
                accountOwner: "홍길동"
            };
        }

        // 4. Transform data structure
        const docData = {
            docId: `DOC-${Math.floor(Math.random() * 10000)}`,
            date: extractedData.date || "",
            company: extractedData.company || "",
            details: extractedData.details || "",
            supplyValue: Number(extractedData.supplyValue) || 0,
            tax: Number(extractedData.tax) || 0,
            totalAmount: Number(extractedData.totalAmount) || 0,
            bankName: extractedData.bankName || "",
            accountNumber: extractedData.accountNumber || "",
            accountOwner: extractedData.accountOwner || "",
            attachmentUrl: attachmentUrl,
            paid: false,
            createdAt: isFirebaseConnected ? serverTimestamp() : new Date().toISOString()
        };

        // 5. Save to Firestore
        if (isFirebaseConnected) {
            await addDoc(collection(db, "receipts"), docData);
        } else {
            // Local mockup
            docData.id = Date.now().toString();
            localData.push(docData);
            renderTable();
        }

    } catch (err) {
        console.error(err);
        alert('처리 중 에러가 발생했습니다: ' + err.message);
    } finally {
        loadingIndicator.classList.add('hidden');
        dropZone.style.display = 'block';
        fileInput.value = '';
    }
}

function convertToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });
}

// ==========================================
// Data Binding & Table Rendering
// ==========================================

function setupFirebaseRealtime() {
    const q = query(collection(db, "receipts"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        localData = [];
        snapshot.forEach((docSnap) => {
            localData.push({ id: docSnap.id, ...docSnap.data() });
        });
        renderTable();
    });
}

function renderTable() {
    tableBody.innerHTML = '';
    
    if (localData.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="13" style="text-align: center; color: #6b7280;">등록된 내역이 없습니다. 사진을 업로드해 주세요.</td></tr>`;
        return;
    }

    localData.forEach(item => {
        const tr = document.createElement('tr');
        if (item.paid) tr.classList.add('paid');

        // Number Formatting
        const formatMoney = (n) => new Intl.NumberFormat('ko-KR').format(n);

        tr.innerHTML = `
            <td>${item.docId || '-'}</td>
            <td>${item.date || '-'}</td>
            <td>${item.company || '-'}</td>
            <td>${item.details || '-'}</td>
            <td>${formatMoney(item.supplyValue)}</td>
            <td>${formatMoney(item.tax)}</td>
            <td><strong>${formatMoney(item.totalAmount)}</strong></td>
            <td>${item.bankName || '-'}</td>
            <td>${item.accountNumber || '-'}</td>
            <td>${item.accountOwner || '-'}</td>
            <td>
                ${item.attachmentUrl ? `<a href="${item.attachmentUrl}" target="_blank" class="btn-download">다운로드</a>` : '-'}
            </td>
            <td>
                <button class="btn secondary btn-edit" data-id="${item.id}">수정</button>
            </td>
            <td style="text-align:center;">
                <input type="checkbox" class="paid-checkbox" data-id="${item.id}" ${item.paid ? 'checked' : ''}>
            </td>
        `;

        tableBody.appendChild(tr);

        // Events for this row
        const rowId = item.id;
        
        // Edit Button (Or double click on row)
        tr.querySelector('.btn-edit').addEventListener('click', () => openEditModal(rowId));
        tr.addEventListener('dblclick', (e) => {
            if(e.target.type !== 'checkbox' && !e.target.classList.contains('btn-edit')) {
                openEditModal(rowId);
            }
        });

        // Paid Checkbox logic
        tr.querySelector('.paid-checkbox').addEventListener('change', async (e) => {
            const isChecked = e.target.checked;
            if (isFirebaseConnected) {
                const docRef = doc(db, "receipts", rowId);
                await updateDoc(docRef, { paid: isChecked });
            } else {
                const idx = localData.findIndex(x => x.id == rowId);
                if(idx > -1) localData[idx].paid = isChecked;
                renderTable();
            }
        });
    });
}

// ==========================================
// Edit Modal Logic
// ==========================================

function openEditModal(id) {
    const item = localData.find(x => x.id === id);
    if (!item) return;

    document.getElementById('edit-id').value = item.id;
    document.getElementById('edit-date').value = item.date || '';
    document.getElementById('edit-company').value = item.company || '';
    document.getElementById('edit-details').value = item.details || '';
    document.getElementById('edit-supply').value = item.supplyValue || 0;
    document.getElementById('edit-tax').value = item.tax || 0;
    document.getElementById('edit-total').value = item.totalAmount || 0;
    document.getElementById('edit-bank').value = item.bankName || '';
    document.getElementById('edit-account').value = item.accountNumber || '';
    document.getElementById('edit-owner').value = item.accountOwner || '';

    editModal.classList.remove('hidden');
}

btnCancel.addEventListener('click', () => {
    editModal.classList.add('hidden');
});

editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('edit-id').value;
    const updatedData = {
        date: document.getElementById('edit-date').value,
        company: document.getElementById('edit-company').value,
        details: document.getElementById('edit-details').value,
        supplyValue: Number(document.getElementById('edit-supply').value),
        tax: Number(document.getElementById('edit-tax').value),
        totalAmount: Number(document.getElementById('edit-total').value),
        bankName: document.getElementById('edit-bank').value,
        accountNumber: document.getElementById('edit-account').value,
        accountOwner: document.getElementById('edit-owner').value,
    };

    if (isFirebaseConnected) {
        const docRef = doc(db, "receipts", id);
        await updateDoc(docRef, updatedData);
    } else {
        const idx = localData.findIndex(x => x.id === id);
        if(idx > -1) {
            localData[idx] = { ...localData[idx], ...updatedData };
        }
        renderTable();
    }

    editModal.classList.add('hidden');
});
