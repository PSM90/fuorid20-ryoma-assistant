/**
 * Fuori D20: Ryoma Assistant
 * Compendium Browser - Search and retrieve compendium content
 */

import { MODULE_ID, getSetting, COMPENDIUM_CATEGORIES } from './config.js';

/**
 * Handles compendium searching and content retrieval
 */
export class CompendiumBrowser {
    /**
     * Get configured compendiums for a category
     * @param {string} category - Category key
     * @returns {Array<string>} Array of compendium collection IDs
     */
    static getCompendiumsForCategory(category) {
        const config = getSetting('compendiumConfig') || {};
        return config[category] || [];
    }

    /**
     * Get all configured compendiums across all categories
     * @returns {Object} Map of category to compendium info
     */
    static async getAllConfiguredCompendiums() {
        const config = getSetting('compendiumConfig') || {};
        const result = {};

        for (const [category, packIds] of Object.entries(config)) {
            if (packIds && packIds.length > 0) {
                result[COMPENDIUM_CATEGORIES[category]?.name || category] = packIds.map(id => {
                    const pack = game.packs.get(id);
                    return pack ? pack.metadata.label : id;
                });
            }
        }

        return result;
    }

    /**
     * Search within configured compendiums for a category
     * @param {string} category - Category key
     * @param {string} query - Search query
     * @param {number} limit - Maximum results
     * @returns {Promise<Array>} Search results
     */
    static async search(category, query, limit = 10) {
        const packIds = this.getCompendiumsForCategory(category);

        if (packIds.length === 0) {
            return {
                results: [],
                message: `Nessun compendio configurato per la categoria "${COMPENDIUM_CATEGORIES[category]?.name || category}".`
            };
        }

        const results = [];
        const queryLower = query.toLowerCase();

        for (const packId of packIds) {
            const pack = game.packs.get(packId);
            if (!pack) continue;

            // Search in the index
            const index = await pack.getIndex({ fields: ['name', 'type', 'system.cr', 'system.level'] });

            for (const entry of index) {
                const nameLower = entry.name.toLowerCase();

                // Check if name contains query
                if (nameLower.includes(queryLower)) {
                    results.push({
                        uuid: `Compendium.${packId}.${entry._id}`,
                        name: entry.name,
                        type: entry.type,
                        img: entry.img,
                        pack: pack.metadata.label,
                        packId: packId,
                        cr: entry.system?.cr,
                        level: entry.system?.level
                    });
                }

                // Stop if we have enough results
                if (results.length >= limit) break;
            }

            if (results.length >= limit) break;
        }

        return {
            results: results.slice(0, limit),
            totalFound: results.length,
            searchedPacks: packIds.length
        };
    }

    /**
     * Get a specific entry from a compendium
     * @param {string} uuid - Compendium entry UUID
     * @returns {Promise<Object>} Full document data
     */
    static async getEntry(uuid) {
        try {
            const doc = await fromUuid(uuid);
            if (!doc) {
                return { error: `Entry not found: ${uuid}` };
            }

            return this.formatEntry(doc);
        } catch (error) {
            console.error(`${MODULE_ID} | Error getting entry ${uuid}:`, error);
            return { error: error.message };
        }
    }

    /**
     * Format a document for display/LLM consumption
     * @param {Document} doc - Foundry document
     * @returns {Object} Formatted entry data
     */
    static formatEntry(doc) {
        const base = {
            uuid: doc.uuid,
            name: doc.name,
            type: doc.type,
            img: doc.img
        };

        if (doc.documentName === 'Actor') {
            return this.formatActor(doc, base);
        } else if (doc.documentName === 'Item') {
            return this.formatItem(doc, base);
        }

        return base;
    }

    /**
     * Format an Actor document
     * @param {Actor} actor - Actor document
     * @param {Object} base - Base data
     * @returns {Object} Formatted actor data
     */
    static formatActor(actor, base) {
        const system = actor.system;

        return {
            ...base,
            cr: system.details?.cr,
            xp: system.details?.xp?.value,
            hp: {
                value: system.attributes?.hp?.value,
                max: system.attributes?.hp?.max,
                formula: system.attributes?.hp?.formula
            },
            ac: {
                value: system.attributes?.ac?.value,
                formula: system.attributes?.ac?.formula
            },
            size: system.traits?.size,
            creatureType: system.details?.type?.value,
            abilities: system.abilities ? Object.fromEntries(
                Object.entries(system.abilities).map(([k, v]) => [k, v.value])
            ) : {},
            speed: system.attributes?.movement,
            senses: system.attributes?.senses,
            languages: system.traits?.languages?.value || [],
            damageResistances: system.traits?.dr?.value || [],
            damageImmunities: system.traits?.di?.value || [],
            conditionImmunities: system.traits?.ci?.value || [],
            description: system.details?.biography?.value || '',
            items: actor.items.map(i => ({
                name: i.name,
                type: i.type
            }))
        };
    }

