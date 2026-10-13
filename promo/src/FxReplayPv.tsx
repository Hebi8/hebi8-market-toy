import {Series} from "remotion";
import type {PvProps} from "./project";
import {sceneDurations} from "./project";
import {Scene1Hook} from "./scenes/Scene1Hook";
import {Scene2What} from "./scenes/Scene2What";
import {Scene3Play} from "./scenes/Scene3Play";
import {Scene4Result} from "./scenes/Scene4Result";
import {Scene5Challenge} from "./scenes/Scene5Challenge";
import {Scene6End} from "./scenes/Scene6End";

export const FxReplayPv: React.FC<PvProps> = (props) => {
  return (
    <Series>
      <Series.Sequence name="S1 - Hook" durationInFrames={sceneDurations.s1}>
        <Scene1Hook />
      </Series.Sequence>
      <Series.Sequence name="S2 - What it is" durationInFrames={sceneDurations.s2}>
        <Scene2What {...props} />
      </Series.Sequence>
      <Series.Sequence name="S3 - How it plays" durationInFrames={sceneDurations.s3}>
        <Scene3Play {...props} />
      </Series.Sequence>
      <Series.Sequence name="S4 - Result" durationInFrames={sceneDurations.s4}>
        <Scene4Result {...props} />
      </Series.Sequence>
      <Series.Sequence name="S5 - Challenge a friend" durationInFrames={sceneDurations.s5}>
        <Scene5Challenge {...props} />
      </Series.Sequence>
      <Series.Sequence name="S6 - Where to find it" durationInFrames={sceneDurations.s6}>
        <Scene6End {...props} />
      </Series.Sequence>
    </Series>
  );
};
