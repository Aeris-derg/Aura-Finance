import { context } from './js/state.js';
import { joinGroup } from './js/db.js';
import { updateUI } from './js/ui/index.js';
import { initAllEvents } from './js/events/index.js';

// Registers all DOM interaction event listeners
initAllEvents();

// Check initial load state
if (context.currentGroupId) {
    joinGroup(context.currentGroupId);
} else {
    updateUI(); // This will display the setup/join modal
}
