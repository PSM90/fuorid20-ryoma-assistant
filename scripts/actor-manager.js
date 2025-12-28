/**
 * Fuori D20: Ryoma Assistant
 * Actor Manager - Create and modify Actors
 */

import { MODULE_ID } from './config.js';
import { CompendiumBrowser } from './compendium-browser.js';

/**
 * Handles Actor creation and modification
 */
export class ActorManager {
    /**
     * Create a new Actor from LLM data
     * @param {Object} data - Actor data from LLM
     * @returns {Promise<Actor>} Created actor
     */
    static async createActor(data) {
        try {
            // Build the actor data structure for D&D 5e
            const actorData = this.buildActorData(data);

            // Create the actor
            const actor = await Actor.create(actorData);

            // Add items if specified
            if (data.items && data.items.length > 0) {
                await this.addItemsToActor(actor, data.items);
            }

            console.log(`${MODULE_ID} | Created actor: ${actor.name}`);
            return actor;
        } catch (error) {
            console.error(`${MODULE_ID} | Error creating actor:`, error);
            throw error;
        }
    }

    /**
     * Build D&D 5e actor data from LLM format
     * @param {Object} data - LLM data
     * @returns {Object} Foundry actor data
     */
    static buildActorData(data) {
        const actorData = {
            name: data.name || 'Nuovo Actor',
            type: data.type || 'npc',
            img: data.img || 'icons/svg/mystery-man.svg',
            system: {
                abilities: this.buildAbilities(data.abilities),
                attributes: {
                    hp: {
                        value: data.hp?.value || data.hp?.max || 10,
                        max: data.hp?.max || 10,
                        formula: data.hp?.formula || ''
                    },
                    ac: {
                        flat: data.ac?.value || 10,
                        formula: data.ac?.formula || ''
                    },
                    movement: this.buildMovement(data.speed)
                },
                details: {
                    cr: data.cr || 0,
                    xp: { value: this.calculateXP(data.cr || 0) },
                    type: {
                        value: data.creatureType || 'humanoid',
                        subtype: data.creatureSubtype || ''
                    },
                    alignment: data.alignment || '',
                    biography: {
                        value: data.biography || ''
                    }
                },
                traits: {
                    size: data.size || 'med',
                    languages: {
                        value: data.languages || []
                    },
                    dr: {
                        value: data.damageResistances || []
                    },
                    di: {
                        value: data.damageImmunities || []
                    },
                    ci: {
                        value: data.conditionImmunities || []
                    }
                }
            }
        };

        // Add senses if provided
        if (data.senses) {
            actorData.system.attributes.senses = {
                darkvision: data.senses.darkvision || 0,
                blindsight: data.senses.blindsight || 0,
                tremorsense: data.senses.tremorsense || 0,
                truesight: data.senses.truesight || 0
            };
        }

        // Add skills if provided
        if (data.skills && Object.keys(data.skills).length > 0) {
            actorData.system.skills = {};
            for (const [skill, value] of Object.entries(data.skills)) {
                actorData.system.skills[skill] = {
                    value: typeof value === 'object' ? value.proficient : 1,
                    ability: this.getSkillAbility(skill)
                };
            }
        }

        return actorData;
    }

    /**
     * Build abilities object
     * @param {Object} abilities - Abilities from LLM
     * @returns {Object} Foundry abilities format
     */
    static buildAbilities(abilities) {
        const defaultAbilities = {
            str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10
        };

        const merged = { ...defaultAbilities, ...abilities };
        const result = {};

        for (const [key, value] of Object.entries(merged)) {
            result[key] = {
                value: typeof value === 'object' ? value.value : value
            };
        }

        return result;
    }

    /**
     * Build movement object
     * @param {Object} speed - Speed from LLM
     * @returns {Object} Foundry movement format
     */
    static buildMovement(speed) {
        if (!speed) {
            return { walk: 30, units: 'ft' };
        }

        return {
            walk: speed.walk || 30,
            fly: speed.fly || 0,
            swim: speed.swim || 0,
            climb: speed.climb || 0,
            burrow: speed.burrow || 0,
            units: 'ft'
        };
    }

    /**
     * Calculate XP from CR
     * @param {number} cr - Challenge Rating
     * @returns {number} XP value
     */
    static calculateXP(cr) {
        const xpByCR = {
            0: 10, 0.125: 25, 0.25: 50, 0.5: 100,
            1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800,
            6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900,
            11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000,
            16: 15000, 17: 18000, 18: 20000, 19: 22000, 20: 25000,
            21: 33000, 22: 41000, 23: 50000, 24: 62000, 25: 75000,
            26: 90000, 27: 105000, 28: 120000, 29: 135000, 30: 155000
        };

        return xpByCR[cr] || 0;
    }

