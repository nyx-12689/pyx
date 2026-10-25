import type { FormatArticle } from "./types"

export const GIF_ARTICLES: FormatArticle[] = [
  {
    id: "gif",
    section: "gif",
    name: "GIF",
    tagline: "The classic looping image: plays everywhere, but only 256 colours and no sound.",
    facts: {
      fullName: "Graphics Interchange Format",
      type: "Image format (animated)",
      createdBy: "CompuServe (Steve Wilhite's team)",
      released: "1987",
      compression: "Lossless",
      licence: "Free (patents expired in 2004)",
      extensions: [".gif"],
      mime: "image/gif",
    },
    overview: [
      "GIF is older than the web, and it's still the easiest way to share a short loop: it plays by itself, silently and endlessly, almost anywhere, including email.",
      "Each frame can only use 256 colours, there's no sound, and the files grow quickly with length and size. For anything longer than a few seconds, a short MP4 is usually five to ten times smaller.",
    ],
    useWhen: [
      "Short reactions and loops for chat, Slack and email.",
      "Small animations where video isn't allowed.",
    ],
    avoidWhen: [
      "Clips longer than a few seconds, or large sizes: use MP4.",
      "Anything with sound.",
      "Photos with smooth gradients, which show banding with only 256 colours.",
    ],
    howItWorks: [
      "Each frame uses a palette of up to 256 colours; every pixel is a number pointing into it.",
      "Frames are compressed with LZW, a lossless method that replaces repeating patterns with short codes.",
      "Each frame has a delay, and a loop count tells players to repeat. A single palette colour can be marked transparent.",
      "Dithering scatters pixels of nearby colours to fake the ones the palette lacks.",
    ],
    history: [
      { year: "1987", text: "CompuServe releases GIF so images can be shared across different computers." },
      { year: "1989", text: "GIF89a adds transparency and frame delays, making animation possible." },
      { year: "1995", text: "Netscape Navigator 2.0 adds looping, and the animated GIF is born." },
      { year: "2004", text: "The last LZW patents expire, after a decade of disputes that led to PNG." },
      { year: "2012", text: "\"GIF\" is the Oxford American Dictionaries' word of the year." },
      { year: "2013", text: "Its creator, Steve Wilhite, says it's pronounced \"jif\"." },
    ],
    whoUses: [
      "Messaging apps, Slack and email newsletters.",
      "GIPHY and Tenor (which often send MP4 behind the scenes to save data).",
      "Documentation and bug reports showing short interactions.",
    ],
    support: { mac: true, ios: true, windows: true, android: true, web: true },
    tips: [
      "Keep it to a few seconds, 480 px wide and 10–15 frames per second.",
      "Pyx builds a palette from each clip, so its 256 colours are the right ones.",
      "If the destination accepts video, send a short MP4 instead.",
    ],
    related: ["mp4", "webp", "png"],
    toolId: "convert.gif",
  },
]
