import { state, context, updateState, AppState } from './state.js';
import { applyTheme, applyDarkMode, updateUI } from './ui/index.js';
import { invalidateCache } from './budget.js';

const firebaseConfig = {
  apiKey: "PLACEHOLDER_FIREBASE_API",
  authDomain: "aura-finance-6b6b3.firebaseapp.com",
  projectId: "aura-finance-6b6b3",
  storageBucket: "aura-finance-6b6b3.firebasestorage.app",
  messagingSenderId: "535623897451",
  appId: "1:535623897451:web:23f202435008018519fc2e",
  databaseURL: "https://aura-finance-6b6b3-default-rtdb.europe-west1.firebasedatabase.app/"
};

// Initialize Firebase (assumes Firebase compat library is loaded globally)
firebase.initializeApp(firebaseConfig);
export const db: any = firebase.database();

// Track connection status
db.ref('.info/connected').on('value', (snap: any) => {
    if (snap.val() === true) {
        console.log("Connected to Firebase RTDB");
    } else {
        console.log("Disconnected from Firebase RTDB (or attempting to connect...)");
    }
});

export function syncState(): void {
    invalidateCache();
    if (context.dbRef) {
        context.dbRef.set(state).catch((err: Error) => {
            console.error("Firebase syncState write error:", err);
            alert("Failed to sync data with database: " + err.message);
        });
    }
}

export function joinGroup(groupId: string, isNewCreation = false, initialSetupData: AppState | null = null): void {
    const sanitizedGroupId = groupId.trim().toLowerCase().replace(/[^a-z0-9-_]/g, ''); // sanitize ID
    if (!sanitizedGroupId) return;

    context.currentGroupId = sanitizedGroupId;
    localStorage.setItem('aura_group_id', sanitizedGroupId);
    
    const headerGroupId = document.getElementById('header-group-id');
    if (headerGroupId) {
        headerGroupId.textContent = sanitizedGroupId;
    }

    if (context.dbRef) {
        context.dbRef.off(); // Detach previous listeners
    }

    context.dbRef = db.ref('groups/' + sanitizedGroupId);

    // If it's a new creation, set the initial data first
    if (isNewCreation && initialSetupData) {
        updateState(initialSetupData);
        context.dbRef.set(state).catch((err: Error) => {
            console.error("Firebase write error:", err);
            alert("Failed to initialize group settings in database: " + err.message + "\n\nPlease check your Firebase Realtime Database Rules.");
        });
    }

    // Attach real-time listener with error callback
    context.dbRef.on('value', (snapshot: any) => {
        const val = snapshot.val();
        if (val) {
            invalidateCache();
            // Merge defaults in case new fields were added
            updateState(val);
            applyTheme(state.themeColor);
            applyDarkMode(state.isDarkMode);
            updateUI();
        } else {
            // Group exists on client but not on DB (e.g. wiped or initialized without data)
            if (!isNewCreation) {
                // Prompt setup again
                localStorage.removeItem('aura_group_id');
                context.currentGroupId = null;
                context.dbRef = null;
                updateUI();
            }
        }
    }, (error: Error) => {
        console.error("Firebase sync error:", error);
        alert("Permission denied or database connection failed.\n\nPlease ensure your Firebase Realtime Database rules allow Read/Write access.");
    });
}
