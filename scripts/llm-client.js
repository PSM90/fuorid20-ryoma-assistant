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

QUANDO TI VIENE CHIESTO DI CREARE O MODIFICARE QUALCOSA:
1. Prima fai un RECAP dettagliato di cosa intendi creare/modificare
2. Descrivi: Nome, Tipo, Statistiche principali, Items/Abilità che includerai
3. Specifica se userai elementi dai compendi (citando il nome originale) o se li creerai da zero
4. Chiedi conferma prima di procedere con la creazione

QUANDO DAI SOLO SUGGERIMENTI (senza creare):
- Elenca le opzioni disponibili nei compendi
- Spiega perché sono adatte al contesto
- Non chiedere conferma, sono solo suggerimenti informativi`;

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
            prompt += `\n\nQuando suggerisci contenuti, cerca prima in questi compendi.`;
        }

        return prompt;
    }

    /**
     * Build the tools definition for function calling
     * @returns {Array} Tools array for OpenRouter API
     */
    static buildTools() {
        return [
            {
                type: 'function',
                function: {
                    name: 'search_compendium',
                    description: 'Cerca contenuti nei compendi configurati per una specifica categoria',
                    parameters: {
                        type: 'object',
                        properties: {
                            category: {
                                type: 'string',
                                enum: ['classes', 'subclasses', 'features', 'spells', 'items', 'actors', 'races', 'proficiencies'],
                                description: 'Categoria di compendio in cui cercare'
                            },
                            query: {
                                type: 'string',
                                description: 'Termine di ricerca (nome o parte del nome)'
                            },
                            limit: {
                                type: 'number',
                                description: 'Numero massimo di risultati (default: 10)'
                            }
                        },
                        required: ['category', 'query']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'create_actor',
                    description: 'Crea un nuovo Actor (NPC o Mostro) con le statistiche specificate',
                    parameters: {
                        type: 'object',
                        properties: {
                            name: { type: 'string', description: 'Nome dell\'Actor' },
                            type: {
                                type: 'string',
                                enum: ['npc', 'character'],
                                description: 'Tipo di Actor'
                            },
                            cr: { type: 'number', description: 'Challenge Rating (Grado Sfida)' },
                            size: {
                                type: 'string',
                                enum: ['tiny', 'sm', 'med', 'lg', 'huge', 'grg'],
                                description: 'Taglia della creatura'
                            },
                            creatureType: {
                                type: 'string',
                                description: 'Tipo di creatura (es: humanoid, undead, fiend)'
                            },
                            abilities: {
                                type: 'object',
                                properties: {
                                    str: { type: 'number' },
                                    dex: { type: 'number' },
                                    con: { type: 'number' },
                                    int: { type: 'number' },
                                    wis: { type: 'number' },
                                    cha: { type: 'number' }
                                },
                                description: 'Punteggi delle caratteristiche'
                            },
                            hp: {
                                type: 'object',
                                properties: {
                                    value: { type: 'number' },
                                    max: { type: 'number' },
                                    formula: { type: 'string' }
                                },
                                description: 'Punti ferita'
                            },
                            ac: {
                                type: 'object',
                                properties: {
                                    value: { type: 'number' },
                                    formula: { type: 'string' }
                                },
                                description: 'Classe Armatura'
                            },
                            speed: {
                                type: 'object',
                                properties: {
                                    walk: { type: 'number' },
                                    fly: { type: 'number' },
                                    swim: { type: 'number' },
                                    climb: { type: 'number' },
                                    burrow: { type: 'number' }
                                },
                                description: 'Velocità di movimento (in piedi)'
                            },
                            skills: {
                                type: 'object',
                                description: 'Abilità e relativi bonus'
                            },
                            senses: {
                                type: 'object',
                                properties: {
                                    darkvision: { type: 'number' },
                                    blindsight: { type: 'number' },
                                    tremorsense: { type: 'number' },
                                    truesight: { type: 'number' }
                                },
                                description: 'Sensi speciali (in piedi)'
                            },
                            languages: {
                                type: 'array',
                                items: { type: 'string' },
                                description: 'Lingue parlate'
                            },
                            damageResistances: {
                                type: 'array',
                                items: { type: 'string' },
                                description: 'Resistenze ai danni'
                            },
                            damageImmunities: {
                                type: 'array',
                                items: { type: 'string' },
                                description: 'Immunità ai danni'
                            },
                            conditionImmunities: {
                                type: 'array',
                                items: { type: 'string' },
                                description: 'Immunità alle condizioni'
                            },
                            biography: {
                                type: 'string',
                                description: 'Descrizione e background'
                            },
                            items: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        type: {
                                            type: 'string',
                                            enum: ['weapon', 'feat', 'spell', 'equipment', 'consumable', 'tool', 'loot']
                                        },
                                        name: { type: 'string' },
                                        fromCompendium: { type: 'string', description: 'UUID del compendio se esiste' },
                                        custom: {
                                            type: 'object',
                                            description: 'Dati custom se creato da zero'
                                        }
                                    }
                                },
                                description: 'Items da aggiungere all\'Actor (armi, abilità, incantesimi)'
                            }
                        },
                        required: ['name', 'type']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'modify_actor',
                    description: 'Modifica un Actor esistente',
                    parameters: {
                        type: 'object',
                        properties: {
                            uuid: { type: 'string', description: 'UUID dell\'Actor da modificare' },
                            changes: {
                                type: 'object',
                                description: 'Oggetto con le modifiche da applicare (stessa struttura di create_actor)'
                            }
                        },
                        required: ['uuid', 'changes']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'create_item',
                    description: 'Crea un nuovo Item (arma, oggetto, incantesimo, abilità)',
                    parameters: {
                        type: 'object',
                        properties: {
                            name: { type: 'string', description: 'Nome dell\'oggetto' },
                            type: {
                                type: 'string',
                                enum: ['weapon', 'equipment', 'consumable', 'tool', 'loot', 'spell', 'feat', 'feature', 'class', 'subclass', 'background', 'race'],
                                description: 'Tipo di Item'
                            },
                            targetActorUuid: {
                                type: 'string',
                                description: 'UUID dell\'Actor a cui aggiungere l\'item (opzionale, se non specificato crea item standalone)'
                            },
                            data: {
                                type: 'object',
                                description: 'Dati specifici dell\'item (dipende dal tipo)'
                            }
                        },
                        required: ['name', 'type']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'get_actor_info',
                    description: 'Ottieni informazioni dettagliate su un Actor specifico',
                    parameters: {
                        type: 'object',
                        properties: {
                            uuid: { type: 'string', description: 'UUID dell\'Actor' },
                            name: { type: 'string', description: 'Nome dell\'Actor (se UUID non noto)' }
                        }
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'get_party_info',
                    description: 'Ottieni informazioni dettagliate sul party dei giocatori',
                    parameters: {
                        type: 'object',
                        properties: {}
                    }
                }
            }
        ];
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
        const useTools = options.useTools !== false;

        const requestBody = {
            model: model,
            messages: messages,
            temperature: options.temperature || 0.7,
            max_tokens: options.maxTokens || 4096
        };

        // Add tools for function calling if enabled
        if (useTools) {
            requestBody.tools = this.buildTools();
            requestBody.tool_choice = 'auto';
        }

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
            /scheda/i
        ];

        return complexPatterns.some(pattern => pattern.test(message));
    }

    /**
     * Parse the API response
     * @param {Object} response - Raw API response
     * @returns {Object} Parsed response with content and tool calls
     */
    static parseResponse(response) {
        const result = {
            content: '',
            toolCalls: [],
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
        }

        // Extract tool calls
        if (message.tool_calls && message.tool_calls.length > 0) {
            result.toolCalls = message.tool_calls.map(tc => ({
                id: tc.id,
                name: tc.function.name,
                arguments: JSON.parse(tc.function.arguments)
            }));
        }

        // Check finish reason
        result.finishReason = choice.finish_reason;
        result.needsConfirmation = result.toolCalls.some(tc =>
            ['create_actor', 'modify_actor', 'create_item'].includes(tc.name)
        );

        return result;
    }

    /**
     * Continue conversation after tool execution
     * @param {Array} messages - Previous messages
     * @param {Array} toolResults - Results from tool executions
     * @param {Object} context - Context object
     * @returns {Promise<Object>} Continuation response
     */
    static async continueWithToolResults(messages, toolResults, context = {}) {
        const updatedMessages = [...messages];

        // Add tool results
        for (const result of toolResults) {
            updatedMessages.push({
                role: 'tool',
                tool_call_id: result.callId,
                content: JSON.stringify(result.result)
            });
        }

        const response = await this.chat(updatedMessages, {
            isComplex: true,
            useTools: true
        });

        return this.parseResponse(response);
    }
}
