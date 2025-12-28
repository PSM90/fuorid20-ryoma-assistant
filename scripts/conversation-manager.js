/**
 * Fuori D20: Ryoma Assistant
 * Conversation Memory Manager
 */

import { MODULE_ID, getSetting, setSetting } from './config.js';

/**
 * Manages conversation history persistence
 */
export class ConversationManager {
    static FLAG_KEY = 'conversationHistory';
    static MAX_HISTORY = 100; // Maximum messages to keep

    /**
     * Get all conversation history from the World
     * @returns {Promise<Array>} Array of conversation messages
     */
    static async getHistory() {
        try {
            // Get from world flags (The Forge compatible)
            const history = game.world.getFlag(MODULE_ID, this.FLAG_KEY) || [];
            return history;
        } catch (error) {
            console.error(`${MODULE_ID} | Error loading conversation history:`, error);
            return [];
        }
    }

    /**
     * Save a message to history
     * @param {string} role - 'user' or 'assistant'
     * @param {string} content - Message content
     * @param {Object} metadata - Additional metadata
     */
    static async saveMessage(role, content, metadata = {}) {
        try {
            const history = await this.getHistory();

            const message = {
                id: foundry.utils.randomID(),
                timestamp: new Date().toISOString(),
                role: role,
                content: content,
                metadata: {
                    userId: game.user.id,
                    userName: game.user.name,
                    model: metadata.model || null,
                    action: metadata.action || null,
                    actionData: metadata.actionData || null,
                    ...metadata
                }
            };

            history.push(message);

            // Trim to max history
            while (history.length > this.MAX_HISTORY) {
                history.shift();
            }

            // Save to world flags
            await game.world.setFlag(MODULE_ID, this.FLAG_KEY, history);

            return message;
        } catch (error) {
            console.error(`${MODULE_ID} | Error saving message:`, error);
            throw error;
        }
    }

    /**
     * Save a user message
     * @param {string} content - Message content
     */
    static async saveUserMessage(content) {
        return this.saveMessage('user', content);
    }

    /**
     * Save an assistant (Ryoma) message
     * @param {string} content - Message content
     * @param {Object} metadata - Additional metadata
     */
    static async saveAssistantMessage(content, metadata = {}) {
        return this.saveMessage('assistant', content, metadata);
    }

    /**
     * Get recent history for LLM context
     * @param {number} limit - Number of messages to retrieve
     * @returns {Promise<Array>} Recent messages formatted for LLM
     */
    static async getContextHistory(limit = 20) {
        const history = await this.getHistory();

        // Get last N messages
        const recent = history.slice(-limit);

        // Format for LLM API
        return recent.map(msg => ({
            role: msg.role,
            content: msg.content
        }));
    }

    /**
     * Get full history with metadata
     * @param {number} limit - Number of messages to retrieve
     * @returns {Promise<Array>} Recent messages with all metadata
     */
    static async getFullHistory(limit = 50) {
        const history = await this.getHistory();
        return history.slice(-limit);
    }

    /**
     * Clear all conversation history
     */
    static async clearHistory() {
        try {
            await game.world.unsetFlag(MODULE_ID, this.FLAG_KEY);
            console.log(`${MODULE_ID} | Conversation history cleared`);
        } catch (error) {
            console.error(`${MODULE_ID} | Error clearing history:`, error);
            throw error;
        }
    }

    /**
     * Get conversation statistics
     * @returns {Promise<Object>} Statistics about the conversation
     */
    static async getStats() {
        const history = await this.getHistory();

        const userMessages = history.filter(m => m.role === 'user').length;
        const assistantMessages = history.filter(m => m.role === 'assistant').length;
        const actionsPerformed = history.filter(m => m.metadata?.action).length;

        const firstMessage = history[0];
        const lastMessage = history[history.length - 1];

        return {
            totalMessages: history.length,
            userMessages,
            assistantMessages,
            actionsPerformed,
            firstMessageDate: firstMessage?.timestamp || null,
            lastMessageDate: lastMessage?.timestamp || null
        };
    }

    /**
     * Search through conversation history
     * @param {string} query - Search query
     * @returns {Promise<Array>} Matching messages
     */
    static async search(query) {
        const history = await this.getHistory();
        const lowerQuery = query.toLowerCase();

        return history.filter(msg =>
            msg.content.toLowerCase().includes(lowerQuery)
        );
    }

    /**
     * Get messages related to a specific action type
     * @param {string} actionType - Action type to filter by
     * @returns {Promise<Array>} Messages with that action
     */
    static async getByAction(actionType) {
        const history = await this.getHistory();
        return history.filter(msg => msg.metadata?.action === actionType);
    }

    /**
     * Export conversation history as JSON
     * @returns {Promise<string>} JSON string of history
     */
    static async exportHistory() {
        const history = await this.getHistory();
        return JSON.stringify(history, null, 2);
    }

    /**
     * Import conversation history from JSON
     * @param {string} jsonString - JSON string to import
     */
    static async importHistory(jsonString) {
        try {
            const imported = JSON.parse(jsonString);
            if (!Array.isArray(imported)) {
                throw new Error('Invalid history format');
            }

            // Validate structure
            for (const msg of imported) {
                if (!msg.role || !msg.content) {
                    throw new Error('Invalid message format');
                }
            }

            await game.world.setFlag(MODULE_ID, this.FLAG_KEY, imported);
            console.log(`${MODULE_ID} | Imported ${imported.length} messages`);
        } catch (error) {
            console.error(`${MODULE_ID} | Error importing history:`, error);
            throw error;
        }
    }

    /**
     * Create a summary of recent context for the LLM
     * @param {number} recentCount - Number of recent messages to include in full
     * @returns {Promise<string>} Context summary string
     */
    static async buildContextSummary(recentCount = 10) {
        const history = await this.getHistory();

        if (history.length === 0) {
            return '';
        }

        // If we have few messages, just use them all
        if (history.length <= recentCount) {
            return '';
        }

        // For older messages, create a brief summary
        const oldMessages = history.slice(0, -recentCount);
        const topics = new Set();
        const actions = [];

        for (const msg of oldMessages) {
            // Extract key topics (simple extraction)
            if (msg.metadata?.action) {
                actions.push({
                    action: msg.metadata.action,
                    data: msg.metadata.actionData
                });
            }
        }

        let summary = '';
        if (actions.length > 0) {
            summary = `Nelle conversazioni precedenti, abbiamo: `;
            const actionSummaries = actions.map(a => {
                if (a.action === 'create_actor') {
                    return `creato l'Actor "${a.data?.name || 'sconosciuto'}"`;
                } else if (a.action === 'modify_actor') {
                    return `modificato un Actor`;
                } else if (a.action === 'create_item') {
                    return `creato l'Item "${a.data?.name || 'sconosciuto'}"`;
                }
                return null;
            }).filter(Boolean);

            summary += actionSummaries.join(', ') + '.';
        }

        return summary;
    }
}
