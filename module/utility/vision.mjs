export function setPerceptionModes() {
    // Hero Generic Sense
    CONFIG.Canvas.detectionModes.heroSense = CONFIG.Canvas.detectionModes.feelTremor.clone();
    CONFIG.Canvas.detectionModes.heroSense.id = "heroSense";
    CONFIG.Canvas.detectionModes.heroSense.label = "Hero Sense";
    CONFIG.Canvas.detectionModes.heroSense.type = foundry.canvas.perception.DetectionMode.DETECTION_TYPES.SIGHT;
    CONFIG.Canvas.detectionModes.heroSense.walls = true;
}
