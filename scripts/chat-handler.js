/**
 * Fuori D20: Ryoma Assistant
 * Chat Handler - Intercepts and processes !R commands
 */

import { MODULE_ID, CHAT_PREFIX, hasApiKey, getSetting, getModelDisplayName } from './config.js';
import { LLMClient } from './llm-client.js';
import { ConversationManager } from './conversation-manager.js';
import { PartyAnalyzer } from './party-analyzer.js';
import { CompendiumBrowser } from './compendium-browser.js';
import { ActorManager } from './actor-manager.js';
import { ItemManager } from './item-manager.js';

/**
 * Handles chat message interception and LLM communication
 */
export class ChatHandler {
    static isProcessing = false;
    static pendingConfirmation = null;

    /**
     * Initialize the chat handler
     */
    static init() {
        // Hook into chat message creation
        Hooks.on('chatMessage', this.onChatMessage.bind(this));

        console.log(`${MODULE_ID} | Chat handler initialized`);
    }

    /**
     * Handle incoming chat messages
     * @param {ChatLog} chatLog - The chat log
     * @param {string} content - Message content
     * @param {Object} chatData - Chat data
     * @returns {boolean} Whether to prevent default handling
     */
    static onChatMessage(chatLog, content, chatData) {
        // Check if message starts with our prefix
        const trimmed = content.trim();
        if (!trimmed.startsWith(CHAT_PREFIX)) {
            return true; // Let normal processing continue
        }

        // Extract the actual message
        const message = trimmed.substring(CHAT_PREFIX.length).trim();

        // Process asynchronously
        this.processMessage(message).catch(error => {
            console.error(`${MODULE_ID} | Error processing message:`, error);
            this.sendErrorMessage(error.message);
        });

        // Prevent default chat handling
        return false;
    }

