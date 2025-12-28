/**
 * Fuori D20: Ryoma Assistant
 * Party Analyzer - Extracts and analyzes party member data
 */

import { MODULE_ID, getSetting } from './config.js';

/**
 * Analyzes the party composition for LLM context
 */
export class PartyAnalyzer {
    /**
     * Get all configured party member Actors
     * @returns {Promise<Array<Actor>>} Array of Actor documents
     */
    static async getPartyActors() {
        const uuids = getSetting('partyActors') || [];
        const actors = [];

        for (const uuid of uuids) {
            try {
                const actor = await fromUuid(uuid);
                if (actor) {
                    actors.push(actor);
                }
            } catch (error) {
                console.warn(`${MODULE_ID} | Could not load actor ${uuid}:`, error);
            }
        }

        return actors;
    }

    /**
     * Get detailed analysis of a single actor
     * @param {Actor} actor - Foundry Actor document
     * @returns {Object} Analyzed actor data
     */
    static analyzeActor(actor) {
        const system = actor.system;

        // Extract class information
        let className = '';
        let level = 0;

        if (system.details?.class) {
            className = system.details.class;
        }

        if (system.details?.level) {
            level = system.details.level;
        } else if (system.classes) {
            // For D&D 5e, calculate total level from classes
            level = Object.values(system.classes).reduce((sum, cls) => sum + (cls.levels || 0), 0);
            className = Object.values(system.classes).map(cls => cls.name).join('/');
        }

        // Extract HP
        const hp = system.attributes?.hp?.value || 0;
        const maxHp = system.attributes?.hp?.max || 0;

        // Extract AC
        const ac = system.attributes?.ac?.value || 10;

        // Extract abilities
        const abilities = {};
        if (system.abilities) {
            for (const [key, ability] of Object.entries(system.abilities)) {
                abilities[key] = {
                    value: ability.value || 10,
                    mod: ability.mod || 0,
                    save: ability.save || 0
                };
            }
        }

        // Extract movement
        const speed = system.attributes?.movement || {};

        // Extract proficiencies and skills
        const skills = {};
        if (system.skills) {
            for (const [key, skill] of Object.entries(system.skills)) {
                if (skill.proficient || skill.value > 0) {
                    skills[key] = {
                        proficient: skill.proficient,
                        bonus: skill.total || skill.mod || 0
                    };
                }
            }
        }

        // Extract spell slots and spell info
        let spellcasting = null;
        if (system.spells) {
            const spellSlots = {};
            for (const [key, slot] of Object.entries(system.spells)) {
                if (slot.max > 0) {
                    spellSlots[key] = {
                        value: slot.value,
                        max: slot.max
                    };
                }
            }
            if (Object.keys(spellSlots).length > 0) {
                spellcasting = {
                    ability: system.attributes?.spellcasting || 'int',
                    dc: system.attributes?.spelldc || 10,
                    slots: spellSlots
                };
            }
        }

        // Get known spells
        const spells = actor.items
            .filter(i => i.type === 'spell')
            .map(spell => ({
                name: spell.name,
                level: spell.system.level,
                school: spell.system.school
            }));

        // Get features
        const features = actor.items
            .filter(i => i.type === 'feat' || i.type === 'feature')
            .map(feat => feat.name);

        // Get equipment
        const equipment = actor.items
            .filter(i => ['weapon', 'equipment', 'consumable', 'tool'].includes(i.type))
            .map(item => ({
                name: item.name,
                type: item.type,
                equipped: item.system.equipped
            }));

        return {
            uuid: actor.uuid,
            name: actor.name,
            img: actor.img,
            type: actor.type,
            class: className,
            level: level,
            race: system.details?.race || '',
            hp: hp,
            maxHp: maxHp,
            ac: ac,
            abilities: abilities,
            speed: speed,
            skills: skills,
            spellcasting: spellcasting,
            knownSpells: spells.length,
            spellList: spells.slice(0, 20), // Limit for context size
            features: features,
            equipment: equipment.filter(e => e.equipped)
        };
    }

