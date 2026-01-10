// Dashboard JavaScript
let allRooms = [];
let currentFilter = 'all';
let clickTimer = null; // Biến dùng để xử lý xung đột giữa click và double click

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', function() {
    loadData();
    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    // Filter buttons
    document.querySelectorAll('[data-filter]').forEach(button => {
        button.addEventListener('click', function() {
            // Set active button
            document.querySelectorAll('[data-filter]').forEach(btn => {
                btn.classList.remove('active');
            });
            this.classList.add('active');

            currentFilter = this.getAttribute('data-filter');
            filterRooms(currentFilter);
        });
    });

    // Enter key in password field
    document.getElementById('password')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            confirmUpdate();
        }
    });
}

// Load data from API
async function loadData() {
    // Chỉ hiện loading lần đầu hoặc khi force reload, không hiện khi update ngầm
    if (allRooms.length === 0) showLoading();
    
    try {
        const [roomsResponse, fileInfoResponse] = await Promise.all([
            fetch('/api/rooms'),
            fetch('/api/file-info')
        ]);
        
        if (!roomsResponse.ok) {
            throw new Error('Failed to fetch data');
        }
        
        const roomsData = await roomsResponse.json();
        const fileInfoData = await fileInfoResponse.json();
        
        if (roomsData.success) {
            allRooms = roomsData.data;
            updateFileInfo(fileInfoData.data);
            
            // Apply filter hiện tại
            filterRooms(currentFilter); 
            
            updateLastUpdated();
        } else {
            throw new Error('Invalid data format');
        }
    } catch (error) {
        console.error('Error loading data:', error);
        showError('Không thể tải dữ liệu: ' + error.message);
    } finally {
        if (document.getElementById('loading-spinner').style.display === 'block') {
            showFloorsContainer();
        }
    }
}

// Update file info
function updateFileInfo(fileInfo) {
    const fileInfoElement = document.getElementById('file-info');
    
    if (fileInfo.error) {
        fileInfoElement.innerHTML = `<i class="fas fa-exclamation-triangle me-1"></i>${fileInfo.error}`;
        return;
    }
    
    const lastUpdated = fileInfo.last_updated ? new Date(fileInfo.last_updated).toLocaleString('vi-VN') : 'Chưa xác định';
    const source = fileInfo.source === 'google_sheets' ? 'Google Sheets' : 'Chỉnh sửa thủ công';
    
    fileInfoElement.innerHTML = `
        <i class="fas fa-database me-1"></i>
        Cập nhật: ${lastUpdated} | Nguồn: ${source} | Tổng phòng: ${fileInfo.total_rooms || 0}
    `;
}

// Update filter counts (Global counts - giữ nguyên thống kê tổng)
function updateFilterCounts(rooms) {
    const counts = {
        'all': rooms.length,
        'occupied': 0,
        'arrival': 0,
        'cleaned': 0,
        'not-cleaned': 0,
        'checked': 0,
        'not-departed': 0
    };

    rooms.forEach(room => {
        const status = room.roomStatus;
        
        // Đang ở: OD, OC, DND, NN
        if (['od', 'oc', 'dnd', 'nn'].includes(status)) {
            counts.occupied++;
        }
        
        // Có khách đến: VD/ARR, VC/ARR, DO/ARR
        if (['vd/arr', 'vc/arr', 'do/arr'].includes(status)) {
            counts.arrival++;
        }
        
        // Phòng đã dọn: OC, VC, VC/ARR
        if (['oc', 'vc', 'vc/arr'].includes(status)) {
            counts.cleaned++;
        }
        
        // Phòng chưa dọn: VD, VD/ARR, OD, DND, NN, DO, DO/ARR
        if (['vd', 'vd/arr', 'od', 'dnd', 'nn', 'do', 'do/arr'].includes(status)) {
            counts['not-cleaned']++;
        }
        
        // Phòng đã kiểm: IP
        if (status === 'ip') {
            counts.checked++;
        }
        
        // Phòng chưa rời đi: DO, DO/ARR
        if (['do', 'do/arr'].includes(status)) {
            counts['not-departed']++;
        }
    });

    // Update DOM
    Object.keys(counts).forEach(filter => {
        const element = document.getElementById(`count-${filter}`);
        if (element) {
            element.textContent = counts[filter];
        }
    });
}

