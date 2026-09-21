"""Build-time synthesis of the announcement catalogue with Piper.

Loads the ONNX voice once and writes every clip listed in the request file, which
avoids paying the ~4 s model load per phrase. The request file is UTF-8 JSON —
a list of {"file": ..., "text": ...} — because piping accented Spanish through the
Windows console would depend on the active code page.

Output is WAV PCM 16-bit mono at the voice sample rate: 22050 Hz for the *-high
voices, which is exactly the format contenido/voz already uses.
"""

import argparse
import json
import sys
import wave
from pathlib import Path

from piper import PiperVoice, SynthesisConfig


def main() -> int:
    parser = argparse.ArgumentParser(description="Synthesize the turn announcements.")
    parser.add_argument("--model", required=True, help="Path to the .onnx voice")
    parser.add_argument("--requests", required=True, help="Path to the UTF-8 JSON request file")
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--length-scale", type=float, default=1.0)
    parser.add_argument("--noise-scale", type=float, default=0.667)
    # The voice ships noise_w 0.8, which jitters phoneme widths: the same phrase comes
    # out 3-4% longer or shorter on every run. At 0 the durations are exact and a
    # rebuild is reproducible, so the 100 clips pace like one session, not 100 takes.
    parser.add_argument("--noise-w-scale", type=float, default=0.0)
    parser.add_argument("--volume", type=float, default=1.0)
    args = parser.parse_args()

    requests = json.loads(Path(args.requests).read_text(encoding="utf-8"))
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    voice = PiperVoice.load(args.model)
    config = SynthesisConfig(
        length_scale=args.length_scale,
        noise_scale=args.noise_scale,
        noise_w_scale=args.noise_w_scale,
        # Piper's normalizer rescales every clip to full scale: it clips on cheap
        # speakers and ties loudness to each clip's loudest phoneme. The raw output is
        # already level-matched across the catalogue, and leaves headroom.
        normalize_audio=False,
        volume=args.volume,
    )

    for entry in requests:
        target = output_dir / entry["file"]
        with wave.open(str(target), "wb") as wav_file:
            voice.synthesize_wav(entry["text"], wav_file, syn_config=config)
        print(f'{entry["file"]}  {entry["text"]}', file=sys.stderr)

    print(json.dumps({"written": len(requests), "voice": Path(args.model).stem}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
