/**
 * WebVTT Parser for subtitle handling
 */
export class WebVTTParser {
  parse(vttContent) {
    const lines = vttContent.trim().replace(/\r/g, "").split("\n");
    const cues = [];
    let i = 0;
    const timestampToSeconds = (ts) => {
      const parts = ts.split(":");
      let seconds = 0;
      if (parts.length === 3) {
        // HH:MM:SS.ms
        seconds += parseFloat(parts[0]) * 3600;
        seconds += parseFloat(parts[1]) * 60;
        seconds += parseFloat(parts[2]);
      } else {
        // MM:SS.ms
        seconds += parseFloat(parts[0]) * 60;
        seconds += parseFloat(parts[1]);
      }
      return seconds;
    };

    while (i < lines.length) {
      if (lines[i] && lines[i].includes("-->")) {
        const [startTimeStr, endTimeStr] = lines[i].split(" --> ");
        const endTimeFinalStr = endTimeStr.split(" ")[0];

        const startTime = timestampToSeconds(startTimeStr);
        const endTime = timestampToSeconds(endTimeFinalStr);

        let cueText = [];
        i++;
        while (i < lines.length && lines[i]) {
          cueText.push(lines[i]);
          i++;
        }

        if (cueText.length > 0) {
          try {
            cues.push(new VTTCue(startTime, endTime, cueText.join("\n")));
          } catch (e) {
            console.error("Could not create VTTCue:", e);
          }
        }
      }
      i++;
    }
    return { cues: cues };
  }
}

