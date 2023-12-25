# Releases

## Version 3.0.54 (So far...)

- The character sheet's power tab now has the dice icon for attack powers to initiate attacks.
- Damage calculations with an additional term (i.e 1/2 die) are no longer short changed. Resolves [#508](https://github.com/dmdorman/hero6e-foundryvtt/issues/508)
- Add explosions for 5e.

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
- Combat Tracker Improvments. Reworked underlying code so that _onEndRound and _onStartTurn are called as expected.  This should lead to future automation improvments.  For example Post-Segment-12 activities and Endurance use at the beginning of turn for continuous powers. Also changed tooltips for PREV/NEXT to align with Hero terminology. [#175](https://github.com/dmdorman/hero6e-foundryvtt/issues/175)
- Minor improvements to framework support.
- Fixed issue where Reduced Endurance was not included in END calculations. [#132](https://github.com/dmdorman/hero6e-foundryvtt/issues/132)

## Version 3.0.4

- Reworked Active Effects such that the effects on items remain with items.  They are no longered
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
