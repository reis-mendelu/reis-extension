/**
 * Entry and exit for the report form, one set per presentation.
 *
 * The phone sheet names its transition on purpose. Left unset, Motion animates
 * `y` with its default underdamped spring (stiffness 500, damping 25, a damping
 * ratio of about 0.56), so the sheet shot past its resting edge and dropped
 * back. On the Pixel 9a that bounce was one of the jumps. A 0.3 s ease-out
 * tween is the same curve `Sheet`'s `sheetUp` keyframes give every other phone
 * sheet.
 *
 * The desktop dialog keeps Motion's defaults: it is the extension's centred
 * card and it has no reported fault.
 */
const sheetTween = { type: 'tween', duration: 0.3, ease: 'easeOut' } as const;

export const phoneSheetMotion = {
  initial: { y: '100%' },
  animate: { y: 0, transition: sheetTween },
  exit: { y: '100%', transition: sheetTween },
};

export const desktopDialogMotion = {
  initial: { opacity: 0, scale: 0.95, y: 10 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: 10 },
};
