// bulk_edit.js - Chỉnh sửa hàng loạt phòng cho bộ phận FO

const bulkEdit = {
    // Global variables
    allRooms: [],
    filteredRooms: [],
    displayedRooms: [],
    selectedRooms: new Set(),
    currentFilter: 'all',
    currentPage: 1,
    itemsPerPage: 25,
    searchQuery: '',
    
    // DOM elements cache
    elements: {},
    
    // Status counters elements
    statusCounters: {},
    
    // Initialize when page loads
    init: function() {
        this.cacheDomElements();
        this.loadRoomsData();
        this.setupEventListeners();
    },
    
    // Cache DOM elements for better performance
    cacheDomElements: function() {
        this.elements = {
            roomsTableBody: document.getElementById('rooms-table-body'),
            loadingRow: document.getElementById('loading-row'),
            selectAllCheckbox: document.getElementById('select-all-checkbox'),
            applyBulkBtn: document.getElementById('apply-bulk-btn'),
            selectionInfo: document.getElementById('selection-info'),
            selectedCountSpan: document.getElementById('selected-count'),
            searchInput: document.getElementById('search-room'),
            clearSearchBtn: document.getElementById('clear-search'),
            totalRoomsSpan: document.getElementById('total-rooms'),
            displayedCountSpan: document.getElementById('displayed-count'),
            totalCountSpan: document.getElementById('total-count'),
            paginationElement: document.getElementById('pagination'),
            newStatusSelect: document.getElementById('new-status'),
            addArrFlag: document.getElementById('add-arr-flag')
        };
        
        // Status counters
        this.statusCounters = {
            'all': document.getElementById('count-all'),
            'vd': document.getElementById('count-vd'),
            'vc': document.getElementById('count-vc'),
            'od': document.getElementById('count-od'),
            'oc': document.getElementById('count-oc'),
            'dnd': document.getElementById('count-dnd'),
            'nn': document.getElementById('count-nn'),
            'ip': document.getElementById('count-ip'),
            'do': document.getElementById('count-do'),
            'lock': document.getElementById('count-lock')
        };
    },
    
    // Setup event listeners
    setupEventListeners: function() {
        // Filter badges click event
        document.querySelectorAll('.filter-badge').forEach(badge => {
            badge.addEventListener('click', () => {
                const filter = badge.getAttribute('data-filter');
                this.setFilter(filter);
            });
        });
        
        // Select all checkbox
        if (this.elements.selectAllCheckbox) {
            this.elements.selectAllCheckbox.addEventListener('change', (e) => {
                this.toggleSelectAll(e.target.checked);
            });
        }
        
        // Search input
        if (this.elements.searchInput) {
            this.elements.searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.trim().toLowerCase();
                this.applyFilters();
            });
        }
        
        // Clear search button
        if (this.elements.clearSearchBtn) {
            this.elements.clearSearchBtn.addEventListener('click', () => {
                this.elements.searchInput.value = '';
                this.searchQuery = '';
                this.applyFilters();
            });
        }
        
        // New status select change
        if (this.elements.newStatusSelect) {
            this.elements.newStatusSelect.addEventListener('change', () => {
                this.updateApplyButtonState();
            });
        }
    },
    
    // Load rooms data from API
    loadRoomsData: function() {
        fetch('/api/rooms')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    this.allRooms = data.data;
                    this.updateStatusCounters();
                    this.applyFilters();
                    if (this.elements.loadingRow) {
                        this.elements.loadingRow.style.display = 'none';
                    }
                } else {
                    this.showError('Không thể tải dữ liệu phòng: ' + data.error);
                }
            })
            .catch(error => {
                console.error('Error loading rooms:', error);
                this.showError('Lỗi kết nối đến server');
            });
    },
    
    // Update status counters
    updateStatusCounters: function() {
        // Initialize counters
        const counters = {
            'all': this.allRooms.length,
            'vd': 0, 'vc': 0, 'od': 0, 'oc': 0,
            'dnd': 0, 'nn': 0, 'ip': 0, 'do': 0, 'lock': 0
        };
        
        // Count rooms by status
        this.allRooms.forEach(room => {
            const status = this.getBaseStatus(room.roomStatus);
            if (counters[status] !== undefined) {
                counters[status]++;
            }
        });
        
        // Update counter elements
        Object.keys(counters).forEach(status => {
            if (this.statusCounters[status]) {
                this.statusCounters[status].textContent = counters[status];
            }
        });
        
        if (this.elements.totalRoomsSpan) {
            this.elements.totalRoomsSpan.textContent = this.allRooms.length;
        }
    },
    
    // Get base status (remove /arr part)
    getBaseStatus: function(status) {
        if (!status) return 'vc';
        return status.split('/')[0];
    },
    
    // Set active filter
    setFilter: function(filter) {
        // Update active filter UI
        document.querySelectorAll('.filter-badge').forEach(badge => {
            if (badge.getAttribute('data-filter') === filter) {
                badge.classList.add('active');
            } else {
                badge.classList.remove('active');
            }
        });
        
        this.currentFilter = filter;
        this.applyFilters();
    },
    
    // Apply filters and search
    applyFilters: function() {
        // Apply filter and search
        this.filteredRooms = this.allRooms.filter(room => {
            // Apply status filter
            if (this.currentFilter !== 'all') {
                const baseStatus = this.getBaseStatus(room.roomStatus);
                if (baseStatus !== this.currentFilter) return false;
            }
            
            // Apply search filter
            if (this.searchQuery) {
                const roomNo = room.roomNo.toLowerCase();
                const guestName = room.currentGuest.name.toLowerCase();
                const newGuestName = room.newGuest.name.toLowerCase();
                
                if (!roomNo.includes(this.searchQuery) && 
                    !guestName.includes(this.searchQuery) && 
                    !newGuestName.includes(this.searchQuery)) {
                    return false;
                }
            }
            
            return true;
        });
        
        // Update selection (deselect rooms that are no longer visible)
        this.selectedRooms.forEach(roomNo => {
            const roomStillVisible = this.filteredRooms.some(room => room.roomNo === roomNo);
            if (!roomStillVisible) {
                this.selectedRooms.delete(roomNo);
            }
        });
        
        this.updateTable();
        this.updateSelectionInfo();
        this.updateApplyButtonState();
    },
    
    // Update rooms table
    updateTable: function() {
        // Clear table body
        if (this.elements.roomsTableBody) {
            this.elements.roomsTableBody.innerHTML = '';
        }
        
        if (this.filteredRooms.length === 0) {
            if (this.elements.roomsTableBody) {
                this.elements.roomsTableBody.innerHTML = `
                    <tr>
                        <td colspan="12" class="text-center py-5">
                            <i class="fas fa-inbox fa-2x text-muted mb-3"></i>
                            <p>Không có phòng nào phù hợp với bộ lọc</p>
                        </td>
                    </tr>
                `;
            }
            this.updatePagination();
            return;
        }
        
        // Calculate pagination
        const totalPages = Math.ceil(this.filteredRooms.length / this.itemsPerPage);
        this.currentPage = Math.min(this.currentPage, totalPages);
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = Math.min(startIndex + this.itemsPerPage, this.filteredRooms.length);
        
        this.displayedRooms = this.filteredRooms.slice(startIndex, endIndex);
        
        // Add rows for displayed rooms
        this.displayedRooms.forEach(room => {
            const isSelected = this.selectedRooms.has(room.roomNo);
            const row = this.createRoomRow(room, isSelected);
            if (this.elements.roomsTableBody) {
                this.elements.roomsTableBody.appendChild(row);
            }
        });
        
        // Update info
        if (this.elements.displayedCountSpan && this.elements.totalCountSpan) {
            this.elements.displayedCountSpan.textContent = this.displayedRooms.length;
            this.elements.totalCountSpan.textContent = this.filteredRooms.length;
        }
        
        this.updatePagination();
    },
    
    // Create room row HTML
    createRoomRow: function(room, isSelected) {
        const row = document.createElement('tr');
        if (isSelected) row.classList.add('selected');
        
        // Determine status class
        const baseStatus = this.getBaseStatus(room.roomStatus);
        const hasArrFlag = room.roomStatus.includes('/arr');
        let statusClass = `status-${baseStatus}`;
        if (hasArrFlag) statusClass += ' status-arr';
        
        // Create row HTML
        row.innerHTML = `
            <td class="text-center">
                <input type="checkbox" class="form-check-input room-checkbox" 
                       data-room="${room.roomNo}" 
                       ${isSelected ? 'checked' : ''}>
            </td>
            <td class="fw-bold">${room.roomNo}</td>
            <td>${room.roomType || ''}</td>
            <td>
                <span class="status-badge ${statusClass}">
                    ${room.roomStatus}
                </span>
            </td>
            <td class="guest-info" title="${room.currentGuest.name}">
                ${room.currentGuest.name || ''}
            </td>
            <td>${room.currentGuest.checkIn || ''}</td>
            <td>${room.currentGuest.checkOut || ''}</td>
            <td class="text-center">${room.currentGuest.pax || ''}</td>
            <td class="guest-info" title="${room.newGuest.name}">
                ${room.newGuest.name || ''}
            </td>
            <td>${room.newGuest.checkIn || ''}</td>
            <td>${room.newGuest.checkOut || ''}</td>
            <td class="text-center">${room.newGuest.pax || ''}</td>
        `;
        
        // Add checkbox event listener
        const checkbox = row.querySelector('.room-checkbox');
        checkbox.addEventListener('change', (e) => {
            this.toggleRoomSelection(e.target);
        });
        
        return row;
    },
    
    // Update pagination
    updatePagination: function() {
        if (!this.elements.paginationElement) return;
        
        const totalPages = Math.ceil(this.filteredRooms.length / this.itemsPerPage);
        this.elements.paginationElement.innerHTML = '';
        
        if (totalPages <= 1) return;
        
        // Previous button
        const prevLi = document.createElement('li');
        prevLi.className = `page-item ${this.currentPage === 1 ? 'disabled' : ''}`;
        prevLi.innerHTML = `
            <a class="page-link" href="#" aria-label="Previous" onclick="bulkEdit.changePage(${this.currentPage - 1}); return false;">
                <span aria-hidden="true">&laquo;</span>
            </a>
        `;
        this.elements.paginationElement.appendChild(prevLi);
        
        // Page numbers
        const maxVisiblePages = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const pageLi = document.createElement('li');
            pageLi.className = `page-item ${i === this.currentPage ? 'active' : ''}`;
            pageLi.innerHTML = `<a class="page-link" href="#" onclick="bulkEdit.changePage(${i}); return false;">${i}</a>`;
            this.elements.paginationElement.appendChild(pageLi);
        }
        
        // Next button
        const nextLi = document.createElement('li');
        nextLi.className = `page-item ${this.currentPage === totalPages ? 'disabled' : ''}`;
        nextLi.innerHTML = `
            <a class="page-link" href="#" aria-label="Next" onclick="bulkEdit.changePage(${this.currentPage + 1}); return false;">
                <span aria-hidden="true">&raquo;</span>
            </a>
        `;
        this.elements.paginationElement.appendChild(nextLi);
    },
    
    // Change page
    changePage: function(page) {
        if (page < 1 || page > Math.ceil(this.filteredRooms.length / this.itemsPerPage)) return;
        this.currentPage = page;
        this.updateTable();
    },
    
    // Toggle room selection
    toggleRoomSelection: function(checkbox) {
        const roomNo = checkbox.getAttribute('data-room');
        const row = checkbox.closest('tr');
        
        if (checkbox.checked) {
            this.selectedRooms.add(roomNo);
            row.classList.add('selected');
        } else {
            this.selectedRooms.delete(roomNo);
            row.classList.remove('selected');
            if (this.elements.selectAllCheckbox) {
                this.elements.selectAllCheckbox.checked = false;
            }
        }
        
        this.updateSelectionInfo();
        this.updateApplyButtonState();
    },
    
    // Toggle select all rooms on current page
    toggleSelectAll: function(selectAll) {
        // Update all checkboxes on current page
        document.querySelectorAll('.room-checkbox').forEach(checkbox => {
            const roomNo = checkbox.getAttribute('data-room');
            checkbox.checked = selectAll;
            
            if (selectAll) {
                this.selectedRooms.add(roomNo);
                checkbox.closest('tr').classList.add('selected');
            } else {
                this.selectedRooms.delete(roomNo);
                checkbox.closest('tr').classList.remove('selected');
            }
        });
        
        this.updateSelectionInfo();
        this.updateApplyButtonState();
    },
    
    // Clear all selections
    clearSelection: function() {
        this.selectedRooms.clear();
        if (this.elements.selectAllCheckbox) {
            this.elements.selectAllCheckbox.checked = false;
        }
        
        // Update all checkboxes
        document.querySelectorAll('.room-checkbox').forEach(checkbox => {
            checkbox.checked = false;
            checkbox.closest('tr').classList.remove('selected');
        });
        
        this.updateSelectionInfo();
        this.updateApplyButtonState();
    },
    
    // Update selection info display
    updateSelectionInfo: function() {
        const selectedCount = this.selectedRooms.size;
        
        if (selectedCount > 0) {
            if (this.elements.selectedCountSpan) {
                this.elements.selectedCountSpan.textContent = selectedCount;
            }
            if (this.elements.selectionInfo) {
                this.elements.selectionInfo.style.display = 'block';
            }
        } else {
            if (this.elements.selectionInfo) {
                this.elements.selectionInfo.style.display = 'none';
            }
        }
    },
    
    // Update apply button state
    updateApplyButtonState: function() {
        const newStatus = this.elements.newStatusSelect ? this.elements.newStatusSelect.value : '';
        const hasSelection = this.selectedRooms.size > 0;
        
        if (this.elements.applyBulkBtn) {
            this.elements.applyBulkBtn.disabled = !(hasSelection && newStatus);
        }
    },
    
    // Show bulk update preview modal
    showBulkUpdateModal: function() {
        const newStatus = this.elements.newStatusSelect ? this.elements.newStatusSelect.value : '';
        const addArrFlag = this.elements.addArrFlag ? this.elements.addArrFlag.checked : false;
        
        if (!newStatus) {
            this.showError('Vui lòng chọn trạng thái mới trước khi xem trước');
            return;
        }
        
        if (this.selectedRooms.size === 0) {
            this.showError('Vui lòng chọn ít nhất một phòng');
            return;
        }
        
        // Calculate final status
        let finalStatus = newStatus;
        if (addArrFlag && ['vd', 'vc', 'do'].includes(newStatus)) {
            finalStatus = `${newStatus}/arr`;
        }
        
        // Populate preview table
        const previewTableBody = document.getElementById('preview-table-body');
        if (previewTableBody) {
            previewTableBody.innerHTML = '';
        }
        
        let count = 0;
        let showVdVcWarning = false;
        
        // Check if any room will have guest info cleared
        this.allRooms.forEach(room => {
            if (this.selectedRooms.has(room.roomNo)) {
                count++;
                const row = document.createElement('tr');
                const currentGuestName = room.currentGuest.name || '(Không có)';
                const willClearGuest = (newStatus === 'vd' || newStatus === 'vc') && currentGuestName !== '(Không có)';
                
                if (willClearGuest) {
                    showVdVcWarning = true;
                }
                
                row.innerHTML = `
                    <td class="fw-bold">${room.roomNo}</td>
                    <td>
                        <span class="status-badge status-${this.getBaseStatus(room.roomStatus)}">
                            ${room.roomStatus}
                        </span>
                    </td>
                    <td>
                        <span class="status-badge status-${newStatus}">
                            ${finalStatus}
                        </span>
                    </td>
                    <td>
                        ${willClearGuest ? 
                          '<span class="badge bg-warning text-dark"><i class="fas fa-user-times me-1"></i>Xóa khách</span>' : 
                          '<span class="badge bg-secondary">Chỉ đổi trạng thái</span>'}
                    </td>
                `;
                if (previewTableBody) {
                    previewTableBody.appendChild(row);
                }
            }
        });
        
        const previewCountElement = document.getElementById('preview-count');
        if (previewCountElement) {
            previewCountElement.textContent = count;
        }
        
        // Show/hide VD/VC warning
        const warningElement = document.getElementById('vd-vc-warning');
        if (warningElement) {
            warningElement.style.display = showVdVcWarning ? 'block' : 'none';
        }
        
        // Show modal
        const modalElement = document.getElementById('bulkUpdateModal');
        if (modalElement) {
            const modal = new bootstrap.Modal(modalElement);
            modal.show();
        }
    },
    
    // Confirm and execute bulk update
    confirmBulkUpdate: function() {
        const newStatus = this.elements.newStatusSelect ? this.elements.newStatusSelect.value : '';
        const addArrFlag = this.elements.addArrFlag ? this.elements.addArrFlag.checked : false;
        
        // Calculate final status
        let finalStatus = newStatus;
        if (addArrFlag && ['vd', 'vc', 'do'].includes(newStatus)) {
            finalStatus = `${newStatus}/arr`;
        }
        
        // Prepare update data
        const updates = Array.from(this.selectedRooms).map(roomNo => {
            // If changing to VD/VC, we need to clear current guest info
            const updateData = {
                roomNo: roomNo,
                updatedData: {
                    roomStatus: finalStatus
                }
            };
            
            // If status is VD or VC, add empty currentGuest data to clear it
            if (newStatus === 'vd' || newStatus === 'vc') {
                updateData.updatedData.currentGuest = {
                    name: '',
                    checkIn: '',
                    checkOut: '',
                    pax: 0
                };
            }
            
            return updateData;
        });
        
        // Close preview modal
        const previewModalElement = document.getElementById('bulkUpdateModal');
        if (previewModalElement) {
            const previewModal = bootstrap.Modal.getInstance(previewModalElement);
            if (previewModal) {
                previewModal.hide();
            }
        }
        
        // Show loading state
        if (this.elements.applyBulkBtn) {
            this.elements.applyBulkBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Đang xử lý...';
            this.elements.applyBulkBtn.disabled = true;
        }
        
        // Send bulk update requests sequentially
        this.updateRoomsSequentially(updates, 0);
    },
    
    // Update rooms sequentially (one by one)
    updateRoomsSequentially: function(updates, index) {
        if (index >= updates.length) {
            // All updates completed
            if (this.elements.applyBulkBtn) {
                this.elements.applyBulkBtn.innerHTML = '<i class="fas fa-save me-2"></i>Áp dụng cho phòng đã chọn';
            }
            this.updateApplyButtonState();
            
            // Show success modal
            const successMessageElement = document.getElementById('success-message');
            if (successMessageElement) {
                successMessageElement.textContent = 
                    `Đã cập nhật thành công ${updates.length} phòng sang trạng thái "${updates[0]?.updatedData?.roomStatus || ''}"`;
            }
            
            const successModalElement = document.getElementById('successModal');
            if (successModalElement) {
                const successModal = new bootstrap.Modal(successModalElement);
                successModal.show();
            }
            
            // Reload data after success
            setTimeout(() => {
                this.loadRoomsData();
                this.clearSelection();
            }, 1000);
            
            return;
        }
        
        const update = updates[index];
        
        // Send individual update request
        fetch('/api/rooms/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(update)
        })
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                console.error(`Failed to update room ${update.roomNo}:`, data.error);
                // Continue with next room even if one fails
            }
            
            // Update progress in button
            const progress = Math.round(((index + 1) / updates.length) * 100);
            if (this.elements.applyBulkBtn) {
                this.elements.applyBulkBtn.innerHTML = `<i class="fas fa-spinner fa-spin me-2"></i>Đang xử lý... ${progress}%`;
            }
            
            // Process next room
            this.updateRoomsSequentially(updates, index + 1);
        })
        .catch(error => {
            console.error(`Error updating room ${update.roomNo}:`, error);
            // Continue with next room
            this.updateRoomsSequentially(updates, index + 1);
        });
    },
    
    // Apply bulk update (alias for showBulkUpdateModal)
    applyBulkUpdate: function() {
        this.showBulkUpdateModal();
    },
    
    // Show error modal
    showError: function(message) {
        const errorMessageElement = document.getElementById('error-message');
        if (errorMessageElement) {
            errorMessageElement.textContent = message;
        }
        
        const errorModalElement = document.getElementById('errorModal');
        if (errorModalElement) {
            const errorModal = new bootstrap.Modal(errorModalElement);
            errorModal.show();
        }
    }
};

// Make bulkEdit available globally
window.bulkEdit = bulkEdit;