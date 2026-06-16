import { state } from '../state.js';
import { sounds } from '../audio.js';
import { syncState } from '../db.js';
import { dom } from '../dom.js';

export function initStreaksEvents(): void {
    // Streaks Settings Toggle Listeners
    const streakOptOverspending = dom.get<HTMLInputElement>('streak-opt-overspending');
    if (streakOptOverspending) {
        streakOptOverspending.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            state.streakOptOverspending = target.checked;
            if (target.checked) {
                if (!state.streakStartOverspending) {
                    state.streakStartOverspending = new Date().toISOString();
                }
            } else {
                state.streakStartOverspending = null;
            }
            sounds.click();
            syncState();
        });
    }

    const streakOptTakeout = dom.get<HTMLInputElement>('streak-opt-takeout');
    if (streakOptTakeout) {
        streakOptTakeout.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            state.streakOptTakeout = target.checked;
            if (target.checked) {
                if (!state.streakStartTakeout) {
                    state.streakStartTakeout = new Date().toISOString();
                }
            } else {
                state.streakStartTakeout = null;
            }
            sounds.click();
            syncState();
        });
    }

    const streakOptSaving = dom.get<HTMLInputElement>('streak-opt-saving');
    if (streakOptSaving) {
        streakOptSaving.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            state.streakOptSaving = target.checked;
            if (target.checked) {
                if (!state.streakStartSaving) {
                    state.streakStartSaving = new Date().toISOString();
                }
            } else {
                state.streakStartSaving = null;
            }
            sounds.click();
            syncState();
        });
    }
}