    /**
     * Get default ability for a skill
     * @param {string} skill - Skill name
     * @returns {string} Ability abbreviation
     */
    static getSkillAbility(skill) {
        const skillAbilities = {
            acr: 'dex', ani: 'wis', arc: 'int', ath: 'str',
            dec: 'cha', his: 'int', ins: 'wis', itm: 'cha',
            inv: 'int', med: 'wis', nat: 'int', prc: 'wis',
            prf: 'cha', per: 'cha', rel: 'int', slt: 'dex',
            ste: 'dex', sur: 'wis'
        };

        return skillAbilities[skill] || 'int';
    }

    /**
     * Add items to an actor
     * @param {Actor} actor - Target actor
     * @param {Array} items - Items to add
     */
    static async addItemsToActor(actor, items) {
        const itemsToCreate = [];

        for (const itemData of items) {
            if (itemData.fromCompendium) {
                // Import from compendium
                try {
                    await CompendiumBrowser.importToActor(itemData.fromCompendium, actor);
                } catch (error) {
                    console.warn(`${MODULE_ID} | Could not import ${itemData.name} from compendium:`, error);
                    // Create custom if compendium import fails
                    itemsToCreate.push(this.buildItemData(itemData));
                }
            } else {
                // Create custom item
                itemsToCreate.push(this.buildItemData(itemData));
            }
        }

        if (itemsToCreate.length > 0) {
            await actor.createEmbeddedDocuments('Item', itemsToCreate);
        }
    }

    /**
     * Build item data from LLM format
     * @param {Object} data - Item data from LLM
     * @returns {Object} Foundry item data
     */
    static buildItemData(data) {
        const itemData = {
            name: data.name || 'Nuovo Item',
            type: data.type || 'feat',
            img: data.img || this.getDefaultItemIcon(data.type),
            system: {
                description: {
                    value: data.description || data.custom?.description || ''
                }
            }
        };

        // Add type-specific data
        const custom = data.custom || data;

        switch (data.type) {
            case 'weapon':
                itemData.system.damage = custom.damage || { parts: [['1d6', 'slashing']] };
                itemData.system.range = custom.range || { value: null, long: null, units: 'ft' };
                itemData.system.properties = custom.properties || {};
                itemData.system.actionType = custom.actionType || 'mwak';
                break;

            case 'spell':
                itemData.system.level = custom.level || 0;
                itemData.system.school = custom.school || 'evo';
                itemData.system.components = custom.components || { vocal: false, somatic: false, material: false };
                itemData.system.duration = custom.duration || { value: null, units: 'inst' };
                itemData.system.range = custom.range || { value: null, units: 'self' };
                itemData.system.damage = custom.damage || {};
                itemData.system.save = custom.save || {};
                break;

            case 'feat':
            case 'feature':
                itemData.system.activation = custom.activation || { type: '', cost: null };
                itemData.system.uses = custom.uses || { value: null, max: '', per: '' };
                itemData.system.damage = custom.damage || {};
                itemData.system.save = custom.save || {};
                break;

            case 'equipment':
                itemData.system.armor = custom.armor || { value: 0, type: 'light' };
                break;

            case 'consumable':
                itemData.system.consumableType = custom.consumableType || 'potion';
                itemData.system.uses = custom.uses || { value: 1, max: 1, per: 'charges', autoDestroy: true };
                break;
        }

        return itemData;
    }

    /**
     * Get default icon for item type
     * @param {string} type - Item type
     * @returns {string} Icon path
     */
    static getDefaultItemIcon(type) {
        const icons = {
            weapon: 'icons/svg/sword.svg',
            spell: 'icons/svg/fire.svg',
            feat: 'icons/svg/upgrade.svg',
            feature: 'icons/svg/upgrade.svg',
            equipment: 'icons/svg/chest.svg',
            consumable: 'icons/svg/potion.svg',
            tool: 'icons/svg/tool.svg',
            loot: 'icons/svg/coins.svg'
        };

        return icons[type] || 'icons/svg/item-bag.svg';
    }

    /**
     * Modify an existing Actor
     * @param {string} uuid - Actor UUID
     * @param {Object} changes - Changes to apply
     * @returns {Promise<Actor>} Modified actor
     */
    static async modifyActor(uuid, changes) {
        try {
            const actor = await fromUuid(uuid);
            if (!actor) {
                throw new Error(`Actor not found: ${uuid}`);
            }

            const updateData = this.buildUpdateData(changes);
            await actor.update(updateData);

            // Handle item additions
            if (changes.addItems && changes.addItems.length > 0) {
                await this.addItemsToActor(actor, changes.addItems);
            }

            // Handle item removals
            if (changes.removeItems && changes.removeItems.length > 0) {
                const itemIds = changes.removeItems.map(name => {
                    const item = actor.items.find(i => i.name.toLowerCase() === name.toLowerCase());
                    return item?.id;
                }).filter(Boolean);

                if (itemIds.length > 0) {
                    await actor.deleteEmbeddedDocuments('Item', itemIds);
                }
            }

            console.log(`${MODULE_ID} | Modified actor: ${actor.name}`);
            return actor;
        } catch (error) {
            console.error(`${MODULE_ID} | Error modifying actor:`, error);
            throw error;
        }
    }

