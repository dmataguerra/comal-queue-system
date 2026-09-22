/** Decorative-only layer. Motion is handled by CSS, with no animation loop. */
export function AnimatedBackground() {
  return (
    <svg
      className="public-animated-background"
      viewBox="0 0 1920 1080"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <g className="paint-corner paint-upper-left">
        <g className="paint-motion paint-large motion-a">
          <path
            className="paint-navy"
            d="M0 0h161c-12 42 19 57 4 93-16 38-83 42-115 33-27-8-37-1-50 8V0Z"
          />
        </g>
        <g className="paint-motion paint-small motion-b">
          <path
            className="paint-light"
            d="M0 98c28-12 46 5 48 36 2 27 19 42 49 41 21-1 39-18 36-46 40 15 60 53 37 79-22 26-69 19-88 1-24-23-58-12-82 1V98Z"
          />
        </g>
        <g className="paint-motion paint-line-motion motion-c">
          <path className="paint-line" d="M143 75c45-26 65 32 112 34 51 3 83-22 81-80" />
        </g>
        <g className="paint-motion paint-dot-motion motion-d">
          <circle className="paint-dot pale" cx="227" cy="37" r="14" />
        </g>
        <g className="paint-motion paint-dot-motion motion-e">
          <circle className="paint-dot navy" cx="238" cy="138" r="12" />
        </g>
        <g className="paint-motion paint-dot-motion motion-f">
          <circle className="paint-dot pale" cx="121" cy="319" r="19" />
        </g>
      </g>
      <g className="paint-corner paint-upper-right">
        <g className="paint-motion paint-large motion-b">
          <path
            className="paint-light"
            d="M1615 0h305v144c-29-9-44-26-69-42-35-24-76-14-105-33-27-18-39-43-41-69Z"
          />
        </g>
        <g className="paint-motion paint-dot-motion motion-d">
          <circle className="paint-dot pale" cx="1815" cy="131" r="15" />
        </g>
      </g>
      <g className="paint-corner paint-lower-left">
        <g className="paint-motion paint-small motion-c">
          <path
            className="paint-light"
            d="M0 780c35 0 49-34 80-29 33 5 61 40 46 71-12 25-40 28-58 44-17 15-26 33-68 31V780Z"
          />
        </g>
        <g className="paint-motion paint-line-motion motion-a">
          <path
            className="paint-line"
            d="M0 644c38 6 25 55 63 66 28 8 55-2 64 31 9 34 37 56 64 51"
          />
        </g>
        <g className="paint-motion paint-dot-motion motion-e">
          <circle className="paint-dot navy" cx="170" cy="745" r="17" />
        </g>
        <g className="paint-motion paint-dot-motion motion-f">
          <circle className="paint-dot pale" cx="232" cy="782" r="17" />
        </g>
        <g className="paint-motion paint-dot-motion motion-d">
          <circle className="paint-dot blue" cx="102" cy="890" r="23" />
        </g>
      </g>
      <g className="paint-corner paint-lower-right">
        <g className="paint-motion paint-small motion-a">
          <path
            className="paint-light"
            d="M1920 462c-48-6-70 31-58 70 8 26 33 37 38 70 4 27-13 51-37 59 22 18 37 22 57 19V462Z"
          />
        </g>
        <g className="paint-motion paint-large motion-c">
          <path className="paint-navy" d="M1920 681c-29-9-48 6-52 33-5 31 13 59 52 61v-94Z" />
        </g>
        <g className="paint-motion paint-line-motion motion-b">
          <path
            className="paint-line"
            d="M1745 753c40-20 53 10 48 38-4 28 26 25 45 41 19 16 25 44 16 67"
          />
        </g>
        <g className="paint-motion paint-dot-motion motion-f">
          <circle className="paint-dot navy" cx="1813" cy="626" r="15" />
        </g>
        <g className="paint-motion paint-dot-motion motion-e">
          <circle className="paint-dot pale" cx="1707" cy="755" r="12" />
        </g>
        <g className="paint-motion paint-dot-motion motion-d">
          <circle className="paint-dot navy" cx="1814" cy="894" r="17" />
        </g>
        <g className="paint-motion paint-small motion-c">
          <path
            className="paint-light"
            d="M1788 960c28-4 42 20 62 30 23 11 46 0 70 21v81h-157c7-42 5-77 25-132Z"
          />
        </g>
      </g>
    </svg>
  );
}
