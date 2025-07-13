# Releases

## Version 4.1.7 So Far... [Hero System 6e (Unofficial) v2](https://github.com/dmdorman/hero6e-foundryvtt)

- Fixed issue where 6e EVERYPHASE and 5e ACTIVATIONROLL were not actually rolling to check if PD/ED defense should apply. [#2425](https://github.com/dmdorman/hero6e-foundryvtt/issues/2425)
- BULKY and IMMOBILE foci now reduce DCV. [#2416](https://github.com/dmdorman/hero6e-foundryvtt/issues/2416)
- 5e FORCEWALL powers with TRANSPARENT will now load. [#2421](https://github.com/dmdorman/hero6e-foundryvtt/issues/2421)

## Version 4.1.6 20250627

- Updated hitlocations labels. [#2403](https://github.com/dmdorman/hero6e-foundryvtt/issues/2403)
- The STUNNED condition now only expires once per segment for actors with Lightning Reflexes. [#2404](https://github.com/dmdorman/hero6e-foundryvtt/issues/2404)
- Generic damage roller now includes HIT LOCATION [#2398](https://github.com/dmdorman/hero6e-foundryvtt/issues/2398)
- Improved V13 support for built in ruler. Movement selection + speed distance colors. [#2374](https://github.com/dmdorman/hero6e-foundryvtt/issues/2374) [#2366](https://github.com/dmdorman/hero6e-foundryvtt/issues/2366)

## Version 4.1.5 20250607

- Correct Density Increase mass and STR with no STR increase limitation. [#2391](https://github.com/dmdorman/hero6e-foundryvtt/issues/2391)
- Minor combat tracker fixes & tweaks [#2377](https://github.com/dmdorman/hero6e-foundryvtt/issues/2377) [#2386](https://github.com/dmdorman/hero6e-foundryvtt/issues/2386) [#2022](https://github.com/dmdorman/hero6e-foundryvtt/issues/2022)
- Fix for complex powers with parent/child modifiers that prevented actor sheet from opening. [#2401](https://github.com/dmdorman/hero6e-foundryvtt/issues/2401)

## Version 4.1.4 20250525

- Initial FoundryVTT V13 support. Note that there are many modules will not work and you may wish to delay updating FoundryVTT until your favorite modules are supported. There are still [known v13 compatibility issues](https://github.com/dmdorman/hero6e-foundryvtt/issues?q=is%3Aissue%20state%3Aopen%20label%3Av13compatibility) but we believe it will be good enough for a game.
- Improved V13 support. [#2316](https://github.com/dmdorman/hero6e-foundryvtt/issues/2316) [#2292](https://github.com/dmdorman/hero6e-foundryvtt/issues/2292) [#2352](https://github.com/dmdorman/hero6e-foundryvtt/issues/2352)
- Heroic characters are no longer forced to use 1 END per 5 STR. All actors will now use whatever the world setting is. [#2335](https://github.com/dmdorman/hero6e-foundryvtt/issues/2335)
- Improved support for [Automated Animations](https://foundryvtt.com/packages/autoanimations) module. [#1090](https://github.com/dmdorman/hero6e-foundryvtt/issues/1090)

## Version 4.1.3 20250523

- We DO NOT RECOMMEND upgrading FoundryVTT to v13 yet as there are [known v13 compatibility issues](https://github.com/dmdorman/hero6e-foundryvtt/issues?q=is%3Aissue%20state%3Aopen%20label%3Av13compatibility).
- Improved V13 support. [#2295](https://github.com/dmdorman/hero6e-foundryvtt/issues/2295) [#2268](https://github.com/dmdorman/hero6e-foundryvtt/issues/2268) [#2311](https://github.com/dmdorman/hero6e-foundryvtt/issues/2311) [#2330](https://github.com/dmdorman/hero6e-foundryvtt/issues/2330)
- Fixed and Improved Combat Tracker sorting. [#2318](https://github.com/dmdorman/hero6e-foundryvtt/issues/2318)
- New setting to default initiative characteristic to DEX, even when EGO > DEX.
- Variable Power Pool improvments. [#2329](https://github.com/dmdorman/hero6e-foundryvtt/issues/2329)
- Fixed errors when importing a Hero Designer Prefab as a compendium. [#2331](https://github.com/dmdorman/hero6e-foundryvtt/issues/2331) [#2330](https://github.com/dmdorman/hero6e-foundryvtt/issues/2330)

## Version 4.1.2 20250516

- Lightning Reflexes Fix [#2306](https://github.com/dmdorman/hero6e-foundryvtt/issues/2306)

## Version 4.1.1 20250516

- Lightning Reflexes Fix [#2306](https://github.com/dmdorman/hero6e-foundryvtt/issues/2306)

## Version 4.1.0 20250511

- WARNING: Finish any combat before upgrading. If you have problems you can end all combats and start them anew.
- Improved V13 support. We DO NOT RECOMMEND upgrading FoundryVTT to v13 yet as there are [known v13 compatibility issues](https://github.com/dmdorman/hero6e-foundryvtt/issues?q=is%3Aissue%20state%3Aopen%20label%3Av13compatibility).
- Fixed Combat Skill Levels where they were not applied during an attack. [#2287](https://github.com/dmdorman/hero6e-foundryvtt/issues/2287)

## Version 4.0.28 20250504

- Fixed combat tracker issue when changing scenes or combats. [#2261](https://github.com/dmdorman/hero6e-foundryvtt/issues/2261), [#2262](https://github.com/dmdorman/hero6e-foundryvtt/issues/2262)

## Version 4.0.27 20250504

- Fixed issue where movement radios may not show on initial world load for players. [#2212](https://github.com/dmdorman/hero6e-foundryvtt/issues/2212)
- Fixed issue where characteristic rolls may not show after initial actor upload. [#2224](https://github.com/dmdorman/hero6e-foundryvtt/issues/2224)
- Improved Combat Skill Level support. [#2232](https://github.com/dmdorman/hero6e-foundryvtt/issues/2232)
- Characteristic Maxima support [#2214](https://github.com/dmdorman/hero6e-foundryvtt/issues/2214)
- Improved support for older HDC file formats [#2228](https://github.com/dmdorman/hero6e-foundryvtt/issues/2228)

## Version 4.0.26 20250420

WARNING: Read the changelog for this version before deciding to update.

- Finish any combat before upgrading. You will not be able to replay combat sequences from earlier chat cards. Active effects may not finish correctly - if you need to do so manually you can find them in the Other tab. If you have problems you can end all combats and start them anew.
- Powers and strength can now be pushed, using superheroic rules, or reduced in the to-hit dialog.
- Support Naked Advantages for attack powers in the to-hit dialog.
- Support advantage transfer to strength for Hand-to-Hand Attacks.
- These above 3 changes have introduced at least the following known problems (a no prize for those who find more):
  - Entangles with additional BODY dice will incorrectly have the additional BODY dice doubled. [#2174](https://github.com/dmdorman/hero6e-foundryvtt/issues/2174)
  - Darkness radius will be incorrect. It can be changed from the template once placed. [#2184](https://github.com/dmdorman/hero6e-foundryvtt/issues/2184)
- Fix charge usage for items using autofire.
- Add Special Hit Locations when hit locations are enabled.
- Non heroic characters can how use 1 END per 5 STR per configuration option. Heroic is always 1 END per 5 STR.
- Adjustment power fixes and enhancements. [#2177](https://github.com/dmdorman/hero6e-foundryvtt/issues/2177) [#2178](https://github.com/dmdorman/hero6e-foundryvtt/issues/2178) [#2164](https://github.com/dmdorman/hero6e-foundryvtt/issues/2164) [#2111](https://github.com/dmdorman/hero6e-foundryvtt/issues/2111) [#2110](https://github.com/dmdorman/hero6e-foundryvtt/issues/2110) [#2101](https://github.com/dmdorman/hero6e-foundryvtt/issues/2101)

## Version 4.0.25 20250329

- Fixed maps failing to load when older maps used older "dead" status [#2099](https://github.com/dmdorman/hero6e-foundryvtt/issues/2099)
- Initial support for SURFACE templates [#2055](https://github.com/dmdorman/hero6e-foundryvtt/issues/2055)
- Improved MIND CONTROL support. Chat cards show EGO+X success messages. Still no support for modifiers. [#1726](https://github.com/dmdorman/hero6e-foundryvtt/issues/1726)

## Version 4.0.24 20250323

- Fix issues where Combat Tracker would occasionally infinitely add/delete combatants, requiring a browser reload. [#2022](https://github.com/dmdorman/hero6e-foundryvtt/issues/2022) [#2018](https://github.com/dmdorman/hero6e-foundryvtt/issues/2018)
- Fixed missing Combat Tracker context menu.
- Statuses can now be toggled off from combat tracker.
- Defeated tokens now have a red tint on their image, are slightly transparent, do not show any effects (except for skull overlay) and are sent to the back of the token order. STUNNED and KNOCKEDOUT tokens have yellow tint to make them more obvious. [#2033](https://github.com/dmdorman/hero6e-foundryvtt/issues/2033)
- Fix for 5e actors uploading as PRONE [#2050](https://github.com/dmdorman/hero6e-foundryvtt/issues/2050)
- Movement powers now upload as active unless they have CHARGES or are in a MULTIPOWER. [#2026](https://github.com/dmdorman/hero6e-foundryvtt/issues/2026)
- Added Support for FLASH with multiple target group adders and associated defenses. [#2025](https://github.com/dmdorman/hero6e-foundryvtt/issues/2025)
- Resolved issue where an actor had purchased POWERDEFENSE twice and the DRAIN reduced both powers. Now a DRAIN only affects the largest AP power. [#2075](https://github.com/dmdorman/hero6e-foundryvtt/issues/2075) [#2074](https://github.com/dmdorman/hero6e-foundryvtt/issues/2074)
- Cannot have the same maneuver status affecting OCV/DCV multiple times.

## Version 4.0.23 20250315

- Fixed VULNERABILITY's incorrectly applying (or applying several times) to some AOE attacks. [#1813](https://github.com/dmdorman/hero6e-foundryvtt/issues/1813) [#1857](https://github.com/dmdorman/hero6e-foundryvtt/issues/1857)
- Fix negative OCV and OMCV modifiers on AoE to-hit dialog. [#2020](https://github.com/dmdorman/hero6e-foundryvtt/issues/2020)

## Version 4.0.22 20250308

- Some campaigns were experiencing lag related to vision, so we moved all custom vision code to a new "Hero Vision" mode. Existing and new tokens will now have standard FoundryVTT vision. You can manually set each token to use "Hero Vision" for improved support of enhanced visions. [#2012](https://github.com/dmdorman/hero6e-foundryvtt/issues/2012)

## Version 4.0.21 20250308

- Full/Casual STR can now apply damage. Useful for breaking out of an ENTANGLE. [#1724](https://github.com/dmdorman/hero6e-foundryvtt/issues/1724)
- Improved ability to target Entangles.
- INVISIBILITY defaults to off when it costs END or has CHARGES.
- Equipment that uses END or CHARGES now defaults to off (not active).
- Fix crashes related to NND powers and maneuvers. [#1955](https://github.com/dmdorman/hero6e-foundryvtt/issues/1955)
- Correct STRMINIMUM calculations when velocity is not involved. [#1959](https://github.com/dmdorman/hero6e-foundryvtt/issues/1959)
- Haymaker status removed when applying damage. [#1948](https://github.com/dmdorman/hero6e-foundryvtt/issues/1948)
- NONCOMBAT status applies OCV=0 [#1946](https://github.com/dmdorman/hero6e-foundryvtt/issues/1946)
- Improved effects panel to show power description. [#1943](https://github.com/dmdorman/hero6e-foundryvtt/issues/1943)
- AOE Attacks that target an entangled actor will target (and possibly damage) both the ENTANGLE and the actor. If ENTANGLE is destroyed the actor does not take the remaining damage (a future enhancement).
- Improved/fixed display of temporary, constant, persistent, and inherent effects/powers in the OTHERS tab of the actor sheet. [#1940](https://github.com/dmdorman/hero6e-foundryvtt/issues/1940)
- Improved Social and physiological complication rolls. [#1729](https://github.com/dmdorman/hero6e-foundryvtt/issues/1729)
- Improved Stunned, KnockedOut, and Dead statuses. NPCs now show as dead/defeated at -11 STUN. Automaton's show as dead at 0 BODY. [#1891](https://github.com/dmdorman/hero6e-foundryvtt/issues/1891) [#605](https://github.com/dmdorman/hero6e-foundryvtt/issues/605) [#171](https://github.com/dmdorman/hero6e-foundryvtt/issues/171)
- Simplified velocity calculations to ensure there are no negative velocity values with combat maneuvers. Velocity support is still minimalistic and largely untracked. [#1925](https://github.com/dmdorman/hero6e-foundryvtt/issues/1925)
- AUTOMATONs no longer take STUN from KnockBack damage. [#1926](https://github.com/dmdorman/hero6e-foundryvtt/issues/1926)
- Added setting that enables the game master to "Show BODY & STUN changes to token owners as a private chat" for all, PCs only, or none. [#1965](https://github.com/dmdorman/hero6e-foundryvtt/issues/1965)
- Fixed EXTRATIME cost and display [#1920](https://github.com/dmdorman/hero6e-foundryvtt/issues/1920)
- Improved error handling for older/unsupported tokens. Uploading the HDC file again fixes these errors.
- Custom Adders now includes cost on description.
- The Active Points of a power/skill is no longer shown in the description when Active Points = Character Points.
- MULTIPOWER, COMPOUNDPOWER, ELEMENTAL CONTROL and LIST are not powers and should not have range in their description. [#1837](https://github.com/dmdorman/hero6e-foundryvtt/issues/1837)
- Equipment that is not carried no longer shows on "Attack" tab of character sheet. [#1996](https://github.com/dmdorman/hero6e-foundryvtt/issues/1996)
- PRONE status is now applied when ASLEEP, DEAD, KNOCKED OUT, or UNCONSCIOUS is applied. [#1991
  ](https://github.com/dmdorman/hero6e-foundryvtt/issues/1991)
- When recovering from being KNOCKED OUT, END will now equal STUN. [#1989](https://github.com/dmdorman/hero6e-foundryvtt/issues/1989)
- Added alternate identities, campaign name, genre, player name, and gm to the actor OTHER tab. [#1986](https://github.com/dmdorman/hero6e-foundryvtt/issues/1986)
- The world's killing attacks' STUN multiplier can be customized using the "Custom Killing Attack Multiplier" configuration menu. Leaving all fields at 0 will use the default for your system. [#1972](https://github.com/dmdorman/hero6e-foundryvtt/issues/1972)
- Psychological Complications and Social Complications roll results now have a description of the consequences. [#1729](https://github.com/dmdorman/hero6e-foundryvtt/issues/1729)
- Damage with deadly blow now calculated correctly. [#1901](https://github.com/dmdorman/hero6e-foundryvtt/issues/1901)

## Version 4.0.20 20250217

- Fixed loading failures and other issues related to compound powers within a multipower. [#1915](https://github.com/dmdorman/hero6e-foundryvtt/issues/1915)

## Version 4.0.19 20250216

- AoE placement button shows shape again. [#1909](https://github.com/dmdorman/hero6e-foundryvtt/issues/1909)

## Version 4.0.18 20250216

- The "Add 3rd bar and labels" configuration option is no longer available. Please use [Bar Brawl](https://foundryvtt.com/packages/barbrawl) if you want to show STUN, BODY, and/or END bars.
- Powers that cost no END and do not use charges now default to active during HDC upload.
- Correct deadly blow contribution to damage. [#1901](https://github.com/dmdorman/hero6e-foundryvtt/issues/1901)
- Fixed a bug where new token images were unable to be uploaded. Token image uploads from HDC file to FORGE also should work now.

## Version 4.0.17 20250214

- Fixed an issue where the effects panel could make it difficult to interact with tokens on the far right side of the canvas map. [#1875](https://github.com/dmdorman/hero6e-foundryvtt/issues/1875)
- Effects panel now shows duration in hours, minutes and seconds. [#1872](https://github.com/dmdorman/hero6e-foundryvtt/issues/1872)
- Continuing charges now expire properly. [#1876](https://github.com/dmdorman/hero6e-foundryvtt/issues/1876) [#1823](https://github.com/dmdorman/hero6e-foundryvtt/issues/1823)
- The PRONE condition is now applied (if appropriate) when damage is applied. Previously you had to roll the knock down damage before the token was made PRONE. [#1878](https://github.com/dmdorman/hero6e-foundryvtt/issues/1823)
- The damage card can be popped out into a modal window to more easily step thru applying damage to multiple targets. [#1877](https://github.com/dmdorman/hero6e-foundryvtt/issues/1877)
- You can now change a POWER to a piece of EQUIPMENT and vice versa. Edit the item and there is a button at the bottom. [#1852](https://github.com/dmdorman/hero6e-foundryvtt/issues/1852)
- GM can hold ALT to force move tokens. This was added because the override key features provided, are sometimes insufficient to move defeated tokens thru walls or off the main map area. [#1846](https://github.com/dmdorman/hero6e-foundryvtt/issues/1846)
- Fixed issue with DC calculations for that were not supposed to add to DCs. For example reduced END cost should not add to the DC of a power.

## Version 4.0.16 20250208

- Improved default selection of conditional mental defenses/vulnerabilities. [#1782](https://github.com/dmdorman/hero6e-foundryvtt/issues/1695)
- Fix issue where some ActiveEffects (AID/DRAIN/etc) were not expiring. [#1737](https://github.com/dmdorman/hero6e-foundryvtt/issues/1737)
- Support for 5e PD/ED purchased as characteristics along with RESISTANT DEFENSES is not supported. Instead use ARMOR. We do not allow RESISTANT DEFENSES to exceed your natural PD/ED. A warning is shown every time the actor sheet is opened. [#1795](https://github.com/dmdorman/hero6e-foundryvtt/issues/1795)
- Fixed martial flash effect application.
- Generic "Roll Damage" button can now apply PD & ED damage to tokens. [#1614](https://github.com/dmdorman/hero6e-foundryvtt/issues/1614)
- Add "Other Attacks" maneuver to 5e. [#1814](https://github.com/dmdorman/hero6e-foundryvtt/issues/1814)
- Correct 5e explosion radius and DC falloff. [#1811](https://github.com/dmdorman/hero6e-foundryvtt/issues/1811)
- Zero BODY entangles have no effect.
- Two entangles now result in highest BODY entangle +1. [#1825](https://github.com/dmdorman/hero6e-foundryvtt/issues/1825)
- Called shot to the chest now, correctly, has a -3 OCV.
- Continuing charges no longer use charges per phase. [#1823](https://github.com/dmdorman/hero6e-foundryvtt/issues/1823)
- Fixed issue where the final fade of AID/DRAIN wasn't adjusting VALUE properly. [#1854](https://github.com/dmdorman/hero6e-foundryvtt/issues/1854)
- Overhauled and simplified the code that determines costs, modifies, adders, etc. Several cost corrections. Slightly improved UI when you edit an item.

## Version 4.0.15 20250125

- PD and ED from AID is now applying to defenses. [#1695](https://github.com/dmdorman/hero6e-foundryvtt/issues/1695)
- Fixed Penalty Skill Levels for range. [#1734](https://github.com/dmdorman/hero6e-foundryvtt/issues/1734)
- AoE with Hit Locations no longer crashes, however all targets incorrectly have same hit location. [#1767](https://github.com/dmdorman/hero6e-foundryvtt/issues/1767)
- Improved default FoundryVTT appendNumber. Adding single tokens to a scene that appends a number to the token now ensure duplicate token names are not created. Does not change the default FoundryVTT behavior for adding multiple tokens during a paste operation.
- Combat maneuvers which don't use STR now use 1 END.
- Automatons now have perception and maneuvers again. [#1756](https://github.com/dmdorman/hero6e-foundryvtt/issues/1756)

## Version 4.0.14 20250119

- Migrations will take longer than normal.
- Hand-to-Hand Attacks have changed and are no longer attacks on their own. Per the rules, hand-to-hand attacks only increases the STR used for attacks that deal normal damage. To use your hand-to-hand attack powers and equipment, select them from the to-hit dialog of the strength based attack (such as Strike) you wish to use it with.
- Fix where 5e AOE NAKEDMODIFIER powers failed to upload. [#1704](https://github.com/dmdorman/hero6e-foundryvtt/issues/1704)
- Improvements to HDC uploads. Actor sheet now shows "Upload in progress", preventing you from clicking around until the upload is complete. Actor owners are notified of upload in a chat message.
- Improved damage and DC calculations. [#717](https://github.com/dmdorman/hero6e-foundryvtt/issues/717) [#763](https://github.com/dmdorman/hero6e-foundryvtt/issues/763) [#1182](https://github.com/dmdorman/hero6e-foundryvtt/issues/1182) [#1632](https://github.com/dmdorman/hero6e-foundryvtt/issues/1632)
- Fix crash on loading items with strength minimum and provide better handling for older HDC files. [#1628](https://github.com/dmdorman/hero6e-foundryvtt/issues/1628)
- Added dodging effect icon. Dodge effect now activates automatically when activating any maneuver with the dodge effect.
- Fixed HDC uploads of type BASE.
- Actor sheet display improvements (Seperators, Lists, Martial Arts, filters) [#1723] (https://github.com/dmdorman/hero6e-foundryvtt/issues/1723)
- Improve CSL autoselection of attacks. [#1727](https://github.com/dmdorman/hero6e-foundryvtt/issues/1727)
- Combat Maneuvers & Martial Arts are only supported on PCs & NPCs, not AUTOMATONs or any other actor type. Changing actor types may confuse Combat Maneuvers & Martial Arts, you will need to re-upload the HDC file after changing actor type.

## Version 4.0.13 20250111

- Enhanced Senses improvements:
  - SIGHTGROUP visions now respect the BLIND status. [#1590](https://github.com/dmdorman/hero6e-foundryvtt/issues/1590)
  - Fixed issue with some enhanced visions not showing map in the dark.
- Adjustment powers now work with POWERDEFENSE.
- Inobivous powers no longer show for Actor Description.
- Fixed the chat card name of Adjustment powers that targeted POWERs. Was showing attack item, not target power. [#1608](https://github.com/dmdorman/hero6e-foundryvtt/issues/1608)
- Fixed formatting issues with prosemirror editor caused by us overriding some css that we shouldn't have. [#1629](https://github.com/dmdorman/hero6e-foundryvtt/issues/1629)
- Knocked out targets no longer get double adjustment effect. [#1255](https://github.com/dmdorman/hero6e-foundryvtt/issues/1255)
- Explosions now correctly deal different damage to each token based on distance when using the "Apply Damage to ALL" button. [#1323](https://github.com/dmdorman/hero6e-foundryvtt/issues/1323)
- Fixed issue where some adders (like EVERYPHASE) were ignored when there were multiple modifiers. [#1634](https://github.com/dmdorman/hero6e-foundryvtt/issues/1634)
- Fixes several adjustment issues. There are a few issues left. Absorption & transfer are not working. [#1633](https://github.com/dmdorman/hero6e-foundryvtt/issues/1633) [#1600](https://github.com/dmdorman/hero6e-foundryvtt/issues/1600) [#615](https://github.com/dmdorman/hero6e-foundryvtt/issues/615) [#521](https://github.com/dmdorman/hero6e-foundryvtt/issues/521) [#1643](https://github.com/dmdorman/hero6e-foundryvtt/issues/1643) [#1610](https://github.com/dmdorman/hero6e-foundryvtt/issues/1610) [#1587](https://github.com/dmdorman/hero6e-foundryvtt/issues/1587) [#1495](https://github.com/dmdorman/hero6e-foundryvtt/issues/1495) [#1328](https://github.com/dmdorman/hero6e-foundryvtt/issues/1328) [#1325](https://github.com/dmdorman/hero6e-foundryvtt/issues/1325) [#1310](https://github.com/dmdorman/hero6e-foundryvtt/issues/1310) [#1302](https://github.com/dmdorman/hero6e-foundryvtt/issues/1302) [#576](https://github.com/dmdorman/hero6e-foundryvtt/issues/576) [#1655](https://github.com/dmdorman/hero6e-foundryvtt/issues/1655) [#1611](https://github.com/dmdorman/hero6e-foundryvtt/issues/1611) [#1609](https://github.com/dmdorman/hero6e-foundryvtt/issues/1609) [#1609](https://github.com/dmdorman/hero6e-foundryvtt/issues/1609)

## Version 4.0.12 [Hero System 6e (Unofficial) v2](https://github.com/dmdorman/hero6e-foundryvtt)

- Fix for SPD purchased as a power not contributing to final values during upload. [#1439](https://github.com/dmdorman/hero6e-foundryvtt/issues/1439)
- Fix for combat tracker where sometimes it would skip combatants when new combatants were added/removed. [#1447](https://github.com/dmdorman/hero6e-foundryvtt/issues/1447)
- Attacks can override resource usage by using the override key on the "Roll to Hit" button.
- Enhanced Senses improvements:
  - More enhanced senses can see the map. Mostly DETECT + SENSE + RANGE + (TARGETING or SIGHT/TOUCH/SMELL groups).
  - When blind you can detect tokens. (Assumed use of non-targeting senses)
  - You can see the fringe of adjacent INVISIBLE creatures.
- Experimental feature to "only show combatants you can see in the combat tracker" can be enabled in settings. [#1556](https://github.com/dmdorman/hero6e-foundryvtt/issues/1556)
- Fixed TRANSFORM as it was preventing uploads in some cases. [#1574](https://github.com/dmdorman/hero6e-foundryvtt/issues/1574)
- Improved HDC upload to address multiple encumbrance active effects. [#1575](https://github.com/dmdorman/hero6e-foundryvtt/issues/1575)
- END and other resources are only spent during combat. When not in combat, those resources now have a strikethrough indicating they were not really spent. [#1549](https://github.com/dmdorman/hero6e-foundryvtt/issues/1549)
- REQUIRES A ROLL (RAR) now automatically fails when that skill is not owned. You can still use override key. [#1576](https://github.com/dmdorman/hero6e-foundryvtt/issues/1576)
- Taking multiple recoveries before your next phase no longer stacks DCV penalties. [#1545](https://github.com/dmdorman/hero6e-foundryvtt/issues/1545)
- The extra KB from SHRINKING is only for distance not damage. [#1544](https://github.com/dmdorman/hero6e-foundryvtt/issues/1545)
- A first pass at creating generic dice roll buttons. A ROLL TO HIT and a ROLL DAMAGE that are not associated with any actor/token. These can be enabled in settings and will show up under the chat box. [#1579](https://github.com/dmdorman/hero6e-foundryvtt/issues/1579)

## Version 4.0.11 [Hero System 6e (Unofficial) v2](https://github.com/dmdorman/hero6e-foundryvtt)

- Correct 5e Elemental Control cost. [#1416](https://github.com/dmdorman/hero6e-foundryvtt/issues/1416)
- Removed automation for Non-Combat effect as it isn't working properly. [#1560](https://github.com/dmdorman/hero6e-foundryvtt/issues/1560)
- Fixed Non-combat running-person svg file that was crashing firefox. [#1554](https://github.com/dmdorman/hero6e-foundryvtt/issues/1554)

## Version 4.0.10

- Fix migration SETANDBRACE warning.

## Version 4.0.9

- Fixed missing cost for NIGHTVISION and other enhanced visions. [#1520](https://github.com/dmdorman/hero6e-foundryvtt/issues/1520)
- DARKNESS now has an implied AOE for targeting purposes. [#1503](https://github.com/dmdorman/hero6e-foundryvtt/issues/1503)
- NOTES are now 1 line by default to match actual formatting as much as possible with space. Click and hold on the note to display one in full. [#1492](https://github.com/dmdorman/hero6e-foundryvtt/issues/1492)
- Improved Enhanced Senses. SIGHTGROUP shows map & tokens. Other sense groups show just tokens (purple outlines; no map). We will continue to improve enhanced senses, a little bit at a time. [#1433](https://github.com/dmdorman/hero6e-foundryvtt/issues/1433)
- Improved carried light support by leveraging the [Active Token Effects](https://foundryvtt.com/packages/ATL) module. You can create a CUSTOMPOWER with "light" in the name. Works best if it is a piece of equipment. Change QUANTITY to adjust range of light. Must be able to toggle power, and I'm aware this is still a bit clunky.
- Fixed permission errors when other players upload HDC files. [#1494](https://github.com/dmdorman/hero6e-foundryvtt/issues/1494)
- Improved description for FOCI. [#1521](https://github.com/dmdorman/hero6e-foundryvtt/issues/1521)
- Main conditional defenses vary (PD/ED), but KB conditional defenses are always PD. [#1518](https://github.com/dmdorman/hero6e-foundryvtt/issues/1518)
- Uploading HDC prompts to retain BODY, END, and CHARGES. HAP and HeroicIdentity are always retained after upload. [#1505](https://github.com/dmdorman/hero6e-foundryvtt/issues/1505)
- Improved MULTIPOWER all slots limitation propagation. [#1504](https://github.com/dmdorman/hero6e-foundryvtt/issues/1504)
- Sending items to chat are now private chat messages. You can right click those private chat messages to reveal them to everyone.
- Movement exceeding full move no longer costs END. Movement with charges, now consumes charges. Chat cards are shown to token owners detailing movement resources used. Added NONCOMBATMOVEMENT status. [#1482](https://github.com/dmdorman/hero6e-foundryvtt/issues/1482)
- Fixed NaN roll for ACCIDENTALCHANGE with an ALWAYS CHANCETOCHANGE. [#1473](https://github.com/dmdorman/hero6e-foundryvtt/issues/1473)
- SET and BRACE work again. HAYMAKER applies -5 DCV. [#1459](https://github.com/dmdorman/hero6e-foundryvtt/issues/1459)
- SET, BRACE, HAYMAKER, and NONCOMBATMOVEMENT expire (toggle off) at the beginning of actor's phase.
- Fixed 5e GROWTH & SHRINK, you may have to reload HDC file. [#1531](https://github.com/dmdorman/hero6e-foundryvtt/issues/1531)
- Fixed END cost for STR to round down in players favor. [#1533](https://github.com/dmdorman/hero6e-foundryvtt/issues/1533)
- Fixed rare issue where a characteristic is unblocked and the associated power can no longer be toggled. [#1469](https://github.com/dmdorman/hero6e-foundryvtt/issues/1469)
- TELEKINESIS description now includes throw distance. [#1450](https://github.com/dmdorman/hero6e-foundryvtt/issues/1450)
- Fixed issue with negative RECOVERY during "Take A Recovery". [#1396](https://github.com/dmdorman/hero6e-foundryvtt/issues/1396)
- 5e HARDENED now works against PENETRATING. [#1437](https://github.com/dmdorman/hero6e-foundryvtt/issues/1437)
- Improved token selection when there are 2+ tokens associated with the same actor. [#1397](https://github.com/dmdorman/hero6e-foundryvtt/issues/1397)

## Version 4.0.8

- Support striking appearance. Striking appearance and reputation can be optionally enabled for presence and interaction skill rolls. [#1509](https://github.com/dmdorman/hero6e-foundryvtt/issues/1509)
- Improved DEADLYBLOW so it does not apply to adjustment powers, sense-affecting powers, or ENTANGLES. Also the extra DCs are not shown in the Attacks tab (which was confusing). GM still has to confirm DEADLYBLOW with applicable powers. [#1493](https://github.com/dmdorman/hero6e-foundryvtt/issues/1493)
- Improved workflow when attacking ENTANGLED tokens. [#1500](https://github.com/dmdorman/hero6e-foundryvtt/issues/1500)
- The Attack type is now included in the Attack Tags on the chat card.
- Conditional defenses used in main damage are also used in knockback damage. [#1498](https://github.com/dmdorman/hero6e-foundryvtt/issues/1498)
- Only the GM can click on the button to apply knockback. [#1454](https://github.com/dmdorman/hero6e-foundryvtt/issues/1454)
- Improved VULNERABILITY description. [#1484](https://github.com/dmdorman/hero6e-foundryvtt/issues/1484)

## Version 4.0.7

- Fixed Flash, which now has a unique icon per sense group. [#1486](https://github.com/dmdorman/hero6e-foundryvtt/issues/1486)
- Conditional DAMAGEREDUCTION and DAMAGENEGATION defenses now prompt for applicability. [#1478](https://github.com/dmdorman/hero6e-foundryvtt/issues/1478)
- Initial support for extra damage from vulnerabilities. [#1479](https://github.com/dmdorman/hero6e-foundryvtt/issues/1479)
- Conditional defenses and vulnerabilities will attempt to automatically determine if it applies (uses SFX and Description). GM still has to confirm conditional effects.
- Kluge to ensure valid 5e targets of adjustment powers. For example OCV/DCV are invalid 5e adjustment targets, which are now replaced with DEX. [#1402](https://github.com/dmdorman/hero6e-foundryvtt/issues/1402)
- 5e Calculated characteristics are updated when dependant characteristics are updated.
- Fixed issue where KBRESISTANCE was not working.
- Support the 1/2 endurance version of COSTSEND. [#1497](https://github.com/dmdorman/hero6e-foundryvtt/issues/1497)

## Version 4.0.6

- Migrations are no longer supported from versions before 3.0.76. Migrate through any version prior to 4.0.6 if you find your world in this situation.
- New effect icons for danger sense disabled, detect sense disabled, mental sense disabled, radio sense disabled, smell/taste sense disabled, sonar sense disabled, spatial awareness disabled, touch sense disabled. Abort icon corrected. Most of these status effects are preparatory for future senses/flash features. [#1443](https://github.com/dmdorman/hero6e-foundryvtt/issues/1443)
- Flight toggle now shows/hides the flight effect. [#1444](https://github.com/dmdorman/hero6e-foundryvtt/issues/1444)
- Initial support for Only in Alternate Identity (OIAID). There is a "Heroic Identity" checkbox in the OTHERS tab. [#1431](https://github.com/dmdorman/hero6e-foundryvtt/issues/1431) [#232](https://github.com/dmdorman/hero6e-foundryvtt/issues/232)
- Improved automatic spending of END during combat for continuous powers to prevent spending of resources when rewinding or re-doing a turn. [#1448](https://github.com/dmdorman/hero6e-foundryvtt/issues/1448)
- MAX characteristic is now color coded when different than CORE. [#1461](https://github.com/dmdorman/hero6e-foundryvtt/issues/1461)
- Improved display of COMPOUNDPOWER costs. [#1434](https://github.com/dmdorman/hero6e-foundryvtt/issues/1461)
- FullHealth now also sets characteristic MAX to match CORE.
- Added a dialog box for GM to select target list when confirming AOE placement on behalf of the player. [#1453](https://github.com/dmdorman/hero6e-foundryvtt/issues/1453)
- When GM moves a player template, the player targets will now be updated to match the template.
- Improved consistency between the targeting reticules and the list of targets shown in the attack dialog box for AOE templates.

## Version 4.0.5

- OCV/OMCV bonuses are no longer active effects. They only work for a specific instant attack. [#1285](https://github.com/dmdorman/hero6e-foundryvtt/issues/1285)
- Fixed rare issue where adding some 6e powers to a 5e actor would prevent actor sheet from opening.
- Support for STR Minimum OCV penalty. [#384](https://github.com/dmdorman/hero6e-foundryvtt/issues/384)
- Support for STR 0 rolls including DCV and movement penalties. [#1401](https://github.com/dmdorman/hero6e-foundryvtt/issues/1401)
- Support for PRE 0 rolls. [#1403](https://github.com/dmdorman/hero6e-foundryvtt/issues/1403)
- Fixed issue where FLIGHT was impacting KB rolls even when FLIGHT was turned off. [#1400](https://github.com/dmdorman/hero6e-foundryvtt/issues/1400)
- Fixed issue where full END for an attack was used even when lowering Effective Strength/Levels. [#1399](https://github.com/dmdorman/hero6e-foundryvtt/issues/1399)
- AUTOMATONs can't use STUN in place of END. [#1398](https://github.com/dmdorman/hero6e-foundryvtt/issues/1398)

## Version 4.0.4

- Penalty Skill Levels now default to checked after upload. [#1359](https://github.com/dmdorman/hero6e-foundryvtt/issues/1359)
- Mental attacks vs Entangles without Mental Defense now default to targeting actor, not entangle by default. [#1295](https://github.com/dmdorman/hero6e-foundryvtt/issues/1295)
- Attacking the actor instead of entangle mistakenly showed GM "Apply Damage to Entangle". [#1295](https://github.com/dmdorman/hero6e-foundryvtt/issues/1295)
- When items are moved into or out of a framework, costs are now recalculated. [#1384](https://github.com/dmdorman/hero6e-foundryvtt/issues/1384)
- Strike now appears in the Attacks tab.
- Fix for AOE Line "Confirm AOE placement" error.
- Various HEALING effect fixes. [#1407](https://github.com/dmdorman/hero6e-foundryvtt/issues/1407)
- Implemented SIMPLIFIED healing. [#1256](https://github.com/dmdorman/hero6e-foundryvtt/issues/1407)
- You can now select the override key you want to use. It used to be hard coded to be SHIFT. Changed the default to be ControlLeft because SHIFT movement was snapless and thus awkward. [#1410](https://github.com/dmdorman/hero6e-foundryvtt/issues/1410)
- Fixed missing CSL from AOE to-hit template placement. [#1392](https://github.com/dmdorman/hero6e-foundryvtt/issues/1392)
- Taking a Recovery applies 1/2 DCV penalty for 1 second (until start of next segment). [#1405](https://github.com/dmdorman/hero6e-foundryvtt/issues/1405)

## Version 4.0.3

- Fixed INCREASEDEND cost and BARRIER active point calculation. [#1368](https://github.com/dmdorman/hero6e-foundryvtt/issues/1368)
- Frameworks, lists, and compound powers can be collapsed/expanded. [#1357](https://github.com/dmdorman/hero6e-foundryvtt/issues/1357)
- Initial support for dragging items into and out of frameworks, lists, and compound powers. [#1357](https://github.com/dmdorman/hero6e-foundryvtt/issues/1357)
- Fixed missing price & weight of equipment.
- Added END Reserve to left side panel of actor sheet. [#1370](https://github.com/dmdorman/hero6e-foundryvtt/issues/1370)

## Version 4.0.2

- Strength rolls now use endurance. [#1253](https://github.com/dmdorman/hero6e-foundryvtt/issues/1253)
- Skill rolls and toggle activations can now use STUN for END and END reserves (when in combat). They can also use SHIFT to override resource consumption.
- Encumbrance related improvements, include PSL support. [#1372](https://github.com/dmdorman/hero6e-foundryvtt/issues/1372)
- Improved KNOWLEDGE_SKILL descriptions. [#1278](https://github.com/dmdorman/hero6e-foundryvtt/issues/1278)
- Initial NIGHTVISION, INFRAREDPERCEPTION, ULTRASONICPERCEPTION, and ULTRAVIOLETPERCEPTION support. Also if you create a custom power with the word light in it, you can toggle it on/off like a lantern (QTY = meters of bright vision).
- Fixes for some CONTINUING CHARGES and auto expiration with SIMPLE CALENDAR. Only works with Active Effects (like characteristic aid).
- Fixes for CHARACTERISTICS toggles that were subtracting instead of adding to values. [#1293](https://github.com/dmdorman/hero6e-foundryvtt/issues/1293)
- Various minor improvements for tokens of type BASE in an effort to improve [Token Attacher](https://github.com/KayelGee/token-attacher) support.
- Conditional defenses are now hidden when they provide no defense against a specific attack. There is a new setting to show All Conditional Defenses.
- Reworked how defense tags are shown and how defenses are calculated vs attacks. [#1339](https://github.com/dmdorman/hero6e-foundryvtt/issues/1339)
  - Fix for 5e DAMAGE RESISTANCE and PD/ED purchased as a power, where the PD/ED was counted twice. [#1297](https://github.com/dmdorman/hero6e-foundryvtt/issues/1297)
  - 5e now resists penetrating with hardened defenses.
  - Fix where some defenses were being ignored.
  - COMBAT LUCK now provides hardened and impenetrable resistant defense. [#1336](https://github.com/dmdorman/hero6e-foundryvtt/issues/1336)
  - Defenses that are reduced (like by Armor Piercing) are shown with red strikethrough, along with adjusted values.
- Boostable charges, with a max of 4, will be allowed only if the charges are actually boostable. [#1327](https://github.com/dmdorman/hero6e-foundryvtt/issues/1327)
- Fix for compendium import errors [#1358](https://github.com/dmdorman/hero6e-foundryvtt/issues/1358)
- Fix for adjustment powers. [#1364](https://github.com/dmdorman/hero6e-foundryvtt/issues/1364)

## Version 4.0.1

- Added Penalty Skill Level support for encumbrance. Also fixed some LBS/KG issues. [#1308](https://github.com/dmdorman/hero6e-foundryvtt/issues/1308)
- Equipment now uploads with proper carried state.

## Version 4.0.0

- Dropped support for FoundryV11. You must use FoundryVTT v12 to use this version of Hero System 6e (Unofficial) v2.
- Improved ENHANCEDPERCEPTION. You now get to pick during PERCEPTION ROLL. [#1288](https://github.com/dmdorman/hero6e-foundryvtt/issues/1288)
- Entangles can now be attacked.
- Fixed issue where world time was not advancing during combat.
- Improved FLASH and FLASHDEFENSE. [#794](https://github.com/dmdorman/hero6e-foundryvtt/issues/794) [#438](https://github.com/dmdorman/hero6e-foundryvtt/issues/438) [#303](https://github.com/dmdorman/hero6e-foundryvtt/issues/303) [#458](https://github.com/dmdorman/hero6e-foundryvtt/issues/458) [#670](https://github.com/dmdorman/hero6e-foundryvtt/issues/670)
- Improvements for boostable Charges. [#1292](https://github.com/dmdorman/hero6e-foundryvtt/issues/1292)
- Added missing roll icons on Martial Arts tab. [#1277](https://github.com/dmdorman/hero6e-foundryvtt/issues/1277)
- Initial support for continuing charges.
- Fixes for combat tracker and SPD changes.
- Fix broken stun body damage tags. [#1296](https://github.com/dmdorman/hero6e-foundryvtt/issues/1296)

## Version 3.0.101

- We no longer test/verify with FoundryVTT V11. We encourage you upgrade to FoundryVTT v12.
- Talent/Skill/Perks as powers now toggle. [#1288](https://github.com/dmdorman/hero6e-foundryvtt/issues/1230)
- Improved/fixed Penalty Skill Levels. You can now have more than one PSL for different attacks.
- Slight performance increase when uploading HDC files.

## Version 3.0.100

- Added Effect Panel showing more details about effects on a token.
- Initial support for MULTIPLE ATTACK maneuver.
- Fixed issue with powers sometimes uploading out of order. [#1138](https://github.com/dmdorman/hero6e-foundryvtt/issues/1138)
- You can now drag/drop items within the same actor to change their order.
- Equipment drag/drop between actors is now a move instead of a copy. ChatMessages are whispered to owners of tokens when drag/drop occurs.
- Fixed issues where some powers were not toggleable. [#1248](https://github.com/dmdorman/hero6e-foundryvtt/issues/1138)
- Added setting to prevent player movement when in combat and not their phase. [#1241](https://github.com/dmdorman/hero6e-foundryvtt/issues/1241)
- Entangle improvements [#186](https://github.com/dmdorman/hero6e-foundryvtt/issues/186) [#551](https://github.com/dmdorman/hero6e-foundryvtt/issues/551) [#1230](https://github.com/dmdorman/hero6e-foundryvtt/issues/1230)
- Initial support for applying an entangle to a token, tracking body & defenses. Attacks still cannot target entangles, coming soon.

## Version 3.0.99

- PENALTY_SKILL_LEVELS with all attacks no longer show all attacks in the power description.

## Version 3.0.97 & 3.0.98

- FoundryVTT v12 is supported. The latest Drag Ruler works with v12 although has a few minor bugs. We recommend upgrading to FoundryVTT 12 between your sessions when you do not have an active combat. Support for FoundryVTT v11 will end soon.
- Fix smart CSL selection for HTH and RANGED.
- Fix apply knockback dialog for Firefox.
- Applying knockback now rolls knockback skinned dice.
- Using STUN for END now uses skinned dice. [#1212](https://github.com/dmdorman/hero6e-foundryvtt/issues/1212)
- Make HeroRoller class available for script macros. [#1221](https://github.com/dmdorman/hero6e-foundryvtt/issues/1221)
- When configuring CSL's with all attacks, the attack selections are no longer displayed. [#1226](https://github.com/dmdorman/hero6e-foundryvtt/issues/1226)
- Fixed mental powers displays wrong effect for damage rolls. [#1258](https://github.com/dmdorman/hero6e-foundryvtt/issues/1258)
- Reworked Combat Tracker
  - Existing combats may need to be deleted and started from scratch after upgrading.
  - The background color of combatants changes based on token disposition. Can be changed in settings.
  - END for powers is spent on first phase of token's segment (only important with Lightning Reflexes).
  - Holding status now shows token image on right hand side of combat tracker.
  - Drag Ruler now tracks movement correctly between phases. [#1247](https://github.com/dmdorman/hero6e-foundryvtt/issues/1247)
  - Post segment 12 chat cards only show player recoveries to everyone. Non-player recoveries are whispered to GM.
- Fixed issue with BASES taking a recovery. They do not get one. [#1218](https://github.com/dmdorman/hero6e-foundryvtt/issues/1218)
- You can now hold SHIFT to make attacks even when you get a cannot act message. [#1213](https://github.com/dmdorman/hero6e-foundryvtt/issues/1213)

## Version 3.0.96

- Fixes for combat tracker edge cases.

## Version 3.0.95

- Fixed issue where adding/removing combatants messed up players combat tracker. [#1199](https://github.com/dmdorman/hero6e-foundryvtt/issues/1199)

## Version 3.0.94

- Fix for Combat Tracker

## Version 3.0.93

- Fixed HKA calculation when Double Damage Limit rule is enabled.
- Fix for DRAINs and likely other adjustment powers. [#1188](https://github.com/dmdorman/hero6e-foundryvtt/issues/1188)
- Added CLINGING as a KB modifier.
- Fix: DRAIN has a standard range in 6e.
- Fix: Partial STR dice is now added to damage. [#1193](https://github.com/dmdorman/hero6e-foundryvtt/issues/1193)
- Fixed TRANSFORM to import, allowing for attack & damage rolls and END cost. Defenses & associated effects are not implemented.
- Fix STUN for END calculation especially when starting with negative END. [#1202](https://github.com/dmdorman/hero6e-foundryvtt/issues/1202)
- Fix for errant "bar3" setting that would prevent older worlds from loading after upgrading to FoundryVTT v12. [#1187](https://github.com/dmdorman/hero6e-foundryvtt/issues/1187)
- Added support for movement powers USABLE AS a secondary type of movement. [#1200](https://github.com/dmdorman/hero6e-foundryvtt/issues/1200)
- Initial support for HOLDING AN ACTION. [#1206](https://github.com/dmdorman/hero6e-foundryvtt/issues/1206) [#608](https://github.com/dmdorman/hero6e-foundryvtt/issues/608) [#380](https://github.com/dmdorman/hero6e-foundryvtt/issues/380)
- Fixed DC calculations with advantaged powers to not included reduced endurance advantages. [#1210](https://github.com/dmdorman/hero6e-foundryvtt/issues/1210)
- Knocked Out actors take x2 STUN. [#1205](https://github.com/dmdorman/hero6e-foundryvtt/issues/1205)

## Version 3.0.92

- Fixed FLASH to use the flash defense of the target and not the attacker. [#1174](https://github.com/dmdorman/hero6e-foundryvtt/issues/1174)
- Fixed TELEKINESIS damage. [#1177](https://github.com/dmdorman/hero6e-foundryvtt/issues/1177)
- Simplified CSL description when "All Attacks" are specified. [#1178](https://github.com/dmdorman/hero6e-foundryvtt/issues/1178)
- Improved CSL attack auto selection for "All Attacks". [#1178](https://github.com/dmdorman/hero6e-foundryvtt/issues/1178)
- Attacks with advantages that add STR now reduce dice based on DC rules. [#1180](https://github.com/dmdorman/hero6e-foundryvtt/issues/1180)

## Version 3.0.91

- Fixed issue creating compendiums [#1172](https://github.com/dmdorman/hero6e-foundryvtt/issues/1172)

## Version 3.0.90

- Added NOTES to item descriptions [#1140](https://github.com/dmdorman/hero6e-foundryvtt/issues/1140)
- Initial support for Enhanced Perception [#1157](https://github.com/dmdorman/hero6e-foundryvtt/issues/1157)
- Fixed missing EXTRADC calculations from Martial Maneuvers and 5e killing attack maneuver DCs. [#1080](https://github.com/dmdorman/hero6e-foundryvtt/issues/1080)
- Added system setting to limit total attack DCs to double the base DCs. This defaults to off! [#1080](https://github.com/dmdorman/hero6e-foundryvtt/issues/1080)
- Fixed inconsistencies with OCV/DCV values on Attack tab.
- Fixed ability to edit Mind Scan attack adjustments. [#1161](https://github.com/dmdorman/hero6e-foundryvtt/issues/1161)

## Version 3.0.89

- Improved Analyze skill description. [#1154](https://github.com/dmdorman/hero6e-foundryvtt/issues/1150)
- New Dice Skinning feature: Dice associated with hit locations, stun multipliers, and knockback have a different dice skin. Requires Dice So Nice module. Defaults to off, can be enabled per user.

## Version 3.0.88

- Fix: When 2+ GMs are active, those GMs see errors when adding combatants to combat tracker [#1150](https://github.com/dmdorman/hero6e-foundryvtt/issues/1150)
- Added FULL and CASUAL rolls for base characteristics to CHARACTERISTICS tab.
- Improved Weapon Master [#1151](https://github.com/dmdorman/hero6e-foundryvtt/issues/1151)
- Improved Requires A Roll for Knowledge Skills

## Version 3.0.87

- Reworked ruler code. Movement type & total distance only show for last movement segment.
- DragRuler support for v12. There are still [issues](https://github.com/manuelVo/foundryvtt-drag-ruler/issues/337), so not recommending upgrading to FoundryVTT v12 quite yet.
- Fix: Players see errors when adding combatants to combat tracker [#1148](https://github.com/dmdorman/hero6e-foundryvtt/issues/1148)

## Version 3.0.86

- Improve Foundry v12 support

## Version 3.0.85

- Correct range penalty for non AoE attacks. [#1142](https://github.com/dmdorman/hero6e-foundryvtt/issues/1142)

## Version 3.0.84

- Fix for some 5e actors failing to upload. [#1135](https://github.com/dmdorman/hero6e-foundryvtt/issues/1135)
- Fix for Combat Luck, where if left as "do not add to totals" during HDC upload, toggling it on resulted in no added defense. [#1134](https://github.com/dmdorman/hero6e-foundryvtt/issues/1134)

## Version 3.0.83

- Fix for some default Knowledge Skills missing the "knowledge" details in chat cards. [#1129](https://github.com/dmdorman/hero6e-foundryvtt/issues/1129)

## Version 3.0.82

- Improved HDC upload performance.
- Corrected presence attacks with negative presence. [#838](https://github.com/dmdorman/hero6e-foundryvtt/issues/838)
- Default Knowledge Skills names now include the "knowledge". This means when you roll a KS the knowledge is included in the chat message. [#1129](https://github.com/dmdorman/hero6e-foundryvtt/issues/1129)
- Post-Segment 12 now only performed once per turn during combat. This resolves some issues where combat is rewound or when actors change their speed. [#1113](https://github.com/dmdorman/hero6e-foundryvtt/issues/1113)
- You are now prompted before using stun for endurance. [#1125](https://github.com/dmdorman/hero6e-foundryvtt/issues/1125)
- Fixed costs for Animal Handler. [#1097](https://github.com/dmdorman/hero6e-foundryvtt/issues/1097)
- Powers can now be used at less than full power. [#1128](https://github.com/dmdorman/hero6e-foundryvtt/issues/1128)
- Heroic actors can now be set to use 1 END per 5 STR. This can be changed in the settings menu. The actor's heroic/superheroic status is now visible on the actor sheet just after the name. [#291](https://github.com/dmdorman/hero6e-foundryvtt/issues/291)

## Version 3.0.81

- Fixed bug where conditional defenses prevented some attacks from applying damage. [#1116](https://github.com/dmdorman/hero6e-foundryvtt/issues/1116)
- Improved Drag and Drop support to handle compound powers within a framework. [#1102](https://github.com/dmdorman/hero6e-foundryvtt/issues/1102) [#1100](https://github.com/dmdorman/hero6e-foundryvtt/issues/1100) [#1111](https://github.com/dmdorman/hero6e-foundryvtt/issues/1111)
- Players no longer see token type on actor sheets. [#1096](https://github.com/dmdorman/hero6e-foundryvtt/issues/1096)
- HeroItems and HeroMacros compendiums are now created dynamically for each world. You can drag and drop these compendium items onto an actor sheet or hotbar slot. Note that the Default Edition (5e/6e) setting is used to create the compendiums. [#141](https://github.com/dmdorman/hero6e-foundryvtt/issues/141) [#1101](https://github.com/dmdorman/hero6e-foundryvtt/issues/1101)
- Fixed issue where to hit rolls were private for most attacks. [#1108](https://github.com/dmdorman/hero6e-foundryvtt/issues/1108)

## Version 3.0.80

- Drag and Drop support for compound powers and multi-powers. [#1068](https://github.com/dmdorman/hero6e-foundryvtt/issues/1068)
- You can upload Hero Designer Prefabs (\*.hdp) as compendiums. [#1067](https://github.com/dmdorman/hero6e-foundryvtt/issues/1067) [#142](https://github.com/dmdorman/hero6e-foundryvtt/issues/142)

## Version 3.0.79

- Fixed issue where the roll-to-hit window would open "inappropriately" when selecting targets.
- Fixed Combat Tracker errors when SPD is lowered for combatant. [#1089](https://github.com/dmdorman/hero6e-foundryvtt/issues/1089)
- Mind Scan improvements.
  - Can select token(s) without the need to use T to target, limiting the reveal of unwanted information.
  - Can select token(s) across scenes.
- Video: [Hero System 6e (Unofficial) v2 - Mind Scan - Basic](https://youtu.be/eMoYvJQHVsg)

## Version 3.0.78

- Initial support for Mind Scan. [#1066](https://github.com/dmdorman/hero6e-foundryvtt/issues/1066)
  - Only works when Mind Scan actor & target are in the same scene.
  - If GM targets a visible token on behalf of the player, that token gets a target dot and may reveal unwanted information.
- Perception skill moved to top of skill tab. [#1069](https://github.com/dmdorman/hero6e-foundryvtt/issues/1069)
- Fixed issue where some attacks were charging twice for END. [#1075](https://github.com/dmdorman/hero6e-foundryvtt/issues/1075)
- Correct range penalty calculation for 5e non AoE attacks. [#1077](https://github.com/dmdorman/hero6e-foundryvtt/issues/1077)
- Attacks from compound powers now preface the attack with the compound power name. [#1070](https://github.com/dmdorman/hero6e-foundryvtt/issues/1070)
- Tokenizer images are no longer overwritten. [#1070](https://github.com/dmdorman/hero6e-foundryvtt/issues/1070)
- Improved support for Mental Skill Levels.
- Add success rolls for Psychological Limitation/Complication. [#1082](https://github.com/dmdorman/hero6e-foundryvtt/issues/1082)
- Migrations now rebuild all actor and item data.
- Add attack and defense tags to adjustment chat cards. [#1059](https://github.com/dmdorman/hero6e-foundryvtt/issues/1059)

## Version 3.0.77

- PD/ED characteristics with resistant modifier are now actually resistant. Previously the resistant modifier was ignored. Also PD/ED purchased as characteristics now show in DEFENSES tab for easy reference. [#1063](https://github.com/dmdorman/hero6e-foundryvtt/issues/1063)
- Fix where the CSL selections were duplicated during AOE template placement. [#1064](https://github.com/dmdorman/hero6e-foundryvtt/issues/1064)
- Fix where DCV temporary bonuses from CSLs and other active effects were expiring on our segment instead of on our phase. [#1061](https://github.com/dmdorman/hero6e-foundryvtt/issues/1061)
- ToHit dialog box now shows a list of all targets.
- Fix for combat tracker where adding tokens to combat tracker sometimes resulted in error messages, preventing the token from being added. [#1072](https://github.com/dmdorman/hero6e-foundryvtt/issues/1072)

## Version 3.0.76

- Fix for AID and likely other adjustment powers. [#1058](https://github.com/dmdorman/hero6e-foundryvtt/issues/1058)
- [Video: Aid and Drain - Basic](https://www.youtube.com/watch?v=z3I7SshLlyI)

## Version 3.0.75

- We recommend sticking with FoundryVTT v11. Known v12 issues:
  - [Drag Ruler](https://foundryvtt.com/packages/drag-ruler) module breaks several things.
  - [Bar Brawl](https://foundryvtt.com/packages/barbrawl) mostly works. Oddities changing token images.
- FoundryVTT 12.327 support.
- Reworked Combat Tracker to more closely align to FoundryVTT v12.
- Improved chat messages for power toggles to include GM & token owners.
- Improved initial toggle states during HDC upload. For example, items in a multipower default to off.
- Improved BASE actor type support. PD and ED are now resistant. BODY now shows in characteristics tab. Implied DCV=3 or 0 if adjacent.
- [Barrier proof of concept](https://youtu.be/fINMDsyObK0).
- Fix for compound powers within a list, where not all compound items were uploaded. Also fixed issue where some compound power items were duplicating modifiers. [#964](https://github.com/dmdorman/hero6e-foundryvtt/issues/964)
- You can now make attack rolls from equipment tab.
- Added EXPERIENCE field to the OTHER tab. Be careful as this gets overwritten when you upload an HDC file.

## Version 3.0.74

- We recommend sticking with FoundryVTT v11. The [Drag Ruler](https://foundryvtt.com/packages/drag-ruler) author [is working on v12 support](https://github.com/manuelVo/foundryvtt-drag-ruler/issues/326#issuecomment-2148372052).
- Improvements to AVAD and NND attacks.
- Fixed damage dice for Nerve Strike and similar martial NND attacks. [#885](https://github.com/dmdorman/hero6e-foundryvtt/issues/885)
- Support for multiple Combat Skill Levels associated with an attack.
- Combat Skill Levels purchased as powers can be toggled. [#995](https://github.com/dmdorman/hero6e-foundryvtt/issues/995)
- Support for REQUIRESASKILLROLL and EVERYPHASE for defenses during Apply Damage. [#457](https://github.com/dmdorman/hero6e-foundryvtt/issues/457)
- Improved Penalty Skill Level support. PSLs can have attack(s) specified and penalty type specified. Only the range penalty is currently supported. [#863](https://github.com/dmdorman/hero6e-foundryvtt/issues/863)

## Version 3.0.73

- Fix for PC actor sheets failing to open when actor has frameworks or compound equipment. [#1036](https://github.com/dmdorman/hero6e-foundryvtt/issues/1036)
- The alternate Savuori actor sheet logic now uses the default actor sheet. It still retains the simpler color scheme.

## Version 3.0.72

- FoundryVTT v12 limited support. We recommend sticking with v11 for now as some key modules do not support v12 yet. If you choose to proceed with v12 here is what we have tested:
  - You should disable the [Drag Ruler](https://foundryvtt.com/packages/drag-ruler) module as it currently breaks several things. You can CTRL+CLICK+DRAG a token to measure, then spacebar to move for now (default Foundry). [DR#319](https://github.com/manuelVo/foundryvtt-drag-ruler/issues/319) [DR#324](https://github.com/manuelVo/foundryvtt-drag-ruler/issues/324)
  - [Dice So Nice!](https://gitlab.com/riccisi/foundryvtt-dice-so-nice) seems to work just fine.
  - [Simple Calendar](https://github.com/vigoren/foundryvtt-simple-calendar) seems to work just fine.
  - [About Face](https://foundryvtt.com/packages/about-face) seems to work just fine.
  - [Bar Brawl](https://foundryvtt.com/packages/barbrawl) seems to work well. Had to delete some of the bars on older tokens and recreate them, but it works. We plan to drop the built in 3rd bar support as Bar Brawl is superior.
  - [Elevation Ruler](https://foundryvtt.com/packages/elevationruler) is not currently recommended, but we are looking into Drag Ruler alternatives. It overrides our custom labels that show movement type and range penalties. Dropped tokens don't always center in hex.
  - We have more testing to do, this list is not comprehensive. Feel free to submit [bug/issues](https://github.com/dmdorman/hero6e-foundryvtt/issues) if you find any v12 bugs that we haven't mentioned.
- Improved chat messages during combat for powers that use END each phase. Powers automatically turn off when there is insufficient END. GM gets a message when any power is toggled.
- Fixed combat tracker issues with FoundtyVTT V12 where onStartTurn was only called postSegment12. This was preventing the consumption of END for continuous powers. [#1024](https://github.com/dmdorman/hero6e-foundryvtt/issues/1024)
- Movement radio buttons now display even when [Drag Ruler](https://foundryvtt.com/packages/drag-ruler) is not active. Unselecting a token removes movement radio buttons to avoid confusion.
- Fixed various issues preventing the ability to toggle some powers.
- You can hold down the control key when toggling a power to force success of associated Requires A Roll. Useful for GM's.
- Skills now support CHARGES and COSTEND modifiers. [#908](https://github.com/dmdorman/hero6e-foundryvtt/issues/908)

## Version 3.0.71

- FoundryVTT v12 initial support. We recommend sticking with v11 for now as some key modules do not support v12 yet. If you choose to proceed with v12 there are some known issues:
  - You should disable the [Drag Ruler](https://foundryvtt.com/packages/drag-ruler) module as it currently breaks a few things. [DR#319](https://github.com/manuelVo/foundryvtt-drag-ruler/issues/319) [DR#324](https://github.com/manuelVo/foundryvtt-drag-ruler/issues/324)
  - Combat tracker is not consuming END for constant powers nor resetting movement history (but Drag Ruler is broken anyway).
  - We haven't tested much yet so this list is not comprehensive.
- Improved item drag & drop behavior. Dropped item descriptions are updated on drop, and any parenting associated with frameworks is removed.
- You can now toggle INVISIBILITY, it consumes END while in combat, and triggers the invisibility status condition if invisibility's primary option is SIGHT GROUP. Enhanced senses are not implemented so the GM will have to address invisibility vs enhanced senses.
- Fix Combat Skill Levels attack enumerations. Attacks are now listed by name when provided, and by generic power when no name is provided. [#1004](https://github.com/dmdorman/hero6e-foundryvtt/issues/1004)
- Fixed issue where some compound powers subitems were showing in the wrong actor sheet tab or not showing at all.
- Skill Levels now default to unchecked, with some educated guessing by matching characteristic or Skill Levels options. [#1006](https://github.com/dmdorman/hero6e-foundryvtt/issues/1006)
- Improved CSL selection of attacks for compound powers. [#1007](https://github.com/dmdorman/hero6e-foundryvtt/issues/1007)
- Improved CP and AP on actor sheet header. Equipment is now summarized correctly. AP hover title shows breakout.
- Fix issue where STR shows END use in chat card but not actually consumed. [#1018](https://github.com/dmdorman/hero6e-foundryvtt/issues/1018)
- Initial KNOCKBACK damage support. The knockback text in the chatcard is now a button that automates the damage and associated defenses. [#810](https://github.com/dmdorman/hero6e-foundryvtt/issues/810)
- Add custom AOE templates for 5e radius (v11 and v12) and cone (v12 only) AOE to match hex counted versions. These are enabled by default on all hexagonal scenes and be disabled in the settings. [#997](https://github.com/dmdorman/hero6e-foundryvtt/issues/997)
- Added new setting to specify 6e vs 5e rules for the world in the rare situation where an actor is not initiating the action. Defaults to 6e, which is how it previously was.

## Version 3.0.70

- Reworked AOE templates to support the differences between 5e and 6e as we understand them.
- Under the hood preparation for FoundryVTT V12.

## Version 3.0.69

- Improved AOE template accuracy. [#966](https://github.com/dmdorman/hero6e-foundryvtt/issues/966)
- Removed auto success/miss for standard AOE targets. [#965](https://github.com/dmdorman/hero6e-foundryvtt/issues/965)
- Initial support for STR MINIMUM. STR damage is reduced by STR MINIMUM, but no OCV/DC penalties for low STR. [#971](https://github.com/dmdorman/hero6e-foundryvtt/issues/971) [#127](https://github.com/dmdorman/hero6e-foundryvtt/issues/127)
- Initial support for WEAPON_MASTER talent. [#972](https://github.com/dmdorman/hero6e-foundryvtt/issues/972)
- Initial support for DEADLYBLOW talent. [#972](https://github.com/dmdorman/hero6e-foundryvtt/issues/972)
- Initial support for PERSONALIMMUNITY. [#973](https://github.com/dmdorman/hero6e-foundryvtt/issues/973)
- Reworked Combat Skill Levels. They now use Custom Adders to store attack details. You can use Custom Adder in your HD file to streamline future imports, so you don't have to update your CSLs every time you import. Educated guessing of which attacks apply if you don't provide them in the HD file as custom adders. [#883](https://github.com/dmdorman/hero6e-foundryvtt/issues/883)

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
  - A limited number of adders and modifiers can be added to items. Will add more in future releases.
  - Simplified editing of attacks. Using adders for +1/2 d6 and +1 pip.
  - There is minimal vetting of in-game editing. Any invalid adders/modifiers for a specific power will likely to be ignored and/or may cause automation issues.
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
- You can now add most skills and some powers in game. We're still adding the rest of the powers, perks, etc. Only a few items (blast for example) are functionally editable at the moment. One small step toward Hero Designer lite.

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
- Effective STR specified as part of the attack is no longer ignored. Allows for attacks at less than full power, thus conserving END.
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
- Configuration setting to toggle custom resource bars. Existing worlds will retain custom resource bars, new worlds will default to core FoundryVTT resource bars. The [Bar Brawl](https://foundryvtt.com/packages/barbrawl) module is superior, although requires some configuration. Bugs related to system custom bars still exist. We are likely to deprecate the custom resource bars in this system. [#502](https://github.com/dmdorman/hero6e-foundryvtt/issues/502) [#368](https://github.com/dmdorman/hero6e-foundryvtt/issues/368) [#274](https://github.com/dmdorman/hero6e-foundryvtt/issues/274) [#174](https://github.com/dmdorman/hero6e-foundryvtt/issues/174)
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
- Initial support for BOOSTABLE CHARGES. Associated burnout is not implemented. Does not account for reducing the DC increase for powers with advantages. [#432](https://github.com/dmdorman/hero6e-foundryvtt/issues/432)
- Fix for Combat Skill Levels where edit sheet did not allow for changing values.
- Improved range penalty tags and associated tooltips.
- Fixed error for cone placement.
- Fixed range penalty when distance is 2 or fewer hexes. [#437](https://github.com/dmdorman/hero6e-foundryvtt/issues/437)
- Improved ALTERNATE COMBAT VALUE upload. [#439](https://github.com/dmdorman/hero6e-foundryvtt/issues/439)

## Version 3.0.50

- Fix for 6e HDC import where some 5e values were incorrectly being used. [#430](https://github.com/dmdorman/hero6e-foundryvtt/issues/430)

## Version 3.0.49

- Movement only consumes endurance when it is that token's phase. Allows for improved knockback workflow. [#420](https://github.com/dmdorman/hero6e-foundryvtt/issues/420)
- Improved velocity detection and implementation with Maneuvers. [#425](https://github.com/dmdorman/hero6e-foundryvtt/issues/425)
- 5e Move By maneuver shows knockback details in chat card. [#347](https://github.com/dmdorman/hero6e-foundryvtt/issues/347)
- Fixed 5e maneuvers with velocity components to account for 5e/6e differences. Migrations of 5e worlds may take longer than normal due to this fix. [#344](https://github.com/dmdorman/hero6e-foundryvtt/issues/344)
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

- Ability to use EGO for initiative. Can be changed on OTHER tab. New HDC imports will assume EGO when OMCV >= OCV and EGO > DEX. [#419](https://github.com/dmdorman/hero6e-foundryvtt/issues/419)
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

- Fix some NaN issues with Maneuvers and Active Points that was unnecessarily calling migration scripts for most tokens. Larger worlds may still experience a long migration for 3.0.44, but future migrations should be much quicker.
- Partial support for TELEPATHY. [#402](https://github.com/dmdorman/hero6e-foundryvtt/issues/402)
- Fix to reset movement history at beginning of token phase. DragRuler module was only resetting movement history between turns. [#401](https://github.com/dmdorman/hero6e-foundryvtt/issues/401)
- Initial support for compound powers. Currently treated like a multipower. [#407](https://github.com/dmdorman/hero6e-foundryvtt/issues/407)

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

- Overhauled internal data structures. This is an important step toward improved editing. The previous editing is likely broken.
- Fix for 5e HDC uploads and incorrect characteristics. [#382](https://github.com/dmdorman/hero6e-foundryvtt/issues/382) [#381](https://github.com/dmdorman/hero6e-foundryvtt/issues/381)
- Encumbrance percentage [#388](https://github.com/dmdorman/hero6e-foundryvtt/issues/388)

## Version 3.0.34

- Initial support for HOLDING BREATH. Disallows recovery. No check ensure 1 END is spent per phase. [#364](https://github.com/dmdorman/hero6e-foundryvtt/issues/364) [#310](https://github.com/dmdorman/hero6e-foundryvtt/issues/310)
- Initial support for UNDERWATER and STANDING IN WATER. If either status -2 DCV. UNDERWATER also includes -2 DC. No check for SCUBA or breakfall. [#363](https://github.com/dmdorman/hero6e-foundryvtt/issues/363)
- Fix 5e OCV/DCV HDC upload [#376](https://github.com/dmdorman/hero6e-foundryvtt/issues/376)
- Fix for Characteristic rolls that were not working. [#331](https://github.com/dmdorman/hero6e-foundryvtt/issues/331)
- Fix for incorrect REC base. [#371](https://github.com/dmdorman/hero6e-foundryvtt/issues/371)
- Initial support for GRABBED status. [#370](https://github.com/dmdorman/hero6e-foundryvtt/issues/370)
- Improved ENTANGLE status. 0 DCV. 1/2 OCV.
- Initial support for STUNONLY modifier. [#374](https://github.com/dmdorman/hero6e-foundryvtt/issues/374)
- At the end of the Segment, any non-Persistent (Constant) Powers turn off for stunned actors.
- Talents can now be toggled. This was specifically implemented for Combat Luck. [#312](https://github.com/dmdorman/hero6e-foundryvtt/issues/312)

## Version 3.0.33

- Target DCV and "hit by" are now hidden from players. GM's will see a white-ish background and blue outline for items hidden from players in chat messages. [#351](https://github.com/dmdorman/hero6e-foundryvtt/issues/351)
- The "Roll Damage" button is now only shown for token owners.
- Improved AOE workflow to use DCV 3 for template placement. [#354](https://github.com/dmdorman/hero6e-foundryvtt/issues/354)
- Hit Locations no longer valid for AOE attacks.
- Initial support for SELECTIVE and NONSELECTIVE. [#322](https://github.com/dmdorman/hero6e-foundryvtt/issues/322)
- You now have to hold down SHIFT to change turn in combat tracker. [#352](https://github.com/dmdorman/hero6e-foundryvtt/issues/352)
- Initial support for PENALTY SKILL LEVELS. Currently limited to Aim Hit Locations. Shown as a checkbox during attack. [#349](https://github.com/dmdorman/hero6e-foundryvtt/issues/349)
- Initial support for AUTOMATION and TAKES NO STUN. [#308](https://github.com/dmdorman/hero6e-foundryvtt/issues/308)

## Version 3.0.32

- Initial REDUCEDPENETRATION support. Rules as written are to split the attack into two separate dice pools, which is awkward with the current system. A simplified solution is to apply defenses twice to the body damage. [#313](https://github.com/dmdorman/hero6e-foundryvtt/issues/313)
- Initial Actor description. Sends APPEARANCE and all obvious & inobvious powers to chat log. A future improvement will include a perception roll for inobvious powers. [#311](https://github.com/dmdorman/hero6e-foundryvtt/issues/311)
- Improved migration script. Fixes mistakes in some power costs & power descriptions without the need to re-upload HDC.
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

- Reworked Characteristics internal data structure. Consolidating 6e/5e base, core, costs, bought as powers, etc into one data structure. Improved hover descriptions. You can now make changes to CORE characteristics, which will update BASE and COST. Core, base, and cost are mostly for reference and have no effective gameplay function; although MAX should equal CORE when all powers/effects are turned off. This is a small step toward improving actor editing within FoundryVTT.
- Fixed incorrect values for some 5e movements during HDC upload. [#299](https://github.com/dmdorman/hero6e-foundryvtt/issues/299)

## Version 3.0.28

- Fix for AID/DRAIN failing to upload when no name specified.
- Fix for AID/DRAIN fade.

## Version 3.0.27

- A work in progress proof of concept for improved editing of powers. Open item, click on Sheet in header, then select Herosystem6eItem2Sheet to preview.
- Improved actor migration to update power modifiers. [#287](https://github.com/dmdorman/hero6e-foundryvtt/issues/287)
- Added [FEATURES.md](FEATURES.md) file that lists all the skills, perks, talents, powers, modifiers and complications. Each is given a support rating.
- Improved Aid/Drain descriptions and fixed issue where targets were not passed to apply damage. [#289](https://github.com/dmdorman/hero6e-foundryvtt/issues/289)

## Version 3.0.26

- Testing workflow to publish to FoundryVTT.

## Version 3.0.25

- Support for Use Standard Effect. Requires uploading of HDC again. [#281](https://github.com/dmdorman/hero6e-foundryvtt/issues/281)
- Fixed AOE "Apply Damage to ALL" where full damage was applied to all tokens instead of damage based on distance.
- Movement during combat now costs END (1 END per 10m). [#239](https://github.com/dmdorman/hero6e-foundryvtt/issues/239)
- RoundFavorPlayerUp on DCV to ensure whole number. [#210](https://github.com/dmdorman/hero6e-foundryvtt/issues/210)
- Reduced Endurance (half) now has minimum cost of 1 END.
- Improved generic migration to update costs, END and descriptions. This overwrites any manual changes that may have been made.

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
- Initial AOE EXPLOSION support. Sorts by range to center of template and shows distance to center. Damage falloff not implemented yet. [#151](https://github.com/dmdorman/hero6e-foundryvtt/issues/151)
- Non PCs are marked as defeated when they drop below -10 STUN. Once defeated they no longer get post segment 12 recoveries.
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
- Improved AOE workflow. Attacker is prompted to place an AOE template, which automatically selects visible targets within the template. AOE attacks assume template always hits hex and that all targets are hit regardless of their DCV.

## Version 3.0.18

- Fix for new attacks that only worked with alpha flag turned on.

## Version 3.0.17

- Improved CSL detection of small/large group by selecting the first 3 attacks for small group, and all attacks on the attack tab for large group. You can edit CSL's after upload to override auto selection of relevant attacks.
- Martial +1 HTH Damage Class(es) was incorrectly created as an attack and shown in attack tab. [#258](https://github.com/dmdorman/hero6e-foundryvtt/issues/258)
- Fixed missing martial "+1 Ranged Damage Class(es)" upload.
- Templates automatically select tokens within the template. Intend to improve AOE attack workflow.
- Initial AVAD support. [#206](https://github.com/dmdorman/hero6e-foundryvtt/issues/206)
- Fixed everyman skills showing NaN [#259](https://github.com/dmdorman/hero6e-foundryvtt/issues/259)
- Backend changes to Item Attack dialog. Values now sync with other windows/players.

## Version 3.0.16

- Migration unnecessary on new/empty worlds [#254](https://github.com/dmdorman/hero6e-foundryvtt/issues/254)
- Initial support for vehicles, bases, computers, automatons, and ai's. [#109](https://github.com/dmdorman/hero6e-foundryvtt/issues/109)
- Fixed issue with some talents failing to upload, that would prevent other powers from uploading. Improved warn/error messages during upload to assist with similar issues in the future.
- Improved defense summary tooltips/mouseovers.

## Version 3.0.15

- Fixes for Requires A Roll. Attacks spend END when RAR fails. Hotbar macros no longer RAR when powers toggle off. [#244](https://github.com/dmdorman/hero6e-foundryvtt/issues/244)
- Initial Abort support. Aborted status icon. When Stunned, Knocked Out, or Aborted you can not act (make rolls or toggle powers on).
- Initial Block support. Minimal automation here. The GM/Player should speak up before the attacker rolls. Multiple blocks are possible, but you have to remove the abort condition before making a second block at -2. In the future it may be possible to prompt the defender if they want to block, and handle multiple blocks. Block assume no STR/END use. Any potential Initiative benefits to dodge are not automated.
- Initial Dodge support. [#105](https://github.com/dmdorman/hero6e-foundryvtt/issues/105)
- Fixed Martial Arts uploads where OCV and DCV modifiers were ignored.
- Improved Blind and Prone statuses to include appropriate CV penalties.
- Fixed 1/2 DCV rounding down. Now follows standard rounding rules that favor the player. [#153](https://github.com/dmdorman/hero6e-foundryvtt/issues/153)
- Initial AUTOFIRE support. Some automation for single targets. No automation for multiple targets as the workflow of tohit/damage would be awkward unless fully automated. Full automation limits the ability for GM's to handle unusual situations. [#43](https://github.com/dmdorman/hero6e-foundryvtt/issues/43)
- Initial support for Skill Levels. Player is prompted to confirm Skill Level applies to rolled skill. Skill rolls now show tag details. [#89](https://github.com/dmdorman/hero6e-foundryvtt/issues/89)
- Fixed issue where some active effects using icons not associated with statuses caused error when loading world.
- Initial Encumbrance penalty support. [#118](https://github.com/dmdorman/hero6e-foundryvtt/issues/118)
- Fixed issue where END was spent twice a phase for actors with Lightning Reflexes. Now it only spends END on the beginning of the non LR phase for that actor.
- Improved scrolling numbers for STUN and BODY changes. They now show when you Take a recovery. Also show for all players, not jus the GM.
- Improved Skill and Power descriptions. [#248](https://github.com/dmdorman/hero6e-foundryvtt/issues/248)
- Improved Skill Enhancer calculations [#249](https://github.com/dmdorman/hero6e-foundryvtt/issues/249)
- Fixed rare and minor issue where velocity wasn't calculated when there is no token for an actor. [#250](https://github.com/dmdorman/hero6e-foundryvtt/issues/250)
- Fixed 0d6 + 1 rolls. [#252](https://github.com/dmdorman/hero6e-foundryvtt/issues/252)

## Version 3.0.14

- Fixed issue where some 5e powers were incorrectly calculating END.
- Support for Activation Rolls (similar to Requires a Roll)
- Initial support for conditional Defenses (Only Works Against & Conditional Power). GM will be prompted to select conditional defense when applying damage. [#181](https://github.com/dmdorman/hero6e-foundryvtt/issues/181)
- Improved Endurance/Stun (all) and Body (PCs only) recovery out of combat. NPCs stop stun recovery once they are below -10 stun. PC stun recovery below -10 is still every phase, but should be using the Recovery Time Table (future improvement). Expected to use Simple Calendar to advance time out of combat.
- Active Effects split out into Temporary, Constant, or Persistent. Where Constant and Persistent largely match the HERO power description; and are typically always on (such as most defenses). Temporary is for effects with a limited duration (such as AID). In a future release constant powers will toggle off when knocked out. May require HDC upload on existing actors for proper assignment. [#235](https://github.com/dmdorman/hero6e-foundryvtt/issues/235)
- Defenses show as effects in other tab. Internally they are not Active Effects, but behave similarly. A quality of life enhancement which shows all powers & effects in one spot.
- Combat Skill Levels (CSL) can be changed within the _Roll to Hit_ dialog. [#189](https://github.com/dmdorman/hero6e-foundryvtt/issues/189)
- Initial support for DCV buffs/penalties associated with some attacks, that last until actors next phase. [#103](https://github.com/dmdorman/hero6e-foundryvtt/issues/103)
- STUN and BODY changes for tokens show as scrolling combat text. Stun is green and Body is red, matching the attribute bar colors. [#81](https://github.com/dmdorman/hero6e-foundryvtt/issues/81)

## Version 3.0.13

- Fixed Maneuver OCV/DCV.
- Velocity estimate uses full move.
- Fixed import error.

## Version 3.0.12

- Active Powers consume END at beginning of phase. May require HDC upload or toggle powers to work on existing actors. [#77](https://github.com/dmdorman/hero6e-foundryvtt/issues/77)
- Range Penalty applies when targeting tokens. Fixed Set/Brace. 5e range penalties are now based on 1". [#100](https://github.com/dmdorman/hero6e-foundryvtt/issues/100)
- Fixed Biography editing. [#233](https://github.com/dmdorman/hero6e-foundryvtt/issues/233)
- END and STUN recover when time advances (with Simple Calendar) [#228](https://github.com/dmdorman/hero6e-foundryvtt/issues/228)
- Charges reset each day [#227](https://github.com/dmdorman/hero6e-foundryvtt/issues/227)
- Maneuvers that are attack-ish now have roll icons instead of checkboxes. [#102](https://github.com/dmdorman/hero6e-foundryvtt/issues/102)
- Haymaker support. [#98](https://github.com/dmdorman/hero6e-foundryvtt/issues/98)
- Initial MOVE BY and MOVE THROUGH support. Velocity assumes token is at rest at beginning and end of phase. Velocity can be overwritten. [#193](https://github.com/dmdorman/hero6e-foundryvtt/issues/193)
- Initial support for 'Only Costs END to Activate'.
- AID fix for END.

## Version 3.0.11

- Drag Ruler units now match grid units of the scene. [#225](https://github.com/dmdorman/hero6e-foundryvtt/issues/225)
- Initial TRANSFER (5e) support. [#133](https://github.com/dmdorman/hero6e-foundryvtt/issues/133)
- POWER DEFENSE works vs DRAIN/TRANSFER.
- DELAYED RETURN RATE works vs AID/DRAIN/TRANSFER.
- Initial REQUIRES A ROLL support. [#53](https://github.com/dmdorman/hero6e-foundryvtt/issues/53) [#49](https://github.com/dmdorman/hero6e-foundryvtt/issues/49)
- Initial ENDURANCE RESERVE support. [#54](https://github.com/dmdorman/hero6e-foundryvtt/issues/54)

## Version 3.0.10

- Temporary changes to CHARACTERISTIC MAX have red/green backgrounds on character sheet, similar to how VALUE background turns red/green.
- Combat tracker now advances time. Confirmed compatibility with Simple Calendar when GameWorldTimeIntegrations=Mixed. [#213](https://github.com/dmdorman/hero6e-foundryvtt/issues/213)
- Improved AID and DRAIN support. [#185](https://github.com/dmdorman/hero6e-foundryvtt/issues/185)

## Version 3.0.9

- Initial support for Charges [#191](https://github.com/dmdorman/hero6e-foundryvtt/issues/191) [#47](https://github.com/dmdorman/hero6e-foundryvtt/issues/47)
- Fixed adding skills with NaN- rolls. [#195](https://github.com/dmdorman/hero6e-foundryvtt/issues/195)
- Partial Find Weakness (5e) support. Shows as a skill roll. [#208](https://github.com/dmdorman/hero6e-foundryvtt/issues/208)
- Stunned tokens are prevented from attacking. Stunned effect is removed and end of phase instead of start of phase. [#204](https://github.com/dmdorman/hero6e-foundryvtt/issues/204)
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
- Initial Combat Skill Levels (CSL) support. OCV is added to attacks. Simple +1DC. DCV (like all DCV modifiers) is shown but not currently implemented. [#166](https://github.com/dmdorman/hero6e-foundryvtt/issues/166)

## Version 3.0.5

- Initial DRAIN support.
- Changing PC/NPC actor type moved to sheet header. Also can be changed in the context menu of the actor sidebar. Fixes [#170](https://github.com/dmdorman/hero6e-foundryvtt/issues/170).
- Combat Tracker Improvements. Reworked underlying code so that \_onEndRound and \_onStartTurn are called as expected. This should lead to future automation improvements. For example Post-Segment-12 activities and Endurance use at the beginning of turn for continuous powers. Also changed tooltips for PREV/NEXT to align with Hero terminology. [#175](https://github.com/dmdorman/hero6e-foundryvtt/issues/175)
- Minor improvements to framework support.
- Fixed issue where Reduced Endurance was not included in END calculations. [#132](https://github.com/dmdorman/hero6e-foundryvtt/issues/132)

## Version 3.0.4

- Reworked Active Effects such that the effects on items remain with items. They are no longer
  transferred from the item to the actor. This is following [FoundryVtt v11 ActiveEffect Transferral](https://foundryvtt.com/article/v11-active-effects/) recommendations.
- Fixed Custom martial attacks, they now show on attack tab. Also fixed the Set & Brace martial manuevers.
- Fixed a bug where an attack using charges would set END=0.
- Fixed a bug where some auto created attacks were missing half die.
- Initial AID support. Adjustment powers do not automatically fade yet. One step closer to DRAIN/TRANSFER [#133](https://github.com/dmdorman/hero6e-foundryvtt/issues/133)

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
- Attack powers are used directly. No longer need to have separate attack items.
- All attack powers are shown in Attack tab, even those not fully implemented. A small step toward implementing additional attack types and charges.
- Character sheet can filter on some items. [#90](https://github.com/dmdorman/hero6e-foundryvtt/issues/90)

## Version 2.2.0-alpha

- Defensive powers are used directly. No longer need to have separate defense items splitting out PD/ED/etc.
- Reworked ActiveEffects to be placed on items (per FoundryVtt design).
- Apply damage only shown to GMs [#95](https://github.com/dmdorman/hero6e-foundryvtt/issues/95)
- Power/item descriptions can be sent to chat [#128](https://github.com/dmdorman/hero6e-foundryvtt/issues/128)
- Initial power framework support.
- Improved 5e support (COM, DAMAGERESISTANCE, FORCEFIELD).
- All movements collapsed to characteritics tab. Movement powers are now toggles [#88](https://github.com/dmdorman/hero6e-foundryvtt/issues/128).
- Most powers can be toggled [#38](https://github.com/dmdorman/hero6e-foundryvtt/issues/38). The remaining powers that do not have toggles (but should) are not fully implemented in the system. As support for those powers is added, so will the toggle.
- Fixed issue where killing attacks were not applying hit location multipliers. [#136](https://github.com/dmdorman/hero6e-foundryvtt/issues/136)

## Version 2.1.9-alpha

- Fixed equipment price showing NaN. Summary weight/price for equipment now only shows when there are items with weight/price.
- Fixed [Drag Ruler](https://foundryvtt.com/packages/drag-ruler) module errors when Drag Ruler not installed. Drag Ruler is recommended, but not required.
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
- Estimation of Character Points spent and Active Points. Still pretty rough. [#111](https://github.com/dmdorman/hero6e-foundryvtt/issues/111)
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

- Added 3rd attribute bar. Expectation is to show body, stun, and endurance for most tokens. [#75](https://github.com/dmdorman/hero6e-foundryvtt/issues/75)
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