    /**
     * Process a user message
     * @param {string} message - User message
     */
    static async processMessage(message) {
        // Check permissions
        if (!this.checkPermissions()) {
            this.sendChatMessage(
                game.i18n.localize('RYOMA.Chat.NoPermission'),
                { isError: true }
            );
            return;
        }

        // Check API key
        if (!hasApiKey()) {
            this.sendChatMessage(
                game.i18n.localize('RYOMA.Chat.NoApiKey'),
                { isError: true }
            );
            return;
        }

        // Prevent concurrent processing
        if (this.isProcessing) {
            this.sendChatMessage('Ryoma sta ancora elaborando la richiesta precedente...', { isError: true });
            return;
        }

        this.isProcessing = true;

        try {
            // Show user message in chat
            await this.sendUserMessage(message);

            // Show thinking indicator
            const thinkingMsgId = await this.showThinking();

            // Build context
            const context = await this.buildContext();

            // Save user message to history
            await ConversationManager.saveUserMessage(message);

            // Process with LLM
            const response = await LLMClient.processMessage(message, context);

            // Remove thinking indicator
            this.removeThinking(thinkingMsgId);

            // Handle response
            await this.handleResponse(response, message, context);

        } catch (error) {
            console.error(`${MODULE_ID} | Error:`, error);
            this.sendErrorMessage(error.message);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Check if current user has permission
     * @returns {boolean}
     */
    static checkPermissions() {
        return game.user.isGM || game.user.role >= CONST.USER_ROLES.ASSISTANT;
    }

    /**
     * Build context for LLM
     * @returns {Promise<Object>}
     */
    static async buildContext() {
        // Get conversation history
        const history = await ConversationManager.getContextHistory(20);

        // Get party info
        const partyContext = await PartyAnalyzer.getContextForLLM();

        // Get configured compendiums
        const compendiums = await CompendiumBrowser.getAllConfiguredCompendiums();

        return {
            history,
            party: partyContext.party,
            averageLevel: partyContext.averageLevel,
            partySize: partyContext.partySize,
            partySummary: partyContext.summary,
            compendiums
        };
    }

    /**
     * Handle LLM response
     * @param {Object} response - Parsed LLM response
     * @param {string} originalMessage - Original user message
     * @param {Object} context - Context used
     */
    static async handleResponse(response, originalMessage, context) {
        // Check for tool calls that need execution
        if (response.toolCalls && response.toolCalls.length > 0) {
            await this.handleToolCalls(response, originalMessage, context);
        } else {
            // Regular text response
            await this.sendAssistantMessage(response.content, {
                model: response.modelDisplayName
            });

            // Save to history
            await ConversationManager.saveAssistantMessage(response.content, {
                model: response.modelUsed
            });
        }
    }

    /**
     * Handle tool calls from LLM
     * @param {Object} response - LLM response with tool calls
     * @param {string} originalMessage - Original user message  
     * @param {Object} context - Context used
     */
    static async handleToolCalls(response, originalMessage, context) {
        const toolResults = [];
        let requiresConfirmation = false;
        let confirmationData = null;

        for (const toolCall of response.toolCalls) {
            switch (toolCall.name) {
                case 'search_compendium': {
                    const searchResult = await CompendiumBrowser.search(
                        toolCall.arguments.category,
                        toolCall.arguments.query,
                        toolCall.arguments.limit || 10
                    );
                    toolResults.push({
                        callId: toolCall.id,
                        result: searchResult
                    });
                    break;
                }

                case 'get_party_info': {
                    const partyInfo = await PartyAnalyzer.analyzeParty();
                    toolResults.push({
                        callId: toolCall.id,
                        result: partyInfo
                    });
                    break;
                }

                case 'get_actor_info': {
                    const actorInfo = await ActorManager.getActorInfo(
                        toolCall.arguments.uuid ||
                        ActorManager.findActorByName(toolCall.arguments.name)?.uuid
                    );
                    toolResults.push({
                        callId: toolCall.id,
                        result: actorInfo
                    });
                    break;
                }

                case 'create_actor': {
                    requiresConfirmation = true;
                    confirmationData = {
                        type: 'create_actor',
                        data: toolCall.arguments,
                        recap: ActorManager.buildCreationRecap(toolCall.arguments),
                        toolCallId: toolCall.id
                    };
                    break;
                }

                case 'modify_actor': {
                    requiresConfirmation = true;
                    confirmationData = {
                        type: 'modify_actor',
                        data: toolCall.arguments,
                        toolCallId: toolCall.id
                    };
                    break;
                }

                case 'create_item': {
                    requiresConfirmation = true;
                    confirmationData = {
                        type: 'create_item',
                        data: toolCall.arguments,
                        recap: ItemManager.buildCreationRecap(toolCall.arguments),
                        toolCallId: toolCall.id
                    };
                    break;
                }
            }
        }

        // If we have tool results (searches, info), continue the conversation
        if (toolResults.length > 0 && !requiresConfirmation) {
            // Build messages for continuation
            const messages = [
                { role: 'system', content: LLMClient.buildSystemPrompt(context) },
                ...context.history,
                { role: 'user', content: originalMessage },
                { role: 'assistant', content: response.content, tool_calls: response.toolCalls }
            ];

            const continuation = await LLMClient.continueWithToolResults(messages, toolResults, context);

            await this.sendAssistantMessage(continuation.content, {
                model: continuation.modelDisplayName
            });

            await ConversationManager.saveAssistantMessage(continuation.content, {
                model: continuation.modelUsed
            });
        }

        // If confirmation is required, show the confirmation dialog
        if (requiresConfirmation) {
            // First show the recap message
            const recapMessage = this.buildRecapMessage(confirmationData);
            await this.sendAssistantMessage(recapMessage, {
                model: response.modelDisplayName,
                showConfirmation: true,
                confirmationData: confirmationData
            });

            // Store pending confirmation
            this.pendingConfirmation = {
                ...confirmationData,
                originalMessage,
                context,
                response
            };
        }
    }

    /**
     * Build recap message for confirmation
     * @param {Object} confirmationData - Confirmation data
     * @returns {string} Recap message
     */
    static buildRecapMessage(confirmationData) {
        const { type, data, recap } = confirmationData;

        let message = '';

        if (type === 'create_actor') {
            message = `🐺 **Posso creare questo Actor per te:**\n\n`;
            message += `**Nome:** ${data.name}\n`;
            message += `**Tipo:** ${data.type === 'npc' ? 'NPC' : 'Personaggio'}\n`;

            if (data.cr !== undefined) message += `**GS:** ${data.cr}\n`;
            if (data.hp) message += `**HP:** ${data.hp.max || data.hp.value}\n`;
            if (data.ac) message += `**CA:** ${data.ac.value || data.ac}\n`;

            if (data.abilities) {
                const abStr = Object.entries(data.abilities)
                    .map(([k, v]) => `${k.toUpperCase()}: ${typeof v === 'object' ? v.value : v}`)
                    .join(', ');
                message += `**Caratteristiche:** ${abStr}\n`;
            }

            if (data.items && data.items.length > 0) {
                message += `\n**Items:**\n`;
                for (const item of data.items) {
                    const source = item.fromCompendium ? '📚 (compendio)' : '✨ (creato)';
                    message += `- ${item.name} ${source}\n`;
                }
            }

            if (data.biography) {
                message += `\n**Background:** ${data.biography.substring(0, 200)}${data.biography.length > 200 ? '...' : ''}\n`;
            }

        } else if (type === 'create_item') {
            message = `🐺 **Posso creare questo oggetto per te:**\n\n`;
            message += `**Nome:** ${data.name}\n`;
            message += `**Tipo:** ${data.type}\n`;

            if (recap.details) {
                for (const detail of recap.details) {
                    message += `**${detail.label}:** ${detail.value}\n`;
                }
            }

        } else if (type === 'modify_actor') {
            message = `🐺 **Posso applicare queste modifiche:**\n\n`;
            message += `**Actor:** ${data.uuid}\n`;
            message += `**Modifiche:**\n`;

            for (const [key, value] of Object.entries(data.changes)) {
                message += `- ${key}: ${JSON.stringify(value)}\n`;
            }
        }

        message += `\n*Vuoi procedere? Rispondi con "!R conferma" o "!R annulla"*`;

        return message;
    }

    /**
     * Handle confirmation response
     * @param {boolean} confirmed - Whether user confirmed
     */
    static async handleConfirmation(confirmed) {
        if (!this.pendingConfirmation) {
            await this.sendAssistantMessage('Non c\'è nessuna operazione in sospeso.');
            return;
        }

        const pending = this.pendingConfirmation;
        this.pendingConfirmation = null;

        if (!confirmed) {
            await this.sendAssistantMessage(game.i18n.localize('RYOMA.Actions.Cancelled'));
            await ConversationManager.saveAssistantMessage('Operazione annullata dall\'utente.', {
                action: pending.type,
                actionData: { status: 'cancelled' }
            });
            return;
        }

        try {
            let result;
            let successMessage;

            switch (pending.type) {
                case 'create_actor':
                    result = await ActorManager.createActor(pending.data);
                    successMessage = `✅ Ho creato l'Actor **${result.name}**! Puoi trovarlo nella lista degli Actors.`;
                    break;

                case 'modify_actor':
                    result = await ActorManager.modifyActor(pending.data.uuid, pending.data.changes);
                    successMessage = `✅ Ho modificato l'Actor **${result.name}**.`;
                    break;

                case 'create_item':
                    const targetActor = pending.data.targetActorUuid
                        ? await fromUuid(pending.data.targetActorUuid)
                        : null;
                    result = await ItemManager.createItem(pending.data, targetActor);
                    if (targetActor) {
                        successMessage = `✅ Ho creato l'oggetto **${result.name}** e l'ho aggiunto a ${targetActor.name}.`;
                    } else {
                        successMessage = `✅ Ho creato l'oggetto **${result.name}**! Puoi trovarlo nella lista degli Items.`;
                    }
                    break;
            }

            await this.sendAssistantMessage(successMessage);
            await ConversationManager.saveAssistantMessage(successMessage, {
                action: pending.type,
                actionData: {
                    status: 'completed',
                    name: result.name,
                    uuid: result.uuid
                }
            });

        } catch (error) {
            this.sendErrorMessage(`Errore durante la creazione: ${error.message}`);
        }
    }

    /**
     * Send user message to chat
     * @param {string} content - Message content
     */
    static async sendUserMessage(content) {
        const messageData = {
            content: `<div class="rioma-user-message"><strong>${game.user.name}:</strong> ${content}</div>`,
            speaker: ChatMessage.getSpeaker({ user: game.user }),
            type: CONST.CHAT_MESSAGE_TYPES.OOC
        };

        await ChatMessage.create(messageData);
    }

    /**
     * Send Ryoma's message to chat
     * @param {string} content - Message content
     * @param {Object} options - Additional options
     */
    static async sendAssistantMessage(content, options = {}) {
        const modelInfo = options.model ? `<span class="rioma-model">${options.model}</span>` : '';

        const html = `
      <div class="rioma-chat-message">
        <div class="rioma-header">
          <div class="rioma-avatar">🐺</div>
          <span class="ryoma-name">Ryoma</span>
          ${modelInfo}
        </div>
        <div class="rioma-content">${this.formatContent(content)}</div>
      </div>
    `;

        const messageData = {
            content: html,
            speaker: { alias: 'Ryoma' },
            type: CONST.CHAT_MESSAGE_TYPES.OOC,
            flags: {
                [MODULE_ID]: {
                    isRyomaMessage: true,
                    ...options
                }
            }
        };

        await ChatMessage.create(messageData);
    }

    /**
     * Send error message to chat
     * @param {string} error - Error message
     */
    static sendErrorMessage(error) {
        const html = `
      <div class="rioma-chat-message rioma-error">
        <div class="rioma-header">
          <div class="rioma-avatar">🐺</div>
          <span class="ryoma-name">Ryoma</span>
        </div>
        <div class="rioma-content">
          ❌ ${game.i18n.format('RYOMA.Chat.Error', { error })}
        </div>
      </div>
    `;

        ChatMessage.create({
            content: html,
            speaker: { alias: 'Ryoma' },
            type: CONST.CHAT_MESSAGE_TYPES.OOC
        });
    }

    /**
     * Send a simple chat message
     * @param {string} content - Message content
     * @param {Object} options - Options
     */
    static sendChatMessage(content, options = {}) {
        const cssClass = options.isError ? 'rioma-error' : '';

        ChatMessage.create({
            content: `<div class="rioma-chat-message ${cssClass}"><div class="rioma-content">${content}</div></div>`,
            speaker: { alias: 'Ryoma' },
            type: CONST.CHAT_MESSAGE_TYPES.OOC
        });
    }

    /**
     * Show thinking indicator
     * @returns {Promise<string>} Message ID
     */
    static async showThinking() {
        const html = `
      <div class="rioma-chat-message" id="rioma-thinking">
        <div class="rioma-header">
          <div class="rioma-avatar">🐺</div>
          <span class="ryoma-name">Ryoma</span>
        </div>
        <div class="rioma-thinking">
          ${game.i18n.localize('RYOMA.Chat.Thinking')}
          <span class="dots">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </span>
        </div>
      </div>
    `;

        const msg = await ChatMessage.create({
            content: html,
            speaker: { alias: 'Ryoma' },
            type: CONST.CHAT_MESSAGE_TYPES.OOC,
            flags: { [MODULE_ID]: { isThinking: true } }
        });

        return msg.id;
    }

    /**
     * Remove thinking indicator
     * @param {string} messageId - Message ID to remove
     */
    static removeThinking(messageId) {
        const message = game.messages.get(messageId);
        if (message) {
            message.delete();
        }
    }

    /**
     * Format content with markdown-like processing
     * @param {string} content - Raw content
     * @returns {string} Formatted HTML
     */
    static formatContent(content) {
        if (!content) return '';

        // Convert markdown-like formatting to HTML
        let formatted = content
            // Bold
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            // Italic
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            // Code
            .replace(/`(.+?)`/g, '<code>$1</code>')
            // Line breaks
            .replace(/\n/g, '<br>');

        return formatted;
    }

    /**
     * Check if message is a confirmation response
     * @param {string} message - Message to check
     * @returns {Object|null} Confirmation info or null
     */
    static checkConfirmation(message) {
        const lower = message.toLowerCase().trim();

        if (lower === 'conferma' || lower === 'sì' || lower === 'si' || lower === 'ok' || lower === 'procedi') {
            return { confirmed: true };
        }

        if (lower === 'annulla' || lower === 'no' || lower === 'stop' || lower === 'cancella') {
            return { confirmed: false };
        }

        return null;
    }
}

// Export for external access
export default ChatHandler;
