export function cleanAndParseJson(text: string): any {
  if (!text) return null;
  let cleanText = text.trim();

  if (cleanText.startsWith("```")) {
    const matches = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (matches?.[1]) {
      cleanText = matches[1].trim();
    }
  }

  const firstBrace = cleanText.indexOf("{");
  const lastBrace = cleanText.lastIndexOf("}");
  const firstBracket = cleanText.indexOf("[");
  const lastBracket = cleanText.lastIndexOf("]");

  let targetText = cleanText;
  if (firstBrace !== -1 && lastBrace !== -1) {
    if (firstBracket !== -1 && firstBracket < firstBrace && lastBracket !== -1 && lastBracket > lastBrace) {
      targetText = cleanText.slice(firstBracket, lastBracket + 1);
    } else {
      targetText = cleanText.slice(firstBrace, lastBrace + 1);
    }
  } else if (firstBracket !== -1 && lastBracket !== -1) {
    targetText = cleanText.slice(firstBracket, lastBracket + 1);
  }

  try {
    return JSON.parse(targetText);
  } catch {
    const simpleClean = targetText
      .replace(/,\s*([\]}])/g, "$1")
      .replace(/^\s*\/\/.*$/gm, "");
    return JSON.parse(simpleClean);
  }
}

export function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  const watchMatch = url.match(/[?&]v=([^&]+)/);
  if (watchMatch) return watchMatch[1];
  const shortMatch = url.match(/youtu\.be\/([^?&]+)/);
  if (shortMatch) return shortMatch[1];
  return null;
}
