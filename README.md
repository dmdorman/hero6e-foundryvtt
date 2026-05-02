# Hero System 6e (Unofficial) v2

Forked from Hero System 6e (Unofficial)

This system is for playing the sixth and fifth edition of the Hero System using FoundryVTT.

HERO SystemTM ® is DOJ, Inc.'s trademark for its roleplaying system.
HERO System Copyright © 1984, 1989, 2002, 2009 by DOJ, Inc. d/b/a Hero Games. All rights
reserved.
Fantasy Hero © 2003, 2010 by DOJ, Inc. d/b/a Hero Games. All rights reserved.
Star Hero © 2003, 2011 by DOJ, Inc. d/b/a Hero Games. All rights reserved.
All DOJ trademarks and copyrights used with permission.
For further information about Hero Games and the HERO System, visit [www.herogames.com](https://www.herogames.com).

Support can be found by creating a [new issue](https://github.com/dmdorman/hero6e-foundryvtt/issues), starting a [new discussion](https://github.com/dmdorman/hero6e-foundryvtt/discussions) or on the Hero-Champions-RPG (unofficial) Foundry-vtt [Discord Channel](https://discord.gg/HcUJvJH).

We have a [YouTube channel](https://www.youtube.com/channel/UCcmq0WFFNZNhRSGwuEHOgRg) with some how to videos.
​

## Functionality

This system is a work in progress. The following features are supported

- A proper Turn/Phase/Segment initiative tracking system
- A character sheet that you can upload a .HDC file to
- Attack automation

### Character Sheet

- The character sheet in this system supports automation for characteristic and skill rolls.
- .HDC files created in the Hero Designer can be uploaded to it, and currently supports automatically populating information for a character's characteristics, skills, powers, etc.
- Most attack powers are displayed in attacks tab. Most defense powers are displayed in defenses tab.
- Attacks, defense, and skills can be manually added by users.
- Defenses and most powers can be toggled on and off.
- The character sheet can be used to take a Recovery.
- Character image stored in .HDC file is used for token.

#### Maneuvers

Custom maneuvers show under attacks. Basic maneuvers are shown in the maneuver's tab. The ones that are actions (and behave like an attack) have a roll icon and behave like an attack. Set/Brace/Haymaker are toggles and enhance other attacks.

### Attack Automation

- An attack can be used by clicking on dice icon from the Character Sheet 'Attacks' tab. This will add a card to the chat for the attack.
- The card will show the attack roll and damage roll as well as any additional effects information below.
- Target defense can be applied to damage rolls. Final damage is applied to token's stun/body. If Stun damage exceeds CON then a stunned condition is applied.
- You can drag attacks (or any power) from character sheet to quick bar.

### Other Automation

- END and Charges are spent for each attack.
- END can be spent from personal endurance or from an endurance reserve.
- Post Segment 12 recovery: Endurance and Stun
- END for active powers are spent each phase.
- Stun and attacks that have DCV modifications expire on next phase.
- Some status' have CV modifications.
- Powers that modify characteristics and defenses can be toggled on/off.
- Powers with Requires A Roll are automatically rolled.
- Charges recover each day (Simple Calendar required)
- END/STUN/BODY recover out of combat (Simple Calendar required)
- Stun/KnockedOut/Aborted prevent attacks or turning on powers.
- Combat Skill Levels are calculated.
- Knockback calculations.
- Aid/Drain/Transfer effects are calculated, they fade and eventually expire.
- Penetrating/Impenetrable and Armor Piercing/Hardened calculations.
- Drag Ruler (optional module) show color coded full/half moves.
- Velocity estimations for move by and move through based on current movement type. `Drag Ruler` (optional module with `socketlib` module dependency) improves velocity estimation.
- Range penalties included in calculations.

## System Options

- Attack Card Automation:
  - No Automation: Attack card will show attack and damage results, but will not update body, stun, or end from target.
  - NPCs Only: Attack card will subtract effective values from body, stun, and end but only for actors/tokens without a player owner.
  - PCs(end) and NPCs: Same as NPCs only except actors/tokens with a player owner will update end.
  - PCs and NPCs: Attack card will update stun, body, and end for all tokens/actors.
- Use Stunned: Whether or not attacks can inflict stunned.
- Use Endurance: Whether or not endurance will be automatically tracked when using automated attack cards.
- Use Knockback: Automates knockback rolls and calculations from attack cards.
- Hit Locations: Automates hit location rolls and calculations from attack cards.
- Hit Location (Track Damage Done to Individual Body Parts): Health tracking for individual body parts.
- Optional Maneuvers: Adds optional maneuvers to character sheets on .HDC upload.
- Heroic Action Points: Adds Heroic Action Points (HAP) tracking to character sheets.
- Use Hexagonal AOE templates: Use 5e shapes (NOTE: 5e uses hexes but 6e does not. If you use hexes to play you likely want to have your shapes be hex based).
- Default System Rules: When this system cannot determine what version of HERO rules to use, based on your character sheets, it will use this.
- Heroic STR and END: Does strength use 1 END per 5 or 10 strength?
- Double Damage Limit: Follow the HERO system rule that limits the max number of DC based for a given base attack.
- Dice Skinning (Dice So Nice!): Colour skin the dice that are rolled to help differentiate their purpose.
- Custom Killing Attack STUN Multiplier: Change the formula used for killing attacks' STUN multiplier to match what you want. Setting all fields to 0 will use the default for your system.

## Manual Rolling

Sometimes you just need to manually roll the dice and you don't want to count the number of STUN and BODY on a 167d6 atomic bomb that your heroes failed to defuse. For such occasions the system has the `/heroRoll` chat command. It's syntax is similar to the FoundryVTT `/roll` command but with minimal support multiple terms.

`/heroRoll <roll to perform><optional flavour of dice roll>`

### Roll to Perform

The command supports the typical combinations of rolls you might be asked to do in the Hero System such as `7d6`, `7d6-1`, `2d6+1`, or `7.5d6` (aka seven and a half dice).

### Optional Flavour of Dice Roll

The command supports rolling all the expected types of rolls as you would expect from the system making a similar roll as a part of the automation:

- `[k]` for killing rolls
- `[n]` for normal rolls
- `[a]` for adjustment rolls
- `[e]` for entangle rolls
- `[s]` for success rolls
- `[f]` for flash rolls
- `[l]` for luck rolls
- `[u]` for unluck rolls
- anything else, or omitted, for basic rolls

### Optional Hit Location

Prefacing the the flavour with an `h` will give you a roll with hit locations. So `[hk]` will give you a killing attack with hit locations being rolled. Hit location side will be rolled if you have it configured. You probably won't want to roll with a hit location if the command shouldn't support it (e.g. success with hit location).

### Examples

- `/heroRoll 7d6-1[n]` performs a 6d6 + 1d6-1 normal roll
- `/heroroll 3d6[s]` performs a 3d6 success roll
- `/heroroll 5d6+1[hk]` performs a 5d6 + 1 pip killing attack with hit location roll
- `/heroRoll 167d6[n]` to drop an atomic bomb on the PCs

![A nasty roll you don't want to be hit with](./media/big-bomb-roll.png)

### Inline rolls

`/heroRoll` is available for embedding into chat, journal, and the character sheets similiar to `/roll`. Just wrap the same `/heroRoll` expression in `[[` and `]]` to make it inline. For example, to make `/heroRoll 7d6-1[n]` into an inline roll, it becomes `[[/heroRoll 7d6-1[n]]]`.

### FoundryVTT Macros

`/heroRoll` is available through both chat and script macros.

#### Chat Macros

`/heroRoll` chat macros should work as described above as they are just chat messages.

#### Script Macros

The `HeroRoller` class and all other exports are available through the globally accessible `CONFIG.HERO.heroDice` namespace. You will need to consult the code (see `utility/dice.mjs`) but here is a simplistic example of how to use it and to show the dice rolls with Dice So Nice! skinning.

```javascript
const damageRoller = new CONFIG.HERO.heroDice.HeroRoller()
  .setPurpose(CONFIG.HERO.heroDice.DICE_SO_NICE_CUSTOM_SETS.KNOCKBACK)
  .addDice(5, "Knockback")
  .makeNormalRoll();
await damageRoller.roll();

const cardHtml = await damageRoller.render("Knockback roll");

const chatData = {
  style: CONST.CHAT_MESSAGE_STYLES.OTHER,
  rolls: damageRoller.rawRolls(),
  author: game.user._id,
  content: cardHtml,
};

return ChatMessage.create(chatData);
```

## Known Limitations

- The upload of a .HDC file from Hero Designer is a requirement. You can't create powers, skills, or equipment from scratch. Character editing is limited within the system. Some power modifiers are supported, some are not, character sheets do not clearly show power modifiers. You can click the chat icon next to a power to see the full description.
- Untested/limited support for vehicles, automations, computers, etc.
- Power frameworks are partially supported.
- The following are largely not implemented
  - Attack powers that do not do stun/body damage (Change Environment, Darkness, Dispel, Images, Mental Illusions, Mind Control, Reflection, Transform).
  - Attack powers with NND & AVAD
  - Body-Affecting powers (Desolidification, Duplication, Extra Limbs, Growth, Multiform, Shape Shift, Shrinking, Stretching)
  - Mental Powers (Mental Illusions, Mind Control, Mind Scan, Telepathy)
  - Sense-Affecting powers (Darkness, Flash, Images, Invisibility)
  - Sensory powers (Clairsentience, Enhanced Senses, Mind Scan)
  - Special powers (Duplication, Enhanced Senses, Extra Limbs, Flash Defense, Luck, Power Defense, Regeneration)
  - Perks, Talents, and Complications
  - See the [FEATURES](FEATURES.md) list which includes a support rating.

## Modules

The following modules have been successfully tested for compatibility. They are also recommended.

- [Dice So Nice!](https://gitlab.com/riccisi/foundryvtt-dice-so-nice)
- [Bar Brawl](https://foundryvtt.com/packages/barbrawl)
- [Tokenizer](https://foundryvtt.com/packages/vtta-tokenizer/)
- [Active Token Effects](https://foundryvtt.com/packages/ATL). Used for automation of carried lights.

## 5th Edition Support

This is a 6E framework, however 5E is well supported. A 5E character is detected when you upload a HDC file using one of the 5E Hero Designer character templates. Under settings you will find a "default edition" setting to select 5E/6E, which helps the system select the appropriate ruleset to use. The subtle differences in some powers has been accounted for. You can use inches for your scene grids.

## Frequently Asked Questions and GM suggestions

1. The Actor Sheet doesn't match HD.
   - Try uploading the HDC file again.
   - Try clicking the "Full Health" button on the actor sheet.
2. How do you set a toggle power to default to off after HDC upload?
   - In HD set "Totaling Options" to "Do not add to Totals".
3. How do you get automation to determine hit or miss?
   - Click the target of your attack. Press 't' to select target. Open attacker's character sheet. Click dice icon next to attack. The chat cards should show a hit/miss. If it is a hit then the damage card will have a button to apply damage to your target.
   - You can select multiple targets with shift-t.
4. I'm unable to change a Characteristics Max number.
   - You likely have a power that is modifying the Max number. Turn that power off, make the change to Max, then turn power back on.
5. Is there a way to change measuring distance to 1" for 5e campaigns?
   - You can change it scene by scene by opening the scene settings -> grid then edit 'Grid Scale'
6. Marking a token as dead marks all identical tokens as dead. [#247](https://github.com/dmdorman/hero6e-foundryvtt/issues/247)
   - You need to turn off _Link Actor Data_ in the actor Prototype Token or Token screen.
   - Named actors can have tokens on several scenes, and by default their properties are linked to the master actor. So as you move from scene to scene their STUN/BODY/Statuses and all other properties remain the same.
   - Generic actors should have their link actor data unchecked, which allows you to make distinct changes to the tokens, those changes do not affect the master actor. There are also options on the Prototype token to add a number or adjective to the token name.

## Screenshots

![CrusherAttacks](./media/CrusherAttacks.png)

![CrusherDefenses](./media/CrusherDefenses.png)

![CrusherSkills](./media/CrusherSkills.png)

![CrusherManeuvers](./media/CrusherManeuvers.png)

![CrusherMovement](./media/CrusherMovement.png)

![CrusherPowers](./media/CrusherPowers.png)

![CrusherCharacteristics](./media/CrusherCharacteristics.png)

![CrusherOther](./media/CrusherOther.png)

![CrushAttackEdit](./media/CrushAttackEdit.png)

![CrusherAttackEdit](./media/CrushAttackCard.png)

![CrusherAttackEdit](./media/CrushDamageCard.png)

![CrusherAttackEdit](./media/CrushApplyDamageCard.png)

![CrusherMovementRadios](./media/CrusherMovementRadios.png)
