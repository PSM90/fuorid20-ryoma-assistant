/**
 * Fuori D20: Ryoma Assistant
 * Item Manager - Create and modify Items
 */

import { MODULE_ID } from './config.js';

/**
 * Handles Item creation and modification
 */
export class ItemManager {
    /**
     * Create a new Item
     * @param {Object} data - Item data from LLM
     * @param {Actor|null} targetActor - Optional actor to add item to
     * @returns {Promise<Item>} Created item
     */
    static async createItem(data, targetActor = null) {
        try {
            const itemData = this.buildItemData(data);

            let item;
            if (targetActor) {
                // Create embedded item on actor
                const created = await targetActor.createEmbeddedDocuments('Item', [itemData]);
                item = created[0];
            } else {
                // Create standalone item in the world
                item = await Item.create(itemData);
            }

            console.log(`${MODULE_ID} | Created item: ${item.name}`);
            return item;
        } catch (error) {
            console.error(`${MODULE_ID} | Error creating item:`, error);
            throw error;
        }
    }

    /**
     * Build item data from LLM format
     * @param {Object} data - LLM item data
     * @returns {Object} Foundry item data
     */
    static buildItemData(data) {
        const itemData = {
            name: data.name || 'Nuovo Item',
            type: data.type || 'loot',
            img: data.img || this.getDefaultIcon(data.type),
            system: {
                description: {
                    value: data.description || data.data?.description || ''
                },
                source: data.source || 'Ryoma Assistant'
            }
        };

        // Build type-specific system data
        const typeData = data.data || data;

        switch (data.type) {
            case 'weapon':
                Object.assign(itemData.system, this.buildWeaponData(typeData));
                break;
            case 'spell':
                Object.assign(itemData.system, this.buildSpellData(typeData));
                break;
            case 'feat':
            case 'feature':
                Object.assign(itemData.system, this.buildFeatureData(typeData));
                break;
            case 'equipment':
                Object.assign(itemData.system, this.buildEquipmentData(typeData));
                break;
            case 'consumable':
                Object.assign(itemData.system, this.buildConsumableData(typeData));
                break;
            case 'tool':
                Object.assign(itemData.system, this.buildToolData(typeData));
                break;
            case 'class':
                Object.assign(itemData.system, this.buildClassData(typeData));
                break;
            case 'subclass':
                Object.assign(itemData.system, this.buildSubclassData(typeData));
                break;
            case 'race':
                Object.assign(itemData.system, this.buildRaceData(typeData));
                break;
            case 'background':
                Object.assign(itemData.system, this.buildBackgroundData(typeData));
                break;
        }

        return itemData;
    }

    /**
     * Build weapon-specific data
     */
    static buildWeaponData(data) {
        return {
            actionType: data.actionType || 'mwak',
            damage: data.damage || {
                parts: [['1d6', 'slashing']],
                versatile: ''
            },
            range: data.range || {
                value: 5,
                long: null,
                units: 'ft'
            },
            properties: data.properties || {},
            proficient: data.proficient !== false,
            attackBonus: data.attackBonus || '',
            weaponType: data.weaponType || 'simpleM',
            activation: {
                type: 'action',
                cost: 1
            }
        };
    }

    /**
     * Build spell-specific data
     */
    static buildSpellData(data) {
        return {
            level: data.level || 0,
            school: data.school || 'evo',
            components: {
                vocal: data.components?.vocal || data.components?.v || false,
                somatic: data.components?.somatic || data.components?.s || false,
                material: data.components?.material || data.components?.m || false,
                concentration: data.concentration || false,
                ritual: data.ritual || false
            },
            materials: {
                value: data.materials || '',
                consumed: data.materialsConsumed || false,
                cost: data.materialsCost || 0
            },
            duration: {
                value: data.duration?.value || null,
                units: data.duration?.units || 'inst'
            },
            range: {
                value: data.range?.value || null,
                long: data.range?.long || null,
                units: data.range?.units || 'self'
            },
            target: {
                value: data.target?.value || null,
                width: data.target?.width || null,
                units: data.target?.units || '',
                type: data.target?.type || ''
            },
            damage: data.damage || {},
            save: data.save ? {
                ability: data.save.ability || '',
                dc: data.save.dc || null,
                scaling: data.save.scaling || 'spell'
            } : {},
            activation: {
                type: data.activation?.type || 'action',
                cost: data.activation?.cost || 1
            },
            preparation: {
                mode: 'innate',
                prepared: true
            }
        };
    }

