import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    getFirestore,
    runTransaction,
    serverTimestamp,
    setDoc
} from 'firebase/firestore';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const requiredConfig = ['apiKey', 'authDomain', 'projectId', 'appId'];
const missingConfig = requiredConfig.filter(key => !firebaseConfig[key]);
if (missingConfig.length) {
    throw new Error(`Missing Firebase configuration: ${missingConfig.join(', ')}`);
}

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const database = getFirestore(firebaseApp);
const GROUPS = Object.freeze(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']);
const collectionNames = {
    donors: import.meta.env.VITE_FIREBASE_DONORS_COLLECTION || 'donors',
    stock: import.meta.env.VITE_FIREBASE_STOCK_COLLECTION || 'bloodStock',
    requests: import.meta.env.VITE_FIREBASE_REQUESTS_COLLECTION || 'bloodRequests'
};

const emptyStock = () => GROUPS.reduce((stock, group) => {
    stock[group] = 0;
    return stock;
}, {});

const cache = {donors: [], stock: emptyStock(), requests: []};

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function numericId(id) {
    return Number.isFinite(Number(id)) ? Number(id) : id;
}

async function readCollection(name) {
    const snapshot = await getDocs(collection(database, name));
    return snapshot.docs.map(item => ({id: numericId(item.id), ...item.data()}));
}

async function loadAll() {
    const [donors, requests, stockSnapshot] = await Promise.all([
        readCollection(collectionNames.donors),
        readCollection(collectionNames.requests),
        getDoc(doc(database, collectionNames.stock, 'current'))
    ]);
    cache.donors = donors;
    cache.requests = requests;
    cache.stock = {...emptyStock(), ...(stockSnapshot.exists() ? stockSnapshot.data() : {})};
}

function currentUser() {
    if (!auth.currentUser) throw new Error('Firebase authentication is not ready.');
    return auth.currentUser;
}

async function ensureAnonymousUser() {
    if (auth.currentUser) return auth.currentUser;
    const credentials = await signInAnonymously(auth);
    return credentials.user;
}

const ready = ensureAnonymousUser().then(loadAll);

const BloodBankStorage = Object.freeze({
    GROUPS,
    ready,

    getCurrentUser() {
        return currentUser();
    },

    getDonors() {
        return clone(cache.donors);
    },

    async saveDonor(donor) {
        const record = clone(donor);
        await setDoc(doc(database, collectionNames.donors, String(record.id)), record, {merge: true});
        cache.donors = cache.donors.some(item => String(item.id) === String(record.id))
            ? cache.donors.map(item => String(item.id) === String(record.id) ? {...item, ...record} : item)
            : [...cache.donors, record];
    },

    async deleteDonor(id) {
        await deleteDoc(doc(database, collectionNames.donors, String(id)));
        cache.donors = cache.donors.filter(item => String(item.id) !== String(id));
    },

    async updateDonorAvailability(id, available) {
        const user = currentUser();
        const donorReference = doc(database, collectionNames.donors, String(id));
        await runTransaction(database, async transaction => {
            const donorSnapshot = await transaction.get(donorReference);
            if (!donorSnapshot.exists()) throw new Error('Donor could not be found.');
            const donor = donorSnapshot.data();
            if (donor.ownerId && donor.ownerId !== user.uid) {
                throw new Error('You can only change your own donor availability.');
            }
            transaction.set(donorReference, {available: Boolean(available), ownerId: donor.ownerId || user.uid}, {merge: true});
        });
        cache.donors = cache.donors.map(item => String(item.id) === String(id)
            ? {...item, available: Boolean(available), ownerId: item.ownerId || user.uid}
            : item);
    },

    getStock() {
        return clone(cache.stock);
    },

    async saveStock(stock) {
        cache.stock = {...emptyStock(), ...stock};
        await setDoc(doc(database, collectionNames.stock, 'current'), cache.stock, {merge: true});
    },

    getRequests() {
        return clone(cache.requests);
    },

    async createRequest(request) {
        const user = currentUser();
        const record = {...clone(request), requesterId: user.uid};
        await setDoc(doc(database, collectionNames.requests, String(record.id)), record);
        cache.requests = [...cache.requests, record];
    },

    async selectDonor(requestId, donorId) {
        const user = currentUser();
        const donorReference = doc(database, collectionNames.donors, String(donorId));
        const requestReference = doc(database, collectionNames.requests, String(requestId));
        let selected;

        await runTransaction(database, async transaction => {
            const [donorSnapshot, requestSnapshot] = await Promise.all([
                transaction.get(donorReference),
                transaction.get(requestReference)
            ]);
            if (!donorSnapshot.exists()) throw new Error('Donor could not be found.');
            if (!requestSnapshot.exists()) throw new Error('Blood request could not be found.');

            const donor = donorSnapshot.data();
            const request = requestSnapshot.data();
            const status = String(request.status || 'pending').toLowerCase();
            if (request.requesterId && request.requesterId !== user.uid) throw new Error('You can only manage your own request.');
            if (status !== 'pending') throw new Error('This request already has a donor or has been completed.');
            if (donor.available === false || donor.currentlyAssigned === true) {
                throw new Error('Unable to select this donor because they are no longer available.');
            }
            selected = {
                requestId: requestSnapshot.id,
                selectedDonorId: donorSnapshot.id,
                selectedDonorName: donor.name || 'Donor',
                selectedDonorEmail: donor.email || '',
                selectedDonorPhone: donor.phone || '',
                selectedAt: serverTimestamp(),
                requesterId: user.uid,
                status: 'donor_selected'
            };
            transaction.set(donorReference, {currentlyAssigned: true, currentRequestId: requestSnapshot.id}, {merge: true});
            transaction.set(requestReference, selected, {merge: true});
        });

        cache.donors = cache.donors.map(item => String(item.id) === String(donorId)
            ? {...item, currentlyAssigned: true, currentRequestId: String(requestId)}
            : item);
        cache.requests = cache.requests.map(item => String(item.id) === String(requestId)
            ? {...item, ...selected, selectedAt: new Date().toISOString()}
            : item);
    },

    async approveRequest(requestId) {
        const requestReference = doc(database, collectionNames.requests, String(requestId));
        const stockReference = doc(database, collectionNames.stock, 'current');
        let updatedRequest;
        let stockAfter;

        await runTransaction(database, async transaction => {
            const [requestSnapshot, stockSnapshot] = await Promise.all([
                transaction.get(requestReference),
                transaction.get(stockReference)
            ]);
            if (!requestSnapshot.exists()) throw new Error('Blood request could not be found.');
            const request = requestSnapshot.data();
            const status = String(request.status || 'pending').toLowerCase();
            if (!['pending', 'donor_selected'].includes(status)) throw new Error('Only pending requests can be approved.');
            const stock = {...emptyStock(), ...(stockSnapshot.exists() ? stockSnapshot.data() : {})};
            const units = Number(request.units);
            if (!Number.isInteger(units) || units <= 0 || Number(stock[request.bloodGroup] || 0) < units) {
                throw new Error(`Not enough ${request.bloodGroup} stock to approve this request.`);
            }
            stock[request.bloodGroup] -= units;
            updatedRequest = {status: 'approved', approvedAt: serverTimestamp()};
            stockAfter = stock;
            transaction.set(stockReference, stock, {merge: true});
            transaction.set(requestReference, updatedRequest, {merge: true});
        });

        cache.stock = stockAfter;
        cache.requests = cache.requests.map(item => String(item.id) === String(requestId)
            ? {...item, ...updatedRequest, status: 'approved', approvedAt: new Date().toISOString()}
            : item);
    },

    async rejectRequest(requestId) {
        await this._releaseDonorAndSetStatus(requestId, 'rejected');
    },

    async completeRequest(requestId) {
        await this._releaseDonorAndSetStatus(requestId, 'completed');
    },

    async _releaseDonorAndSetStatus(requestId, status) {
        const requestReference = doc(database, collectionNames.requests, String(requestId));
        await runTransaction(database, async transaction => {
            const requestSnapshot = await transaction.get(requestReference);
            if (!requestSnapshot.exists()) throw new Error('Blood request could not be found.');
            const request = requestSnapshot.data();
            if (request.selectedDonorId) {
                transaction.set(doc(database, collectionNames.donors, String(request.selectedDonorId)), {
                    currentlyAssigned: false,
                    currentRequestId: null
                }, {merge: true});
            }
            transaction.set(requestReference, {status}, {merge: true});
        });
        cache.requests = cache.requests.map(item => String(item.id) === String(requestId) ? {...item, status} : item);
        const request = cache.requests.find(item => String(item.id) === String(requestId));
        if (request?.selectedDonorId) {
            cache.donors = cache.donors.map(item => String(item.id) === String(request.selectedDonorId)
                ? {...item, currentlyAssigned: false, currentRequestId: null}
                : item);
        }
    },

    nextId(items) {
        return items.reduce((largest, item) => Math.max(largest, Number(item.id) || 0), 0) + 1;
    }
});

export default BloodBankStorage;
