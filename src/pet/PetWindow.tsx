import { useMemo } from "react";

type PetMood = "idle" | "focused" | "sleepy";

const moodLabels: Record<PetMood, string> = {
  idle: "发呆中",
  focused: "陪你干活",
  sleepy: "有点困"
};

function getInitialMood(): PetMood {
  return "idle";
}

export function PetWindow() {
  const mood = getInitialMood();

  const face = useMemo(() => {
    if (mood === "focused") {
      return "•̀ᴗ•́";
    }

    if (mood === "sleepy") {
      return "-.-";
    }

    return "•ᴗ•";
  }, [mood]);

  return (
    <main className="pet-shell" aria-label="桌面小怪兽">
      <section className="pet-stage">
        <div className="pet-shadow" />
        <div className="pet-body">
          <div className="pet-ear pet-ear-left" />
          <div className="pet-ear pet-ear-right" />
          <div className="pet-face">{face}</div>
        </div>
      </section>
      <div className="pet-status">{moodLabels[mood]}</div>
    </main>
  );
}
