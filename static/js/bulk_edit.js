// Global variables
let allRooms = [];
let modifiedRooms = new Set();

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', function() {
    loadRooms();
    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    // Select all rooms checkbox
    document.getElementById('selectAllRooms').addEventListener('change', function() {
        const checkboxes = document.querySelectorAll('.room-checkbox');
        checkboxes.forEach(cb => cb.checked = this.checked);
        updateSelectedCount();
    });
    
    // Bulk ARR checkbox
    document.getElementById('bulkArrCheck').addEventListener('change', function() {
        const isChecked = this.checked;
        const selectedRooms = getSelectedRooms();
        
        selectedRooms.forEach(roomId => {
            const arrCheckbox = document.getElementById(`arr-${roomId}`);
            if (arrCheckbox) {
                arrCheckbox.checked = isChecked;
                toggleArrFields(roomId, isChecked);
            }
        });
    });
    
    // Bulk status change
    document.getElementById('bulkStatus').addEventListener('change', function() {
        const selectedRooms = getSelectedRooms();
        const value = this.value;
        
        selectedRooms.forEach(roomId => {
            const statusSelect = document.getElementById(`status-${roomId}`);
            if (statusSelect) {
                statusSelect.value = value;
                handleStatusChange(roomId, value);
            }
        });
    });
}

// Load rooms from API
async function loadRooms() {
    showLoading('Đang tải dữ liệu phòng...');
    
    try {
        const response = await fetch('/api/rooms');
        const data = await response.json();
        
        if (data.success) {
            allRooms = data.data;
            displayRoomsTable(allRooms);
            updateTotalRoomsCount();
            hideLoading();
            showToast('Đã tải dữ liệu phòng thành công', 'success');
        } else {
            throw new Error(data.error || 'Không thể tải dữ liệu');
        }
    } catch (error) {
        console.error('Error loading rooms:', error);
        showToast('Không thể tải dữ liệu phòng: ' + error.message, 'danger');
        hideLoading();
    }
}

// Display rooms in table
function displayRoomsTable(rooms) {
    const tbody = document.getElementById('roomsTableBody');
    tbody.innerHTML = '';
    
    rooms.forEach(room => {
        const row = createRoomRow(room);
        tbody.innerHTML += row;
    });
    
    // Add event listeners to all rows
    rooms.forEach(room => {
        const roomNo = room.roomNo;
        
        // ARR checkbox
        const arrCheckbox = document.getElementById(`arr-${roomNo}`);
        if (arrCheckbox) {
            arrCheckbox.addEventListener('change', function() {
                toggleArrFields(roomNo, this.checked);
            });
        }
        
        // Room checkbox
        const roomCheckbox = document.getElementById(`room-${roomNo}`);
        if (roomCheckbox) {
            roomCheckbox.addEventListener('change', updateSelectedCount);
        }
        
        // Status select
        const statusSelect = document.getElementById(`status-${roomNo}`);
        if (statusSelect) {
            statusSelect.addEventListener('change', function() {
                handleStatusChange(roomNo, this.value);
            });
        }
        
        // New guest inputs
        ['new-name', 'new-checkin', 'new-checkout', 'new-pax'].forEach(field => {
            const input = document.getElementById(`${field}-${roomNo}`);
            if (input) {
                input.addEventListener('change', () => markRoomModified(roomNo));
                input.addEventListener('input', () => markRoomModified(roomNo));
            }
        });
    });
    
    updateSelectedCount();
    updateModifiedCount();
}

