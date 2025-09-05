import { HeroSystem6eCardHelpers } from "./card/card-helpers.mjs";

export class HeroSystem6eChatMessage extends ChatMessage {
    // REF: https://github.com/foundryvtt/pf2e/blob/acf49e6130dc43e80c9b1f63fcb58a1ab611b4ce/src/module/chat-message/document.ts#L23

    // V12
    async getHTML() {
        let html = await super.getHTML();

        this.heroHeader(html?.[0]);
        HeroSystem6eCardHelpers.onMessageRendered($(html));
        HeroSystem6eCardHelpers.chatListeners($(html));

        return html;
    }

    // V13
    async renderHTML(options) {
        const html = await super.renderHTML(options);

        this.heroHeader(html);
        HeroSystem6eCardHelpers.onMessageRendered($(html));
        HeroSystem6eCardHelpers.chatListeners($(html));

        return html;
    }

    get speakerActor() {
        // V13
        if (super.speakerActor) {
            // return this.constructor.getSpeakerActor(this.speaker) ?? this.author?.character ?? null;
            return super.speakerActor;
        }

        // V12
        return ChatMessage?.getSpeakerActor?.(this.speaker);
    }

    get speakerToken() {
        if (!game.scenes) return null; // In case we're in the middle of game setup
        const sceneId = this.speaker.scene ?? "";
        const tokenId = this.speaker.token ?? "";
        return game.scenes.get(sceneId)?.tokens.get(tokenId) ?? this.speakerActor?.prototypeToken ?? null;
    }

    heroHeader(html) {
        const header = html?.querySelector("header.message-header");
        if (header) {
            try {
                const actor = this.speakerActor;
                const token = this.speakerToken;

                if (token) {
                    const [imageUrl, scale] = (() => {
                        //const tokenImage = token.texture.src;
                        // const hasTokenImage = tokenImage && fh.media.ImageHelper.hasImageExtension(tokenImage);
                        // if (!hasTokenImage) {
                        // || isDefaultTokenImage(token)) {
                        return [actor?.img || token.texture.src, 1];
                        //}

                        // Calculate the correction factor for dynamic tokens.
                        // Prototype tokens do not have access to subjectScaleAdjustment so we recompute using default values
                        // const defaultRingThickness = 0.1269848;
                        // const defaultSubjectThickness = 0.6666666;
                        // const scaleCorrection = token.ring.enabled
                        //     ? 1 / (defaultRingThickness + defaultSubjectThickness)
                        //     : 1;
                        // return [tokenImage, Math.max(1, token.texture.scaleX ?? 1) * scaleCorrection];
                    })();

                    const image = document.createElement("img");
                    image.alt = actor?.name || token.name;
                    image.src = imageUrl;
                    image.inert = true;
                    image.style.transform = `scale(${scale})`;

                    // If image scale is above 1.2, we might need to add a radial fade to not block out the name
                    if (scale > 1.2) {
                        const ringPercent = 100 - Math.floor(((scale - 0.7) / scale) * 100);
                        const limitPercent = 100 - Math.floor(((scale - 1.15) / scale) * 100);
                        image.style.maskImage = `radial-gradient(circle at center, black ${ringPercent}%, rgba(0, 0, 0, 0.2) ${limitPercent}%)`;
                    }

                    //const usedToken = imageUrl === token.texture.src;

                    // const portrait = createHTMLElement("div", {
                    //     children: [image],
                    //     classes: ["portrait", usedToken ? "token" : "actor-image"],
                    // });

                    header.classList.add("with-image");
                    const portrait = document.createElement("div");
                    portrait.classList.add("portrait");
                    portrait.append(image);

                    header.prepend(portrait);

                    const messageSender = header.querySelector(".message-sender");

                    if (messageSender && this.author) {
                        if (messageSender.textContent === this.author.name) {
                            console.warn(`speaker.alias === author.name. Verify CONST.CHAT_MESSAGE_STYLES.IC`);
                        } else {
                            const authorElement = document.createElement("span");
                            authorElement.classList.add("user");
                            authorElement.append(this.author.name);
                            messageSender.append(authorElement);
                        }
                    }
                }
            } catch (e) {
                console.error(e);
            }
        }
    }
}
