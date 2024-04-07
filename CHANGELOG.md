# Releases

## Version 3.0.69 [Hero System 6e (Unofficial) v2](https://github.com/dmdorman/hero6e-foundryvtt)

- Improved AOE template accuracy. [#966](https://github.com/dmdorman/hero6e-foundryvtt/issues/966)
- Removed auto success/miss for standard AOE targets. [#965](https://github.com/dmdorman/hero6e-foundryvtt/issues/965)
- Initial support for STR MINIMUM. STR damage is reduced by STR MINIMUM, but no OCV/DC penalties for low STR. [#971](https://github.com/dmdorman/hero6e-foundryvtt/issues/971) [#127](https://github.com/dmdorman/hero6e-foundryvtt/issues/127)
- Initial support for WEAPON_MASTER talent. [#972](https://github.com/dmdorman/hero6e-foundryvtt/issues/972)
- Initial support for DEADLYBLOW talent. [#972](https://github.com/dmdorman/hero6e-foundryvtt/issues/972)
- Initial support for PERSONALIMMUNITY. [#973](https://github.com/dmdorman/hero6e-foundryvtt/issues/973)
- Reworked Combat Skill Levels. They now use Custom Adders to store attack details.  You can use Custom Adder in your HD file to streamline future imports, so you don't have to update your CSLs every time you import. Educated guessing of which attacks apply if you don't provide them in the HD file as custom adders. [#883](https://github.com/dmdorman/hero6e-foundryvtt/issues/883)

## Version 3.0.68

- Correct range penalty calculations. [#944](https://github.com/dmdorman/hero6e-foundryvtt/issues/944)
- 5e actors will now see ruler measurements in hexes ("). We still recommend both 5e and 6e scenes use a grid size of 2m.
- Additional in-game editing support focused mainly on AOE.

## Version 3.0.67.1

- Improve descriptions for senses. [#934](https://github.com/dmdorman/hero6e-foundryvtt/issues/934)
- Correct default 6e AOE line width and height determination. [#937](https://github.com/dmdorman/hero6e-foundryvtt/issues/937)
- 5e missile deflection and reflection should not use END. [#945](https://github.com/dmdorman/hero6e-foundryvtt/issues/945)
- Presence attack can now do 1/2 dice and 1/2 dice modification increments. [#943](https://github.com/dmdorman/hero6e-foundryvtt/issues/943)
- Attacks now have auto success (3) and auto failure (18). [#562](https://github.com/dmdorman/hero6e-foundryvtt/issues/562) [#522](https://github.com/dmdorman/hero6e-foundryvtt/issues/522)
- Warning is now given when attacking with no target selected. [#927](https://github.com/dmdorman/hero6e-foundryvtt/issues/927)
- Improved SHRINKING and GROWTH support. [#936](https://github.com/dmdorman/hero6e-foundryvtt/issues/936)
- Fix for POWERSKILL where it was not rollable.

## Version 3.0.66

- Fix velocity calculations for 5e. [#923](https://github.com/dmdorman/hero6e-foundryvtt/issues/923)
- Calculated velocity for maneuvers can now be adjusted in the to hit dialog when necessary. [#923](https://github.com/dmdorman/hero6e-foundryvtt/issues/923)

- Improved in-game editing:
  - You can add most skills, powers, etc to an actor in-game. Frameworks, compound powers, and enhancers can not be added in-game yet.
  - Some editing options are confusing and will be improved in future releases.
  - A limited number of adders and modifiers can be added to items.  Will add more in future releases.
  - Simplified editing of attacks.  Using adders for +1/2 d6 and +1 pip.
  - There is minimal vetting of in-game editing.  Any invalid adders/modifiers for a specific power will likely to be ignored and/or may cause automation issues.
  - Items modified in-game may have incorrect costs and active points.
  - Be careful when re-uploading HDC files as in-game edits for that actor will be overwritten without warning.

## Version 3.0.65

- Fix crash during HDC upload with change environment and the damage adder.
- Improve martial maneuvers using `[FLASHDC]` and `[STRDC]` effects. [#850](https://github.com/dmdorman/hero6e-foundryvtt/issues/850)
- Add phase information to martial maneuvers.
- Can now make attack rolls directly from the `MartialArts` tab. [#834](https://github.com/dmdorman/hero6e-foundryvtt/issues/834)
- For odd time you don't want to count the result of a manual dice roll, `/heroroll` in chat is now a command. See [README.md](https://github.com/dmdorman/hero6e-foundryvtt/blob/main/README.md#manual-rolling) for details.
- Correct Find Weakness' and Danger Sense description and cost.
- Add success roll icon to the appropriate entries in the actor's sheet powers tab.
- Minimum damage calculation changed such that it is last in the damage application chain to allow penetrating killing attacks to do STUN >= BODY.
- Fix adjustment powers not getting power defense and add effects, such as penetrating, to adjustment chat card.
- Drag Ruler will now show proper 5e colours at appropriate distances.
- Defense are now properly applied to ADJUSTMENT POWERS. Added effect descriptions (such as penetrating) to adjustment chat card.
- You can now add most skills and some powers in game.  We're still adding the rest of the powers, perks, etc.  Only a few items (blast for example) are functionally editable at the moment.  One small step toward Hero Designer lite.

## Version 3.0.64

- Actors that were uploaded prior to 3.0.35 (October 2023) are no longer supported. You will need to re-upload these HDC files. You will see a limited number of warnings during migration. Advanced users can view all warnings in the browser developer console. [#856](https://github.com/dmdorman/hero6e-foundryvtt/issues/856)
- Removed ability to create manual attacks, skills, powers, etc. Any manually created items breaks some of the new codebase. [#856](https://github.com/dmdorman/hero6e-foundryvtt/issues/856)
- Actors with existing manual attacks, skills, powers, etc will show warnings during migration and when the actor sheet is opened. You can either delete the offending manual items, or (better yet) re-upload from HDC. We realize that there are missing features in the current system, however we believe you can create equivalent HDC powers to represent any need for a manually created attack. For example KNOCKBACK (missing feature) can be simulated with a HAND ATTACK with NO STR and NO END modifiers. Please reach out on Discord or GitHub if you are unable to create an attack to get around any missing features. [#856](https://github.com/dmdorman/hero6e-foundryvtt/issues/856)
- Initial support for WELL_CONNECTED perk enhancer.
- Removed unnecessary dice showing with **Dice So Nice!** during attack rolls for stun multiplier, hit location, and hit location side. [#793](https://github.com/dmdorman/hero6e-foundryvtt/issues/793)
- **Hit location** and **hit location side** dice roll results can now been seen in the dice roll tooltip.
- Can now aim for a location and side (e.g. left arm) when hit location and individual body part damage tracking are enabled.
- Killing attack STUN should now be correct when using hit locations. [#824](https://github.com/dmdorman/hero6e-foundryvtt/issues/824)
- Improve penetrating BODY and STUN calculations for killing attacks and adjustments. [#851](https://github.com/dmdorman/hero6e-foundryvtt/issues/851)
- Support for Heroic Action Points. Enable in settings. Shown on actor sheet left sidebar. [#844](https://github.com/dmdorman/hero6e-foundryvtt/issues/844)
- We have a [YouTube channel](https://www.youtube.com/channel/UCcmq0WFFNZNhRSGwuEHOgRg) with an introductory how to video.

## Version 3.0.63

- Potentially long running activities (HDC upload and migration) now sport a progress bar.
- Removed range penalties for LINE OF SIGHT, NO RANGE MODIFIER, and LIMITED NORMAL RANGE (NORMAL RANGE). [#789](https://github.com/dmdorman/hero6e-foundryvtt/issues/789)

## Version 3.0.62

- Add all 5e/6e maneuvers and optional maneuvers to actors. Optional maneuvers will only show on actor sheet when "optional maneuvers" configuration option selected. Maneuvers still, however, may not work correctly.
- Improved COMPOUNDPOWER to support characteristics & skills. [#711](https://github.com/dmdorman/hero6e-foundryvtt/issues/711)
- PS/KS/SS descriptions, rolls, and costs improved.

## Version 3.0.61

- Power & Skill descriptions are now readonly as they are not intended to be edited. Descriptions are automatically generated using the Power/Skill properties. [#801](https://github.com/dmdorman/hero6e-foundryvtt/issues/801)
- Actor shows systemVersion at time of HDC upload on actor sheet. [#800](https://github.com/dmdorman/hero6e-foundryvtt/issues/800)
- Fixed issue where legacy actors with missing item details prevented actor sheet from opening.
- Perception can now be rolled again from the skills tab. [#806](https://github.com/dmdorman/hero6e-foundryvtt/issues/806)

## Version 3.0.60

- Fixes for TELEKINESIS (TK punch/strike).
- Effective STR specified as part of the attack is no longer ignored.  Allows for attacks at less than full power, thus conserving END.
- Fixes for ENDURANCERESERVE. [#783](https://github.com/dmdorman/hero6e-foundryvtt/issues/783)
- 5e now shows proper lift capacities for STR values under 5. [#709](https://github.com/dmdorman/hero6e-foundryvtt/issues/709)
- Skill levels now apply when rolling skills. Skill rolls can now auto succeed or fail.
- A number of perks/talents/disadvantages/complications should now be rollable and can be dragged to the macro bar too. [#646](https://github.com/dmdorman/hero6e-foundryvtt/issues/646)
- AOE no longer needs to be associated with an attack power. [#779](https://github.com/dmdorman/hero6e-foundryvtt/issues/779)
- Fixed Penalty Skill Levels with attacks.
- Fixed resistant ED when purchased as a power.

## Version 3.0.59

- Positive adjustment powers now behave better when consumed prior to fading or being manually removed.
- Healing should now work as expected from 1 source. It can no longer increase above the core value. Nor can adjustment powers with only restores to starting value. [#649](https://github.com/dmdorman/hero6e-foundryvtt/issues/649)
- Implement basic automatic absorption.
- Fix combat tracker where changing combatant SPD caused issues. Initiative is now DEX.SPD instead of DEX.INT. [#736](https://github.com/dmdorman/hero6e-foundryvtt/issues/736)
- Adjustment powers now prefer characteristics over powers with the same name. [#747](https://github.com/dmdorman/hero6e-foundryvtt/issues/747)
- Add support for the 1d6-1 damage adder.

## Version 3.0.58

- Clear natural healing status effect when BODY returns to max. [#686](https://github.com/dmdorman/hero6e-foundryvtt/issues/686)
- Improve AOE modifier advantage calculation and descriptions including 5e size calculations.
- Movement powers now account for Reduced/Increased END modifiers. Still issues with movements with multiple movement types. [#599](https://github.com/dmdorman/hero6e-foundryvtt/issues/599)
- Token selected movement is now updated for GM when players make a change via movement radio controls. [#320](https://github.com/dmdorman/hero6e-foundryvtt/issues/320)
- Powers based on EGO combat value now use ECV for 5e. [#653](https://github.com/dmdorman/hero6e-foundryvtt/issues/653)
- STUN only powers will no longer show BODY in the roll information provided in chat.
- Correct costs for all 5e CSL types.

## Version 3.0.57

- Fix CombatTracker bug introduced in 3.0.55 that added extra Lightning Reflexes tokens repeatedly; caused unresponsiveness and/or crashing.

## Version 3.0.56

- Fix inability to apply damage when hit locations enabled. [#678](https://github.com/dmdorman/hero6e-foundryvtt/issues/678)
- RAR and RSR now have always success on 3 and failure on 18.
- Fix for effect fades for unlinked actors and missing item source when actors/items are deleted or re-uploaded via HDC. [#679](https://github.com/dmdorman/hero6e-foundryvtt/issues/679)
- Fix max effect for positive adjustment powers with half dice. [#685](https://github.com/dmdorman/hero6e-foundryvtt/issues/685)
- Correct Knockback Resistance cost for 5e.
- Fix CombatTracker bug introduced in 3.0.55 that incorrectly set tracker to first instance of active token, ignoring segment details.

## Version 3.0.55

- WARNING: Any attack chain (roll to hit -> roll for damage -> apply damage) still in progress may no longer be continuable after migrating to this version.
- Improved clarity of defense tags for HARDENED and IMPENETRABLE. [#604](https://github.com/dmdorman/hero6e-foundryvtt/issues/604)
- Fix for incorrect END use when "Begin Combat" is clicked and actor is using FLIGHT movement.
- Preliminary work on alternate actor sheet herosystem6e.HeroSystemActorSavuoriSheet. [#647](https://github.com/dmdorman/hero6e-foundryvtt/pull/647) [#659](https://github.com/dmdorman/hero6e-foundryvtt/pull/659)
- Dice rolls now have more information about how they're constructed. Click to open the dice equation, as usual, to see more. [#508](https://github.com/dmdorman/hero6e-foundryvtt/issues/508)
- Attack sequence chat messages will see some improvements. For instance, knockback is separated.
- Correct STUN calculation for 6e killing attacks with reduced stun multipliers.
- Correct 1 pip and half die DC calculations for normal attacks larger than 7 DC.
- Correct explosion damage for normal attacks with partial dice and pips.
- Correct BODY calculation for 1/2 die with normal attacks by using a 1d6 rather than 1d3. [#612](https://github.com/dmdorman/hero6e-foundryvtt/issues/612)
- Add auto success (roll of 3) and failure (roll of 18) to characteristic rolls.
- SELECTIVE and NONSELECTIVE area of effect attacks now make multiple attacks. [#628](https://github.com/dmdorman/hero6e-foundryvtt/issues/628) [#654](https://github.com/dmdorman/hero6e-foundryvtt/issues/654)
- Autofire attacks now use endurance for each shot.
- Fixed player combat tracker crash when there are non-visible tokens in the combat tracker. [#650](https://github.com/dmdorman/hero6e-foundryvtt/issues/628) [#654](https://github.com/dmdorman/hero6e-foundryvtt/issues/650)
- Improve stun/body/effect only and 5e explosion attack tags. [#630](https://github.com/dmdorman/hero6e-foundryvtt/issues/630) [#666](https://github.com/dmdorman/hero6e-foundryvtt/issues/666)

## Version 3.0.54

- The character sheet's power tab now has the dice icon for attack powers to initiate attacks.
- Fix for movement powers toggles.
- Compound powers now show proper indices, small description and cost changes for numerous, mostly 5e, powers.
- Mental defense is now correctly calculated for 5e.
- Damage calculations with an additional term (i.e 1/2 die) are no longer short changed for regular damage.
- Add explosions for 5e (without proper drop off calculations).
- Movement power improvements for 5e and added gliding.
- Description improvements for several powers and disadvantage.
- Correct DAMAGERESISTANCE for ED and MD
- Eliminate REDUCEDPENETRATION crash.
- Endurance tracking improvements
  - No free recovery during combat
  - The first character to act in combat won't get dinged for active endurance using powers twice.
  - Correct endurance deduction for characters that have powers active that use endurance without power modifiers.
- Improvements to adjustment powers (although we suggest still only using them for characteristics):
  - Adjustment powers should now respect uploaded multi sources and targets when triggering. They should also respect maximum effects for absorption, aid, and transfer.
  - No adjustment powers should be killing attacks that are enhanced by strength.
  - Correct resistant power defense.
  - Calculated power defense will now be shown on the character sheet.
  - Defensive powers qualifying for the adjustment multiplier now match 5e's smaller list.
  - In 5e, adjustment to DEX and EGO should adjust OCV/DCV and OMCV/DMCV appropriately.

## Version 3.0.53

- Fix crash with Aid and Telekinesis powers during upload. [#474](https://github.com/dmdorman/hero6e-foundryvtt/issues/474)
- Correct general skill roll calculations to be 11 plus levels. [#456](https://github.com/dmdorman/hero6e-foundryvtt/issues/456)
- Improvements to a number of 5e power cost calculations (MP, EC, Forcefield, Teleport, Stretching, Multiform, Aid, Suppress) and INCREASEDMAX adder during upload.
- Characters with incompletely defined adjustment powers will get a warning during upload with a hint on how to fix them.
- Fix HDC uploads when name is missing from HDC file.
- Fix missing display of BACKGROUND an other character information. [#483](https://github.com/dmdorman/hero6e-foundryvtt/issues/483)
- Configuration setting to toggle custom resource bars.  Existing worlds will retain custom resource bars, new worlds will default to core FoundryVTT resource bars.  The [Bar Brawl](https://foundryvtt.com/packages/barbrawl) module is superior, although requires some configuration.  Bugs related to system custom bars still exist.  We are likely to deprecate the custom resource bars in this system. [#502](https://github.com/dmdorman/hero6e-foundryvtt/issues/502) [#368](https://github.com/dmdorman/hero6e-foundryvtt/issues/368) [#274](https://github.com/dmdorman/hero6e-foundryvtt/issues/274) [#174](https://github.com/dmdorman/hero6e-foundryvtt/issues/174)
- Skill characteristics can now be changed in game and will update appropriately. [#511](https://github.com/dmdorman/hero6e-foundryvtt/issues/511)
- Power, skill, etc descriptions should now have the user given names in them. While descriptions are still not perfect they should be better. Let us know if anything particularly terrible remains.
- Lots of behind the scenes work to help improve readability and consistency of the code.

## Version 3.0.52

- Fixed FireFox combat tracker scrolling, slight changes in other browsers as well.
- Improved power cost calculations during upload.
- Improved DC calculations by fixing fractional math.
- Calculate 5e figured characteristics correctly on initial HDC file upload.
- Images should now display on HDC upload even if they already have been previously uploaded.

## Version 3.0.51

- The OTHERS tab now has a summary of the top active point powers. [#343](https://github.com/dmdorman/hero6e-foundryvtt/issues/343)
- Fix for power modifiers being ignored (such as reduce endurance).
- Initial support for BOOSTABLE CHARGES.  Associated burnout is not implemented.  Does not account for reducing the DC increase for powers with advantages. [#432](https://github.com/dmdorman/hero6e-foundryvtt/issues/432)
- Fix for Combat Skill Levels where edit sheet did not allow for changing values.
- Improved range penalty tags and associated tooltips.
- Fixed error for cone placement.
- Fixed range penalty when distance is 2 or fewer hexes. [#437](https://github.com/dmdorman/hero6e-foundryvtt/issues/437)
- Improved ALTERNATE COMBAT VALUE upload. [#439](https://github.com/dmdorman/hero6e-foundryvtt/issues/439)

## Version 3.0.50

- Fix for 6e HDC import where some 5e values were incorrectly being used. [#430](https://github.com/dmdorman/hero6e-foundryvtt/issues/430)

## Version 3.0.49

- Movement only consumes endurance when it is that token's phase.  Allows for improved knockback workflow. [#420](https://github.com/dmdorman/hero6e-foundryvtt/issues/420)
- Improved velocity detection and implementation with Maneuvers. [#425](https://github.com/dmdorman/hero6e-foundryvtt/issues/425)
- 5e Move By maneuver shows knockback details in chat card. [#347](https://github.com/dmdorman/hero6e-foundryvtt/issues/347)
- Fixed 5e maneuvers with velocity components to account for 5e/6e differences.  Migrations of 5e worlds may take longer than normal due to this fix. [#344](https://github.com/dmdorman/hero6e-foundryvtt/issues/344)
- Fix when "Equipment Weight Percentage" is changed in game settings and there are tokens with no associated actor.
- When powers are sent to chat the range of the power is included in the chat message. [#323](https://github.com/dmdorman/hero6e-foundryvtt/issues/323)

## Version 3.0.48

- Fix for 5e where actor sheets failed to open with active statuses.

## Version 3.0.47

- Fix for 5e GROWTH missing toggle and not showing on defense tab.
- Initial support for Knockback Modifiers (Air, Underwater, Killing, Martial) [#365](https://github.com/dmdorman/hero6e-foundryvtt/issues/365) [#386](https://github.com/dmdorman/hero6e-foundryvtt/issues/386) [#346](https://github.com/dmdorman/hero6e-foundryvtt/issues/346)
- Initial support for Knockback Resistance (including Density Increase & Growth). [#423](https://github.com/dmdorman/hero6e-foundryvtt/issues/423)
- Improvement for 5e figured characteristics when purchased as powers. [#422](https://github.com/dmdorman/hero6e-foundryvtt/issues/422)

## Version 3.0.46

- Ability to use EGO for initiative.  Can be changed on OTHER tab.  New HDC imports will assume EGO when OMCV >= OCV and EGO > DEX. [#419](https://github.com/dmdorman/hero6e-foundryvtt/issues/419)
- Improved AID to support attack powers and EXPANDEDEFFECT. [#415](https://github.com/dmdorman/hero6e-foundryvtt/issues/419)
- Fix for 5e ARMOR missing toggle.
- Fix for TRANSPORT_FAMILIARITY costs.
- Improved DENSITYINCREASE power description.
- Fixed 5e DENSITYINCREASE costs.
- Initial support for 5e GROWTH.

## Version 3.0.45

- Fix for Quench Perception Skill tests.
- Ability to retain BODY/STUN/END damage during HDC upload. [#367](https://github.com/dmdorman/hero6e-foundryvtt/issues/402)
- Improved layout of DEFENSES tab.
- Fixed SWIMMING cost per level.
- Fixed costs for characteristics with ADD_MODIFIERS_TO_BASE. [#412](https://github.com/dmdorman/hero6e-foundryvtt/issues/412)
- Added RIDING discount for TRANSPORT_FAMILIARITY. [#397](https://github.com/dmdorman/hero6e-foundryvtt/issues/397)
- Automations are now immune to mental attacks. [#338](https://github.com/dmdorman/hero6e-foundryvtt/issues/338)
- Improved default AID/DRAIN power name.
- Improved POWERDEFENSE description.
- Support for INCREASED STUN MULTIPLIER.
- Fix for Combat Skill Levels that were not working with new HDC uploads.
- Fix for Combat Luck where an extra 3 rPD/rED was added. [#414](https://github.com/dmdorman/hero6e-foundryvtt/issues/414)

## Version 3.0.44

- Fix some NaN issues with Maneuvers and Active Points that was unnecessarily calling migration scripts for most tokens.  Larger worlds may still experience a long migration for 3.0.44, but future migrations should be much quicker.
- Partial support for TELEPATHY. [#402](https://github.com/dmdorman/hero6e-foundryvtt/issues/402)
- Fix to reset movement history at beginning of token phase.  DragRuler module was only resetting movement history between turns. [#401](https://github.com/dmdorman/hero6e-foundryvtt/issues/401)
- Initial support for compound powers.  Currently treated like a multipower. [#407](https://github.com/dmdorman/hero6e-foundryvtt/issues/407)

## Version 3.0.43

- Migrations no longer overwrite Characteristic CURRENT values with MAX when characteristics bought as powers.
- Fix where range penalty was not included in OCV attack rolls.
- Fix to apply range penalty to AOE template placement. [#404](https://github.com/dmdorman/hero6e-foundryvtt/issues/404)
- Fix rPD when PD power bought as RESISTANT and ADD_MODIFIERS_TO_BASE. [#403](https://github.com/dmdorman/hero6e-foundryvtt/issues/403)
- Fixed missing Perception skill. [#400](https://github.com/dmdorman/hero6e-foundryvtt/issues/400)
- Flight/hover uses at least 1 END. [#387](https://github.com/dmdorman/hero6e-foundryvtt/issues/387)
- Density Increase now shows on defense tab. [#378](https://github.com/dmdorman/hero6e-foundryvtt/issues/378)

## Version 3.0.42

- Fix where previous actor migrations were incomplete. [#399](https://github.com/dmdorman/hero6e-foundryvtt/issues/399)
- Full Health now resets charges.
- Fix "Actor Description".
- Improved Mental Defense description.

## Version 3.0.41

- CP details fix for older HDC uploads.

## Version 3.0.40

- Fix for older 5e HDC uploads.
- Fix for CHANGEENVIRONMENT preventing HDC uploads.

## Version 3.0.39

- Fix for DOUBLEAREA preventing migration

## Version 3.0.38

- Fix for multipower HDC upload
- Added CP breakdown tooltip when you hover over CP.
- Fixed OMCV/DMCV cost to be 3.
- Fixed TRANSPORT_FAMILIARITY costs.
- Fixed STRIKING_APPEARANCE (all) cost.
- Fixed FOLLOWER costs.
- Fixed MULTIPOWER costs and slots.
- Fixed minimum advantage cost +1/4.
- Fixed cost for characteristics as a power.
- Fixed LIST preventing HDC upload and improved layout within powers. [#318](https://github.com/dmdorman/hero6e-foundryvtt/issues/318)
- Fix 5e COMBAT_LEVELS costs.
- Fixed some of the 5e meters vs inches descriptions.
- Fixed ActiveEffects for Characteristics, Movement, and Density Increase.

## Version 3.0.37

- Fixed requires a roll.

## Version 3.0.36

- Fixed characteristic roll.
- Fixed requires a roll.

## Version 3.0.35

- Overhauled internal data structures.  This is an important step toward improved editing.  The previous editing is likely broken.
- Fix for 5e HDC uploads and incorrect characteristics. [#382](https://github.com/dmdorman/hero6e-foundryvtt/issues/382) [#381](https://github.com/dmdorman/hero6e-foundryvtt/issues/381)
- Encumbrance percentage [#388](https://github.com/dmdorman/hero6e-foundryvtt/issues/388)

## Version 3.0.34

- Initial support for HOLDING BREATH.  Disallows recovery.  No check ensure 1 END is spent per phase. [#364](https://github.com/dmdorman/hero6e-foundryvtt/issues/364) [#310](https://github.com/dmdorman/hero6e-foundryvtt/issues/310) 
- Initial support for UNDERWATER and STANDING IN WATER. If either status -2 DCV.  UNDERWATER also includes -2 DC.  No check for SCUBA or breakfall. [#363](https://github.com/dmdorman/hero6e-foundryvtt/issues/363)
- Fix 5e OCV/DCV HDC upload [#376](https://github.com/dmdorman/hero6e-foundryvtt/issues/376)
- Fix for Characteristic rolls that were not working. [#331](https://github.com/dmdorman/hero6e-foundryvtt/issues/331)
- Fix for incorrect REC base. [#371](https://github.com/dmdorman/hero6e-foundryvtt/issues/371)
- Initial support for GRABBED status. [#370](https://github.com/dmdorman/hero6e-foundryvtt/issues/370)
- Improved ENTANGLE status. 0 DCV. 1/2 OCV.
- Initial support for STUNONLY modifier. [#374](https://github.com/dmdorman/hero6e-foundryvtt/issues/374)
- At the end of the Segment, any non-Persistent (Constant) Powers turn off for stunned actors.
- Talents can now be toggled.  This was specifically implemented for Combat Luck. [#312](https://github.com/dmdorman/hero6e-foundryvtt/issues/312)

## Version 3.0.33

- Target DCV and "hit by" are now hidden from players. GM's will see a white-ish background and blue outline for items hidden from players in chat messages. [#351](https://github.com/dmdorman/hero6e-foundryvtt/issues/351)
- The "Roll Damage" button is now only shown for token owners.
- Improved AOE workflow to use DCV 3 for template placement. [#354](https://github.com/dmdorman/hero6e-foundryvtt/issues/354)
- Hit Locations no longer valid for AOE attacks.
- Initial support for SELECTIVE and NONSELECTIVE. [#322](https://github.com/dmdorman/hero6e-foundryvtt/issues/322)
- You now have to hold down SHIFT to change turn in combat tracker. [#352](https://github.com/dmdorman/hero6e-foundryvtt/issues/352)
- Initial support for PENALTY SKILL LEVELS.  Currently limited to Aim Hit Locations.  Shown as a checkbox during attack. [#349](https://github.com/dmdorman/hero6e-foundryvtt/issues/349)
- Initial support for AUTOMATION and TAKES NO STUN. [#308](https://github.com/dmdorman/hero6e-foundryvtt/issues/308)

## Version 3.0.32

- Initial REDUCEDPENETRATION support.  Rules as written are to split the attack into two separate dice pools, which is awkward with the current system.  A simplified solution is to apply defenses twice to the body damage. [#313](https://github.com/dmdorman/hero6e-foundryvtt/issues/313)
- Initial Actor description.  Sends APPEARANCE and all obvious & inobvious powers to chat log.  A future improvement will include a perception roll for inobvious powers. [#311](https://github.com/dmdorman/hero6e-foundryvtt/issues/311)
- Improved migration script.  Fixes mistakes in some power costs & power descriptions without the need to re-upload HDC.
- Fixed missing 5e AOE sizes. [#356](https://github.com/dmdorman/hero6e-foundryvtt/issues/356) [#353](https://github.com/dmdorman/hero6e-foundryvtt/issues/353)
- Fixed issue where Post-Segment 12 was called pre and post segment 12.[#328](https://github.com/dmdorman/hero6e-foundryvtt/issues/328)

## Version 3.0.31

- Added ability to set END use of manually added attacks.
- Improved USESTANDARDEFFECT support.
- Fixed ARMORPIERCING -1/4.
- Improved TRANSPORT_FAMILIARITY HDC uploads, descriptions & costs.
- Improved ENTANGLE HDC uploads, descriptions & costs.

## Version 3.0.30

- Fixed issue where attacks failed to apply damage.

## Version 3.0.29

- Reworked Characteristics internal data structure.  Consolidating 6e/5e base, core, costs, bought as powers, etc into one data structure.  Improved hover descriptions.  You can now make changes to CORE characteristics, which will update BASE and COST.  Core, base, and cost are mostly for reference and have no effective gameplay function; although MAX should equal CORE  when all powers/effects are turned off.  This is a small step toward improving actor editing within FoundryVTT.
- Fixed incorrect values for some 5e movements during HDC upload. [#299](https://github.com/dmdorman/hero6e-foundryvtt/issues/299)

## Version 3.0.28

- Fix for AID/DRAIN failing to upload when no name specified.
- Fix for AID/DRAIN fade.

## Version 3.0.27

- A work in progress proof of concept for improved editing of powers.  Open item, click on Sheet in header, then select Herosystem6eItem2Sheet to preview.
- Improved actor migration to update power modifiers. [#287](https://github.com/dmdorman/hero6e-foundryvtt/issues/287)
- Added [FEATURES.md](FEATURES.md) file that lists all the skills, perks, talents, powers, modifiers and complications.  Each is given a support rating.
- Improved Aid/Drain descriptions and fixed issue where targets were not passed to apply damage. [#289](https://github.com/dmdorman/hero6e-foundryvtt/issues/289)

## Version 3.0.26

- Testing workflow to publish to FoundryVTT.

## Version 3.0.25

- Support for Use Standard Effect.  Requires uploading of HDC again. [#281](https://github.com/dmdorman/hero6e-foundryvtt/issues/281)
- Fixed AOE "Apply Damage to ALL" where full damage was applied to all tokens instead of damage based on distance.
- Movement during combat now costs END (1 END per 10m). [#239](https://github.com/dmdorman/hero6e-foundryvtt/issues/239)
- RoundFavorPlayerUp on DCV to ensure whole number. [#210](https://github.com/dmdorman/hero6e-foundryvtt/issues/210)
- Reduced Endurance (half) now has minimum cost of 1 END.
- Improved generic migration to update costs, END and descriptions.  This overwrites any manual changes that may have been made.

## Version 3.0.24

- Fix for Firefox where svg files must have width="512" height="512". [#278](https://github.com/dmdorman/hero6e-foundryvtt/discussions/278)

## Version 3.0.23

- Improved AOE EXPLOSION support. Damage is now based on distance from template. [#151](https://github.com/dmdorman/hero6e-foundryvtt/issues/151)
- Area Effect Cone is now 60º and narrow cone 30º support [#276](https://github.com/dmdorman/hero6e-foundryvtt/issues/276)
- Initial FLASH support [#184](https://github.com/dmdorman/hero6e-foundryvtt/issues/184)

## Version 3.0.22

- Fix missing Macro compendium and supporting code for "Full Heal All Owned Tokens in Scene"

## Version 3.0.21

- Macro compendium and supporting code for "Full Heal All Owned Tokens in Scene"

## Version 3.0.20

- Improved AOE template targeting.
- Initial AOE EXPLOSION support.  Sorts by range to center of template and shows distance to center.  Damage falloff not implemented yet.  [#151](https://github.com/dmdorman/hero6e-foundryvtt/issues/151)
- Non PCs are marked as defeated when they drop below -10 STUN.  Once defeated they no longer get post segment 12 recoveries.
- Improved handling of Mental attacks OMCV/DMCV, DMCV buffs and Mental Combat Skill Levels. [#272](https://github.com/dmdorman/hero6e-foundryvtt/issues/272)
- Fixed inability to manually create new active effects. [#271](https://github.com/dmdorman/hero6e-foundryvtt/issues/271)
- Improved attack cards to show all attack modifier tags.

## Version 3.0.19

- Framework modifiers now transfer REDUCEDEND to slots [#266](https://github.com/dmdorman/hero6e-foundryvtt/issues/266)
- Improved MULTIPOWER descriptions and slot costs.
- Fixed Skill Box Prompt (- is harder) [#265](https://github.com/dmdorman/hero6e-foundryvtt/issues/265)
- Fixed edge case where Combat tracker starts before segment 12 [#267](https://github.com/dmdorman/hero6e-foundryvtt/issues/267)
- Added FULL HEALTH button to actor sheet. [#264](https://github.com/dmdorman/hero6e-foundryvtt/issues/264)
- Clicking on a locked characteristic will prompt to unlock [#261](https://github.com/dmdorman/hero6e-foundryvtt/issues/261)
- Improved AOE workflow. Attacker is prompted to place an AOE template, which automatically selects visible targets within the template.  AOE attacks assume template always hits hex and that all targets are hit regardless of their DCV.

## Version 3.0.18

- Fix for new attacks that only worked with alpha flag turned on.

## Version 3.0.17

- Improved CSL detection of small/large group by selecting the first 3 attacks for small group, and all attacks on the attack tab for large group.  You can edit CSL's after upload to override auto selection of relevant attacks.
- Martial +1 HTH Damage Class(es) was incorrectly created as an attack and shown in attack tab. [#258](https://github.com/dmdorman/hero6e-foundryvtt/issues/258)
- Fixed missing martial "+1 Ranged Damage Class(es)" upload.
- Templates automatically select tokens within the template.  Intend to improve AOE attack workflow.
- Initial AVAD support. [#206](https://github.com/dmdorman/hero6e-foundryvtt/issues/206)
- Fixed everyman skills showing NaN [#259](https://github.com/dmdorman/hero6e-foundryvtt/issues/259)
- Backend changes to Item Attack dialog.  Values now sync with other windows/players.

## Version 3.0.16

- Migration unnecessary on new/empty worlds [#254](https://github.com/dmdorman/hero6e-foundryvtt/issues/254)
- Initial support for vehicles, bases, computers, automatons, and ai's. [#109](https://github.com/dmdorman/hero6e-foundryvtt/issues/109)
- Fixed issue with some talents failing to upload, that would prevent other powers from uploading.  Improved warn/error messages during upload to assist with similar issues in the future.
- Improved defense summary tooltips/mouseovers.

## Version 3.0.15

- Fixes for Requires A Roll.  Attacks spend END when RAR fails.  Hotbar macros no longer RAR when powers toggle off. [#244](https://github.com/dmdorman/hero6e-foundryvtt/issues/244)
- Initial Abort support.  Aborted status icon.  When Stunned, Knocked Out, or Aborted you can not act (make rolls or toggle powers on).
- Initial Block support.  Minimal automation here.  The GM/Player should speak up before the attacker rolls.  Multiple blocks are possible, but you have to remove the abort condition before making a second block at -2.  In the future it may be possible to prompt the defender if they want to block, and handle multiple blocks.  Block assume no STR/END use.  Any potential Initiative benefits to dodge are not automated.
- Initial Dodge support. [#105](https://github.com/dmdorman/hero6e-foundryvtt/issues/105)
- Fixed Martial Arts uploads where OCV and DCV modifiers were ignored.
- Improved Blind and Prone statuses to include appropriate CV penalties. 
- Fixed 1/2 DCV rounding down.  Now follows standard rounding rules that favor the player. [#153](https://github.com/dmdorman/hero6e-foundryvtt/issues/153)
- Initial AUTOFIRE support.  Some automation for single targets.  No automation for multiple targets as the workflow of tohit/damage would be awkward unless fully automated.  Full automation limits  the ability for GM's to handle unusual situations. [#43](https://github.com/dmdorman/hero6e-foundryvtt/issues/43)
- Initial support for Skill Levels.  Player is prompted to confirm Skill Level applies to rolled skill.  Skill rolls now show tag details. [#89](https://github.com/dmdorman/hero6e-foundryvtt/issues/89)
- Fixed issue where some active effects using icons not associated with statuses caused error when loading world.
- Initial Encumbrance penalty support. [#118](https://github.com/dmdorman/hero6e-foundryvtt/issues/118)
- Fixed issue where END was spent twice a phase for actors with Lightning Reflexes.  Now it only spends END on the beginning of the non LR phase for that actor.
- Improved scrolling numbers for STUN and BODY changes.  They now show when you Take a recovery.  Also show for all players, not jus the GM.
- Improved Skill and Power descriptions. [#248](https://github.com/dmdorman/hero6e-foundryvtt/issues/248)
- Improved Skill Enhancer calculations [#249](https://github.com/dmdorman/hero6e-foundryvtt/issues/249)
- Fixed rare and minor issue where velocity wasn't calculated when there is no token for an actor. [#250](https://github.com/dmdorman/hero6e-foundryvtt/issues/250)
- Fixed 0d6 + 1 rolls.  [#252](https://github.com/dmdorman/hero6e-foundryvtt/issues/252)

## Version 3.0.14

- Fixed issue where some 5e powers were incorrectly calculating END.
- Support for Activation Rolls (similar to Requires a Roll)
- Initial support for conditional Defenses (Only Works Against & Conditional Power). GM will be prompted to select conditional defense when applying damage.  [#181](https://github.com/dmdorman/hero6e-foundryvtt/issues/181)
- Improved Endurance/Stun (all) and Body (PCs only) recovery out of combat.  NPCs stop stun recovery once they are below -10 stun. PC stun recovery below -10 is still every phase, but should be using the Recovery Time Table (future improvement). Expected to use Simple Calendar to advance time out of combat.
- Active Effects split out into Temporary, Constant, or Persistent. Where Constant and Persistent largely match the HERO power description; and are typically always on (such as most defenses).  Temporary is for effects with a limited duration (such as AID).  In a future release constant powers will toggle off when knocked out.  May require HDC upload on existing actors for proper assignment. [#235](https://github.com/dmdorman/hero6e-foundryvtt/issues/235)
- Defenses show as effects in other tab. Internally they are not Active Effects, but behave similarly.  A quality of life enhancement which shows all powers & effects in one spot.
- Combat Skill Levels (CSL) can be changed within the _Roll to Hit_ dialog. [#189](https://github.com/dmdorman/hero6e-foundryvtt/issues/189)
- Initial support for DCV buffs/penalties associated with some attacks, that last until actors next phase. [#103](https://github.com/dmdorman/hero6e-foundryvtt/issues/103)
- STUN and BODY changes for tokens show as scrolling combat text.  Stun is green and Body is red, matching the attribute bar colors. [#81](https://github.com/dmdorman/hero6e-foundryvtt/issues/81)

## Version 3.0.13

- Fixed Maneuver OCV/DCV.
- Velocity estimate uses full move.
- Fixed import error.

## Version 3.0.12

- Active Powers consume END at beginning of phase. May require HDC upload or toggle powers to work on existing actors. [#77](https://github.com/dmdorman/hero6e-foundryvtt/issues/77)
- Range Penalty applies when targeting tokens. Fixed Set/Brace. 5e range penalties are now based on 1".  [#100](https://github.com/dmdorman/hero6e-foundryvtt/issues/100)
- Fixed Biography editing. [#233](https://github.com/dmdorman/hero6e-foundryvtt/issues/233)
- END and STUN recover when time advances (with Simple Calendar) [#228](https://github.com/dmdorman/hero6e-foundryvtt/issues/228)
- Charges reset each day [#227](https://github.com/dmdorman/hero6e-foundryvtt/issues/227)
- Maneuvers that are attack-ish now have roll icons instead of checkboxes.  [#102](https://github.com/dmdorman/hero6e-foundryvtt/issues/102)
- Haymaker support. [#98](https://github.com/dmdorman/hero6e-foundryvtt/issues/98)
- Initial MOVE BY and MOVE THROUGH support.  Velocity assumes token is at rest at beginning and end of phase.  Velocity can be overwritten. [#193](https://github.com/dmdorman/hero6e-foundryvtt/issues/193)
- Initial support for 'Only Costs END to Activate'. 
- AID fix for END.

## Version 3.0.11

- Drag Ruler units now match grid units of the scene. [#225](https://github.com/dmdorman/hero6e-foundryvtt/issues/225)
- Initial TRANSFER (5e) support. [#133](https://github.com/dmdorman/hero6e-foundryvtt/issues/133)
- POWER DEFENSE works vs DRAIN/TRANSFER.
- DELAYED RETURN RATE works vs AID/DRAIN/TRANSFER.
- Initial REQUIRES A ROLL support.  [#53](https://github.com/dmdorman/hero6e-foundryvtt/issues/53) [#49](https://github.com/dmdorman/hero6e-foundryvtt/issues/49)
- Initial ENDURANCE RESERVE support. [#54](https://github.com/dmdorman/hero6e-foundryvtt/issues/54)

## Version 3.0.10

- Temporary changes to CHARACTERISTIC MAX have red/green backgrounds on character sheet, similar to how VALUE background turns red/green.
- Combat tracker now advances time.  Confirmed compatibility with Simple Calendar when GameWorldTimeIntegrations=Mixed. [#213](https://github.com/dmdorman/hero6e-foundryvtt/issues/213)
- Improved AID and DRAIN support. [#185](https://github.com/dmdorman/hero6e-foundryvtt/issues/185)

## Version 3.0.9

- Initial support for Charges [#191](https://github.com/dmdorman/hero6e-foundryvtt/issues/191) [#47](https://github.com/dmdorman/hero6e-foundryvtt/issues/47)
- Fixed adding skills with NaN- rolls. [#195](https://github.com/dmdorman/hero6e-foundryvtt/issues/195)
- Partial Find Weakness (5e) support.  Shows as a skill roll.  [#208](https://github.com/dmdorman/hero6e-foundryvtt/issues/208)
- Stunned tokens are prevented from attacking.  Stunned effect is removed and end of phase instead of start of phase. [#204](https://github.com/dmdorman/hero6e-foundryvtt/issues/204)
- Fixed "undefined id [] does not exist in the EmbeddedCollection collection" [#185](https://github.com/dmdorman/hero6e-foundryvtt/issues/185) [#211](https://github.com/dmdorman/hero6e-foundryvtt/issues/211)
- Fixed dragging Attack powers to hotbar [#200](https://github.com/dmdorman/hero6e-foundryvtt/issues/200)
- Fixed Post-Segment 12 errors. [#217](https://github.com/dmdorman/hero6e-foundryvtt/issues/217)
- STUN and BODY changes show in chat when manually changed. [#209](https://github.com/dmdorman/hero6e-foundryvtt/issues/209)
- Combat Tracker header shows Segment number [#198](https://github.com/dmdorman/hero6e-foundryvtt/issues/198)
- Macro Compendium with a Create Attack from JSON macro [#201](https://github.com/dmdorman/hero6e-foundryvtt/issues/201)

## Version 3.0.8

- Take a Recovery now also removes the Stunned condition.
- When characteristics are locked (due to Active Effects) they are now readonly and a tooltip shows what is preventing editing.
- PD/ED bought as power with resistant modifier and ADD_MODIFIERS_TO_BASE is checked is now supported. [#182](https://github.com/dmdorman/hero6e-foundryvtt/issues/182)
- Improved Invisibility power description. [#183](https://github.com/dmdorman/hero6e-foundryvtt/issues/183)
- Fixed Knockback calculations [#188](https://github.com/dmdorman/hero6e-foundryvtt/issues/188)
- Fixed Martial Killing attack uploads. [#187](https://github.com/dmdorman/hero6e-foundryvtt/issues/187)
- Damage tags show Damage Classes (DC) [#139](https://github.com/dmdorman/hero6e-foundryvtt/issues/139) [#119](https://github.com/dmdorman/hero6e-foundryvtt/issues/119)

## Version 3.0.7

- Initial Mental Combat Skill Levels (MCSL) support. [#166](https://github.com/dmdorman/hero6e-foundryvtt/issues/166)
- Fixed issue with large worlds failing to load.
- Minor bug fixes for attacks created with "add attack" instead of via HDC upload.
- Knocked Out when 0 STUN.

## Version 3.0.6

- Fixed issue when deleting combatant in Combat Tracker before combatant begins.
- At Post-Segment-12 all active combatants Take a Recovery.
- Stun status is cleared at the beginning of phase.
- Initial Combat Skill Levels (CSL) support.  OCV is added to attacks.  Simple +1DC. DCV (like all DCV modifiers) is shown but not currently implemented. [#166](https://github.com/dmdorman/hero6e-foundryvtt/issues/166)

## Version 3.0.5

- Initial DRAIN support.
- Changing PC/NPC actor type moved to sheet header.  Also can be changed in the context menu of the actor sidebar. Fixes [#170](https://github.com/dmdorman/hero6e-foundryvtt/issues/170).
- Combat Tracker Improvements. Reworked underlying code so that _onEndRound and _onStartTurn are called as expected.  This should lead to future automation improvements.  For example Post-Segment-12 activities and Endurance use at the beginning of turn for continuous powers. Also changed tooltips for PREV/NEXT to align with Hero terminology. [#175](https://github.com/dmdorman/hero6e-foundryvtt/issues/175)
- Minor improvements to framework support.
- Fixed issue where Reduced Endurance was not included in END calculations. [#132](https://github.com/dmdorman/hero6e-foundryvtt/issues/132)

## Version 3.0.4

- Reworked Active Effects such that the effects on items remain with items.  They are no longer
transferred from the item to the actor.  This is following [FoundryVtt v11 ActiveEffect Transferral](https://foundryvtt.com/article/v11-active-effects/) recommendations.
- Fixed Custom martial attacks, they now show on attack tab.  Also fixed the Set & Brace martial manuevers.
- Fixed a bug where an attack using charges would set END=0.
- Fixed a bug where some auto created attacks were missing half die.
- Initial AID support.  Adjustment powers do not automatically fade yet.  One step closer to DRAIN/TRANSFER [#133](https://github.com/dmdorman/hero6e-foundryvtt/issues/133)

## Version 3.0.3

- FoundryVTT 304 verified compatibility.
- Fixed combat tracker reference to LEVELS.value. [#167](https://github.com/dmdorman/hero6e-foundryvtt/issues/167)

## Version 3.0.1-alpha

- Mental Blast Improvements [#157](https://github.com/dmdorman/hero6e-foundryvtt/issues/157)
- System version added to Actor and Item sheets [#158](https://github.com/dmdorman/hero6e-foundryvtt/issues/158)
- Fixed glitchy power toggles [#162](https://github.com/dmdorman/hero6e-foundryvtt/issues/162)
- Fixed PD/ED bought as resistant, showing as non-resistant. [#163](https://github.com/dmdorman/hero6e-foundryvtt/issues/163)

## Version 3.0.0-alpha

- FoundryVTT version 11 (v10 no longer supported)
- Knockback fixes
- Attack OcvMod [#137](https://github.com/dmdorman/hero6e-foundryvtt/issues/137)
- Attack powers are used directly.  No longer need to have separate attack items.
- All attack powers are shown in Attack tab, even those not fully implemented.  A small step toward implementing additional attack types and charges.
aracter sheet can filter on some items. [#90](https://github.com/dmdorman/hero6e-foundryvtt/issues/90)

## Version 2.2.0-alpha

- Defensive powers are used directly.  No longer need to have separate defense items splitting out PD/ED/etc.
- Reworked ActiveEffects to be placed on items (per FoundryVtt design).
- Apply damage only shown to GMs [#95](https://github.com/dmdorman/hero6e-foundryvtt/issues/95)
- Power/item descriptions can be sent to chat [#128](https://github.com/dmdorman/hero6e-foundryvtt/issues/128)
- Initial power framework support.
- Improved 5e support (COM, DAMAGERESISTANCE, FORCEFIELD).
- All movements collapsed to characteritics tab.  Movement powers are now toggles [#88](https://github.com/dmdorman/hero6e-foundryvtt/issues/128).
- Most powers can be toggled [#38](https://github.com/dmdorman/hero6e-foundryvtt/issues/38).  The remaining powers that do not have toggles (but should) are not fully implemented in the system.  As support for those powers is added, so will the toggle.
- Fixed issue where killing attacks were not applying hit location multipliers. [#136](https://github.com/dmdorman/hero6e-foundryvtt/issues/136)

## Version 2.1.9-alpha

- Fixed equipment price showing NaN.  Summary weight/price for equipment now only shows when there are items with weight/price.
- Fixed [Drag Ruler](https://foundryvtt.com/packages/drag-ruler) module errors when Drag Ruler not installed.  Drag Ruler is recommended, but not required.
- Active Effects on actors are editable. A minor step toward enhancing Active Effects and associated temporary bonuses and penalties. [#126](https://github.com/dmdorman/hero6e-foundryvtt/issues/126) [#118](https://github.com/dmdorman/hero6e-foundryvtt/issues/118) [#103](https://github.com/dmdorman/hero6e-foundryvtt/issues/103)

## Version 2.1.8-alpha

- Improved power descriptions. [#78](https://github.com/dmdorman/hero6e-foundryvtt/issues/78)
- Improved Estimation of Character Points spent and Active Points. [#111](https://github.com/dmdorman/hero6e-foundryvtt/issues/111)
- Powers now show endurance. [#116](https://github.com/dmdorman/hero6e-foundryvtt/issues/116)
- Removed old HeroSystem6eActorSheet
- Improved support for [Drag Ruler](https://foundryvtt.com/packages/drag-ruler) module. Can select movement modes.[#99](https://github.com/dmdorman/hero6e-foundryvtt/issues/99)
- Body/Stun/End on character sheet sidebar are now editable.
- Equipment price and weight. Deferring encumbrance penalties for a future release. [#118](https://github.com/dmdorman/hero6e-foundryvtt/issues/118)

## Version 2.1.7-alpha

- Improved custom maneuver support. [#91](https://github.com/dmdorman/hero6e-foundryvtt/issues/91)
- Estimation of Character Points spent and Active Points.  Still pretty rough. [#111](https://github.com/dmdorman/hero6e-foundryvtt/issues/111)
- Improved power descriptions. [#78](https://github.com/dmdorman/hero6e-foundryvtt/issues/78)
- Fix for Attacks missing AP/PEN edit boxes. [#113](https://github.com/dmdorman/hero6e-foundryvtt/issues/113)
- Attacks and Defenses created from equipment. [#114](https://github.com/dmdorman/hero6e-foundryvtt/issues/114)
- Improved 5e support:
  - Added Comeliness (COM) characteristic.  
  - Fixed OCV/DCV/STUN figured characteristics. [#104](https://github.com/dmdorman/hero6e-foundryvtt/issues/104) 
  - Fixed characteristic costs. 
  - Lack of Weakness as a defense (no automation). [#106](https://github.com/dmdorman/hero6e-foundryvtt/issues/106)
  - Added support for the Armor (Resistant Protection) and Growth powers. [#108](https://github.com/dmdorman/hero6e-foundryvtt/issues/108)

## Version 2.1.6-alpha

- Added 3rd attribute bar. Expectation is to show body, stun, and endurance for most tokens.  [#75](https://github.com/dmdorman/hero6e-foundryvtt/issues/75)
- New default character sheet.
- Added Perception as a skill [#97](https://github.com/dmdorman/hero6e-foundryvtt/issues/97)
- Skill rolls dynamically change with characteristic changes.
- Improved damage dice and END estimation listed on sheet to account for strength. [#83](https://github.com/dmdorman/hero6e-foundryvtt/issues/83)
- Fixed mislabeled rED and added MD defense summary to left panel of character sheet [#86](https://github.com/dmdorman/hero6e-foundryvtt/issues/86)
- Removed flight from characteristics. [#87](https://github.com/dmdorman/hero6e-foundryvtt/issues/87)
- STR shows lift and throw notes [#51](https://github.com/dmdorman/hero6e-foundryvtt/issues/51)
- Attack edit sheet relaced "Value" with "Damage Dice" [#94](https://github.com/dmdorman/hero6e-foundryvtt/issues/94)
- Changed "Default Attack Card Automation" from "No Automation" to "PCs and NPCs (end, stun, body)"
- "Take a recovery" chat card now shows End/Stun details on chat card. [#96](https://github.com/dmdorman/hero6e-foundryvtt/issues/96)
- "Combat Luck" added to defenses. [#85](https://github.com/dmdorman/hero6e-foundryvtt/issues/85)
- Attacks with Alternate Combat Values are auto created property. [#93](https://github.com/dmdorman/hero6e-foundryvtt/issues/93)
- Attacks will use selected targets, show hit/miss, and hit targets will follow thru to damage cards. [#79](https://github.com/dmdorman/hero6e-foundryvtt/issues/79) [#92](https://github.com/dmdorman/hero6e-foundryvtt/issues/92)

## Version 2.1.5-alpha

- 5th edition characters get figured characteristics and 5E stun multiplier on killing attacks.
- A second (improved) character sheet is available to preview.
- DragDrop to hotbar for attacks, skills and power toggles (like defenses)

## Version 2.1.4-alpha

- NOKB, DOUBLEKB, and KBRESISTANCE
- Penetrating, Armor Piercing, Hardened
- Body and Stun only

## Version2.1.3-alpha

- Adding distinction between PC and NPC actors
- Automation updates (end, body, stun)
- Adding area of effect attribute for attacks

## Version 2.1.2-alpha

- Attack card automation rework

## Version 2.1.1-alpha

- Maneuver fix [#39](https://github.com/dmdorman/hero6e-foundryvtt/issues/39)

## Version 2.1.0-alpha

- power item rework
- Known Issues:
  - Maneuvers items are applying OCV/DCV modifications
  - Defense items toggles are not working
  - Can't edit/delete Power sub items directly from actor sheet
  - Updating and item on an unlinked actor sheet updates the base actor and not the actor in the scene

## Version 2.0.4-alpha

- fixed an issue with the combat tracker not working
- fixed an issue with the Upload .HDC button that caused it to fail
- Upload .HDC now reads in perks, talents, complications, and martial arts
- additional V10 migration

## Version 2.0-alpha

- V10 migration
- changed characteristic keys so that other characteristics can work with Barbrawl
- Known Issues:
  - can't edit power/equipment 'sub-items' from character sheet (to add powers to a character sheet use the item tab
    to create and edit the power there then drag the item onto a character sheet)

## Version 1.1.2

- Bugfixes
  - movement powers were showing the wrong type
  - couldn't update sub item descriptions
  - recovery button didn't produce chat message
  - attack card automation wouldn't work with power sub items
  - attack card automation wouldn't work with attacks that used strength or knockback
  - imitative tracking wasn't working
- Added a dice button for attack roll actions
- Now prioritizing player characters in initiative tracking
- Known Issues
  - clicking 'Apply to Target' with an attack card generated from a power sub item displays a message
      'Error: Item does not exist', this should be safe to ignore
  - can't edit power/equipment 'sub-items' from character sheet (to add powers to a character sheet use the item tab
      to create and edit the power there then drag the item onto a character sheet)
  - rolling initiative produces an error message, this can likely be ignored

## Version 1.1.1

- Bugfixes
  - Split up attack card because players could only make attacks against themselves
  - Attack card messages had wrong sender name

## Version 1.1.0

- Added Characteristics base values to character sheet, Editable only in 'Edit' mode on character sheet
- Added End cost to power/equipment item sheets
- Added a field on attack items for custom additional effects, custom effect text will display the end of attack cards
- Bugfixes
  - characteristic rolls weren't updating after changing max end/body/stun
  - movement value wasn't updating properly in power/equipment sub items
  - couldn't update sub items from character sheet
  - couldn't update actor name
  - reading in vehicles added additional blank characteristic to character sheet
  - automated attacks fail without Hit Locations setting
  - upload .HDC fails when name is not present in .HDC file

## Version 1.0.0

- forked from https://github.com/jared-l-vine/hero6e-foundryvtt
- updated to work with Foundry 9.280
- added option to automatically track endurance
- added hit locations option
- added knockback option
- added powers and equipment items
- added maneuver item