// Create room row HTML
function createRoomRow(room) {
    const roomNo = room.roomNo;
    const roomStatus = room.roomStatus || 'vd';
    
    // Current guest info (luôn giữ lại)
    const currentGuest = room.currentGuest || {};
    const newGuest = room.newGuest || {};
    
    // Check if has ARR (arrival)
    const hasArr = roomStatus.includes('/arr') || (newGuest && newGuest.name && newGuest.name.trim() !== '');
    
    // Parse room status (loại bỏ phần /arr nếu có)
    const baseStatus = roomStatus.replace('/arr', '');
    
    return `
        <tr id="row-${roomNo}" class="status-${baseStatus}">
            <td class="checkbox-cell">
                <input type="checkbox" class="form-check-input room-checkbox" id="room-${roomNo}">
            </td>
            <td class="room-number-cell">
                <span class="badge bg-dark">${roomNo}</span>
            </td>
            <td class="status-cell">
                <select class="form-select form-select-sm room-status" id="status-${roomNo}">
                    <option value="vd" ${baseStatus === 'vd' ? 'selected' : ''}>VD - Vacant Dirty</option>
                    <option value="vc" ${baseStatus === 'vc' ? 'selected' : ''}>VC - Vacant Clean</option>
                    <option value="od" ${baseStatus === 'od' ? 'selected' : ''}>OD - Occupied Dirty</option>
                    <option value="oc" ${baseStatus === 'oc' ? 'selected' : ''}>OC - Occupied Clean</option>
                    <option value="dnd" ${baseStatus === 'dnd' ? 'selected' : ''}>DND - Do Not Disturb</option>
                    <option value="nn" ${baseStatus === 'nn' ? 'selected' : ''}>NN - No Need</option>
                    <option value="lock" ${baseStatus === 'lock' ? 'selected' : ''}>LOCK - Khóa</option>
                    <option value="ip" ${baseStatus === 'ip' ? 'selected' : ''}>IP - Inspected</option>
                </select>
            </td>
            <td class="guest-cell" id="current-guest-${roomNo}">
                ${createGuestInfoHTML(currentGuest, 'hiện tại', baseStatus)}
            </td>
            <td class="arr-cell">
                <div class="form-check">
                    <input class="form-check-input arr-checkbox" type="checkbox" 
                           id="arr-${roomNo}" ${hasArr ? 'checked' : ''}>
                    <label class="form-check-label" for="arr-${roomNo}">
                        <span class="badge bg-warning text-dark">ARR</span>
                    </label>
                </div>
            </td>
            <td class="guest-cell">
                <div class="row g-1">
                    <div class="col-12">
                        <input type="text" class="form-control form-control-sm new-guest-input" 
                               id="new-name-${roomNo}" 
                               placeholder="Tên khách mới"
                               value="${newGuest.name || ''}"
                               ${hasArr ? '' : 'disabled'}>
                    </div>
                    <div class="col-6">
                        <input type="date" class="form-control form-control-sm new-guest-input" 
                               id="new-checkin-${roomNo}" 
                               value="${newGuest.checkIn || ''}"
                               ${hasArr ? '' : 'disabled'}>
                    </div>
                    <div class="col-6">
                        <input type="date" class="form-control form-control-sm new-guest-input" 
                               id="new-checkout-${roomNo}" 
                               value="${newGuest.checkOut || ''}"
                               ${hasArr ? '' : 'disabled'}>
                    </div>
                    <div class="col-12">
                        <input type="number" class="form-control form-control-sm new-guest-input" 
                               id="new-pax-${roomNo}" 
                               placeholder="Số khách"
                               min="1" max="10"
                               value="${newGuest.pax || ''}"
                               ${hasArr ? '' : 'disabled'}>
                    </div>
                </div>
            </td>
        </tr>
    `;
}

// Create guest info HTML
function createGuestInfoHTML(guest, type, roomStatus) {
    // Kiểm tra nếu phòng là Vacant (vd/vc) thì hiển thị "Trống" nhưng vẫn giữ thông tin khách
    if (roomStatus === 'vd' || roomStatus === 'vc') {
        return `<div class="guest-empty">Trống</div>`;
    }
    
    if (!guest || !guest.name || guest.name.trim() === '') {
        return `<div class="guest-empty">Trống</div>`;
    }
    
    return `
        <div class="small">
            <div><strong>${guest.name}</strong></div>
            <div>CI: ${guest.checkIn || '-'}</div>
            <div>CO: ${guest.checkOut || '-'}</div>
            <div>${guest.pax || '0'} khách</div>
        </div>
    `;
}

