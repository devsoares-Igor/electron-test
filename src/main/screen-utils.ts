import { screen, type Rectangle } from "electron";

export function centerOnDisplay(
    width: number,
    height: number,
    referenceBounds?: Rectangle,
): { x: number; y: number } {
    const display = referenceBounds
        ? screen.getDisplayMatching(referenceBounds)
        : screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const { x: dx, y: dy, width: dw, height: dh } = display.workArea;
    return {
        x: Math.round(dx + (dw - width) / 2),
        y: Math.round(dy + (dh - height) / 2),
    };
}
