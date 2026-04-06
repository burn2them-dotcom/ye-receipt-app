import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, serverTimestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

// DOM Elements
const inputForm = document.getElementById('input-form');
const submitActions = document.getElementById('submit-actions');
const btnAnalyze = document.getElementById('btn-analyze');
const loadingIndicator = document.getElementById('loading-indicator');
const tableBody = document.getElementById('table-body');
const firebaseWarning = document.getElementById('firebase-warning');
const firebaseWarningMsg = document.getElementById('firebase-warning-msg');
const errorBanner = document.getElementById('error-banner');
const errorMessage = document.getElementById('error-message');

// Form Inputs
const receiptImageInput = document.getElementById('receipt-image');
const receiptTextInput = document.getElementById('receipt-text');
const bankImageInput = document.getElementById('bank-image');
const bankTextInput = document.getElementById('bank-text');

// Edit Modal Elements
const editModal = document.getElementById('edit-modal');
const editForm = document.getElementById('edit-form');
const btnCancel = document.getElementById('btn-cancel');

// Firebase Initialization
let app, db, storage;
let isFirebaseConnected = false;
let localData = [];

try {
    if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        storage = getStorage(app);
        isFirebaseConnected = true;
        firebaseWarning.style.display = "none";
        document.querySelector('.status-text').textContent = '실시간 연동 중';
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
    firebaseWarningMsg.innerHTML = `Firebase 연결 에러: ${error.message}`;
}

function showError(msg) {
    errorMessage.textContent = msg;
    errorBanner.classList.remove('hidden');
    console.error("App Error:", msg);
}

function convertToBase64(file) {
    if(!file) return null;
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });
}

// ==========================================
// Process & Submit Action
// ==========================================
btnAnalyze.addEventListener('click', async () => {
    // 1. Gather Inputs
    const receiptFile = receiptImageInput.files[0];
    const receiptText = receiptTextInput.value.trim();
    const bankFile = bankImageInput.files[0];
    const bankText = bankTextInput.value.trim();

    if (!receiptFile && !receiptText && !bankFile && !bankText) {
         showError("최소한 하나의 영수증 또는 계좌 정보를 입력해주세요 (사진 또는 텍스트).");
         return;
    }

    // Hide errors, show loading
    errorBanner.classList.add('hidden');
    inputForm.style.display = 'none';
    submitActions.style.display = 'none';
    loadingIndicator.classList.remove('hidden');

    try {
        let receiptAttachmentUrl = "";
        let bankAttachmentUrl = "";
        
        // 2. Upload to Firebase Storage
        if (isFirebaseConnected) {
            try {
                if (receiptFile) {
                    const rRef = ref(storage, `receipts/receipt_${Date.now()}_${receiptFile.name}`);
                    await uploadBytes(rRef, receiptFile);
                    receiptAttachmentUrl = await getDownloadURL(rRef);
                }
                if (bankFile) {
                    const bRef = ref(storage, `receipts/bank_${Date.now()}_${bankFile.name}`);
                    await uploadBytes(bRef, bankFile);
                    bankAttachmentUrl = await getDownloadURL(bRef);
                }
            } catch (storageErr) {
                throw new Error("사진 업로드 중 권한 거부 또는 네트워크 오류가 발생했습니다. Storage 규칙을 확인하세요. (" + storageErr.message + ")");
            }
        }

        // 3. Convert to Base64 for Gemini API
        const receiptBase64 = receiptFile ? await convertToBase64(receiptFile) : null;
        const bankBase64 = bankFile ? await convertToBase64(bankFile) : null;

        // 4. Send Multi-Modal Payload to Vercel API
        const payload = {
            receiptBase64,
            receiptText,
            bankBase64,
            bankText
        };

        const currentHost = window.location.hostname;
        if (currentHost === "localhost" || currentHost === "127.0.0.1" || currentHost === "") {
            console.warn("로컬 환경이므로 임의의 데이터 모형을 생성합니다 (실제 API는 Vercel에 올려야 작동합니다)");
        }

        let extractedData;
        try {
            const apiRes = await fetch('/api/extract-receipt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!apiRes.ok) {
                const errorData = await apiRes.json().catch(()=>({error: '알 수 없는 서버 응답'}));
                throw new Error(`API 통신 실패: ${errorData.error || apiRes.statusText}`);
            }

            extractedData = await apiRes.json();
            
        } catch (apiErr) {
            console.error("API Fetch Error:", apiErr);
            throw new Error(`/api/extract-receipt 통신 중 오류가 발생했습니다. 환경변수 GEMINI_API_KEY가 등록되어 있는지 확인해주세요.\n[상세 내역: ${apiErr.message}]`);
        }

        // 5. Structure Firestore Document
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
            receiptAttachmentUrl: receiptAttachmentUrl,
            bankAttachmentUrl: bankAttachmentUrl,
            paid: false,
            createdAt: isFirebaseConnected ? serverTimestamp() : new Date().toISOString()
        };

        // 6. Save to Realtime Database
        if (isFirebaseConnected) {
            try {
                await addDoc(collection(db, "receipts"), docData);
            } catch (dbErr) {
                throw new Error("데이터베이스(Firestore) 등록 실패. 데이터베이스 권한(Rules)을 확인하세요. (" + dbErr.message + ")");
            }
        } else {
            docData.id = Date.now().toString();
            localData.push(docData);
            renderTable();
        }

        // Reset Inputs on Success
        receiptImageInput.value = '';
        receiptTextInput.value = '';
        bankImageInput.value = '';
        bankTextInput.value = '';

    } catch (err) {
        showError(err.message);
    } finally {
        // Unblock UI
        loadingIndicator.classList.add('hidden');
        inputForm.style.display = 'grid';
        submitActions.style.display = 'block';
    }
});