// Handle status change
function handleStatusChange(roomNo, newStatus) {
    const row = document.getElementById(`row-${roomNo}`);
    
    // Remove all status classes
    row.className = row.className.replace(/status-\w+/g, '');
    // Add new status class
    row.classList.add(`status-${newStatus}`);
    
    // Cập nhật hiển thị thông tin khách hiện tại
    const currentGuestCell = document.getElementById(`current-guest-${roomNo}`);
    const room = allRooms.find(r => r.roomNo === roomNo);
    const currentGuest = room ? (room.currentGuest || {}) : {};
    
    // Hiển thị thông tin khách (vẫn giữ thông tin khách nhưng hiển thị "Trống" nếu Vacant)
    currentGuestCell.innerHTML = createGuestInfoHTML(currentGuest, 'hiện tại', newStatus);
    
    markRoomModified(roomNo);
}

// Toggle ARR fields
function toggleArrFields(roomNo, enabled) {
    const fields = [
        `new-name-${roomNo}`,
        `new-checkin-${roomNo}`,
        `new-checkout-${roomNo}`,
        `new-pax-${roomNo}`
    ];
    
    fields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.disabled = !enabled;
            if (!enabled) {
                field.value = '';
                field.classList.add('disabled-field');
            } else {
                field.classList.remove('disabled-field');
            }
        }
    });
    
    markRoomModified(roomNo);
}

// Apply bulk changes to selected rooms
function applyBulkChanges() {
    const selectedRooms = getSelectedRooms();
    if (selectedRooms.length === 0) {
        showToast('Vui lòng chọn ít nhất một phòng', 'warning');
        return;
    }
    
    const bulkStatus = document.getElementById('bulkStatus').value;
    const bulkArr = document.getElementById('bulkArrCheck').checked;
    
    selectedRooms.forEach(roomId => {
        if (bulkStatus) {
            const statusSelect = document.getElementById(`status-${roomId}`);
            if (statusSelect) {
                statusSelect.value = bulkStatus;
                handleStatusChange(roomId, bulkStatus);
            }
        }
        
        if (bulkArr !== undefined) {
            const arrCheckbox = document.getElementById(`arr-${roomId}`);
            if (arrCheckbox) {
                arrCheckbox.checked = bulkArr;
                toggleArrFields(roomId, bulkArr);
            }
        }
        
        markRoomModified(roomId);
    });
    
    showToast(`Đã áp dụng thay đổi cho ${selectedRooms.length} phòng`, 'success');
    
    // Reset bulk controls
    document.getElementById('bulkStatus').value = '';
    document.getElementById('bulkArrCheck').checked = false;
}

// Save all changes with confirmation
function saveAllChanges() {
    if (modifiedRooms.size === 0) {
        showToast('Không có thay đổi nào để lưu', 'info');
        return;
    }
    
    // Update modal count
    document.getElementById('modalModifiedCount').textContent = modifiedRooms.size;
    
    // Show confirmation modal
    const confirmModal = new bootstrap.Modal(document.getElementById('confirmSaveModal'));
    confirmModal.show();
}

// Confirm save all changes
async function confirmSaveAll() {
    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('confirmSaveModal'));
    modal.hide();
    
    // Proceed with saving
    await performSaveAllChanges();
}

// Perform saving all changes
async function performSaveAllChanges() {
    showLoading('Đang lưu thay đổi...');
    
    try {
        const updates = [];
        
        modifiedRooms.forEach(roomNo => {
            const roomData = collectRoomData(roomNo);
            if (roomData) {
                updates.push(roomData);
            }
        });
        
        // Send updates to server
        const results = await Promise.allSettled(
            updates.map(update => 
                fetch('/api/rooms/update', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(update)
                })
            )
        );
        
        let successCount = 0;
        let errorCount = 0;
        let errorMessages = [];
        
        for (let i = 0; i < results.length; i++) {
            if (results[i].status === 'fulfilled') {
                const response = await results[i].value.json();
                if (response.success) {
                    successCount++;
                } else {
                    errorCount++;
                    errorMessages.push(response.error || 'Lỗi không xác định');
                }
            } else {
                errorCount++;
                errorMessages.push(results[i].reason.message || 'Lỗi kết nối');
            }
        }
        
        hideLoading();
        
        if (errorCount === 0) {
            showToast(`✅ Đã lưu thành công ${successCount} phòng`, 'success');
            modifiedRooms.clear();
            updateModifiedCount();
            loadRooms(); // Reload data
        } else {
            let errorMsg = `Lưu ${successCount} phòng thành công, ${errorCount} phòng thất bại`;
            if (errorMessages.length > 0) {
                errorMsg += `. Lỗi: ${errorMessages[0]}`;
            }
            showToast(errorMsg, 'warning');
        }
        
    } catch (error) {
        console.error('Error saving changes:', error);
        hideLoading();
        showToast('Lỗi khi lưu thay đổi: ' + error.message, 'danger');
    }
}

