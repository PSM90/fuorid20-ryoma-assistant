/**
 * Fuori D20: Ryoma Assistant
 * Configuration and Settings Management
 */

// Module constants
export const MODULE_ID = 'fuori-d20-ryoma';
export const MODULE_NAME = 'Fuori D20: Ryoma Assistant';

// OpenRouter API endpoint
export const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Available LLM models
export const LLM_MODELS = {
  'openai/gpt-4o-mini': {
    name: 'GPT-4o Mini',
    description: 'Economico e veloce, ottimo per conversazioni',
    costPer1MInput: 0.15,
    costPer1MOutput: 0.60
  },
  'anthropic/claude-3.5-sonnet': {
    name: 'Claude 3.5 Sonnet',
    description: 'Avanzato, ideale per creazioni complesse',
    costPer1MInput: 3.00,
    costPer1MOutput: 15.00
  },
  'openai/gpt-4o': {
    name: 'GPT-4o',
    description: 'Bilanciato tra qualità e costo',
    costPer1MInput: 2.50,
    costPer1MOutput: 10.00
  },
  'anthropic/claude-3-haiku': {
    name: 'Claude 3 Haiku',
    description: 'Economico e veloce',
    costPer1MInput: 0.25,
    costPer1MOutput: 1.25
  }
};

// Default models
export const DEFAULT_MODEL = 'openai/gpt-4o-mini';
export const DEFAULT_COMPLEX_MODEL = 'anthropic/claude-3.5-sonnet';

// Compendium categories for D&D 5e
export const COMPENDIUM_CATEGORIES = {
  classes: {
    name: 'Classi',
    itemTypes: ['class']
  },
  subclasses: {
    name: 'Sottoclassi',
    itemTypes: ['subclass']
  },
  features: {
    name: 'Abilità e Razziali',
    itemTypes: ['feat', 'feature']
  },
  spells: {
    name: 'Incantesimi',
    itemTypes: ['spell']
  },
  items: {
    name: 'Oggetti',
    itemTypes: ['weapon', 'equipment', 'consumable', 'tool', 'loot', 'container']
  },
  actors: {
    name: 'Actors (Mostri/NPC)',
    documentType: 'Actor'
  },
  races: {
    name: 'Razze',
    itemTypes: ['race']
  },
  proficiencies: {
    name: 'Competenze e Maestrie',
    itemTypes: ['background', 'tool']
  }
};

// Chat command prefix
export const CHAT_PREFIX = '!R';

/**
 * Register all module settings
 */
export function registerSettings() {
  // API Key (password field)
  game.settings.register(MODULE_ID, 'apiKey', {
    name: game.i18n.localize('RYOMA.Settings.ApiKey.Name'),
    hint: game.i18n.localize('RYOMA.Settings.ApiKey.Hint'),
    scope: 'world',
    config: true,
    type: String,
    default: '',
    requiresReload: false
  });

  // Default model for conversations
  game.settings.register(MODULE_ID, 'defaultModel', {
    name: game.i18n.localize('RYOMA.Settings.DefaultModel.Name'),
    hint: game.i18n.localize('RYOMA.Settings.DefaultModel.Hint'),
    scope: 'world',
    config: true,
    type: String,
    choices: Object.fromEntries(
      Object.entries(LLM_MODELS).map(([key, val]) => [key, val.name])
    ),
    default: DEFAULT_MODEL,
    requiresReload: false
  });

  // Complex model for creations
  game.settings.register(MODULE_ID, 'complexModel', {
    name: game.i18n.localize('RYOMA.Settings.ComplexModel.Name'),
    hint: game.i18n.localize('RYOMA.Settings.ComplexModel.Hint'),
    scope: 'world',
    config: true,
    type: String,
    choices: Object.fromEntries(
      Object.entries(LLM_MODELS).map(([key, val]) => [key, val.name])
    ),
    default: DEFAULT_COMPLEX_MODEL,
    requiresReload: false
  });

  // Party Actors (stored as UUIDs)
  game.settings.register(MODULE_ID, 'partyActors', {
    name: game.i18n.localize('RYOMA.Settings.PartyConfig.Name'),
    hint: game.i18n.localize('RYOMA.Settings.PartyConfig.Hint'),
    scope: 'world',
    config: false, // We'll use a custom UI
    type: Array,
    default: [],
    requiresReload: false
  });

  // Compendium configuration (stored as object)
  game.settings.register(MODULE_ID, 'compendiumConfig', {
    name: game.i18n.localize('RYOMA.Settings.CompendiumConfig.Name'),
    hint: game.i18n.localize('RYOMA.Settings.CompendiumConfig.Hint'),
    scope: 'world',
    config: false, // We'll use a custom UI
    type: Object,
    default: {},
    requiresReload: false
  });

  // Register menu buttons for custom UIs
  game.settings.registerMenu(MODULE_ID, 'partyConfigMenu', {
    name: game.i18n.localize('RYOMA.Settings.PartyConfig.Name'),
    label: game.i18n.localize('RYOMA.Settings.PartyConfig.Button'),
    hint: game.i18n.localize('RYOMA.Settings.PartyConfig.Hint'),
    icon: 'fas fa-users',
    type: PartySelectorApp,
    restricted: true
  });

  game.settings.registerMenu(MODULE_ID, 'compendiumConfigMenu', {
    name: game.i18n.localize('RYOMA.Settings.CompendiumConfig.Name'),
    label: game.i18n.localize('RYOMA.Settings.CompendiumConfig.Button'),
    hint: game.i18n.localize('RYOMA.Settings.CompendiumConfig.Hint'),
    icon: 'fas fa-book',
    type: CompendiumConfigApp,
    restricted: true
  });

  game.settings.registerMenu(MODULE_ID, 'clearHistoryMenu', {
    name: game.i18n.localize('RYOMA.Settings.ClearHistory.Name'),
    label: game.i18n.localize('RYOMA.Settings.ClearHistory.Button'),
    hint: game.i18n.localize('RYOMA.Settings.ClearHistory.Hint'),
    icon: 'fas fa-trash',
    type: ClearHistoryApp,
    restricted: true
  });
}

