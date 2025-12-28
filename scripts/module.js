/**
 * Fuori D20: Ryoma Assistant
 * Main Module Entry Point
 */

import { MODULE_ID, MODULE_NAME, registerSettings, hasApiKey } from './config.js';
import { ChatHandler } from './chat-handler.js';
import { ConversationManager } from './conversation-manager.js';
import { PartyAnalyzer } from './party-analyzer.js';
import { CompendiumBrowser } from './compendium-browser.js';
import { ActorManager } from './actor-manager.js';
import { ItemManager } from './item-manager.js';
import { LLMClient } from './llm-client.js';

/**
 * Module initialization
 */
Hooks.once('init', async () => {
    console.log(`${MODULE_ID} | Initializing ${MODULE_NAME}`);

    // Register module settings
    registerSettings();

    // Register Handlebars helpers
    registerHandlebarsHelpers();

    // Load templates
    await loadTemplates([
        `modules/${MODULE_ID}/templates/party-selector.hbs`,
        `modules/${MODULE_ID}/templates/compendium-config.hbs`,
        `modules/${MODULE_ID}/templates/confirmation-dialog.hbs`,
        `modules/${MODULE_ID}/templates/clear-history.hbs`
    ]);

    console.log(`${MODULE_ID} | Initialization complete`);
});

/**
 * Module ready
 */
Hooks.once('ready', async () => {
    console.log(`${MODULE_ID} | Module ready`);

    // Initialize chat handler
    ChatHandler.init();

    // Check API key and show warning if not configured
    if (!hasApiKey() && game.user.isGM) {
        ui.notifications.warn(
            `${MODULE_NAME}: API Key non configurata. Vai nelle impostazioni del modulo per configurarla.`,
            { permanent: true }
        );
    }

    // Log conversation stats
    if (game.user.isGM) {
        const stats = await ConversationManager.getStats();
        if (stats.totalMessages > 0) {
            console.log(`${MODULE_ID} | Loaded ${stats.totalMessages} messages from history`);
        }
    }

    // Expose API for external access
    game.modules.get(MODULE_ID).api = {
        ChatHandler,
        ConversationManager,
        PartyAnalyzer,
        CompendiumBrowser,
        ActorManager,
        ItemManager,
        LLMClient,

        // Convenience methods
        async chat(message) {
            return ChatHandler.processMessage(message);
        },

        async getPartyInfo() {
            return PartyAnalyzer.analyzeParty();
        },

        async searchCompendium(category, query) {
            return CompendiumBrowser.search(category, query);
        },

        async getConversationHistory() {
            return ConversationManager.getFullHistory();
        },

        async clearConversationHistory() {
            return ConversationManager.clearHistory();
        }
    };

    console.log(`${MODULE_ID} | API exposed at game.modules.get('${MODULE_ID}').api`);
});

/**
 * Handle chat message hook for confirmation commands
 */
Hooks.on('chatMessage', (chatLog, content, chatData) => {
    const trimmed = content.trim();

    // Check for !R prefix
    if (!trimmed.startsWith('!R')) {
        return true;
    }

    const message = trimmed.substring(2).trim().toLowerCase();

    // Check if this is a confirmation response
    if (ChatHandler.pendingConfirmation) {
        if (message === 'conferma' || message === 'sì' || message === 'si' || message === 'ok') {
            ChatHandler.handleConfirmation(true);
            return false;
        }
        if (message === 'annulla' || message === 'no' || message === 'cancella') {
            ChatHandler.handleConfirmation(false);
            return false;
        }
    }

    // Otherwise, let ChatHandler.onChatMessage handle it
    return true;
});

/**
 * Add Ryoma button to actor sheet header (optional)
 */
Hooks.on('getActorSheetHeaderButtons', (sheet, buttons) => {
    if (!game.user.isGM) return;

    buttons.unshift({
        label: 'Ryoma',
        class: 'rioma-analyze',
        icon: 'fas fa-magic',
        onclick: async () => {
            const actor = sheet.actor;
            const message = `Analizza questo personaggio e dimmi cosa ne pensi: ${actor.name}`;

            // Send to chat
            const chatInput = document.querySelector('#chat-message');
            if (chatInput) {
                chatInput.value = `!R ${message}`;
                chatInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
            }
        }
    });
});

/**
 * Register Handlebars helpers
 */
function registerHandlebarsHelpers() {
    // Check if value is in array
    Handlebars.registerHelper('includes', function (array, value) {
        return Array.isArray(array) && array.includes(value);
    });

    // Localize with module prefix
    Handlebars.registerHelper('riomaLoc', function (key) {
        return game.i18n.localize(`RYOMA.${key}`);
    });

    // Format date
    Handlebars.registerHelper('formatDate', function (dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleString('it-IT');
    });

    // Truncate text
    Handlebars.registerHelper('truncate', function (text, length) {
        if (!text) return '';
        if (text.length <= length) return text;
        return text.substring(0, length) + '...';
    });

    // Check equality
    Handlebars.registerHelper('eq', function (a, b) {
        return a === b;
    });

    // Object entries iteration
    Handlebars.registerHelper('eachInObject', function (object, options) {
        let result = '';
        for (const [key, value] of Object.entries(object)) {
            result += options.fn({ key, value, ...value });
        }
        return result;
    });
}

/**
 * Socket handling for multi-user scenarios (if needed)
 */
Hooks.once('ready', () => {
    game.socket.on(`module.${MODULE_ID}`, async (data) => {
        if (data.action === 'refresh') {
            // Refresh UI if needed
            ui.chat.render();
        }
    });
});

// Log module load
console.log(`${MODULE_ID} | Module script loaded`);