// Collect room data for update
function collectRoomData(roomNo) {
    const status = document.getElementById(`status-${roomNo}`).value;
    const hasArr = document.getElementById(`arr-${roomNo}`).checked;
    
    // Build final roomStatus
    let roomStatus = status;
    if (hasArr) {
        roomStatus = status + '/arr';
    }
    
    // Collect new guest info if ARR is checked
    let newGuest = null;
    if (hasArr) {
        newGuest = {
            name: document.getElementById(`new-name-${roomNo}`).value || '',
            checkIn: document.getElementById(`new-checkin-${roomNo}`).value || '',
            checkOut: document.getElementById(`new-checkout-${roomNo}`).value || '',
            pax: document.getElementById(`new-pax-${roomNo}`).value || '1'
        };
        
        // If all new guest fields are empty, set newGuest to null
        if (!newGuest.name && !newGuest.checkIn && !newGuest.checkOut && !newGuest.pax) {
            newGuest = null;
        }
    }
    
    // Prepare update data
    const updatedData = {
        roomStatus: roomStatus
    };
    
    // Add newGuest if exists
    if (newGuest) {
        updatedData.newGuest = newGuest;
    } else {
        // If ARR is unchecked but there might be existing newGuest, clear it
        updatedData.newGuest = null;
    }
    
    // Tìm thông tin khách hiện tại từ allRooms
    const room = allRooms.find(r => r.roomNo === roomNo);
    if (room && room.currentGuest) {
        updatedData.currentGuest = room.currentGuest;
    }
    
    return {
        roomNo: roomNo,
        updatedData: updatedData
    };
}

// Mark room as modified
function markRoomModified(roomNo) {
    modifiedRooms.add(roomNo);
    const row = document.getElementById(`row-${roomNo}`);
    if (row) {
        row.classList.add('modified-row');
    }
    updateModifiedCount();
}

// Clear modified mark
function clearRoomModified(roomNo) {
    modifiedRooms.delete(roomNo);
    const row = document.getElementById(`row-${roomNo}`);
    if (row) {
        row.classList.remove('modified-row');
    }
    updateModifiedCount();
}

// Get selected rooms
function getSelectedRooms() {
    const checkboxes = document.querySelectorAll('.room-checkbox:checked');
    return Array.from(checkboxes).map(cb => cb.id.replace('room-', ''));
}

// Update selected count
function updateSelectedCount() {
    const count = getSelectedRooms().length;
    const selectedCountElement = document.getElementById('selectedCountBadge');
    selectedCountElement.textContent = count;
    
    // Update badge color based on count
    if (count > 0) {
        selectedCountElement.parentElement.classList.remove('text-muted');
        selectedCountElement.parentElement.classList.add('text-primary', 'fw-bold');
    } else {
        selectedCountElement.parentElement.classList.remove('text-primary', 'fw-bold');
        selectedCountElement.parentElement.classList.add('text-muted');
    }
    
    // Update select all checkbox
    const totalCheckboxes = document.querySelectorAll('.room-checkbox').length;
    const checkedCheckboxes = document.querySelectorAll('.room-checkbox:checked').length;
    document.getElementById('selectAllRooms').checked = 
        totalCheckboxes > 0 && checkedCheckboxes === totalCheckboxes;
}

// Update modified count
function updateModifiedCount() {
    const count = modifiedRooms.size;
    const modifiedCountElement = document.getElementById('modifiedCount');
    modifiedCountElement.textContent = count;
    
    if (count > 0) {
        modifiedCountElement.parentElement.classList.remove('text-muted');
        modifiedCountElement.parentElement.classList.add('text-warning', 'fw-bold');
    } else {
        modifiedCountElement.parentElement.classList.remove('text-warning', 'fw-bold');
        modifiedCountElement.parentElement.classList.add('text-muted');
    }
}

