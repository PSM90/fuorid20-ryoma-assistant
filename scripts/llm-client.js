/**
 * Fuori D20: Ryoma Assistant
 * OpenRouter LLM Client
 */

import { MODULE_ID, OPENROUTER_API_URL, getSetting, getModel, getModelDisplayName, LLM_MODELS } from './config.js';

/**
 * Client for OpenRouter API
 */
export class LLMClient {
    /**
     * Create the system prompt for Ryoma
     * @param {Object} context - Context information
     * @returns {string} System prompt
     */
    static buildSystemPrompt(context = {}) {
        let prompt = `Sei Ryoma, l'assistente arcano del gruppo "Fuori D20". Sei un saggio consigliere per il Master di una campagna D&D 5e.

REGOLE FONDAMENTALI:
- Parli SEMPRE in italiano
- Sei esperto di D&D 5e e delle sue regole
- Ricordi tutto delle conversazioni precedenti con il Master
- Quando citi contenuti dei compendi (incantesimi, oggetti, mostri), NON tradurre i nomi se sono in inglese - usa il nome originale
- Sei amichevole, saggio e leggermente misterioso nel tono
- Dai consigli utili sulla campagna, worldbuilding, regole e bilanciamento

CAPACITÀ:
- Puoi conversare liberamente sulla campagna e dare consigli
- Puoi suggerire contenuti dai compendi configurati
- Puoi creare e modificare Actors (PG, NPC, Mostri)
- Puoi creare e modificare Items (Oggetti, Armi, Incantesimi, Abilità)

QUANDO TI VIENE CHIESTO DI CREARE QUALCOSA:
Devi rispondere con un blocco JSON speciale nel formato seguente (IMPORTANTE: includi i marcatori esattamente come mostrato):

---RYOMA_CREATE_START---
{
  "action": "create_actor" oppure "create_item",
  "data": {
    // tutti i dati necessari per la creazione
  }
}
---RYOMA_CREATE_END---

Prima del blocco JSON, scrivi sempre un recap testuale in italiano di cosa stai per creare.
Dopo il blocco JSON, chiedi conferma al Master.

STRUTTURA DATI PER ACTOR (NPC/Mostro):
{
  "action": "create_actor",
  "data": {
    "name": "Nome",
    "type": "npc",
    "cr": 0.25,
    "size": "sm",
    "creatureType": "humanoid",
    "abilities": {"str": 8, "dex": 14, "con": 10, "int": 10, "wis": 8, "cha": 8},
    "hp": {"value": 7, "max": 7, "formula": "2d6"},
    "ac": {"value": 15},
    "speed": {"walk": 30},
    "languages": ["Common", "Goblin"],
    "senses": {"darkvision": 60},
    "biography": "Descrizione...",
    "items": [
      {"type": "spell", "name": "Passo velato", "fromCompendium": true},
      {"type": "spell", "name": "Testfuoco", "custom": {"level": 1, "damage": "100d8", "damageType": "fire", "description": "Un incantesimo devastante di fuoco."}}
    ]
  }
}

IMPORTANTE PER GLI ITEMS:
- Se l'item esiste nei compendi (es: "Passo velato", "Palla di fuoco", "Spada lunga"), usa: {"type": "spell", "name": "Passo velato", "fromCompendium": true}
- Se l'item è CUSTOM/inventato (es: "Testfuoco"), usa: {"type": "spell", "name": "Testfuoco", "custom": {...dati...}}
- USA IL NOME ESATTO come appare nei compendi del Master (tipicamente in italiano per compendi italiani)

STRUTTURA DATI PER ITEM:
{
  "action": "create_item",
  "data": {
    "name": "Nome Item",
    "type": "weapon",
    "description": "Descrizione...",
    "damage": "1d8",
    "damageType": "slashing"
  }
}

QUANDO DAI SOLO SUGGERIMENTI (senza creare):
- Elenca le opzioni disponibili
- Spiega perché sono adatte al contesto
- Non usare il formato JSON speciale`;

        // Add party context
        if (context.party && context.party.length > 0) {
            prompt += `\n\nPARTY DEI GIOCATORI (${context.party.length} membri):`;
            prompt += `\n- Livello medio: ${context.averageLevel || 'N/D'}`;
            for (const member of context.party) {
                prompt += `\n- ${member.name}: ${member.class || 'N/D'} Lv${member.level || '?'}, HP ${member.hp || '?'}/${member.maxHp || '?'}`;
            }
            prompt += `\n\nUsa queste informazioni per bilanciare gli scontri quando crei NPC o mostri.`;
        }

        // Add compendium context
        if (context.compendiums && Object.keys(context.compendiums).length > 0) {
            prompt += `\n\nCOMPENDI DISPONIBILI:`;
            for (const [category, packs] of Object.entries(context.compendiums)) {
                if (packs && packs.length > 0) {
                    prompt += `\n- ${category}: ${packs.join(', ')}`;
                }
            }
        }

        return prompt;
    }