// ==========================================
// Data Binding & Table Rendering
// ==========================================

function setupFirebaseRealtime() {
    try {
        const q = query(collection(db, "receipts"), orderBy("createdAt", "desc"));
        onSnapshot(q, (snapshot) => {
            localData = [];
            snapshot.forEach((docSnap) => {
                localData.push({ id: docSnap.id, ...docSnap.data() });
            });
            renderTable();
        }, (err) => {
            showError("실시간 데이터베이스 읽기 권한이 없습니다. Firestore 규칙을 확인해주세요: " + err.message);
        });
    } catch(err) {
        showError("Firestore 쿼리 실행 에러: " + err.message);
    }
}

function renderTable() {
    tableBody.innerHTML = '';
    
    if (localData.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="14" style="text-align: center; color: #6b7280;">등록된 내역이 없습니다. 정보를 입력하고 등록해주세요.</td></tr>`;
        return;
    }

    localData.forEach(item => {
        const tr = document.createElement('tr');
        if (item.paid) tr.classList.add('paid');

        const formatMoney = (n) => new Intl.NumberFormat('ko-KR').format(n || 0);

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
            <td>${item.receiptAttachmentUrl ? `<a href="${item.receiptAttachmentUrl}" target="_blank" class="btn-download">영수증</a>` : '-'}</td>
            <td>${item.bankAttachmentUrl ? `<a href="${item.bankAttachmentUrl}" target="_blank" class="btn-download">계좌</a>` : '-'}</td>
            <td>
                <button class="btn secondary btn-edit" data-id="${item.id}">수정</button>
            </td>
            <td style="text-align:center;">
                <input type="checkbox" class="paid-checkbox" data-id="${item.id}" ${item.paid ? 'checked' : ''}>
            </td>
        `;

        tableBody.appendChild(tr);

        // Events
        const rowId = item.id;
        tr.querySelector('.btn-edit').addEventListener('click', () => openEditModal(rowId));
        tr.addEventListener('dblclick', (e) => {
            if(e.target.type !== 'checkbox' && !e.target.classList.contains('btn-edit') && e.target.tagName !== 'A') {
                openEditModal(rowId);
            }
        });

        tr.querySelector('.paid-checkbox').addEventListener('change', async (e) => {
            const isChecked = e.target.checked;
            if (isFirebaseConnected) {
                try {
                    const docRef = doc(db, "receipts", rowId);
                    await updateDoc(docRef, { paid: isChecked });
                } catch(dbErr) {
                    showError("지급 상태 변경 실패: " + dbErr.message);
                    e.target.checked = !isChecked; // revert
                }
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
        try {
            const docRef = doc(db, "receipts", id);
            await updateDoc(docRef, updatedData);
        } catch(dbErr) {
            showError("수정 사항 저장 실패: " + dbErr.message);
        }
    } else {
        const idx = localData.findIndex(x => x.id === id);
        if(idx > -1) {
            localData[idx] = { ...localData[idx], ...updatedData };
        }
        renderTable();
    }

    editModal.classList.add('hidden');
});
