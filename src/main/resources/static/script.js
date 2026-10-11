import BloodBankStorage from './storage.js';

const groups = BloodBankStorage.GROUPS;
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const phonePattern = /^[0-9+() -]{7,20}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function statusOf(item) {
    return String(item.status || 'pending').toLowerCase();
}

function statusLabel(status) {
    return status.replace('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function populateGroups() {
    ['donor-group', 'stock-group', 'request-group', 'search-group'].forEach(id => {
        const select = document.getElementById(id);
        select.innerHTML = '<option value="">Select blood group</option>' + groups.map(group => `<option value="${group}">${group}</option>`).join('');
    });
    $('#donor-email').removeAttribute('required');
    $('#patient-email').removeAttribute('required');
    $('#donor-email').placeholder = 'Optional for demo display';
    $('#patient-email').placeholder = 'Optional for demo display';
}

function showAlert(message, type = 'success') {
    const alert = $('#alert');
    alert.textContent = message;
    alert.className = `alert show ${type}`;
    window.clearTimeout(showAlert.timeout);
    showAlert.timeout = window.setTimeout(() => alert.className = 'alert', 5000);
}

function reportStorageError(error) {
    console.error(error);
    showAlert(error?.message || 'Firebase could not be reached. Check Authentication, Firestore setup, and rules.', 'error');
}

function showSection(id) {
    $$('.page-section').forEach(section => section.classList.toggle('active-section', section.id === id));
    $$('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.section === id));
    const titles = {dashboard: 'Good day, coordinator', donors: 'Donor directory', stock: 'Blood stock', requests: 'Patient requests', search: 'Find a donor'};
    $('#page-title').textContent = titles[id];
    $('.sidebar').classList.remove('open');
    const loaders = {dashboard: loadDashboard, donors: loadDonors, stock: loadStock, requests: loadRequests, search: loadSearch};
    loaders[id]?.().catch(reportStorageError);
}

function stockItems(stock) {
    return groups.map(group => ({bloodGroup: group, units: Number(stock[group]) || 0}));
}

function renderStock(items, target) {
    const small = target.id === 'dashboard-stock';
    target.innerHTML = items.map(item => `<div class="${small ? 'mini-stock-item' : 'stock-item'} ${item.units > 0 ? 'available' : ''}"><span class="group">${item.bloodGroup}</span><strong>${item.units}</strong><span>unit${item.units === 1 ? '' : 's'}</span></div>`).join('');
}

async function loadDashboard() {
    await BloodBankStorage.ready;
    const donors = BloodBankStorage.getDonors();
    const requests = BloodBankStorage.getRequests();
    const stock = BloodBankStorage.getStock();
    $('#total-donors').textContent = donors.length;
    $('#total-stock').textContent = Object.values(stock).reduce((total, units) => total + Number(units || 0), 0);
    $('#pending-requests').textContent = requests.filter(request => ['pending', 'donor_selected'].includes(statusOf(request))).length;
    $('#available-groups').textContent = groups.filter(group => stock[group] > 0).length;
    renderStock(stockItems(stock), $('#dashboard-stock'));
}

async function loadDonors() {
    await BloodBankStorage.ready;
    const donors = BloodBankStorage.getDonors();
    $('#donor-count').textContent = `${donors.length} donor${donors.length === 1 ? '' : 's'}`;
    $('#donors-table').innerHTML = donors.length ? donors.map(donor => {
        const available = donor.available !== false && donor.currentlyAssigned !== true;
        const status = available ? '🟢 Available' : donor.currentlyAssigned ? '🟠 Assigned' : '🔴 Not available';
        return `<tr><td>${escapeHtml(donor.name)}<br><small>${escapeHtml(donor.email || 'No email')} · ${donor.age} yrs</small></td><td><span class="badge approved">${escapeHtml(donor.bloodGroup)}</span></td><td>${escapeHtml(donor.phone)}</td><td><span class="availability ${available ? 'is-available' : 'is-unavailable'}">${status}</span></td><td><button class="table-action toggle-availability" data-id="${donor.id}" data-available="${available ? 'false' : 'true'}">${available ? 'Set unavailable' : 'Set available'}</button><button class="table-action edit-donor" data-id="${donor.id}">Edit</button><button class="table-action delete-donor" data-id="${donor.id}">Delete</button></td></tr>`;
    }).join('') : emptyRow(5, 'No donors registered yet.');
    $$('.edit-donor').forEach(button => button.addEventListener('click', () => editDonor(button.dataset.id)));
    $$('.delete-donor').forEach(button => button.addEventListener('click', () => deleteDonor(button.dataset.id).catch(reportStorageError)));
    $$('.toggle-availability').forEach(button => button.addEventListener('click', () => toggleAvailability(button).catch(reportStorageError)));
}

async function toggleAvailability(button) {
    await BloodBankStorage.ready;
    await BloodBankStorage.updateDonorAvailability(button.dataset.id, button.dataset.available === 'true');
    showAlert('Donor availability updated.');
    await loadDonors();
    await loadSearch();
}

async function loadStock() {
    await BloodBankStorage.ready;
    renderStock(stockItems(BloodBankStorage.getStock()), $('#stock-grid'));
}

async function loadRequests() {
    await BloodBankStorage.ready;
    const requests = BloodBankStorage.getRequests();
    $('#requests-table').innerHTML = requests.length ? requests.map(item => {
        const status = statusOf(item);
        const selected = item.selectedDonorName ? `<br><small>Donor: ${escapeHtml(item.selectedDonorName)}</small>` : '';
        let actions = '—';
        if (['pending', 'donor_selected'].includes(status)) actions = `<button class="table-action approve-request" data-id="${item.id}">Approve</button><button class="table-action reject-request" data-id="${item.id}">Reject</button>`;
        if (status === 'approved') actions = `<button class="table-action complete-request" data-id="${item.id}">Complete</button>`;
        return `<tr><td>${escapeHtml(item.patientName)}<br><small>${item.patientAge} yrs · ${escapeHtml(item.requesterEmail || '')}</small>${selected}</td><td><span class="badge approved">${escapeHtml(item.bloodGroup)}</span></td><td>${item.units}</td><td>${escapeHtml(item.contact)}</td><td><span class="badge ${status}">${statusLabel(status)}</span></td><td>${actions}</td></tr>`;
    }).join('') : emptyRow(6, 'No blood requests yet.');
    $$('.approve-request').forEach(button => button.addEventListener('click', () => updateRequest(button.dataset.id, 'approve').catch(reportStorageError)));
    $$('.reject-request').forEach(button => button.addEventListener('click', () => updateRequest(button.dataset.id, 'reject').catch(reportStorageError)));
    $$('.complete-request').forEach(button => button.addEventListener('click', () => updateRequest(button.dataset.id, 'complete').catch(reportStorageError)));
}

async function loadSearch() {
    await BloodBankStorage.ready;
    const group = $('#search-group').value;
    const requests = BloodBankStorage.getRequests().filter(request => statusOf(request) === 'pending' && (!group || request.bloodGroup === group));
    const selected = $('#select-request').value;
    $('#select-request').innerHTML = '<option value="">Select a pending request</option>' + requests.map(request => `<option value="${request.id}">${escapeHtml(request.patientName)} · ${request.bloodGroup} · ${request.units} unit(s)</option>`).join('');
    if (requests.some(request => String(request.id) === String(selected))) $('#select-request').value = selected;
}

function emptyRow(columns, message) {
    return `<tr><td colspan="${columns}" class="empty-state">${message}</td></tr>`;
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'}[character]));
}

function validateDonor(donor) {
    if (!donor.name || !donor.gender || !donor.bloodGroup || !donor.phone || !donor.address) return 'Please complete every donor field.';
    if (donor.email && !emailPattern.test(donor.email)) return 'Please enter a valid donor email address.';
    if (!Number.isInteger(donor.age) || donor.age < 18 || donor.age > 65) return 'Donor age must be between 18 and 65.';
    if (!groups.includes(donor.bloodGroup)) return 'Please select a valid blood group.';
    if (!phonePattern.test(donor.phone)) return 'Please enter a valid donor phone number.';
    return '';
}

async function editDonor(id) {
    await BloodBankStorage.ready;
    const donor = BloodBankStorage.getDonors().find(item => String(item.id) === String(id));
    if (!donor) return showAlert('Donor could not be found.', 'error');
    $('#donor-id').value = donor.id;
    $('#donor-name').value = donor.name;
    $('#donor-email').value = donor.email || '';
    $('#donor-age').value = donor.age;
    $('#donor-gender').value = donor.gender;
    $('#donor-group').value = donor.bloodGroup;
    $('#donor-phone').value = donor.phone;
    $('#donor-address').value = donor.address;
    $('#donor-availability').value = donor.available === false ? 'false' : 'true';
    $('#donor-form-title').textContent = 'Update donor';
    $('#donor-form').classList.remove('hidden');
    window.scrollTo({top: 0, behavior: 'smooth'});
}

async function deleteDonor(id) {
    await BloodBankStorage.ready;
    if (!window.confirm('Delete this donor from the directory?')) return;
    await BloodBankStorage.deleteDonor(id);
    showAlert('Donor deleted.');
    await loadDonors();
    await loadDashboard();
}

function validateRequest(input) {
    if (!input.patientName || !input.bloodGroup || !input.contact) return 'Please complete every request field.';
    if (input.requesterEmail && !emailPattern.test(input.requesterEmail)) return 'Please enter a valid requester email address.';
    if (!Number.isInteger(input.patientAge) || input.patientAge < 0 || input.patientAge > 120) return 'Please enter a valid patient age.';
    if (!groups.includes(input.bloodGroup)) return 'Please select a valid blood group.';
    if (!Number.isInteger(input.units) || input.units <= 0) return 'Required units must be greater than 0.';
    if (!phonePattern.test(input.contact)) return 'Please enter a valid contact number.';
    return '';
}

async function updateRequest(id, action) {
    await BloodBankStorage.ready;
    const labels = {approve: 'Approve this request and deduct the units from stock?', reject: 'Reject this request?', complete: 'Mark this request as completed?'};
    if (!window.confirm(labels[action])) return;
    const request = BloodBankStorage.getRequests().find(item => String(item.id) === String(id));
    if (action === 'approve') await BloodBankStorage.approveRequest(id);
    if (action === 'reject') await BloodBankStorage.rejectRequest(id);
    if (action === 'complete') await BloodBankStorage.completeRequest(id);
    showAlert(action === 'approve'
        ? `Request approved. Demo approval email marked as sent to ${request?.requesterEmail || 'the requester'}.`
        : `Request ${action === 'reject' ? 'rejected' : 'completed'} successfully.`);
    await loadRequests();
    await loadDashboard();
    await loadStock();
    await loadSearch();
}

async function selectDonor(donorId) {
    await BloodBankStorage.ready;
    const requestId = $('#select-request').value;
    if (!requestId) return showAlert('Select a pending blood request before selecting a donor.', 'error');
    const donor = BloodBankStorage.getDonors().find(item => String(item.id) === String(donorId));
    const request = BloodBankStorage.getRequests().find(item => String(item.id) === String(requestId));
    if (!donor || !request) return showAlert('The donor or request could not be found. Refresh and try again.', 'error');
    if (donor.bloodGroup !== request.bloodGroup) return showAlert('The donor blood group does not match this request.', 'error');
    if (!window.confirm(`Are you sure you want to select this donor?\n\nDonor: ${donor.name}\nBlood Group: ${donor.bloodGroup}`)) return;
    await BloodBankStorage.selectDonor(requestId, donorId);
    showAlert(`✓ Donor selected successfully. Demo email marked as sent to ${donor.email || 'the donor'}.`);
    await loadSearch();
    await loadRequests();
    await loadDashboard();
}

$('#donor-form').addEventListener('submit', async event => {
    event.preventDefault();
    try {
        await BloodBankStorage.ready;
        const donors = BloodBankStorage.getDonors();
        const id = $('#donor-id').value;
        const previous = donors.find(item => String(item.id) === String(id));
        const donor = {id: id ? Number(id) : BloodBankStorage.nextId(donors), name: $('#donor-name').value.trim(), email: $('#donor-email').value.trim(), age: Number($('#donor-age').value), gender: $('#donor-gender').value, bloodGroup: $('#donor-group').value, phone: $('#donor-phone').value.trim(), address: $('#donor-address').value.trim(), available: $('#donor-availability').value !== 'false', currentlyAssigned: previous?.currentlyAssigned === true, ownerId: previous?.ownerId || BloodBankStorage.getCurrentUser().uid};
        const error = validateDonor(donor);
        if (error) return showAlert(error, 'error');
        await BloodBankStorage.saveDonor(donor);
        showAlert(id ? 'Donor updated.' : 'Donor added.');
        closeDonorForm();
        await loadDonors();
        await loadDashboard();
    } catch (error) { reportStorageError(error); }
});

async function changeStock(event, action) {
    event.preventDefault();
    try {
        await BloodBankStorage.ready;
        const group = $('#stock-group').value;
        const units = Number($('#stock-units').value);
        if (!groups.includes(group)) return showAlert('Please select a valid blood group.', 'error');
        if (!Number.isInteger(units) || units <= 0) return showAlert('Units must be a whole number greater than 0.', 'error');
        const stock = BloodBankStorage.getStock();
        if (action === 'remove' && stock[group] < units) return showAlert(`Cannot remove ${units} unit(s); only ${stock[group]} available.`, 'error');
        stock[group] += action === 'add' ? units : -units;
        await BloodBankStorage.saveStock(stock);
        showAlert(`Blood stock ${action === 'add' ? 'added' : 'removed'} successfully.`);
        $('#stock-form').reset();
        await loadStock();
        await loadDashboard();
    } catch (error) { reportStorageError(error); }
}

$('#stock-form').addEventListener('submit', event => changeStock(event, 'add'));
$('#remove-stock').addEventListener('click', event => changeStock(event, 'remove'));

$('#request-form').addEventListener('submit', async event => {
    event.preventDefault();
    try {
        await BloodBankStorage.ready;
        const requests = BloodBankStorage.getRequests();
        const request = {id: BloodBankStorage.nextId(requests), patientName: $('#patient-name').value.trim(), requesterName: $('#patient-name').value.trim(), requesterEmail: $('#patient-email').value.trim(), patientAge: Number($('#patient-age').value), contact: $('#patient-contact').value.trim(), bloodGroup: $('#request-group').value, units: Number($('#request-units').value), status: 'pending', createdAt: new Date().toISOString()};
        const error = validateRequest(request);
        if (error) return showAlert(error, 'error');
        await BloodBankStorage.createRequest(request);
        showAlert('Blood request created and added to the queue.');
        closeRequestForm();
        await loadRequests();
        await loadDashboard();
        await loadSearch();
    } catch (error) { reportStorageError(error); }
});

$('#search-button').addEventListener('click', async () => {
    try {
        await BloodBankStorage.ready;
        const group = $('#search-group').value;
        const query = $('#search-text').value.trim().toLowerCase();
        const requestId = $('#select-request').value;
        const request = BloodBankStorage.getRequests().find(item => String(item.id) === String(requestId));
        const donors = BloodBankStorage.getDonors().filter(donor => {
            const groupMatches = !group || donor.bloodGroup === group;
            const textMatches = !query || [donor.name, donor.phone, donor.address, donor.email].some(value => String(value || '').toLowerCase().includes(query));
            return groupMatches && textMatches;
        });
        $('#search-title').textContent = `${donors.length} matching donor${donors.length === 1 ? '' : 's'}`;
        $('#search-results').classList.remove('empty-state');
        $('#search-results').innerHTML = donors.length ? donors.map(donor => {
            const available = donor.available !== false && donor.currentlyAssigned !== true;
            const matchesRequest = request && request.bloodGroup === donor.bloodGroup;
            const canSelect = available && Boolean(request) && matchesRequest;
            const statusText = donor.currentlyAssigned ? '🟠 Currently assigned' : available ? '🟢 Available' : '🔴 Not Available';
            const buttonText = !request ? 'Select a request first' : !matchesRequest ? 'Blood group mismatch' : !available ? 'Not Available' : 'Select Donor';
            return `<div class="donor-result"><h4>${escapeHtml(donor.name)}</h4><p><strong>${escapeHtml(donor.bloodGroup)}</strong> · ${donor.age} yrs · ${escapeHtml(donor.gender)}</p><p>☎ ${escapeHtml(donor.phone)}</p><p>⌖ ${escapeHtml(donor.address)}</p><p class="availability ${available ? 'is-available' : 'is-unavailable'}">Status: ${statusText}</p><button class="primary-button select-donor" data-id="${donor.id}" ${canSelect ? '' : 'disabled'}>${buttonText}</button></div>`;
        }).join('') : 'No donor matches found.';
        $$('.select-donor').forEach(button => button.addEventListener('click', () => selectDonor(button.dataset.id).catch(reportStorageError)));
    } catch (error) { reportStorageError(error); }
});

function closeDonorForm() {
    $('#donor-form').reset();
    $('#donor-id').value = '';
    $('#donor-availability').value = 'true';
    $('#donor-form-title').textContent = 'Add a new donor';
    $('#donor-form').classList.add('hidden');
}

function closeRequestForm() {
    $('#request-form').reset();
    $('#request-form').classList.add('hidden');
}

$$('[data-section]').forEach(element => element.addEventListener('click', () => showSection(element.dataset.section)));
$('#show-donor-form').addEventListener('click', () => $('#donor-form').classList.remove('hidden'));
$('#cancel-donor').addEventListener('click', closeDonorForm);
$('#cancel-donor-2').addEventListener('click', closeDonorForm);
$('#show-request-form').addEventListener('click', () => $('#request-form').classList.remove('hidden'));
$('#cancel-request').addEventListener('click', closeRequestForm);
$('#cancel-request-2').addEventListener('click', closeRequestForm);
$('#refresh-stock').addEventListener('click', () => loadStock().catch(reportStorageError));
$('#refresh-requests').addEventListener('click', () => loadRequests().catch(reportStorageError));
$('#search-group').addEventListener('change', () => loadSearch().catch(reportStorageError));
$('#mobile-menu').addEventListener('click', () => $('.sidebar').classList.toggle('open'));
populateGroups();
BloodBankStorage.ready.then(() => loadDashboard()).catch(reportStorageError);
