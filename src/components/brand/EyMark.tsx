/**
 * EY's corporate mark, sized and coloured to sit beside text.
 *
 * Inline rather than an <img>, for the same reason `ReisLogo` is: the letters
 * take `currentColor`, so the mark reads in both themes off one asset. The
 * shipped `/spolky/ey.svg` cannot be used here — it carries a white ground
 * added so it matches the round society avatars, and a white plate behind a
 * logo is exactly the container that turns a credit into an advert.
 *
 * The beam keeps EY's yellow. It is the distinctive half of the mark, it is a
 * few square millimetres rather than a panel, and dropping it would leave two
 * grey letters nobody recognises. What was avoided was the yellow-on-black
 * BLOCK, not the colour.
 *
 * Geometry is the Wikimedia PD-textlogo file (File:EY_logo_2019.svg — simple
 * geometric shapes, below the threshold of originality); trademark rights still
 * govern USE of the mark, which is what the partnership covers.
 */
export function EyMark({ className = 'h-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 68.67 69.32"
      // w-auto as a class, not an inline style: the height comes from the
      // caller and the width follows the aspect ratio, so the mark tracks the
      // type it sits beside instead of being a fixed box.
      className={`w-auto ${className}`}
      role="img"
      aria-label="EY"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M11.09 61.4h17.37v7.92H.67V34.9h19.7l4.61 7.92H11.1v5.68h12.56v7.22H11.1zm35.86-26.5l-5.9 11.23-5.88-11.23H23.65l12.13 20.82v13.6h10.4v-13.6L58.31 34.9z"
      />
      <path fill="#ffe600" fillRule="evenodd" d="M68.67 12.81V0L0 24.83z" />
    </svg>
  );
}