    /**
     * Analyze the full party
     * @returns {Promise<Object>} Party analysis
     */
    static async analyzeParty() {
        const actors = await this.getPartyActors();

        if (actors.length === 0) {
            return {
                members: [],
                averageLevel: 0,
                totalHp: 0,
                composition: {},
                summary: 'Nessun personaggio giocante configurato.'
            };
        }

        const members = actors.map(actor => this.analyzeActor(actor));

        // Calculate party statistics
        const totalLevel = members.reduce((sum, m) => sum + m.level, 0);
        const averageLevel = Math.round(totalLevel / members.length);

        const totalHp = members.reduce((sum, m) => sum + m.maxHp, 0);
        const totalCurrentHp = members.reduce((sum, m) => sum + m.hp, 0);

        // Class composition
        const composition = {};
        for (const member of members) {
            const cls = member.class || 'Sconosciuto';
            composition[cls] = (composition[cls] || 0) + 1;
        }

        // Party roles analysis
        const roles = this.analyzePartyRoles(members);

        return {
            members,
            count: members.length,
            averageLevel,
            totalHp,
            totalCurrentHp,
            composition,
            roles,
            summary: this.buildPartySummary(members, averageLevel, roles)
        };
    }

    /**
     * Analyze party roles (tank, healer, damage, support)
     * @param {Array} members - Analyzed members
     * @returns {Object} Role analysis
     */
    static analyzePartyRoles(members) {
        const roles = {
            tanks: [],
            healers: [],
            damage: [],
            support: [],
            spellcasters: []
        };

        const tankClasses = ['barbarian', 'fighter', 'paladin', 'barbaro', 'guerriero', 'paladino'];
        const healerClasses = ['cleric', 'druid', 'paladin', 'chierico', 'druido', 'paladino'];
        const damageClasses = ['rogue', 'fighter', 'ranger', 'monk', 'ladro', 'guerriero', 'ranger', 'monaco'];
        const spellcasterClasses = ['wizard', 'sorcerer', 'warlock', 'bard', 'cleric', 'druid', 'mago', 'stregone', 'warlock', 'bardo', 'chierico', 'druido'];

        for (const member of members) {
            const classLower = (member.class || '').toLowerCase();

            // Check by class
            if (tankClasses.some(c => classLower.includes(c))) {
                roles.tanks.push(member.name);
            }
            if (healerClasses.some(c => classLower.includes(c))) {
                roles.healers.push(member.name);
            }
            if (damageClasses.some(c => classLower.includes(c))) {
                roles.damage.push(member.name);
            }
            if (spellcasterClasses.some(c => classLower.includes(c))) {
                roles.spellcasters.push(member.name);
            }

            // Check by stats - high CON = tank potential
            if (member.abilities?.con?.value >= 14 && member.ac >= 16) {
                if (!roles.tanks.includes(member.name)) {
                    roles.tanks.push(member.name);
                }
            }

            // Has healing spells
            if (member.spellList?.some(s =>
                s.name.toLowerCase().includes('cur') ||
                s.name.toLowerCase().includes('heal') ||
                s.name.toLowerCase().includes('restoration')
            )) {
                if (!roles.healers.includes(member.name)) {
                    roles.healers.push(member.name);
                }
            }
        }

        return roles;
    }