    /**
     * Build update data from changes object
     * @param {Object} changes - Changes from LLM
     * @returns {Object} Foundry update data
     */
    static buildUpdateData(changes) {
        const updateData = {};

        if (changes.name) updateData.name = changes.name;
        if (changes.img) updateData.img = changes.img;

        // System updates
        if (changes.hp) {
            updateData['system.attributes.hp.value'] = changes.hp.value;
            updateData['system.attributes.hp.max'] = changes.hp.max || changes.hp.value;
            if (changes.hp.formula) updateData['system.attributes.hp.formula'] = changes.hp.formula;
        }

        if (changes.ac) {
            updateData['system.attributes.ac.flat'] = changes.ac.value;
            if (changes.ac.formula) updateData['system.attributes.ac.formula'] = changes.ac.formula;
        }

        if (changes.abilities) {
            for (const [key, value] of Object.entries(changes.abilities)) {
                updateData[`system.abilities.${key}.value`] = typeof value === 'object' ? value.value : value;
            }
        }

        if (changes.speed) {
            for (const [key, value] of Object.entries(changes.speed)) {
                updateData[`system.attributes.movement.${key}`] = value;
            }
        }

        if (changes.cr !== undefined) {
            updateData['system.details.cr'] = changes.cr;
            updateData['system.details.xp.value'] = this.calculateXP(changes.cr);
        }

        if (changes.biography) {
            updateData['system.details.biography.value'] = changes.biography;
        }

        if (changes.languages) {
            updateData['system.traits.languages.value'] = changes.languages;
        }

        return updateData;
    }

    /**
     * Find an actor by name
     * @param {string} name - Actor name
     * @returns {Actor|null} Found actor or null
     */
    static findActorByName(name) {
        const nameLower = name.toLowerCase();
        return game.actors.find(a => a.name.toLowerCase() === nameLower);
    }

    /**
     * Get actor info formatted for LLM
     * @param {string} uuid - Actor UUID
     * @returns {Promise<Object>} Actor info
     */
    static async getActorInfo(uuid) {
        try {
            const actor = await fromUuid(uuid);
            if (!actor) {
                return { error: `Actor not found: ${uuid}` };
            }

            const system = actor.system;
            return {
                uuid: actor.uuid,
                name: actor.name,
                type: actor.type,
                cr: system.details?.cr,
                hp: {
                    value: system.attributes?.hp?.value,
                    max: system.attributes?.hp?.max
                },
                ac: system.attributes?.ac?.value,
                abilities: system.abilities ? Object.fromEntries(
                    Object.entries(system.abilities).map(([k, v]) => [k, v.value])
                ) : {},
                items: actor.items.map(i => ({
                    name: i.name,
                    type: i.type
                })),
                description: system.details?.biography?.value || ''
            };
        } catch (error) {
            return { error: error.message };
        }
    }

    /**
     * Build a recap of what will be created
     * @param {Object} data - Actor data from LLM
     * @returns {Object} Recap for confirmation dialog
     */
    static buildCreationRecap(data) {
        const recap = {
            type: 'Actor',
            subtype: data.type || 'npc',
            name: data.name,
            details: []
        };

        if (data.cr !== undefined) {
            recap.details.push({ label: 'Grado Sfida', value: data.cr });
        }

        if (data.hp) {
            recap.details.push({
                label: 'Punti Ferita',
                value: `${data.hp.max || data.hp.value}${data.hp.formula ? ` (${data.hp.formula})` : ''}`
            });
        }

        if (data.ac) {
            recap.details.push({ label: 'Classe Armatura', value: data.ac.value || data.ac });
        }

        if (data.abilities) {
            const abilitiesStr = Object.entries(data.abilities)
                .map(([k, v]) => `${k.toUpperCase()}: ${typeof v === 'object' ? v.value : v}`)
                .join(', ');
            recap.details.push({ label: 'Caratteristiche', value: abilitiesStr });
        }

        if (data.items && data.items.length > 0) {
            const itemsList = data.items.map(i => {
                const source = i.fromCompendium ? '(compendio)' : '(creato)';
                return `${i.name} ${source}`;
            });
            recap.items = itemsList;
        }

        return recap;
    }
}
