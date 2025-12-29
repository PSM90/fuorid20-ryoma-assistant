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
- Sei amichevole, saggio e leggermente misterioso nel tono

QUANDO TI VIENE CHIESTO DI CREARE QUALCOSA:
Rispondi con un recap in italiano e poi un blocco JSON speciale con i marcatori:

---RYOMA_CREATE_START---
{JSON}
---RYOMA_CREATE_END---

=== STRUTTURA PER ARMA (weapon) ===
{
  "action": "create_item",
  "data": {
    "name": "Spada Infuocata",
    "type": "weapon",
    "description": "Una spada avvolta da fiamme arcane.",
    "actionType": "mwak",
    "damage": [
      {"formula": "2d8", "type": "slashing"},
      {"formula": "2d8", "type": "fire"}
    ],
    "save": {
      "ability": "con",
      "dc": 15,
      "effect": "prono"
    },
    "range": {"value": 5, "units": "ft"},
    "properties": ["magical"]
  }
}

=== STRUTTURA PER INCANTESIMO (spell) ===
{
  "action": "create_item",
  "data": {
    "name": "Testfuoco",
    "type": "spell",
    "description": "Un devastante incantesimo di fuoco.",
    "level": 3,
    "school": "evo",
    "actionType": "save",
    "damage": [
      {"formula": "8d6", "type": "fire"}
    ],
    "save": {
      "ability": "dex",
      "effect": "half"
    },
    "range": {"value": 120, "units": "ft"},
    "target": {"value": 20, "units": "ft", "type": "sphere"},
    "components": {"vocal": true, "somatic": true, "material": false}
  }
}

=== STRUTTURA PER ACTOR (NPC/Mostro) ===
{
  "action": "create_actor",
  "data": {
    "name": "Goblin Arciere",
    "type": "npc",
    "cr": 0.25,
    "size": "sm",
    "creatureType": "humanoid",
    "abilities": {"str": 8, "dex": 14, "con": 10, "int": 10, "wis": 8, "cha": 8},
    "hp": {"max": 7, "formula": "2d6"},
    "ac": {"value": 15},
    "speed": {"walk": 30},
    "languages": ["Common", "Goblin"],
    "senses": {"darkvision": 60},
    "biography": "Un piccolo goblin armato di arco.",
    "items": [
      {"type": "spell", "name": "Passo velato", "fromCompendium": true},
      {"type": "weapon", "name": "Arco corto", "fromCompendium": true},
      {"type": "weapon", "name": "Lama Infuocata", "custom": {
        "damage": [{"formula": "1d6", "type": "slashing"}, {"formula": "1d6", "type": "fire"}],
        "actionType": "mwak"
      }}
    ]
  }
}

=== REGOLE IMPORTANTI ===
TIPI DI DANNO: acid, bludgeoning, cold, fire, force, lightning, necrotic, piercing, poison, psychic, radiant, slashing, thunder
ABILITÀ TIRI SALVEZZA: str, dex, con, int, wis, cha
ACTION TYPES: mwak (mischia arma), rwak (distanza arma), msak (mischia incantesimo), rsak (distanza incantesimo), save (tiro salvezza)
SCUOLE MAGIA: abj, con, div, enc, evo, ill, nec, trs

PER ITEMS DAI COMPENDI: usa {"name": "Nome esatto", "fromCompendium": true}
PER ITEMS CUSTOM: usa {"name": "Nome", "custom": {...dati...}}`;

        // Add party context
        if (context.party && context.party.length > 0) {
            prompt += `\n\nPARTY (${context.party.length} membri, livello medio: ${context.averageLevel || 'N/D'}):`;
            for (const member of context.party) {
                prompt += `\n- ${member.name}: ${member.class || 'N/D'} Lv${member.level || '?'}`;
            }
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
     * Send a chat message to OpenRouter
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
     * @param {Object} context - Context object
     * @returns {Promise<Object>} Processed response
     */
    static async processMessage(userMessage, context = {}) {
        const messages = [];

        messages.push({
            role: 'system',
            content: this.buildSystemPrompt(context)
        });

        if (context.history && context.history.length > 0) {
            for (const msg of context.history) {
                messages.push({
                    role: msg.role,
                    content: msg.content
                });
            }
        }

        messages.push({
            role: 'user',
            content: userMessage
        });

        const isComplex = this.isComplexRequest(userMessage);
        const response = await this.chat(messages, { isComplex });

        return this.parseResponse(response);
    }

    /**
     * Determine if a request is complex
     * @param {string} message - User message
     * @returns {boolean}
     */
    static isComplexRequest(message) {
        const complexPatterns = [
            /crea/i, /genera/i, /costruisci/i, /modifica/i, /cambia/i,
            /aggiungi/i, /npc/i, /mostro/i, /nemico/i, /personaggio/i,
            /arma/i, /spada/i, /incantesimo/i, /spell/i
        ];
        return complexPatterns.some(pattern => pattern.test(message));
    }

    /**
     * Parse the API response
     * @param {Object} response - Raw API response
     * @returns {Object} Parsed response
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

        if (message.content) {
            result.content = message.content;

            // Check for creation JSON block
            const creationMatch = message.content.match(/---RYOMA_CREATE_START---\s*([\s\S]*?)\s*---RYOMA_CREATE_END---/);

            if (creationMatch) {
                try {
                    result.creationData = JSON.parse(creationMatch[1].trim());
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