/**
 * Get a setting value
 * @param {string} key - Setting key
 * @returns {*} Setting value
 */
export function getSetting(key) {
  return game.settings.get(MODULE_ID, key);
}

/**
 * Set a setting value
 * @param {string} key - Setting key
 * @param {*} value - New value
 */
export async function setSetting(key, value) {
  return game.settings.set(MODULE_ID, key, value);
}

/**
 * Check if API key is configured
 * @returns {boolean}
 */
export function hasApiKey() {
  const key = getSetting('apiKey');
  return key && key.trim().length > 0;
}

/**
 * Get the appropriate model based on task complexity
 * @param {boolean} isComplex - Whether this is a complex task
 * @returns {string} Model identifier
 */
export function getModel(isComplex = false) {
  return isComplex ? getSetting('complexModel') : getSetting('defaultModel');
}

/**
 * Get model display name
 * @param {string} modelId - Model identifier
 * @returns {string} Display name
 */
export function getModelDisplayName(modelId) {
  return LLM_MODELS[modelId]?.name || modelId;
}

// Placeholder classes for settings menus (will be defined in UI modules)
class PartySelectorApp extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'rioma-party-selector',
      title: game.i18n.localize('RYOMA.Party.Title'),
      template: `modules/${MODULE_ID}/templates/party-selector.hbs`,
      classes: ['rioma-party-selector'],
      width: 600,
      height: 'auto',
      closeOnSubmit: true
    });
  }

  async getData() {
    const selectedUUIDs = getSetting('partyActors') || [];
    const allActors = game.actors.filter(a => a.type === 'character' || a.type === 'npc');

    return {
      actors: allActors.map(actor => ({
        uuid: actor.uuid,
        name: actor.name,
        img: actor.img,
        type: actor.type,
        class: actor.system?.details?.class || '',
        level: actor.system?.details?.level || '',
        selected: selectedUUIDs.includes(actor.uuid)
      })),
      selectedCount: selectedUUIDs.length
    };
  }

  async _updateObject(event, formData) {
    const selected = formData.selectedActors || [];
    await setSetting('partyActors', Array.isArray(selected) ? selected : [selected]);
  }
}

class CompendiumConfigApp extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'rioma-compendium-config',
      title: game.i18n.localize('RYOMA.Compendium.Title'),
      template: `modules/${MODULE_ID}/templates/compendium-config.hbs`,
      classes: ['rioma-compendium-config'],
      width: 700,
      height: 'auto',
      closeOnSubmit: true
    });
  }

  async getData() {
    const config = getSetting('compendiumConfig') || {};
    const categories = {};

    for (const [key, category] of Object.entries(COMPENDIUM_CATEGORIES)) {
      const compendiums = [];

      for (const pack of game.packs) {
        // Filter by document type or item types
        if (category.documentType && pack.documentName !== category.documentType) continue;
        if (category.itemTypes && pack.documentName !== 'Item') continue;

        compendiums.push({
          id: pack.collection,
          name: pack.metadata.label,
          package: pack.metadata.packageName,
          count: pack.index.size,
          selected: (config[key] || []).includes(pack.collection)
        });
      }

      categories[key] = {
        name: category.name,
        compendiums,
        selectedCount: (config[key] || []).length
      };
    }

    return { categories };
  }

  async _updateObject(event, formData) {
    const config = {};
    for (const key of Object.keys(COMPENDIUM_CATEGORIES)) {
      const fieldName = `compendiums.${key}`;
      const value = formData[fieldName];
      config[key] = Array.isArray(value) ? value : (value ? [value] : []);
    }
    await setSetting('compendiumConfig', config);
  }
}

class ClearHistoryApp extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'rioma-clear-history',
      title: game.i18n.localize('RYOMA.Settings.ClearHistory.Name'),
      template: `modules/${MODULE_ID}/templates/clear-history.hbs`,
      classes: ['rioma-clear-history'],
      width: 400,
      height: 'auto'
    });
  }

  async getData() {
    return {
      message: game.i18n.localize('RYOMA.Settings.ClearHistory.Confirm')
    };
  }

  async _updateObject(event, formData) {
    // Import ConversationManager and clear history
    const { ConversationManager } = await import('./conversation-manager.js');
    await ConversationManager.clearHistory();
    ui.notifications.info('Storico conversazioni cancellato.');
  }
}

// Export the app classes for registration
export { PartySelectorApp, CompendiumConfigApp, ClearHistoryApp };