    /**
     * Send a chat message to OpenRouter (simple, no tools)
     * @param {Array} messages - Conversation messages
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} API response
     */
    static async chat(messages, options = {}) {
        const apiKey = getSetting('apiKey');
        if (!apiKey) {
            throw new Error(game.i18n.localize('RYOMA.Chat.NoApiKey'));
        }

        const isComplex = options.isComplex || false;
        const model = options.model || getModel(isComplex);

        const requestBody = {
            model: model,
            messages: messages,
            temperature: options.temperature || 0.7,
            max_tokens: options.maxTokens || 4096
        };

        try {
            const response = await fetch(OPENROUTER_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': window.location.origin,
                    'X-Title': 'Fuori D20: Ryoma Assistant'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            // Add model info to response
            data.modelUsed = model;
            data.modelDisplayName = getModelDisplayName(model);

            return data;
        } catch (error) {
            console.error(`${MODULE_ID} | LLM API Error:`, error);
            throw error;
        }
    }

    /**
     * Process a user message with full context
     * @param {string} userMessage - The user's message
     * @param {Object} context - Context object with party, compendiums, history
     * @returns {Promise<Object>} Processed response
     */
    static async processMessage(userMessage, context = {}) {
        // Build messages array
        const messages = [];

        // System message
        messages.push({
            role: 'system',
            content: this.buildSystemPrompt(context)
        });

        // Add conversation history
        if (context.history && context.history.length > 0) {
            for (const msg of context.history) {
                messages.push({
                    role: msg.role,
                    content: msg.content
                });
            }
        }

        // Add current user message
        messages.push({
            role: 'user',
            content: userMessage
        });

        // Determine if this is likely a complex request
        const isComplex = this.isComplexRequest(userMessage);

        // Make API call
        const response = await this.chat(messages, { isComplex });

        return this.parseResponse(response);
    }

    /**
     * Determine if a request is complex (creation/modification)
     * @param {string} message - User message
     * @returns {boolean}
     */
    static isComplexRequest(message) {
        const complexPatterns = [
            /crea/i,
            /genera/i,
            /costruisci/i,
            /modifica/i,
            /cambia/i,
            /aggiungi/i,
            /rimuovi/i,
            /npc/i,
            /mostro/i,
            /nemico/i,
            /personaggio/i,
            /actor/i,
            /scheda/i,
            /goblin/i,
            /orc/i,
            /dragon/i
        ];

        return complexPatterns.some(pattern => pattern.test(message));
    }

    /**
     * Parse the API response and extract any creation commands
     * @param {Object} response - Raw API response
     * @returns {Object} Parsed response with content and creation data
     */
    static parseResponse(response) {
        const result = {
            content: '',
            creationData: null,
            modelUsed: response.modelUsed,
            modelDisplayName: response.modelDisplayName,
            usage: response.usage
        };

        if (!response.choices || response.choices.length === 0) {
            return result;
        }

        const choice = response.choices[0];
        const message = choice.message;

        // Extract text content
        if (message.content) {
            result.content = message.content;

            // Check for creation JSON block
            const creationMatch = message.content.match(/---RYOMA_CREATE_START---\s*([\s\S]*?)\s*---RYOMA_CREATE_END---/);

            if (creationMatch) {
                try {
                    result.creationData = JSON.parse(creationMatch[1].trim());
                    // Remove the JSON block from displayed content
                    result.content = message.content
                        .replace(/---RYOMA_CREATE_START---[\s\S]*?---RYOMA_CREATE_END---/, '')
                        .trim();
                } catch (e) {
                    console.warn(`${MODULE_ID} | Failed to parse creation JSON:`, e);
                }
            }
        }

        result.finishReason = choice.finish_reason;

        return result;
    }
}