// Display rooms by floor (Đã loại bỏ thống kê chi tiết từng tầng)
function displayRoomsByFloor(rooms) {
    const container = document.getElementById('floors-container');
    
    // Group by floor
    const floors = {};
    rooms.forEach(room => {
        const floor = room.roomNo.substring(0, room.roomNo.length - 2);
        if (!floors[floor]) {
            floors[floor] = [];
        }
        floors[floor].push(room);
    });
    
    // Sort floors
    const sortedFloors = Object.keys(floors).sort((a, b) => a - b);
    
    container.innerHTML = sortedFloors.map(floor => {
        const floorRooms = floors[floor];
        
        return `
            <div class="floor-section">
                <div class="floor-header">
                    <h4 class="floor-title">
                        <i class="fas fa-layer-group me-2"></i>Tầng ${floor}
                        <span class="badge bg-primary ms-2">${floorRooms.length} phòng</span>
                    </h4>
                </div>
                <div class="row">
                    ${floorRooms.map(room => createRoomCard(room)).join('')}
                </div>
            </div>
        `;
    }).join('');
}

// --- LOGIC XỬ LÝ CLICK VÀ DOUBLE CLICK ---

// Hàm xử lý Click đơn (Mở Modal)
function handleRoomClick(roomNo) {
    // Nếu đã có timer (đang chờ double click), clear nó đi
    if (clickTimer) clearTimeout(clickTimer);
    
    // Tạo timer mới, chờ 250ms. Nếu không có click thứ 2 thì chạy hàm này.
    clickTimer = setTimeout(() => {
        showRoomEditModal(roomNo);
        clickTimer = null;
    }, 250);
}

// Hàm xử lý Double Click (Đổi trạng thái)
function handleRoomDoubleClick(roomNo, currentStatus) {
    // Hủy timer click đơn ngay lập tức để không mở Modal
    if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
    }

    // Logic xác định trạng thái mới
    let newStatus = null;
    const statusLower = currentStatus.toLowerCase();

    if (statusLower === 'vd') {
        newStatus = 'vc';
    } else if (statusLower === 'vd/arr') {
        newStatus = 'vc/arr';
    } else if (statusLower === 'od') {
        newStatus = 'oc';
    }

    if (newStatus) {
        // Thực hiện cập nhật
        performQuickUpdate(roomNo, newStatus, currentStatus);
    } else {
        // Báo lỗi cho các trạng thái khác
        showToastMessage('Thao tác lỗi: Chỉ hỗ trợ chuyển VD->VC, VD/ARR->VC/ARR, OD->OC', 'danger');
    }
}

// Gọi API cập nhật nhanh
async function performQuickUpdate(roomNo, newStatus, oldStatus) {
    try {
        const response = await fetch('/api/rooms/hk-quick-update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                roomNo: roomNo,
                newStatus: newStatus
            })
        });

        const data = await response.json();

        if (data.success) {
            showToastMessage(`Đã cập nhật phòng ${roomNo}: ${oldStatus.toUpperCase()} ➝ ${newStatus.toUpperCase()}`, 'success');
            // Reload data nhẹ nhàng
            loadData();
        } else {
            showToastMessage(data.error || 'Có lỗi xảy ra', 'danger');
        }
    } catch (error) {
        console.error('Update error:', error);
        showToastMessage('Lỗi kết nối server', 'danger');
    }
}

// Create room card HTML
function createRoomCard(room) {
    const status = room.roomStatus;
    const statusClass = `room-status-${status.replace('/', '-')}`;
    
    const hasCurrentGuest = room.currentGuest && room.currentGuest.name && room.currentGuest.name.trim() !== '';
    const hasNewGuest = room.newGuest && room.newGuest.name && room.newGuest.name.trim() !== '';
    
    let guestDisplay = '';
    
    if (hasCurrentGuest) {
        guestDisplay = `
            <div class="guest-name">${room.currentGuest.name}</div>
            <div class="guest-dates">
                ${formatDate(room.currentGuest.checkIn)} → ${formatDate(room.currentGuest.checkOut)}
            </div>
            <div class="guest-pax">${room.currentGuest.pax} khách</div>
        `;
    } else if (hasNewGuest) {
        guestDisplay = `
            <div class="guest-name">${room.newGuest.name}</div>
            <div class="guest-dates">
                ${formatDate(room.newGuest.checkIn)} → ${formatDate(room.newGuest.checkOut)}
            </div>
            <div class="guest-pax">${room.newGuest.pax} khách</div>
        `;
    } else {
        guestDisplay = '<div class="guest-name">Trống</div>';
    }
    
    // Thêm on click và on dblclick
    return `
        <div class="col-6 col-sm-4 col-md-3 col-lg-2 col-xl-1">
            <div class="room-card ${statusClass}" 
                 onclick="handleRoomClick('${room.roomNo}')"
                 ondblclick="handleRoomDoubleClick('${room.roomNo}', '${room.roomStatus}')">
                <div class="room-number">${room.roomNo}</div>
                <div class="guest-info">
                    ${guestDisplay}
                </div>
            </div>
        </div>
    `;
}

// Show update modal
function showUpdateModal() {
    // Reset form
    document.getElementById('password').value = '';
    document.getElementById('update-error').style.display = 'none';
    
    const updateModal = new bootstrap.Modal(document.getElementById('updateModal'));
    updateModal.show();
}