    /**
     * Format an Item document
     * @param {Item} item - Item document
     * @param {Object} base - Base data
     * @returns {Object} Formatted item data
     */
    static formatItem(item, base) {
        const system = item.system;

        const formatted = {
            ...base,
            description: system.description?.value || ''
        };

        // Add type-specific data
        switch (item.type) {
            case 'spell':
                formatted.level = system.level;
                formatted.school = system.school;
                formatted.components = system.components;
                formatted.duration = system.duration;
                formatted.range = system.range;
                formatted.target = system.target;
                formatted.damage = system.damage;
                formatted.save = system.save;
                formatted.concentration = system.components?.concentration;
                formatted.ritual = system.components?.ritual;
                break;

            case 'weapon':
                formatted.damage = system.damage;
                formatted.range = system.range;
                formatted.properties = system.properties;
                formatted.proficient = system.proficient;
                formatted.attackBonus = system.attackBonus;
                break;

            case 'equipment':
            case 'armor':
                formatted.armor = system.armor;
                formatted.strength = system.strength;
                formatted.stealth = system.stealth;
                break;

            case 'feat':
            case 'feature':
                formatted.requirements = system.requirements;
                formatted.activation = system.activation;
                formatted.uses = system.uses;
                break;

            case 'class':
                formatted.levels = system.levels;
                formatted.hitDice = system.hitDice;
                formatted.spellcasting = system.spellcasting;
                break;

            case 'consumable':
                formatted.consumableType = system.consumableType;
                formatted.uses = system.uses;
                formatted.damage = system.damage;
                break;
        }

        return formatted;
    }

    /**
     * Get random entries from configured compendiums
     * @param {string} category - Category key
     * @param {number} count - Number of random entries
     * @returns {Promise<Array>} Random entries
     */
    static async getRandomEntries(category, count = 5) {
        const packIds = this.getCompendiumsForCategory(category);

        if (packIds.length === 0) {
            return [];
        }

        const allEntries = [];

        for (const packId of packIds) {
            const pack = game.packs.get(packId);
            if (!pack) continue;

            const index = await pack.getIndex();
            for (const entry of index) {
                allEntries.push({
                    uuid: `Compendium.${packId}.${entry._id}`,
                    name: entry.name,
                    type: entry.type,
                    pack: pack.metadata.label
                });
            }
        }

        // Shuffle and take random
        const shuffled = allEntries.sort(() => Math.random() - 0.5);
        return shuffled.slice(0, count);
    }

    /**
     * Get entries by type/CR for encounter building
     * @param {Object} options - Filter options
     * @returns {Promise<Array>} Matching entries
     */
    static async getActorsByCR(options = {}) {
        const { minCR = 0, maxCR = 30, creatureType, limit = 10 } = options;
        const packIds = this.getCompendiumsForCategory('actors');

        if (packIds.length === 0) {
            return [];
        }

        const results = [];

        for (const packId of packIds) {
            const pack = game.packs.get(packId);
            if (!pack) continue;

            const index = await pack.getIndex({ fields: ['system.details.cr', 'system.details.type'] });

            for (const entry of index) {
                const cr = entry.system?.details?.cr;
                const type = entry.system?.details?.type?.value;

                if (cr === undefined || cr === null) continue;

                // Check CR range
                if (cr < minCR || cr > maxCR) continue;

                // Check creature type if specified
                if (creatureType && type !== creatureType) continue;

                results.push({
                    uuid: `Compendium.${packId}.${entry._id}`,
                    name: entry.name,
                    cr: cr,
                    type: type,
                    pack: pack.metadata.label
                });

                if (results.length >= limit) break;
            }

            if (results.length >= limit) break;
        }

        // Sort by CR
        return results.sort((a, b) => a.cr - b.cr);
    }

