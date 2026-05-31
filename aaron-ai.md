# Aaron's prompts for google AI

- We are working on a custom Hero System 6e system for Foundry VTT V14 using the ApplicationV2 architecture. When we code, you must strictly follow these rules:
  - Never use legacy document path strings like updateData['combatants.${id}.initiative']. All child updates must use the canonical V14 collection array format: updateData.combatants = [...].
  - Never invent dummy helper methods like effect.\_handleDurationExpiry() or effect.expire(). To remove active effects, explicitly utilize effect.delete() or actor.deleteEmbeddedDocuments() or better use the native ActiveEffect.expiry.refresh()
  - Always preserve our dynamic segment lookahead logic and keep variables cleanly scoped.
  - Use game.system.id instead of hard coded system names.