    /**
     * Build feature-specific data
     */
    static buildFeatureData(data) {
        return {
            activation: {
                type: data.activation?.type || '',
                cost: data.activation?.cost || null,
                condition: data.activation?.condition || ''
            },
            duration: {
                value: data.duration?.value || null,
                units: data.duration?.units || ''
            },
            range: {
                value: data.range?.value || null,
                units: data.range?.units || ''
            },
            target: {
                value: data.target?.value || null,
                type: data.target?.type || '',
                units: data.target?.units || ''
            },
            uses: {
                value: data.uses?.value || null,
                max: data.uses?.max || '',
                per: data.uses?.per || '',
                recovery: data.uses?.recovery || ''
            },
            consume: data.consume || {},
            damage: data.damage || {},
            save: data.save ? {
                ability: data.save.ability || '',
                dc: data.save.dc || null,
                scaling: data.save.scaling || 'flat'
            } : {},
            requirements: data.requirements || ''
        };
    }

    /**
     * Build equipment-specific data
     */
    static buildEquipmentData(data) {
        return {
            armor: {
                value: data.ac || data.armor?.value || 0,
                type: data.armorType || data.armor?.type || 'light',
                dex: data.maxDex || data.armor?.dex || null
            },
            strength: data.strength || 0,
            stealth: data.stealthDisadvantage || false,
            equipped: data.equipped !== false,
            proficient: data.proficient !== false,
            price: {
                value: data.price?.value || 0,
                denomination: data.price?.denomination || 'gp'
            },
            weight: data.weight || 0
        };
    }

    /**
     * Build consumable-specific data
     */
    static buildConsumableData(data) {
        return {
            consumableType: data.consumableType || 'potion',
            uses: {
                value: data.uses?.value || 1,
                max: data.uses?.max || 1,
                per: 'charges',
                autoDestroy: data.autoDestroy !== false
            },
            damage: data.damage || {},
            save: data.save || {},
            activation: {
                type: data.activation?.type || 'action',
                cost: data.activation?.cost || 1
            },
            price: {
                value: data.price?.value || 0,
                denomination: data.price?.denomination || 'gp'
            },
            weight: data.weight || 0
        };
    }

    /**
     * Build tool-specific data
     */
    static buildToolData(data) {
        return {
            toolType: data.toolType || 'art',
            proficient: data.proficient || 0,
            ability: data.ability || 'int',
            bonus: data.bonus || '',
            price: {
                value: data.price?.value || 0,
                denomination: data.price?.denomination || 'gp'
            },
            weight: data.weight || 0
        };
    }

    /**
     * Build class-specific data
     */
    static buildClassData(data) {
        return {
            levels: data.levels || 1,
            hitDice: data.hitDice || 'd8',
            hitDiceUsed: 0,
            spellcasting: {
                progression: data.spellcasting?.progression || 'none',
                ability: data.spellcasting?.ability || ''
            },
            saves: data.saves || [],
            skills: {
                number: data.skillNumber || 2,
                choices: data.skillChoices || [],
                value: []
            }
        };
    }

    /**
     * Build subclass-specific data
     */
    static buildSubclassData(data) {
        return {
            classIdentifier: data.classIdentifier || '',
            spellcasting: data.spellcasting || {}
        };
    }

