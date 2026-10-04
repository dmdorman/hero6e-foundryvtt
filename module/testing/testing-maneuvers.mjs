import { maneuverBasisOrElement } from "../item/maneuver-bases-and-elements.mjs";
import { createQuenchActor, deleteQuenchActor, setQuenchTimeout } from "./quench-helper.mjs";

export function registerManeuverTests(quench) {
    quench.registerBatch(
        `${game.system.id}.item.maneuver`,
        (context) => {
            const { after, before, describe, expect, it } = context;

            describe("Maneuver Behaviors", function () {
                // The default timeout tends to be insufficient with multiple actors being created at the same time.
                setQuenchTimeout(this);

                describe("5e Test Character Maneuvers", async function () {
                    // Using the Test-5e.hdc file content
                    const contents = `
                        <?xml version="1.0" encoding="UTF-16"?>
                        <CHARACTER version="6.0" TEMPLATE="builtIn.Normal.hdt">
                        <BASIC_CONFIGURATION BASE_POINTS="200" DISAD_POINTS="150" EXPERIENCE="0" RULES="Default" />
                        <CHARACTER_INFO CHARACTER_NAME="Test 5e Martial Arts Man" ALTERNATE_IDENTITIES="" PLAYER_NAME="" HEIGHT="78.74015748031496" WEIGHT="220.4622476037958" HAIR_COLOR="Brown" EYE_COLOR="Brown" CAMPAIGN_NAME="" GENRE="" GM="">
                            <BACKGROUND />
                            <PERSONALITY />
                            <QUOTE />
                            <TACTICS />
                            <CAMPAIGN_USE />
                            <APPEARANCE />
                            <NOTES1 />
                            <NOTES2 />
                            <NOTES3 />
                            <NOTES4 />
                            <NOTES5 />
                        </CHARACTER_INFO>
                        <CHARACTERISTICS>
                            <STR XMLID="STR" ID="1790379636286" BASECOST="0.0" LEVELS="0" ALIAS="STR" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </STR>
                            <DEX XMLID="DEX" ID="1790379636085" BASECOST="0.0" LEVELS="0" ALIAS="DEX" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </DEX>
                            <CON XMLID="CON" ID="1790379636417" BASECOST="0.0" LEVELS="0" ALIAS="CON" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </CON>
                            <BODY XMLID="BODY" ID="1790379635972" BASECOST="0.0" LEVELS="0" ALIAS="BODY" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </BODY>
                            <INT XMLID="INT" ID="1790379635567" BASECOST="0.0" LEVELS="0" ALIAS="INT" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </INT>
                            <EGO XMLID="EGO" ID="1790379636415" BASECOST="0.0" LEVELS="0" ALIAS="EGO" POSITION="6" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </EGO>
                            <PRE XMLID="PRE" ID="1790379636094" BASECOST="0.0" LEVELS="0" ALIAS="PRE" POSITION="7" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </PRE>
                            <COM XMLID="COM" ID="1790379635569" BASECOST="0.0" LEVELS="0" ALIAS="COM" POSITION="8" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </COM>
                            <PD XMLID="PD" ID="1790379635940" BASECOST="0.0" LEVELS="0" ALIAS="PD" POSITION="9" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </PD>
                            <ED XMLID="ED" ID="1790379636434" BASECOST="0.0" LEVELS="0" ALIAS="ED" POSITION="10" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </ED>
                            <SPD XMLID="SPD" ID="1790379636049" BASECOST="0.0" LEVELS="0" ALIAS="SPD" POSITION="11" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </SPD>
                            <REC XMLID="REC" ID="1790379635984" BASECOST="0.0" LEVELS="0" ALIAS="REC" POSITION="12" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </REC>
                            <END XMLID="END" ID="1790379636039" BASECOST="0.0" LEVELS="0" ALIAS="END" POSITION="13" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </END>
                            <STUN XMLID="STUN" ID="1790379635518" BASECOST="0.0" LEVELS="0" ALIAS="STUN" POSITION="14" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </STUN>
                            <RUNNING XMLID="RUNNING" ID="1790379635998" BASECOST="0.0" LEVELS="0" ALIAS="Running" POSITION="15" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </RUNNING>
                            <SWIMMING XMLID="SWIMMING" ID="1790379635612" BASECOST="0.0" LEVELS="0" ALIAS="Swimming" POSITION="16" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </SWIMMING>
                            <LEAPING XMLID="LEAPING" ID="1790379635748" BASECOST="0.0" LEVELS="0" ALIAS="Leaping" POSITION="17" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </LEAPING>
                        </CHARACTERISTICS>
                        <SKILLS />
                        <PERKS />
                        <TALENTS />
                        <MARTIALARTS>
                            <MANEUVER XMLID="MANEUVER" ID="1790379650365" BASECOST="3.0" LEVELS="0" ALIAS="Basic Strike" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Basic Strike" OCV="+1" DCV="+0" DC="2" PHASE="1/2" EFFECT="[NORMALDC] Strike" ADDSTR="Yes" ACTIVECOST="15" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Weapon [WEAPONDC] Strike">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379655501" BASECOST="4.0" LEVELS="0" ALIAS="Charge" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Charge" OCV="+0" DCV="-2" DC="2" PHASE="1/2" EFFECT="[NORMALDC] +v/5 Strike, FMove" ADDSTR="Yes" ACTIVECOST="30" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Weapon [WEAPONDC] +v/5 Strike, FMove">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379659292" BASECOST="4.0" LEVELS="0" ALIAS="Choke Hold" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Choke Hold" OCV="-2" DCV="+0" DC="4" PHASE="1/2" EFFECT="Grab One Limb; [NNDDC]" ADDSTR="No" ACTIVECOST="20" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Grab One Limb; [NNDDC]">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379662605" BASECOST="4.0" LEVELS="0" ALIAS="Counterstrike" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Counterstrike" OCV="+2" DCV="+2" DC="2" PHASE="1/2" EFFECT="[NORMALDC] Strike, Must Follow Block" ADDSTR="Yes" ACTIVECOST="20" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Weapon [WEAPONDC] Strike, Must Follow Block">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379666188" BASECOST="4.0" LEVELS="0" ALIAS="Crush" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Crush" OCV="+0" DCV="+0" DC="4" PHASE="1/2" EFFECT="[NORMALDC] Crush, Must Follow Grab" ADDSTR="Yes" ACTIVECOST="10" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Weapon [WEAPONDC] Crush, Must Follow Grab">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379671276" BASECOST="5.0" LEVELS="0" ALIAS="Defensive Block" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Defensive Block" OCV="+1" DCV="+3" DC="0" PHASE="1/2" EFFECT="Block, Abort" ADDSTR="No" ACTIVECOST="25" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Block, Abort">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379675045" BASECOST="5.0" LEVELS="0" ALIAS="Defensive Strike" POSITION="6" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Defensive Strike" OCV="+1" DCV="+3" DC="0" PHASE="1/2" EFFECT="[NORMALDC] Strike" ADDSTR="Yes" ACTIVECOST="20" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Weapon [WEAPONDC] Strike">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379677708" BASECOST="3.0" LEVELS="0" ALIAS="Defensive Throw" POSITION="7" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Defensive Throw" OCV="+1" DCV="+1" DC="0" PHASE="1/2" EFFECT="Block, Target Falls" ADDSTR="No" ACTIVECOST="30" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379680668" BASECOST="5.0" LEVELS="0" ALIAS="Disarming Throw" POSITION="8" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Disarming Throw" OCV="+0" DCV="+0" DC="1" PHASE="1/2" EFFECT="Grab Weapon, [STRDC] to take weapon away; Target Falls" ADDSTR="Yes" ACTIVECOST="25" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379683605" BASECOST="4.0" LEVELS="0" ALIAS="Fast Strike" POSITION="9" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Fast Strike" OCV="+2" DCV="+0" DC="2" PHASE="1/2" EFFECT="[NORMALDC] Strike" ADDSTR="Yes" ACTIVECOST="20" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Weapon [WEAPONDC] Strike">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379686332" BASECOST="5.0" LEVELS="0" ALIAS="Flying Dodge" POSITION="10" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Flying Dodge" OCV="--" DCV="+4" DC="0" PHASE="1/2" EFFECT="Dodge All Attacks, Abort; FMove" ADDSTR="No" ACTIVECOST="50" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379689437" BASECOST="5.0" LEVELS="0" ALIAS="Flying Grab" POSITION="11" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Flying Grab" OCV="-2" DCV="-1" DC="2" PHASE="1/2" EFFECT="Grab Two Limbs, [STRDC] for holding on; FMove" ADDSTR="Yes" ACTIVECOST="25" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Grab Two Limbs, [STRDC] for holding on; FMove">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379692997" BASECOST="3.0" LEVELS="0" ALIAS="Flying Tackle" POSITION="12" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Flying Tackle" OCV="+0" DCV="-1" DC="0" PHASE="1/2" EFFECT="[NORMALDC] +v/5 Strike; You Fall, Target Falls; FMove" ADDSTR="Yes" ACTIVECOST="40" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379695709" BASECOST="5.0" LEVELS="0" ALIAS="Grappling Block" POSITION="13" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Grappling Block" OCV="+1" DCV="+1" DC="0" PHASE="1/2" EFFECT="Grab One Limb, Block" ADDSTR="Yes" ACTIVECOST="-5" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379698885" BASECOST="3.0" LEVELS="0" ALIAS="Grappling Throw" POSITION="14" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Grappling Throw" OCV="+0" DCV="+2" DC="2" PHASE="1/2" EFFECT="[NORMALDC] Strike; Target Falls; Must Follow Grab" ADDSTR="Yes" ACTIVECOST="25" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Weapon [WEAPONDC] Strike; Target Falls; Must Follow Grab">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379703076" BASECOST="5.0" LEVELS="0" ALIAS="Joint Break" POSITION="15" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Joint Break" OCV="-1" DCV="-2" DC="4" PHASE="1/2" EFFECT="Grab One Limb; [KILLINGDC], Disable" ADDSTR="Yes" ACTIVECOST="0" DAMAGETYPE="0" MAXSTR="10" STRMULT="1" USEWEAPON="No">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379706412" BASECOST="4.0" LEVELS="0" ALIAS="Joint Lock/Throw" POSITION="16" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Joint Lock/Throw" OCV="+1" DCV="+0" DC="2" PHASE="1/2" EFFECT="Grab One Limb; [NNDDC]; Target Falls" ADDSTR="No" ACTIVECOST="27" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Grab One Limb; [NNDDC]; Target Falls">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379708972" BASECOST="4.0" LEVELS="0" ALIAS="Killing Strike" POSITION="17" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Killing Strike" OCV="-2" DCV="+0" DC="4" PHASE="1/2" EFFECT="[KILLINGDC]" ADDSTR="Yes" ACTIVECOST="10" DAMAGETYPE="0" MAXSTR="10" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="[WEAPONKILLINGDC]">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379711549" BASECOST="5.0" LEVELS="0" ALIAS="Killing Throw" POSITION="18" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Killing Throw" OCV="-2" DCV="+0" DC="4" PHASE="1/2" EFFECT="[KILLINGDC], Target Falls" ADDSTR="Yes" ACTIVECOST="35" DAMAGETYPE="0" MAXSTR="10" STRMULT="1" USEWEAPON="No">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379714101" BASECOST="3.0" LEVELS="0" ALIAS="Legsweep" POSITION="19" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Legsweep" OCV="+2" DCV="-1" DC="1" PHASE="1/2" EFFECT="[NORMALDC] Strike, Target Falls" ADDSTR="Yes" ACTIVECOST="35" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Weapon [WEAPONDC] Strike, Target Falls">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379716764" BASECOST="4.0" LEVELS="0" ALIAS="Martial Block" POSITION="20" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Martial Block" OCV="+2" DCV="+2" DC="0" PHASE="1/2" EFFECT="Block, Abort" ADDSTR="No" ACTIVECOST="20" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Block, Abort">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379719797" BASECOST="4.0" LEVELS="0" ALIAS="Martial Disarm" POSITION="21" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Martial Disarm" OCV="-1" DCV="+1" DC="2" PHASE="1/2" EFFECT="Disarm; [STRDC] to Disarm" ADDSTR="Yes" ACTIVECOST="5" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Disarm; [STRDC] to Disarm roll">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379722357" BASECOST="4.0" LEVELS="0" ALIAS="Martial Dodge" POSITION="22" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Martial Dodge" OCV="--" DCV="+5" DC="0" PHASE="1/2" EFFECT="Dodge, Affects All Attacks, Abort" ADDSTR="No" ACTIVECOST="35" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379725333" BASECOST="4.0" LEVELS="0" ALIAS="Martial Escape" POSITION="23" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Martial Escape" OCV="+0" DCV="+0" DC="3" PHASE="1/2" EFFECT="[STRDC] vs. Grabs" ADDSTR="Yes" ACTIVECOST="10" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379728428" BASECOST="4.0" LEVELS="0" ALIAS="Martial Flash" POSITION="24" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="Hearing" CATEGORY="Hand To Hand" DISPLAY="Martial Flash" OCV="-1" DCV="-1" DC="4" PHASE="1/2" EFFECT="[FLASHDC]" ADDSTR="No" ACTIVECOST="10" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="[FLASHDC]">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379731117" BASECOST="3.0" LEVELS="0" ALIAS="Martial Grab" POSITION="25" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Martial Grab" OCV="-1" DCV="-1" DC="2" PHASE="1/2" EFFECT="Grab Two Limbs, [STRDC] for holding on" ADDSTR="Yes" ACTIVECOST="-5" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Grab Two Limbs, [STRDC] for holding on">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379734213" BASECOST="4.0" LEVELS="0" ALIAS="Martial Strike" POSITION="26" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Martial Strike" OCV="+0" DCV="+2" DC="2" PHASE="1/2" EFFECT="[NORMALDC] Strike" ADDSTR="Yes" ACTIVECOST="20" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Weapon [WEAPONDC] Strike">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379737109" BASECOST="3.0" LEVELS="0" ALIAS="Martial Throw" POSITION="27" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Martial Throw" OCV="+0" DCV="+1" DC="0" PHASE="1/2" EFFECT="[NORMALDC] +v/5, Target Falls" ADDSTR="Yes" ACTIVECOST="40" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Weapon [WEAPONDC] +v/5, Target Falls">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379740220" BASECOST="4.0" LEVELS="0" ALIAS="Nerve Strike" POSITION="28" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Nerve Strike" OCV="-1" DCV="+1" DC="4" PHASE="1/2" EFFECT="[NNDDC]" ADDSTR="No" ACTIVECOST="15" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="[NNDDC]">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379743428" BASECOST="5.0" LEVELS="0" ALIAS="Offensive Strike" POSITION="29" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Offensive Strike" OCV="-2" DCV="+1" DC="4" PHASE="1/2" EFFECT="[NORMALDC] Strike" ADDSTR="Yes" ACTIVECOST="15" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Weapon [WEAPONDC] Strike">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379746213" BASECOST="5.0" LEVELS="0" ALIAS="Passing Disarm" POSITION="30" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Passing Disarm" OCV="-1" DCV="-1" DC="2" PHASE="1/2" EFFECT="Disarm, [STRDC] to Disarm; FMove" ADDSTR="Yes" ACTIVECOST="15" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Disarm, [STRDC] to Disarm roll; FMove">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379749125" BASECOST="5.0" LEVELS="0" ALIAS="Passing Strike" POSITION="31" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Passing Strike" OCV="+1" DCV="+0" DC="0" PHASE="1/2" EFFECT="[NORMALDC] +v/5; FMove" ADDSTR="Yes" ACTIVECOST="35" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Weapon [WEAPONDC] +v/5; FMove">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379752013" BASECOST="5.0" LEVELS="0" ALIAS="Passing Throw" POSITION="32" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Passing Throw" OCV="+0" DCV="+0" DC="0" PHASE="1/2" EFFECT="[NORMALDC] +v/5; Target Falls; FMove" ADDSTR="Yes" ACTIVECOST="55" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Weapon [WEAPONDC] +v/5; Target Falls; FMove">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379754541" BASECOST="4.0" LEVELS="0" ALIAS="Reversal" POSITION="33" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Reversal" OCV="-1" DCV="-2" DC="3" PHASE="var" EFFECT="[STRDC] to Escape; Grab Two Limbs" ADDSTR="Yes" ACTIVECOST="-10" DAMAGETYPE="0" MAXSTR="0" STRMULT="2" USEWEAPON="No">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379757733" BASECOST="4.0" LEVELS="0" ALIAS="Root" POSITION="34" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Root" OCV="+0" DCV="+0" DC="3" PHASE="1/2" EFFECT="[STRDC] to resist Shove; Block, Abort" ADDSTR="Yes" ACTIVECOST="20" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379761924" BASECOST="4.0" LEVELS="0" ALIAS="Sacrifice Disarm" POSITION="35" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Sacrifice Disarm" OCV="+2" DCV="-2" DC="2" PHASE="1/2" EFFECT="Disarm, [STRDC] to Disarm" ADDSTR="Yes" ACTIVECOST="5" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Disarm, [STRDC] to Disarm roll">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379764837" BASECOST="4.0" LEVELS="0" ALIAS="Sacrifice Lunge" POSITION="36" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Sacrifice Lunge" OCV="+2" DCV="-2" DC="0" PHASE="1/2" EFFECT="[NORMALDC] +v/5; FMove" ADDSTR="Yes" ACTIVECOST="30" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Weapon [WEAPONDC] +v/5; FMove">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379767749" BASECOST="5.0" LEVELS="0" ALIAS="Sacrifice Strike" POSITION="37" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Sacrifice Strike" OCV="+1" DCV="-2" DC="4" PHASE="1/2" EFFECT="[NORMALDC] Strike" ADDSTR="Yes" ACTIVECOST="15" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Weapon [WEAPONDC] Strike">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379770838" BASECOST="3.0" LEVELS="0" ALIAS="Sacrifice Throw" POSITION="38" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Sacrifice Throw" OCV="+2" DCV="+1" DC="0" PHASE="1/2" EFFECT="[NORMALDC] Strike; You Fall, Target Falls" ADDSTR="Yes" ACTIVECOST="35" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Weapon [WEAPONDC] Strike; You Fall, Target Falls">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379774628" BASECOST="4.0" LEVELS="0" ALIAS="Shove" POSITION="39" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Shove" OCV="+0" DCV="+0" DC="3" PHASE="1/2" EFFECT="[STRDC] to Shove" ADDSTR="Yes" ACTIVECOST="10" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="[STRDC] to Shove">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379780853" BASECOST="5.0" LEVELS="0" ALIAS="Takeaway" POSITION="40" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Takeaway" OCV="+0" DCV="+0" DC="2" PHASE="1/2" EFFECT="Grab Weapon, [STRDC] to take weapon away" ADDSTR="Yes" ACTIVECOST="5" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Grab Weapon, [STRDC] to take weapon away">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379784565" BASECOST="3.0" LEVELS="0" ALIAS="Takedown" POSITION="41" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Takedown" OCV="+1" DCV="+1" DC="0" PHASE="1/2" EFFECT="[NORMALDC] Strike; Target Falls" ADDSTR="Yes" ACTIVECOST="35" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Weapon [WEAPONDC] Strike; Target Falls">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379790284" BASECOST="4.0" LEVELS="0" ALIAS="Weapon Bind" POSITION="42" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Weapon Bind" OCV="+1" DCV="+0" DC="2" PHASE="1/2" EFFECT="Bind, [STRDC]" ADDSTR="Yes" ACTIVECOST="5" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Bind, [STRDC]">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379796012" BASECOST="4.0" LEVELS="0" ALIAS="Basic Shot" POSITION="43" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Ranged" DISPLAY="Basic Shot" OCV="+0" DCV="+0" DC="2" PHASE="1/2" EFFECT="Strike, [WEAPONDC]" ADDSTR="No" ACTIVECOST="16" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" RANGE="2">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379799605" BASECOST="3.0" LEVELS="0" ALIAS="Defensive Shot" POSITION="44" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Ranged" DISPLAY="Defensive Shot" OCV="-1" DCV="+2" DC="0" PHASE="1/2" EFFECT="Strike [WEAPONDC]" ADDSTR="No" ACTIVECOST="5" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" RANGE="0">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379802966" BASECOST="5.0" LEVELS="0" ALIAS="Distance Shot" POSITION="45" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Ranged" DISPLAY="Distance Shot" OCV="+0" DCV="-2" DC="0" PHASE="1+1" EFFECT="Strike [WEAPONDC], +1 Segment" ADDSTR="No" ACTIVECOST="3" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" RANGE="6">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379805805" BASECOST="5.0" LEVELS="0" ALIAS="Far Shot" POSITION="46" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Ranged" DISPLAY="Far Shot" OCV="+1" DCV="-1" DC="0" PHASE="1/2" EFFECT="Strike [WEAPONDC]" ADDSTR="No" ACTIVECOST="12" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" RANGE="4">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379808605" BASECOST="5.0" LEVELS="0" ALIAS="Offensive Ranged Disarm" POSITION="47" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Ranged" DISPLAY="Offensive Ranged Disarm" OCV="+1" DCV="-1" DC="2" PHASE="1/2" EFFECT="Disarm, [WEAPONDC] to Disarm" ADDSTR="No" ACTIVECOST="11" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" RANGE="2">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379811356" BASECOST="4.0" LEVELS="0" ALIAS="Offensive Shot" POSITION="48" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Ranged" DISPLAY="Offensive Shot" OCV="-1" DCV="-1" DC="4" PHASE="1/2" EFFECT="Strike, [WEAPONDC]" ADDSTR="No" ACTIVECOST="10" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" RANGE="0">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379813917" BASECOST="5.0" LEVELS="0" ALIAS="Offensive Trip" POSITION="49" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Ranged" DISPLAY="Offensive Trip" OCV="+1" DCV="-1" DC="0" PHASE="1/2" EFFECT="Strike [WEAPONDC] +v/5, Target Falls" ADDSTR="No" ACTIVECOST="35" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" RANGE="0">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379816837" BASECOST="4.0" LEVELS="0" ALIAS="Quick Shot" POSITION="50" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Ranged" DISPLAY="Quick Shot" OCV="+1" DCV="+0" DC="2" PHASE="1/2" EFFECT="Strike, [WEAPONDC]" ADDSTR="No" ACTIVECOST="15" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" RANGE="0">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379819741" BASECOST="4.0" LEVELS="0" ALIAS="Ranged Disarm" POSITION="51" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Ranged" DISPLAY="Ranged Disarm" OCV="+0" DCV="+0" DC="3" PHASE="1/2" EFFECT="Disarm, [WEAPONDC] to Disarm" ADDSTR="Yes" ACTIVECOST="10" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" RANGE="0">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1790379823100" BASECOST="4.0" LEVELS="0" ALIAS="Trip" POSITION="52" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Ranged" DISPLAY="Trip" OCV="-1" DCV="-1" DC="0" PHASE="1/2" EFFECT="v/5, Target Falls" ADDSTR="No" ACTIVECOST="31" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" RANGE="2">
                            <NOTES />
                            </MANEUVER>
                            <LIST XMLID="GENERIC_OBJECT" ID="1791060965055" BASECOST="0.0" LEVELS="0" ALIAS=" " POSITION="53" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
                            <NOTES />
                            </LIST>
                            <LIST XMLID="GENERIC_OBJECT" ID="1791060966275" BASECOST="0.0" LEVELS="0" ALIAS="Custom Martial Arts" POSITION="54" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
                            <NOTES />
                            </LIST>
                            <MANEUVER XMLID="MANEUVER" ID="1791060822287" BASECOST="3.0" LEVELS="0" ALIAS="Flowing Redirection" POSITION="55" MULTIPLIER="1.0" GRAPHIC="block" COLOR="255 255 255" SFX="Martial Arts" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1791060966275" NAME="" CUSTOM="Yes" CATEGORY="Hand to Hand" DISPLAY="Custom Maneuver" OCV="+0" DCV="+2" DC="1" PHASE="1" EFFECT="Target Falls, [DAMAGE] Strike; Can Only Be Used After an opponent misses the character with a Strike" ADDSTR="Yes" ACTIVECOST="0" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Target Falls, [DAMAGE] Strike; Can Only Be Used After an opponent misses the character with a Strike">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1791063133721" BASECOST="4.0" LEVELS="0" ALIAS="Passing Slash (like a move-by)" POSITION="56" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1791060966275" NAME="" CUSTOM="Yes" CATEGORY="Hand to Hand" DISPLAY="Custom Maneuver" OCV="+1" DCV="+0" DC="0" PHASE="1/2" EFFECT="+ v/5; Strike, FMove; Attacker Takes Half Damage" ADDSTR="Yes" ACTIVECOST="0" DAMAGETYPE="3" MAXSTR="0" STRMULT="1" USEWEAPON="Yes" WEAPONEFFECT="+ v/5; Strike, FMove; Attacker Takes Half Damage">
                            <NOTES />
                            </MANEUVER>
                            <MANEUVER XMLID="MANEUVER" ID="1791063526874" BASECOST="3.0" LEVELS="0" ALIAS="Meteor Drop" POSITION="57" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1791060966275" NAME="" CUSTOM="Yes" CATEGORY="Hand to Hand" DISPLAY="Custom Maneuver" OCV="-2" DCV="-2" DC="4" PHASE="1/2" EFFECT="[NORMALDC] + v/3; Strike, FMove; Take Full Damage" ADDSTR="Yes" ACTIVECOST="0" DAMAGETYPE="3" MAXSTR="0" STRMULT="1" USEWEAPON="Yes" WEAPONEFFECT="[NORMALDC] + v/3; Strike, FMove; Take Full Damage">
                            <NOTES />
                            </MANEUVER>
                        </MARTIALARTS>
                        <POWERS />
                        <DISADVANTAGES />
                        <EQUIPMENT />
                        </CHARACTER>
                    `;

                    let actor;
                    let maneuvers;
                    before(async function () {
                        actor = await createQuenchActor({ quench: this, contents, is5e: true, actorType: "pc" });

                        maneuvers = actor.items.filter((item) => item.system.XMLID === "MANEUVER");
                    });

                    after(async function () {
                        await deleteQuenchActor({ quench: this, actor });
                    });

                    // Full universe of maneuver bases/elements recognized by
                    // module/item/maneuver-bases-and-elements.mjs
                    // (MANEUVER_BASES_AND_ELEMENTS). Mirrored here so each test can
                    // assert the EXACT set of elements a maneuver's EFFECT resolves
                    // to. Keep in sync with that module.
                    const ALL_MANEUVER_BASES_AND_ELEMENTS = [
                        "abort",
                        "attackerFalls",
                        "bind",
                        "block",
                        "crush",
                        "disable",
                        "disarm",
                        "dodge",
                        "exert",
                        "flashDc",
                        "fmove",
                        "grab",
                        "grabWeapon",
                        "halfMoveRequired",
                        "killingDc",
                        "lastingRestriction",
                        "mustFollow",
                        "nndDc",
                        "normalDc",
                        "prone",
                        "requiresBothHands",
                        "response",
                        "root",
                        "shove",
                        "strike",
                        "takeFullDmg",
                        "takeHalfDmg",
                        "throw",
                        "velocity",
                        "weaponDc",
                    ];

                    // The exact set of bases/elements each 5e martial-arts maneuver's
                    // EFFECT attribute is expected to resolve to, keyed by ALIAS.
                    const EXPECTED_5E_MANEUVER_BASES_AND_ELEMENTS = {
                        "Basic Strike": ["normalDc", "strike"],
                        Charge: ["fmove", "normalDc", "strike", "velocity"],
                        "Choke Hold": ["grab", "nndDc"],
                        Counterstrike: ["mustFollow", "normalDc", "strike"],
                        Crush: ["crush", "mustFollow", "normalDc"],
                        "Defensive Block": ["abort", "block"],
                        "Defensive Strike": ["normalDc", "strike"],
                        "Defensive Throw": ["block", "throw"],
                        "Disarming Throw": ["exert", "grabWeapon", "throw"],
                        "Fast Strike": ["normalDc", "strike"],
                        "Flying Dodge": ["abort", "dodge", "fmove"],
                        "Flying Grab": ["exert", "fmove", "grab"],
                        "Flying Tackle": ["attackerFalls", "fmove", "normalDc", "strike", "throw", "velocity"],
                        "Grappling Block": ["block", "grab"],
                        "Grappling Throw": ["mustFollow", "normalDc", "strike", "throw"],
                        "Joint Break": ["disable", "grab", "killingDc"],
                        "Joint Lock/Throw": ["grab", "nndDc", "throw"],
                        "Killing Strike": ["killingDc"],
                        "Killing Throw": ["killingDc", "throw"],
                        Legsweep: ["normalDc", "strike", "throw"],
                        "Martial Block": ["abort", "block"],
                        "Martial Disarm": ["disarm", "exert"],
                        "Martial Dodge": ["abort", "dodge"],
                        "Martial Escape": ["exert"],
                        "Martial Flash": ["flashDc"],
                        "Martial Grab": ["exert", "grab"],
                        "Martial Strike": ["normalDc", "strike"],
                        "Martial Throw": ["normalDc", "throw", "velocity"],
                        "Nerve Strike": ["nndDc"],
                        "Offensive Strike": ["normalDc", "strike"],
                        "Passing Disarm": ["disarm", "exert", "fmove"],
                        "Passing Strike": ["fmove", "normalDc", "velocity"],
                        "Passing Throw": ["fmove", "normalDc", "throw", "velocity"],
                        Reversal: ["exert", "grab"],
                        Root: ["abort", "block", "exert", "root"],
                        "Sacrifice Disarm": ["disarm", "exert"],
                        "Sacrifice Lunge": ["fmove", "normalDc", "velocity"],
                        "Sacrifice Strike": ["normalDc", "strike"],
                        "Sacrifice Throw": ["attackerFalls", "normalDc", "strike", "throw"],
                        Shove: ["exert", "shove"],
                        Takeaway: ["exert", "grabWeapon"],
                        Takedown: ["normalDc", "strike", "throw"],
                        "Weapon Bind": ["bind", "exert"],
                        "Basic Shot": ["normalDc", "strike", "weaponDc"],
                        "Defensive Shot": ["normalDc", "strike", "weaponDc"],
                        "Distance Shot": ["normalDc", "strike", "weaponDc"],
                        "Far Shot": ["normalDc", "strike", "weaponDc"],
                        "Offensive Ranged Disarm": ["disarm", "normalDc", "weaponDc"],
                        "Offensive Shot": ["normalDc", "strike", "weaponDc"],
                        "Offensive Trip": ["normalDc", "strike", "throw", "velocity", "weaponDc"],
                        "Quick Shot": ["normalDc", "strike", "weaponDc"],
                        "Ranged Disarm": ["disarm", "normalDc", "weaponDc"],
                        Trip: ["throw", "velocity"],
                        // Custom maneuver: "Target Falls" -> throw, "[DAMAGE] Strike" -> strike,
                        // "Can Only Be Used After ..." -> response. The trailing prose only carries
                        // the response marker; the "Strike" inside it never wins because the earlier
                        // "[DAMAGE] Strike" element matches first.
                        "Flowing Redirection": ["response", "strike", "throw"],
                        // Custom maneuver: "Attacker Takes Half Damage" -> takeHalfDmg;
                        // "+ v/5" -> velocity.
                        "Passing Slash (like a move-by)": ["fmove", "strike", "takeHalfDmg", "velocity"],
                        // Custom maneuver: "Take Full Damage" -> takeFullDmg;
                        // "[NORMALDC] + v/3" -> normalDc and velocity.
                        "Meteor Drop": ["fmove", "normalDc", "strike", "takeFullDmg", "velocity"],
                    };

                    it("every martial art maneuver is covered by the expectations table", function () {
                        const uncovered = maneuvers
                            .map((maneuver) => maneuver.system.ALIAS)
                            .filter((alias) => !(alias in EXPECTED_5E_MANEUVER_BASES_AND_ELEMENTS));
                        expect(
                            uncovered,
                            `Maneuvers missing from the expectations table: ${uncovered.join(", ")}`,
                        ).to.deep.equal([]);
                    });

                    Object.entries(EXPECTED_5E_MANEUVER_BASES_AND_ELEMENTS).forEach(([alias, expectedElements]) => {
                        const expected = [...expectedElements].sort();
                        it(`"${alias}" should resolve to exactly [${expected.join(", ")}]`, function () {
                            const maneuver = maneuvers.find((item) => item.system.ALIAS === alias);
                            expect(maneuver, `Maneuver with ALIAS "${alias}" should exist`).to.exist;

                            const actual = ALL_MANEUVER_BASES_AND_ELEMENTS.filter(
                                (basisOrElementKey) => !!maneuverBasisOrElement(maneuver, basisOrElementKey),
                            ).sort();

                            expect(actual, `Maneuver "${alias}" EFFECT="${maneuver.system.EFFECT}"`).to.deep.equal(
                                expected,
                            );
                        });
                    });
                });

                describe("6e Test Character Maneuvers", async function () {
                    // Using the Test-6e.hdc file content
                    const contents = `
                        <?xml version="1.0" encoding="UTF-16"?>
                        <CHARACTER version="6.0" TEMPLATE="builtIn.Superheroic6E.hdt">
                            <BASIC_CONFIGURATION BASE_POINTS="200" DISAD_POINTS="150" EXPERIENCE="0" RULES="Default" />
                            <CHARACTER_INFO CHARACTER_NAME="TEST 6e Maneuvers" ALTERNATE_IDENTITIES="" PLAYER_NAME="" HEIGHT="78.74015748031496" WEIGHT="220.4622476037958" HAIR_COLOR="Brown" EYE_COLOR="Brown" CAMPAIGN_NAME="" GENRE="" GM="">
                                <BACKGROUND />
                                <PERSONALITY />
                                <QUOTE />
                                <TACTICS />
                                <CAMPAIGN_USE />
                                <APPEARANCE />
                                <NOTES1 />
                                <NOTES2 />
                                <NOTES3 />
                                <NOTES4 />
                                <NOTES5 />
                            </CHARACTER_INFO>
                            <CHARACTERISTICS>
                                <STR XMLID="STR" ID="1766428236220" BASECOST="0.0" LEVELS="0" ALIAS="STR" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </STR>
                                <DEX XMLID="DEX" ID="1766428236472" BASECOST="0.0" LEVELS="0" ALIAS="DEX" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </DEX>
                                <CON XMLID="CON" ID="1766428236473" BASECOST="0.0" LEVELS="0" ALIAS="CON" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </CON>
                                <BODY XMLID="BODY" ID="1766428236474" BASECOST="0.0" LEVELS="0" ALIAS="BODY" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </BODY>
                                <INT XMLID="INT" ID="1766428236475" BASECOST="0.0" LEVELS="0" ALIAS="INT" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </INT>
                                <EGO XMLID="EGO" ID="1766428236476" BASECOST="0.0" LEVELS="0" ALIAS="EGO" POSITION="6" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </EGO>
                                <PRE XMLID="PRE" ID="1766428236477" BASECOST="0.0" LEVELS="0" ALIAS="PRE" POSITION="7" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </PRE>
                                <PD XMLID="PD" ID="1766428236479" BASECOST="0.0" LEVELS="0" ALIAS="PD" POSITION="9" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </PD>
                                <ED XMLID="ED" ID="1766428236480" BASECOST="0.0" LEVELS="0" ALIAS="ED" POSITION="10" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </ED>
                                <SPD XMLID="SPD" ID="1766428236481" BASECOST="0.0" LEVELS="0" ALIAS="SPD" POSITION="11" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </SPD>
                                <REC XMLID="REC" ID="1766428236482" BASECOST="0.0" LEVELS="0" ALIAS="REC" POSITION="12" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </REC>
                                <END XMLID="END" ID="1766428236483" BASECOST="0.0" LEVELS="0" ALIAS="END" POSITION="13" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </END>
                                <STUN XMLID="STUN" ID="1766428236484" BASECOST="0.0" LEVELS="0" ALIAS="STUN" POSITION="14" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </STUN>
                                <RUNNING XMLID="RUNNING" ID="1766428236485" BASECOST="0.0" LEVELS="0" ALIAS="Running" POSITION="15" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </RUNNING>
                                <SWIMMING XMLID="SWIMMING" ID="1766428236486" BASECOST="0.0" LEVELS="0" ALIAS="Swimming" POSITION="16" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </SWIMMING>
                                <LEAPING XMLID="LEAPING" ID="1766428236487" BASECOST="0.0" LEVELS="0" ALIAS="Leaping" POSITION="17" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </LEAPING>
                            </CHARACTERISTICS>
                            <SKILLS />
                            <PERKS />
                            <TALENTS />
                            <MARTIALARTS>
                                <WEAPON_ELEMENT XMLID="WEAPON_ELEMENT" ID="1762056895689" BASECOST="0.0" LEVELS="0" ALIAS="Weapon Element" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
                                <NOTES />
                                <ADDER XMLID="DEFAULTELEMENT" ID="1762057131681" BASECOST="0.0" LEVELS="0" ALIAS="Default Element" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                </ADDER>
                                <ADDER XMLID="BAREHAND" ID="1762057132263" BASECOST="1.0" LEVELS="0" ALIAS="Empty Hand" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                </ADDER>
                                <ADDER XMLID="VEHICLEWEAPONS" ID="1762057133092" BASECOST="1.0" LEVELS="0" ALIAS="Vehicle Weapons" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                </ADDER>
                                <ADDER XMLID="COMMONMELEE" ID="1762057137690" BASECOST="0.0" LEVELS="0" ALIAS="Common Melee Weapons" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="NO">
                                    <NOTES />
                                    <ADDER XMLID="AXESMACES" ID="1762057135174" BASECOST="1.0" LEVELS="0" ALIAS="Axes, Maces, Hammers, and Picks" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="BLADES" ID="1762057135750" BASECOST="1.0" LEVELS="0" ALIAS="Blades" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="CLUBS" ID="1762057136250" BASECOST="1.0" LEVELS="0" ALIAS="Clubs" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="FISTLOADS" ID="1762057136734" BASECOST="1.0" LEVELS="0" ALIAS="Fist-Loads" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="POLEARMS" ID="1762057137187" BASECOST="1.0" LEVELS="0" ALIAS="Polearms and Spears" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="TWOHANDED" ID="1762057137689" BASECOST="1.0" LEVELS="0" ALIAS="Two-Handed Weapons" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </ADDER>
                                <ADDER XMLID="UNCOMMONMELEE" ID="1762057145096" BASECOST="0.0" LEVELS="0" ALIAS="Uncommon Melee Weapons" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="NO">
                                    <NOTES />
                                    <ADDER XMLID="FLAILS" ID="1762057138408" BASECOST="1.0" LEVELS="0" ALIAS="Flails" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="GARROTE" ID="1762057138863" BASECOST="1.0" LEVELS="0" ALIAS="Garrote" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="HOMEMADEWEAPONS" ID="1762057139313" BASECOST="1.0" LEVELS="0" ALIAS="Homemade Weapons" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="LANCES" ID="1762057139784" BASECOST="1.0" LEVELS="0" ALIAS="Lances" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="NETS" ID="1762057140267" BASECOST="1.0" LEVELS="0" ALIAS="Nets" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="SPREADTHEWATER" ID="1762057140732" BASECOST="1.0" LEVELS="0" ALIAS="Spread-The-Water Knife" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="WHIPS" ID="1762057141236" BASECOST="1.0" LEVELS="0" ALIAS="Whips" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="STAFFS" ID="1762057142142" BASECOST="1.0" LEVELS="0" ALIAS="Staffs" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="ELECTRICWHIP" ID="1762057143464" BASECOST="1.0" LEVELS="0" ALIAS="Electric Whip" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="ENERGYBLADES" ID="1762057144124" BASECOST="1.0" LEVELS="0" ALIAS="Energy Blades" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="INERTIALGLOVES" ID="1762057144598" BASECOST="1.0" LEVELS="0" ALIAS="Inertial Gloves" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="STUNRODS" ID="1762057145095" BASECOST="1.0" LEVELS="0" ALIAS="Stun Rods" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </ADDER>
                                <ADDER XMLID="COMMONMARTIAL" ID="1762057148655" BASECOST="0.0" LEVELS="0" ALIAS="Common Martial Arts Melee Weapons" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="NO">
                                    <NOTES />
                                    <ADDER XMLID="CHAIN" ID="1762057145682" BASECOST="1.0" LEVELS="0" ALIAS="Chain &amp; Rope Weapons" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="KARATE" ID="1762057146166" BASECOST="1.0" LEVELS="0" ALIAS="Karate Weapons" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="MOURN" ID="1762057146652" BASECOST="1.0" LEVELS="0" ALIAS="Mourn Staff" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="NINJA" ID="1762057147096" BASECOST="1.0" LEVELS="0" ALIAS="Ninja Weapons" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="RINGS" ID="1762057147560" BASECOST="1.0" LEVELS="0" ALIAS="Rings" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="STAFFS" ID="1762057148162" BASECOST="1.0" LEVELS="0" ALIAS="Staffs" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="WARFAN" ID="1762057148654" BASECOST="1.0" LEVELS="0" ALIAS="War Fan" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </ADDER>
                                <ADDER XMLID="UNCOMMONMARTIAL" ID="1762057155353" BASECOST="0.0" LEVELS="0" ALIAS="Uncommon Martial Arts Melee Weapons" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="NO">
                                    <NOTES />
                                    <ADDER XMLID="FLYINGCLAW" ID="1762057151456" BASECOST="1.0" LEVELS="0" ALIAS="Flying Claw/Guillotine" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="HOOKSWORD" ID="1762057151949" BASECOST="1.0" LEVELS="0" ALIAS="Hook Sword" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="KISERU" ID="1762057152410" BASECOST="1.0" LEVELS="0" ALIAS="Kiseru" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="LAJATANG" ID="1762057152950" BASECOST="1.0" LEVELS="0" ALIAS="Lajatang" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="PENDJEPIT" ID="1762057153424" BASECOST="1.0" LEVELS="0" ALIAS="Pendjepit" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="ROPEDART" ID="1762057153921" BASECOST="1.0" LEVELS="0" ALIAS="Rope Dart" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="THREESECTIONSTAFF" ID="1762057154389" BASECOST="1.0" LEVELS="0" ALIAS="Three-Section Staff" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="URUMI" ID="1762057154831" BASECOST="1.0" LEVELS="0" ALIAS="Urumi" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="WINDANDFIRE" ID="1762057155352" BASECOST="1.0" LEVELS="0" ALIAS="Wind and Fire Wheels" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </ADDER>
                                <ADDER XMLID="COMMONMISSILE" ID="1762057159555" BASECOST="0.0" LEVELS="0" ALIAS="Common Missile Weapons" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="NO">
                                    <NOTES />
                                    <ADDER XMLID="ROCKS" ID="1762057157704" BASECOST="1.0" LEVELS="0" ALIAS="Thrown Rocks" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="BOWS" ID="1762057158164" BASECOST="1.0" LEVELS="0" ALIAS="Bows" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="CROSSBOWS" ID="1762057158618" BASECOST="1.0" LEVELS="0" ALIAS="Crossbows" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="JAVELINS" ID="1762057159091" BASECOST="1.0" LEVELS="0" ALIAS="Javelins and Thrown Spears" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="THROWNKNIVES" ID="1762057159554" BASECOST="1.0" LEVELS="0" ALIAS="Thrown Knives, Axes, and Darts" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </ADDER>
                                <ADDER XMLID="UNCOMMONMISSILEWEAPONS" ID="1762057168735" BASECOST="0.0" LEVELS="0" ALIAS="Uncommon Missile Weapons" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="NO">
                                    <NOTES />
                                    <ADDER XMLID="ATATL" ID="1762057160105" BASECOST="1.0" LEVELS="0" ALIAS="Atatl" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="ARARE" ID="1762057160758" BASECOST="1.0" LEVELS="0" ALIAS="Arare" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="BLOWGUNS" ID="1762057161392" BASECOST="1.0" LEVELS="0" ALIAS="Blowguns" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="BOOMERANGS" ID="1762057161862" BASECOST="1.0" LEVELS="0" ALIAS="Boomerangs and Throwing Clubs" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="EARLYGRENADES" ID="1762057162372" BASECOST="1.0" LEVELS="0" ALIAS="Early Thrown Grenades" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="FUKIMIBARI" ID="1762057162844" BASECOST="1.0" LEVELS="0" ALIAS="Fukimi-Bari" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="IRONDUCK" ID="1762057163487" BASECOST="1.0" LEVELS="0" ALIAS="Iron Mandarin Duck" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="METSUBISHI" ID="1762057164123" BASECOST="1.0" LEVELS="0" ALIAS="Metsubishi" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="SLING" ID="1762057164650" BASECOST="1.0" LEVELS="0" ALIAS="Sling" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="SLINGBOW" ID="1762057165242" BASECOST="1.0" LEVELS="0" ALIAS="Sling Bow" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="STAFFSLING" ID="1762057165719" BASECOST="1.0" LEVELS="0" ALIAS="Staff Sling" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="STEELOLIVE" ID="1762057166307" BASECOST="1.0" LEVELS="0" ALIAS="Steel Olive" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="STEELTOAD" ID="1762057166948" BASECOST="1.0" LEVELS="0" ALIAS="Steel Toad" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="THROWNCHAIN" ID="1762057167482" BASECOST="1.0" LEVELS="0" ALIAS="Thrown Chain &amp; Rope Weapons" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="THROWNSWORD" ID="1762057168084" BASECOST="1.0" LEVELS="0" ALIAS="Thrown Sword" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="WISHFULBALL" ID="1762057168734" BASECOST="1.0" LEVELS="0" ALIAS="Wishful Steel Ball" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </ADDER>
                                <ADDER XMLID="SIEGEENGINES" ID="1762057174669" BASECOST="0.0" LEVELS="0" ALIAS="Siege Engines" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="NO">
                                    <NOTES />
                                    <ADDER XMLID="BALLISTA" ID="1762057171621" BASECOST="1.0" LEVELS="0" ALIAS="Ballista" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="CATAPULT" ID="1762057172228" BASECOST="1.0" LEVELS="0" ALIAS="Catapult" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="ONAGER" ID="1762057172760" BASECOST="1.0" LEVELS="0" ALIAS="Onager" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="SIEGETOWER" ID="1762057173227" BASECOST="1.0" LEVELS="0" ALIAS="Siege Tower" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="SPRINGENGINE" ID="1762057173696" BASECOST="1.0" LEVELS="0" ALIAS="Spring Engine" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="TREBUCHET" ID="1762057174180" BASECOST="1.0" LEVELS="0" ALIAS="Trebuchet" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="TURTLE" ID="1762057174668" BASECOST="1.0" LEVELS="0" ALIAS="Turtle" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </ADDER>
                                <ADDER XMLID="EARLYFIREARMS" ID="1762057177449" BASECOST="0.0" LEVELS="0" ALIAS="Early Firearms" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="NO">
                                    <NOTES />
                                    <ADDER XMLID="EARLYMUZZLELOADERS" ID="1762057175271" BASECOST="1.0" LEVELS="0" ALIAS="Early Muzzleloaders" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="MATCHLOCKS" ID="1762057175773" BASECOST="1.0" LEVELS="0" ALIAS="Matchlocks" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="WHEELLOCKS" ID="1762057176406" BASECOST="1.0" LEVELS="0" ALIAS="Wheellocks" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="FLINTLOCKS" ID="1762057176897" BASECOST="1.0" LEVELS="0" ALIAS="Flintlocks" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="EARLYPERCUSSIONFIREARMS" ID="1762057177448" BASECOST="1.0" LEVELS="0" ALIAS="Early Percussion Firearms" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </ADDER>
                                <ADDER XMLID="SMALLARMS" ID="1762057188093" BASECOST="0.0" LEVELS="0" ALIAS="Small Arms" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="NO">
                                    <NOTES />
                                    <ADDER XMLID="LMGS" ID="1762057181945" BASECOST="1.0" LEVELS="0" ALIAS="Assault Rifles/LMGs" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="HANDGUNS" ID="1762057182357" BASECOST="1.0" LEVELS="0" ALIAS="Handguns" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="RIFLES" ID="1762057182870" BASECOST="1.0" LEVELS="0" ALIAS="Rifles" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="SHOTGUNS" ID="1762057183323" BASECOST="1.0" LEVELS="0" ALIAS="Shotguns" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="SUBMACHINEGUNS" ID="1762057183789" BASECOST="1.0" LEVELS="0" ALIAS="Submachine Guns" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="THROWNGRENADES" ID="1762057184231" BASECOST="1.0" LEVELS="0" ALIAS="Thrown Grenades" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="LIQUIDRIFLE" ID="1762057184688" BASECOST="1.0" LEVELS="0" ALIAS="Liquid-Propellant Rifles" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="GAUSSGUNS" ID="1762057185179" BASECOST="1.0" LEVELS="0" ALIAS="Gauss Guns" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="POLYMERGUNS" ID="1762057185637" BASECOST="1.0" LEVELS="0" ALIAS="Polymer Guns" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="ROCKETPISTOLS" ID="1762057186094" BASECOST="1.0" LEVELS="0" ALIAS="Rocket Pistols" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="ROCKETRIFLES" ID="1762057186561" BASECOST="1.0" LEVELS="0" ALIAS="Rocket Rifles" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="MISSILEGUNS" ID="1762057187066" BASECOST="1.0" LEVELS="0" ALIAS="Missile Guns" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="SONICSTUNNER" ID="1762057187579" BASECOST="1.0" LEVELS="0" ALIAS="Sonic Stunners" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="TRANQGUNS" ID="1762057188092" BASECOST="1.0" LEVELS="0" ALIAS="Tranquilizer Dart Guns" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </ADDER>
                                <ADDER XMLID="UNCOMMONMODERNWEAPONS" ID="1762057190255" BASECOST="0.0" LEVELS="0" ALIAS="Uncommon Modern Weapons" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="NO">
                                    <NOTES />
                                    <ADDER XMLID="FLAMETHROWERS" ID="1762057188893" BASECOST="1.0" LEVELS="0" ALIAS="Flamethrowers" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="GRENADELAUNCHERS" ID="1762057189335" BASECOST="1.0" LEVELS="0" ALIAS="Grenade Launchers" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="HEAVYMACHINEGUNS" ID="1762057189776" BASECOST="1.0" LEVELS="0" ALIAS="General Purpose/Heavy Machine Guns" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="SHOULDERFIRED" ID="1762057190254" BASECOST="1.0" LEVELS="0" ALIAS="Shoulder-Fired Weapons" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </ADDER>
                                <ADDER XMLID="EMPLACEDWEAPONS" ID="1762057195566" BASECOST="0.0" LEVELS="0" ALIAS="Emplaced Weapons" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="NO">
                                    <NOTES />
                                    <ADDER XMLID="EARLYEMPLACEDWEAPONS" ID="1762057192406" BASECOST="1.0" LEVELS="0" ALIAS="Early Emplaced Weapons" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="ANTIAIRCRAFT" ID="1762057192867" BASECOST="1.0" LEVELS="0" ALIAS="Anti-Aircraft Guns" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="ANTITANK" ID="1762057193331" BASECOST="1.0" LEVELS="0" ALIAS="Anti-Tank Guns" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="ARTILLERY" ID="1762057193751" BASECOST="1.0" LEVELS="0" ALIAS="Artillery" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="HOWITZERS" ID="1762057194193" BASECOST="1.0" LEVELS="0" ALIAS="Howitzers" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="MORTARS" ID="1762057194646" BASECOST="1.0" LEVELS="0" ALIAS="Mortars" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="RECOILLESSGUNS" ID="1762057195565" BASECOST="1.0" LEVELS="0" ALIAS="Recoilless Guns" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </ADDER>
                                <ADDER XMLID="BEAMWEAPONS" ID="1762057198158" BASECOST="0.0" LEVELS="0" ALIAS="Beam Weapons" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="NO">
                                    <NOTES />
                                    <ADDER XMLID="LASERPISTOL" ID="1762057196711" BASECOST="1.0" LEVELS="0" ALIAS="Laser Pistols" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="LASERRIFLE" ID="1762057197158" BASECOST="1.0" LEVELS="0" ALIAS="Laser Rifles" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="ELECTRONBEAM" ID="1762057197655" BASECOST="1.0" LEVELS="0" ALIAS="Electron Beam Weapons" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="PARTICLEGUNS" ID="1762057198157" BASECOST="1.0" LEVELS="0" ALIAS="Particle Guns" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </ADDER>
                                <ADDER XMLID="ENERGYWEAPONS" ID="1762057199893" BASECOST="0.0" LEVELS="0" ALIAS="Energy Weapons" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="NO">
                                    <NOTES />
                                    <ADDER XMLID="IONBLASTER" ID="1762057198769" BASECOST="1.0" LEVELS="0" ALIAS="Ion Blasters" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="PLASMAGUNS" ID="1762057199369" BASECOST="1.0" LEVELS="0" ALIAS="Plasma Guns" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="DISINTEGRATORS" ID="1762057199892" BASECOST="1.0" LEVELS="0" ALIAS="Disintegrators" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </ADDER>
                                </WEAPON_ELEMENT>
                                <EXTRADC XMLID="EXTRADC" ID="1766869255538" BASECOST="0.0" LEVELS="3" ALIAS="+3 HTH Damage Class(es)" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
                                <NOTES />
                                </EXTRADC>
                                <RANGEDDC XMLID="RANGEDDC" ID="1766869259362" BASECOST="0.0" LEVELS="4" ALIAS="+4 Ranged Damage Class(es)" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
                                <NOTES />
                                </RANGEDDC>
                                <LIST XMLID="GENERIC_OBJECT" ID="1766870357983" BASECOST="0.0" LEVELS="0" ALIAS=" " POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
                                <NOTES />
                                </LIST>
                                <MANEUVER XMLID="MANEUVER" ID="1766869267703" BASECOST="3.0" LEVELS="0" ALIAS="Custom Strike" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CUSTOM="Yes" CATEGORY="Hand to Hand" DISPLAY="Custom Maneuver" OCV="+0" DCV="+0" DC="2" PHASE="1/2" EFFECT="Strike" ADDSTR="Yes" ACTIVECOST="0" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Strike">
                                <NOTES />
                                </MANEUVER>
                                <LIST XMLID="GENERIC_OBJECT" ID="1766870098566" BASECOST="0.0" LEVELS="0" ALIAS=" " POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
                                <NOTES />
                                </LIST>
                                <LIST XMLID="GENERIC_OBJECT" ID="1766870100828" BASECOST="0.0" LEVELS="0" ALIAS="Hand-to-Hand Maneuvers" POSITION="6" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
                                <NOTES />
                                </LIST>
                                <MANEUVER XMLID="MANEUVER" ID="1766869081650" BASECOST="3.0" LEVELS="0" ALIAS="Basic Strike" POSITION="7" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870100828" NAME="" CATEGORY="Hand To Hand" DISPLAY="Basic Strike" OCV="+1" DCV="+0" DC="2" PHASE="1/2" EFFECT="[NORMALDC] Strike" ADDSTR="Yes" ACTIVECOST="15" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Weapon [WEAPONDC] Strike">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869087883" BASECOST="4.0" LEVELS="0" ALIAS="Charge" POSITION="8" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870100828" NAME="" CATEGORY="Hand To Hand" DISPLAY="Charge" OCV="+0" DCV="-2" DC="2" PHASE="1/2" EFFECT="[NORMALDC] +v/10 Strike, FMove" ADDSTR="Yes" ACTIVECOST="30" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Weapon [WEAPONDC] +v/10 Strike, FMove">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869090490" BASECOST="4.0" LEVELS="0" ALIAS="Choke Hold" POSITION="9" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870100828" NAME="" CATEGORY="Hand To Hand" DISPLAY="Choke Hold" OCV="-2" DCV="+0" DC="4" PHASE="1/2" EFFECT="Grab One Limb; [NNDDC]" ADDSTR="No" ACTIVECOST="20" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Grab One Limb; [NNDDC]">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869092893" BASECOST="4.0" LEVELS="0" ALIAS="Counterstrike" POSITION="10" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870100828" NAME="" CATEGORY="Hand To Hand" DISPLAY="Counterstrike" OCV="+2" DCV="+2" DC="2" PHASE="1/2" EFFECT="[NORMALDC] Strike, Must Follow Block" ADDSTR="Yes" ACTIVECOST="20" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Weapon [WEAPONDC] Strike, Must Follow Block">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869095090" BASECOST="4.0" LEVELS="0" ALIAS="Crush" POSITION="11" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870100828" NAME="" CATEGORY="Hand To Hand" DISPLAY="Crush" OCV="+0" DCV="+0" DC="4" PHASE="1/2" EFFECT="[NORMALDC] Crush, Must Follow Grab" ADDSTR="Yes" ACTIVECOST="10" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Weapon [WEAPONDC] Crush, Must Follow Grab">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869097413" BASECOST="5.0" LEVELS="0" ALIAS="Defensive Block" POSITION="12" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870100828" NAME="" CATEGORY="Hand To Hand" DISPLAY="Defensive Block" OCV="+1" DCV="+3" DC="0" PHASE="1/2" EFFECT="Block, Abort" ADDSTR="No" ACTIVECOST="25" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Block, Abort">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869100034" BASECOST="5.0" LEVELS="0" ALIAS="Defensive Strike" POSITION="13" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870100828" NAME="" CATEGORY="Hand To Hand" DISPLAY="Defensive Strike" OCV="+1" DCV="+3" DC="0" PHASE="1/2" EFFECT="[NORMALDC] Strike" ADDSTR="Yes" ACTIVECOST="20" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Weapon [WEAPONDC] Strike">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869102553" BASECOST="3.0" LEVELS="0" ALIAS="Defensive Throw" POSITION="14" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870100828" NAME="" CATEGORY="Hand To Hand" DISPLAY="Defensive Throw" OCV="+1" DCV="+1" DC="0" PHASE="1/2" EFFECT="Block, Target Falls" ADDSTR="No" ACTIVECOST="30" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869104913" BASECOST="5.0" LEVELS="0" ALIAS="Disarming Throw" POSITION="15" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870100828" NAME="" CATEGORY="Hand To Hand" DISPLAY="Disarming Throw" OCV="+0" DCV="+0" DC="1" PHASE="1/2" EFFECT="Grab Weapon, [STRDC] to take weapon away; Target Falls" ADDSTR="Yes" ACTIVECOST="25" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869107338" BASECOST="4.0" LEVELS="0" ALIAS="Fast Strike" POSITION="16" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870100828" NAME="" CATEGORY="Hand To Hand" DISPLAY="Fast Strike" OCV="+2" DCV="+0" DC="2" PHASE="1/2" EFFECT="[NORMALDC] Strike" ADDSTR="Yes" ACTIVECOST="20" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Weapon [WEAPONDC] Strike">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869109943" BASECOST="5.0" LEVELS="0" ALIAS="Flying Dodge" POSITION="17" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870100828" NAME="" CATEGORY="Hand To Hand" DISPLAY="Flying Dodge" OCV="--" DCV="+4" DC="0" PHASE="1/2" EFFECT="Dodge All Attacks, Abort; FMove" ADDSTR="No" ACTIVECOST="50" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869112578" BASECOST="5.0" LEVELS="0" ALIAS="Flying Grab" POSITION="18" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870100828" NAME="" CATEGORY="Hand To Hand" DISPLAY="Flying Grab" OCV="-2" DCV="-1" DC="2" PHASE="1/2" EFFECT="Grab Two Limbs, [STRDC] for holding on; FMove" ADDSTR="Yes" ACTIVECOST="25" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Grab Two Limbs, [STRDC] for holding on; FMove">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869115083" BASECOST="3.0" LEVELS="0" ALIAS="Flying Tackle" POSITION="19" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870100828" NAME="" CATEGORY="Hand To Hand" DISPLAY="Flying Tackle" OCV="+0" DCV="-1" DC="0" PHASE="1/2" EFFECT="[NORMALDC] +v/10 Strike; You Fall, Target Falls; FMove" ADDSTR="Yes" ACTIVECOST="40" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869117411" BASECOST="5.0" LEVELS="0" ALIAS="Grappling Block" POSITION="20" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870100828" NAME="" CATEGORY="Hand To Hand" DISPLAY="Grappling Block" OCV="+1" DCV="+1" DC="0" PHASE="1/2" EFFECT="Grab One Limb, Block" ADDSTR="Yes" ACTIVECOST="-5" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869119873" BASECOST="3.0" LEVELS="0" ALIAS="Grappling Throw" POSITION="21" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870100828" NAME="" CATEGORY="Hand To Hand" DISPLAY="Grappling Throw" OCV="+0" DCV="+2" DC="2" PHASE="1/2" EFFECT="[NORMALDC] Strike; Target Falls; Must Follow Grab" ADDSTR="Yes" ACTIVECOST="25" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Weapon [WEAPONDC] Strike; Target Falls; Must Follow Grab">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869122050" BASECOST="5.0" LEVELS="0" ALIAS="Joint Break" POSITION="22" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870100828" NAME="" CATEGORY="Hand To Hand" DISPLAY="Joint Break" OCV="-1" DCV="-2" DC="4" PHASE="1/2" EFFECT="Grab One Limb; [KILLINGDC], Disable" ADDSTR="Yes" ACTIVECOST="0" DAMAGETYPE="0" MAXSTR="35" STRMULT="1" USEWEAPON="No">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869124505" BASECOST="4.0" LEVELS="0" ALIAS="Joint Lock/Throw" POSITION="23" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870100828" NAME="" CATEGORY="Hand To Hand" DISPLAY="Joint Lock/Throw" OCV="+1" DCV="+0" DC="2" PHASE="1/2" EFFECT="Grab One Limb; [NNDDC]; Target Falls" ADDSTR="No" ACTIVECOST="27" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Grab One Limb; [NNDDC]; Target Falls">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869128663" BASECOST="4.0" LEVELS="0" ALIAS="Killing Strike" POSITION="24" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870100828" NAME="" CATEGORY="Hand To Hand" DISPLAY="Killing Strike" OCV="-2" DCV="+0" DC="2" PHASE="1/2" EFFECT="[KILLINGDC]" ADDSTR="Yes" ACTIVECOST="10" DAMAGETYPE="0" MAXSTR="25" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="[WEAPONKILLINGDC]">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869131106" BASECOST="5.0" LEVELS="0" ALIAS="Killing Throw" POSITION="25" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870100828" NAME="" CATEGORY="Hand To Hand" DISPLAY="Killing Throw" OCV="-2" DCV="+0" DC="2" PHASE="1/2" EFFECT="[KILLINGDC], Target Falls" ADDSTR="Yes" ACTIVECOST="35" DAMAGETYPE="0" MAXSTR="25" STRMULT="1" USEWEAPON="No">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869133943" BASECOST="3.0" LEVELS="0" ALIAS="Legsweep" POSITION="26" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870100828" NAME="" CATEGORY="Hand To Hand" DISPLAY="Legsweep" OCV="+2" DCV="-1" DC="1" PHASE="1/2" EFFECT="[NORMALDC] Strike, Target Falls" ADDSTR="Yes" ACTIVECOST="35" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Weapon [WEAPONDC] Strike, Target Falls">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869136317" BASECOST="4.0" LEVELS="0" ALIAS="Martial Block" POSITION="27" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870100828" NAME="" CATEGORY="Hand To Hand" DISPLAY="Martial Block" OCV="+2" DCV="+2" DC="0" PHASE="1/2" EFFECT="Block, Abort" ADDSTR="No" ACTIVECOST="20" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Block, Abort">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869138953" BASECOST="4.0" LEVELS="0" ALIAS="Martial Disarm" POSITION="28" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870100828" NAME="" CATEGORY="Hand To Hand" DISPLAY="Martial Disarm" OCV="-1" DCV="+1" DC="2" PHASE="1/2" EFFECT="Disarm; [STRDC] to Disarm" ADDSTR="Yes" ACTIVECOST="5" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Disarm; [STRDC] to Disarm roll">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869143673" BASECOST="4.0" LEVELS="0" ALIAS="Martial Dodge" POSITION="29" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870100828" NAME="" CATEGORY="Hand To Hand" DISPLAY="Martial Dodge" OCV="--" DCV="+5" DC="0" PHASE="1/2" EFFECT="Dodge, Affects All Attacks, Abort" ADDSTR="No" ACTIVECOST="35" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869146178" BASECOST="4.0" LEVELS="0" ALIAS="Martial Escape" POSITION="30" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870100828" NAME="" CATEGORY="Hand To Hand" DISPLAY="Martial Escape" OCV="+0" DCV="+0" DC="3" PHASE="1/2" EFFECT="[STRDC] vs. Grabs" ADDSTR="Yes" ACTIVECOST="10" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869149113" BASECOST="4.0" LEVELS="0" ALIAS="Martial Flash" POSITION="31" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870100828" NAME="" INPUT="Hearing" CATEGORY="Hand To Hand" DISPLAY="Martial Flash" OCV="-1" DCV="-1" DC="4" PHASE="1/2" EFFECT="[FLASHDC]" ADDSTR="No" ACTIVECOST="10" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="[FLASHDC]">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869151722" BASECOST="3.0" LEVELS="0" ALIAS="Martial Grab" POSITION="32" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870100828" NAME="" CATEGORY="Hand To Hand" DISPLAY="Martial Grab" OCV="-1" DCV="-1" DC="2" PHASE="1/2" EFFECT="Grab Two Limbs, [STRDC] for holding on" ADDSTR="Yes" ACTIVECOST="-5" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Grab Two Limbs, [STRDC] for holding on">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869154813" BASECOST="4.0" LEVELS="0" ALIAS="Martial Strike" POSITION="33" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870100828" NAME="" CATEGORY="Hand To Hand" DISPLAY="Martial Strike" OCV="+0" DCV="+2" DC="2" PHASE="1/2" EFFECT="[NORMALDC] Strike" ADDSTR="Yes" ACTIVECOST="20" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Weapon [WEAPONDC] Strike">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869157442" BASECOST="3.0" LEVELS="0" ALIAS="Martial Throw" POSITION="34" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870100828" NAME="" CATEGORY="Hand To Hand" DISPLAY="Martial Throw" OCV="+0" DCV="+1" DC="0" PHASE="1/2" EFFECT="[NORMALDC] +v/10, Target Falls" ADDSTR="Yes" ACTIVECOST="40" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Weapon [WEAPONDC] +v/10, Target Falls">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869160053" BASECOST="4.0" LEVELS="0" ALIAS="Nerve Strike" POSITION="35" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870100828" NAME="" CATEGORY="Hand To Hand" DISPLAY="Nerve Strike" OCV="-1" DCV="+1" DC="4" PHASE="1/2" EFFECT="[NNDDC]" ADDSTR="No" ACTIVECOST="15" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="[NNDDC]">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869162639" BASECOST="5.0" LEVELS="0" ALIAS="Offensive Strike" POSITION="36" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870100828" NAME="" CATEGORY="Hand To Hand" DISPLAY="Offensive Strike" OCV="-2" DCV="+1" DC="4" PHASE="1/2" EFFECT="[NORMALDC] Strike" ADDSTR="Yes" ACTIVECOST="15" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Weapon [WEAPONDC] Strike">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869165362" BASECOST="5.0" LEVELS="0" ALIAS="Passing Disarm" POSITION="37" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870100828" NAME="" CATEGORY="Hand To Hand" DISPLAY="Passing Disarm" OCV="-1" DCV="-1" DC="2" PHASE="1/2" EFFECT="Disarm, [STRDC] to Disarm; FMove" ADDSTR="Yes" ACTIVECOST="15" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Disarm, [STRDC] to Disarm roll; FMove">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869168373" BASECOST="5.0" LEVELS="0" ALIAS="Passing Strike" POSITION="38" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870100828" NAME="" CATEGORY="Hand To Hand" DISPLAY="Passing Strike" OCV="+1" DCV="+0" DC="0" PHASE="1/2" EFFECT="[NORMALDC] +v/10; FMove" ADDSTR="Yes" ACTIVECOST="35" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Weapon [WEAPONDC] +v/10; FMove">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869171034" BASECOST="5.0" LEVELS="0" ALIAS="Passing Throw" POSITION="39" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870100828" NAME="" CATEGORY="Hand To Hand" DISPLAY="Passing Throw" OCV="+0" DCV="+0" DC="0" PHASE="1/2" EFFECT="[NORMALDC] +v/10; Target Falls; FMove" ADDSTR="Yes" ACTIVECOST="55" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Weapon [WEAPONDC] +v/10; Target Falls; FMove">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869174353" BASECOST="4.0" LEVELS="0" ALIAS="Reversal" POSITION="40" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870100828" NAME="" CATEGORY="Hand To Hand" DISPLAY="Reversal" OCV="-1" DCV="-2" DC="3" PHASE="var" EFFECT="[STRDC] to Escape; Grab Two Limbs" ADDSTR="Yes" ACTIVECOST="-10" DAMAGETYPE="0" MAXSTR="0" STRMULT="2" USEWEAPON="No">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869177386" BASECOST="4.0" LEVELS="0" ALIAS="Root" POSITION="41" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870100828" NAME="" CATEGORY="Hand To Hand" DISPLAY="Root" OCV="+0" DCV="+0" DC="3" PHASE="1/2" EFFECT="[STRDC] to resist Shove; Block, Abort" ADDSTR="Yes" ACTIVECOST="20" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869180040" BASECOST="4.0" LEVELS="0" ALIAS="Sacrifice Disarm" POSITION="42" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870100828" NAME="" CATEGORY="Hand To Hand" DISPLAY="Sacrifice Disarm" OCV="+2" DCV="-2" DC="2" PHASE="1/2" EFFECT="Disarm, [STRDC] to Disarm" ADDSTR="Yes" ACTIVECOST="5" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Disarm, [STRDC] to Disarm roll">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869182613" BASECOST="4.0" LEVELS="0" ALIAS="Sacrifice Lunge" POSITION="43" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870100828" NAME="" CATEGORY="Hand To Hand" DISPLAY="Sacrifice Lunge" OCV="+2" DCV="-2" DC="0" PHASE="1/2" EFFECT="[NORMALDC] +v/10; FMove" ADDSTR="Yes" ACTIVECOST="30" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Weapon [WEAPONDC] +v/10; FMove">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869185274" BASECOST="5.0" LEVELS="0" ALIAS="Sacrifice Strike" POSITION="44" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870100828" NAME="" CATEGORY="Hand To Hand" DISPLAY="Sacrifice Strike" OCV="+1" DCV="-2" DC="4" PHASE="1/2" EFFECT="[NORMALDC] Strike" ADDSTR="Yes" ACTIVECOST="15" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Weapon [WEAPONDC] Strike">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869187763" BASECOST="3.0" LEVELS="0" ALIAS="Sacrifice Throw" POSITION="45" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870100828" NAME="" CATEGORY="Hand To Hand" DISPLAY="Sacrifice Throw" OCV="+2" DCV="+1" DC="0" PHASE="1/2" EFFECT="[NORMALDC] Strike; You Fall, Target Falls" ADDSTR="Yes" ACTIVECOST="35" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Weapon [WEAPONDC] Strike; You Fall, Target Falls">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869190418" BASECOST="4.0" LEVELS="0" ALIAS="Shove" POSITION="46" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870100828" NAME="" CATEGORY="Hand To Hand" DISPLAY="Shove" OCV="+0" DCV="+0" DC="3" PHASE="1/2" EFFECT="[STRDC] to Shove" ADDSTR="Yes" ACTIVECOST="10" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="[STRDC] to Shove">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869192882" BASECOST="5.0" LEVELS="0" ALIAS="Takeaway" POSITION="47" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870100828" NAME="" CATEGORY="Hand To Hand" DISPLAY="Takeaway" OCV="+0" DCV="+0" DC="2" PHASE="1/2" EFFECT="Grab Weapon, [STRDC] to take weapon away" ADDSTR="Yes" ACTIVECOST="5" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Grab Weapon, [STRDC] to take weapon away">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869195883" BASECOST="3.0" LEVELS="0" ALIAS="Takedown" POSITION="48" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870100828" NAME="" CATEGORY="Hand To Hand" DISPLAY="Takedown" OCV="+1" DCV="+1" DC="0" PHASE="1/2" EFFECT="[NORMALDC] Strike; Target Falls" ADDSTR="Yes" ACTIVECOST="35" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Weapon [WEAPONDC] Strike; Target Falls">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869198783" BASECOST="4.0" LEVELS="0" ALIAS="Weapon Bind" POSITION="49" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870100828" NAME="" CATEGORY="Hand To Hand" DISPLAY="Weapon Bind" OCV="+1" DCV="+0" DC="2" PHASE="1/2" EFFECT="Bind, [STRDC]" ADDSTR="Yes" ACTIVECOST="5" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Bind, [STRDC]">
                                <NOTES />
                                </MANEUVER>
                                <LIST XMLID="GENERIC_OBJECT" ID="1766870285139" BASECOST="0.0" LEVELS="0" ALIAS=" " POSITION="50" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
                                <NOTES />
                                </LIST>
                                <LIST XMLID="GENERIC_OBJECT" ID="1766870289168" BASECOST="0.0" LEVELS="0" ALIAS="Ranged Maneuvers" POSITION="51" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
                                <NOTES />
                                </LIST>
                                <MANEUVER XMLID="MANEUVER" ID="1766869219130" BASECOST="4.0" LEVELS="0" ALIAS="Basic Shot" POSITION="52" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870289168" NAME="" CATEGORY="Ranged" DISPLAY="Basic Shot" OCV="+0" DCV="+0" DC="2" PHASE="1/2" EFFECT="Strike, [WEAPONDC]" ADDSTR="No" ACTIVECOST="16" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" RANGE="2">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869221810" BASECOST="3.0" LEVELS="0" ALIAS="Defensive Shot" POSITION="53" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870289168" NAME="" CATEGORY="Ranged" DISPLAY="Defensive Shot" OCV="-1" DCV="+2" DC="0" PHASE="1/2" EFFECT="Strike [WEAPONDC]" ADDSTR="No" ACTIVECOST="5" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" RANGE="0">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869224318" BASECOST="5.0" LEVELS="0" ALIAS="Distance Shot" POSITION="54" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870289168" NAME="" CATEGORY="Ranged" DISPLAY="Distance Shot" OCV="+0" DCV="-2" DC="0" PHASE="1+1" EFFECT="Strike [WEAPONDC], +1 Segment" ADDSTR="No" ACTIVECOST="3" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" RANGE="6">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869226753" BASECOST="5.0" LEVELS="0" ALIAS="Far Shot" POSITION="55" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870289168" NAME="" CATEGORY="Ranged" DISPLAY="Far Shot" OCV="+1" DCV="-1" DC="0" PHASE="1/2" EFFECT="Strike [WEAPONDC]" ADDSTR="No" ACTIVECOST="12" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" RANGE="4">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869229538" BASECOST="5.0" LEVELS="0" ALIAS="Offensive Ranged Disarm" POSITION="56" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870289168" NAME="" CATEGORY="Ranged" DISPLAY="Offensive Ranged Disarm" OCV="+1" DCV="-1" DC="2" PHASE="1/2" EFFECT="Disarm, [WEAPONDC] to Disarm" ADDSTR="No" ACTIVECOST="11" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" RANGE="2">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869232330" BASECOST="4.0" LEVELS="0" ALIAS="Offensive Shot" POSITION="57" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870289168" NAME="" CATEGORY="Ranged" DISPLAY="Offensive Shot" OCV="-1" DCV="-1" DC="4" PHASE="1/2" EFFECT="Strike, [WEAPONDC]" ADDSTR="No" ACTIVECOST="10" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" RANGE="0">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869234770" BASECOST="5.0" LEVELS="0" ALIAS="Offensive Trip" POSITION="58" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870289168" NAME="" CATEGORY="Ranged" DISPLAY="Offensive Trip" OCV="+1" DCV="-1" DC="0" PHASE="1/2" EFFECT="Strike [WEAPONDC] +v/10, Target Falls" ADDSTR="No" ACTIVECOST="35" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" RANGE="0">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869237093" BASECOST="4.0" LEVELS="0" ALIAS="Quick Shot" POSITION="59" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870289168" NAME="" CATEGORY="Ranged" DISPLAY="Quick Shot" OCV="+1" DCV="+0" DC="2" PHASE="1/2" EFFECT="Strike, [WEAPONDC]" ADDSTR="No" ACTIVECOST="15" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" RANGE="0">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869240113" BASECOST="4.0" LEVELS="0" ALIAS="Ranged Disarm" POSITION="60" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870289168" NAME="" CATEGORY="Ranged" DISPLAY="Ranged Disarm" OCV="+0" DCV="+0" DC="3" PHASE="1/2" EFFECT="Disarm, [WEAPONDC] to Disarm" ADDSTR="Yes" ACTIVECOST="10" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" RANGE="0">
                                <NOTES />
                                </MANEUVER>
                                <MANEUVER XMLID="MANEUVER" ID="1766869242939" BASECOST="4.0" LEVELS="0" ALIAS="Trip" POSITION="61" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1766870289168" NAME="" CATEGORY="Ranged" DISPLAY="Trip" OCV="-1" DCV="-1" DC="0" PHASE="1/2" EFFECT="v/5, Target Falls" ADDSTR="No" ACTIVECOST="31" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" RANGE="2">
                                <NOTES />
                                </MANEUVER>
                            </MARTIALARTS>
                            <POWERS />
                            <DISADVANTAGES />
                            <EQUIPMENT />
                        </CHARACTER>
                    `;

                    let actor;
                    before(async function () {
                        actor = await createQuenchActor({ quench: this, contents, is5e: false, actorType: "pc" });
                    });

                    after(async function () {
                        await deleteQuenchActor({ quench: this, actor });
                    });

                    it("should have martial art maneuvers", function () {
                        const maneuvers = actor.items.filter((item) => item.system.XMLID === "MANEUVER");
                        expect(maneuvers.length).to.be.greaterThan(0);
                    });

                    it("each martial art maneuver should have behaviorsByItem array with at least 1 string", function () {
                        const maneuvers = actor.items.filter((item) => item.system.XMLID === "MANEUVER");

                        maneuvers.forEach((maneuver) => {
                            const behaviors = maneuver.baseInfo.behaviorsByItem(maneuver);
                            expect(behaviors).to.be.an(
                                "array",
                                `Maneuver "${maneuver.name}" should have behaviorsByItem return an array`,
                            );
                            expect(behaviors.length).to.be.greaterThan(
                                0,
                                `Maneuver "${maneuver.name}" should have at least 1 behavior`,
                            );
                            behaviors.forEach((behavior) => {
                                expect(behavior).to.be.a(
                                    "string",
                                    `Each behavior for maneuver "${maneuver.name}" should be a string`,
                                );
                            });
                        });
                    });
                });
            });
        },
        {
            displayName: "HERO: Maneuver",
        },
    );
}