    /**
     * Build a text summary of the party for LLM context
     * @param {Array} members - Party members
     * @param {number} avgLevel - Average level
     * @param {Object} roles - Role analysis
     * @returns {string} Party summary
     */
    static buildPartySummary(members, avgLevel, roles) {
        let summary = `Party di ${members.length} personaggi, livello medio ${avgLevel}:\n`;

        for (const member of members) {
            summary += `- ${member.name}: ${member.race} ${member.class} Lv${member.level}`;
            summary += ` (HP ${member.hp}/${member.maxHp}, CA ${member.ac})\n`;
        }

        summary += '\nRuoli nel party:\n';
        if (roles.tanks.length > 0) summary += `- Tank: ${roles.tanks.join(', ')}\n`;
        if (roles.healers.length > 0) summary += `- Guaritori: ${roles.healers.join(', ')}\n`;
        if (roles.damage.length > 0) summary += `- DPS: ${roles.damage.join(', ')}\n`;
        if (roles.spellcasters.length > 0) summary += `- Incantatori: ${roles.spellcasters.join(', ')}\n`;

        // Weaknesses
        const weaknesses = [];
        if (roles.tanks.length === 0) weaknesses.push('manca un tank solido');
        if (roles.healers.length === 0) weaknesses.push('manca un guaritore');
        if (roles.spellcasters.length === 0) weaknesses.push('manca supporto magico');

        if (weaknesses.length > 0) {
            summary += `\nPunti deboli: ${weaknesses.join(', ')}.`;
        }

        return summary;
    }

    /**
     * Get party context formatted for LLM
     * @returns {Promise<Object>} Context object
     */
    static async getContextForLLM() {
        const analysis = await this.analyzeParty();

        return {
            party: analysis.members.map(m => ({
                name: m.name,
                class: m.class,
                level: m.level,
                race: m.race,
                hp: m.hp,
                maxHp: m.maxHp,
                ac: m.ac
            })),
            averageLevel: analysis.averageLevel,
            partySize: analysis.count,
            roles: analysis.roles,
            summary: analysis.summary
        };
    }

    /**
     * Calculate appropriate encounter difficulty
     * @param {string} difficulty - 'easy', 'medium', 'hard', 'deadly'
     * @returns {Promise<Object>} Encounter budget info
     */
    static async calculateEncounterBudget(difficulty = 'medium') {
        const analysis = await this.analyzeParty();

        if (analysis.members.length === 0) {
            return { error: 'No party configured' };
        }

        // D&D 5e XP thresholds by level
        const xpThresholds = {
            1: { easy: 25, medium: 50, hard: 75, deadly: 100 },
            2: { easy: 50, medium: 100, hard: 150, deadly: 200 },
            3: { easy: 75, medium: 150, hard: 225, deadly: 400 },
            4: { easy: 125, medium: 250, hard: 375, deadly: 500 },
            5: { easy: 250, medium: 500, hard: 750, deadly: 1100 },
            6: { easy: 300, medium: 600, hard: 900, deadly: 1400 },
            7: { easy: 350, medium: 750, hard: 1100, deadly: 1700 },
            8: { easy: 450, medium: 900, hard: 1400, deadly: 2100 },
            9: { easy: 550, medium: 1100, hard: 1600, deadly: 2400 },
            10: { easy: 600, medium: 1200, hard: 1900, deadly: 2800 },
            11: { easy: 800, medium: 1600, hard: 2400, deadly: 3600 },
            12: { easy: 1000, medium: 2000, hard: 3000, deadly: 4500 },
            13: { easy: 1100, medium: 2200, hard: 3400, deadly: 5100 },
            14: { easy: 1250, medium: 2500, hard: 3800, deadly: 5700 },
            15: { easy: 1400, medium: 2800, hard: 4300, deadly: 6400 },
            16: { easy: 1600, medium: 3200, hard: 4800, deadly: 7200 },
            17: { easy: 2000, medium: 3900, hard: 5900, deadly: 8800 },
            18: { easy: 2100, medium: 4200, hard: 6300, deadly: 9500 },
            19: { easy: 2400, medium: 4900, hard: 7300, deadly: 10900 },
            20: { easy: 2800, medium: 5700, hard: 8500, deadly: 12700 }
        };

        // Calculate total XP threshold for the party
        let totalXP = 0;
        for (const member of analysis.members) {
            const level = Math.max(1, Math.min(20, member.level));
            totalXP += xpThresholds[level][difficulty] || 0;
        }

        return {
            difficulty,
            partySize: analysis.count,
            averageLevel: analysis.averageLevel,
            xpBudget: totalXP,
            suggestion: `Per uno scontro "${difficulty}" per questo party, il budget XP è circa ${totalXP} XP.`
        };
    }
}