    /**
     * Build race-specific data
     */
    static buildRaceData(data) {
        return {
            type: {
                value: data.creatureType || 'humanoid',
                subtype: data.creatureSubtype || ''
            },
            movement: data.movement || { walk: 30 },
            senses: data.senses || {}
        };
    }

    /**
     * Build background-specific data
     */
    static buildBackgroundData(data) {
        return {
            skills: data.skills || [],
            tools: data.tools || [],
            languages: data.languages || 0,
            startingEquipment: data.startingEquipment || []
        };
    }

    /**
     * Get default icon for item type
     */
    static getDefaultIcon(type) {
        const icons = {
            weapon: 'icons/svg/sword.svg',
            spell: 'icons/svg/fire.svg',
            feat: 'icons/svg/upgrade.svg',
            feature: 'icons/svg/upgrade.svg',
            equipment: 'icons/svg/shield.svg',
            consumable: 'icons/svg/potion.svg',
            tool: 'icons/svg/tool.svg',
            loot: 'icons/svg/coins.svg',
            class: 'icons/svg/book.svg',
            subclass: 'icons/svg/book.svg',
            race: 'icons/svg/mystery-man.svg',
            background: 'icons/svg/pawprint.svg'
        };

        return icons[type] || 'icons/svg/item-bag.svg';
    }

    /**
     * Modify an existing Item
     * @param {string} uuid - Item UUID
     * @param {Object} changes - Changes to apply
     * @returns {Promise<Item>} Modified item
     */
    static async modifyItem(uuid, changes) {
        try {
            const item = await fromUuid(uuid);
            if (!item) {
                throw new Error(`Item not found: ${uuid}`);
            }

            const updateData = this.buildUpdateData(changes);
            await item.update(updateData);

            console.log(`${MODULE_ID} | Modified item: ${item.name}`);
            return item;
        } catch (error) {
            console.error(`${MODULE_ID} | Error modifying item:`, error);
            throw error;
        }
    }

    /**
     * Build update data from changes
     */
    static buildUpdateData(changes) {
        const updateData = {};

        if (changes.name) updateData.name = changes.name;
        if (changes.img) updateData.img = changes.img;
        if (changes.description) updateData['system.description.value'] = changes.description;

        // Type-specific updates
        if (changes.damage) updateData['system.damage'] = changes.damage;
        if (changes.range) updateData['system.range'] = changes.range;
        if (changes.uses) updateData['system.uses'] = changes.uses;
        if (changes.activation) updateData['system.activation'] = changes.activation;
        if (changes.level !== undefined) updateData['system.level'] = changes.level;
        if (changes.school) updateData['system.school'] = changes.school;
        if (changes.ac !== undefined) updateData['system.armor.value'] = changes.ac;

        return updateData;
    }

    /**
     * Find an item by name in the world
     * @param {string} name - Item name
     * @returns {Item|null} Found item or null
     */
    static findItemByName(name) {
        const nameLower = name.toLowerCase();
        return game.items.find(i => i.name.toLowerCase() === nameLower);
    }

    /**
     * Build a recap for confirmation dialog
     */
    static buildCreationRecap(data) {
        const recap = {
            type: 'Item',
            subtype: data.type || 'loot',
            name: data.name,
            details: []
        };

        if (data.type === 'weapon') {
            if (data.damage?.parts?.[0]) {
                recap.details.push({
                    label: 'Danno',
                    value: data.damage.parts.map(p => `${p[0]} ${p[1]}`).join(' + ')
                });
            }
        }

        if (data.type === 'spell') {
            recap.details.push({ label: 'Livello', value: data.level || 0 });
            if (data.school) recap.details.push({ label: 'Scuola', value: data.school });
        }

        if (data.type === 'equipment' && data.ac) {
            recap.details.push({ label: 'CA', value: data.ac });
        }

        if (data.description) {
            recap.details.push({
                label: 'Descrizione',
                value: data.description.substring(0, 100) + (data.description.length > 100 ? '...' : '')
            });
        }

        return recap;
    }
}