// Confirm update with password
async function confirmUpdate() {
    const password = document.getElementById('password').value;
    const updateButton = document.querySelector('#updateModal .btn-warning');
    const originalText = updateButton.innerHTML;
    
    // Validate password
    if (!password) {
        showUpdateError('Vui lòng nhập mật khẩu');
        return;
    }
    
    if (password !== '123456') {
        showUpdateError('Mật khẩu không chính xác');
        return;
    }
    
    // Show loading state
    updateButton.classList.add('btn-updating');
    updateButton.disabled = true;
    
    try {
        const response = await fetch('/api/refresh', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Close modal
            const updateModal = bootstrap.Modal.getInstance(document.getElementById('updateModal'));
            updateModal.hide();
            
            // Show success message and reload data
            showToastMessage('Dữ liệu đã được cập nhật thành công từ Google Sheets', 'success');
            loadData();
        } else {
            showUpdateError(data.error || 'Có lỗi xảy ra khi cập nhật dữ liệu');
        }
    } catch (error) {
        console.error('Update error:', error);
        showUpdateError('Lỗi kết nối khi cập nhật dữ liệu');
    } finally {
        // Restore button
        updateButton.classList.remove('btn-updating');
        updateButton.disabled = false;
        updateButton.innerHTML = originalText;
    }
}

// Show update error
function showUpdateError(message) {
    const errorElement = document.getElementById('update-error');
    const errorText = document.getElementById('update-error-text');
    
    errorText.textContent = message;
    errorElement.style.display = 'block';
}

// Filter rooms
function filterRooms(filter) {
    let filteredRooms = allRooms;

    switch (filter) {
        case 'occupied':
            filteredRooms = allRooms.filter(room => 
                ['od', 'oc', 'dnd', 'nn'].includes(room.roomStatus)
            );
            break;
        case 'arrival':
            filteredRooms = allRooms.filter(room => 
                ['vd/arr', 'vc/arr', 'do/arr'].includes(room.roomStatus)
            );
            break;
        case 'cleaned':
            filteredRooms = allRooms.filter(room => 
                ['oc', 'vc', 'vc/arr'].includes(room.roomStatus)
            );
            break;
        case 'not-cleaned':
            filteredRooms = allRooms.filter(room => 
                ['vd', 'vd/arr', 'od', 'dnd', 'nn', 'do', 'do/arr'].includes(room.roomStatus)
            );
            break;
        case 'checked':
            filteredRooms = allRooms.filter(room => 
                room.roomStatus === 'ip'
            );
            break;
        case 'not-departed':
            filteredRooms = allRooms.filter(room => 
                ['do', 'do/arr'].includes(room.roomStatus)
            );
            break;
        default:
            filteredRooms = allRooms;
    }

    displayRoomsByFloor(filteredRooms);
    updateFilterCounts(filteredRooms); 
}

// Helper functions
function formatDate(dateStr) {
    if (!dateStr || dateStr === '00-01-00') return '-';
    return dateStr;
}

// UI State Management
function showLoading() {
    document.getElementById('loading-spinner').style.display = 'block';
    document.getElementById('error-message').style.display = 'none';
    document.getElementById('floors-container').style.display = 'none';
}

function showFloorsContainer() {
    document.getElementById('loading-spinner').style.display = 'none';
    document.getElementById('error-message').style.display = 'none';
    document.getElementById('floors-container').style.display = 'block';
}

function showError(message) {
    document.getElementById('loading-spinner').style.display = 'none';
    document.getElementById('error-message').style.display = 'block';
    document.getElementById('floors-container').style.display = 'none';
    document.getElementById('error-text').textContent = message;
}

function updateLastUpdated() {
    const now = new Date();
    document.getElementById('last-updated').textContent = 
        `Cập nhật: ${now.toLocaleDateString('vi-VN')} ${now.toLocaleTimeString('vi-VN')}`;
}

// Show Toast Message (Unified function for Success and Error)
function showToastMessage(message, type = 'success') {
    // type: 'success' (green) or 'danger' (red)
    
    // Remove existing toast if any to prevent stacking
    const existingToast = document.querySelector('.toast-container');
    if (existingToast) existingToast.remove();

    const toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
    toastContainer.style.zIndex = '1070';

    const bgColor = type === 'success' ? 'bg-success' : 'bg-danger';
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';

    toastContainer.innerHTML = `
        <div class="toast align-items-center text-white ${bgColor} border-0" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body">
                    <i class="fas ${icon} me-2"></i>${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;
    
    document.body.appendChild(toastContainer);
    
    const toastElement = toastContainer.querySelector('.toast');
    const bsToast = new bootstrap.Toast(toastElement, { delay: 3000 });
    bsToast.show();
    
    toastElement.addEventListener('hidden.bs.toast', () => {
        toastContainer.remove();
    });
}