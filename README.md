# Fuori D20: Ryoma Assistant

Assistente LLM intelligente per Master D&D 5e su Foundry VTT v13.

🐺 **Ryoma** può conversare, consigliare, creare e modificare Actors e Items tramite OpenRouter.

## Caratteristiche

- 💬 **Chat con prefisso `!R`** - Parla con Ryoma nella chat di Foundry
- 🧠 **Memoria persistente** - Ricorda le conversazioni precedenti
- ⚔️ **Creazione Actor/Item** - Crea NPC, mostri, oggetti, incantesimi
- 📚 **Integrazione Compendi** - Suggerisce contenuti dai tuoi compendi
- 🎯 **Bilanciamento Scontri** - Analizza il party per creare nemici adeguati
- 🇮🇹 **Tutto in italiano** - Ryoma parla sempre in italiano

## Requisiti

- Foundry VTT v13+
- Sistema D&D 5e 4.0+
- API Key da [OpenRouter](https://openrouter.ai)

## Installazione

1. Scarica o clona questa repository
2. Copia la cartella nella directory modules di Foundry
3. Attiva il modulo nel World
4. Configura l'API Key nelle impostazioni

## Configurazione

1. **API Key**: Ottieni una key da [openrouter.ai](https://openrouter.ai)
2. **Party**: Seleziona quali Actors sono i PG giocanti
3. **Compendi**: Configura quali compendi Ryoma può consultare per categoria

## Utilizzo

```
!R Ciao Ryoma!
!R Crea un goblin arciere per il mio party
!R Suggeriscimi mostri per una cripta
!R conferma / !R annulla
```

## Modelli LLM

| Modello | Uso | Costo |
|---------|-----|-------|
| GPT-4o-mini | Conversazioni | ~$0.15/1M token |
| Claude 3.5 Sonnet | Creazioni complesse | ~$3/1M token |

## Licenza

MIT

## Autori

Fuori D20
