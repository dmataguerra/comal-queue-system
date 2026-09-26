/**
 * Capa decorativa inspirada directamente en la composición de referencia:
 * un centro despejado y ondas superpuestas que entran por las esquinas.
 * La geometría es fija; las variaciones suaves viven solamente en CSS.
 */
export function AnimatedBackground() {
  return (
    <svg
      className="public-animated-background"
      viewBox="0 0 1920 1080"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      {/* Esquina superior izquierda: dos manchas amplias y una cinta clara. */}
      <g className="background-motion background-top-left">
        <g transform="scale(.78)">
          <path
            className="background-blob background-indigo"
            d="M0 0h336c94 39 135 111 128 187-7 75-79 119-144 92C-45 253-91 192-136 139V0Z"
          />
          <path
            className="background-blob background-pink background-pink-top"
            d="M211 0c97 41 196 100 219 175 24 75-30 143-106 153-80 11-140-42-209-80C64 217 21 195 0 182V0h211Z"
          />
          <path
            className="background-blob background-fog"
            d="M0 239c69-48 141-42 205-9 66 34 96 90 136 119-79 12-163 65-211 138-36 54-76 59-130 51V239Z"
          />
        </g>
      </g>

      <g className="background-motion background-top-right" />

      {/* Esquina inferior izquierda: azul sólido, velo translúcido y línea de contorno. */}
      <g className="background-motion background-bottom-left">
        <g transform="translate(0 238) scale(.78)">
          <path
            className="background-blob background-blue"
            d="M0 647c74-15 160 8 223 73 73 76 70 156 144 186 51 21 95-5 159 7 103 19 155 78 172 167H0V647Z"
          />
          <path
            className="background-blob background-blue-soft"
            d="M0 521c89 1 157 42 218 108 62 67 101 153 192 181 45 14 91 5 143 27 64 27 104 78 121 143H0V521Z"
          />
          <path
            className="background-line"
            d="M0 518c103-3 174 42 235 110 66 74 114 150 205 175 76 21 169 7 252 53 88 49 129 127 155 224"
          />
        </g>
      </g>

      {/* Esquina inferior derecha: capas rosa, lila y violeta como la referencia. */}
      <g className="background-motion background-bottom-right">
        <g transform="translate(422 238) scale(.78)">
          <path
            className="background-blob background-lilac"
            d="M889 1080c13-107 63-181 157-230 74-39 135-57 184-124 58-80 128-128 223-136 94-8 163 25 220 72 74 61 152 41 247 56v362H889Z"
          />
          <path
            className="background-blob background-pink"
            d="M1101 1080c7-86 49-139 128-170 74-29 127-20 171-73 42-49 48-126 109-186 68-68 154-90 245-66 64 17 111 54 166 76v338h-819Z"
          />
          <path
            className="background-blob background-indigo"
            d="M1197 1080c9-104 49-166 124-198 79-34 141-9 203-49 75-48 98-116 188-149 72-27 144-16 208 18v358h-723Z"
          />
        </g>
      </g>
    </svg>
  );
}