// Update total rooms count
function updateTotalRoomsCount() {
    document.getElementById('totalRoomsCount').textContent = allRooms.length;
}

// Clear all selections
function clearAllSelections() {
    const checkboxes = document.querySelectorAll('.room-checkbox');
    checkboxes.forEach(cb => cb.checked = false);
    document.getElementById('selectAllRooms').checked = false;
    updateSelectedCount();
    showToast('Đã bỏ chọn tất cả phòng', 'info');
}

// Show toast message
function showToast(message, type = 'success') {
    const toastElement = document.getElementById('successToast');
    const toastMessage = document.getElementById('toastMessage');
    
    toastMessage.textContent = message;
    
    // Update toast color based on type
    const typeClass = {
        'success': 'bg-success',
        'warning': 'bg-warning',
        'danger': 'bg-danger',
        'info': 'bg-info'
    }[type] || 'bg-success';
    
    toastElement.className = `toast align-items-center text-white ${typeClass} border-0`;
    
    const toast = new bootstrap.Toast(toastElement);
    toast.show();
}

// Show loading overlay
function showLoading(text = 'Đang tải...') {
    document.getElementById('loadingOverlay').style.display = 'flex';
    document.getElementById('loadingText').textContent = text;
}

// Hide loading overlay
function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

// Show help
function showHelp() {
    const helpMessage = `
        <strong>Hướng dẫn sử dụng chỉnh sửa hàng loạt:</strong><br><br>
        1. <strong>Chọn nhiều phòng:</strong> Tick chọn các phòng cần chỉnh sửa<br>
        2. <strong>Điều chỉnh hàng loạt:</strong> Dùng công cụ ở trên để áp dụng cùng lúc cho các phòng được chọn<br>
        3. <strong>Trạng thái phòng:</strong><br>
           • <strong>VD</strong> - Vacant Dirty (Trống/Bẩn): Phòng trống, cần dọn<br>
           • <strong>VC</strong> - Vacant Clean (Trống/Sạch): Phòng trống, đã dọn sạch<br>
           • <strong>OD</strong> - Occupied Dirty (Có khách/Bẩn): Phòng có khách, cần dọn<br>
           • <strong>OC</strong> - Occupied Clean (Có khách/Sạch): Phòng có khách, đã dọn sạch<br>
           • <strong>DND</strong> - Do Not Disturb (Không làm phiền): Khách không muốn bị làm phiền<br>
           • <strong>NN</strong> - No Need (Không dọn): Khách không muốn dọn phòng<br>
           • <strong>LOCK</strong> - Khóa phòng: Phòng bị khóa, không sử dụng<br>
           • <strong>IP</strong> - Inspected (Đã kiểm tra): Supervisor đã kiểm tra phòng<br>
        4. <strong>ARR (Có khách đến):</strong><br>
           • Khi bật: Nhập thông tin khách mới sẽ đến<br>
           • Khi tắt: Xóa thông tin khách mới<br>
        5. <strong>Lưu ý:</strong><br>
           • Thông tin khách hiện tại luôn được giữ lại trong hệ thống<br>
           • Khi phòng chuyển sang VD/VC, giao diện sẽ hiển thị "Trống" nhưng thông tin khách vẫn được lưu<br>
        6. <strong>Lưu thay đổi:</strong> Nhấn "Lưu tất cả thay đổi" để ghi nhận<br><br>
        <em>Lưu ý: Các dòng màu vàng là đã có thay đổi chưa lưu</em>
    `;
    
    // Create a modal for help
    const helpModal = `
        <div class="modal fade" id="helpModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title"><i class="fas fa-question-circle me-2"></i>Hướng dẫn sử dụng</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        ${helpMessage}
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-primary" data-bs-dismiss="modal">Đã hiểu</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to body if not exists
    if (!document.getElementById('helpModal')) {
        const modalDiv = document.createElement('div');
        modalDiv.innerHTML = helpModal;
        document.body.appendChild(modalDiv);
    }
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('helpModal'));
    modal.show();
}