    /**
     * Get spells by level
     * @param {Object} options - Filter options
     * @returns {Promise<Array>} Matching spells
     */
    static async getSpellsByLevel(options = {}) {
        const { level, school, limit = 10 } = options;
        const packIds = this.getCompendiumsForCategory('spells');

        if (packIds.length === 0) {
            return [];
        }

        const results = [];

        for (const packId of packIds) {
            const pack = game.packs.get(packId);
            if (!pack) continue;

            const index = await pack.getIndex({ fields: ['system.level', 'system.school'] });

            for (const entry of index) {
                const spellLevel = entry.system?.level;
                const spellSchool = entry.system?.school;

                if (level !== undefined && spellLevel !== level) continue;
                if (school && spellSchool !== school) continue;

                results.push({
                    uuid: `Compendium.${packId}.${entry._id}`,
                    name: entry.name,
                    level: spellLevel,
                    school: spellSchool,
                    pack: pack.metadata.label
                });

                if (results.length >= limit) break;
            }

            if (results.length >= limit) break;
        }

        return results.sort((a, b) => a.level - b.level);
    }

    /**
     * Format search results for LLM response
     * @param {Array} results - Search results
     * @param {string} category - Category searched
     * @returns {string} Formatted text
     */
    static formatResultsForLLM(results, category) {
        if (!results || results.length === 0) {
            return `Nessun risultato trovato nella categoria "${COMPENDIUM_CATEGORIES[category]?.name || category}".`;
        }

        let text = `Ho trovato ${results.length} risultati:\n`;

        for (const result of results) {
            text += `- **${result.name}**`;

            if (result.cr !== undefined) {
                text += ` (GS ${result.cr})`;
            } else if (result.level !== undefined) {
                text += ` (Livello ${result.level})`;
            }

            text += ` - ${result.pack}\n`;
        }

        return text;
    }

    /**
     * Find an item in compendiums by name
     * @param {string} name - Item name to search for
     * @param {string} category - Optional category to search in (spells, items, features, etc.)
     * @returns {Promise<Object|null>} Found item UUID and data, or null
     */
    static async findItemByName(name, category = null) {
        const nameLower = name.toLowerCase().trim();

        // Determine which categories to search
        const categoriesToSearch = category
            ? [category]
            : ['spells', 'items', 'features', 'classes', 'subclasses', 'races'];

        for (const cat of categoriesToSearch) {
            const packIds = this.getCompendiumsForCategory(cat);

            for (const packId of packIds) {
                const pack = game.packs.get(packId);
                if (!pack) continue;

                const index = await pack.getIndex();

                for (const entry of index) {
                    // Exact match (case insensitive)
                    if (entry.name.toLowerCase() === nameLower) {
                        return {
                            uuid: `Compendium.${packId}.Item.${entry._id}`,
                            name: entry.name,
                            type: entry.type,
                            pack: pack.metadata.label
                        };
                    }
                }
            }
        }

        return null;
    }

    /**
     * Import an item from compendium to an actor
     * @param {string} itemUuid - Compendium item UUID
     * @param {Actor} targetActor - Target actor
     * @returns {Promise<Item>} Created item
     */
    static async importToActor(itemUuid, targetActor) {
        try {
            const item = await fromUuid(itemUuid);
            if (!item) {
                throw new Error(`Item not found: ${itemUuid}`);
            }

            // Create a copy on the actor
            const itemData = item.toObject();
            const created = await targetActor.createEmbeddedDocuments('Item', [itemData]);

            return created[0];
        } catch (error) {
            console.error(`${MODULE_ID} | Error importing item:`, error);
            throw error;
        }
    }

    /**
     * Clone an actor from compendium to the world
     * @param {string} actorUuid - Compendium actor UUID
     * @param {Object} options - Creation options
     * @returns {Promise<Actor>} Created actor
     */
    static async importActor(actorUuid, options = {}) {
        try {
            const source = await fromUuid(actorUuid);
            if (!source) {
                throw new Error(`Actor not found: ${actorUuid}`);
            }

            const actorData = source.toObject();

            // Apply modifications if provided
            if (options.name) actorData.name = options.name;
            if (options.folder) actorData.folder = options.folder;

            const created = await Actor.create(actorData);
            return created;
        } catch (error) {
            console.error(`${MODULE_ID} | Error importing actor:`, error);
            throw error;
        }
    }
}
